import { useEffect, useState } from "react";
import { GitAdd, GitBranchName, GitBranches, GitCheckoutBranch, GitCommit, GitCreateBranch, GitDiff, GitFileStatus, GitLastCommitMessage, GitLog, GitPush, GitRevert, GitStatus, GitUnstage, GitShow, ReadTextFile } from "./wails";
import { buildGitTree, splitGitStatuses } from "./git-panel-utils";
import { GitTreeItem } from "./GitTreeItem";
import { DiffEditor } from "@monaco-editor/react";
import { extname } from "./path";

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

function getMonacoLanguage(path: string): string {
  const ext = extname(path).toLowerCase().replace(/^\./, "");
  switch (ext) {
    case "js": return "javascript";
    case "ts": return "typescript";
    case "tsx": return "typescript";
    case "jsx": return "javascript";
    case "json": return "json";
    case "md": return "markdown";
    case "html": return "html";
    case "css": return "css";
    case "scss": return "scss";
    case "less": return "less";
    case "py": return "python";
    case "go": return "go";
    case "rs": return "rust";
    case "cpp": return "cpp";
    case "c": return "c";
    case "h": return "cpp";
    case "java": return "java";
    case "cs": return "csharp";
    case "rb": return "ruby";
    case "php": return "php";
    case "sql": return "sql";
    case "yaml": return "yaml";
    case "yml": return "yaml";
    case "xml": return "xml";
    case "sh": return "shell";
    case "bash": return "shell";
    case "dockerfile": return "dockerfile";
    default: return "plaintext";
  }
}

function DiffView({ file }: { file: string | null }) {
  const [original, setOriginal] = useState<string>("");
  const [modified, setModified] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file) {
      setOriginal("");
      setModified("");
      return;
    }

    setLoading(true);
    Promise.all([
      GitShow("HEAD", file).catch(() => ""),
      ReadTextFile(file)
    ]).then(([orig, mod]) => {
      setOriginal(orig);
      setModified(mod);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [file]);

  if (!file) {
    return <div className="git-panel__diff-empty">Select a file to view diff</div>;
  }

  if (loading) {
    return <div className="git-panel__diff-empty">Loading diff...</div>;
  }

  return (
    <div className="git-panel__diff-monaco">
      <DiffEditor
        original={original}
        modified={modified}
        language={getMonacoLanguage(file)}
        theme="vs-dark"
        options={{
          renderSideBySide: true,
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", monospace',
          scrollBeyondLastLine: false,
          readOnly: true,
          automaticLayout: true,
        }}
      />
    </div>
  );
}

interface Props {
  initialFile?: string | null;
  gitRoot?: string;
  onSelectFile?: (file: string | null) => void;
}

