import type { ReactNode } from "react";

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function PreviewIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

export function ToolbarButton({
  active,
  dirty,
  disabled,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  dirty?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const className = ["toolbar-btn", active ? "active" : "", dirty ? "dirty" : ""].filter(Boolean).join(" ");

  return (
    <button className={className} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

export function AppTitlebar({ fileName }: { fileName: string }) {
  return (
    <div className="titlebar">
      <div className="titlebar__left" />
      <div className="titlebar__filename">{fileName}</div>
      <div className="titlebar__right" />
    </div>
  );
}

interface ContentToolbarProps {
  hasSelection: boolean;
  isMarkdown: boolean;
  isMedia: boolean;
  mediaFullscreen: boolean;
  previewMode: boolean;
  isDirty: boolean;
  onTogglePreview: () => void;
  onSave: () => void;
  onToggleFullscreen: () => void;
}

export function ContentToolbar({
  hasSelection,
  isMarkdown,
  isMedia,
  mediaFullscreen,
  previewMode,
  isDirty,
  onTogglePreview,
  onSave,
  onToggleFullscreen,
}: ContentToolbarProps) {
  return (
    <div className="content__toolbar">
      {hasSelection && (
        <div className="toolbar-actions">
          {isMarkdown && (
            <ToolbarButton active={previewMode} onClick={onTogglePreview} title={previewMode ? "Edit Mode" : "Preview Mode"}>
              {previewMode ? <EditIcon /> : <PreviewIcon />}
            </ToolbarButton>
          )}
          <ToolbarButton dirty={isDirty} onClick={onSave} disabled={!isDirty} title="Save (Cmd+S)">
            <SaveIcon />
          </ToolbarButton>
          {isMedia && (
            <ToolbarButton onClick={onToggleFullscreen} title={mediaFullscreen ? "Exit fullscreen" : "Fullscreen"}>
              {mediaFullscreen ? "⤢" : "⛶"}
            </ToolbarButton>
          )}
        </div>
      )}
    </div>
  );
}
