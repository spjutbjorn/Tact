import { DeleteFile, GetCwd, ListDir, ListRecursiveFiles, MkDir, ReadTextFile, Rename, WriteTextFile } from "./wails";
import { basename, joinPath } from "./path";

export interface MediaItem {
  path: string;
  isDir: boolean;
}

export interface MediaWorkspace {
  version: 2;
  name: string;
  items: MediaItem[];
  thumbnails: Record<string, string>;
}

export interface MediaWorkspaceSummary {
  path: string;
  name: string;
}

export interface MediaState {
  ready: boolean;
  loading: boolean;
  workspaces: MediaWorkspaceSummary[];
  activePath: string | null;
  active: MediaWorkspace | null;
}

const MEDIA_DIR_NAME = ".tact-media";
const ACTIVE_WORKSPACE_KEY = "tact.media.activeWorkspace";
export const MEDIA_BATCH_EVENT = "tact:media-batch";

const DEFAULT_STATE: MediaState = {
  ready: false,
  loading: false,
  workspaces: [],
  activePath: null,
  active: null,
};

type Listener = () => void;

function cloneItems(items: MediaItem[]): MediaItem[] {
  return items.map((item) => ({ ...item }));
}

function cloneWorkspace(workspace: MediaWorkspace): MediaWorkspace {
  return {
    version: 2,
    name: workspace.name,
    items: cloneItems(workspace.items),
    thumbnails: { ...workspace.thumbnails },
  };
}

function uniqueByPath(items: MediaItem[]): MediaItem[] {
  const seen = new Set<string>();
  const result: MediaItem[] = [];
  for (const item of items) {
    if (!item?.path || seen.has(item.path)) continue;
    seen.add(item.path);
    result.push({ path: item.path, isDir: item.isDir });
  }
  return result;
}

function collectReferencedPaths(items: MediaItem[]): Set<string> {
  const paths = new Set<string>();
  for (const item of items) {
    if (item?.path) paths.add(item.path);
  }
  return paths;
}

function pruneThumbnails(workspace: MediaWorkspace): Record<string, string> {
  const allowed = collectReferencedPaths(workspace.items);
  const next: Record<string, string> = {};
  for (const [path, value] of Object.entries(workspace.thumbnails ?? {})) {
    if (allowed.has(path)) {
      next[path] = value;
    }
  }
  return next;
}

function sanitizeFileName(name: string): string {
  const trimmed = name.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  return trimmed || "View";
}

function workspaceLabelFromPath(path: string): string {
  const name = basename(path).replace(/\.json$/i, "");
  return name || "View";
}

function workspaceFileName(name: string): string {
  return `${sanitizeFileName(name)}.json`;
}

function nextWorkspaceName(existingNames: string[]): string {
  const used = new Set(existingNames.map((name) => name.toLowerCase()));
  let index = 1;
  while (used.has(`view ${index}`)) {
    index += 1;
  }
  return `View ${index}`;
}

function parseMediaItem(value: unknown): MediaItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<MediaItem>;
  if (typeof item.path !== "string" || typeof item.isDir !== "boolean") return null;
  return { path: item.path, isDir: item.isDir };
}

function parseWorkspace(raw: string, fallbackName: string): MediaWorkspace | null {
  try {
    const parsed = JSON.parse(raw) as Partial<MediaWorkspace> & {
      items?: unknown;
      thumbnails?: unknown;
    };
    const items = Array.isArray(parsed.items)
      ? parsed.items.map(parseMediaItem).filter((item): item is MediaItem => item !== null)
      : [];
    const thumbnails: Record<string, string> = {};
    if (parsed.thumbnails && typeof parsed.thumbnails === "object") {
      for (const [key, value] of Object.entries(parsed.thumbnails as Record<string, unknown>)) {
        if (typeof key === "string" && typeof value === "string" && value) {
          thumbnails[key] = value;
        }
      }
    }

    return {
      version: 2,
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : fallbackName,
      items: uniqueByPath(items),
      thumbnails: pruneThumbnails({
        version: 2,
        name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : fallbackName,
        items: uniqueByPath(items),
        thumbnails,
      }),
    };
  } catch {
    return null;
  }
}

