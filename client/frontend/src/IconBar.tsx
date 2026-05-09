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
    id: "queue",
    title: "Transfers",
    svg: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8l4 4-4 4" />
        <path d="M3 12h18" />
        <path d="M7 16l-4-4 4-4" />
      </svg>
    ),
  },
  {
    id: "media",
    title: "Media",
    svg: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
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
  {
    id: "gemma",
    title: "Gemma",
    svg: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
      </svg>
    ),
  },
];

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

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
  activeTransfers: number;
}

function Logo() {
  return (
    <svg className="icon-bar__logo" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#1E293B" />
          <stop offset="100%" stop-color="#0F172A" />
        </linearGradient>
        <linearGradient id="textGrad" x1="220" y1="180" x2="420" y2="280" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#60A5FA" />
          <stop offset="100%" stop-color="#3B82F6" />
        </linearGradient>
      </defs>
      <rect x="32" y="64" width="448" height="384" rx="32" fill="url(#bgGrad)" />
      <rect x="32" y="64" width="448" height="384" rx="32" stroke="#334155" strokeWidth="2" />
      <path d="M32 96C32 78.3269 46.3269 64 64 64H448C465.673 64 480 78.3269 480 96V128H32V96Z" fill="#020617" opacity="0.5" />
      <circle cx="72" cy="96" r="8" fill="#EF4444" />
      <circle cx="104" cy="96" r="8" fill="#F59E0B" />
      <circle cx="136" cy="96" r="8" fill="#10B981" />
      <path d="M80 220L128 256L80 292" stroke="#10B981" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="152" y="284" width="32" height="12" rx="4" fill="#10B981" />
      <text x="210" y="280" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="96" fontWeight="900" fill="url(#textGrad)" letterSpacing="-2">Tact</text>
    </svg>
  );
}

export default function IconBar({ activePanel, onToggle, dualFiles, onToggleDualFiles, activeTransfers }: Props) {
  return (
    <div className="icon-bar">
      <div className="icon-bar__logo-container">
        <Logo />
      </div>
      {ICONS.map((icon) => {
        if (icon.id === "transfer") {
          return (
            <button
              key={icon.id}
              className={`icon-bar__btn${dualFiles ? " icon-bar__btn--active" : ""}`}
              title={icon.title}
              onClick={onToggleDualFiles}
              aria-pressed={dualFiles}
            >
              <icon.svg />
            </button>
          );
        }
        if (icon.id === "queue") {
          return (
            <button
              key={icon.id}
              className={`icon-bar__btn${activePanel === "queue" ? " icon-bar__btn--active" : ""}${activeTransfers > 0 ? " icon-bar__btn--badge" : ""}`}
              title={icon.title}
              onClick={() => onToggle("queue")}
              aria-pressed={activePanel === "queue"}
              data-badge={activeTransfers > 0 ? String(activeTransfers) : undefined}
            >
              <icon.svg />
            </button>
          );
        }
        return (
          <button
            key={icon.id}
            className={`icon-bar__btn${activePanel === icon.id ? " icon-bar__btn--active" : ""}`}
            title={icon.title}
            onClick={() => onToggle(icon.id)}
            aria-pressed={activePanel === icon.id}
          >
            <icon.svg />
          </button>
        );
      })}
      <div className="icon-bar__spacer" />
      <button
        className={`icon-bar__btn${activePanel === "shortcuts" ? " icon-bar__btn--active" : ""}`}
        title="Keyboard shortcuts"
        onClick={() => onToggle("shortcuts")}
        aria-pressed={activePanel === "shortcuts"}
      >
        <InfoIcon />
      </button>
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