export default function GitPanel({ initialFile, gitRoot, onSelectFile }: Props) {
  const [statuses, setStatuses] = useState<GitFileStatus[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isAmend, setIsAmend] = useState(false);
  const [gitLog, setGitLog] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [newBranchName, setNewBranchName] = useState("");
  const [selectedBranchName, setSelectedBranchName] = useState("");
  const [isBranching, setIsBranching] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(() => {
    if (initialFile && gitRoot && initialFile.startsWith(gitRoot)) {
      return initialFile.slice(gitRoot.length).replace(/^\//, "");
    }
    return null;
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  function handleSelect(relPath: string) {
    setSelectedFile(relPath);
    if (onSelectFile && gitRoot) {
      onSelectFile(`${gitRoot}/${relPath}`);
    }
  }

  const refresh = async () => {
    const [statusRes, logRes, branchRes, branchesRes] = await Promise.all([
      GitStatus(),
      GitLog(),
      GitBranchName(),
      GitBranches(),
    ]);
    setStatuses(statusRes || []);
    setGitLog(logRes || "");
    setBranchName(branchRes || "");
    setBranches(branchesRes || []);
  };

  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isAmend) return;
    GitLastCommitMessage().then((message) => {
      setCommitMessage(message);
    });
  }, [isAmend]);

  useEffect(() => {
    setSelectedBranchName((current) => {
      if (current && branches.includes(current)) {
        return current;
      }
      return branchName || branches[0] || "";
    });
  }, [branchName, branches]);

  async function handleCreateBranch() {
    const nextBranch = newBranchName.trim();
    if (!nextBranch || isBranching) return;
    setIsBranching(true);
    const ok = await GitCreateBranch(nextBranch);
    if (ok) {
      setNewBranchName("");
      setStatusMessage(null);
      await refresh();
      setIsBranching(false);
      return;
    }
    setStatusMessage(`Could not create branch: ${nextBranch}`);
    setIsBranching(false);
  }

  async function handleSwitchBranch() {
    const nextBranch = selectedBranchName.trim();
    if (!nextBranch || nextBranch === branchName) return;
    const ok = await GitCheckoutBranch(nextBranch);
    if (ok) {
      setStatusMessage(null);
      await refresh();
      return;
    }
    setStatusMessage(`Could not switch to branch: ${nextBranch}`);
  }

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
    setStatusMessage(`Could not stage: ${path}`);
  }

  async function handleUnstage(path: string) {
    const ok = await GitUnstage(path);
    if (ok) {
      setStatusMessage(null);
      refresh();
      return;
    }
    setStatusMessage(`Could not unstage: ${path}`);
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
    setStatusMessage("Commit failed");
    setIsCommitting(false);
  }

  async function handleRevert(path: string) {
    const ok = await GitRevert(path);
    if (ok) {
      setStatusMessage(null);
      refresh();
      return;
    }
    setStatusMessage(`Could not revert: ${path}`);
  }

  async function handlePush() {
    const ok = await GitPush();
    if (ok) {
      setStatusMessage(null);
      refresh();
      return;
    }
    setStatusMessage("Push failed");
  }

  return (
    <aside className="git-panel">
      <div className="file-panel__header">
        <span>Git</span>
        <div className="file-panel__header-actions">
          <button
            className={`file-panel__new-btn${isSidebarCollapsed ? " active" : ""}`}
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
              <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z" />
              <path d="M11 14h1a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1h-1v12z" />
            </svg>
          </button>
          <button className="file-panel__new-btn" onClick={handlePush} title="Push">
            <PushIcon />
          </button>
          <button className="file-panel__new-btn" onClick={refresh} title="Refresh">
            <RefreshIcon />
          </button>
        </div>
      </div>

      <div className={`git-panel__content ${isSidebarCollapsed ? "git-panel__content--full" : "git-panel__content--two-col"}`}>
        {/* LEFT: Diff */}
        <section className="git-panel__column git-panel__column--diff">
          <div className="git-panel__section-title git-panel__diff-title">
            {selectedFile ?? "Diff"}
          </div>
          <div className="git-panel__diff-scroll">
            <DiffView file={selectedFile} />
          </div>
        </section>

        {/* RIGHT: Changes + Branches + Log */}
        {!isSidebarCollapsed && (
          <section className="git-panel__column git-panel__column--changes" style={{ borderLeft: "1px solid var(--border-main)", overflowY: "auto" }}>
            <section className="git-panel__section">
            <div className="git-panel__section-title">Staged ({stagedFiles.length})</div>
            <ul className="file-panel__list">
              {stagedTree.length === 0 ? (
                <li className="git-panel__empty">Nothing staged</li>
              ) : (
                stagedTree.map((node) => (
                  <GitTreeItem key={`staged-${node.path}`} node={node} depth={0} onAction={handleUnstage} onRevert={handleRevert} onSelect={handleSelect} selectedFile={selectedFile} />
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
                  <GitTreeItem key={`unstaged-${node.path}`} node={node} depth={0} onAction={handleStage} onRevert={handleRevert} onSelect={handleSelect} selectedFile={selectedFile} />
                ))
              )}
            </ul>
          </section>

          <section className="git-panel__section git-panel__section--commit">
            <div className="git-panel__section-title">Commit</div>
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
          </section>

          {/* Branches Section (moved from left) */}
          <section className="git-panel__section">
            <div className="git-panel__section-title">Branches</div>
            <div className="git-panel__branch-card">
              <div className="git-panel__branch-meta">
                <span className="git-panel__branch-label">Current</span>
                <span className="git-panel__branch-badge">{branchName || "detached HEAD"}</span>
              </div>
              <div className="git-panel__branch-list">
                {branches.length === 0 ? (
                  <div className="git-panel__empty git-panel__empty--compact">No branches</div>
                ) : (
                  branches.map((branch) => (
                    <button
                      key={branch}
                      type="button"
                      className={`git-panel__branch-item${branch === selectedBranchName ? " git-panel__branch-item--selected" : ""}`}
                      onClick={() => setSelectedBranchName(branch)}
                      title={`Switch to ${branch}`}
                    >
                      <span className="git-panel__branch-item-name">{branch}</span>
                      {branch === branchName ? <span className="git-panel__branch-item-current">HEAD</span> : null}
                    </button>
                  ))
                )}
              </div>
              <div className="git-panel__branch-form">
                <input
                  className="git-panel__branch-input"
                  type="text"
                  value={newBranchName}
                  onChange={(event) => setNewBranchName(event.target.value)}
                  placeholder="Create branch..."
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleCreateBranch();
                    }
                  }}
                />
                <button
                  type="button"
                  className="git-panel__branch-btn"
                  onClick={() => {
                    void handleCreateBranch();
                  }}
                  disabled={isBranching || !newBranchName.trim()}
                >
                  {isBranching ? "Creating..." : "Create"}
                </button>
              </div>
              <button
                type="button"
                className="git-panel__branch-switch-btn"
                onClick={() => {
                  void handleSwitchBranch();
                }}
                disabled={!selectedBranchName.trim() || selectedBranchName === branchName}
              >
                Switch branch
              </button>
            </div>
          </section>

          {/* Log Section (moved from left) */}
          <section className="git-panel__section">
            <div className="git-panel__section-title">Commit log</div>
            {gitLog.trim() ? (
              <pre className="git-panel__log">{gitLog.trimEnd()}</pre>
            ) : (
              <div className="git-panel__empty">No commit log</div>
            )}
          </section>
        </section>
      )}
      </div>
    </aside>
  );
}
