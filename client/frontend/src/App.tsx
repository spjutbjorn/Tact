import { useEffect, useState } from "react";
import Breadcrumb from "./Breadcrumb";
import { AppTitlebar, ContentToolbar } from "./AppChrome";
import FilePanel from "./FilePanel";
import FileViewer from "./FileViewer";
import GitPanel from "./GitPanel";
import IconBar from "./IconBar";
import Settings from "./Settings";
import { DeleteFile, GetCwd, Navigate } from "./wails";
import { basename, isMarkdownPath } from "./path";

const PANEL_WIDTH_KEY = "tact.panelWidth";
const DEFAULT_PANEL_WIDTH = 220;

function loadPanelWidth(): number {
  const saved = localStorage.getItem(PANEL_WIDTH_KEY);
  if (!saved) return DEFAULT_PANEL_WIDTH;
  const n = parseInt(saved, 10);
  return Number.isFinite(n) ? Math.max(120, Math.min(600, n)) : DEFAULT_PANEL_WIDTH;
}

export default function App() {
  const [path, setPath] = useState("");
  const [activePanel, setActivePanel] = useState<string | null>("files");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(loadPanelWidth);
  const [isDirty, setIsDirty] = useState(false);
  const [previewMode, setPreviewMode] = useState(true);
  const [fileListRefreshToken, setFileListRefreshToken] = useState(0);

  useEffect(() => {
    GetCwd().then(setPath);
  }, []);

  useEffect(() => {
    localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth));
  }, [panelWidth]);

  async function handleNavigate(target: string) {
    const next = await Navigate(target);
    setPath(next || target);
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
    setActivePanel((prev) => (prev === id ? null : id));
  }

  const handleSave = () => {
    window.dispatchEvent(new CustomEvent("tact:save"));
  };

  const handleDelete = async (target: string) => {
    if (!target) return;

    const ok = await DeleteFile(target);
    if (ok) {
      setSelectedFile((current) => {
        if (!current) return null;
        if (current === target) return null;
        if (current.startsWith(`${target}/`)) return null;
        if (current.startsWith(`${target}::`)) return null;
        return current;
      });
      setIsDirty(false);
      setFileListRefreshToken((value) => value + 1);
    } else {
      alert("Delete failed");
    }
  };

  const showSettings = activePanel === "settings";
  const showFiles = activePanel === "files";
  const showGit = activePanel === "git";
  const isMd = selectedFile ? isMarkdownPath(selectedFile) : false;

  return (
    <div className="layout">
      <AppTitlebar fileName={selectedFile ? basename(selectedFile) : "Tact"} />
      <Breadcrumb path={path} onNavigate={handleNavigate} />
      <div className="workspace">
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
              previewMode={previewMode}
              onDirtyChange={setIsDirty}
            />
          ) : (
            <span className="content__empty">Select a file to preview</span>
          )}
        </main>
        {showFiles && (
          <FilePanel
            path={path}
            selectedFile={selectedFile}
            width={panelWidth}
            onWidthChange={setPanelWidth}
            onNavigate={handleNavigate}
            onSelectFile={handleSelectFile}
            onDelete={(target) => {
              void handleDelete(target);
            }}
            refreshToken={fileListRefreshToken}
          />
        )}
        {showGit && (
          <GitPanel 
            width={panelWidth} 
            onWidthChange={setPanelWidth} 
          />
        )}
        <IconBar activePanel={activePanel} onToggle={togglePanel} />
      </div>
    </div>
  );
}
