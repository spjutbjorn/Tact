import { useEffect, useRef, useState, type RefObject } from "react";
import { renderAsync } from "docx-preview";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PrepareVideoPath, ReadBinaryFile, ReadDocxFile, ReadPandocHtml, ReadTextFile, WriteTextFile, ListDir } from "./wails";
import { basename, dirname, isDocxPath, isEpubPath, isLicensePath, isMarkdownPath, isPdfPath, isRtfPath, isTextLikePath, joinPath } from "./path";

const VIDEO_MIME: Record<string, string> = {
  mp4: "video/mp4", m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  ogv: "video/ogg",
};

const AUDIO_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
  amr: "audio/amr",
};

function videoMime(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_MIME[ext] ?? null;
}

function audioMime(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_MIME[ext] ?? null;
}

const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml",
  bmp: "image/bmp", ico: "image/x-icon",
  tif: "image/tiff", tiff: "image/tiff",
  avif: "image/avif",
};

function imageMime(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_MIME[ext] ?? null;
}

function mediaMime(path: string): string | null {
  return imageMime(path) ?? videoMime(path) ?? audioMime(path);
}

function binaryToObjectUrl(base64: string, mime: string): string {
  const bin = atob(base64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([buf], { type: mime }));
}

function fileUrl(path: string): string {
  return encodeURI(`file://${path}`);
}

function useFullscreenKeys(
  isFullscreen: boolean,
  onToggleFullscreen: () => void,
  onSelectFile?: (path: string) => void,
  path?: string,
  scrollRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!isFullscreen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onToggleFullscreen();
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const target = scrollRef?.current;
        if (!target) return;
        const delta = Math.max(240, Math.floor(window.innerHeight * 0.9));
        if (e.key === "ArrowUp") {
          const nextTop = Math.max(0, target.scrollTop - delta);
          target.scrollTo({ top: nextTop, behavior: "auto" });
        } else {
          const nextTop = target.scrollTop + delta;
          target.scrollTo({ top: nextTop, behavior: "auto" });
        }
        return;
      }
      if (!onSelectFile || !path) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const dir = dirname(path);
      ListDir(dir).then((entries) => {
        const siblings = entries
          .map((entry) => joinPath(dir, entry.name))
          .filter((candidate) => mediaMime(candidate) !== null);
        if (siblings.length === 0) return;
        const currentIndex = siblings.indexOf(path);
        const delta = e.key === "ArrowLeft" ? -1 : 1;
        const nextIndex = currentIndex === -1 ? 0 : Math.max(0, Math.min(siblings.length - 1, currentIndex + delta));
        const nextPath = siblings[nextIndex];
        if (nextPath && nextPath !== path) {
          onSelectFile(nextPath);
        }
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen, onToggleFullscreen, onSelectFile, path, scrollRef]);
}

