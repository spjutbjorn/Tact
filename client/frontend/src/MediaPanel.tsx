import { createContext, useCallback, useContext, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { PreparePdfThumb, PrepareVideoPath, ReadBinaryFile, WriteThumb } from "./wails";
import { imageMime, videoMime } from "./fileHandlers";
import { basename, isPdfPath } from "./path";
import {
  type MediaItem,
  type MediaSnapshot,
  MEDIA_BATCH_EVENT,
  MEDIA_CHANGED_EVENT,
  loadItems,
  loadSnapshots,
  saveItems,
  saveSnapshots,
  addToActiveProject,
} from "./mediaProjects";

const MIN_WIDTH = 120;
const MAX_WIDTH = 600;
const THUMB_SIZE = 240;

interface Props {
  onSelectFile: (path: string) => void;
  width: number;
  onWidthChange: (w: number) => void;
  cursorPath: string | null;
  sidebarOpen: boolean;
}

// ── Thumbnail helpers ────────────────────────────────────────────────

function thumbCachePath(sourcePath: string): string {
  const slash = sourcePath.lastIndexOf("/");
  const dir = slash >= 0 ? sourcePath.slice(0, slash) : "";
  const name = slash >= 0 ? sourcePath.slice(slash + 1) : sourcePath;
  return `${dir}/.thumbnails/${name}.jpg`;
}

function toObjectUrl(base64: string, mime: string): string {
  const clean = base64.replace(/\s/g, "");
  const bin = atob(clean);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([buf], { type: mime }));
}

const ScrollRootContext = createContext<HTMLDivElement | null>(null);

function useVisible(ref: React.RefObject<HTMLElement | null>): boolean {
  const [visible, setVisible] = useState(false);
  const root = useContext(ScrollRootContext);
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) setVisible(true); },
      { root, rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, root, visible]);
  return visible;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="media-panel__play-icon">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ImageThumb({ path }: { path: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const visible = useVisible(ref);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let cacheUrl: string | null = null;
    let fullUrl: string | null = null;
    const mime = imageMime(path);
    if (!mime) { setError(true); return; }
    const cached = thumbCachePath(path);

    ReadBinaryFile(cached).then((b64) => {
      if (cancelled) return;
      if (b64) {
        try { cacheUrl = toObjectUrl(b64, "image/jpeg"); setSrc(cacheUrl); } catch { setError(true); }
        return;
      }
      ReadBinaryFile(path).then((b64) => {
        if (cancelled || !b64) { if (!cancelled) setError(true); return; }
        try { fullUrl = toObjectUrl(b64, mime); } catch { setError(true); return; }
        const img = new Image();
        img.onload = () => {
          if (cancelled) { URL.revokeObjectURL(fullUrl!); fullUrl = null; return; }
          const scale = Math.min(1, THUMB_SIZE / Math.max(img.naturalWidth, img.naturalHeight, 1));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(fullUrl!); fullUrl = null;
          try {
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            const b64thumb = dataUrl.split(",")[1];
            if (b64thumb) WriteThumb(cached, b64thumb).catch(() => {});
            if (!cancelled) setSrc(dataUrl);
          } catch { if (!cancelled) setError(true); }
        };
        img.onerror = () => { if (fullUrl) { URL.revokeObjectURL(fullUrl); fullUrl = null; } if (!cancelled) setError(true); };
        img.src = fullUrl;
      }).catch(() => { if (!cancelled) setError(true); });
    }).catch(() => { if (!cancelled) setError(true); });

    return () => { cancelled = true; if (cacheUrl) URL.revokeObjectURL(cacheUrl); if (fullUrl) URL.revokeObjectURL(fullUrl); };
  }, [path, visible]);

  return (
    <div ref={ref} className="media-panel__thumb media-panel__thumb--image">
      {src ? <img src={src} alt="" className="media-panel__img" draggable={false} />
        : error ? <span className="media-panel__thumb-err">!</span>
        : <span className="media-panel__thumb-loading" />}
    </div>
  );
}

