import { useEffect, useMemo, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { ResizeTerminalSession } from "./wails";
import type { TerminalSession } from "./wails";

interface Props {
  session: TerminalSession | null;
  output: string;
  onInput: (data: string) => void;
}

export default function TerminalView({ session, output, onInput }: Props) {
  const terminalMountRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const seenOutputRef = useRef("");
  const onInputRef = useRef(onInput);

  const header = useMemo(() => {
    if (!session) return "No session selected";
    return `${session.name} · ${session.model} · ${session.command}`;
  }, [session]);

  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);

  useEffect(() => {
    const mount = terminalMountRef.current;
    if (!mount) return;

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
    terminal.open(mount);
    fitAddon.fit();

    terminal.onData((data) => {
      if (!session) return;
      onInputRef.current(data);
    });
    terminal.onResize(({ cols, rows }) => {
      if (!session) return;
      void ResizeTerminalSession(session.id, cols, rows);
    });

    terminalRef.current = terminal;
    fitRef.current = fitAddon;

    const observer = new ResizeObserver(() => {
      fitAddon.fit();
    });
    observer.observe(mount);

    return () => {
      observer.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
      seenOutputRef.current = "";
    };
  }, [session]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    if (!session) {
      terminal.reset();
      seenOutputRef.current = "";
      return;
    }

    if (output === seenOutputRef.current) {
      return;
    }

    if (output.startsWith(seenOutputRef.current)) {
      const nextChunk = output.slice(seenOutputRef.current.length);
      if (nextChunk) {
        terminal.write(nextChunk);
      }
    } else {
      terminal.reset();
      terminal.write(output);
    }
    seenOutputRef.current = output;
  }, [output, session]);

  useEffect(() => {
    fitRef.current?.fit();
  }, [session?.id]);

  return (
    <section className="terminal-view">
      <div className="terminal-view__header">
        <div className="terminal-view__title">{header}</div>
        <div className="terminal-view__hint">Use the terminal below. Input is handled directly in the terminal.</div>
      </div>
      <div className="terminal-view__terminal-surface">
        <div className="terminal-view__terminal" ref={terminalMountRef} />
      </div>
    </section>
  );
}
