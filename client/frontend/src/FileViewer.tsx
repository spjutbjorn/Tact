import { useEffect, useRef, useState, type RefObject } from "react";
import { renderAsync } from "docx-preview";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Editor from "@monaco-editor/react";
import { PreparePdfThumb, PrepareVideoPath, ReadBinaryFile, ReadDocxFile, ReadPandocHtml, ReadTextFile, WriteTextFile, ListDir, WriteThumb } from "./wails";
import { basename, dirname, isMarkdownPath, isJsonPath, joinPath, extname } from "./path";
import { type FileHandlerSettings, getFileHandler, imageMime, videoMime, audioMime } from "./fileHandlers";

function getMonacoLanguage(path: string): string {
  const ext = extname(path).toLowerCase().replace(/^\./, "");
  switch (ext) {
    case "js": return "javascript";
    case "ts": return "typescript";
    case "tsx": return "typescript";
    case "jsx": return "javascript";
    case "json": return "json";
    case "md": return "markdown";
    case "html": return "html";
    case "css": return "css";
    case "scss": return "scss";
    case "less": return "less";
    case "py": return "python";
    case "go": return "go";
    case "rs": return "rust";
    case "cpp": return "cpp";
    case "c": return "c";
    case "h": return "cpp";
    case "java": return "java";
    case "cs": return "csharp";
    case "rb": return "ruby";
    case "php": return "php";
    case "sql": return "sql";
    case "yaml": return "yaml";
    case "yml": return "yaml";
    case "xml": return "xml";
    case "sh": return "shell";
    case "bash": return "shell";
    case "dockerfile": return "dockerfile";
    default: return "plaintext";
  }
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

function thumbCachePath(sourcePath: string): string {
  const slash = sourcePath.lastIndexOf("/");
  const dir = slash >= 0 ? sourcePath.slice(0, slash) : "";
  const name = slash >= 0 ? sourcePath.slice(slash + 1) : sourcePath;
  return `${dir}/.thumbnails/${name}.jpg`;
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
    if (previousUrl.current?.startsWith("blob:")) URL.revokeObjectURL(previousUrl.current);
    previousUrl.current = null;
    setSrc(null);

    if (mime === "video/x-matroska") {
      setSrc(fileUrl(path));
      return;
    }

    ReadBinaryFile(path).then((base64) => {
      if (!base64) return;
      const url = binaryToObjectUrl(base64, mime);
      previousUrl.current = url;
      setSrc(url);
    });

    return () => {
      if (previousUrl.current?.startsWith("blob:")) URL.revokeObjectURL(previousUrl.current);
      previousUrl.current = null;
    };
  }, [path, mime]);

  return src;
}

function useVideoThumbnail(path: string, mime: string): string | null {
  const [poster, setPoster] = useState<string | null>(null);

  useEffect(() => {
    setPoster(null);
    let cancelled = false;
    let blobUrl: string | null = null;
    const cached = thumbCachePath(path);

    ReadBinaryFile(cached).then((b64) => {
      if (cancelled) return;
      if (b64) {
        setPoster(`data:image/jpeg;base64,${b64.replace(/\s/g, "")}`);
        return;
      }

      ReadBinaryFile(path).then((base64) => {
        if (cancelled || !base64) return;
        try {
          blobUrl = binaryToObjectUrl(base64, mime);
        } catch {
          return;
        }

        const video = document.createElement("video");
        video.muted = true;
        video.preload = "metadata";
        video.addEventListener("loadedmetadata", () => {
          if (!cancelled) video.currentTime = video.duration > 0 ? video.duration / 2 : 0;
        });
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
            if (!cancelled) setPoster(dataUrl);
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
      }).catch(() => {
      });
    }).catch(() => {
    });

    return () => {
      cancelled = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrl = null;
      }
    };
  }, [path, mime]);

  return poster;
}

function usePdfThumbnail(path: string): string | null {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    setThumb(null);
    let cancelled = false;

    PreparePdfThumb(path).then((thumbPath) => {
      if (cancelled || !thumbPath) return;
      ReadBinaryFile(thumbPath).then((b64) => {
        if (cancelled || !b64) return;
        setThumb(`data:image/jpeg;base64,${b64.replace(/\s/g, "")}`);
      }).catch(() => {
      });
    }).catch(() => {
    });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return thumb;
}

