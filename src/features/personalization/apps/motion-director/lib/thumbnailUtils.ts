import type { SessionData } from "../types";

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180' viewBox='0 0 320 180'%3E%3Crect fill='%230b0b0b' width='320' height='180'/%3E%3Cpath stroke='%23ffffff1a' stroke-width='2' d='M100 60 220 60 220 120 100 120 Z'/%3E%3Ccircle cx='160' cy='90' r='6' fill='%23ffffff2a'/%3E%3C/svg%3E";

export const getPosterFrameUrl = (session: SessionData): string => {
  const s = session as unknown as Record<string, unknown> & { outputs?: { url?: string }[] };
  const url =
    s.videoOutputUrl ??
    s.outputs?.[0]?.url ??
    s.videoUrl ??
    s.thumbnailUrl;
  return typeof url === "string" && url.length > 0 ? url : PLACEHOLDER;
};

export const formatTime = (seconds: number): string => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};
