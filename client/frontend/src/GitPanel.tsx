import { type MouseEvent as ReactMouseEvent, useEffect, useState } from "react";
import { GitAdd, GitCommit, GitFileStatus, GitLastCommitMessage, GitPush, GitRevert, GitStatus, GitUnstage } from "./wails";
import { buildGitTree, splitGitStatuses } from "./git-panel-utils";
import { GitTreeItem } from "./GitTreeItem";

interface Props {
  width: number;
  onWidthChange: (w: number) => void;
}

const MIN_WIDTH = 120;
const MAX_WIDTH = 600;

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
      <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
      <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
    </svg>
  );
}

function PushIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
      <path d="M8 15a.5.5 0 0 1-.5-.5V7.707L6.354 8.854a.5.5 0 1 1-.708-.708l2-2a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L8.5 7.707V14.5A.5.5 0 0 1 8 15Z" />
      <path d="M3.5 10a.5.5 0 0 1 .5.5v2A1.5 1.5 0 0 0 5.5 14h5A1.5 1.5 0 0 0 12 12.5v-2a.5.5 0 0 1 1 0v2A2.5 2.5 0 0 1 10.5 15h-5A2.5 2.5 0 0 1 3 12.5v-2a.5.5 0 0 1 .5-.5Z" />
    </svg>
  );
}

function startColumnResize(
  width: number,
  onWidthChange: (value: number) => void,
  event: ReactMouseEvent
) {
  event.preventDefault();
  const startX = event.clientX;
  const startWidth = width;
  document.body.style.userSelect = "none";
  document.body.style.cursor = "col-resize";

  function onMove(moveEvent: MouseEvent) {
    const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth - (moveEvent.clientX - startX)));
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

export default function GitPanel({ width, onWidthChange }: Props) {
  const [statuses, setStatuses] = useState<GitFileStatus[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isAmend, setIsAmend] = useState(false);

  const refresh = () => {
    GitStatus().then((res) => setStatuses(res || []));
  };

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isAmend) return;
    GitLastCommitMessage().then((message) => {
      setCommitMessage(message);
    });
  }, [isAmend]);

  const { stagedFiles, unstagedFiles } = splitGitStatuses(statuses);
  const stagedTree = buildGitTree(stagedFiles);
  const unstagedTree = buildGitTree(unstagedFiles);

  async function handleStage(path: string) {
    const ok = await GitAdd(path);
    if (ok) {
      setStatusMessage(null);
      refresh();
      return;
    }
    setStatusMessage(`Kunde inte stage: ${path}`);
  }

  async function handleUnstage(path: string) {
    const ok = await GitUnstage(path);
    if (ok) {
      setStatusMessage(null);
      refresh();
      return;
    }
    setStatusMessage(`Kunde inte unstage: ${path}`);
  }

  async function handleCommit() {
    if (!isAmend && (!commitMessage.trim() || stagedFiles.length === 0)) return;
    if (isCommitting) return;
    setIsCommitting(true);
    const ok = await GitCommit(commitMessage, isAmend);
    if (ok) {
      setCommitMessage("");
      setStatusMessage(null);
      refresh();
      setIsCommitting(false);
      return;
    }
    setStatusMessage("Commit misslyckades");
    setIsCommitting(false);
  }

  async function handleRevert(path: string) {
    const ok = await GitRevert(path);
    if (ok) {
      setStatusMessage(null);
      refresh();
      return;
    }
    setStatusMessage(`Kunde inte revert: ${path}`);
  }

  async function handlePush() {
    const ok = await GitPush();
    if (ok) {
      setStatusMessage(null);
      refresh();
      return;
    }
    setStatusMessage("Push misslyckades");
  }

  return (
    <aside className="git-panel" style={{ width }}>
      <div className="file-panel__resize-handle" onMouseDown={(event) => startColumnResize(width, onWidthChange, event)} />
      <div className="file-panel__header">
        <span>Git</span>
        <div className="file-panel__header-actions">
          <button className="file-panel__new-btn" onClick={handlePush} title="Push">
            <PushIcon />
          </button>
          <button className="file-panel__new-btn" onClick={refresh} title="Refresh">
            <RefreshIcon />
          </button>
        </div>
      </div>

      <div className="git-panel__content">
        <section className="git-panel__section">
          <div className="git-panel__section-title">Staged ({stagedFiles.length})</div>
          <ul className="file-panel__list">
            {stagedTree.length === 0 ? (
              <li className="git-panel__empty">Nothing staged</li>
            ) : (
              stagedTree.map((node) => (
                <GitTreeItem key={`staged-${node.path}`} node={node} depth={0} onAction={handleUnstage} onRevert={handleRevert} />
              ))
            )}
          </ul>
        </section>

        <section className="git-panel__section">
          <div className="git-panel__section-title">Unstaged ({unstagedFiles.length})</div>
          <ul className="file-panel__list">
            {unstagedTree.length === 0 ? (
              <li className="git-panel__empty">No changes</li>
            ) : (
              unstagedTree.map((node) => (
                <GitTreeItem key={`unstaged-${node.path}`} node={node} depth={0} onAction={handleStage} onRevert={handleRevert} />
              ))
            )}
          </ul>
        </section>

        {statusMessage && <div className="git-panel__status">{statusMessage}</div>}

        <div className="git-panel__commit-box">
          <textarea
            placeholder="Commit message..."
            value={commitMessage}
            onChange={(event) => setCommitMessage(event.target.value)}
            className="git-panel__input"
          />
          <label className="git-panel__checkbox">
            <input
              type="checkbox"
              checked={isAmend}
              onChange={(event) => setIsAmend(event.target.checked)}
            />
            Amend last commit
          </label>
          <button
            onClick={handleCommit}
            disabled={isCommitting || (!isAmend && (!commitMessage.trim() || stagedFiles.length === 0))}
            className="git-panel__commit-btn"
          >
            {isCommitting ? "Committing..." : isAmend ? "Amend commit" : `Commit ${stagedFiles.length} files`}
          </button>
        </div>
      </div>
    </aside>
  );
}
