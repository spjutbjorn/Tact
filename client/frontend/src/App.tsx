import { useEffect, useRef, useState } from "react";
import Breadcrumb from "./Breadcrumb";
import { AppTitlebar, ContentToolbar } from "./AppChrome";
import FilePanel from "./FilePanel";
import FileViewer from "./FileViewer";
import GemmaPanel from "./GemmaPanel";
import GitPanel from "./GitPanel";
import IconBar from "./IconBar";
import TerminalPanel from "./TerminalPanel";
import TerminalView from "./TerminalView";
import Settings from "./Settings";
import Shortcuts from "./Shortcuts";
import MediaPanel from "./MediaPanel";
import { type TransferJob, EnqueueCopy, EnqueueMove, GetTransferQueue, DeleteFile, GetCwd, GitRoot, Navigate, ResizeTerminalSession, SendTerminalInput } from "./wails";
import { EventsOn } from "../wailsjs/runtime/runtime";
import { basename, dirname, isMarkdownPath } from "./path";
import { formatFileSize } from "./filePanelHelpers";
import TransferPanel from "./TransferPanel";
import { terminalRegistry } from "./terminalRegistry";
import { type FileHandlerSettings, loadFileHandlerSettings, saveFileHandlerSettings } from "./fileHandlers";
import { DISABLED_PROFILES_KEY, PANEL_WIDTH_KEY, isMediaPath, loadDisabledProfiles, loadPanelWidth } from "./appState";
import { useTerminalManager } from "./useTerminalManager";

terminalRegistry.setHandlers(
  (sessionId, data) => {
    void SendTerminalInput(sessionId, data);
  },
  (sessionId, cols, rows) => {
    void ResizeTerminalSession(sessionId, cols, rows);
  },
);
type FileSide = "left" | "right";

