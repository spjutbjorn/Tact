import React from "react";

interface Icon {
  id: string;
  title: string;
  svg: () => React.ReactElement;
}

const ICONS: Icon[] = [
  {
    id: "files",
    title: "Files",
    svg: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7a2 2 0 0 1 2-2h3.586a1 1 0 0 1 .707.293L11 7h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      </svg>
    ),
  },
  {
    id: "transfer",
    title: "Split Files",
    svg: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 6h11" />
        <path d="M8 18h11" />
        <path d="M3 6l3 3-3 3" />
        <path d="M3 18l3-3-3-3" />
      </svg>
    ),
  },
  {
    id: "git",
    title: "Git Status",
    svg: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="18" r="3" />
        <circle cx="6" cy="6" r="3" />
        <path d="M6 9v7.5a3 3 0 0 0 6 0v-7.5" />
        <line x1="18" y1="9" x2="18" y2="12" />
        <circle cx="18" cy="6" r="3" />
      </svg>
    ),
  },
  {
    id: "terminals",
    title: "AI Terminals",
    svg: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16v12H4z" />
        <path d="M7 10l3 2-3 2" />
        <path d="M12 14h5" />
      </svg>
    ),
  },
];

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

interface Props {
  activePanel: string | null;
  onToggle: (id: string) => void;
  dualFiles: boolean;
  onToggleDualFiles: () => void;
}

export default function IconBar({ activePanel, onToggle, dualFiles, onToggleDualFiles }: Props) {
  return (
    <div className="icon-bar">
      {ICONS.map((icon) => (
        icon.id === "transfer" ? (
          <button
            key={icon.id}
            className={`icon-bar__btn${dualFiles ? " icon-bar__btn--active" : ""}`}
            title={icon.title}
            onClick={onToggleDualFiles}
            aria-pressed={dualFiles}
          >
            <icon.svg />
          </button>
        ) : (
        <button
          key={icon.id}
          className={`icon-bar__btn${activePanel === icon.id ? " icon-bar__btn--active" : ""}`}
          title={icon.title}
          onClick={() => onToggle(icon.id)}
          aria-pressed={activePanel === icon.id}
        >
          <icon.svg />
        </button>
        )
      ))}
      <div className="icon-bar__spacer" />
      <button
        className={`icon-bar__btn${activePanel === "settings" ? " icon-bar__btn--active" : ""}`}
        title="Settings"
        onClick={() => onToggle("settings")}
        aria-pressed={activePanel === "settings"}
      >
        <GearIcon />
      </button>
    </div>
  );
}
