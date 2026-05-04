import { useEffect, useMemo, useRef, useState } from "react";
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
  const [now, setNow] = useState(() => Date.now());

  const header = useMemo(() => {
    if (!session) return "No session selected";
    return `${session.name} · ${session.model}`;
  }, [session]);

  const hint = useMemo(() => {
    if (!session) return "Use the terminal below. Input is handled directly in the terminal.";
    const status = getSessionStatus(session, activityBySessionId, now);
    return `${status} · ${session.command}`;
  }, [session, activityBySessionId, now]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !session) return;

    const entry = terminalRegistry.getOrCreate(session.id);
    host.appendChild(entry.container);

    const doFit = () => {
      requestAnimationFrame(() => {
        entry.fitAddon.fit();
        void ResizeTerminalSession(session.id, entry.terminal.cols, entry.terminal.rows);
      });
    };

    doFit();
    const timer = setTimeout(doFit, 100);

    entry.terminal.focus();

    const observer = new ResizeObserver(() => {
      doFit();
    });
    observer.observe(host);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      if (entry.container.parentElement === host) {
        host.removeChild(entry.container);
      }
    };
  }, [session?.id]);

  useEffect(() => {
    if (!session) return;
    const entry = terminalRegistry.getOrCreate(session.id);
    requestAnimationFrame(() => {
      entry.fitAddon.fit();
    });
  }, [sidebarOpen, session?.id]);

  return (
    <section className="terminal-view">
      <div className="terminal-view__header">
        <div className="terminal-view__title">{header}</div>
        <div className="terminal-view__hint">{hint}</div>
      </div>
      <div className="terminal-view__terminal-surface">
        <div className="terminal-view__terminal" ref={hostRef} />
      </div>
    </section>
  );
}
