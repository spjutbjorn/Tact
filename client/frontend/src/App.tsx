import { useEffect, useState } from "react";
import Breadcrumb from "./Breadcrumb";
import { AppTitlebar, ContentToolbar } from "./AppChrome";
import FilePanel from "./FilePanel";
import FileViewer from "./FileViewer";
import GitPanel from "./GitPanel";
import IconBar from "./IconBar";
import Settings from "./Settings";
import { CopyPath, DeleteFile, GetCwd, MovePath, Navigate } from "./wails";
import { basename, isMarkdownPath } from "./path";

const PANEL_WIDTH_KEY = "tact.panelWidth";
const DEFAULT_PANEL_WIDTH = 220;
type FileSide = "left" | "right";

function loadPanelWidth(): number {
  const saved = localStorage.getItem(PANEL_WIDTH_KEY);
  if (!saved) return DEFAULT_PANEL_WIDTH;
  const n = parseInt(saved, 10);
  return Number.isFinite(n) ? Math.max(120, Math.min(600, n)) : DEFAULT_PANEL_WIDTH;
}

export default function App() {
  const [path, setPath] = useState("");
  const [activePanel, setActivePanel] = useState<string | null>("files");
  const [dualFiles, setDualFiles] = useState(false);
  const [activeFileSide, setActiveFileSide] = useState<FileSide>("right");
  const [leftMirrorsRight, setLeftMirrorsRight] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [leftPath, setLeftPath] = useState("");
  const [rightPath, setRightPath] = useState("");
  const [leftCursorPath, setLeftCursorPath] = useState<string | null>(null);
  const [rightCursorPath, setRightCursorPath] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(loadPanelWidth);
  const [isDirty, setIsDirty] = useState(false);
  const [previewMode, setPreviewMode] = useState(true);
  const [fileListRefreshToken, setFileListRefreshToken] = useState(0);
  const [transferState, setTransferState] = useState<null | { kind: "copy" | "move" }>(null);
  const [leftHasOwnLocation, setLeftHasOwnLocation] = useState(false);

  useEffect(() => {
    GetCwd().then((cwd) => {
      setPath(cwd);
      setLeftPath(cwd);
      setRightPath(cwd);
    });
  }, []);

  useEffect(() => {
    localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth));
  }, [panelWidth]);

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
    if (file && isMarkdownPath(file)) {
      setPreviewMode(true);
    }
  }

  function togglePanel(id: string) {
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

  const activatePanelSide = (side: FileSide, seedPath: string | null) => {
    setActiveFileSide(side);
    if (side === "left") {
      setLeftCursorPath((current) => current ?? seedPath ?? rightCursorPath ?? selectedFile);
    } else {
      setRightCursorPath((current) => current ?? seedPath ?? leftCursorPath ?? selectedFile);
    }
  };

  const getSelectionForSide = (side: FileSide) =>
    side === "left"
      ? leftCursorPath ?? (activeFileSide === "left" ? selectedFile : null)
      : rightCursorPath ?? (activeFileSide === "right" ? selectedFile : null);

  const getDestinationForSide = (side: FileSide) => (side === "left" ? rightPath : leftPath);

  const afterTransfer = (destinationSide: FileSide, targetPath: string) => {
    setSelectedFile(targetPath);
    setIsDirty(false);
    setActiveFileSide(destinationSide);
    if (destinationSide === "left") {
      setLeftCursorPath(targetPath);
    } else {
      setRightCursorPath(targetPath);
    }
    setFileListRefreshToken((value) => value + 1);
  };

  const handleCopySelection = async (side: FileSide) => {
    const sourcePath = getSelectionForSide(side);
    const destinationPath = getDestinationForSide(side);
    if (!sourcePath || !destinationPath) return;

    setTransferState({ kind: "copy" });
    try {
      const ok = await CopyPath(sourcePath, destinationPath);
      if (ok) {
        afterTransfer(side === "left" ? "right" : "left", `${destinationPath}/${basename(sourcePath)}`);
      } else {
        alert("Copy failed");
      }
    } finally {
      setTimeout(() => setTransferState(null), 200);
    }
  };

  const handleMoveSelection = async (side: FileSide) => {
    const sourcePath = getSelectionForSide(side);
    const destinationPath = getDestinationForSide(side);
    if (!sourcePath || !destinationPath) return;

    setTransferState({ kind: "move" });
    try {
      const ok = await MovePath(sourcePath, destinationPath);
      if (ok) {
        afterTransfer(side === "left" ? "right" : "left", `${destinationPath}/${basename(sourcePath)}`);
        syncDeletedSelection(sourcePath);
      } else {
        alert("Move failed");
      }
    } finally {
      setTimeout(() => setTransferState(null), 200);
    }
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
        if (!leftHasOwnLocation) {
          setLeftPath(currentPath);
          setLeftCursorPath(currentCursor);
        }
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
  const showFiles = activePanel === "files";
  const showGit = activePanel === "git";
  const showDualFiles = showFiles && dualFiles;
  const activePath = activeFileSide === "left" ? leftPath : rightPath;
  const isMd = selectedFile ? isMarkdownPath(selectedFile) : false;

  return (
    <div className="layout">
      <AppTitlebar fileName={selectedFile ? basename(selectedFile) : "Tact"} />
      <Breadcrumb path={activePath || path} onNavigate={handleNavigate} />
      <div className="workspace">
        {showFiles && showDualFiles && (
          <FilePanel
            side="left"
            path={leftPath || path}
            selectedPath={leftCursorPath}
            active={activeFileSide === "left"}
            dualMode={showDualFiles}
            isMirror={leftMirrorsRight && showDualFiles}
            width={panelWidth}
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
          <ContentToolbar
            hasSelection={Boolean(selectedFile)}
            isMarkdown={isMd}
            previewMode={previewMode}
            isDirty={isDirty}
            onTogglePreview={() => setPreviewMode(!previewMode)}
            onSave={handleSave}
          />
          {showSettings ? (
            <Settings panelWidth={panelWidth} onPanelWidthChange={setPanelWidth} />
          ) : selectedFile ? (
            <FileViewer 
              key={selectedFile} 
              path={selectedFile} 
              onSelectFile={handleSelectFile}
              onExitToFolderView={() => setActivePanel("files")}
              previewMode={previewMode}
              onDirtyChange={setIsDirty}
            />
          ) : (
            <span className="content__empty">Select a file to preview</span>
          )}
        </main>
        {showFiles && (
          <FilePanel
            side="right"
            path={rightPath || path}
            selectedPath={rightCursorPath}
            active={activeFileSide === "right"}
            dualMode={showDualFiles}
            isMirror={false}
            width={panelWidth}
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
        {showGit && (
          <GitPanel 
            width={panelWidth} 
            onWidthChange={setPanelWidth} 
          />
        )}
        <IconBar activePanel={activePanel} onToggle={togglePanel} dualFiles={dualFiles} onToggleDualFiles={handleToggleDualFiles} />
      </div>
      <div className={`transfer-bar${transferState ? " transfer-bar--active" : ""}`}>
        {transferState && (
          <>
            <span className="transfer-bar__label">{transferState.kind === "copy" ? "Copying" : "Moving"}</span>
            <div className="transfer-bar__track" aria-hidden="true">
              <div className="transfer-bar__fill" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
