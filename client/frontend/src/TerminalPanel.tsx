import type { TerminalProfile, TerminalSession } from "./wails";

interface Props {
  width: number;
  profiles: TerminalProfile[];
  sessions: TerminalSession[];
  activeSessionId: string | null;
  launchDir: string;
  onLaunchProfile: (id: string, dir: string) => void;
  onSelectSession: (id: string) => void;
  onCloseSession: (id: string) => void;
}

export default function TerminalPanel({
  width,
  profiles,
  sessions,
  activeSessionId,
  launchDir,
  onLaunchProfile,
  onSelectSession,
  onCloseSession,
}: Props) {
  return (
    <aside className="terminal-sidebar terminal-sidebar--right" style={{ width: `${width}px` }}>
      <section className="terminal-sidebar__section">
        <div className="terminal-sidebar__heading">
          <span className="terminal-sidebar__label">Clients</span>
          <span className="terminal-sidebar__count">{profiles.length}</span>
        </div>
        <div className="terminal-client-launchers">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className="terminal-client-launcher"
              onClick={() => onLaunchProfile(profile.id, launchDir)}
              title={`Start ${profile.name} (${profile.command}) in ${launchDir || "current folder"}`}
            >
              <span className="terminal-client-launcher__name">{profile.name}</span>
              <span className="terminal-client-launcher__model">{profile.model}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="terminal-sidebar__section terminal-sidebar__section--sessions">
        <div className="terminal-sidebar__heading">
          <span className="terminal-sidebar__label">Sessions</span>
          <span className="terminal-sidebar__count">{sessions.length}</span>
        </div>
        <div className="terminal-session-list">
          {sessions.length === 0 ? (
            <div className="terminal-session-list__empty">No sessions yet</div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`terminal-session-item${session.id === activeSessionId ? " terminal-session-item--active" : ""}`}
              >
                <button
                  type="button"
                  className="terminal-session-item__select"
                  onClick={() => onSelectSession(session.id)}
                >
                  <div className="terminal-session-item__top">
                    <span className="terminal-session-item__name">{session.name}</span>
                    <span className={`terminal-session-item__status${session.running ? " terminal-session-item__status--running" : ""}`}>
                      {session.running ? "running" : "stopped"}
                    </span>
                  </div>
                  <div className="terminal-session-item__meta">{session.command}</div>
                </button>
                <button
                  type="button"
                  className="terminal-session-item__close"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseSession(session.id);
                  }}
                >
                  Close
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </aside>
  );
}
