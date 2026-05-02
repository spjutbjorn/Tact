export interface FileEntry {
  name: string;
  isDir: boolean;
  size: number;
}

export interface VolumeInfo {
  path: string;
  name: string;
}

export interface GitFileStatus {
  path: string;
  status: string;
}

export interface TerminalProfile {
  id: string;
  name: string;
  model: string;
  command: string;
  description: string;
}

export interface TerminalSession {
  id: string;
  profileId: string;
  name: string;
  model: string;
  command: string;
  running: boolean;
  startedAt: string;
}

interface WailsApp {
  GetCwd: () => Promise<string>;
  TerminalProfiles: () => Promise<TerminalProfile[]>;
  TerminalProfileUsage: (profileID: string) => Promise<string>;
  TerminalCount: () => Promise<number>;
  TerminalSessions: () => Promise<TerminalSession[]>;
  LaunchTerminalProfile: (id: string) => Promise<string>;
  LaunchTerminalProfileAt: (id: string, dir: string) => Promise<string>;
  LaunchTerminalProfileAtSized: (id: string, dir: string, cols: number, rows: number) => Promise<string>;
  SendTerminalInput: (sessionID: string, input: string) => Promise<boolean>;
  ResizeTerminalSession: (sessionID: string, cols: number, rows: number) => Promise<boolean>;
  CloseTerminalSession: (sessionID: string) => Promise<boolean>;
  RenameTerminalSession: (sessionID: string, name: string) => Promise<boolean>;
  Navigate: (path: string) => Promise<string>;
  ListDir: (path: string) => Promise<FileEntry[]>;
  DirSize: (path: string) => Promise<number>;
  ListVolumes: () => Promise<VolumeInfo[]>;
  ReadTextFile: (path: string) => Promise<string>;
  ReadDocxFile: (path: string) => Promise<string>;
  ReadPandocHtml: (path: string) => Promise<string>;
  WriteTextFile: (path: string, content: string) => Promise<boolean>;
  ReadBinaryFile: (path: string) => Promise<string>;
  PrepareVideoPath: (path: string) => Promise<string>;
  Rename: (oldPath: string, newPath: string) => Promise<boolean>;
  DeleteFile: (path: string) => Promise<boolean>;
  CopyPath: (sourcePath: string, destinationDir: string) => Promise<boolean>;
  MovePath: (sourcePath: string, destinationDir: string) => Promise<boolean>;
  GitStatus: () => Promise<GitFileStatus[]>;
  GitAdd: (path: string) => Promise<boolean>;
  GitUnstage: (path: string) => Promise<boolean>;
  GitIgnore: (path: string) => Promise<boolean>;
  GitLastCommitMessage: () => Promise<string>;
  GitCommit: (message: string, amend: boolean) => Promise<boolean>;
  GitPush: () => Promise<boolean>;
  GitRevert: (path: string) => Promise<boolean>;
}

function app(): WailsApp | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).go?.main?.App;
}

export const GetCwd = (): Promise<string> =>
  app()?.GetCwd() ?? Promise.resolve("");

export const TerminalProfiles = (): Promise<TerminalProfile[]> =>
  app()?.TerminalProfiles() ?? Promise.resolve([]);

export const TerminalProfileUsage = (profileID: string): Promise<string> =>
  app()?.TerminalProfileUsage(profileID) ?? Promise.resolve("");

export const TerminalCount = (): Promise<number> =>
  app()?.TerminalCount() ?? Promise.resolve(0);

export const TerminalSessions = (): Promise<TerminalSession[]> =>
  app()?.TerminalSessions() ?? Promise.resolve([]);

export const LaunchTerminalProfile = (id: string): Promise<string> =>
  app()?.LaunchTerminalProfile(id) ?? Promise.resolve("");

export const LaunchTerminalProfileAt = (id: string, dir: string): Promise<string> =>
  app()?.LaunchTerminalProfileAt(id, dir) ?? Promise.resolve("");

