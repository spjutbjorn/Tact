export const PANEL_WIDTH_KEY = "tact.panelWidth";
export const DISABLED_PROFILES_KEY = "tact.disabledProfiles";
export const DEFAULT_PANEL_WIDTH = 220;

export function loadPanelWidth(): number {
  const saved = localStorage.getItem(PANEL_WIDTH_KEY);
  if (!saved) return DEFAULT_PANEL_WIDTH;

  const value = Number.parseInt(saved, 10);
  if (!Number.isFinite(value)) return DEFAULT_PANEL_WIDTH;

  return Math.max(120, Math.min(600, value));
}

export function loadDisabledProfiles(): string[] {
  const saved = localStorage.getItem(DISABLED_PROFILES_KEY);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pickActiveSessionId(current: string | null, sessions: { id: string; running?: boolean }[]): string | null {
  if (current && sessions.some((session) => session.id === current && session.running)) {
    return current;
  }

  return sessions.find((session) => session.running)?.id ?? sessions[0]?.id ?? null;
}

export function isMediaPath(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp|ico|tif|tiff|avif|mp4|m4v|webm|mov|avi|mkv|ogv)$/i.test(path);
}
