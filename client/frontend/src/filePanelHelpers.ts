import type { CSSProperties } from "react";

export function shouldShowFileEntry(entryName: string, showHidden: boolean, hiddenNames: string[]): boolean {
  if (showHidden) return true;
  if (entryName.startsWith(".")) return false;
  return !hiddenNames.includes(entryName);
}

export function createPeerSignature(name: string, size: number): string {
  return `${name}::${size}`;
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

export function entryIndentStyle(depth: number): CSSProperties {
  return { paddingLeft: `${depth * 12 + 12}px` };
}

export function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  const tagName = element?.tagName?.toLowerCase();
  return tagName === "input" || tagName === "textarea" || Boolean(element?.isContentEditable);
}
