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
  /** crop as fractions of the frame (OpenChatCut FlexCrop): cut first, then transformed with the clip — used by layouts */
  crop?: { left: number; top: number; right: number; bottom: number };
  /** keyframes (clip-relative seconds): when present they drive x/y/scale/rotation, linearly interpolated */
  keys?: Array<{ t: number; x: number; y: number; scale: number; rotation: number }>;
  /** tracked path: extra offsets (%) at clip-relative seconds, linearly interpolated */
  path?: Array<{ t: number; x: number; y: number }>;
}
export const IDENTITY_TRANSFORM: ClipTransform = { x: 0, y: 0, scale: 1, rotation: 0 };
export const hasTransform = (t?: ClipTransform | null): t is ClipTransform => !!t && (t.x !== 0 || t.y !== 0 || t.scale !== 1 || t.rotation !== 0 || !!t.crop || !!t.path?.length || !!t.keys?.length);

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
export function transformValuesAt(tr: ClipTransform, t: number): { x: number; y: number; scale: number; rotation: number } {
  const k = tr.keys;
  if (!k?.length) return { x: tr.x, y: tr.y, scale: tr.scale, rotation: tr.rotation };
  const s = [...k].sort((a, b) => a.t - b.t);
  if (t <= s[0].t) return s[0];
  if (t >= s[s.length - 1].t) return s[s.length - 1];
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i]; const b = s[i + 1];
    if (t >= a.t && t <= b.t) { const f = (t - a.t) / Math.max(1e-6, b.t - a.t); const L = (p: number, q: number) => p + (q - p) * f; return { x: L(a.x, b.x), y: L(a.y, b.y), scale: L(a.scale, b.scale), rotation: L(a.rotation, b.rotation) }; }
  }
  return s[s.length - 1];
}
export function upsertKey(tr: ClipTransform, t: number, v: { x: number; y: number; scale: number; rotation: number }): ClipTransform {
  const keys = (tr.keys ?? []).filter((k) => Math.abs(k.t - t) > 0.02);
  return { ...tr, keys: [...keys, { t, ...v }].sort((a, b) => a.t - b.t) };
}

export function clipTransformCss(tr: ClipTransform | undefined | null, t: number): string | undefined {
  if (!hasTransform(tr)) return undefined;
  const p = pathOffsetAt(tr.path, t);
  const v = transformValuesAt(tr, t);
  return `translate(${v.x + p.x}%, ${v.y + p.y}%) rotate(${v.rotation}deg) scale(${v.scale})`;
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

/** CSS clip-path for the crop (applied on the same element as the transform, so it is cut first and then moved/scaled). */
export function clipTransformClipPath(tr: ClipTransform | undefined | null): string | undefined {
  const c = tr?.crop;
  if (!c) return undefined;
  const p = (v: number) => `${(Math.max(0, v) * 100).toFixed(3)}%`;
  return `inset(${p(c.top)} ${p(c.right)} ${p(c.bottom)} ${p(c.left)})`;
}
