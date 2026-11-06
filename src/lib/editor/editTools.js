/**
 * Professional edit operations for the Timeline Editor's clip model:
 * clips store `left` / `width` as a percentage of the timeline length
 * (`timelineSeconds`), `trimIn` as the source in-point in seconds and
 * `playbackRate` (or legacy `speed`) as playback speed.
 *
 * Ported from CineGen's edit tools (Blade, Ripple, Roll, Slip, Slide) and
 * adapted to that model. Every function mutates the clips it is given and
 * returns them; callers snapshot state first so each edit is one undo step.
 */

export const MIN_WIDTH_PCT = 0.2;
const EPS = 0.05; // % — clips closer than this are "touching"

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
export const speedOf = (clip) => Math.max(0.01, num(clip?.playbackRate ?? clip?.speed, 1));
const trimInOf = (clip) => Math.max(0, num(clip?.trimIn ?? clip?.sourceStart, 0));
const right = (c) => num(c.left) + num(c.width);
/** Seconds of source media per % of timeline. */
const srcPerPct = (clip, T) => (T / 100) * speedOf(clip);
/** Source duration of the media, if known (seconds). */
const mediaDuration = (clip) => {
  const d = num(clip?.mediaDuration ?? clip?.sourceDuration ?? clip?.duration_source, NaN);
  return Number.isFinite(d) && d > 0 ? d : null;
};
/** Clips with source media that can be trimmed past their in-point. */
const hasSource = (clip) => ['video', 'audio'].includes(clip?.type);

function setTrimIn(clip, value) {
  clip.trimIn = Math.max(0, value);
  if ('sourceStart' in clip) clip.sourceStart = clip.trimIn;
}

/** Clips on the same track sorted by start. */
export const sorted = (items) => [...(items || [])].sort((a, b) => num(a.left) - num(b.left));

/** The clip that ends where `clip` starts (touching), if any. */
export function previousTouching(items, clip) {
  return sorted(items).reverse().find((c) => c !== clip && Math.abs(right(c) - num(clip.left)) <= EPS) || null;
}

/** The clip that starts where `clip` ends (touching), if any. */
export function nextTouching(items, clip) {
  return sorted(items).find((c) => c !== clip && Math.abs(num(c.left) - right(clip)) <= EPS) || null;
}

/** Clips on the track starting at or after `pct`, excluding `except`. */
const after = (items, pct, except) => (items || []).filter((c) => !except.includes(c) && num(c.left) >= pct - EPS);

/**
 * Blade: split a clip at a timeline position (in %). The right half keeps
 * playing from the correct source time.
 * @returns {[object, object] | null}
 */
export function splitClip(clip, atPct, T, { newId = (c, side) => `${c.id}-${side}-${Date.now().toString(36)}` } = {}) {
  const l = num(clip.left);
  const r = right(clip);
  if (!(atPct > l + MIN_WIDTH_PCT / 2 && atPct < r - MIN_WIDTH_PCT / 2)) return null;
  const copy = (o) => JSON.parse(JSON.stringify(o));
  const a = { ...copy(clip), id: newId(clip, 'a'), width: atPct - l };
  const b = { ...copy(clip), id: newId(clip, 'b'), left: atPct, width: r - atPct };
  if (hasSource(clip)) setTrimIn(b, trimInOf(clip) + (atPct - l) * srcPerPct(clip, T));
  // Keyframe times are relative to the clip start: keep them on the half they fall in.
  if (clip.keyframes && typeof clip.keyframes === 'object') {
    const cut = ((atPct - l) / 100) * T;
    const pick = (keep, shift) => Object.fromEntries(Object.entries(clip.keyframes)
      .map(([k, list]) => [k, (list || []).filter((kf) => keep(num(kf.t))).map((kf) => ({ ...kf, t: num(kf.t) - shift }))])
      .filter(([, list]) => list.length));
    a.keyframes = pick((t) => t <= cut, 0);
    b.keyframes = pick((t) => t >= cut, cut);
    if (!Object.keys(a.keyframes).length) delete a.keyframes;
    if (!Object.keys(b.keyframes).length) delete b.keyframes;
  }
  return [a, b];
}

/** Largest left-edge move (% of timeline, negative = earlier) allowed by the source in-point. */
function leftEdgeLimit(clip, T) {
  return hasSource(clip) ? -trimInOf(clip) / srcPerPct(clip, T) : -Infinity;
}

/** Largest right-edge growth allowed by the media length (Infinity if unknown). */
function rightEdgeLimit(clip, T) {
  const md = mediaDuration(clip);
  if (!md || !hasSource(clip)) return Infinity;
  const usedSrc = trimInOf(clip) + num(clip.width) * srcPerPct(clip, T);
  return Math.max(0, (md - usedSrc) / srcPerPct(clip, T));
}

const clampDelta = (d, lo, hi) => Math.min(hi, Math.max(lo, d));

/**
 * Trim one edge. Plain trim leaves a gap or overlap; ripple shifts the
 * clips after the edit so the track stays packed.
 * @param {'left'|'right'} edge
 * @param {number} deltaPct  how far the edge moves (positive = later)
 * @returns {number} the delta actually applied
 */
