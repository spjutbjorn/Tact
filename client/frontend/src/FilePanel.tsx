import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DirSize, FileEntry, ListDir, ListRecursiveFiles, ListVolumes, VolumeInfo, WriteTextFile, Rename, MkDir } from "./wails";
import { basename, dirname, isZipArchivePath, joinPath } from "./path";
import { FileIcon, FolderIcon } from "./fileIcons";

import { type FileHandlerSettings, DEFAULT_HIDDEN_NAMES } from "./fileHandlers";

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

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg 
      viewBox="0 0 16 16" 
      fill="currentColor" 
      width="12" height="12" 
      style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.1s' }}
    >
      <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z" />
    </svg>
  );
}

function NewFileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 4.5a.5.5 0 0 1 .5.5v3h3.5a.5.5 0 0 1 0 1H8.5v3.5a.5.5 0 0 1-1 0V8.5h-3.5a.5.5 0 0 1 0-1h3.5v-3.5A.5.5 0 0 1 8 4z" />
      <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.414A2 2 0 0 0 13.414 3L11 .586A2 2 0 0 0 9.586 0H4zm7 1.5v2a.5.5 0 0 0 .5.5h2L11 1.5z" />
    </svg>
  );
}

function RenameIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z" />
    </svg>
  );
}

function NewFolderIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3.086a1.5 1.5 0 0 1 1.06.44l.914.914A1.5 1.5 0 0 0 9.06 4.3l.44-.44A1.5 1.5 0 0 1 10.56 3.5H13A1.5 1.5 0 0 1 14.5 5v6A1.5 1.5 0 0 1 13 12.5H3A1.5 1.5 0 0 1 1.5 11V4zm7 3.5a.5.5 0 0 0-1 0V9H6a.5.5 0 0 0 0 1h1.5v1.5a.5.5 0 0 0 1 0V10H10a.5.5 0 0 0 0-1H8.5V7.5z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
      <path d="M6 1.5A1.5 1.5 0 0 0 4.5 3V3.5H1.75a.75.75 0 0 0 0 1.5h.55l.82 8.2A2 2 0 0 0 5.11 15h5.78a2 2 0 0 0 1.99-1.8l.82-8.2h.55a.75.75 0 0 0 0-1.5H11.5V3A1.5 1.5 0 0 0 10 1.5H6Zm4 2V3.5H6V3a.5.5 0 0 1 .5-.5h3A.5.5 0 0 1 10 3.5ZM5.32 6.24a.75.75 0 0 1 .84.66l.4 4.5a.75.75 0 0 1-1.5.14l-.4-4.5a.75.75 0 0 1 .66-.8Zm5.02.66a.75.75 0 0 1 1.5.14l-.4 4.5a.75.75 0 0 1-1.5-.14l.4-4.5ZM8 6.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 8 6.5Z" />
    </svg>
  );
}

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const formatWithDigits = (digits: 0 | 1 | 2) => {
    const formatted = digits === 0 ? `${Math.round(value)}` : value.toFixed(digits);
    const digitCount = formatted.replace(/\D/g, "").length;
    return digitCount <= 3 ? formatted : null;
  };

  const formatted = formatWithDigits(2) ?? formatWithDigits(1) ?? formatWithDigits(0);
  if (formatted) return `${formatted} ${units[unit]}`;
  if (unit < units.length - 1) {
    return formatFileSize(value * 1024);
  }
  return `${Math.round(value)} ${units[unit]}`;
}

function currentVolume(path: string, volumes: VolumeInfo[]): VolumeInfo {
  const match = volumes
    .filter((v) => v.path !== "/")
    .sort((a, b) => b.path.length - a.path.length)
    .find((v) => path === v.path || path.startsWith(v.path + "/"));
  return match ?? volumes.find((v) => v.path === "/") ?? { path: "/", name: "local" };
}

