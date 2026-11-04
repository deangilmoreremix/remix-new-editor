/** Pure upload rules (no store/React), shared by uploads.ts and unit tests. */
export type MediaKind = "video" | "image" | "audio";

const MB = 1024 * 1024;
// Mirrors SmartVid's src/lib/editor/uploadLimits.js (the parent validates again).
export const UPLOAD_LIMITS: Record<MediaKind, number> = { image: 10 * MB, video: 50 * MB, audio: 10 * MB };
const EXT: Record<MediaKind, string[]> = {
  image: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif", "heic"],
  video: ["mp4", "mov", "webm", "m4v", "mkv", "ogv", "3gp"],
  audio: ["mp3", "wav", "aac", "ogg", "flac", "m4a", "opus", "aiff", "aif"],
};
export const ACCEPT = "video/*,image/*,audio/*";

export const kindOfFile = (f: { type?: string; name?: string }): MediaKind | null => {
  const t = (f.type || "").toLowerCase();
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("audio/")) return "audio";
  const ext = (f.name || "").split(".").pop()?.toLowerCase() || "";
  return (Object.keys(EXT) as MediaKind[]).find((k) => EXT[k].includes(ext)) ?? null;
};

export const checkFile = (f: File): { kind: MediaKind } | { error: string } => {
  const kind = kindOfFile(f);
  if (!kind) return { error: `"${f.name}" isn't a video, image or audio file.` };
  if (f.size > UPLOAD_LIMITS[kind]) {
    return { error: `"${f.name}" is too large (max ${UPLOAD_LIMITS[kind] / MB} MB for ${kind}).` };
  }
  return { kind };
};
