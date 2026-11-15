// [remix] Stage 1: compound clips (pure). "Nest" turns the selected clips into ONE clip object on the timeline; "expand" puts them back.
// The nested clips keep their own tracks, trims, speed, keyframes and fades (start times are relative to the compound). Playback and export
// never see the compound: flattenCompounds() turns it back into ordinary clips first (see use-stage1-editing.ts for the preview wiring and
// export-mapping callers for the export), so what plays is what exports and no second renderer exists.
// The compound's own trim / speed / split / move / static opacity, volume and flip are honoured when flattening.
// [remix] Fix A: so are its own look - Clip.anim (x/y/scale/rotation/opacity keys + motion modifiers), static transform, opacity keyframes, fx (with
// fx param keys), LUT and blend mode. They are DISTRIBUTED onto every picture child with the right time offset (see applyGroupLook), so the
// preview, the export and expandCompound all see the same result. Not applied: crop, fades, zoom, captions of the compound (documented).
import type { Clip, ClipFx, CompoundContent, Timeline, Transition } from '@cinegen/types/timeline';
import { clipEffectiveDuration, clipEndTime } from '@cinegen/types/timeline';
import { generateId } from '@cinegen/lib/utils/ids';
import { calculateTimelineDuration } from '../timeline-operations';
import { FX_KEY_BASIS_FPS, fxPropId, hasAnim, parseFxPropId, poseAt, poseOpacity, sliceAnim, type AnimKey } from '../stage2/anim';
import { pathOffsetAt, type ClipTransform } from '../../occ/transform';
import type { Keyframe as OccKeyframe } from '../../../../openchatcut/editor/clipTypes';

const EPS = 1e-6;
const MAX_DEPTH = 8;
const finish = (tl: Timeline): Timeline => ({ ...tl, duration: calculateTimelineDuration(tl) });

export const isCompound = (c: Clip | undefined): boolean => !!c?.compound;

/** Nest the given clips into one compound clip. Returns compoundId null when nothing was selected. */
export function createCompound(timeline: Timeline, ids: Iterable<string>, name = 'Compound clip'): { timeline: Timeline; compoundId: string | null; droppedTransitions: number } {
  const sel = new Set(ids);
  const picked = timeline.clips.filter((c) => sel.has(c.id));
  if (!picked.length) return { timeline, compoundId: null, droppedTransitions: 0 };
  const origin = Math.min(...picked.map((c) => c.startTime));
  const end = Math.max(...picked.map(clipEndTime));
  const members = new Set(picked.map((c) => c.id));

  const children: Clip[] = picked.map((c) => {
    const kept = (c.linkedClipIds ?? []).filter((l) => members.has(l));
    return { ...c, startTime: c.startTime - origin, linkedClipIds: kept.length ? kept : undefined };
  });
  const inner = (timeline.transitions ?? []).filter((t) => members.has(t.clipAId) && (!t.clipBId || members.has(t.clipBId)));
  const touching = (timeline.transitions ?? []).filter((t) => (members.has(t.clipAId) || (t.clipBId && members.has(t.clipBId))) && !inner.includes(t));

  const trackOrder = new Map(timeline.tracks.map((t, i) => [t.id, i]));
  const firstVideoTrack = timeline.tracks.find((t) => t.kind === 'video' && picked.some((c) => c.trackId === t.id));
  const trackId = firstVideoTrack?.id ?? [...picked].sort((a, b) => (trackOrder.get(a.trackId) ?? 0) - (trackOrder.get(b.trackId) ?? 0))[0].trackId;
  const cover = [...picked].filter((c) => c.trackId === trackId).sort((a, b) => a.startTime - b.startTime)[0] ?? picked[0];

  const compound: Clip = {
    id: generateId(), assetId: cover.assetId, trackId, name, startTime: origin, duration: end - origin, trimStart: 0, trimEnd: 0, speed: 1,
    opacity: 1, volume: 1, flipH: false, flipV: false, keyframes: [], compound: { clips: children, transitions: inner },
  };
  const rest = timeline.clips.filter((c) => !members.has(c.id)).map((c) => {
    if (!c.linkedClipIds?.some((l) => members.has(l))) return c;
    const kept = c.linkedClipIds.filter((l) => !members.has(l));
    return { ...c, linkedClipIds: kept.length ? kept : undefined };
  });
  return {
    timeline: finish({ ...timeline, clips: [...rest, compound], transitions: (timeline.transitions ?? []).filter((t) => !inner.includes(t) && !touching.includes(t)) }),
    compoundId: compound.id,
    droppedTransitions: touching.length,
  };
}


