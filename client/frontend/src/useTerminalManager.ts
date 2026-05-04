import { useEffect, useState } from "react";
import { EventsOn } from "../wailsjs/runtime/runtime";
import {
  CloseTerminalSession,
  LaunchTerminalProfileAt,
  TerminalProfileUsage,
  TerminalProfiles,
  TerminalSessions,
  type TerminalProfile,
  type TerminalSession,
} from "./wails";
import { pickActiveSessionId } from "./appState";
import { terminalOutputStore } from "./terminalOutputStore";
import { terminalRegistry } from "./terminalRegistry";

interface TerminalManagerState {
  terminalProfiles: TerminalProfile[];
  terminalSessions: TerminalSession[];
  activeTerminalSessionId: string | null;
  terminalActivityBySessionId: Record<string, number>;
}

interface TerminalManagerActions {
  selectTerminalSession: (sessionId: string) => void;
  launchTerminal: (profileId: string, dir: string) => Promise<string | null>;
  closeTerminalSession: (sessionId: string) => Promise<TerminalSession[] | null>;
  profileBecameIdle: (profileId: string) => Promise<void>;
}

export function useTerminalManager(): TerminalManagerState & TerminalManagerActions {
  const [terminalProfiles, setTerminalProfiles] = useState<TerminalProfile[]>([]);
  const [terminalSessions, setTerminalSessions] = useState<TerminalSession[]>([]);
  const [activeTerminalSessionId, setActiveTerminalSessionId] = useState<string | null>(null);
  const [terminalActivityBySessionId, setTerminalActivityBySessionId] = useState<Record<string, number>>({});

  async function refreshTerminalUsage(profileId: string) {
    await TerminalProfileUsage(profileId);
  }

  async function refreshTerminalSessions(nextActiveSessionId?: string | null) {
    const sessions = await TerminalSessions();
    setTerminalSessions(sessions);
    setActiveTerminalSessionId((current) => {
      if (typeof nextActiveSessionId !== "undefined") {
        return pickActiveSessionId(nextActiveSessionId, sessions);
      }
      return pickActiveSessionId(current, sessions);
    });
    return sessions;
  }

  function selectTerminalSession(sessionId: string) {
    setActiveTerminalSessionId(sessionId);
  }

  async function launchTerminal(profileId: string, dir: string) {
    const sessionId = await LaunchTerminalProfileAt(profileId, dir);
    if (!sessionId) return null;

    const profile = terminalProfiles.find((item) => item.id === profileId);
    if (profile) {
      const optimisticSession: TerminalSession = {
        id: sessionId,
        profileId: profile.id,
        name: profile.name,
        model: profile.model,
        command: profile.command,
        running: true,
        startedAt: new Date().toISOString(),
      };
      void refreshTerminalUsage(profile.id);
      setTerminalActivityBySessionId((current) => ({
        ...current,
        [sessionId]: Date.now(),
      }));
      setTerminalSessions((current) => {
        const next = current.filter((session) => session.id !== sessionId);
        return [optimisticSession, ...next];
      });
    }

    setActiveTerminalSessionId(sessionId);
    await refreshTerminalSessions(sessionId);
    return sessionId;
  }

  async function closeTerminalSession(sessionId: string) {
    const ok = await CloseTerminalSession(sessionId);
    if (!ok) return null;

    terminalRegistry.destroy(sessionId);
    terminalOutputStore.clear(sessionId);
    setTerminalActivityBySessionId((current) => {
      const next = { ...current };
      delete next[sessionId];
      return next;
    });
    return refreshTerminalSessions(activeTerminalSessionId === sessionId ? null : activeTerminalSessionId);
  }

  useEffect(() => {
    TerminalProfiles().then(setTerminalProfiles);
  }, []);

  useEffect(() => {
    terminalProfiles.forEach((profile) => {
      void refreshTerminalUsage(profile.id);
    });
  }, [terminalProfiles]);

  useEffect(() => {
    void refreshTerminalSessions();
  }, []);

  useEffect(() => {
    const offOutput = EventsOn("terminal:output", (sessionId: string, chunk: string) => {
      terminalOutputStore.append(sessionId, chunk);
      setTerminalActivityBySessionId((current) => ({
        ...current,
        [sessionId]: Date.now(),
      }));
    });
    const offSessions = EventsOn("terminal:sessions", () => {
      void refreshTerminalSessions();
    });
    const offExited = EventsOn("terminal:exited", (sessionId: string) => {
      void refreshTerminalSessions(sessionId);
    });
    return () => {
      offOutput();
      offSessions();
      offExited();
    };
  }, []);

  return {
    terminalProfiles,
    terminalSessions,
    activeTerminalSessionId,
    terminalActivityBySessionId,
    selectTerminalSession,
    launchTerminal,
    closeTerminalSession,
    profileBecameIdle: refreshTerminalUsage,
  };
}