function VolumePicker({
  path,
  volumes,
  onNavigate,
  onOpen,
}: {
  path: string;
  volumes: VolumeInfo[];
  onNavigate: (p: string) => void;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const active = currentVolume(path, volumes);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      const target = e.target as Node;
      if (!btnRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function toggle() {
    if (!open) {
      onOpen();
      if (btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        setDropdownPos({ top: r.bottom + 4, left: r.left });
      }
    }
    setOpen((value) => !value);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        data-volume-picker="true"
        className={`breadcrumb__link disk-selector__trigger${open ? " breadcrumb__link--open" : ""}`}
        onClick={toggle}
      >
        {active.name}
        <svg className="disk-selector__caret" viewBox="0 0 10 6" fill="currentColor">
          <path d="M0 0l5 6 5-6z" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="disk-selector__dropdown"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
          >
            {volumes.map((v) => (
              <button
                key={v.path}
                type="button"
                className={`disk-selector__option${v.path === active.path ? " disk-selector__option--active" : ""}`}
                onClick={() => {
                  onNavigate(v.path);
                  setOpen(false);
                }}
              >
                {v.name}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

const MIN_WIDTH = 120;
const MAX_WIDTH = 600;

interface TreeItemProps {
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  depth: number;
  peerSignatures: Set<string>;
  selectedPath: string | null;
  renamingPath: string | null;
  renameValue: string;
  showHidden: boolean;
  fileHandlerSettings: FileHandlerSettings;
  onSelectFile: (p: string) => void;
  onNavigate: (p: string) => void;
  onCursorChange: (p: string) => void;
  onDelete: (p: string) => void;
  setRenamingPath: (p: string | null) => void;
  setRenameValue: (v: string) => void;
  submitRename: () => void;
  handleRenameKeyDown: (e: React.KeyboardEvent) => void;
  startRenamePath: (p: string) => void;
}

function FileTreeItem({ 
  path, name, isDir, size, depth, peerSignatures, selectedPath, renamingPath, renameValue,
  showHidden, fileHandlerSettings,
  onSelectFile, onNavigate, onCursorChange, onDelete, setRenamingPath, setRenameValue, submitRename, handleRenameKeyDown, startRenamePath
}: TreeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const fullPath = joinPath(path, name);
  const active = fullPath === selectedPath;
  const isRenaming = fullPath === renamingPath;
  const shared = fileHandlerSettings.highlightSharedFiles && !isDir && !active && peerSignatures.has(`${name}::${size}`);

  useEffect(() => {
    if (expanded && isDir) {
      ListDir(fullPath).then(setChildren);
    }
  }, [expanded, fullPath, isDir]);

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleClick = () => {
    onCursorChange(fullPath);
    if (isDir) {
      onNavigate(fullPath);
    } else if (isZipArchivePath(fullPath)) {
      onNavigate(`${fullPath}::`);
    } else {
      onSelectFile(fullPath);
    }
  };

  const filteredChildren = children.filter(e => {
    if (showHidden) return true;
    if (e.name.startsWith(".")) return false;
    if (fileHandlerSettings.hiddenNames.includes(e.name)) return false;
    return true;
  });

  return (
    <li>
      {isRenaming ? (
        <div className="file-panel__new-input-container" style={{ paddingLeft: `${depth * 12 + 12}px` }}>
          {isDir ? <FolderIcon /> : <FileIcon />}
          <input
            autoFocus
            className="file-panel__new-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={submitRename}
          />
        </div>
      ) : (
        <div
          data-file-row="true"
          data-path={fullPath}
          data-is-dir={isDir ? "true" : "false"}
          className={`file-panel__entry ${isDir ? "file-panel__entry--dir" : "file-panel__entry--file"}${active ? " file-panel__entry--active" : ""}${shared ? " file-panel__entry--shared" : ""}`}
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
        >
          <button
            type="button"
            className="file-panel__entry-main"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              handleClick();
            }}
          >
            {isDir && (
              <span
                className="file-panel__expand-icon"
                onMouseDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={toggleExpand}
              >
                <ChevronIcon expanded={expanded} />
              </span>
            )}
            {isDir ? <FolderIcon /> : <FileIcon />}
            <span>{name}</span>
          </button>
          <span className="file-panel__size">{isDir ? "" : formatFileSize(size)}</span>
          <button
            type="button"
            className="file-panel__small-btn rename"
            title={isDir ? "Rename folder" : "Rename file"}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              startRenamePath(fullPath);
            }}
          >
            <RenameIcon />
          </button>
          <button
            type="button"
            className="file-panel__small-btn delete"
            title={isDir ? "Delete folder" : "Delete file"}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(fullPath);
            }}
          >
            <DeleteIcon />
          </button>
        </div>
      )}
      {expanded && isDir && (
        <ul className="file-panel__list">
          {filteredChildren.map((child) => (
            <FileTreeItem
              key={child.name}
              path={fullPath}
              name={child.name}
              isDir={child.isDir}
              size={child.size}
              depth={depth + 1}
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
      )}
    </li>
  );
}

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

  const refresh = () => {
    if (path) ListDir(path).then(res => setEntries(res || []));
  };

  useEffect(() => {
    refresh();
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
      setPeerSignatures(new Set((res || []).map((entry) => `${basename(entry.name)}::${entry.size}`)));
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
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || target?.isContentEditable) {
        return;
      }

      const key = e.key.toLowerCase();
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
        if (key === "enter" || key === "q") {
          e.preventDefault();
          openSelectedPath();
          return;
        }
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [side, dualMode, onCopySelection, onMoveSelection, onCursorChange, selectedPath, onNavigate, onSelectFile]);

  const filteredEntries = entries.filter(e => {
    if (showHidden) return true;
    if (e.name.startsWith(".")) return false;
    if (fileHandlerSettings.hiddenNames.includes(e.name)) return false;
    return true;
  });
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
      refresh();
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
      refresh();
      onSelectFile(newPath);
      onCursorChange(newPath);
    }
    setRenamingPath(null);
  }

  function handleNewFileKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") submitNewItem();
    else if (e.key === "Escape") {
      setCreatingKind(null);
      setNewName("");
    }
  }

  function handleRenameKeyDown(e: React.KeyboardEvent) {
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

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    function onMove(e: MouseEvent) {
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!active) {
      return;
    }
    const target = e.target as HTMLElement | null;
    const tagName = target?.tagName?.toLowerCase();
    if (tagName === "input" || tagName === "textarea" || target?.isContentEditable) {
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
      style={{ width }}
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
        </div>
      </div>
      <div className="file-panel__volume-row">
        <span className="file-panel__volume-label">Drive</span>
        <VolumePicker
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
