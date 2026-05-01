import React, { useEffect, useState } from "react";
import { FileEntry, ListDir, WriteTextFile, Rename } from "./wails";
import { basename, dirname, isZipArchivePath, joinPath } from "./path";

interface Props {
  path: string;
  selectedFile: string | null;
  width: number;
  onWidthChange: (w: number) => void;
  onNavigate: (path: string) => void;
  onSelectFile: (path: string) => void;
  onDelete: (path: string) => void;
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

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="entry-icon">
      <path d="M1.5 3A1.5 1.5 0 0 0 0 4.5v8A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H7.621a1.5 1.5 0 0 1-1.06-.44L5.439 2.94A1.5 1.5 0 0 0 4.38 2.5H1.5Z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="entry-icon">
      <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.414A2 2 0 0 0 13.414 3L11 .586A2 2 0 0 0 9.586 0H4Zm7 1.5v2a.5.5 0 0 0 .5.5h2L11 1.5Z" />
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

function DeleteIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
      <path d="M6 1.5A1.5 1.5 0 0 0 4.5 3V3.5H1.75a.75.75 0 0 0 0 1.5h.55l.82 8.2A2 2 0 0 0 5.11 15h5.78a2 2 0 0 0 1.99-1.8l.82-8.2h.55a.75.75 0 0 0 0-1.5H11.5V3A1.5 1.5 0 0 0 10 1.5H6Zm4 2V3.5H6V3a.5.5 0 0 1 .5-.5h3A.5.5 0 0 1 10 3.5ZM5.32 6.24a.75.75 0 0 1 .84.66l.4 4.5a.75.75 0 0 1-1.5.14l-.4-4.5a.75.75 0 0 1 .66-.8Zm5.02.66a.75.75 0 0 1 1.5.14l-.4 4.5a.75.75 0 0 1-1.5-.14l.4-4.5ZM8 6.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 8 6.5Z" />
    </svg>
  );
}

const MIN_WIDTH = 120;
const MAX_WIDTH = 600;

interface TreeItemProps {
  path: string;
  name: string;
  isDir: boolean;
  depth: number;
  selectedFile: string | null;
  renamingPath: string | null;
  renameValue: string;
  onSelectFile: (p: string) => void;
  onNavigate: (p: string) => void;
  onDelete: (p: string) => void;
  setRenamingPath: (p: string | null) => void;
  setRenameValue: (v: string) => void;
  submitRename: () => void;
  handleRenameKeyDown: (e: React.KeyboardEvent) => void;
}

function FileTreeItem({ 
  path, name, isDir, depth, selectedFile, renamingPath, renameValue,
  onSelectFile, onNavigate, onDelete, setRenamingPath, setRenameValue, submitRename, handleRenameKeyDown
}: TreeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const fullPath = joinPath(path, name);
  const active = fullPath === selectedFile;
  const isRenaming = fullPath === renamingPath;

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
    if (isDir) {
      onNavigate(fullPath);
    } else if (isZipArchivePath(fullPath)) {
      onNavigate(`${fullPath}::`);
    } else {
      onSelectFile(fullPath);
    }
  };

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
          className={`file-panel__entry ${isDir ? "file-panel__entry--dir" : "file-panel__entry--file"}${active ? " file-panel__entry--active" : ""}`}
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
        >
          <button type="button" className="file-panel__entry-main" onClick={handleClick}>
            {isDir && (
              <span className="file-panel__expand-icon" onClick={toggleExpand}>
                <ChevronIcon expanded={expanded} />
              </span>
            )}
            {isDir ? <FolderIcon /> : <FileIcon />}
            <span>{name}</span>
          </button>
          <button
            type="button"
            className="file-panel__small-btn delete"
            title={isDir ? "Delete folder" : "Delete file"}
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
          {children.map((child) => (
            <FileTreeItem
              key={child.name}
              path={fullPath}
              name={child.name}
              isDir={child.isDir}
              depth={depth + 1}
              selectedFile={selectedFile}
              renamingPath={renamingPath}
              renameValue={renameValue}
              onSelectFile={onSelectFile}
              onNavigate={onNavigate}
              onDelete={onDelete}
              setRenamingPath={setRenamingPath}
              setRenameValue={setRenameValue}
              submitRename={submitRename}
              handleRenameKeyDown={handleRenameKeyDown}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function FilePanel({
  path,
  selectedFile,
  width,
  onWidthChange,
  onNavigate,
  onSelectFile,
  onDelete,
  refreshToken,
}: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  const refresh = () => {
    if (path) ListDir(path).then(res => setEntries(res || []));
  };

  useEffect(() => {
    refresh();
  }, [path, refreshToken]);

  const filteredEntries = entries.filter(e => showHidden || !e.name.startsWith("."));

  async function submitNewFile() {
    if (!newFileName.trim()) {
      setIsCreatingFile(false);
      return;
    }
    const fullPath = joinPath(path, newFileName.trim());
    const ok = await WriteTextFile(fullPath, "");
    if (ok) {
      refresh();
      onSelectFile(fullPath);
    }
    setNewFileName("");
    setIsCreatingFile(false);
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
    }
    setRenamingPath(null);
  }

  function handleNewFileKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") submitNewFile();
    else if (e.key === "Escape") {
      setIsCreatingFile(false);
      setNewFileName("");
    }
  }

  function handleRenameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") submitRename();
    else if (e.key === "Escape") setRenamingPath(null);
  }

  function startRename() {
    if (!selectedFile) return;
    const name = basename(selectedFile);
    setRenamingPath(selectedFile);
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

  return (
    <aside className="file-panel" style={{ width }}>
      <div className="file-panel__resize-handle" onMouseDown={startResize} />
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
          <button className="file-panel__new-btn" onClick={startRename} title="Rename Selected" disabled={!selectedFile}>
            <RenameIcon />
          </button>
          <button className="file-panel__new-btn" onClick={() => setIsCreatingFile(true)} title="New File">
            <NewFileIcon />
          </button>
        </div>
      </div>
      <ul className="file-panel__list">
        {isCreatingFile && (
          <li className="file-panel__new-input-container">
            <FileIcon />
            <input
              autoFocus
              className="file-panel__new-input"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={handleNewFileKeyDown}
              onBlur={submitNewFile}
              placeholder="filename..."
            />
          </li>
        )}
        {path && path !== "/" && (
          <li>
            <button
              className="file-panel__entry file-panel__entry--dir"
              onClick={() => {
                onNavigate(dirname(path));
              }}
            >
              <div className="file-panel__entry-left">
                <FolderIcon />
                <span>..</span>
              </div>
            </button>
          </li>
        )}
        {filteredEntries.map((e) => (
          <FileTreeItem
            key={e.name}
            path={path}
            name={e.name}
            isDir={e.isDir}
            depth={0}
            selectedFile={selectedFile}
            renamingPath={renamingPath}
            renameValue={renameValue}
            onSelectFile={onSelectFile}
            onNavigate={onNavigate}
            onDelete={onDelete}
            setRenamingPath={setRenamingPath}
            setRenameValue={setRenameValue}
            submitRename={submitRename}
            handleRenameKeyDown={handleRenameKeyDown}
          />
        ))}
      </ul>
    </aside>
  );
}
