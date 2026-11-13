// [remix] Stage 2: ONE keyframe model for CineGen clips (Clip.anim), shared by the editor preview, the inspector UI and the Remotion export.
//
// Properties (id -> value): x, y (% of the frame), scale, rotation (deg), opacity (0..1), cropLeft/Top/Right/Bottom (fractions of the frame),
// and effect parameters `fx:<index in clip.fx>:<param key>`. Keys are { t, v, ease } with t = seconds from the clip start (the same clock as
// the older Clip.keyframes) and `ease` = the easing of the segment that STARTS at the key (preset | cubic-bezier | spring).
// Procedural motion modifiers (drift, sway, breathing, spin, shake: ./modifiers.ts) are layered on top.
//
// Backward compatibility: nothing is rewritten on load. The evaluator reads, per property, anim keys first, then the older stores
// (transform.keys, transform static values, Clip.keyframes opacity), so projects saved before Stage 2 render exactly as before.
// `unifyLegacy` moves the older stores into Clip.anim when the user starts editing with the new tools.
//
// Pure: no DOM, no clock, no random. The same function runs in the preview (PlaybackEngine) and in the composition (export).
import { applyEase, normalizeEase, type EaseSpec } from './easing';
import { evalModifiers, type MotionModifier, normalizeModifier, type ModifierContribution, NO_CONTRIBUTION } from './modifiers';
import { IDENTITY_TRANSFORM, clipTransformCss, clipTransformClipPath, hasTransform, pathOffsetAt, transformValuesAt, type ClipTransform } from '../../occ/transform';
import type { Keyframe as OccKeyframe } from '../../../../openchatcut/editor/clipTypes';

export interface AnimKey { t: number; v: number; ease?: EaseSpec }
export interface ClipAnim {
  keys?: Record<string, AnimKey[]>;
  modifiers?: MotionModifier[];
  /** seconds added to the clip time for modifiers (set when a clip is split, so the motion continues instead of restarting) */
  tOffset?: number;
}

export interface AnimPropDef { id: string; label: string; min: number; max: number; step: number; default: number; unit: string }
export const ANIM_PROPS: AnimPropDef[] = [
  { id: 'x', label: 'Position X', min: -100, max: 100, step: 0.5, default: 0, unit: '%' },
  { id: 'y', label: 'Position Y', min: -100, max: 100, step: 0.5, default: 0, unit: '%' },
  { id: 'scale', label: 'Scale', min: 0.1, max: 4, step: 0.01, default: 1, unit: '×' },
  { id: 'rotation', label: 'Rotation', min: -180, max: 180, step: 1, default: 0, unit: '°' },
  { id: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.01, default: 1, unit: '' },
  { id: 'cropLeft', label: 'Crop left', min: 0, max: 0.95, step: 0.005, default: 0, unit: '' },
  { id: 'cropTop', label: 'Crop top', min: 0, max: 0.95, step: 0.005, default: 0, unit: '' },
  { id: 'cropRight', label: 'Crop right', min: 0, max: 0.95, step: 0.005, default: 0, unit: '' },
  { id: 'cropBottom', label: 'Crop bottom', min: 0, max: 0.95, step: 0.005, default: 0, unit: '' },
];
const PROP_BY_ID = new Map(ANIM_PROPS.map((p) => [p.id, p]));
export const propDef = (id: string): AnimPropDef | undefined => PROP_BY_ID.get(id);
export const fxPropId = (index: number, key: string) => `fx:${index}:${key}`;
export const parseFxPropId = (id: string): { index: number; key: string } | null => {
  const m = /^fx:(\d+):(.+)$/.exec(id);
  return m ? { index: Number(m[1]), key: m[2] } : null;
};
const CROP_EDGE: Record<string, 'left' | 'top' | 'right' | 'bottom'> = { cropLeft: 'left', cropTop: 'top', cropRight: 'right', cropBottom: 'bottom' };

const EPS = 1e-6;
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