export const LaunchTerminalProfileAtSized = (id: string, dir: string, cols: number, rows: number): Promise<string> =>
  app()?.LaunchTerminalProfileAtSized(id, dir, cols, rows) ?? Promise.resolve("");

export const SendTerminalInput = (sessionID: string, input: string): Promise<boolean> =>
  app()?.SendTerminalInput(sessionID, input) ?? Promise.resolve(false);

export const ResizeTerminalSession = (sessionID: string, cols: number, rows: number): Promise<boolean> =>
  app()?.ResizeTerminalSession(sessionID, cols, rows) ?? Promise.resolve(false);

export const CloseTerminalSession = (sessionID: string): Promise<boolean> =>
  app()?.CloseTerminalSession(sessionID) ?? Promise.resolve(false);

export const RenameTerminalSession = (sessionID: string, name: string): Promise<boolean> =>
  app()?.RenameTerminalSession(sessionID, name) ?? Promise.resolve(false);

export const Navigate = (path: string): Promise<string> =>
  app()?.Navigate(path) ?? Promise.resolve(path);

export const ListDir = (path: string): Promise<FileEntry[]> =>
  app()?.ListDir(path) ?? Promise.resolve([]);

export const DirSize = (path: string): Promise<number> =>
  app()?.DirSize(path) ?? Promise.resolve(0);

export const ListVolumes = (): Promise<VolumeInfo[]> =>
  app()?.ListVolumes() ?? Promise.resolve([{ path: "/", name: "local" }]);

export const ReadTextFile = (path: string): Promise<string> =>
  app()?.ReadTextFile(path) ?? Promise.resolve("");

export const ReadDocxFile = (path: string): Promise<string> =>
  app()?.ReadDocxFile(path) ?? Promise.resolve("");

export const ReadPandocHtml = (path: string): Promise<string> =>
  app()?.ReadPandocHtml(path) ?? Promise.resolve("");

export const WriteTextFile = (path: string, content: string): Promise<boolean> =>
  app()?.WriteTextFile(path, content) ?? Promise.resolve(false);

export const ReadBinaryFile = (path: string): Promise<string> =>
  app()?.ReadBinaryFile(path) ?? Promise.resolve("");

export const PrepareVideoPath = (path: string): Promise<string> =>
  app()?.PrepareVideoPath(path) ?? Promise.resolve("");

export const Rename = (oldPath: string, newPath: string): Promise<boolean> =>
  app()?.Rename(oldPath, newPath) ?? Promise.resolve(false);

export const DeleteFile = (path: string): Promise<boolean> =>
  app()?.DeleteFile(path) ?? Promise.resolve(false);

export const CopyPath = (sourcePath: string, destinationDir: string): Promise<boolean> =>
  app()?.CopyPath(sourcePath, destinationDir) ?? Promise.resolve(false);

export const MovePath = (sourcePath: string, destinationDir: string): Promise<boolean> =>
  app()?.MovePath(sourcePath, destinationDir) ?? Promise.resolve(false);

export const GitStatus = (): Promise<GitFileStatus[]> =>
  app()?.GitStatus() ?? Promise.resolve([]);

export const GitAdd = (path: string): Promise<boolean> =>
  app()?.GitAdd(path) ?? Promise.resolve(false);

export const GitUnstage = (path: string): Promise<boolean> =>
  app()?.GitUnstage(path) ?? Promise.resolve(false);

export const GitIgnore = (path: string): Promise<boolean> =>
  app()?.GitIgnore(path) ?? Promise.resolve(false);

export const GitLastCommitMessage = (): Promise<string> =>
  app()?.GitLastCommitMessage() ?? Promise.resolve("");

export const GitCommit = (message: string, amend: boolean): Promise<boolean> =>
  app()?.GitCommit(message, amend) ?? Promise.resolve(false);

export const GitPush = (): Promise<boolean> =>
  app()?.GitPush() ?? Promise.resolve(false);

export const GitRevert = (path: string): Promise<boolean> =>
  app()?.GitRevert(path) ?? Promise.resolve(false);

export const BrowserOpenURL = (url: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).runtime?.BrowserOpenURL(url);
};