export function trimEdge(items, clip, edge, deltaPct, T, { ripple = false } = {}) {
  const w = num(clip.width);
  if (edge === 'left') {
    const d = clampDelta(deltaPct, leftEdgeLimit(clip, T), w - MIN_WIDTH_PCT);
    const oldRight = right(clip);
    if (hasSource(clip)) setTrimIn(clip, trimInOf(clip) + d * srcPerPct(clip, T));
    clip.width = w - d;
    if (ripple) {
      // The clip keeps its start; everything after it moves by the change in length.
      after(items, oldRight, [clip]).forEach((c) => { c.left = num(c.left) - d; });
    } else {
      clip.left = num(clip.left) + d;
    }
    return d;
  }
  const d = clampDelta(deltaPct, MIN_WIDTH_PCT - w, rightEdgeLimit(clip, T));
  const oldRight = right(clip);
  clip.width = w + d;
  if (ripple) after(items, oldRight, [clip]).forEach((c) => { c.left = Math.max(0, num(c.left) + d); });
  return d;
}

/**
 * Roll: move the cut between this clip and the touching neighbour on that
 * edge. One clip gets longer, the other shorter; nothing else moves.
 * @returns {number} delta applied (0 if there is no touching neighbour)
 */
export function rollEdit(items, clip, edge, deltaPct, T) {
  if (edge === 'right') {
    const next = nextTouching(items, clip);
    if (!next) return 0;
    const d = clampDelta(deltaPct,
      Math.max(MIN_WIDTH_PCT - num(clip.width), leftEdgeLimit(next, T)),
      Math.min(num(next.width) - MIN_WIDTH_PCT, rightEdgeLimit(clip, T)));
    clip.width = num(clip.width) + d;
    trimEdge(items, next, 'left', d, T);
    return d;
  }
  // Moving this clip's left edge = moving the previous clip's right edge.
  const prev = previousTouching(items, clip);
  if (!prev) return 0;
  return rollEdit(items, prev, 'right', deltaPct, T);
}

/**
 * Slip: change which part of the source plays, without moving the clip.
 * Dragging right reveals earlier source (like dragging the film).
 * @returns {number} source seconds the in-point moved
 */
export function slipClip(clip, deltaPct, T) {
  if (!hasSource(clip)) return 0;
  const before = trimInOf(clip);
  let next = before - deltaPct * srcPerPct(clip, T);
  const md = mediaDuration(clip);
  const used = num(clip.width) * srcPerPct(clip, T);
  if (md) next = Math.min(next, Math.max(0, md - used));
  setTrimIn(clip, Math.max(0, next));
  return trimInOf(clip) - before;
}

/**
 * Slide: move a clip between its touching neighbours. The previous clip's
 * end and the next clip's start follow it, so the total length is unchanged.
 * @returns {number} delta applied
 */
export function slideClip(items, clip, deltaPct, T) {
  const prev = previousTouching(items, clip);
  const next = nextTouching(items, clip);
  let lo = -num(clip.left);
  let hi = prev || next ? Infinity : 100 - right(clip);
  if (prev) {
    lo = Math.max(lo, MIN_WIDTH_PCT - num(prev.width)); // previous clip can't vanish
    hi = Math.min(hi, rightEdgeLimit(prev, T)); // …or run past its media
  }
  if (next) {
    hi = Math.min(hi, num(next.width) - MIN_WIDTH_PCT);
    lo = Math.max(lo, leftEdgeLimit(next, T)); // next clip can't start before its source
  }
  const d = clampDelta(deltaPct, lo, hi);
  if (prev) prev.width = num(prev.width) + d;
  if (next) trimEdge(items, next, 'left', d, T);
  clip.left = num(clip.left) + d;
  return d;
}

/**
 * Change playback speed and resize the clip so it still shows the same
 * source range (2× → half as long).
 */
export function setSpeed(clip, rate) {
  const r = Math.max(0.25, Math.min(4, num(rate, 1)));
  const old = speedOf(clip);
  clip.width = Math.max(MIN_WIDTH_PCT, (num(clip.width) * old) / r);
  clip.playbackRate = r;
  delete clip.speed;
  return r;
}

/**
 * Source monitor: set the clip to show source [inSec, outSec).
 * Keeps the clip's start; width follows the new length.
 */
export function setInOut(clip, inSec, outSec, T) {
  const a = Math.max(0, num(inSec));
  const b = Math.max(a + 0.05, num(outSec, a + 1));
  setTrimIn(clip, a);
  clip.width = Math.max(MIN_WIDTH_PCT, ((b - a) / speedOf(clip) / T) * 100);
  return clip;
}

/** Timeline-level markers, kept sorted. Times in seconds. */
export function addMarker(markers, sec, label = '') {
  const t = Math.max(0, Math.round(num(sec) * 100) / 100);
  const list = (markers || []).filter((m) => Math.abs(m.t - t) > 0.05);
  list.push({ id: `m-${Date.now().toString(36)}-${Math.round(t * 100)}`, t, label: String(label || '').slice(0, 60) });
  return list.sort((a, b) => a.t - b.t);
}

export const nextMarker = (markers, sec) => (markers || []).find((m) => m.t > sec + 0.01) || null;
export const prevMarker = (markers, sec) => [...(markers || [])].reverse().find((m) => m.t < sec - 0.01) || null;