function PdfViewer({ path }: { path: string }) {
  const url = useBinaryObjectUrl(path, "application/pdf");
  const thumb = usePdfThumbnail(path);

  if (!url && !thumb) return <div className="viewer-loading">Loading…</div>;
  return (
    <div className="pdf-viewer">
      <embed src={url ?? undefined} type="application/pdf" className="pdf-viewer__embed" />
      {thumb && <img src={thumb} alt={basename(path)} className="pdf-viewer__thumb" draggable={false} />}
    </div>
  );
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
  const surfaceRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const { onKeyDown } = useMediaNavigation(path, onSelectFile);
  useFullscreenKeys(isFullscreen, onToggleFullscreen, onSelectFile, path, frameRef);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) < 50) {
        e.preventDefault();
        const delta = -e.deltaY;
        const factor = Math.pow(1.1, delta / 100);
        const nextZoom = Math.min(Math.max(0.1, zoom * factor), 10);

        if (nextZoom !== zoom) {
          const rect = frame.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          const zoomPointX = (mouseX - rect.width / 2 - offset.x) / zoom;
          const zoomPointY = (mouseY - rect.height / 2 - offset.y) / zoom;

          const nextOffsetX = mouseX - rect.width / 2 - zoomPointX * nextZoom;
          const nextOffsetY = mouseY - rect.height / 2 - zoomPointY * nextZoom;

          setZoom(nextZoom);
          setOffset({ x: nextOffsetX, y: nextOffsetY });
        }
      }
    };

    frame.addEventListener("wheel", handleWheel, { passive: false });
    return () => frame.removeEventListener("wheel", handleWheel);
  }, [zoom, offset]);

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [path]);

  useEffect(() => {
    const frame = frameRef.current;
    const surface = surfaceRef.current;
    if (!frame || !surface) return;

    frame.style.cursor = zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default";
    surface.style.setProperty("--image-viewer-transform", `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`);
    surface.style.setProperty("--image-viewer-transition", isDragging ? "none" : "transform 0.1s ease-out");
  }, [zoom, offset.x, offset.y, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1 || e.button === 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  if (!src) return <div className="viewer-loading">Loading…</div>;

  return (
    <div
      ref={frameRef}
      className={`media-viewer image-viewer${isFullscreen ? " media-viewer--fullscreen" : ""}`}
      tabIndex={0}
      onMouseDownCapture={() => frameRef.current?.focus()}
      onKeyDown={isFullscreen ? undefined : onKeyDown}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        ref={surfaceRef}
        className="media-viewer__surface image-viewer__surface"
      >
        <img
          ref={imgRef}
          src={src}
          alt={basename(path)}
          className="image-viewer__img"
          draggable={false}
        />
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

function JsonHighlighter({ content }: { content: string }) {
  const [formatted, setFormatted] = useState("");

  useEffect(() => {
    try {
      const obj = JSON.parse(content);
      const json = JSON.stringify(obj, null, 2);
      
      const highlighted = json.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (match) => {
          let cls = "json-val--num";
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = "json-key";
            } else {
              cls = "json-val--str";
            }
          } else if (/true|false/.test(match)) {
            cls = "json-val--bool";
          } else if (/null/.test(match)) {
            cls = "json-val--null";
          }
          return `<span class="${cls}">${match}</span>`;
        }
      );
      setFormatted(highlighted);
    } catch {
      setFormatted(content);
    }
  }, [content]);

  return (
    <pre 
      className="json-highlighter"
      dangerouslySetInnerHTML={{ __html: formatted }}
    />
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
  const src = useVideoSource(path, mime);
  const poster = useVideoThumbnail(path, mime);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const { onKeyDown } = useMediaNavigation(path, onSelectFile);
  useFullscreenKeys(isFullscreen, onToggleFullscreen, onSelectFile, path, frameRef);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let restarting = false;

    const restartPlayback = (force = false) => {
      if (!isFullscreen || restarting) return;
      restarting = true;
      if (force) {
        video.pause();
      }
      try {
        video.currentTime = 0;
      } catch {
      }
      if (force) {
        try {
          video.load();
        } catch {
        }
      }
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch(() => {});
        playPromise.finally(() => {
          restarting = false;
        });
      } else {
        restarting = false;
      }
    };

    const onEnded = () => restartPlayback(true);
    const onTimeUpdate = () => {
      if (!isFullscreen || video.duration <= 0) return;
      if (video.duration - video.currentTime < 0.5) restartPlayback(true);
    };
    const poll = window.setInterval(() => {
      if (!isFullscreen || video.duration <= 0 || restarting) return;
      if (video.ended || video.currentTime >= video.duration - 0.5) {
        restartPlayback(true);
      }
    }, 500);

    video.addEventListener("ended", onEnded);
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      window.clearInterval(poll);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [isFullscreen, src]);

  if (!src && !poster) return <div className="viewer-loading">Loading…</div>;
  return (
    <div
      ref={frameRef}
      className={`media-viewer video-viewer${isFullscreen ? " media-viewer--fullscreen" : ""}`}
      tabIndex={0}
      onMouseDownCapture={() => frameRef.current?.focus()}
      onKeyDown={isFullscreen ? undefined : onKeyDown}
    >
      <div className="media-viewer__surface video-viewer__surface">
        <video ref={videoRef} src={src ?? undefined} poster={poster ?? undefined} controls preload="metadata" className="video-viewer__video">
          <track kind="captions" label="English captions" src="data:text/vtt,WEBVTT%0A%0A" default />
        </video>
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
  const json = isJsonPath(path);
  const [saving, setSaving] = useState(false);

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

  function handleEditorChange(value: string | undefined) {
    setContent(value ?? "");
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
        <div className="editor__preview editor__preview--markdown">
          <article className="md-viewer">
            <header className="md-viewer__header">
              <span className="md-viewer__title">{basename(path)}</span>
            </header>
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
      ) : json && previewMode ? (
        <div className="editor__preview">
          <JsonHighlighter content={content} />
        </div>
      ) : (
        <Editor
          height="100%"
          language={getMonacoLanguage(path)}
          theme="vs-dark"
          value={content}
          onChange={handleEditorChange}
          onMount={(editor, monaco) => {
            editor.focus();
            editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
              editor.trigger("keyboard", "editor.action.moveLinesUpAction", null);
            });
            editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
              editor.trigger("keyboard", "editor.action.moveLinesDownAction", null);
            });
            editor.onKeyDown((event) => {
              const key = event.browserEvent.key;
              if (key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onExitToFolderView();
                return;
              }
              if ((event.browserEvent.ctrlKey || event.browserEvent.metaKey) && key.toLowerCase() === "s") {
                event.preventDefault();
                event.stopPropagation();
                void save();
              }
            });
          }}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", monospace',
            scrollBeyondLastLine: false,
            wordWrap: "on",
            padding: { top: 20 },
            automaticLayout: true,
          }}
        />
      )}
    </div>
  );
}