/** Frame aspect (W/H) used to rotate a child's offset about the frame centre when the compound itself is rotated (exact when it is not). */
export const GROUP_ASPECT = 16 / 9;
const r5 = (n: number) => Math.round(n * 1e5) / 1e5;

const movesFrame = (t?: ClipTransform) => !!t && (t.x !== 0 || t.y !== 0 || t.scale !== 1 || t.rotation !== 0 || !!t.keys?.length || !!t.path?.length);
const groupPosed = (c: Clip) => hasAnim(c.anim) || movesFrame(c.transform) || c.keyframes.some((k) => k.property === 'opacity');

/** Does the compound carry a look of its own that has to reach its content? */
export function hasGroupLook(c: Clip): boolean {
  return groupPosed(c) || !!c.fx?.some((f) => f.enabled !== false) || !!c.lut || (!!c.blendMode && c.blendMode !== 'normal') || c.keyframes.some((k) => k.property === 'opacity');
}

/**
 * Put the compound's own look onto one picture child. `next` is the child already placed on the parent timeline (startTime, trim, speed, anim windowed),
 * `offset` = seconds from the compound's start to the child's start (timeline seconds), so compound time = offset + child time.
 *  - fx / LUT: appended after the child's own (child fx, child LUT, compound fx, compound LUT); their param keys are shifted by -offset.
 *  - blend mode: used when the child is 'normal'.
 *  - pose (x, y, scale, rotation) and opacity: the compound's transform is applied AFTER the child's (translate . rotate . scale), so the child's
 *    pose and the compound's pose are composed and sampled every 1/30 s into the child's anim keys (linear), modifiers included.
 */
