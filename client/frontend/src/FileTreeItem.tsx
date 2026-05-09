import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { ListDir, type FileEntry } from "./wails";
import { isZipArchivePath, joinPath } from "./path";
import { FileIcon, FolderIcon } from "./fileIcons";
import { type FileHandlerSettings } from "./fileHandlers";
import { createPeerSignature, entryIndentStyle, fileRowClassName, formatFileSize, shouldShowFileEntry, type SharedKind } from "./filePanelHelpers";
import { AddToMediaIcon, ChevronIcon, DeleteIcon, RenameIcon } from "./FilePanelIcons";
import { addToActiveProject } from "./mediaProjects";

export interface FileTreeItemProps {
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  depth: number;
  peerNameSizeSignatures: Set<string>;
  peerChecksums: Set<string>;
  peerFileSizes: Set<number>;
  selectedPath: string | null;
  renamingPath: string | null;
  renameValue: string;
  showHidden: boolean;
  fileHandlerSettings: FileHandlerSettings;
  onSelectFile: (p: string) => void;
  onNavigate: (p: string) => void;
  onCursorChange: (p: string) => void;
  onDelete: (p: string) => void;
  refreshToken: number;
  setRenamingPath: (p: string | null) => void;
  setRenameValue: (v: string) => void;
  submitRename: () => void;
  handleRenameKeyDown: (e: ReactKeyboardEvent) => void;
  startRenamePath: (p: string) => void;
}

export default function FileTreeItem({
  path,
  name,
  isDir,
  size,
  depth,
  peerNameSizeSignatures,
  peerChecksums,
  peerFileSizes,
  selectedPath,
  renamingPath,
  renameValue,
  showHidden,
  fileHandlerSettings,
  onSelectFile,
  onNavigate,
  onCursorChange,
  onDelete,
  refreshToken,
  setRenamingPath,
  setRenameValue,
  submitRename,
  handleRenameKeyDown,
  startRenamePath,
}: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const fullPath = joinPath(path, name);
  const active = fullPath === selectedPath;
  const isRenaming = fullPath === renamingPath;
  const directSignature = createPeerSignature(name, size);
  const hasDirectMatch = !isDir && peerNameSizeSignatures.has(directSignature);
  const sharedKind: SharedKind = !fileHandlerSettings.highlightSharedFiles || isDir || active
    ? null
    : hasDirectMatch
      ? "green"
      : null;

  useEffect(() => {
    if (expanded && isDir) {
      ListDir(fullPath).then(setChildren);
    }
  }, [expanded, fullPath, isDir, refreshToken]);

  const toggleExpand = (e: ReactMouseEvent) => {
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

  const filteredChildren = children.filter((entry) => shouldShowFileEntry(entry.name, showHidden, fileHandlerSettings.hiddenNames));

  return (
    <li>
      {isRenaming ? (
        <div className="file-panel__new-input-container" style={entryIndentStyle(depth)}>
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
          className={fileRowClassName(isDir, active, sharedKind)}
          style={entryIndentStyle(depth)}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("tact/path", fullPath);
            e.dataTransfer.setData("tact/is-dir", isDir ? "true" : "false");
            e.dataTransfer.effectAllowed = "copy";
          }}
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
            className="file-panel__small-btn"
            title="Lägg till i mediapaket"
            onMouseDown={(event) => { event.stopPropagation(); }}
            onClick={(event) => {
              event.stopPropagation();
              addToActiveProject(fullPath, isDir);
            }}
          >
            <AddToMediaIcon />
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
              peerNameSizeSignatures={peerNameSizeSignatures}
              peerChecksums={peerChecksums}
              peerFileSizes={peerFileSizes}
              refreshToken={refreshToken}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
