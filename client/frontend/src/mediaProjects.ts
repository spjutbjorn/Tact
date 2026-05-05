export interface MediaItem {
  path: string;
  isDir: boolean;
}

export interface MediaSnapshot {
  id: string;
  name: string;
  items: MediaItem[];
}

const ITEMS_KEY = "tact.mediaItems";
const SNAPSHOTS_KEY = "tact.mediaSnapshots";
export const MEDIA_CHANGED_EVENT = "tact:media-project-changed";

export function loadItems(): MediaItem[] {
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    if (raw) return JSON.parse(raw) as MediaItem[];
  } catch {}
  return [];
}

export function saveItems(items: MediaItem[]): void {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(MEDIA_CHANGED_EVENT));
}

export function loadSnapshots(): MediaSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    if (raw) return JSON.parse(raw) as MediaSnapshot[];
  } catch {}
  return [];
}

export function saveSnapshots(snapshots: MediaSnapshot[]): void {
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
}

export function addToActiveProject(path: string, isDir: boolean): void {
  if (isDir) return;
  const items = loadItems();
  if (items.some((i) => i.path === path)) return;
  saveItems([...items, { path, isDir }]);
}

export const MEDIA_BATCH_EVENT = "tact:media-batch";

export function addFilesToActiveProject(paths: string[]): void {
  const items = loadItems();
  const existing = new Set(items.map((i) => i.path));
  const toAdd = paths.filter((p) => !existing.has(p)).map((p) => ({ path: p, isDir: false }));
  if (toAdd.length > 0) saveItems([...items, ...toAdd]);
  window.dispatchEvent(new CustomEvent(MEDIA_BATCH_EVENT, {
    detail: { total: paths.length },
  }));
}