function applyGroupLook(container: Clip, next: Clip, offset: number, base: { opacity: number }): Clip {
  const out: Clip = { ...next };
  const dur = clipEffectiveDuration(next);

  // ---- effects
  const cIndex = (container.fx ?? []).map((f, i) => ({ f, i })).filter((e) => e.f.enabled !== false);
  if (cIndex.length || container.lut) {
    const fx: ClipFx[] = [...(next.fx ?? [])];
    if (next.lut) { fx.push({ id: next.lut.id, props: { intensity: next.lut.intensity }, ...(next.lut.def ? { def: next.lut.def } : {}) }); out.lut = undefined; }
    const keys: Record<string, AnimKey[]> = { ...(out.anim?.keys ?? {}) };
    for (const { f, i } of cIndex) {
      const idx = fx.length;
      const shifted = f.keys ? Object.fromEntries(Object.entries(f.keys).map(([k, list]) => [k, (list as OccKeyframe[]).map((kf) => ({ ...kf, frame: kf.frame - offset * FX_KEY_BASIS_FPS }))])) : undefined;
      fx.push({ ...f, ...(shifted ? { keys: shifted } : {}) });
      for (const [id, list] of Object.entries(container.anim?.keys ?? {})) {
        const pf = parseFxPropId(id);
        if (pf && pf.index === i && list?.length) { const sl = sliceAnim({ keys: { [id]: list } }, offset, offset + dur, 1); if (sl?.keys?.[id]) keys[fxPropId(idx, pf.key)] = sl.keys[id]; }
      }
    }
    if (container.lut) fx.push({ id: container.lut.id, props: { intensity: container.lut.intensity }, ...(container.lut.def ? { def: container.lut.def } : {}) });
    out.fx = fx;
    if (Object.keys(keys).length) out.anim = { ...(out.anim ?? {}), keys };
  }
  if (container.blendMode && container.blendMode !== 'normal' && (!next.blendMode || next.blendMode === 'normal')) out.blendMode = container.blendMode;

  // ---- pose + opacity
  if (!groupPosed(container) || dur <= EPS) return out;
  const a = GROUP_ASPECT;
  const childSrc = { transform: out.transform, anim: out.anim, opacity: base.opacity, keyframes: out.keyframes };
  const groupSrc = { transform: container.transform, anim: container.anim, opacity: container.opacity, keyframes: container.keyframes };
  const step = Math.max(1 / FX_KEY_BASIS_FPS, dur / 600);
  const times: number[] = []; for (let t = 0; t < dur - 1e-9; t += step) times.push(t); times.push(dur);
  const keys: Record<string, AnimKey[]> = { ...(out.anim?.keys ?? {}) };
  for (const id of ['x', 'y', 'scale', 'rotation', 'opacity']) keys[id] = [];
  for (const t of times) {
    const c = poseAt(childSrc, t); const cpo = pathOffsetAt(out.transform?.path, t);
    const g = poseAt(groupSrc, offset + t); const gpo = pathOffsetAt(container.transform?.path, offset + t);
    const rad = (g.rotation * Math.PI) / 180; const cos = Math.cos(rad); const sin = Math.sin(rad);
    const X = ((c.x + cpo.x) / 100) * a; const Y = (c.y + cpo.y) / 100; // in frame heights
    const gx = ((g.x + gpo.x) / 100) * a; const gy = (g.y + gpo.y) / 100;
    const nx = gx + g.scale * (X * cos - Y * sin); const ny = gy + g.scale * (X * sin + Y * cos);
    const tt = r5(t);
    keys.x.push({ t: tt, v: r5((nx / a) * 100), ease: 'linear' }); keys.y.push({ t: tt, v: r5(ny * 100), ease: 'linear' });
    keys.scale.push({ t: tt, v: r5(g.scale * c.scale), ease: 'linear' }); keys.rotation.push({ t: tt, v: r5(g.rotation + c.rotation), ease: 'linear' });
    keys.opacity.push({ t: tt, v: r5(Math.max(0, Math.min(1, poseOpacity(childSrc, t) * poseOpacity(groupSrc, offset + t)))), ease: 'linear' });
  }
  // the child's motion modifiers and tracked path were sampled into the keys, so they are not applied a second time
  out.anim = { keys };
  out.opacity = base.opacity;
  if (out.transform?.path) out.transform = { ...out.transform, path: undefined };
  return out;
}

interface Windowed { clips: Clip[]; transitions: Transition[] }

