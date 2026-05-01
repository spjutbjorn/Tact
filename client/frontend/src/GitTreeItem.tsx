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
}

function RevertIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
      <path d="M8.146 4.146a.5.5 0 0 1 .708 0l2.5 2.5a.5.5 0 0 1-.708.708L9 6.207V8.5A3.5 3.5 0 1 1 5.5 5H6a.5.5 0 0 1 0 1h-.5a2.5 2.5 0 1 0 2.5 2.5V6.207L6.854 7.354a.5.5 0 1 1-.708-.708l2-2Z" />
    </svg>
  );
}

export function GitTreeItem({ node, depth, onAction, onRevert }: GitTreeItemProps) {
  const [expanded, setExpanded] = useState(false);

  if (node.isDir) {
    return (
      <li className="git-panel__tree-node">
        <div className="file-panel__entry file-panel__entry--dir" style={{ paddingLeft: `${depth * 12 + 12}px` }}>
          <div className="file-panel__entry-left" onClick={() => onAction(node.path)}>
            <button
              type="button"
              className="file-panel__expand-icon"
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((value) => !value);
              }}
            >
              <ChevronIcon expanded={expanded} />
            </button>
            <span className="git-panel__path">{node.name}/</span>
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
              <GitTreeItem key={child.path} node={child} depth={depth + 1} onAction={onAction} onRevert={onRevert} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li className="git-panel__item-wrapper">
      <div
        className="file-panel__entry file-panel__entry--file"
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        <div className="file-panel__entry-left" onClick={() => onAction(node.path)}>
          <span style={{ color: getGitStatusColor(node.statusChar || ""), fontWeight: "bold", width: "16px" }}>
            {node.statusChar}
          </span>
          <span className="git-panel__path">{node.name}</span>
        </div>
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
