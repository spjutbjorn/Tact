import { useEffect, useMemo, useRef, useState } from "react";
import { RenameTerminalSession, type TerminalProfile, type TerminalSession } from "./wails";

const WORKING_WINDOW_MS = 4000;

interface Props {
  width: number;
  profiles: TerminalProfile[];
  sessions: TerminalSession[];
  activeSessionId: string | null;
  activityBySessionId: Record<string, number>;
  launchDir: string;
  onLaunchProfile: (id: string, dir: string) => void;
  onSelectSession: (id: string) => void;
  onCloseSession: (id: string) => void;
  onProfileBecameIdle: (profileId: string) => void;
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
      <path d="M6 1.5A1.5 1.5 0 0 0 4.5 3V3.5H1.75a.75.75 0 0 0 0 1.5h.55l.82 8.2A2 2 0 0 0 5.11 15h5.78a2 2 0 0 0 1.99-1.8l.82-8.2h.55a.75.75 0 0 0 0-1.5H11.5V3A1.5 1.5 0 0 0 10 1.5H6Zm4 2V3.5H6V3a.5.5 0 0 1 .5-.5h3A.5.5 0 0 1 10 3.5ZM5.32 6.24a.75.75 0 0 1 .84.66l.4 4.5a.75.75 0 0 1-1.5.14l-.4-4.5a.75.75 0 0 1 .66-.8Zm5.02.66a.75.75 0 0 1 1.5.14l-.4 4.5a.75.75 0 0 1-1.5-.14l.4-4.5ZM8 6.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 8 6.5Z" />
    </svg>
  );
}

function RenameIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
      <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z" />
    </svg>
  );
}

function PromptIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="entry-icon">
      <path d="M2.146 3.146a.5.5 0 0 1 .708 0L7 7.293a1 1 0 0 1 0 1.414L2.854 12.854a.5.5 0 0 1-.708-.708L6.293 8 2.146 3.854a.5.5 0 0 1 0-.708ZM8 11.5a.75.75 0 0 1 0-1.5h5a.75.75 0 0 1 0 1.5H8Z" />
    </svg>
  );
}

function getSessionStatus(session: TerminalSession, activityBySessionId: Record<string, number>, now: number) {
  if (!session.running) {
    return { label: "done", className: "terminal-view__session-status--done" };
  }
  const lastActivity = activityBySessionId[session.id] ?? 0;
  if (now - lastActivity <= WORKING_WINDOW_MS) {
    return { label: "working", className: "terminal-view__session-status--working" };
  }
  return { label: "idle", className: "terminal-view__session-status--idle" };
}

function SessionRow({
  session,
  active,
  activityBySessionId,
  now,
  editing,
  renameValue,
  onSelect,
  onClose,
  onStartRename,
  onRenameValueChange,
  onRenameSubmit,
  onRenameCancel,
}: {
  session: TerminalSession;
  active: boolean;
  activityBySessionId: Record<string, number>;
  now: number;
  editing: boolean;
  renameValue: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onStartRename: (id: string, name: string) => void;
  onRenameValueChange: (value: string) => void;
  onRenameSubmit: (id: string) => void;
  onRenameCancel: () => void;
}) {
  const status = getSessionStatus(session, activityBySessionId, now);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  return (
    <li>
      <div className={`terminal-view__session-row${active ? " terminal-view__session-row--active" : ""}`}>
        {editing ? (
          <div className="terminal-view__session-main terminal-view__session-main--editing">
            <PromptIcon />
            <div className="terminal-view__session-copy">
              <div className="terminal-view__session-edit-row">
                <input
                  ref={inputRef}
                  className="terminal-view__session-rename-input"
                  value={renameValue}
                  onChange={(event) => onRenameValueChange(event.target.value)}
                  onBlur={() => onRenameSubmit(session.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onRenameSubmit(session.id);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      onRenameCancel();
                    }
                  }}
                />
                <span className={`terminal-view__session-status ${status.className}`}>{status.label}</span>
              </div>
              <div className="terminal-view__session-meta">{session.model}</div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="terminal-view__session-main"
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(session.id);
            }}
            title={`${session.name} · ${session.model}`}
          >
            <PromptIcon />
            <div className="terminal-view__session-copy">
              <div className="terminal-view__session-top">
                <span className="terminal-view__session-name">{session.name}</span>
                <span className={`terminal-view__session-status ${status.className}`}>{status.label}</span>
              </div>
              <div className="terminal-view__session-meta">{session.model}</div>
            </div>
          </button>
        )}
        <button
          type="button"
          className="file-panel__small-btn delete terminal-view__session-rename"
          title="Rename prompt"
          aria-label={`Rename ${session.name}`}
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onStartRename(session.id, session.name);
          }}
        >
          <RenameIcon />
        </button>
        <button
          type="button"
          className="file-panel__small-btn delete terminal-view__session-delete"
          title="Remove prompt"
          aria-label={`Remove ${session.name}`}
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onClose(session.id);
          }}
        >
          <DeleteIcon />
        </button>
      </div>
    </li>
  );
}

