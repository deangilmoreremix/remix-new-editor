/**
 * Keyframes for timeline clips.
 *
 * Stored on the clip, so they save with the project and reach the export
 * runner:  clip.keyframes = { [property]: [{ t, v, easing }] }
 *   t       seconds from the clip's start
 *   v       value
 *   easing  easing of the segment that starts at this keyframe
 *
 * Properties: x / y (offset, % of the frame), scale (1 = 100%), rotation
 * (degrees), opacity (0–1), volume (0–1) and any numeric effect parameter
 * as `fx:<effect uid>:<param key>`. The composition evaluates them every
 * frame with Remotion's interpolate().
 */
import { interpolate, Easing } from 'remotion';

export const KEYFRAME_PROPERTIES = [
  { key: 'x', label: 'Position X (%)', min: -100, max: 100, step: 0.5, default: 0 },
  { key: 'y', label: 'Position Y (%)', min: -100, max: 100, step: 0.5, default: 0 },
  { key: 'scale', label: 'Scale', min: 0, max: 5, step: 0.01, default: 1 },
  { key: 'rotation', label: 'Rotation (°)', min: -360, max: 360, step: 1, default: 0 },
  { key: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.01, default: 1 },
  { key: 'volume', label: 'Volume', min: 0, max: 1, step: 0.01, default: 1, media: true },
];

export const EASINGS = [
  ['linear', 'Linear'],
  ['ease-in', 'Ease in'],
  ['ease-out', 'Ease out'],
  ['ease-in-out', 'Ease in-out'],
  ['ease-in-cubic', 'Ease in (cubic)'],
  ['ease-out-cubic', 'Ease out (cubic)'],
  ['back', 'Back (overshoot)'],
  ['bounce', 'Bounce'],
  ['elastic', 'Elastic'],
  ['hold', 'Hold (no tween)'],
];

const EASING_FNS = {
  linear: Easing.linear,
  'ease-in': Easing.in(Easing.quad),
  'ease-out': Easing.out(Easing.quad),
  'ease-in-out': Easing.inOut(Easing.quad),
  'ease-in-cubic': Easing.in(Easing.cubic),
  'ease-out-cubic': Easing.out(Easing.cubic),
  back: Easing.out(Easing.back(1.6)),
  bounce: Easing.out(Easing.bounce),
  elastic: Easing.out(Easing.elastic(1)),
  // Names used by the older keyframe UI.
  'ease-in-quad': Easing.in(Easing.quad),
  'ease-out-quad': Easing.out(Easing.quad),
  'ease-in-out-quad': Easing.inOut(Easing.quad),
};

/** Older property names → current ones. */
const ALIASES = { 'position-x': 'x', 'position-y': 'y' };
export const canonicalProperty = (p) => ALIASES[p] || p;

export const propertyDef = (key) => KEYFRAME_PROPERTIES.find((p) => p.key === canonicalProperty(key)) || null;

const sorted = (list) => [...(list || [])].filter((k) => Number.isFinite(Number(k.t)) && Number.isFinite(Number(k.v)))
  .map((k) => ({ t: Number(k.t), v: Number(k.v), easing: k.easing || 'linear' }))
  .sort((a, b) => a.t - b.t);

/** Value of one property's keyframes at `t` seconds (fallback when none). */
export function valueAt(list, t, fallback) {
  const kfs = sorted(list);
  if (!kfs.length) return fallback;
  if (t <= kfs[0].t) return kfs[0].v;
  const last = kfs[kfs.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < kfs.length - 1; i += 1) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (t >= a.t && t <= b.t) {
      if (a.easing === 'hold' || b.t === a.t) return a.v;
      return interpolate(t, [a.t, b.t], [a.v, b.v], { easing: EASING_FNS[a.easing] || Easing.linear, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    }
  }
  return last.v;
}

export const hasKeyframes = (keyframes) => !!keyframes && Object.values(keyframes).some((l) => Array.isArray(l) && l.length);

/** All animated values at `t` (only properties that have keyframes). */
export function valuesAt(keyframes, t) {
  const out = {};
  Object.entries(keyframes || {}).forEach(([prop, list]) => {
    if (Array.isArray(list) && list.length) out[canonicalProperty(prop)] = valueAt(list, t, undefined);
  });
  return out;
}

const EPS = 1 / 120;

/** Add or replace the keyframe for `prop` at `t`. Returns a new keyframes object. */
export function setKeyframe(keyframes, prop, t, v, easing = 'linear') {
  const key = canonicalProperty(prop);
  const next = { ...(keyframes || {}) };
  const list = sorted(next[key]).filter((k) => Math.abs(k.t - t) > EPS);
  list.push({ t: Math.max(0, Math.round(t * 1000) / 1000), v: Number(v), easing });
  next[key] = sorted(list);
  return next;
}

export function removeKeyframe(keyframes, prop, index) {
  const key = canonicalProperty(prop);
  const next = { ...(keyframes || {}) };
  const list = sorted(next[key]);
  list.splice(index, 1);
  if (list.length) next[key] = list; else delete next[key];
  return next;
}

export function updateKeyframe(keyframes, prop, index, patch) {
  const key = canonicalProperty(prop);
  const next = { ...(keyframes || {}) };
  const list = sorted(next[key]);
  if (!list[index]) return next;
  list[index] = { ...list[index], ...patch };
  next[key] = sorted(list);
  return next;
}

/** Keyframe times (seconds from clip start), de-duplicated, for timeline diamonds. */
export function keyframeTimes(keyframes) {
  const set = new Set();
  Object.values(keyframes || {}).forEach((l) => (Array.isArray(l) ? l : []).forEach((k) => set.add(Math.round(Number(k.t) * 1000) / 1000)));
  return [...set].filter(Number.isFinite).sort((a, b) => a - b);
}

/** Effect-parameter overrides for this moment: { 'uid:key': value }. */
export function effectOverridesAt(keyframes, t) {
  const out = {};
  Object.entries(keyframes || {}).forEach(([prop, list]) => {
    const m = /^fx:([^:]+):(.+)$/.exec(prop);
    if (m && Array.isArray(list) && list.length) out[`${m[1]}:${m[2]}`] = valueAt(list, t, undefined);
  });
  return out;
}

/** CSS for the transform properties at `t` (null when nothing is animated). */
export function transformStyleAt(keyframes, t, origin = '50% 50%') {
  const v = valuesAt(keyframes, t);
  const parts = [];
  if (v.x !== undefined || v.y !== undefined) parts.push(`translate(${v.x || 0}%, ${v.y || 0}%)`);
  if (v.rotation !== undefined) parts.push(`rotate(${v.rotation}deg)`);
  if (v.scale !== undefined) parts.push(`scale(${Math.max(0, v.scale)})`);
  if (!parts.length && v.opacity === undefined) return null;
  return {
    transform: parts.length ? parts.join(' ') : undefined,
    transformOrigin: origin,
    opacity: v.opacity === undefined ? undefined : Math.max(0, Math.min(1, v.opacity)),
  };
}

/** Keep keyframes inside a clip whose length changed (drop ones past the end). */
export const clampKeyframes = (keyframes, durationSec) => Object.fromEntries(
  Object.entries(keyframes || {}).map(([p, l]) => [p, sorted(l).filter((k) => k.t <= durationSec + EPS)]).filter(([, l]) => l.length),
);
