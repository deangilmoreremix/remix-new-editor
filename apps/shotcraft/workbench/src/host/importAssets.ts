import type { ClipData, ProjectData, TrackData } from "../types";
import { uid } from "../types";

/** A SmartVid library asset handed to the workbench by the host app. */
export interface HostAsset {
  url: string;
  kind: "video" | "image" | "audio";
  name?: string;
  /** Media length in seconds (video/audio). Images default to 3s. */
  durationSec?: number;
  width?: number;
  height?: number;
}

const FPS = 30;
const DEFAULT_IMAGE_SEC = 3;
const DEFAULT_MEDIA_SEC = 5;

const baseClip = (): Omit<ClipData, "id" | "cardId" | "start" | "duration" | "props"> => ({
  inOffset: 0,
  speed: 1,
  opacity: 1,
  scale: 1,
  x: 0,
  y: 0,
});

export const isHostAsset = (v: unknown): v is HostAsset => {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.url === "string" &&
    /^(https?:|data:|blob:|\/)/i.test(a.url) &&
    (a.kind === "video" || a.kind === "image" || a.kind === "audio")
  );
};

const framesOf = (a: HostAsset, fps: number) => {
  const sec =
    a.kind === "image"
      ? DEFAULT_IMAGE_SEC
      : a.durationSec && Number.isFinite(a.durationSec) && a.durationSec > 0
        ? a.durationSec
        : DEFAULT_MEDIA_SEC;
  return Math.max(2, Math.round(sec * fps));
};

/** Visual assets are laid end-to-end on a "Clips" track; audio goes on its own track.
 *  Canvas size follows the first visual asset that reports dimensions (default 1920×1080). */
export const projectFromAssets = (assets: HostAsset[], name = "SmartVid edit"): ProjectData => {
  const visuals = assets.filter((a) => a.kind !== "audio");
  const audios = assets.filter((a) => a.kind === "audio");
  const sized = visuals.find((a) => a.width && a.height);
  const width = sized?.width ?? 1920;
  const height = sized?.height ?? 1080;

  let cursor = 0;
  const visualClips: ClipData[] = visuals.map((a) => {
    const duration = framesOf(a, FPS);
    const clip: ClipData = {
      ...baseClip(),
      id: uid("clip"),
      cardId: a.kind === "video" ? "video-clip" : "image-clip",
      start: cursor,
      duration,
      props: a.kind === "video" ? { file: a.url, fit: "contain" } : { file: a.url, fit: "contain" },
      label: a.name,
    };
    cursor += duration;
    return clip;
  });

  let audioCursor = 0;
  const audioClips: ClipData[] = audios.map((a) => {
    const duration = framesOf(a, FPS);
    const clip: ClipData = {
      ...baseClip(),
      id: uid("clip"),
      cardId: "audio-clip",
      start: audioCursor,
      duration,
      props: { file: a.url, volume: 1 },
      label: a.name,
    };
    audioCursor += duration;
    return clip;
  });

  const tracks: TrackData[] = [
    { id: uid("track"), name: "Captions", clips: [] },
    { id: uid("track"), name: "Clips", clips: visualClips },
  ];
  if (audioClips.length) tracks.push({ id: uid("track"), name: "Audio", clips: audioClips });

  return { name, fps: FPS, width, height, background: "#000000", tracks };
};

/** Append assets after the current end of the project's main visual track. */
export const appendAssets = (project: ProjectData, assets: HostAsset[]): ProjectData => {
  const incoming = projectFromAssets(assets, project.name);
  const next: ProjectData = JSON.parse(JSON.stringify(project));
  const end = Math.max(0, ...next.tracks.flatMap((t) => t.clips.map((c) => c.start + c.duration)));
  for (const t of incoming.tracks) {
    if (!t.clips.length) continue;
    const shifted = t.clips.map((c) => ({ ...c, start: c.start + end }));
    const target = next.tracks.find((x) => x.name === t.name);
    if (target) target.clips.push(...shifted);
    else next.tracks.push({ ...t, clips: shifted });
  }
  return next;
};