/** Sort and sanitise a key list (loaded or hand-edited data). */
export function cleanKeys(list: AnimKey[] | undefined): AnimKey[] {
  return (list ?? []).filter((k) => k && Number.isFinite(k.t) && Number.isFinite(k.v)).map((k) => ({ t: k.t, v: k.v, ...(k.ease !== undefined ? { ease: normalizeEase(k.ease) } : {}) })).sort((a, b) => a.t - b.t);
}

/**
 * Value of one key list at clip time t. Holds the first / last value outside the span; between two keys the left key's easing applies.
 * (Adapted from FreeCut interpolatePropertyValue, MIT, commit 5ceeeb388eef5423640b7db157706274bf1b8165.) Empty list -> fallback.
 */
export function sampleKeys(keys: AnimKey[] | undefined, t: number, fallback: number): number {
  if (!keys || !keys.length) return fallback;
  const k = keys.every((x, i) => i === 0 || keys[i - 1].t <= x.t) ? keys : cleanKeys(keys);
  if (k.length === 1 || t <= k[0].t) return k[0].v;
  const last = k[k.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < k.length - 1; i++) {
    const a = k[i]; const b = k[i + 1];
    if (t >= a.t && t < b.t) {
      const span = b.t - a.t;
      if (span <= EPS) return a.v;
      if (a.ease === 'hold') return a.v;
      return a.v + (b.v - a.v) * applyEase((t - a.t) / span, a.ease);
    }
  }
  return last.v;
}

export const hasAnim = (a: ClipAnim | undefined | null): a is ClipAnim => !!a && (!!a.modifiers?.some((m) => m.enabled) || Object.values(a.keys ?? {}).some((l) => l?.length));
export const animKeyCount = (a: ClipAnim | undefined): number => Object.values(a?.keys ?? {}).reduce((n, l) => n + (l?.length ?? 0), 0);

export interface PoseSource { transform?: ClipTransform | null; anim?: ClipAnim | null; opacity?: number; keyframes?: Array<{ time: number; property: string; value: number }> }

/** Legacy linear opacity keys (Clip.keyframes). */
function legacyOpacity(src: PoseSource, t: number): number {
  const kfs = (src.keyframes ?? []).filter((k) => k.property === 'opacity').sort((a, b) => a.time - b.time);
  if (!kfs.length) return src.opacity ?? 1;
  if (kfs.length === 1 || t <= kfs[0].time) return kfs[0].value;
  const last = kfs[kfs.length - 1];
  if (t >= last.time) return last.value;
  for (let i = 0; i < kfs.length - 1; i++) if (t >= kfs[i].time && t <= kfs[i + 1].time) return kfs[i].value + ((t - kfs[i].time) / (kfs[i + 1].time - kfs[i].time)) * (kfs[i + 1].value - kfs[i].value);
  return last.value;
}

const modifiersAt = (anim: ClipAnim | null | undefined, t: number): ModifierContribution => (anim?.modifiers?.length ? evalModifiers(anim.modifiers, t + (anim.tOffset ?? 0)) : NO_CONTRIBUTION);

/** Opacity of the clip at clip time t (anim keys, else older keys / static value), plus any breathing contribution. Fades and transitions are applied elsewhere. */
export function poseOpacity(src: PoseSource, t: number): number {
  const keys = src.anim?.keys?.opacity;
  const base = keys?.length ? sampleKeys(keys, t, src.opacity ?? 1) : legacyOpacity(src, t);
  const d = modifiersAt(src.anim, t).dOpacity;
  return d === 0 ? base : Math.max(0, Math.min(1, base + d));
}

export interface Pose { x: number; y: number; scale: number; rotation: number; crop?: { left: number; top: number; right: number; bottom: number } }