function useVideoThumbSrc(path: string, enabled: boolean): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !path) return;
    let cancelled = false;
    const cached = thumbCachePath(path);

    ReadBinaryFile(cached).then((b64) => {
      if (cancelled) return;
      if (b64) {
        setSrc("data:image/jpeg;base64," + b64.replace(/\s/g, ""));
        return;
      }

      PrepareVideoPath(path).then((preparedPath) => {
        if (cancelled || !preparedPath) return;
        const preparedMime = preparedPath === path ? (videoMime(path) ?? "video/mp4") : "video/mp4";
        ReadBinaryFile(preparedPath).then((videoB64) => {
          if (cancelled || !videoB64) return;
          let blobUrl: string | null = null;
          try { blobUrl = toObjectUrl(videoB64, preparedMime); } catch { return; }
          const video = document.createElement("video");
          video.muted = true;
          video.preload = "metadata";
          video.addEventListener("loadedmetadata", () => { if (!cancelled) video.currentTime = video.duration > 0 ? video.duration / 2 : 0; });
          video.addEventListener("seeked", () => {
            if (cancelled) return;
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth || 320;
            canvas.height = video.videoHeight || 180;
            canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
            try {
              const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
              const b64thumb = dataUrl.split(",")[1];
              if (b64thumb) WriteThumb(cached, b64thumb).catch(() => {});
              if (!cancelled) setSrc(dataUrl);
            } catch {
            }
            video.src = "";
            if (blobUrl) {
              URL.revokeObjectURL(blobUrl);
              blobUrl = null;
            }
          });
          video.addEventListener("error", () => {
            video.src = "";
            if (blobUrl) {
              URL.revokeObjectURL(blobUrl);
              blobUrl = null;
            }
          });
          video.src = blobUrl;
        }).catch(() => {});
      }).catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [path, enabled]);
  return src;
}

function usePdfThumbSrc(path: string, enabled: boolean): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !path) return;
    let cancelled = false;
    const cached = thumbCachePath(path);

    PreparePdfThumb(path).then((thumbPath) => {
      if (cancelled || !thumbPath) return;
      ReadBinaryFile(thumbPath).then((b64) => {
        if (cancelled || !b64) return;
        setSrc("data:image/jpeg;base64," + b64.replace(/\s/g, ""));
      }).catch(() => {});
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [path, enabled]);
  return src;
}

