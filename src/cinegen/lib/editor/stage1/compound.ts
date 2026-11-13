// [remix] Stage 1: compound clips (pure). "Nest" turns the selected clips into ONE clip object on the timeline; "expand" puts them back.
// The nested clips keep their own tracks, trims, speed, keyframes and fades (start times are relative to the compound). Playback and export
// never see the compound: flattenCompounds() turns it back into ordinary clips first (see use-stage1-editing.ts for the preview wiring and
// export-mapping callers for the export), so what plays is what exports and no second renderer exists.
// The compound's own trim / speed / split / move / static opacity, volume and flip are honoured when flattening; its keyframes, fades,
// fx, LUT, blend, transform, zoom and captions are not applied to the content (documented limitation).
import type { Clip, CompoundContent, Timeline, Transition } from '@cinegen/types/timeline';
import { clipEffectiveDuration, clipEndTime } from '@cinegen/types/timeline';
import { generateId } from '@cinegen/lib/utils/ids';
import { calculateTimelineDuration } from '../timeline-operations';
import { sliceAnim } from '../stage2/anim';

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

interface Windowed { clips: Clip[]; transitions: Transition[] }

/** The compound's content as clips on the parent timeline: honours the compound's trim window, speed and static opacity / volume / flip. */
function content(container: Clip, trackIds: Set<string>, idFor: (childId: string) => string): Windowed {
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
  for (const c of timeline.clips) {
    if (!c.compound) { clips.push(c); continue; }
    compoundIds.add(c.id);
    const w = content(c, trackIds, (id) => `${c.id}::${id}`);
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
  const w = content(c, new Set(timeline.tracks.map((t) => t.id)), (id) => map.get(id) ?? id);
  return {
    timeline: finish({ ...timeline, clips: [...timeline.clips.filter((x) => x.id !== compoundId), ...w.clips], transitions: [...(timeline.transitions ?? []).filter((t) => t.clipAId !== compoundId && t.clipBId !== compoundId), ...w.transitions] }),
    clipIds: w.clips.map((x) => x.id),
  };
}
