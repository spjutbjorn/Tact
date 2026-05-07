import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { DirSize, type FileEntry, ListDir, ListRecursiveFiles, ListVolumes, type VolumeInfo, WriteTextFile, Rename, MkDir } from "./wails";
import { basename, dirname, isZipArchivePath, joinPath } from "./path";
import { type FileHandlerSettings } from "./fileHandlers";
import { createPeerSignature, formatFileSize, isEditableTarget, shouldShowFileEntry } from "./filePanelHelpers";
import FilePanelVolumePicker from "./FilePanelVolumePicker";
import FileTreeItem from "./FileTreeItem";
import { FileIcon, FolderIcon } from "./fileIcons";
import { AddToMediaIcon, NewFileIcon, NewFolderIcon, RenameIcon } from "./FilePanelIcons";
import { addFilesToActiveProject } from "./mediaProjects";

type FileSide = "left" | "right";

interface Props {
  side: FileSide;
  path: string;
  peerPath?: string | null;
  selectedPath: string | null;
  active: boolean;
  dualMode: boolean;
  isMirror: boolean;
  width: number;
  fileHandlerSettings: FileHandlerSettings;
  onWidthChange: (w: number) => void;
  onNavigate: (path: string) => void;
  onSelectFile: (path: string) => void;
  onCursorChange: (path: string) => void;
  onDelete: (path: string) => void;
  onCopySelection: () => void;
  onMoveSelection: () => void;
  onActivate: () => void;
  refreshToken: number;
}

const MIN_WIDTH = 120;
const MAX_WIDTH = 600;

