// [remix] Stage 11 (port J): lift / extract the timeline in-out range (pure). FreeCut has range-removal edits (stores/actions/edit/range-removal-actions.ts,
// MIT, commit 5ceeeb388eef5423640b7db157706274bf1b8165) that cut ranges out of the items and ripple the rest; that file is wired to its zustand stores, so
// only the idea is taken: clips are cut at both range edges with the editor's own splitClip (linked audio, keyframes and anim keys slice exactly as a
// manual razor cut), the clips inside are removed, and for "extract" every later clip on an unlocked track moves earlier by the range length.
// Locked tracks are never touched. Overlay-lane items and captions are outside Timeline.clips and are not moved (same limit as insert / overwrite).
import type { Clip, Timeline } from '@cinegen/types/timeline';
import { clipEffectiveDuration, clipEndTime } from '@cinegen/types/timeline';
import { splitClip, calculateTimelineDuration } from '../timeline-operations';

const EPS = 1e-6;

export interface RangeEditResult { timeline: Timeline; removedClipIds: string[]; shifted: number; droppedTransitions: number; changed: boolean }

function cutAt(tl: Timeline, at: number, locked: Set<string>): Timeline {
  let out = tl;
  for (const c of [...tl.clips]) {
    const cur = out.clips.find((x) => x.id === c.id);
    if (!cur || locked.has(cur.trackId)) continue;
    const rel = at - cur.startTime;
    if (rel > EPS && rel < clipEffectiveDuration(cur) - EPS) out = splitClip(out, cur.id, at);
  }
  return out;
}

/**
 * Remove [start, end) from every unlocked track. `ripple` closes the gap (extract), otherwise it is left open (lift).
 * Transitions whose clips end up on both sides of an extracted range are dropped (the cut becomes a plain join); transitions on removed clips are dropped.
 */
export function removeTimelineRange(timeline: Timeline, range: { start: number; end: number }, opts: { ripple: boolean }): RangeEditResult {
  const start = Math.max(0, range.start); const end = Math.max(start, range.end);
  const len = end - start;
  if (!(len > EPS)) return { timeline, removedClipIds: [], shifted: 0, droppedTransitions: 0, changed: false };
  const locked = new Set(timeline.tracks.filter((t) => t.locked).map((t) => t.id));
  // a link to a locked clip must not make splitClip cut that locked clip: unlink for the operation, restore the locked clips afterwards
  const lockedClips = timeline.clips.filter((c) => locked.has(c.trackId));
  const lockedIds = new Set(lockedClips.map((c) => c.id));
  let tl: Timeline = {
    ...timeline,
    clips: timeline.clips.filter((c) => !lockedIds.has(c.id)).map((c) => (c.linkedClipIds?.some((l) => lockedIds.has(l)) ? { ...c, linkedClipIds: c.linkedClipIds.filter((l) => !lockedIds.has(l)) } : c)),
  };
  // splitClip leaves a transition on the FIRST half of a split clip; the outgoing side of a transition is the clip's END, so follow the piece that still ends there
  const outgoingEnd = new Map(tl.transitions.map((t) => { const a = tl.clips.find((c) => c.id === t.clipAId); return [t.id, a ? { end: clipEndTime(a), track: a.trackId, asset: a.assetId } : null] as const; }));
  tl = cutAt(cutAt(tl, start, new Set()), end, new Set());
  tl = {
    ...tl,
    transitions: tl.transitions.map((t) => {
      const o = outgoingEnd.get(t.id);
      const last = o && tl.clips.find((c) => c.trackId === o.track && c.assetId === o.asset && Math.abs(clipEndTime(c) - o.end) < 1e-6);
      return last && last.id !== t.clipAId ? { ...t, clipAId: last.id } : t;
    }),
  };

  const inside = (c: Clip) => c.startTime >= start - EPS && clipEndTime(c) <= end + EPS;
  const removed = new Set(tl.clips.filter(inside).map((c) => c.id));
  const survivors = tl.clips.filter((c) => !removed.has(c.id));
  const movedIds = new Set<string>();
  const clips = survivors.map((c) => {
    const next = c.linkedClipIds ? { ...c, linkedClipIds: c.linkedClipIds.filter((l) => !removed.has(l)) } : c;
    if (next.linkedClipIds && !next.linkedClipIds.length) delete next.linkedClipIds;
    if (opts.ripple && c.startTime >= end - EPS) { movedIds.add(c.id); return { ...next, startTime: Math.max(0, c.startTime - len) }; }
    return next;
  });
  const side = (id: string) => { const c = tl.clips.find((x) => x.id === id); return !c ? 'gone' : c.startTime >= end - EPS ? 'after' : 'before'; };
  const before = tl.transitions.length;
  const transitions = tl.transitions.filter((t) => {
    if (removed.has(t.clipAId) || (t.clipBId && removed.has(t.clipBId))) return false;
    if (opts.ripple && t.clipBId && side(t.clipAId) === 'before' && side(t.clipBId) === 'after') return false; // the two clips are now simply adjacent
    return true;
  });
  const markers = tl.markers
    .filter((m) => !(m.time >= start && m.time < end))
    .map((m) => (opts.ripple && m.time >= end ? { ...m, time: m.time - len } : m));
  const merged = { ...tl, clips: [...clips, ...lockedClips], transitions, markers };
  const out: Timeline = { ...merged, duration: calculateTimelineDuration(merged) };
  return { timeline: out, removedClipIds: [...removed], shifted: movedIds.size, droppedTransitions: before - transitions.length, changed: true };
}

export const liftRange = (tl: Timeline, range: { start: number; end: number }) => removeTimelineRange(tl, range, { ripple: false });
export const extractRange = (tl: Timeline, range: { start: number; end: number }) => removeTimelineRange(tl, range, { ripple: true });
