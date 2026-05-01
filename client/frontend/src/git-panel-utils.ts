import type { GitFileStatus } from "./wails";

export interface GitNode {
  name: string;
  path: string;
  isDir: boolean;
  statusChar?: string;
  children: GitNode[];
}

export interface GitFileEntry {
  path: string;
  statusChar: string;
}

export function buildGitTree(files: GitFileEntry[]): GitNode[] {
  const root: GitNode = { name: "", path: "", isDir: true, children: [] };
  const map = new Map<string, GitNode>([["", root]]);

  for (const file of files) {
    const parts = file.path.split("/");
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${name}` : name;
      const isLast = i === parts.length - 1;

      if (map.has(currentPath)) continue;

      const node: GitNode = {
        name,
        path: currentPath,
        isDir: !isLast,
        statusChar: isLast ? file.statusChar : undefined,
        children: [],
      };

      map.get(parentPath)!.children.push(node);
      map.set(currentPath, node);
    }
  }

  const sortNodes = (nodes: GitNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(root.children);
  return root.children;
}

export function splitGitStatuses(statuses: GitFileStatus[]): {
  stagedFiles: GitFileEntry[];
  unstagedFiles: GitFileEntry[];
} {
  const stagedFiles = statuses
    .filter((status) => status.status[0] !== " " && status.status[0] !== "?")
    .map((status) => ({ path: status.path, statusChar: status.status[0] }));

  const unstagedFiles = statuses
    .filter((status) => status.status[1] !== " " || status.status[0] === "?")
    .map((status) => ({
      path: status.path,
      statusChar: status.status[0] === "?" ? "?" : status.status[1],
    }));

  return { stagedFiles, unstagedFiles };
}

export function getGitStatusColor(statusChar: string): string {
  if (statusChar === "M") return "#4ade80";
  if (statusChar === "?") return "#60a5fa";
  if (statusChar === "D") return "#f87171";
  if (statusChar === "A") return "#fbbf24";
  return "#9ca3af";
}