/** Transform values at clip time t: per property anim key > older transform key / static value, then motion modifiers on top. */
export function poseAt(src: PoseSource, t: number): Pose {
  const tr = src.transform ?? IDENTITY_TRANSFORM;
  const v = transformValuesAt(tr, t);
  const k = src.anim?.keys;
  const pick = (id: 'x' | 'y' | 'scale' | 'rotation') => (k?.[id]?.length ? sampleKeys(k[id], t, v[id]) : v[id]);
  const m = modifiersAt(src.anim, t);
  const pose: Pose = { x: pick('x') + m.dx, y: pick('y') + m.dy, scale: Math.max(0, pick('scale') * m.scale), rotation: pick('rotation') + m.dRotation };
  const cropKeyed = Object.keys(CROP_EDGE).some((id) => k?.[id]?.length);
  if (tr.crop || cropKeyed) {
    const base = { left: tr.crop?.left ?? 0, top: tr.crop?.top ?? 0, right: tr.crop?.right ?? 0, bottom: tr.crop?.bottom ?? 0 };
    for (const [id, edge] of Object.entries(CROP_EDGE)) if (k?.[id]?.length) base[edge] = Math.max(0, Math.min(0.95, sampleKeys(k[id], t, base[edge])));
    pose.crop = base;
  }
  return pose;
}

const cropPath = (c: { left: number; top: number; right: number; bottom: number }) => {
  const p = (v: number) => `${(Math.max(0, v) * 100).toFixed(3)}%`;
  return `inset(${p(c.top)} ${p(c.right)} ${p(c.bottom)} ${p(c.left)})`;
};

/**
 * CSS transform + clip-path of a clip at clip time t (preview element and export layer use this one function).
 * A clip with no anim goes through the existing clipTransformCss unchanged, so older projects render byte-identically.
 */
export function clipPoseCss(src: PoseSource, t: number): { transform?: string; clipPath?: string } {
  if (!hasAnim(src.anim)) return { transform: clipTransformCss(src.transform, t), clipPath: clipTransformClipPath(src.transform) };
  const p = poseAt(src, t);
  const path = pathOffsetAt(src.transform?.path, t);
  const transform = `translate(${r4(p.x + path.x)}%, ${r4(p.y + path.y)}%) rotate(${r4(p.rotation)}deg) scale(${r4(p.scale)})`;
  return { transform, clipPath: p.crop ? cropPath(p.crop) : clipTransformClipPath(src.transform) };
}

// ---- effect parameters ------------------------------------------------------------------------------------------------------------

export const FX_KEY_BASIS_FPS = 30;
/** Anim keys of effect #index as OpenChatCut keyframes (frame at 30 fps from the clip start), so the existing GL fx sampler runs them in preview and export. */
export function animFxKeys(anim: ClipAnim | undefined | null, index: number): Record<string, OccKeyframe[]> | undefined {
  if (!anim?.keys) return undefined;
  let out: Record<string, OccKeyframe[]> | undefined;
  for (const [id, raw] of Object.entries(anim.keys)) {
    const p = parseFxPropId(id);
    if (!p || p.index !== index || !raw?.length) continue;
    const list = cleanKeys(raw);
    const frames: OccKeyframe[] = [];
    list.forEach((k, i) => {
      const next = list[i + 1];
      const e = k.ease ?? 'linear';
      const frame = k.t * FX_KEY_BASIS_FPS;
      if (!next || e === 'linear') { frames.push({ frame, value: k.v }); return; }
      if (typeof e === 'object' && 'bezier' in e) { frames.push({ frame, value: k.v, easing: e.bezier }); return; }
      // presets / spring / hold are not OpenChatCut easings: bake the segment at 30 fps (hold = one-frame step)
      const n = Math.max(1, Math.ceil((next.t - k.t) * FX_KEY_BASIS_FPS));
      for (let s = 0; s < n; s++) { const tt = k.t + ((next.t - k.t) * s) / n; frames.push({ frame: tt * FX_KEY_BASIS_FPS, value: r4(sampleKeys(list, tt, k.v)) }); }
      if (e === 'hold') frames.push({ frame: next.t * FX_KEY_BASIS_FPS - 1, value: k.v });
    });
    (out ??= {})[p.key] = frames.sort((a, b) => a.frame - b.frame);
  }
  return out;
}

