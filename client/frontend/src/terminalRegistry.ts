import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { terminalOutputStore } from "./terminalOutputStore";

export interface RegisteredTerminal {
  terminal: Terminal;
  fitAddon: FitAddon;
  container: HTMLDivElement;
}

type InputHandler = (sessionId: string, data: string) => void;
type ResizeHandler = (sessionId: string, cols: number, rows: number) => void;

class TerminalRegistry {
  private entries = new Map<string, RegisteredTerminal & { unsubOutput: () => void }>();
  private inputHandler: InputHandler | null = null;
  private resizeHandler: ResizeHandler | null = null;

  setHandlers(input: InputHandler, resize: ResizeHandler): void {
    this.inputHandler = input;
    this.resizeHandler = resize;
  }

  getOrCreate(sessionId: string): RegisteredTerminal {
    const existing = this.entries.get(sessionId);
    if (existing) return existing;

    const container = document.createElement("div");
    container.style.width = "100%";
    container.style.height = "100%";

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, "SF Mono", monospace',
      fontSize: 13,
      theme: {
        background: "#090909",
        foreground: "#d0d0d0",
        cursor: "#d0d0d0",
        selectionBackground: "rgba(59, 130, 246, 0.25)",
      },
      convertEol: true,
      scrollback: 6000,
      allowProposedApi: true,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);

    terminal.onData((data) => {
      this.inputHandler?.(sessionId, data);
    });
    terminal.onResize(({ cols, rows }) => {
      this.resizeHandler?.(sessionId, cols, rows);
    });

    const cached = terminalOutputStore.getBuffer(sessionId);
    if (cached) {
      terminal.write(cached);
    }
    const unsubOutput = terminalOutputStore.subscribe(sessionId, (chunk) => {
      terminal.write(chunk);
    });

    const entry = { terminal, fitAddon, container, unsubOutput };
    this.entries.set(sessionId, entry);
    return entry;
  }

  destroy(sessionId: string): void {
    const entry = this.entries.get(sessionId);
    if (!entry) return;
    entry.unsubOutput();
    entry.terminal.dispose();
    entry.container.remove();
    this.entries.delete(sessionId);
  }
}

export const terminalRegistry = new TerminalRegistry();