/** The compound's content as clips on the parent timeline: honours the compound's trim window, speed and static opacity / volume / flip. */
function content(container: Clip, trackIds: Set<string>, idFor: (childId: string) => string, audioTrackIds: Set<string> = new Set()): Windowed {
  const look = hasGroupLook(container);
  const inner = container.compound as CompoundContent;
  const w0 = container.trimStart; const w1 = container.duration - container.trimEnd;
  const sp = container.speed || 1;
  const out: Clip[] = [];
  for (const child of inner.clips) {
    const cs = child.startTime; const ce = cs + clipEffectiveDuration(child);
    const s = Math.max(cs, w0); const e = Math.min(ce, w1);
    if (e - s <= EPS) continue;
    const cutL = s - cs; const cutR = ce - e;
    const effOut = (e - s) / sp;
    const kf = child.keyframes.map((k) => ({ ...k, time: (k.time - cutL) / sp })).filter((k) => k.time >= -EPS && k.time <= effOut + EPS);
    const next: Clip = {
      ...child, id: idFor(child.id),
      trackId: trackIds.has(child.trackId) ? child.trackId : container.trackId,
      startTime: container.startTime + (s - w0) / sp,
      trimStart: child.trimStart + cutL * child.speed, trimEnd: child.trimEnd + cutR * child.speed,
      speed: child.speed * sp, opacity: child.opacity * container.opacity, volume: child.volume * container.volume,
      flipH: child.flipH !== container.flipH, flipV: child.flipV !== container.flipV, keyframes: kf,
    };
    if (child.anim) next.anim = sliceAnim(child.anim, cutL, e - cs, 1 / sp); // [remix] Stage 2 keys follow the same window
    // [remix] Fix A: the compound's own fx / anim / transform apply to every picture child (a child on an audio track has no picture)
    if (look && !audioTrackIds.has(next.trackId)) Object.assign(next, applyGroupLook(container, next, next.startTime - container.startTime, { opacity: child.opacity }));
    if (cutL > EPS) delete next.fadeIn; else if (next.fadeIn) next.fadeIn /= sp;
    if (cutR > EPS) delete next.fadeOut; else if (next.fadeOut) next.fadeOut /= sp;
    out.push(next);
  }
  const alive = new Set(out.map((c) => c.id));
  const clips = out.map((c) => {
    const kept = (c.linkedClipIds ?? []).map(idFor).filter((l) => alive.has(l));
    return { ...c, linkedClipIds: kept.length ? kept : undefined };
  });
  const transitions = inner.transitions
    .map((t) => ({ ...t, clipAId: idFor(t.clipAId), clipBId: t.clipBId ? idFor(t.clipBId) : undefined }))
    .filter((t) => alive.has(t.clipAId) && (!t.clipBId || alive.has(t.clipBId)));
  return { clips, transitions };
}

/** Expand every compound clip into ordinary clips (recursively). Returns the same object when there is none, so it memoises well. */
export function flattenCompounds(timeline: Timeline, depth = 0): Timeline {
  if (depth >= MAX_DEPTH || !timeline.clips.some((c) => c.compound)) return timeline;
  const trackIds = new Set(timeline.tracks.map((t) => t.id));
  const clips: Clip[] = [];
  const transitions: Transition[] = [];
  const compoundIds = new Set<string>();
  const audioIds = new Set(timeline.tracks.filter((t) => t.kind === 'audio').map((t) => t.id));
  for (const c of timeline.clips) {
    if (!c.compound) { clips.push(c); continue; }
    compoundIds.add(c.id);
    const w = content(c, trackIds, (id) => `${c.id}::${id}`, audioIds);
    clips.push(...w.clips);
    transitions.push(...w.transitions);
  }
  // a transition that referred to the compound itself has no single clip to act on: dropped in the flattened view
  const rest = (timeline.transitions ?? []).filter((t) => !compoundIds.has(t.clipAId) && !(t.clipBId && compoundIds.has(t.clipBId)));
  return flattenCompounds(finish({ ...timeline, clips, transitions: [...rest, ...transitions] }), depth + 1);
}

/** Put one compound clip's content back on the timeline as ordinary clips (original ids when free, new ones otherwise). */
export function expandCompound(timeline: Timeline, compoundId: string): { timeline: Timeline; clipIds: string[] } {
  const c = timeline.clips.find((x) => x.id === compoundId);
  if (!c?.compound) return { timeline, clipIds: [] };
  const taken = new Set(timeline.clips.map((x) => x.id));
  const map = new Map<string, string>();
  for (const k of c.compound.clips) map.set(k.id, taken.has(k.id) && k.id !== compoundId ? generateId() : k.id);
  const w = content(c, new Set(timeline.tracks.map((t) => t.id)), (id) => map.get(id) ?? id, new Set(timeline.tracks.filter((t) => t.kind === 'audio').map((t) => t.id)));
  return {
    timeline: finish({ ...timeline, clips: [...timeline.clips.filter((x) => x.id !== compoundId), ...w.clips], transitions: [...(timeline.transitions ?? []).filter((t) => t.clipAId !== compoundId && t.clipBId !== compoundId), ...w.transitions] }),
    clipIds: w.clips.map((x) => x.id),
  };
}