function loadLegacyWorkspaceFromLocalStorage(): MediaWorkspace | null {
  try {
    const itemsRaw = localStorage.getItem("tact.mediaItems");
    const snapshotsRaw = localStorage.getItem("tact.mediaSnapshots");
    if (!itemsRaw && !snapshotsRaw) return null;

    const items = itemsRaw ? (JSON.parse(itemsRaw) as unknown[]).map(parseMediaItem).filter((item): item is MediaItem => item !== null) : [];

    return {
      version: 2,
      name: "View 1",
      items: uniqueByPath(items),
      thumbnails: {},
    };
  } catch {
    return null;
  }
}

class MediaProjectsStore {
  private state: MediaState = DEFAULT_STATE;
  private listeners = new Set<Listener>();
  private initPromise: Promise<void> | null = null;
  private saveTimer: number | null = null;
  private workspaceDir = "";

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): MediaState {
    return this.state;
  }

  async initialize(): Promise<void> {
    if (this.state.ready) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private setState(next: MediaState): void {
    this.state = next;
    for (const listener of this.listeners) {
      listener();
    }
  }

  private async doInitialize(): Promise<void> {
    this.setState({ ...this.state, loading: true });
    const cwd = await GetCwd();
    this.workspaceDir = joinPath(cwd || ".", MEDIA_DIR_NAME);
    await MkDir(this.workspaceDir);

    const entries = await ListDir(this.workspaceDir);
    let workspaces = entries
      .filter((entry) => !entry.isDir && entry.name.toLowerCase().endsWith(".json"))
      .map((entry) => ({
        path: joinPath(this.workspaceDir, entry.name),
        name: workspaceLabelFromPath(entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

    if (workspaces.length === 0) {
      const legacy = loadLegacyWorkspaceFromLocalStorage();
      const name = nextWorkspaceName([]);
      const path = joinPath(this.workspaceDir, workspaceFileName(name));
      const workspace: MediaWorkspace = legacy
        ? { ...legacy, name }
        : { version: 2, name, items: [], thumbnails: {} };
      await this.writeWorkspace(path, workspace);
      workspaces = [{ path, name }];
    }

    const savedActivePath = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
    const activePath = workspaces.some((workspace) => workspace.path === savedActivePath)
      ? savedActivePath
      : workspaces[0]?.path ?? null;

    let active = activePath ? await this.loadWorkspace(activePath) : null;
    if (!active && activePath) {
      active = {
        version: 2,
        name: workspaceLabelFromPath(activePath),
        items: [],
        thumbnails: {},
      };
      await this.writeWorkspace(activePath, active);
    }

    if (activePath) {
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, activePath);
    }

    this.setState({
      ready: true,
      loading: false,
      workspaces,
      activePath,
      active,
    });
  }

  private async refreshWorkspaces(): Promise<MediaWorkspaceSummary[]> {
    const entries = await ListDir(this.workspaceDir);
    const workspaces = entries
      .filter((entry) => !entry.isDir && entry.name.toLowerCase().endsWith(".json"))
      .map((entry) => ({
        path: joinPath(this.workspaceDir, entry.name),
        name: workspaceLabelFromPath(entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    return workspaces;
  }

  private async loadWorkspace(path: string): Promise<MediaWorkspace | null> {
    const raw = await ReadTextFile(path);
    if (!raw) return null;
    return parseWorkspace(raw, workspaceLabelFromPath(path));
  }

  private async writeWorkspace(path: string, workspace: MediaWorkspace): Promise<boolean> {
    const next = cloneWorkspace({
      ...workspace,
      items: uniqueByPath(workspace.items),
      thumbnails: pruneThumbnails(workspace),
    });
    return WriteTextFile(path, JSON.stringify(next, null, 2));
  }

  private async flushSave(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    const { activePath, active } = this.state;
    if (!activePath || !active) return;
    await this.writeWorkspace(activePath, active);
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.flushSave();
    }, 150);
  }

  private async ensureReady(): Promise<void> {
    await this.initialize();
  }

  async selectWorkspace(path: string): Promise<boolean> {
    await this.ensureReady();
    if (!path || this.state.activePath === path) return true;
    await this.flushSave();
    const workspace = await this.loadWorkspace(path);
    if (!workspace) return false;

    const workspaces = await this.refreshWorkspaces();
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, path);
    this.setState({
      ...this.state,
      workspaces,
      activePath: path,
      active: workspace,
    });
    return true;
  }

  async createWorkspace(name?: string): Promise<MediaWorkspaceSummary> {
    await this.ensureReady();
    await this.flushSave();

    const currentWorkspaces = await this.refreshWorkspaces();
    const existingNames = currentWorkspaces.map((workspace) => workspace.name);
    const nextName = name?.trim() ? name.trim() : nextWorkspaceName(existingNames);
    const path = joinPath(this.workspaceDir, workspaceFileName(nextName));
    const workspace: MediaWorkspace = {
      version: 2,
      name: nextName,
      items: [],
      thumbnails: {},
    };
    await this.writeWorkspace(path, workspace);

    const workspaces = await this.refreshWorkspaces();
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, path);
    this.setState({
      ready: true,
      loading: false,
      workspaces,
      activePath: path,
      active: workspace,
    });
    return { path, name: nextName };
  }

  async setActiveWorkspace(workspace: MediaWorkspace): Promise<void> {
    await this.ensureReady();
    const activePath = this.state.activePath;
    if (!activePath) return;
    const next = this.normalizeWorkspace(workspace);
    this.setState({
      ...this.state,
      active: next,
    });
    this.scheduleSave();
  }

  async updateActiveWorkspace(mutator: (workspace: MediaWorkspace) => MediaWorkspace): Promise<void> {
    await this.ensureReady();
    const current = this.state.active;
    const activePath = this.state.activePath;
    if (!current || !activePath) return;
    const next = this.normalizeWorkspace(mutator(cloneWorkspace(current)));
    this.setState({
      ...this.state,
      active: next,
    });
    this.scheduleSave();
  }

  async addToActiveProject(path: string, isDir: boolean): Promise<void> {
    if (!path) return;
    if (isDir) {
      const files = await ListRecursiveFiles(path);
      await this.addFilesToActiveProject((files || []).filter((entry) => !entry.isDir).map((entry) => entry.name));
      return;
    }
    await this.updateActiveWorkspace((workspace) => {
      if (workspace.items.some((item) => item.path === path)) return workspace;
      workspace.items = [...workspace.items, { path, isDir: false }];
      return workspace;
    });
  }

  async addFilesToActiveProject(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    await this.updateActiveWorkspace((workspace) => {
      const existing = new Set(workspace.items.map((item) => item.path));
      const next = [...workspace.items];
      for (const path of paths) {
        if (!path || existing.has(path)) continue;
        existing.add(path);
        next.push({ path, isDir: false });
      }
      workspace.items = next;
      return workspace;
    });
    window.dispatchEvent(new CustomEvent(MEDIA_BATCH_EVENT, {
      detail: { total: paths.length },
    }));
  }

  async setItems(items: MediaItem[]): Promise<void> {
    await this.updateActiveWorkspace((workspace) => {
      workspace.items = cloneItems(items);
      return workspace;
    });
  }

  async setThumbnail(path: string, base64Jpeg: string): Promise<void> {
    if (!path || !base64Jpeg) return;
    await this.updateActiveWorkspace((workspace) => {
      workspace.thumbnails[path] = base64Jpeg;
      return workspace;
    });
  }

  async clearActiveItems(): Promise<void> {
    await this.updateActiveWorkspace((workspace) => {
      workspace.items = [];
      return workspace;
    });
  }

  async overwriteWorkspace(path: string): Promise<boolean> {
    await this.ensureReady();
    const current = this.state.active;
    if (!current || !path) return false;
    return this.writeWorkspace(path, current);
  }

  async renameWorkspace(path: string, nextName: string): Promise<boolean> {
    await this.ensureReady();
    const name = nextName.trim();
    if (!path || !name) return false;
    const nextPath = joinPath(this.workspaceDir, workspaceFileName(name));
    if (nextPath === path) {
      const current = this.state.active;
      if (!current) return false;
      const next = this.normalizeWorkspace({ ...current, name });
      this.setState({ ...this.state, active: next });
      this.scheduleSave();
      return true;
    }
    const ok = await Rename(path, nextPath);
    if (!ok) return false;
    const workspaces = await this.refreshWorkspaces();
    const activePath = this.state.activePath === path ? nextPath : this.state.activePath;
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, activePath ?? nextPath);
    const active = this.state.activePath === path && this.state.active
      ? this.normalizeWorkspace({ ...this.state.active, name })
      : this.state.active;
    this.setState({
      ...this.state,
      workspaces,
      activePath,
      active,
    });
    return true;
  }

  async deleteWorkspace(path: string): Promise<boolean> {
    await this.ensureReady();
    if (!path) return false;
    const ok = await DeleteFile(path);
    if (!ok) return false;
    const workspaces = await this.refreshWorkspaces();
    if (workspaces.length === 0) {
      const created = await this.createWorkspace();
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, created.path);
      return true;
    }
    const nextActivePath = this.state.activePath === path
      ? (workspaces.find((workspace) => workspace.path !== path)?.path ?? workspaces[0]?.path ?? null)
      : this.state.activePath;
    const active = nextActivePath ? await this.loadWorkspace(nextActivePath) : null;
    if (nextActivePath) localStorage.setItem(ACTIVE_WORKSPACE_KEY, nextActivePath);
    this.setState({
      ...this.state,
      workspaces,
      activePath: nextActivePath,
      active,
    });
    return true;
  }

  private normalizeWorkspace(workspace: MediaWorkspace): MediaWorkspace {
    return {
      version: 2,
      name: workspace.name?.trim() || "View",
      items: uniqueByPath(workspace.items),
      thumbnails: pruneThumbnails({
        ...workspace,
        items: uniqueByPath(workspace.items),
      }),
    };
  }
}

export const mediaProjectsStore = new MediaProjectsStore();

export function loadItems(): MediaItem[] {
  return mediaProjectsStore.getState().active?.items ?? [];
}

export function loadWorkspace(): MediaWorkspace | null {
  const active = mediaProjectsStore.getState().active;
  return active ? cloneWorkspace(active) : null;
}

export function loadWorkspaces(): MediaWorkspaceSummary[] {
  return mediaProjectsStore.getState().workspaces.map((workspace) => ({ ...workspace }));
}

export function saveWorkspace(workspace: MediaWorkspace): void {
  void mediaProjectsStore.setActiveWorkspace(workspace);
}

export function initializeMediaProjects(): Promise<void> {
  return mediaProjectsStore.initialize();
}

export function selectMediaWorkspace(path: string): Promise<boolean> {
  return mediaProjectsStore.selectWorkspace(path);
}

export function createMediaWorkspace(name?: string): Promise<MediaWorkspaceSummary> {
  return mediaProjectsStore.createWorkspace(name);
}

export function addToActiveProject(path: string, isDir: boolean): void {
  void mediaProjectsStore.addToActiveProject(path, isDir);
}

export function addFilesToActiveProject(paths: string[]): void {
  void mediaProjectsStore.addFilesToActiveProject(paths);
}

export function setActiveWorkspaceItems(items: MediaItem[]): Promise<void> {
  return mediaProjectsStore.setItems(items);
}

export function setActiveWorkspaceThumbnail(path: string, base64Jpeg: string): Promise<void> {
  return mediaProjectsStore.setThumbnail(path, base64Jpeg);
}

export function clearActiveWorkspaceItems(): Promise<void> {
  return mediaProjectsStore.clearActiveItems();
}

export function overwriteMediaWorkspace(path: string): Promise<boolean> {
  return mediaProjectsStore.overwriteWorkspace(path);
}

export function renameMediaWorkspace(path: string, nextName: string): Promise<boolean> {
  return mediaProjectsStore.renameWorkspace(path, nextName);
}

export function deleteMediaWorkspace(path: string): Promise<boolean> {
  return mediaProjectsStore.deleteWorkspace(path);
}

export function subscribeMediaProjects(listener: Listener): () => void {
  return mediaProjectsStore.subscribe(listener);
}
