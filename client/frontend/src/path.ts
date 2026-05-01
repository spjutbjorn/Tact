export function basename(path: string): string {
  const normalized = path.endsWith("::") ? path.slice(0, -2) : path;
  const virtualParts = normalized.split("::");
  const inner = virtualParts.length > 1 ? virtualParts[1] : virtualParts[0];
  const leaf = inner.split("/").pop() ?? inner;
  return leaf || virtualParts[0];
}

export function dirname(path: string): string {
  if (path.endsWith("::")) {
    const archive = path.slice(0, -2);
    const outer = archive.split("/").slice(0, -1).join("/");
    return outer ? `${outer}/` : "/";
  }

  const virtualParts = path.split("::");
  if (virtualParts.length > 1) {
    const archive = virtualParts[0];
    const inner = virtualParts[1];
    const innerParts = inner.split("/").filter(Boolean);
    innerParts.pop();
    const nextInner = innerParts.join("/");
    return nextInner ? `${archive}::${nextInner}` : `${archive}::`;
  }

  const parts = path.split("/");
  parts.pop();
  const parent = parts.join("/");
  return parent || "/";
}

export function joinPath(parent: string, child: string): string {
  if (parent.endsWith("::")) return `${parent}${child}`;
  if (parent.includes("::")) return `${parent}/${child}`;
  if (parent === "/") return `/${child}`;
  const normalizedParent = parent.replace(/\/$/, "");
  return normalizedParent ? `${normalizedParent}/${child}` : child;
}

export function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown)$/i.test(path);
}

export function isPdfPath(path: string): boolean {
  return /\.pdf$/i.test(path);
}

export function isDocxPath(path: string): boolean {
  return /\.docx$/i.test(path);
}

export function isZipArchivePath(path: string): boolean {
  return /\.zip$/i.test(path);
}

export function isVirtualZipPath(path: string): boolean {
  return path.includes("::");
}