export default function FileViewer({ path, onSelectFile, onExitToFolderView, previewMode, onDirtyChange, isFullscreen, onToggleFullscreen, fileHandlerSettings }: {
  path: string;
  onSelectFile?: (p: string) => void;
  onExitToFolderView: () => void;
  previewMode: boolean;
  onDirtyChange: (d: boolean) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  fileHandlerSettings: FileHandlerSettings;
}) {
  const handler = getFileHandler(path, fileHandlerSettings);
  if (handler.type === "pdf") return <PdfViewer path={path} />;
  if (handler.type === "docx") return <DocxViewer path={path} />;
  if (handler.type === "html-doc") return <HtmlDocumentViewer path={path} />;
  if (handler.type === "image") return <ImageViewer path={path} mime={handler.mime ?? imageMime(path) ?? ""} onSelectFile={onSelectFile} isFullscreen={isFullscreen} onToggleFullscreen={onToggleFullscreen} />;
  if (handler.type === "video") return <VideoViewer path={path} mime={handler.mime ?? videoMime(path) ?? ""} onSelectFile={onSelectFile} isFullscreen={isFullscreen} onToggleFullscreen={onToggleFullscreen} />;
  if (handler.type === "audio") return <AudioViewer path={path} mime={handler.mime ?? audioMime(path) ?? ""} />;
  if (handler.type === "text") return <TextEditor path={path} onSelectFile={onSelectFile} onExitToFolderView={onExitToFolderView} previewMode={previewMode} onDirtyChange={onDirtyChange} />;
  return <NoSupportViewer path={path} />;
}