function useMediaNavigation(path: string, onSelectFile?: (p: string) => void) {
  const [siblings, setSiblings] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const dir = dirname(path);
    ListDir(dir).then((entries) => {
      if (cancelled) return;
      const next = entries
        .map((entry) => joinPath(dir, entry.name))
        .filter((candidate) => mediaMime(candidate) !== null);
      setSiblings(next);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  function navigate(delta: number) {
    if (!onSelectFile || siblings.length === 0) return;
    const currentIndex = siblings.indexOf(path);
    const nextIndex = currentIndex === -1 ? 0 : Math.max(0, Math.min(siblings.length - 1, currentIndex + delta));
    const nextPath = siblings[nextIndex];
    if (nextPath && nextPath !== path) {
      onSelectFile(nextPath);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      navigate(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      navigate(1);
    }
  }

  return { onKeyDown };
}

function useBinaryObjectUrl(path: string, mime: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const previousUrl = useRef<string | null>(null);

  useEffect(() => {
    if (previousUrl.current) URL.revokeObjectURL(previousUrl.current);
    previousUrl.current = null;
    setUrl(null);

    ReadBinaryFile(path).then((base64) => {
      if (!base64) return;
      const nextUrl = binaryToObjectUrl(base64, mime);
      previousUrl.current = nextUrl;
      setUrl(nextUrl);
    });

    return () => {
      if (previousUrl.current) URL.revokeObjectURL(previousUrl.current);
      previousUrl.current = null;
    };
  }, [path, mime]);

  return url;
}

function useVideoSource(path: string, mime: string): string | null {
  const [src, setSrc] = useState<string | null>(null);
  const previousUrl = useRef<string | null>(null);

  useEffect(() => {
    if (previousUrl.current?.startsWith("blob:")) {
      URL.revokeObjectURL(previousUrl.current);
    }
    previousUrl.current = null;
    setSrc(null);

    if (mime === "video/x-matroska") {
      setSrc(fileUrl(path));
      return;
    }

    ReadBinaryFile(path).then((base64) => {
      if (!base64) return;
      const nextUrl = binaryToObjectUrl(base64, mime);
      previousUrl.current = nextUrl;
      setSrc(nextUrl);
    });

    return () => {
      if (previousUrl.current?.startsWith("blob:")) {
        URL.revokeObjectURL(previousUrl.current);
      }
      previousUrl.current = null;
    };
  }, [path, mime]);

  return src;
}

function PdfViewer({ path }: { path: string }) {
  const url = useBinaryObjectUrl(path, "application/pdf");

  if (!url) return <div className="viewer-loading">Loading…</div>;
  return <embed src={url} type="application/pdf" className="pdf-viewer" />;
}

function HtmlDocumentViewer({ path }: { path: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    ReadPandocHtml(path).then((next) => {
      if (!cancelled) setHtml(next);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (html === null) return <div className="viewer-loading">Loading…</div>;
  if (!html) return <div className="viewer-loading viewer-loading--unsupported">No file support for this format.</div>;

  return <iframe className="docx-viewer__frame" srcDoc={html} title={basename(path)} />;
}

function ImageViewer({
  path,
  mime,
  onSelectFile,
  isFullscreen,
  onToggleFullscreen,
}: {
  path: string;
  mime: string;
  onSelectFile?: (p: string) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const src = useBinaryObjectUrl(path, mime);
  const frameRef = useRef<HTMLDivElement>(null);
  const { onKeyDown } = useMediaNavigation(path, onSelectFile);
  useFullscreenKeys(isFullscreen, onToggleFullscreen, onSelectFile, path, frameRef);

  if (!src) return <div className="viewer-loading">Loading…</div>;
  return (
    <div
      ref={frameRef}
      className={`media-viewer image-viewer${isFullscreen ? " media-viewer--fullscreen" : ""}`}
      tabIndex={0}
      onMouseDownCapture={() => frameRef.current?.focus()}
      onKeyDown={isFullscreen ? undefined : onKeyDown}
    >
      <div className="media-viewer__surface">
        <img src={src} alt={basename(path)} className="image-viewer__img" />
      </div>
    </div>
  );
}

function AudioViewer({ path, mime }: { path: string; mime: string }) {
  const src = useVideoSource(path, mime);
  if (!src) return <div className="viewer-loading">Loading…</div>;
  return (
    <div className="audio-viewer">
      <audio controls src={src} className="audio-viewer__audio" />
      <div className="audio-viewer__name">{basename(path)}</div>
    </div>
  );
}

function DocxViewer({ path }: { path: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc) return;
    doc.open();
    doc.write("<!doctype html><html><head></head><body></body></html>");
    doc.close();

    ReadBinaryFile(path).then((base64) => {
      if (cancelled || !frame?.contentDocument || !base64) return;
      const iframeDoc = frame.contentDocument;
      if (!iframeDoc) return;
      const body = iframeDoc.body;
      const head = iframeDoc.head;
      if (!body || !head) return;
      body.innerHTML = "";
      head.innerHTML = "";
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      renderAsync(bytes, body, head, {
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        className: "docx",
        inWrapper: true,
        hideWrapperOnPrint: false,
        trimXmlDeclaration: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
        ignoreLastRenderedPageBreak: true,
        useBase64URL: false,
        renderChanges: false,
        renderComments: false,
        renderAltChunks: true,
        debug: false,
        experimental: false,
      }).catch(() => {
        if (iframeDoc && !cancelled) {
          body.innerHTML = "<div class=\"docx-viewer__empty\">Unable to render document.</div>";
        }
      });
    });

    return () => {
      cancelled = true;
      if (frame?.contentDocument) {
        frame.contentDocument.body.innerHTML = "";
        frame.contentDocument.head.innerHTML = "";
      }
    };
  }, [path]);

  return (
    <div className="docx-viewer">
      <iframe ref={frameRef} className="docx-viewer__frame" title={basename(path)} />
    </div>
  );
}

function NoSupportViewer({ path }: { path: string }) {
  return (
    <div className="viewer-loading viewer-loading--unsupported">
      <div>{basename(path)}</div>
      <div>No file support for this format.</div>
    </div>
  );
}

function VideoViewer({
  path,
  mime,
  onSelectFile,
  isFullscreen,
  onToggleFullscreen,
}: {
  path: string;
  mime: string;
  onSelectFile?: (p: string) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const blobUrl = useVideoSource(path, mime);
  const frameRef = useRef<HTMLDivElement>(null);
  const { onKeyDown } = useMediaNavigation(path, onSelectFile);
  useFullscreenKeys(isFullscreen, onToggleFullscreen, onSelectFile, path, frameRef);

  useEffect(() => {
    setFallbackUsed(false);
    if (mime === "video/x-matroska") {
      setSrc(fileUrl(path));
      return;
    }
    setSrc(blobUrl);
  }, [path, mime, blobUrl]);

  async function handleError() {
    if (mime !== "video/x-matroska" || fallbackUsed) return;
    setFallbackUsed(true);
    const prepared = await PrepareVideoPath(path);
    if (prepared) {
      setSrc(fileUrl(prepared));
    }
  }

  if (!src) return <div className="viewer-loading">Loading…</div>;
  return (
    <div
      ref={frameRef}
      className={`media-viewer video-viewer${isFullscreen ? " media-viewer--fullscreen" : ""}`}
      tabIndex={0}
      onMouseDownCapture={() => frameRef.current?.focus()}
      onKeyDown={isFullscreen ? undefined : onKeyDown}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <div className="media-viewer__surface">
        <video src={src} controls className="video-viewer__video" onError={handleError} />
      </div>
    </div>
  );
}

function TextEditor({ path, onSelectFile, onExitToFolderView, previewMode, onDirtyChange }: { 
  path: string; 
  onSelectFile?: (p: string) => void;
  onExitToFolderView: () => void;
  previewMode: boolean;
  onDirtyChange: (d: boolean) => void;
}) {
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState("");
  const md = isMarkdownPath(path);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dirty = content !== saved;
  
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    ReadTextFile(path).then((text) => {
      setContent(text);
      setSaved(text);
    });
  }, [path]);

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    const ok = await WriteTextFile(path, content);
    if (ok) {
      setSaved(content);
      onDirtyChange(false);
    }
    setSaving(false);
  };

  useEffect(() => {
    const handleGlobalSave = () => save();
    window.addEventListener("tact:save", handleGlobalSave);
    return () => window.removeEventListener("tact:save", handleGlobalSave);
  }, [content, saved, saving]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      save();
      return;
    }
    if (e.key === "Enter" || e.key.toLowerCase() === "q") {
      e.preventDefault();
      onExitToFolderView();
    }
  }

  function handleLinkClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const href = e.currentTarget.getAttribute("href");
    if (!href) return;
    if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")) return;
    e.preventDefault();
    if (onSelectFile) {
      let target = href;
      if (href.startsWith("./")) target = joinPath(dirname(path), href.slice(2));
      else if (!href.startsWith("/")) target = joinPath(dirname(path), href);
      onSelectFile(target);
    }
  }

  return (
    <div className="editor">
      {md && previewMode ? (
        <div className="editor__preview">
          <article className="md-viewer">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ node, ...props }) => (
                  <a {...props} onClick={handleLinkClick} />
                )
              }}
            >
              {content}
            </ReactMarkdown>
          </article>
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          className="editor__textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoFocus
        />
      )}
    </div>
  );
}

