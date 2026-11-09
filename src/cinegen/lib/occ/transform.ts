// [remix] Clip transform (position / scale / rotation) for the CineGen clip model, plus a tracked path.
// The tracker is OpenChatCut's (tracking/analyzeMotion); `transformFromTrack` turns its points into path keys that keep the tracked
// subject at the centre of the frame (their keyframeActions "stabilize" idea). Pure: shared by the viewer and the export composition.
import type { TrackingPoint } from '../../../openchatcut/tracking/types';

export interface ClipTransform {
  /** offset in % of the frame (positive = right) */
  x: number;
  /** offset in % of the frame (positive = down) */
  y: number;
  scale: number;
  /** degrees */
  rotation: number;
  /** tracked path: extra offsets (%) at clip-relative seconds, linearly interpolated */
  path?: Array<{ t: number; x: number; y: number }>;
}
export const IDENTITY_TRANSFORM: ClipTransform = { x: 0, y: 0, scale: 1, rotation: 0 };
export const hasTransform = (t?: ClipTransform | null): t is ClipTransform => !!t && (t.x !== 0 || t.y !== 0 || t.scale !== 1 || t.rotation !== 0 || !!t.path?.length);

export function pathOffsetAt(path: ClipTransform['path'], t: number): { x: number; y: number } {
  if (!path?.length) return { x: 0, y: 0 };
  if (t <= path[0].t) return { x: path[0].x, y: path[0].y };
  const last = path[path.length - 1];
  if (t >= last.t) return { x: last.x, y: last.y };
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]; const b = path[i + 1];
    if (t >= a.t && t <= b.t) { const k = (t - a.t) / Math.max(1e-6, b.t - a.t); return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }; }
  }
  return { x: last.x, y: last.y };
}

/** CSS transform for the clip at `t` seconds from its start (same string in preview and export). */
export function clipTransformCss(tr: ClipTransform | undefined | null, t: number): string | undefined {
  if (!hasTransform(tr)) return undefined;
  const p = pathOffsetAt(tr.path, t);
  return `translate(${tr.x + p.x}%, ${tr.y + p.y}%) rotate(${tr.rotation}deg) scale(${tr.scale})`;
}

/** Path that pins the tracked subject to the frame centre; scale grows just enough to hide the exposed edges. */
export function transformFromTrack(points: TrackingPoint[], basisFps = 30, base: ClipTransform = IDENTITY_TRANSFORM, maxKeys = 90): ClipTransform {
  const ok = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)).sort((a, b) => a.frame - b.frame);
  const step = Math.max(1, Math.ceil(ok.length / maxKeys));
  const picked = ok.filter((_, i) => i % step === 0 || i === ok.length - 1);
  const path = picked.map((p) => ({ t: p.frame / basisFps, x: (0.5 - p.x) * 100, y: (0.5 - p.y) * 100 }));
  const reach = path.reduce((m, k) => Math.max(m, Math.abs(k.x), Math.abs(k.y)), 0) / 100; // fraction of the frame
  return { ...base, scale: Math.min(3, Math.max(base.scale, 1 + 2 * reach)), path };
}
