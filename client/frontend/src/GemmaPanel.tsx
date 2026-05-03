import { useEffect, useRef, useState } from "react";
import { GemmaMemory, ListDir, ListVolumes, OllamaChat } from "./wails";
import { EventsOn } from "../wailsjs/runtime/runtime";
import { DEFAULT_HIDDEN_NAMES } from "./fileHandlers";
import MemoryBar from "./MemoryBar";
import { dirname, joinPath } from "./path";
import { FileIcon, FolderIcon } from "./fileIcons";

interface VolumeInfo {
  path: string;
  name: string;
}

function currentVolume(path: string, volumes: VolumeInfo[]): VolumeInfo {
  const match = volumes
    .filter((v) => v.path !== "/")
    .sort((a, b) => b.path.length - a.path.length)
    .find((v) => path === v.path || path.startsWith(v.path + "/"));
  return match ?? volumes.find((v) => v.path === "/") ?? { path: "/", name: "local" };
}

function extractMentionedFiles(text: string, candidates: string[]): string[] {
  const lower = text.toLowerCase();
  const hits = new Set<string>();
  for (const candidate of candidates) {
    const name = candidate.toLowerCase();
    if (lower.includes(name)) {
      hits.add(candidate);
    }
  }
  return [...hits];
}

function extractMentionedDirs(text: string, candidates: string[]): string[] {
  return extractMentionedFiles(text, candidates);
}

function GemmaMemoryBar() {
  const [mem, setMem] = useState<{ used: number; total: number } | null>(null);

  useEffect(() => {
    async function load() {
      const data = await GemmaMemory();
      setMem(data);
    }
    load();
    const id = window.setInterval(load, 4000);
    return () => window.clearInterval(id);
  }, []);

  if (!mem || !mem.used) return null;

  const pct = mem.total > 0 ? Math.min(100, (mem.used / mem.total) * 100) : 0;
  const usedGB = (mem.used / 1e9).toFixed(1);

  return (
    <div className="memory-bar">
      <div className="memory-bar__track">
        <div className="memory-bar__fill" style={{ width: `${pct}%`, background: "var(--mem-bar-mid)" }} />
      </div>
      <div className="memory-bar__label">
        <span>GPU</span>
        <span>{usedGB} GB</span>
      </div>
    </div>
  );
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  tokens?: number;
  streaming?: boolean;
}

type GemmaMode = "standard" | "thinking" | "expert";

const GEMA_MODE_STORAGE_KEY = "tact.gemma.mode";

const MODE_OPTIONS: Array<{
  value: GemmaMode;
  label: string;
  hint: string;
}> = [
  { value: "standard", label: "Standard", hint: "Direkt svar" },
  { value: "thinking", label: "Thinking", hint: "Visa tänkande" },
  { value: "expert", label: "Expert", hint: "Mer noggrant" },
];

interface Props {
  path: string;
  width: number;
  onNavigate: (path: string) => void;
}

let seq = 0;