function SessionFolder({
  sessions,
  open,
  activeSessionId,
  activityBySessionId,
  now,
  editingSessionId,
  renameValue,
  onToggle,
  onSelect,
  onClose,
  onStartRename,
  onRenameValueChange,
  onRenameSubmit,
  onRenameCancel,
}: {
  sessions: TerminalSession[];
  open: boolean;
  activeSessionId: string | null;
  activityBySessionId: Record<string, number>;
  now: number;
  editingSessionId: string | null;
  renameValue: string;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onStartRename: (id: string, name: string) => void;
  onRenameValueChange: (value: string) => void;
  onRenameSubmit: (id: string) => void;
  onRenameCancel: () => void;
}) {
  return (
    <li className="terminal-view__session-folder">
      <button
        type="button"
        className="terminal-view__session-folder-header"
        onMouseDown={(event) => {
          event.preventDefault();
          onToggle();
        }}
      >
        <span className={`terminal-view__session-folder-caret${open ? " terminal-view__session-folder-caret--open" : ""}`}>›</span>
        <span>Running prompts</span>
        <span className="terminal-view__session-folder-count">{sessions.length}</span>
      </button>
      {open && (
        <ul className="terminal-view__session-folder-list">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              active={session.id === activeSessionId}
              activityBySessionId={activityBySessionId}
              now={now}
              editing={session.id === editingSessionId}
              renameValue={session.id === editingSessionId ? renameValue : session.name}
              onSelect={onSelect}
              onClose={onClose}
              onStartRename={onStartRename}
              onRenameValueChange={onRenameValueChange}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function TerminalPanel({
  width,
  profiles,
  sessions,
  activeSessionId,
  activityBySessionId,
  launchDir,
  onLaunchProfile,
  onSelectSession,
  onCloseSession,
  onProfileBecameIdle,
}: Props) {
  const [runningPromptsOpen, setRunningPromptsOpen] = useState(false);
  const completedSessions = useMemo(() => sessions.filter((session) => !session.running), [sessions]);
  const [now, setNow] = useState(() => Date.now());
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameSessionNameRef = useRef<string | null>(null);
  const workingSessions = useMemo(
    () =>
      sessions.filter((session) => {
        if (!session.running) return false;
        const lastActivity = activityBySessionId[session.id] ?? 0;
        return now - lastActivity <= WORKING_WINDOW_MS;
      }),
    [activityBySessionId, now, sessions],
  );
  const idleSessions = useMemo(
    () =>
      sessions.filter((session) => {
        if (!session.running) return false;
        const lastActivity = activityBySessionId[session.id] ?? 0;
        return now - lastActivity > WORKING_WINDOW_MS;
      }),
    [activityBySessionId, now, sessions],
  );
  const previousIdleSessionIds = useRef<string[]>([]);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!editingSessionId) return;
    if (sessions.some((session) => session.id === editingSessionId)) return;
    setEditingSessionId(null);
    setRenameValue("");
    renameSessionNameRef.current = null;
  }, [editingSessionId, sessions]);

  useEffect(() => {
    sidebarRef.current?.style.setProperty("--terminal-sidebar-width", `${width}px`);
  }, [width]);

  useEffect(() => {
    const previous = new Set(previousIdleSessionIds.current);
    for (const session of idleSessions) {
      if (!previous.has(session.id)) {
        onProfileBecameIdle(session.profileId);
      }
    }
    previousIdleSessionIds.current = idleSessions.map((session) => session.id);
  }, [idleSessions, onProfileBecameIdle]);

  async function submitSessionRename(sessionId: string) {
    const nextName = renameValue.trim();
    const originalName = renameSessionNameRef.current ?? "";
    if (!nextName || nextName === originalName) {
      setEditingSessionId(null);
      setRenameValue("");
      renameSessionNameRef.current = null;
      return;
    }
    const ok = await RenameTerminalSession(sessionId, nextName);
    if (ok) {
      setEditingSessionId(null);
      setRenameValue("");
      renameSessionNameRef.current = null;
    }
  }

  function startSessionRename(sessionId: string, name: string) {
    setEditingSessionId(sessionId);
    setRenameValue(name);
    renameSessionNameRef.current = name;
  }

  function cancelSessionRename() {
    setEditingSessionId(null);
    setRenameValue("");
    renameSessionNameRef.current = null;
  }

  return (
    <aside ref={sidebarRef} className="terminal-sidebar terminal-sidebar--right">
      <section className="terminal-sidebar__section">
        <div className="terminal-sidebar__heading">
          <span className="terminal-sidebar__label">Clients</span>
          <span className="terminal-sidebar__count">{profiles.length}</span>
        </div>
        <div className="terminal-client-launchers">
          {profiles.map((profile) => {
            const primaryLine = profile.name;
            const secondaryLine = profile.model;
            return (
              <button
                key={profile.id}
                type="button"
                className="terminal-client-launcher"
                onClick={() => onLaunchProfile(profile.id, launchDir)}
                title={`Start ${profile.name} (${profile.command}) in ${launchDir || "current folder"}`}
              >
                <span className="terminal-client-launcher__name">{primaryLine}</span>
                <span className="terminal-client-launcher__model">{secondaryLine}</span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="terminal-sidebar__section terminal-sidebar__section--sessions">
        <div className="terminal-sidebar__heading">
          <span className="terminal-sidebar__label">Sessions</span>
          <span className="terminal-sidebar__count">{sessions.length}</span>
        </div>
        <div className="terminal-view__sessions">
          {sessions.length === 0 ? (
            <div className="terminal-view__sessions-empty">No sessions yet</div>
          ) : (
            <ul className="terminal-view__sessions-list">
              {completedSessions.map((item) => (
                <SessionRow
                  key={item.id}
                  session={item}
                  active={item.id === activeSessionId}
                  activityBySessionId={activityBySessionId}
                  now={now}
                  editing={item.id === editingSessionId}
                  renameValue={item.id === editingSessionId ? renameValue : item.name}
                  onSelect={onSelectSession}
                  onClose={onCloseSession}
                  onStartRename={startSessionRename}
                  onRenameValueChange={setRenameValue}
                  onRenameSubmit={submitSessionRename}
                  onRenameCancel={cancelSessionRename}
                />
              ))}
              {idleSessions.map((item) => (
                <SessionRow
                  key={item.id}
                  session={item}
                  active={item.id === activeSessionId}
                  activityBySessionId={activityBySessionId}
                  now={now}
                  editing={item.id === editingSessionId}
                  renameValue={item.id === editingSessionId ? renameValue : item.name}
                  onSelect={onSelectSession}
                  onClose={onCloseSession}
                  onStartRename={startSessionRename}
                  onRenameValueChange={setRenameValue}
                  onRenameSubmit={submitSessionRename}
                  onRenameCancel={cancelSessionRename}
                />
              ))}
              {workingSessions.length > 0 && (
                <SessionFolder
                  sessions={workingSessions}
                  open={runningPromptsOpen}
                  activeSessionId={activeSessionId}
                  activityBySessionId={activityBySessionId}
                  now={now}
                  editingSessionId={editingSessionId}
                  renameValue={renameValue}
                  onToggle={() => {
                    setRunningPromptsOpen((current) => !current);
                  }}
                  onSelect={onSelectSession}
                  onClose={onCloseSession}
                  onStartRename={startSessionRename}
                  onRenameValueChange={setRenameValue}
                  onRenameSubmit={submitSessionRename}
                  onRenameCancel={cancelSessionRename}
                />
              )}
            </ul>
          )}
        </div>
      </section>
    </aside>
  );
}