function VideoThumb({ path }: { path: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useVisible(ref);
  const thumb = useVideoThumbSrc(path, visible);

  return (
    <div ref={ref} className="media-panel__thumb media-panel__thumb--video">
      {thumb
        ? <><img src={thumb} alt="" className="media-panel__img" draggable={false} /><div className="media-panel__play-overlay"><PlayIcon /></div></>
        : <PlayIcon />}
    </div>
  );
}

function FileThumb({ name }: { name: string }) {
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() ?? "" : "";
  return (
    <div className="media-panel__thumb media-panel__thumb--file">
      <span className="media-panel__file-ext">{ext || "—"}</span>
    </div>
  );
}

function PdfThumb({ path }: { path: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useVisible(ref);
  const thumb = usePdfThumbSrc(path, visible);

  return (
    <div ref={ref} className="media-panel__thumb media-panel__thumb--pdf">
      {thumb
        ? <><img src={thumb} alt="" className="media-panel__img" draggable={false} /><div className="media-panel__play-overlay media-panel__play-overlay--pdf"><span className="media-panel__pdf-label">PDF</span></div></>
        : <span className="media-panel__thumb-loading" />}
    </div>
  );
}

// ── Browse overlay ───────────────────────────────────────────────────

function BrowseView({ items, index, onClose, onGo }: {
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onGo: (i: number) => void;
}) {
  const item = items[index];
  const isImage = !!imageMime(item.path);
  const isVideo = !!videoMime(item.path);
  const isPdf = isPdfPath(item.path);
  const mime = imageMime(item.path) ?? videoMime(item.path) ?? "application/octet-stream";

  const [src, setSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const videoThumb = useVideoThumbSrc(item.path, isVideo);
  const pdfThumb = usePdfThumbSrc(item.path, isPdf);

  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [index]);

  useEffect(() => {
    if (isPdf) return;
    setSrc(null);
    let cancelled = false;
    let url: string | null = null;
    ReadBinaryFile(item.path).then((b64) => {
      if (cancelled || !b64) return;
      try { url = toObjectUrl(b64, mime); if (!cancelled) setSrc(url); } catch {}
    });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [item.path, mime, isPdf]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowLeft" && index > 0) onGo(index - 1);
      if (e.key === "ArrowRight" && index < items.length - 1) onGo(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onGo]);

  // Non-passive wheel listener so we can prevent page scroll while zooming
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isImage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      setZoom((z) => {
        const next = Math.min(10, Math.max(0.25, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
        setPan((p) => ({
          x: dx - (dx - p.x) * (next / z),
          y: dy - (dy - p.y) * (next / z),
        }));
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isImage]);

  function handleMouseDown(e: React.MouseEvent) {
    if (!isImage || e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startPan = { x: pan.x, y: pan.y };
    const onMove = (e: MouseEvent) => setPan({ x: startPan.x + e.clientX - startX, y: startPan.y + e.clientY - startY });
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const showZoom = Math.abs(zoom - 1) > 0.01;

  return (
    <div className="media-browse">
      <div className="media-browse__bar">
        <span className="media-browse__name">{basename(item.path)}</span>
        <span className="media-browse__pos">{index + 1} / {items.length}</span>
        {showZoom && (
          <button type="button" className="media-browse__zoom-reset" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
        )}
        <button type="button" className="media-browse__close" onClick={onClose} title="Stäng (Esc)">✕</button>
      </div>
      <div className="media-browse__content">
        <button type="button" className="media-browse__nav media-browse__nav--prev" onClick={() => onGo(index - 1)} disabled={index === 0}>‹</button>
        <div
          ref={containerRef}
          className="media-browse__media"
          onMouseDown={handleMouseDown}
          style={{ cursor: isImage && zoom > 1 ? "grab" : "default", overflow: "hidden" }}
        >
          {isPdf ? (
            pdfThumb ? (
              <img src={pdfThumb} alt="" className="media-browse__pdf" draggable={false} />
            ) : (
              <span className="media-panel__thumb-loading" />
            )
          ) : !src ? (
            <span className="media-panel__thumb-loading" />
          ) : isImage ? (
            <img
              src={src}
              alt=""
              className="media-browse__img"
              draggable={false}
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center center", userSelect: "none" }}
            />
          ) : isVideo ? (
            <video src={src} poster={videoThumb ?? undefined} controls loop className="media-browse__video" />
          ) : (
            <span className="media-browse__unsupported">{basename(item.path)}</span>
          )}
          {isPdf && pdfThumb && (
            <div className="media-browse__thumb-overlay media-browse__thumb-overlay--pdf">
              <img src={pdfThumb} alt="" className="media-browse__thumb-overlay-img" draggable={false} />
              <span className="media-browse__thumb-label">PDF</span>
            </div>
          )}
        </div>
        <button type="button" className="media-browse__nav media-browse__nav--next" onClick={() => onGo(index + 1)} disabled={index === items.length - 1}>›</button>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function MediaPanel({ onSelectFile, width, onWidthChange, cursorPath, sidebarOpen }: Props) {
  const [items, setItems] = useState<MediaItem[]>(loadItems);
  const [snapshots, setSnapshots] = useState<MediaSnapshot[]>(loadSnapshots);
  const [selected, setSelected] = useState<string[]>([]);
  const [browseIndex, setBrowseIndex] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [batchTotal, setBatchTotal] = useState(0);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const [addFeedback, setAddFeedback] = useState<"added" | "exists" | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const addFeedbackTimerRef = useRef<number | null>(null);

  const scrollRootCallback = useCallback((node: HTMLDivElement | null) => {
    if (node) setScrollRoot(node);
  }, []);

  useEffect(() => {
    function onChanged() { setItems(loadItems()); }
    function onBatch(e: Event) { setBatchTotal((e as CustomEvent<{ total: number }>).detail.total); }
    window.addEventListener(MEDIA_CHANGED_EVENT, onChanged);
    window.addEventListener(MEDIA_BATCH_EVENT, onBatch);
    return () => {
      window.removeEventListener(MEDIA_CHANGED_EVENT, onChanged);
      window.removeEventListener(MEDIA_BATCH_EVENT, onBatch);
    };
  }, []);

  useEffect(() => { if (renamingId) renameInputRef.current?.focus(); }, [renamingId]);

  useEffect(() => {
    return () => {
      if (addFeedbackTimerRef.current !== null) {
        window.clearTimeout(addFeedbackTimerRef.current);
      }
    };
  }, []);

  // keep selection valid when items change
  useEffect(() => {
    const paths = new Set(items.map((i) => i.path));
    setSelected((prev) => prev.filter((p) => paths.has(p)));
  }, [items]);

  function startResize(e: ReactMouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    function onMove(e: globalThis.MouseEvent) {
      onWidthChange(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth - (e.clientX - startX))));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function persistItems(next: MediaItem[]) {
    setItems(next);
    saveItems(next);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const path = e.dataTransfer.getData("tact/path");
    const isDir = e.dataTransfer.getData("tact/is-dir") === "true";
    if (!path || isDir || items.some((i) => i.path === path)) return;
    persistItems([...items, { path, isDir: false }]);
  }

  function handleTileClick(path: string, e: ReactMouseEvent) {
    if (e.metaKey || e.ctrlKey) {
      setSelected((prev) => prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]);
    } else if (e.shiftKey && selected.length > 0) {
      const paths = items.map((i) => i.path);
      const last = paths.indexOf(selected[selected.length - 1]);
      const cur = paths.indexOf(path);
      const [a, b] = [Math.min(last, cur), Math.max(last, cur)];
      setSelected(paths.slice(a, b + 1));
    } else {
      setSelected([path]);
    }
  }

  function openBrowse() {
    if (selected.length === 0) return;
    const idx = items.findIndex((i) => i.path === selected[0]);
    if (idx >= 0) setBrowseIndex(idx);
  }

  function openInEditor() {
    if (selected.length === 0) return;
    onSelectFile(selected[0]);
  }

  function triggerAddFeedback(kind: "added" | "exists") {
    setAddFeedback(kind);
    if (addFeedbackTimerRef.current !== null) {
      window.clearTimeout(addFeedbackTimerRef.current);
    }
    addFeedbackTimerRef.current = window.setTimeout(() => {
      setAddFeedback(null);
      addFeedbackTimerRef.current = null;
    }, 1100);
  }

  function removeItem(path: string) {
    persistItems(items.filter((i) => i.path !== path));
  }

  function saveSnapshot() {
    const name = `Saved ${snapshots.length + 1}`;
    const snap: MediaSnapshot = { id: genId(), name, items: [...items] };
    const next = [...snapshots, snap];
    setSnapshots(next);
    saveSnapshots(next);
  }

  function restoreSnapshot(snap: MediaSnapshot) {
    persistItems([...snap.items]);
  }

  function updateSnapshot(snap: MediaSnapshot) {
    const next = snapshots.map((s) => s.id === snap.id ? { ...s, items: [...items] } : s);
    setSnapshots(next);
    saveSnapshots(next);
  }

  function deleteSnapshot(id: string) {
    const next = snapshots.filter((s) => s.id !== id);
    setSnapshots(next);
    saveSnapshots(next);
  }

  function startRename(snap: MediaSnapshot) {
    setRenamingId(snap.id);
    setRenameValue(snap.name);
  }

  function submitRename() {
    if (!renamingId) return;
    const name = renameValue.trim();
    if (name) {
      const next = snapshots.map((s) => s.id === renamingId ? { ...s, name } : s);
      setSnapshots(next);
      saveSnapshots(next);
    }
    setRenamingId(null);
  }

  const hasSelection = selected.length > 0;

  return (
    <div className="media-pkg">
      <div className="media-pkg__left">
        {browseIndex !== null ? (
          <BrowseView
            items={items}
            index={browseIndex}
            onClose={() => setBrowseIndex(null)}
            onGo={setBrowseIndex}
          />
        ) : (
          <>
            {/* Toolbar */}
            <div className="content__toolbar">
              <div className="toolbar-actions">
                {/* Add cursor file */}
                <button
                  type="button"
                  className="toolbar-btn"
                  title={cursorPath ? `Add: ${basename(cursorPath)}` : "No file selected in the file panel"}
                  disabled={!cursorPath}
                  onClick={() => {
                    if (!cursorPath) return;
                    const hadItem = loadItems().some((item) => item.path === cursorPath);
                    addToActiveProject(cursorPath, false);
                    triggerAddFeedback(hadItem ? "exists" : "added");
                  }}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 4.5a.5.5 0 0 1 .5.5v3h3.5a.5.5 0 0 1 0 1H8.5v3.5a.5.5 0 0 1-1 0V8.5h-3.5a.5.5 0 0 1 0-1h3.5v-3.5A.5.5 0 0 1 8 4z"/>
                    <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.414A2 2 0 0 0 13.414 3L11 .586A2 2 0 0 0 9.586 0H4zm7 1.5v2a.5.5 0 0 0 .5.5h2L11 1.5z"/>
                  </svg>
                </button>
                {addFeedback && (
                  <span className={`toolbar-feedback toolbar-feedback--${addFeedback}`} aria-live="polite">
                    {addFeedback === "added" ? "Added" : "Already in project"}
                  </span>
                )}

                <div className="toolbar-separator" />

                {/* Browse fullscreen */}
                <button
                  type="button"
                  className="toolbar-btn"
                  title="Open fullscreen browser"
                  disabled={!hasSelection}
                  onClick={openBrowse}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1.5 1h4a.5.5 0 0 1 0 1H2v3.5a.5.5 0 0 1-1 0V1.5A.5.5 0 0 1 1.5 1zm10 0a.5.5 0 0 1 .5.5V6a.5.5 0 0 1-1 0V2h-3.5a.5.5 0 0 1 0-1H11.5zM1 10.5a.5.5 0 0 1 .5-.5H5a.5.5 0 0 1 0 1H2v3a.5.5 0 0 1-1 0v-3.5zm14 0v3.5a.5.5 0 0 1-1 0V11h-3.5a.5.5 0 0 1 0-1H14.5a.5.5 0 0 1 .5.5z"/>
                  </svg>
                </button>

                {/* Open in editor */}
                <button
                  type="button"
                  className="toolbar-btn"
                  title="Open in editor / file viewer"
                  disabled={!hasSelection}
                  onClick={openInEditor}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                  </svg>
                </button>

                {/* Remove selected */}
                <button
                  type="button"
                  className="toolbar-btn"
                  title="Remove selected from view"
                  disabled={!hasSelection}
                  onClick={() => { selected.forEach(removeItem); setSelected([]); }}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d="M6 1.5A1.5 1.5 0 0 0 4.5 3V3.5H1.75a.75.75 0 0 0 0 1.5h.55l.82 8.2A2 2 0 0 0 5.11 15h5.78a2 2 0 0 0 1.99-1.8l.82-8.2h.55a.75.75 0 0 0 0-1.5H11.5V3A1.5 1.5 0 0 0 10 1.5H6Zm4 2V3.5H6V3a.5.5 0 0 1 .5-.5h3A.5.5 0 0 1 10 3.5ZM5.32 6.24a.75.75 0 0 1 .84.66l.4 4.5a.75.75 0 0 1-1.5.14l-.4-4.5a.75.75 0 0 1 .66-.8Zm5.02.66a.75.75 0 0 1 1.5.14l-.4 4.5a.75.75 0 0 1-1.5-.14l.4-4.5ZM8 6.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 8 6.5Z"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Thumbnail grid */}
            <ScrollRootContext.Provider value={scrollRoot}>
              <div
                ref={scrollRootCallback}
                className={`media-pkg__grid-wrap${isDragOver ? " media-pkg__items--over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={(e) => { if (e.target === e.currentTarget) setSelected([]); }}
              >
                {items.length === 0 ? (
                  <div className="media-pkg__hint">Drag files here from the file panel</div>
                ) : (
                  <div className="media-panel__grid">
                    {items.map((item) => {
                      const isImage = !!imageMime(item.path);
                      const isVideo = !!videoMime(item.path);
                      const isPdf = isPdfPath(item.path);
                      const isSelected = selected.includes(item.path);
                      return (
                        <button
                          key={item.path}
                          type="button"
                          className={`media-panel__tile${isSelected ? " media-panel__tile--selected" : ""}`}
                          onClick={(e) => handleTileClick(item.path, e)}
                          title={item.path}
                        >
                          {isImage ? <ImageThumb path={item.path} />
                            : isVideo ? <VideoThumb path={item.path} />
                            : isPdf ? <PdfThumb path={item.path} />
                            : <FileThumb name={basename(item.path)} />}
                          <span className="media-panel__tile-name">{basename(item.path)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollRootContext.Provider>

            {/* Progress bar */}
            {batchTotal > 0 && (
              <div className="media-pkg__progress">
                <div className="media-pkg__progress-bar">
                  <div className="media-pkg__progress-fill" style={{ width: `${Math.min(100, (items.length / batchTotal) * 100)}%` }} />
                </div>
                <span className="media-pkg__progress-label">
                  {items.length} added · {Math.max(0, batchTotal - items.length)} remaining
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sidebar */}
      {sidebarOpen && <div className="media-pkg__sidebar" style={{ width, flexShrink: 0 }}>
        <div className="file-panel__resize-handle file-panel__resize-handle--right" onMouseDown={startResize} />
        <div className="media-pkg__sidebar-section media-pkg__sidebar-section--grow">
          <div className="media-pkg__sidebar-header-row">
            <span className="media-pkg__sidebar-label">Saved</span>
            <div className="media-pkg__sidebar-actions">
              <button type="button" className="media-pkg__save-btn" onClick={saveSnapshot}>Save</button>
              <button type="button" className="media-pkg__save-btn media-pkg__save-btn--clear" onClick={() => persistItems([])}>Clear</button>
            </div>
          </div>
          {snapshots.length === 0 ? (
            <span className="media-pkg__sidebar-empty">No saved snapshots yet</span>
          ) : (
            <ul className="media-pkg__project-list">
              {snapshots.map((snap) => (
                <li key={snap.id} className="media-pkg__project-row">
                  {renamingId === snap.id ? (
                    <input
                      ref={renameInputRef}
                      className="media-pkg__rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenamingId(null); }}
                      onBlur={submitRename}
                    />
                  ) : (
                    <>
                      <button type="button" className="media-pkg__project-btn" onClick={() => restoreSnapshot(snap)} title={`Restore: ${snap.name}`}>
                        <span className="media-pkg__project-name">{snap.name}</span>
                        <span className="media-pkg__project-count">{snap.items.length}</span>
                      </button>
                      <button type="button" className="media-pkg__project-action" title="Save current view" onClick={() => updateSnapshot(snap)}>
                        <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11"><path d="M2 1.5A1.5 1.5 0 0 1 3.5 0h6.086A1.5 1.5 0 0 1 10.65.44l2.91 2.91A1.5 1.5 0 0 1 14 4.414V14.5A1.5 1.5 0 0 1 12.5 16h-9A1.5 1.5 0 0 1 2 14.5v-13Zm2 0V14h8V5H8.5A1.5 1.5 0 0 1 7 3.5V1.5H4Zm3 0V3.5h3.5L7 1.5ZM4.5 8a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5A.75.75 0 0 1 4.5 8Z"/></svg>
                      </button>
                      <button type="button" className="media-pkg__project-action" title="Edit name" onClick={() => startRename(snap)}>
                        <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>
                      </button>
                      <button type="button" className="media-pkg__project-action media-pkg__project-action--delete" title="Delete" onClick={() => deleteSnapshot(snap.id)}>
                        <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11"><path d="M6 1.5A1.5 1.5 0 0 0 4.5 3V3.5H1.75a.75.75 0 0 0 0 1.5h.55l.82 8.2A2 2 0 0 0 5.11 15h5.78a2 2 0 0 0 1.99-1.8l.82-8.2h.55a.75.75 0 0 0 0-1.5H11.5V3A1.5 1.5 0 0 0 10 1.5H6Zm4 2V3.5H6V3a.5.5 0 0 1 .5-.5h3A.5.5 0 0 1 10 3.5ZM5.32 6.24a.75.75 0 0 1 .84.66l.4 4.5a.75.75 0 0 1-1.5.14l-.4-4.5a.75.75 0 0 1 .66-.8Zm5.02.66a.75.75 0 0 1 1.5.14l-.4 4.5a.75.75 0 0 1-1.5-.14l.4-4.5ZM8 6.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 8 6.5Z"/></svg>
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>}
    </div>
  );
}
