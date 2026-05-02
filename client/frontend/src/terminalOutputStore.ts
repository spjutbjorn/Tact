type Listener = (chunk: string) => void;

class TerminalOutputStore {
  private buffers = new Map<string, string>();
  private listeners = new Map<string, Set<Listener>>();

  append(sessionId: string, chunk: string): void {
    const current = this.buffers.get(sessionId) ?? "";
    this.buffers.set(sessionId, current + chunk);
    const subs = this.listeners.get(sessionId);
    if (!subs) return;
    for (const listener of subs) {
      listener(chunk);
    }
  }

  getBuffer(sessionId: string): string {
    return this.buffers.get(sessionId) ?? "";
  }

  clear(sessionId: string): void {
    this.buffers.delete(sessionId);
    this.listeners.delete(sessionId);
  }

  subscribe(sessionId: string, listener: Listener): () => void {
    let subs = this.listeners.get(sessionId);
    if (!subs) {
      subs = new Set();
      this.listeners.set(sessionId, subs);
    }
    subs.add(listener);
    return () => {
      const current = this.listeners.get(sessionId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(sessionId);
      }
    };
  }
}

export const terminalOutputStore = new TerminalOutputStore();