// ---- editing (pure, return new objects) ------------------------------------------------------------------------------------------

const KEY_EPS = 0.02;
export function setKey(anim: ClipAnim | undefined, prop: string, t: number, v: number, ease?: EaseSpec): ClipAnim {
  const list = cleanKeys(anim?.keys?.[prop]);
  const i = list.findIndex((k) => Math.abs(k.t - t) <= KEY_EPS);
  const key: AnimKey = { t: r4(Math.max(0, i >= 0 ? list[i].t : t)), v, ...((ease ?? list[i]?.ease) !== undefined ? { ease: ease ?? list[i]?.ease } : {}) };
  if (i >= 0) list[i] = key; else list.push(key);
  return { ...anim, keys: { ...(anim?.keys ?? {}), [prop]: list.sort((a, b) => a.t - b.t) } };
}
export function removeKey(anim: ClipAnim | undefined, prop: string, index: number): ClipAnim | undefined {
  if (!anim?.keys?.[prop]) return anim;
  const list = cleanKeys(anim.keys[prop]); list.splice(index, 1);
  const keys = { ...anim.keys };
  if (list.length) keys[prop] = list; else delete keys[prop];
  const next: ClipAnim = { ...anim, keys };
  if (!Object.keys(keys).length) delete next.keys;
  return next.keys || next.modifiers?.length ? next : undefined;
}
export function clearProp(anim: ClipAnim | undefined, prop: string): ClipAnim | undefined {
  if (!anim?.keys?.[prop]) return anim;
  const keys = { ...anim.keys }; delete keys[prop];
  const next: ClipAnim = { ...anim, keys };
  if (!Object.keys(keys).length) delete next.keys;
  return next.keys || next.modifiers?.length ? next : undefined;
}
export function moveKey(anim: ClipAnim | undefined, prop: string, index: number, t: number): ClipAnim | undefined {
  const list = cleanKeys(anim?.keys?.[prop]);
  if (!anim || !list[index]) return anim;
  list[index] = { ...list[index], t: r4(Math.max(0, t)) };
  return { ...anim, keys: { ...anim.keys, [prop]: list.sort((a, b) => a.t - b.t) } };
}
export function setKeyEase(anim: ClipAnim | undefined, prop: string, index: number, ease: EaseSpec): ClipAnim | undefined {
  const list = cleanKeys(anim?.keys?.[prop]);
  if (!anim || !list[index]) return anim;
  list[index] = { ...list[index], ease: normalizeEase(ease) };
  return { ...anim, keys: { ...anim.keys, [prop]: list } };
}

/**
 * Auto-keyframe edit: apply `patch` (prop -> value) at clip time t. A property that already has keys gets / updates the key at t;
 * with `auto` on, every patched property does. Otherwise the caller writes the static value. Returns the new anim and the props that were not keyed.
 */
export function applyAutoKey(anim: ClipAnim | undefined, patch: Record<string, number>, t: number, auto: boolean): { anim: ClipAnim | undefined; unkeyed: string[] } {
  let next = anim; const unkeyed: string[] = [];
  for (const [prop, v] of Object.entries(patch)) {
    if (auto || next?.keys?.[prop]?.length) next = setKey(next, prop, t, v); else unkeyed.push(prop);
  }
  return { anim: next, unkeyed };
}

/**
 * Move the older keyframe stores of a clip into Clip.anim (transform.keys -> x/y/scale/rotation keys, Clip.keyframes opacity -> opacity keys; all linear).
 * Volume keys stay where they are. Evaluating the result gives the same values as evaluating the clip before.
 */
