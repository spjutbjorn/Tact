import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "xterm/css/xterm.css";
import { ResizeTerminalSession, type TerminalSession } from "./wails";
import { terminalRegistry } from "./terminalRegistry";

const WORKING_WINDOW_MS = 4000;

interface Props {
  session: TerminalSession | null;
  activityBySessionId: Record<string, number>;
  sidebarOpen: boolean;
}

function getSessionStatus(session: TerminalSession, activityBySessionId: Record<string, number>, now: number) {
  if (!session.running) return "done";
  const lastActivity = activityBySessionId[session.id] ?? 0;
  return now - lastActivity <= WORKING_WINDOW_MS ? "working" : "idle";
}

export default function TerminalView({ session, activityBySessionId, sidebarOpen }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const parkRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const header = useMemo(() => {
    if (!session) return "No session selected";
    return `${session.name} · ${session.model}`;
  }, [session]);

  const hint = useMemo(() => {
    if (!session) return "Use the terminal below. Input is handled directly in the terminal.";
    const status = getSessionStatus(session, activityBySessionId, now);
    return `${status} · ${session.command}`;
  }, [session, activityBySessionId, now]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    if (session) {
      terminalRegistry.getOrCreate(session.id).terminal.focus();
    }
  }, [session]);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);

  useEffect(() => {
    if (!session) return;
    const entry = terminalRegistry.getOrCreate(session.id);
    if (!searchQuery) {
      entry.searchAddon.clearDecorations();
      return;
    }
    entry.searchAddon.findNext(searchQuery, { incremental: true, decorations: { matchBackground: "#3b4261", matchBorder: "#7aa2f7", matchOverviewRuler: "#7aa2f7", activeMatchBackground: "#7aa2f7", activeMatchBorder: "#c0caf5", activeMatchColorOverviewRuler: "#c0caf5" } });
  }, [searchQuery, session]);

  useEffect(() => {
    const host = hostRef.current;
    const park = parkRef.current;
    if (!host || !park || !session) return;

    const entry = terminalRegistry.getOrCreate(session.id);

    // Move to visible host — park keeps other containers in DOM so xterm state survives
    host.appendChild(entry.container);

    let active = true;
    const doFit = () => {
      requestAnimationFrame(() => {
        if (!active) return;
        entry.fitAddon.fit();
        void ResizeTerminalSession(session.id, entry.terminal.cols, entry.terminal.rows);
      });
    };

    doFit();
    const timer = setTimeout(doFit, 150);

    entry.terminal.focus();

    const observer = new ResizeObserver(() => {
      doFit();
    });
    observer.observe(host);

    return () => {
      active = false;
      clearTimeout(timer);
      observer.disconnect();
      // Park instead of detach — keeps xterm scroll state and WebGL context alive
      if (entry.container.parentElement === host) {
        park.appendChild(entry.container);
      }
    };
  }, [session?.id]);

  useEffect(() => {
    if (!session) return;
    const entry = terminalRegistry.getOrCreate(session.id);
    requestAnimationFrame(() => {
      entry.fitAddon.fit();
    });
  }, [sidebarOpen]);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeSearch();
      return;
    }
    if (e.key === "Enter" && session) {
      e.preventDefault();
      const entry = terminalRegistry.getOrCreate(session.id);
      if (e.shiftKey) {
        entry.searchAddon.findPrevious(searchQuery, { decorations: { matchBackground: "#3b4261", matchBorder: "#7aa2f7", matchOverviewRuler: "#7aa2f7", activeMatchBackground: "#7aa2f7", activeMatchBorder: "#c0caf5", activeMatchColorOverviewRuler: "#c0caf5" } });
      } else {
        entry.searchAddon.findNext(searchQuery, { decorations: { matchBackground: "#3b4261", matchBorder: "#7aa2f7", matchOverviewRuler: "#7aa2f7", activeMatchBackground: "#7aa2f7", activeMatchBorder: "#c0caf5", activeMatchColorOverviewRuler: "#c0caf5" } });
      }
    }
  }

  return (
    <section className="terminal-view">
      <div className="terminal-view__header">
        <div className="terminal-view__title">{header}</div>
        <div className="terminal-view__hint">{hint}</div>
      </div>
      {searchOpen && (
        <div className="terminal-view__search-bar">
          <input
            ref={searchInputRef}
            className="terminal-view__search-input"
            type="text"
            placeholder="Find in terminal…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <span className="terminal-view__search-hint">Enter / Shift+Enter to navigate</span>
          <button
            type="button"
            className="terminal-view__search-close"
            aria-label="Close search"
            onClick={closeSearch}
          >
            ✕
          </button>
        </div>
      )}
      <div className="terminal-view__terminal-surface">
        <div className="terminal-view__terminal" ref={hostRef} />
      </div>
      {/* Parking lot: inactive terminal containers live here to preserve xterm state */}
      <div ref={parkRef} className="terminal-view__park" aria-hidden="true" />
    </section>
  );
}
