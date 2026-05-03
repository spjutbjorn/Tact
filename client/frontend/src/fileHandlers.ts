import { isDocxPath, isEpubPath, isLicensePath, isMarkdownPath, isPdfPath, isRtfPath } from "./path";

export type FileHandlerType = "pdf" | "docx" | "html-doc" | "image" | "video" | "audio" | "text" | "none";

export interface FileHandlerResult {
  type: FileHandlerType;
  mime?: string;
}

export interface FileHandlerSettings {
  version: number;
  textExtensions: string[];
  hiddenNames: string[];
  highlightSharedFiles: boolean;
}

const CURRENT_VERSION = 5;

export const DEFAULT_HIDDEN_NAMES: readonly string[] = [
  "node_modules",
  "__pycache__",
  "$RECYCLE.BIN",
  "$Recycle.Bin",
  "System Volume Information",
  "RECYCLER",
  "lost+found",
  "Thumbs.db",
  "desktop.ini",
  "Volumes",
  // Windows
  "Windows",
  "Program Files",
  "Program Files (x86)",
  "PerfLogs",
  "Recovery",
  "Boot",
  // macOS / Unix root
  "Library",
  "System",
  "bin",
  "boot",
  "dev",
  "etc",
  "lib",
  "lib64",
  "sbin",
  "srv",
  "sys",
  "var",
  "usr",
  "opt",
  "proc"
];

export const VIDEO_MIME: Record<string, string> = {
  mp4: "video/mp4", m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  ogv: "video/ogg",
};

export const AUDIO_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
  amr: "audio/amr",
};

export const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml",
  bmp: "image/bmp", ico: "image/x-icon",
  tif: "image/tiff", tiff: "image/tiff",
  avif: "image/avif",
};

export const DEFAULT_TEXT_EXTENSIONS: readonly string[] = [
  // Plain text & docs
  "txt", "text", "log",
  "md", "markdown", "mdx", "rst", "adoc", "asciidoc", "org",
  "tex", "latex", "bib", "bibtex", "rmd", "qmd",
  // Data & config
  "json", "jsonc", "jsonl", "ndjson",
  "yaml", "yml", "toml", "ini", "conf", "cfg", "rc", "env", "properties", "prop",
  "xml", "csv", "tsv",
  "sql", "graphql", "gql", "proto", "cue", "rego",
  "diff", "patch", "lock",
  // Shell & scripts
  "sh", "bash", "zsh", "fish", "ps1", "psm1",
  // Python & Ruby
  "py", "pyi", "rb", "php", "pl", "pm",
  // Go & Rust
  "go", "rs",
  // JavaScript & TypeScript
  "js", "jsx", "ts", "tsx", "cjs", "mjs", "cts", "mts", "flow",
  // C family
  "c", "h", "cpp", "hpp", "cc", "hh", "cxx", "hxx",
  // JVM
  "java", "kt", "kts", "scala", "groovy", "gradle",
  // .NET
  "cs", "fs", "fsx",
  // Other compiled
  "swift", "nim", "dart", "hs",
  // Functional & BEAM
  "lua", "clj", "cljs", "edn", "erl", "ex", "exs",
  // Scientific
  "r", "jl", "m", "mm", "matlab",
  // Web & markup
  "html", "htm", "css", "scss", "sass", "less", "styl", "xhtml", "vue", "svelte",
  "xaml", "xsl", "xslt", "plist",
  // Build & project files
  "make", "mk", "cmake", "cabal", "nix", "mod", "sum",
  "vcxproj", "csproj", "sln", "iml",
  // Misc
  "mdc", "manifest", "version", "work", "applescript", "bnf",
  "md5", "map", "vhd", "vhdl", "wat",
];

const SETTINGS_KEY = "tact.fileHandlerSettings";

export function loadFileHandlerSettings(): FileHandlerSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FileHandlerSettings>;
      const settings: FileHandlerSettings = {
        version: parsed.version ?? 0,
        textExtensions: Array.isArray(parsed.textExtensions) ? parsed.textExtensions : [...DEFAULT_TEXT_EXTENSIONS],
        hiddenNames: Array.isArray(parsed.hiddenNames) ? parsed.hiddenNames : [...DEFAULT_HIDDEN_NAMES],
        highlightSharedFiles: parsed.highlightSharedFiles ?? true,
      };

      // Migration to version 5: Add shared-file highlighting.
      if (settings.version < 5) {
        const current = new Set(settings.hiddenNames);
        
        // Add all current defaults (including Volumes)
        DEFAULT_HIDDEN_NAMES.forEach(name => current.add(name));
        
        // Ensure Applications is visible if it was explicitly removed in v3
        current.delete("Applications");
        
        settings.hiddenNames = Array.from(current).sort();
        settings.highlightSharedFiles = parsed.highlightSharedFiles ?? true;
        settings.version = 5;
        saveFileHandlerSettings(settings);
      }

      return settings;
    }
  } catch {
    // ignore
  }
  return { 
    version: CURRENT_VERSION,
    textExtensions: [...DEFAULT_TEXT_EXTENSIONS],
    hiddenNames: [...DEFAULT_HIDDEN_NAMES],
    highlightSharedFiles: true,
  };
}

export function saveFileHandlerSettings(settings: FileHandlerSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function fileExt(path: string): string {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function fileName(path: string): string {
  return path.split("/").pop() ?? "";
}

export function imageMime(path: string): string | null {
  return IMAGE_MIME[fileExt(path)] ?? null;
}

export function videoMime(path: string): string | null {
  return VIDEO_MIME[fileExt(path)] ?? null;
}

export function audioMime(path: string): string | null {
  return AUDIO_MIME[fileExt(path)] ?? null;
}

export function getFileHandler(path: string, settings: FileHandlerSettings): FileHandlerResult {
  if (isPdfPath(path)) return { type: "pdf" };
  if (isDocxPath(path)) return { type: "docx" };
  if (isEpubPath(path) || isRtfPath(path)) return { type: "html-doc" };

  const imgM = imageMime(path);
  if (imgM) return { type: "image", mime: imgM };

  const vidM = videoMime(path);
  if (vidM) return { type: "video", mime: vidM };

  const audM = audioMime(path);
  if (audM) return { type: "audio", mime: audM };

  if (isLicensePath(path) || isMarkdownPath(path)) return { type: "text" };

  const name = fileName(path);
  const ext = fileExt(path);
  if (name === ".gitignore" || (ext !== "" && settings.textExtensions.includes(ext))) {
    return { type: "text" };
  }

  return { type: "none" };
}