export function unifyLegacy<K extends { time: number; property: string; value: number }>(clip: { transform?: ClipTransform; anim?: ClipAnim; keyframes?: K[] }): { anim?: ClipAnim; transform?: ClipTransform; keyframes?: K[] } {
  let anim = clip.anim; let transform = clip.transform; let keyframes = clip.keyframes;
  if (transform?.keys?.length) {
    for (const prop of ['x', 'y', 'scale', 'rotation'] as const) {
      if (anim?.keys?.[prop]?.length) continue;
      const list: AnimKey[] = [...transform.keys].sort((a, b) => a.t - b.t).map((k) => ({ t: k.t, v: k[prop], ease: 'linear' as const }));
      anim = { ...anim, keys: { ...anim?.keys, [prop]: list } };
    }
    const { keys: _drop, ...rest } = transform;
    transform = rest;
  }
  const opacityKfs = (keyframes ?? []).filter((k) => k.property === 'opacity');
  if (opacityKfs.length && !anim?.keys?.opacity?.length) {
    anim = { ...anim, keys: { ...anim?.keys, opacity: opacityKfs.sort((a, b) => a.time - b.time).map((k) => ({ t: k.time, v: k.value, ease: 'linear' as const })) } };
    keyframes = (keyframes ?? []).filter((k) => k.property !== 'opacity');
  }
  return { ...(anim ? { anim } : {}), ...(transform !== clip.transform ? { transform: transform && hasTransform(transform) ? transform : undefined } : {}), ...(keyframes !== clip.keyframes ? { keyframes } : {}) };
}

/**
 * The part of an anim between clip times [t0, t1] as a new clip's anim (keys shifted by -t0 and time-scaled by `scale`; boundary values are
 * inserted so the curve is continuous across a split). Modifiers continue their phase through tOffset.
 */
export function sliceAnim(anim: ClipAnim | undefined, t0: number, t1: number, scale = 1): ClipAnim | undefined {
  if (!anim) return anim;
  const keys: Record<string, AnimKey[]> = {};
  for (const [prop, raw] of Object.entries(anim.keys ?? {})) {
    const list = cleanKeys(raw);
    if (!list.length) continue;
    const out: AnimKey[] = [];
    const inside = list.filter((k) => k.t > t0 + EPS && k.t < t1 - EPS);
    const startVal = sampleKeys(list, t0, list[0].v);
    const before = [...list].reverse().find((k) => k.t <= t0 + EPS);
    // the segment easing running through the cut is kept on the boundary key only when it is a plain preset (a bezier/spring cut mid-segment is re-based as linear)
    out.push({ t: 0, v: r4(startVal), ...(before && Math.abs(before.t - t0) <= EPS && before.ease !== undefined ? { ease: before.ease } : {}) });
    for (const k of inside) out.push({ ...k, t: r4((k.t - t0) * scale) });
    const endKey = list.find((k) => Math.abs(k.t - t1) <= EPS);
    if (inside.length || endKey || (before && list[list.length - 1].t > t0)) out.push({ t: r4((t1 - t0) * scale), v: r4(sampleKeys(list, t1, list[list.length - 1].v)) });
    keys[prop] = out;
  }
  const res: ClipAnim = { ...(Object.keys(keys).length ? { keys } : {}), ...(anim.modifiers?.length ? { modifiers: anim.modifiers, tOffset: (anim.tOffset ?? 0) + t0 } : {}) };
  return res.keys || res.modifiers ? res : undefined;
}

/** Validate an untrusted anim object (loaded project, hand-edited JSON). */
export function normalizeAnim(raw: unknown): ClipAnim | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as { keys?: Record<string, AnimKey[]>; modifiers?: unknown[]; tOffset?: unknown };
  const keys: Record<string, AnimKey[]> = {};
  for (const [id, list] of Object.entries(r.keys ?? {})) if (Array.isArray(list)) { const c = cleanKeys(list); if (c.length) keys[id] = c; }
  const modifiers = (Array.isArray(r.modifiers) ? r.modifiers : []).map(normalizeModifier).filter((m): m is MotionModifier => !!m);
  const out: ClipAnim = { ...(Object.keys(keys).length ? { keys } : {}), ...(modifiers.length ? { modifiers } : {}), ...(typeof r.tOffset === 'number' && r.tOffset ? { tOffset: r.tOffset } : {}) };
  return out.keys || out.modifiers ? out : undefined;
}
