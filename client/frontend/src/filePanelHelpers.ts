import type { CSSProperties } from "react";

export function shouldShowFileEntry(entryName: string, showHidden: boolean, hiddenNames: string[]): boolean {
  if (showHidden) return true;
  if (entryName.startsWith(".")) return false;
  return !hiddenNames.includes(entryName);
}

export function createPeerSignature(name: string, size: number): string {
  return `${normalizeComparableName(name)}::${size}`;
}

export const CHECKSUM_THRESHOLD = 25_000_000;

export function normalizeComparableName(name: string): string {
  return name.normalize("NFC");
}

export function quickChecksumBase64Content(base64Content: string): string {
  const binary = atob(base64Content);
  let a = 1;
  let b = 0;
  for (let i = 0; i < binary.length; i += 1) {
    a = (a + binary.charCodeAt(i)) % 65521;
    b = (b + a) % 65521;
  }
  return `adler32:${((b << 16) | a).toString(16)}`;
}

export function fileRowClassName(isDir: boolean, active: boolean, shared: boolean): string {
  return [
    "file-panel__entry",
    isDir ? "file-panel__entry--dir" : "file-panel__entry--file",
    active ? "file-panel__entry--active" : "",
    shared ? "file-panel__entry--shared" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function entryIndentStyle(depth: number, step = 12, base = 12): CSSProperties {
  return { paddingLeft: `${depth * step + base}px` };
}

export function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  const tagName = element?.tagName?.toLowerCase();
  return tagName === "input" || tagName === "textarea" || Boolean(element?.isContentEditable);
}

export function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const formatWithDigits = (digits: 0 | 1 | 2) => {
    const formatted = digits === 0 ? `${Math.round(value)}` : value.toFixed(digits);
    const digitCount = formatted.replace(/\D/g, "").length;
    return digitCount <= 3 ? formatted : null;
  };

  const formatted = formatWithDigits(2) ?? formatWithDigits(1) ?? formatWithDigits(0);
  if (formatted) return `${formatted} ${units[unit]}`;
  if (unit < units.length - 1) return formatFileSize(value * 1024);
  return `${Math.round(value)} ${units[unit]}`;
}

export function currentVolume(path: string, volumes: Array<{ path: string; name: string }>): { path: string; name: string } {
  const match = volumes
    .filter((volume) => volume.path !== "/")
    .sort((a, b) => b.path.length - a.path.length)
    .find((volume) => path === volume.path || path.startsWith(`${volume.path}/`));
  return match ?? volumes.find((volume) => volume.path === "/") ?? { path: "/", name: "local" };
}