export default function GemmaPanel({
  path,
  width,
  onNavigate,
}: Props) {
  const [entries, setEntries] = useState<{ name: string; isDir: boolean }[]>([]);
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);
  const [mode, setMode] = useState<GemmaMode>(() => {
    const saved = window.localStorage.getItem(GEMA_MODE_STORAGE_KEY);
    return saved === "thinking" || saved === "expert" ? saved : "standard";
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!path) return;
    ListDir(path).then(setEntries);
  }, [path]);

  useEffect(() => {
    ListVolumes().then(setVolumes);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(GEMA_MODE_STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    const offThinking = EventsOn("gemma:thinking", (_id: string, chunk: string) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.streaming) {
          return [...prev.slice(0, -1), { ...last, thinking: (last.thinking ?? "") + chunk }];
        }
        return [...prev, { id: `a${++seq}`, role: "assistant", content: "", thinking: chunk, streaming: true }];
      });
    });
    const offUsage = EventsOn("gemma:usage", (_id: string, tokens: number) => {
      setTotalTokens((current) => current + tokens);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return [...prev.slice(0, -1), { ...last, tokens }];
        }
        return prev;
      });
    });
    const offChunk = EventsOn("gemma:chunk", (_id: string, chunk: string) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.streaming) {
          return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
        }
        return [...prev, { id: `a${++seq}`, role: "assistant", content: chunk, streaming: true }];
      });
    });
    const offDone = EventsOn("gemma:done", () => {
      setLoading(false);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last?.streaming) return prev;
        if (last.content.length === 0 && !last.thinking && typeof last.tokens !== "number") return prev.slice(0, -1);
        return [...prev.slice(0, -1), { ...last, streaming: false }];
      });
    });
    const offError = EventsOn("gemma:error", (_id: string, err: string) => {
      setLoading(false);
      setMessages((prev) => [...prev, { id: `e${++seq}`, role: "assistant", content: `Error: ${err}` }]);
    });
    return () => { offThinking(); offUsage(); offChunk(); offDone(); offError(); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content.length]);

  const visibleEntries = entries.filter((e) => {
    if (showHidden) return true;
    if (e.name.startsWith(".")) return false;
    if (DEFAULT_HIDDEN_NAMES.includes(e.name)) return false;
    return true;
  });
  const contextFiles = visibleEntries.map((entry) => joinPath(path, entry.name));
  const visibleFileNames = visibleEntries.filter((entry) => !entry.isDir).map((entry) => entry.name);
  const visibleDirNames = visibleEntries.filter((entry) => entry.isDir).map((entry) => entry.name);
  const focusedFiles = extractMentionedFiles(input, visibleFileNames);
  const focusedDirs = extractMentionedDirs(input, visibleDirNames);
  const focusedFilePaths = focusedFiles.map((name) => joinPath(path, name));
  const focusedDirPaths = focusedDirs.map((name) => joinPath(path, name));
  const activeVolume = volumes.length ? currentVolume(path, volumes) : null;

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Message = { id: `u${++seq}`, role: "user", content: text };
    const assistantMsg: Message = { id: `a${++seq}`, role: "assistant", content: "", thinking: "", streaming: true };
    const next = [...messages, userMsg, assistantMsg];
    setMessages(next);
    setLoading(true);
    setInput("");
    textareaRef.current?.focus();
    const apiMsgs = next
      .filter((m) => m.role !== "assistant" || !m.streaming || m.content.length > 0)
      .map((m) => ({ role: m.role, content: m.content }));
    await OllamaChat(`chat-${Date.now()}`, apiMsgs, contextFiles, mode, path, [...focusedDirPaths, ...focusedFilePaths]);
  }

  return (
    <div className="gemma-panel">
      <div className="gemma-panel__main">
        <div className="gemma-panel__messages">
          {messages.length === 0 ? (
            <div className="gemma-panel__empty">
              <div className="gemma-panel__empty-icon">✦</div>
              <div className="gemma-panel__empty-text">Ask Gemma about your files</div>
              <div className="gemma-panel__empty-hint">Check files on the right to include as context</div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`gemma-panel__msg gemma-panel__msg--${msg.role}`}>
                <div className="gemma-panel__msg-label">
                  <span>{msg.role === "user" ? "You" : "Gemma"}</span>
                </div>
                <div className="gemma-panel__msg-content">
                  {msg.content}
                  {!msg.content && msg.streaming && msg.thinking ? <span className="gemma-panel__thinking">{msg.thinking}</span> : null}
                  {msg.streaming && <span className="gemma-panel__cursor">▌</span>}
                  {msg.role === "assistant" && !msg.streaming && typeof msg.tokens === "number" && (
                    <div className="gemma-panel__msg-footer">
                      <span className="gemma-panel__msg-count">{msg.tokens} tokens</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
        <div className="gemma-panel__input-area">
          <textarea
            ref={textareaRef}
            className="gemma-panel__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={loading ? "Thinking…" : "Ask Gemma… (Enter to send, Shift+Enter new line)"}
            disabled={loading}
            rows={3}
          />
          <button
            type="button"
            className="gemma-panel__send"
            onClick={() => void handleSend()}
            disabled={loading || !input.trim()}
          >
            {loading ? "…" : "Send"}
          </button>
        </div>
      </div>

      <div className="gemma-panel__sidebar" style={{ width: `${width}px` }}>
          <MemoryBar />
          <GemmaMemoryBar />
          <div className="gemma-panel__sidebar-header">
            <span className="gemma-panel__sidebar-title">Context</span>
            <span className="gemma-panel__mode-label">{MODE_OPTIONS.find((opt) => opt.value === mode)?.label ?? "Standard"}</span>
            <span className="gemma-panel__usage-total">{totalTokens} tokens</span>
            <button
              type="button"
              className={`gemma-panel__clear${showHidden ? " gemma-panel__clear--active" : ""}`}
              onClick={() => setShowHidden((current) => !current)}
              title={showHidden ? "Hide hidden items" : "Show hidden items"}
            >
              Hidden
            </button>
            <button
              type="button"
              className="gemma-panel__clear"
              onClick={() => { setMessages([]); setLoading(false); setTotalTokens(0); }}
              title="Clear conversation"
            >
              Clear
            </button>
          </div>
          <div className="gemma-panel__mode-switcher">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`gemma-panel__mode-pill${mode === option.value ? " gemma-panel__mode-pill--active" : ""}`}
                onClick={() => setMode(option.value)}
                title={option.hint}
              >
                <span>{option.label}</span>
                <small>{option.hint}</small>
              </button>
            ))}
          </div>
          {focusedFilePaths.length > 0 && (
            <div className="gemma-panel__focus-strip">
              <span className="gemma-panel__focus-label">Current file</span>
              <span className="gemma-panel__focus-value">{focusedFilePaths.map((file) => file.split("/").pop() ?? file).join(", ")}</span>
            </div>
          )}
          {focusedDirPaths.length > 0 && (
            <div className="gemma-panel__focus-strip">
              <span className="gemma-panel__focus-label">Current folder</span>
              <span className="gemma-panel__focus-value">{focusedDirPaths.map((dir) => dir.split("/").pop() ?? dir).join(", ")}</span>
            </div>
          )}
        <div className="gemma-panel__files">
          {path && path !== "/" && (
            <div
              className="gemma-panel__file-row file-panel__entry file-panel__entry--dir"
              onMouseDown={(event) => {
                event.preventDefault();
                onNavigate(dirname(path));
              }}
              title="Go up"
            >
              <div className="file-panel__entry-left">
                <FolderIcon />
                <span>..</span>
              </div>
              <span className="gemma-panel__file-spacer" />
            </div>
          )}
          {path === "/" ? (
            <div className="gemma-panel__section">
              <div className="gemma-panel__section-label">
                {activeVolume ? `Volumes · ${activeVolume.name}` : "Volumes"}
              </div>
              {volumes.map((volume) => (
                <div
                  key={volume.path}
                  className="gemma-panel__file-row file-panel__entry file-panel__entry--dir"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onNavigate(volume.path);
                  }}
                  title={volume.path}
                >
                  <div className="file-panel__entry-left">
                    <FolderIcon />
                    <span>{volume.name}</span>
                  </div>
                  <span className="gemma-panel__file-spacer" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="gemma-panel__section">
                <div className="gemma-panel__section-label">Files</div>
                {visibleEntries.length === 0 ? (
                  <div className="gemma-panel__files-empty">No visible items in folder</div>
                ) : (
                  visibleEntries.map((entry) => {
                    const fullPath = joinPath(path, entry.name);
                    return (
                      <div
                        key={fullPath}
                        className={`gemma-panel__file-row file-panel__entry${entry.isDir ? " file-panel__entry--dir" : ""}`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          if (entry.isDir) {
                            onNavigate(fullPath);
                          }
                        }}
                        title={entry.name}
                      >
                        <div className="file-panel__entry-left">
                          {entry.isDir ? <FolderIcon /> : <FileIcon />}
                          <span>{entry.name}</span>
                        </div>
                        <span className="gemma-panel__file-spacer" />
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