export default function FilePanel({
  side,
  path,
  peerPath,
  selectedPath,
  active,
  dualMode,
  isMirror,
  width,
  fileHandlerSettings,
  onWidthChange,
  onNavigate,
  onSelectFile,
  onCursorChange,
  onDelete,
  onCopySelection,
  onMoveSelection,
  onActivate,
  refreshToken,
}: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [creatingKind, setCreatingKind] = useState<"file" | "folder" | null>(null);
  const [newName, setNewName] = useState("");
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [folderSize, setFolderSize] = useState(0);
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [peerSignatures, setPeerSignatures] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rootRef.current?.style.setProperty("--file-panel-width", `${width}px`);
  }, [width]);

  async function reloadEntries() {
    if (!path) {
      setEntries([]);
      return [];
    }
    const result = await ListDir(path);
    const nextEntries = result || [];
    setEntries(nextEntries);
    return nextEntries;
  }

  useEffect(() => {
    void reloadEntries();
  }, [path, refreshToken]);

  useEffect(() => {
    ListVolumes().then(setVolumes);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!dualMode || !peerPath) {
      setPeerSignatures(new Set());
      return;
    }
    ListRecursiveFiles(peerPath).then((res) => {
      if (cancelled) return;
      setPeerSignatures(new Set((res || []).map((entry) => createPeerSignature(basename(entry.name), entry.size))));
    });
    return () => {
      cancelled = true;
    };
  }, [dualMode, peerPath, refreshToken]);

  useEffect(() => {
    if (!path) {
      setFolderSize(0);
      return;
    }
    DirSize(path).then((size) => setFolderSize(size || 0));
  }, [path, refreshToken]);

  useEffect(() => {
    if (active) {
      rootRef.current?.focus();
    }
  }, [active, path, selectedPath, dualMode]);

  useEffect(() => {
    if (!selectedPath) return;
    const row = rootRef.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(selectedPath)}"]`);
    row?.scrollIntoView({ block: "center" });
  }, [selectedPath, entries.length, path]);

  useEffect(() => {
    function handleWindowKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (isEditableTarget(target)) {
        return;
      }

      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && key === "s") {
        e.preventDefault();
        window.dispatchEvent(new Event("tact:save"));
        return;
      }
      if (key === "enter" || key === "q") {
        if (path === "/" && !selectedPath) {
          e.preventDefault();
          rootRef.current?.querySelector<HTMLButtonElement>('[data-volume-picker="true"]')?.click();
          focusPanel();
          return;
        }
        e.preventDefault();
        openSelectedPath();
        focusPanel();
        return;
      }
      if (side === "left") {
        if (key === "w") {
          e.preventDefault();
          moveCursor(-1);
          return;
        }
        if (key === "s") {
          e.preventDefault();
          moveCursor(1);
          return;
        }
        if (dualMode && key === "d") {
          e.preventDefault();
          onCopySelection();
          return;
        }
        if (dualMode && key === "a") {
          e.preventDefault();
          onMoveSelection();
          return;
        }
      } else {
        if (key === "arrowup") {
          e.preventDefault();
          moveCursor(-1);
          return;
        }
        if (key === "arrowdown") {
          e.preventDefault();
          moveCursor(1);
          return;
        }
        if (dualMode && key === "arrowleft") {
          e.preventDefault();
          onCopySelection();
          return;
        }
        if (dualMode && key === "arrowright") {
          e.preventDefault();
          onMoveSelection();
          return;
        }
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [side, dualMode, onCopySelection, onMoveSelection, onCursorChange, selectedPath, onNavigate, onSelectFile]);

  const filteredEntries = entries.filter((entry) =>
    shouldShowFileEntry(entry.name, showHidden, fileHandlerSettings.hiddenNames),
  );
  async function submitNewItem() {
    if (!newName.trim()) {
      setCreatingKind(null);
      return;
    }
    const fullPath = joinPath(path, newName.trim());
    const ok = creatingKind === "folder"
      ? await MkDir(fullPath)
      : await WriteTextFile(fullPath, "");
    if (ok) {
      await reloadEntries();
      onCursorChange(fullPath);
      if (creatingKind !== "folder") {
        onSelectFile(fullPath);
      }
    }
    setNewName("");
    setCreatingKind(null);
  }

  async function submitRename() {
    if (!renamingPath || !renameValue.trim()) {
      setRenamingPath(null);
      return;
    }
    const oldName = basename(renamingPath);
    if (renameValue.trim() === oldName) {
      setRenamingPath(null);
      return;
    }
    const newPath = joinPath(dirname(renamingPath), renameValue.trim());
    const ok = await Rename(renamingPath, newPath);
    if (ok) {
      await reloadEntries();
      onSelectFile(newPath);
      onCursorChange(newPath);
    }
    setRenamingPath(null);
  }

  function handleNewFileKeyDown(e: ReactKeyboardEvent) {
    if (e.key === "Enter") submitNewItem();
    else if (e.key === "Escape") {
      setCreatingKind(null);
      setNewName("");
    }
  }

  function handleRenameKeyDown(e: ReactKeyboardEvent) {
    if (e.key === "Enter") submitRename();
    else if (e.key === "Escape") setRenamingPath(null);
  }

  function startRename() {
    if (!selectedPath) return;
    const name = basename(selectedPath);
    setRenamingPath(selectedPath);
    setRenameValue(name);
  }

  function startRenamePath(pathToRename: string) {
    const name = basename(pathToRename);
    setRenamingPath(pathToRename);
    setRenameValue(name);
  }

  function startResize(e: ReactMouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    function onMove(e: globalThis.MouseEvent) {
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth - (e.clientX - startX)));
      onWidthChange(next);
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function moveCursor(delta: number) {
    const rows = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-file-row="true"]') ?? []);
    if (!rows.length) return;
    const currentIndex = rows.findIndex((row) => row.dataset.path === selectedPath);
    const nextIndex = currentIndex === -1 ? 0 : Math.max(0, Math.min(rows.length - 1, currentIndex + delta));
    const nextPath = rows[nextIndex]?.dataset.path;
    if (nextPath) {
      onCursorChange(nextPath);
    }
  }

  function getSelectedRow() {
    if (!selectedPath) return null;
    return rootRef.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(selectedPath)}"]`);
  }

  function openSelectedPath() {
    const row = getSelectedRow();
    if (!row || !selectedPath) return false;
    if (row.dataset.isDir === "true") {
      onNavigate(selectedPath);
    } else if (isZipArchivePath(selectedPath)) {
      onNavigate(`${selectedPath}::`);
    } else {
      onSelectFile(selectedPath);
    }
    return true;
  }

  function focusPanel() {
    onActivate();
    rootRef.current?.focus();
  }

  function handleKeyDown(e: ReactKeyboardEvent) {
    if (!active) {
      return;
    }
    const target = e.target as HTMLElement | null;
    if (isEditableTarget(target)) {
      return;
    }
    const key = e.key.toLowerCase();
    if (key === "e") {
      e.preventDefault();
      if (path && path !== "/") {
        onNavigate(dirname(path));
      } else if (!selectedPath) {
        rootRef.current?.querySelector<HTMLButtonElement>('[data-volume-picker="true"]')?.click();
      }
      focusPanel();
      return;
    }

    if (key === "enter" || key === "q") {
      if (path === "/" && !selectedPath) {
        e.preventDefault();
        rootRef.current?.querySelector<HTMLButtonElement>('[data-volume-picker="true"]')?.click();
        focusPanel();
        return;
      }
      e.preventDefault();
      openSelectedPath();
      focusPanel();
      return;
    }
  }

  function handleRowClick(nextPath: string, nextIsDir: boolean) {
    onCursorChange(nextPath);
    if (!nextIsDir) {
      onSelectFile(nextPath);
    }
  }

  return (
    <aside
      ref={rootRef}
      className={`file-panel file-panel--${side}${active ? " file-panel--active" : ""}${isMirror ? " file-panel--mirror" : ""}`}
      onKeyDown={handleKeyDown}
      onFocus={onActivate}
      onMouseDownCapture={focusPanel}
      tabIndex={0}
    >
      <div className={`file-panel__resize-handle file-panel__resize-handle--${side}`} onMouseDown={startResize} />
      <div className="file-panel__header">
        <span>Files</span>
        <div className="file-panel__header-actions">
          <button 
            className={`file-panel__new-btn ${showHidden ? "active" : ""}`} 
            onClick={() => setShowHidden(!showHidden)} 
            title={showHidden ? "Hide Hidden Files" : "Show Hidden Files"}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
              <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
              <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
            </svg>
          </button>
          <button className="file-panel__new-btn" onClick={startRename} title="Rename Selected" disabled={!selectedPath}>
            <RenameIcon />
          </button>
          <button className="file-panel__new-btn" onClick={() => { setCreatingKind("folder"); setNewName(""); }} title="New Folder">
            <NewFolderIcon />
          </button>
          <button className="file-panel__new-btn" onClick={() => { setCreatingKind("file"); setNewName(""); }} title="New File">
            <NewFileIcon />
          </button>
          <button className="file-panel__new-btn" onClick={() => { ListRecursiveFiles(path).then((entries) => addFilesToActiveProject(entries.filter((e) => !e.isDir).map((e) => e.name))); }} title="Lägg till alla filer rekursivt i mediapaket">
            <AddToMediaIcon />
          </button>
        </div>
      </div>
      <div className="file-panel__volume-row">
        <span className="file-panel__volume-label">Drive</span>
        <FilePanelVolumePicker
          path={path}
          volumes={volumes}
          onNavigate={onNavigate}
          onOpen={() => ListVolumes().then(setVolumes)}
        />
      </div>
      <ul className="file-panel__list">
        {creatingKind && (
          <li className="file-panel__new-input-container">
            {creatingKind === "folder" ? <FolderIcon /> : <FileIcon />}
            <input
              autoFocus
              className="file-panel__new-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleNewFileKeyDown}
              onBlur={submitNewItem}
              placeholder={creatingKind === "folder" ? "folder name..." : "filename..."}
            />
          </li>
        )}
        {path && path !== "/" && (
          <li>
          <button
            data-file-row="true"
            data-path={dirname(path)}
            data-is-dir="true"
            className={`file-panel__entry file-panel__entry--dir${selectedPath === dirname(path) ? " file-panel__entry--active" : ""}`}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              handleRowClick(dirname(path), true);
              onNavigate(dirname(path));
            }}
          >
            <div className="file-panel__entry-left">
              <FolderIcon />
              <span>..</span>
            </div>
            <span className="file-panel__size">{formatFileSize(folderSize)}</span>
          </button>
          </li>
        )}
        {filteredEntries.map((e) => (
          <FileTreeItem
            key={e.name}
            path={path}
            name={e.name}
            isDir={e.isDir}
            size={e.size}
            depth={0}
            selectedPath={selectedPath}
            renamingPath={renamingPath}
            renameValue={renameValue}
            showHidden={showHidden}
            fileHandlerSettings={fileHandlerSettings}
            onSelectFile={onSelectFile}
            onNavigate={onNavigate}
            onCursorChange={onCursorChange}
            onDelete={onDelete}
            setRenamingPath={setRenamingPath}
            setRenameValue={setRenameValue}
            submitRename={submitRename}
            handleRenameKeyDown={handleRenameKeyDown}
            startRenamePath={startRenamePath}
            peerSignatures={peerSignatures}
          />
        ))}
      </ul>
    </aside>
  );
}
