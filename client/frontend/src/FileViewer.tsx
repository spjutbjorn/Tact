import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ReadBinaryFile, ReadDocxFile, ReadTextFile, WriteTextFile } from "./wails";
import { basename, dirname, isDocxPath, isMarkdownPath, isPdfPath, joinPath } from "./path";

const VIDEO_MIME: Record<string, string> = {
  mp4: "video/mp4", m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  ogv: "video/ogg",
};

function videoMime(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_MIME[ext] ?? null;
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

function binaryToObjectUrl(base64: string, mime: string): string {
  const bin = atob(base64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([buf], { type: mime }));
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

function PdfViewer({ path }: { path: string }) {
  const url = useBinaryObjectUrl(path, "application/pdf");

  if (!url) return <div className="viewer-loading">Loading…</div>;
  return <embed src={url} type="application/pdf" className="pdf-viewer" />;
}

function ImageViewer({ path, mime }: { path: string; mime: string }) {
  const src = useBinaryObjectUrl(path, mime);

  if (!src) return <div className="viewer-loading">Loading…</div>;
  return (
    <div className="image-viewer">
      <img src={src} alt={basename(path)} className="image-viewer__img" />
    </div>
  );
}

function DocxViewer({ path }: { path: string }) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    setContent(null);
    ReadDocxFile(path).then(setContent);
  }, [path]);

  if (content === null) return <div className="viewer-loading">Loading…</div>;

  return (
    <div className="docx-viewer">
      <pre className="docx-viewer__text">{content || "Document is empty."}</pre>
    </div>
  );
}

function VideoViewer({ path, mime }: { path: string; mime: string }) {
  const src = useBinaryObjectUrl(path, mime);

  if (!src) return <div className="viewer-loading">Loading…</div>;
  return (
    <div className="video-viewer">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video src={src} controls className="video-viewer__video" />
    </div>
  );
}

function TextEditor({ path, onSelectFile, previewMode, onDirtyChange }: { 
  path: string; 
  onSelectFile?: (p: string) => void;
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

export default function FileViewer({ path, onSelectFile, previewMode, onDirtyChange }: { 
  path: string; 
  onSelectFile?: (p: string) => void;
  previewMode: boolean;
  onDirtyChange: (d: boolean) => void;
}) {
  if (isPdfPath(path)) return <PdfViewer path={path} />;
  if (isDocxPath(path)) return <DocxViewer path={path} />;
  const imgMime = imageMime(path);
  if (imgMime) return <ImageViewer path={path} mime={imgMime} />;
  const vidMime = videoMime(path);
  if (vidMime) return <VideoViewer path={path} mime={vidMime} />;
  return <TextEditor path={path} onSelectFile={onSelectFile} previewMode={previewMode} onDirtyChange={onDirtyChange} />;
}