export default function App() {
  const [path, setPath] = useState("");
  const [activePanel, setActivePanel] = useState<string | null>("files");
  const [terminalSidebarOpen, setTerminalSidebarOpen] = useState(false);
  const [dualFiles, setDualFiles] = useState(false);
  const [activeFileSide, setActiveFileSide] = useState<FileSide>("right");
  const [leftMirrorsRight, setLeftMirrorsRight] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileViewerOrigin, setFileViewerOrigin] = useState<string>("files");
  const [leftPath, setLeftPath] = useState("");
  const [rightPath, setRightPath] = useState("");
  const [leftCursorPath, setLeftCursorPath] = useState<string | null>(null);
  const [rightCursorPath, setRightCursorPath] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(loadPanelWidth);
  const [fileHandlerSettings, setFileHandlerSettings] = useState<FileHandlerSettings>(loadFileHandlerSettings);
  const [disabledProfileIds, setDisabledProfileIds] = useState<string[]>(loadDisabledProfiles);
  const [isDirty, setIsDirty] = useState(false);
  const [previewMode, setPreviewMode] = useState(true);
  const [fileListRefreshToken, setFileListRefreshToken] = useState(0);
  const [queueJobs, setQueueJobs] = useState<TransferJob[]>([]);
  const prevQueueJobsRef = useRef<TransferJob[]>([]);
  const [leftHasOwnLocation, setLeftHasOwnLocation] = useState(false);
  const [mediaFullscreen, setMediaFullscreen] = useState(false);
  const [mediaSidebarOpen, setMediaSidebarOpen] = useState(true);
  const [gitRoot, setGitRoot] = useState("");
  const {
    terminalProfiles,
    terminalSessions,
    activeTerminalSessionId,
    terminalActivityBySessionId,
    selectTerminalSession,
    launchTerminal,
    closeTerminalSession,
    profileBecameIdle,
  } = useTerminalManager();

  useEffect(() => {
    GetCwd().then((cwd) => {
      setPath(cwd);
      setLeftPath(cwd);
      setRightPath(cwd);
    });
    GitRoot().then(setGitRoot);
  }, []);

  useEffect(() => {
    localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth));
  }, [panelWidth]);

  useEffect(() => {
    localStorage.setItem(DISABLED_PROFILES_KEY, JSON.stringify(disabledProfileIds));
  }, [disabledProfileIds]);

  useEffect(() => {
    saveFileHandlerSettings(fileHandlerSettings);
  }, [fileHandlerSettings]);

  useEffect(() => {
    GetTransferQueue().then(setQueueJobs);
    return EventsOn("queue:update", (jobs: TransferJob[]) => {
      setQueueJobs(jobs);
    });
  }, []);

  useEffect(() => {
    const prev = prevQueueJobsRef.current;
    const newlyDone = queueJobs.some(
      (j) => (j.status === "done" || j.status === "failed") &&
        !prev.some((p) => p.id === j.id && (p.status === "done" || p.status === "failed"))
    );
    if (newlyDone) {
      setFileListRefreshToken((v) => v + 1);
    }
    prevQueueJobsRef.current = queueJobs;
  }, [queueJobs]);

  function toggleProfileDisabled(id: string) {
    setDisabledProfileIds((current) => {
      if (current.includes(id)) {
        return current.filter((i) => i !== id);
      }
      return [...current, id];
    });
  }



  function syncDeletedSelection(target: string) {
    setSelectedFile((current) => {
      if (!current) return null;
      if (current === target) return null;
      if (current.startsWith(`${target}/`)) return null;
      if (current.startsWith(`${target}::`)) return null;
      return current;
    });
    setLeftCursorPath((current) => {
      if (!current) return null;
      if (current === target) return null;
      if (current.startsWith(`${target}/`)) return null;
      if (current.startsWith(`${target}::`)) return null;
      return current;
    });
    setRightCursorPath((current) => {
      if (!current) return null;
      if (current === target) return null;
      if (current.startsWith(`${target}/`)) return null;
      if (current.startsWith(`${target}::`)) return null;
      return current;
    });
  }

  async function handleNavigate(target: string) {
    await handlePanelNavigate(activeFileSide, target);
  }

  async function handlePanelNavigate(side: FileSide, target: string) {
    const next = await Navigate(target);
    const resolved = next || target;
    if (side === "left") {
      setLeftPath(resolved);
      setLeftCursorPath(null);
      setLeftMirrorsRight(false);
      setLeftHasOwnLocation(true);
    } else {
      setRightPath(resolved);
      setRightCursorPath(null);
      if (dualFiles && leftMirrorsRight) {
        setLeftPath(resolved);
        setLeftCursorPath(null);
      }
    }
    setPath(resolved);
    setActiveFileSide(side);
    setSelectedFile(null);
    setIsDirty(false);
  }

  function handleSelectFile(file: string | null) {
    setSelectedFile(file);
    setIsDirty(false);
    if (!file) {
      setMediaFullscreen(false);
    }
    if (file && isMarkdownPath(file)) {
      setPreviewMode(true);
    }
  }

  function togglePanel(id: string) {
    if (id === "terminals") {
      setActivePanel((prev) => {
        if (prev !== "terminals") {
          setTerminalSidebarOpen(true);
          return "terminals";
        }
        if (terminalSidebarOpen) {
          setTerminalSidebarOpen(false);
          return "terminals";
        }
        return "files";
      });
      return;
    }

    setTerminalSidebarOpen(false);
    if (id === "media") {
      if (activePanel !== "media") {
        setMediaSidebarOpen(true);
      } else {
        setMediaSidebarOpen((prev) => !prev);
      }
      setActivePanel("media");
      return;
    }
    setActivePanel((prev) => {
      const next = prev === id ? null : id;
      if (id === "files" && next !== "files") {
        setDualFiles(false);
        setActiveFileSide("right");
        setPath(rightPath || path);
      }
      return next;
    });
  }

  const handleSave = () => {
    window.dispatchEvent(new CustomEvent("tact:save"));
  };

  const handleDelete = async (target: string) => {
    if (!target) return;

    const ok = await DeleteFile(target);
    if (ok) {
      syncDeletedSelection(target);
      setIsDirty(false);
      setFileListRefreshToken((value) => value + 1);
    } else {
      alert("Delete failed");
    }
  };

  const handleLaunchTerminal = async (id: string, dir: string) => {
    const sessionID = await launchTerminal(id, dir);
    if (!sessionID) {
      alert("Failed to launch terminal");
      return;
    }
    setActivePanel("terminals");
    setTerminalSidebarOpen(true);
  };

  const handleCloseTerminalSession = async (sessionID: string) => {
    const sessions = await closeTerminalSession(sessionID);
    if (!sessions) {
      alert("Failed to close session");
      return;
    }
    if (sessions.length === 0) {
      setTerminalSidebarOpen(false);
    }
  };

  const getSelectionForSide = (side: FileSide) =>
    side === "left"
      ? leftCursorPath ?? (activeFileSide === "left" ? selectedFile : null) ?? (leftPath && leftPath !== "/" ? leftPath : null)
      : rightCursorPath ?? (activeFileSide === "right" ? selectedFile : null) ?? (rightPath && rightPath !== "/" ? rightPath : null);

  const getDestinationForSide = (side: FileSide) => (side === "left" ? rightPath : leftPath);

  const handleCopySelection = (side: FileSide) => {
    const sourcePath = getSelectionForSide(side);
    const destinationPath = getDestinationForSide(side);
    if (!sourcePath || !destinationPath) return;
    EnqueueCopy(sourcePath, destinationPath);
  };

  const handleMoveSelection = (side: FileSide) => {
    const sourcePath = getSelectionForSide(side);
    const destinationPath = getDestinationForSide(side);
    if (!sourcePath || !destinationPath) return;
    EnqueueMove(sourcePath, destinationPath);
  };

  const handleToggleDualFiles = () => {
    setActivePanel("files");
    setDualFiles((current) => {
      const next = !current;
      if (next) {
        const currentPath = rightPath || path;
        const currentCursor = rightCursorPath ?? selectedFile ?? null;
        setRightPath(currentPath);
        setRightCursorPath(currentCursor);
        setLeftPath(currentPath);
        setLeftCursorPath(currentCursor);
        setLeftMirrorsRight(false);
        setActiveFileSide("right");
        setPath(currentPath);
      } else {
        setLeftMirrorsRight(false);
        setActiveFileSide("right");
        setPath(rightPath || path);
      }
      return next;
    });
  };

  const handleOpenFile = (side: FileSide, file: string) => {
    setSelectedFile(file);
    setFileViewerOrigin("files");
    setIsDirty(false);
    if (isMarkdownPath(file)) {
      setPreviewMode(true);
    }
    if (side === "left") {
      setLeftCursorPath(file);
      setLeftMirrorsRight(false);
    } else {
      setRightCursorPath(file);
      if (dualFiles && leftMirrorsRight) {
        setLeftCursorPath(file);
      }
    }
    setActiveFileSide(side);
    setPath(side === "left" ? leftPath : rightPath);
  };

  const handleCursorChange = (side: FileSide, cursor: string) => {
    if (side === "left") {
      setLeftCursorPath(cursor);
      setLeftMirrorsRight(false);
    } else {
      setRightCursorPath(cursor);
      if (dualFiles && leftMirrorsRight) {
        setLeftCursorPath(cursor);
      }
    }
    setPath(side === "left" ? leftPath : rightPath);
  };

  const showSettings = activePanel === "settings";
  const showShortcuts = activePanel === "shortcuts";
  const showFiles = activePanel === "files";
  const showMedia = activePanel === "media";
  const showGit = activePanel === "git";
  const showGemma = activePanel === "gemma";
  const showTerminals = activePanel === "terminals";
  const showQueue = activePanel === "queue";
  const activeTransfers = queueJobs.filter((j) => j.status === "queued" || j.status === "running").length;
  const showDualFiles = showFiles && dualFiles;
  const activePath = activeFileSide === "left" ? leftPath : rightPath;
  const isMd = selectedFile ? isMarkdownPath(selectedFile) : false;
  const isMedia = selectedFile ? isMediaPath(selectedFile) : false;
  const showPanels = !mediaFullscreen;
  const activeTerminalSession = terminalSessions.find((session) => session.id === activeTerminalSessionId) ?? terminalSessions[0] ?? null;
  const titleLabel = showTerminals ? activeTerminalSession?.name ?? "Terminals" : selectedFile ? basename(selectedFile) : "Tact beta";

  return (
    <div className="layout">
      <AppTitlebar fileName={titleLabel} />
      <Breadcrumb path={activePath || path} onNavigate={handleNavigate} />
      <div className="workspace">
        {showFiles && showDualFiles && showPanels && (
          <FilePanel
            side="left"
            path={leftPath || path}
            peerPath={dualFiles ? (rightPath || path) : null}
            selectedPath={leftCursorPath}
            active={activeFileSide === "left"}
            dualMode={showDualFiles}
            isMirror={leftMirrorsRight && showDualFiles}
            width={panelWidth}
            fileHandlerSettings={fileHandlerSettings}
            onWidthChange={setPanelWidth}
            onNavigate={(target) => {
              void handlePanelNavigate("left", target);
            }}
            onSelectFile={(file) => {
              handleOpenFile("left", file);
            }}
            onCursorChange={(cursor) => {
              handleCursorChange("left", cursor);
            }}
            onDelete={(target) => {
              void handleDelete(target);
            }}
            onCopySelection={() => {
              void handleCopySelection("left");
            }}
            onMoveSelection={() => {
              void handleMoveSelection("left");
            }}
            onActivate={() => setActiveFileSide("left")}
            refreshToken={fileListRefreshToken}
          />
        )}
        <main className="content">
          {(!showTerminals || showGit) && (
            <ContentToolbar
              hasSelection={Boolean(selectedFile) && !showGit}
              isMarkdown={isMd && !showGit}
              isMedia={isMedia && !showGit}
              mediaFullscreen={mediaFullscreen}
              previewMode={previewMode}
              isDirty={isDirty && !showGit}
              onTogglePreview={() => setPreviewMode(!previewMode)}
              onSave={handleSave}
              onToggleFullscreen={() => setMediaFullscreen((current) => !current)}
            />
          )}
          {showSettings ? (
            <Settings
              panelWidth={panelWidth}
              onPanelWidthChange={setPanelWidth}
              fileHandlerSettings={fileHandlerSettings}
              onFileHandlerSettingsChange={setFileHandlerSettings}
              terminalProfiles={terminalProfiles}
              disabledProfileIds={disabledProfileIds}
              onToggleProfileDisabled={toggleProfileDisabled}
            />
          ) : showShortcuts ? (
            <Shortcuts />
          ) : showMedia ? (
            <MediaPanel
              onSelectFile={(file) => {
                handleSelectFile(file);
                setFileViewerOrigin("media");
                setActivePanel("files");
                const dir = dirname(file);
                setRightPath(dir);
                setRightCursorPath(file);
                setActiveFileSide("right");
                setPath(dir);
              }}
              width={panelWidth}
              onWidthChange={setPanelWidth}
              cursorPath={activeFileSide === "left" ? leftCursorPath : rightCursorPath}
              sidebarOpen={mediaSidebarOpen}
            />
          ) : showTerminals ? (
            <TerminalView
              session={activeTerminalSession}
              activityBySessionId={terminalActivityBySessionId}
              sidebarOpen={terminalSidebarOpen}
            />
          ) : showGemma ? (
            <GemmaPanel
              path={activePath || path}
              width={panelWidth}
              onNavigate={(target) => {
                void handleNavigate(target);
              }}
            />
          ) : showQueue ? (
            <TransferPanel jobs={queueJobs} />
          ) : showGit ? (
            <GitPanel initialFile={selectedFile} gitRoot={gitRoot} onSelectFile={handleSelectFile} />
          ) : selectedFile ? (
            <FileViewer 
              key={selectedFile} 
              path={selectedFile} 
              onSelectFile={handleSelectFile}
              onExitToFolderView={() => {
                setActivePanel(fileViewerOrigin);
                setFileViewerOrigin("files");
              }}
              previewMode={previewMode}
              onDirtyChange={setIsDirty}
              isFullscreen={mediaFullscreen}
              onToggleFullscreen={() => setMediaFullscreen((current) => !current)}
              fileHandlerSettings={fileHandlerSettings}
            />
          ) : (
            <span className="content__empty">Select a file to preview</span>
          )}

        </main>
        {showTerminals && terminalSidebarOpen && showPanels && (
          <TerminalPanel
            width={panelWidth}
            profiles={terminalProfiles.filter(p => !disabledProfileIds.includes(p.id))}
            sessions={terminalSessions}

            activeSessionId={activeTerminalSessionId}
            activityBySessionId={terminalActivityBySessionId}
            launchDir={activePath || path || ""}
            onLaunchProfile={(id, dir) => {
              void handleLaunchTerminal(id, dir);
            }}
            onSelectSession={(id) => {
              setActivePanel("terminals");
              setTerminalSidebarOpen(true);
              selectTerminalSession(id);
            }}
            onCloseSession={(id) => {
              void handleCloseTerminalSession(id);
            }}
            onProfileBecameIdle={(profileId) => {
              void profileBecameIdle(profileId);
            }}
          />
          )}
        {showFiles && showPanels && (
          <FilePanel
            side="right"
            path={rightPath || path}
            peerPath={dualFiles ? (leftPath || path) : null}
            selectedPath={rightCursorPath}
            active={activeFileSide === "right"}
            dualMode={showDualFiles}
            isMirror={false}
            width={panelWidth}
            fileHandlerSettings={fileHandlerSettings}
            onWidthChange={setPanelWidth}
            onNavigate={(target) => {
              void handlePanelNavigate("right", target);
            }}
            onSelectFile={(file) => {
              handleOpenFile("right", file);
            }}
            onCursorChange={(cursor) => {
              handleCursorChange("right", cursor);
            }}
            onDelete={(target) => {
              void handleDelete(target);
            }}
            onCopySelection={() => {
              void handleCopySelection("right");
            }}
            onMoveSelection={() => {
              void handleMoveSelection("right");
            }}
            onActivate={() => setActiveFileSide("right")}
            refreshToken={fileListRefreshToken}
          />
        )}
        {showPanels && (
          <IconBar activePanel={activePanel} onToggle={togglePanel} dualFiles={dualFiles} onToggleDualFiles={handleToggleDualFiles} activeTransfers={activeTransfers} />
        )}
      </div>
      <TransferStatusBar jobs={queueJobs} />
    </div>
  );
}

function TransferStatusBar({ jobs }: { jobs: import("./wails").TransferJob[] }) {
  const running = jobs.find((j) => j.status === "running");
  const queued = jobs.filter((j) => j.status === "queued").length;
  if (!running) return null;
  const pct = running.total > 0 ? Math.min(100, (running.copied / running.total) * 100) : 0;
  const label = running.kind === "copy" ? "Copying" : "Moving";
  return (
    <div className="transfer-bar transfer-bar--active">
      <span className="transfer-bar__label">
        {label} <strong>{running.name}</strong>
        {running.total > 0 && <> · {formatFileSize(running.copied)} / {formatFileSize(running.total)}</>}
        {queued > 0 && <> · {queued} queued</>}
      </span>
      <div className="transfer-bar__track" aria-hidden="true">
        <div className="transfer-bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