export default function FileViewer({ path, onSelectFile, onExitToFolderView, previewMode, onDirtyChange, isFullscreen, onToggleFullscreen }: { 
  path: string; 
  onSelectFile?: (p: string) => void;
  onExitToFolderView: () => void;
  previewMode: boolean;
  onDirtyChange: (d: boolean) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  if (isPdfPath(path)) return <PdfViewer path={path} />;
  if (isDocxPath(path)) return <DocxViewer path={path} />;
  if (isEpubPath(path) || isRtfPath(path)) return <HtmlDocumentViewer path={path} />;
  const imgMime = imageMime(path);
  if (imgMime) return <ImageViewer path={path} mime={imgMime} onSelectFile={onSelectFile} isFullscreen={isFullscreen} onToggleFullscreen={onToggleFullscreen} />;
  const vidMime = videoMime(path);
  if (vidMime) return <VideoViewer path={path} mime={vidMime} onSelectFile={onSelectFile} isFullscreen={isFullscreen} onToggleFullscreen={onToggleFullscreen} />;
  const audMime = audioMime(path);
  if (audMime) return <AudioViewer path={path} mime={audMime} />;
  if (isLicensePath(path) || isMarkdownPath(path) || isTextLikePath(path)) return <TextEditor path={path} onSelectFile={onSelectFile} onExitToFolderView={onExitToFolderView} previewMode={previewMode} onDirtyChange={onDirtyChange} />;
  return <NoSupportViewer path={path} />;
}
