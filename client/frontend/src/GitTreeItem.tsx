import { useState } from "react";
import type { GitNode } from "./git-panel-utils";
import { getGitStatusColor } from "./git-panel-utils";

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      width="10"
      height="10"
      style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.1s" }}
    >
      <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z" />
    </svg>
  );
}

export interface GitTreeItemProps {
  node: GitNode;
  depth: number;
  onAction: (path: string) => void;
  onRevert: (path: string) => void;
  onSelect?: (path: string) => void;
  selectedFile?: string | null;
}

function RevertIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
      <path d="M8.146 4.146a.5.5 0 0 1 .708 0l2.5 2.5a.5.5 0 0 1-.708.708L9 6.207V8.5A3.5 3.5 0 1 1 5.5 5H6a.5.5 0 0 1 0 1h-.5a2.5 2.5 0 1 0 2.5 2.5V6.207L6.854 7.354a.5.5 0 1 1-.708-.708l2-2Z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13">
      <path d="M1.75 3A1.75 1.75 0 0 1 3.5 1.25h3.06c.47 0 .92.19 1.25.52l.93.93c.09.09.21.14.33.14h4.69A1.75 1.75 0 0 1 15.5 4.6v6.65A1.75 1.75 0 0 1 13.75 13H3.5A1.75 1.75 0 0 1 1.75 11.25V3Z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13">
      <path d="M4.5 1.75A1.75 1.75 0 0 1 6.25 0H9.5l4 4v9.25A1.75 1.75 0 0 1 11.75 15H6.25A1.75 1.75 0 0 1 4.5 13.25v-11.5Z" />
    </svg>
  );
}

export function GitTreeItem({ node, depth, onAction, onRevert, onSelect, selectedFile }: GitTreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 1);

  if (node.isDir) {
    return (
      <li className="git-panel__tree-node">
        <div className="file-panel__entry file-panel__entry--dir git-panel__tree-row" style={{ paddingLeft: `${depth * 14 + 12}px` }}>
          <div className="file-panel__entry-left git-panel__tree-left" onClick={() => onAction(node.path)}>
            <button
              type="button"
              className="file-panel__expand-icon git-panel__expand-icon"
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((value) => !value);
              }}
            >
              <ChevronIcon expanded={expanded} />
            </button>
            <span className="git-panel__tree-icon"><FolderIcon /></span>
            <span className="git-panel__path git-panel__path--dir">{node.name}/</span>
          </div>
          <button
            type="button"
            className="git-panel__small-btn revert"
            title="Revert folder"
            onClick={(event) => {
              event.stopPropagation();
              onRevert(node.path);
            }}
          >
            <RevertIcon />
          </button>
        </div>
        {expanded && (
          <ul className="file-panel__list git-panel__children">
            {node.children.map((child) => (
              <GitTreeItem key={child.path} node={child} depth={depth + 1} onAction={onAction} onRevert={onRevert} onSelect={onSelect} selectedFile={selectedFile} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const isSelected = selectedFile === node.path;

  return (
    <li className="git-panel__item-wrapper">
      <div
        className={`file-panel__entry file-panel__entry--file git-panel__tree-row${isSelected ? " git-panel__tree-row--selected" : ""}`}
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
      >
        <div
          className="file-panel__entry-left git-panel__tree-left"
          onClick={(event) => {
            if (onSelect) {
              event.stopPropagation();
              onSelect(node.path);
            } else {
              onAction(node.path);
            }
          }}
        >
          <span
            className={`git-panel__status-pill git-panel__status-pill--${node.statusChar || "plain"}`}
            style={{ color: getGitStatusColor(node.statusChar || "") }}
          >
            <FileIcon />
            <span>{node.statusChar}</span>
          </span>
          <span className="git-panel__path">{node.name}</span>
        </div>
        <button
          type="button"
          className="git-panel__small-btn plus"
          title="Stage/unstage"
          onClick={(event) => {
            event.stopPropagation();
            onAction(node.path);
          }}
        >
          +
        </button>
        <button
          type="button"
          className="git-panel__small-btn revert"
          title="Revert file"
          onClick={(event) => {
            event.stopPropagation();
            onRevert(node.path);
          }}
        >
          <RevertIcon />
        </button>
      </div>
    </li>
  );
}
