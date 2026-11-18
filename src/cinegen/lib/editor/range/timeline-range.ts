// [remix] Fix B2: timeline in / out points (pure). The range is stored on the timeline (`Timeline.range`, seconds) and used for loop playback and
// as the export range. applyExportRange cuts a timeline down to the range with the editor's own splitClip, so keyframes, anim keys and
// linked audio are sliced the same way as a manual razor cut.
import type { Timeline } from '@cinegen/types/timeline';
import { clipEffectiveDuration } from '@cinegen/types/timeline';
import { splitClip } from '../timeline-operations';

export interface TimelineRange { in: number | null; out: number | null }
export const MIN_TL_RANGE = 1 / 24;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const emptyRange = (): TimelineRange => ({ in: null, out: null });

export function setRangeIn(r: TimelineRange | undefined, t: number, duration: number): TimelineRange {
  const v = clamp(t, 0, Math.max(0, duration));
  return { in: v, out: r?.out != null && r.out - v < MIN_TL_RANGE ? null : r?.out ?? null };
}
export function setRangeOut(r: TimelineRange | undefined, t: number, duration: number): TimelineRange {
  const v = clamp(t, 0, Math.max(0, duration));
  return { out: v, in: r?.in != null && v - r.in < MIN_TL_RANGE ? null : r?.in ?? null };
}
/** The active range (in to out, defaults 0 and the timeline duration), or null when neither point is set or the span is shorter than a frame. */
export function resolveTimelineRange(r: TimelineRange | undefined | null, duration: number): { start: number; end: number } | null {
  if (!r || (r.in == null && r.out == null)) return null;
  const start = clamp(r.in ?? 0, 0, duration); const end = clamp(r.out ?? duration, 0, duration);
  return end - start >= MIN_TL_RANGE ? { start, end } : null;
}
export const withRange = (tl: Timeline, r: TimelineRange | null): Timeline => {
  const { range: _drop, ...rest } = tl as Timeline & { range?: TimelineRange }; void _drop;
  return r && (r.in != null || r.out != null) ? { ...rest, range: r } : rest;
};

/** Loop playback: where to seek when the playhead passes the range end (null = keep playing). */
export function loopTarget(range: { start: number; end: number } | null, t: number): number | null {
  return range && t >= range.end ? range.start : null;
}

/** The timeline restricted to [start, end): clips are cut at both points, everything outside is dropped, the rest moves to start at 0. */
export function applyExportRange(timeline: Timeline, range: { start: number; end: number } | null): Timeline {
  if (!range) return timeline;
  let tl = timeline;
  for (const at of [range.start, range.end]) {
    for (const c of [...tl.clips]) {
      if (!tl.clips.some((x) => x.id === c.id)) continue;
      const cur = tl.clips.find((x) => x.id === c.id)!;
      const rel = at - cur.startTime;
      if (rel > 1e-6 && rel < clipEffectiveDuration(cur) - 1e-6) tl = splitClip(tl, cur.id, at);
    }
  }
  const keep = tl.clips.filter((c) => c.startTime >= range.start - 1e-6 && c.startTime < range.end - 1e-6).map((c) => ({ ...c, startTime: Math.max(0, c.startTime - range.start) }));
  const ids = new Set(keep.map((c) => c.id));
  // keep only clips whose whole body lies inside (cuts at both points guarantee it); linked ids are limited to survivors
  const clips = keep.map((c) => (c.linkedClipIds ? { ...c, linkedClipIds: c.linkedClipIds.filter((i) => ids.has(i)) } : c));
  return {
    ...tl,
    clips,
    transitions: tl.transitions.filter((t) => ids.has(t.clipAId) && (!t.clipBId || ids.has(t.clipBId))),
    markers: tl.markers.filter((m) => m.time >= range.start && m.time <= range.end).map((m) => ({ ...m, time: m.time - range.start })),
    duration: range.end - range.start,
    range: undefined,
  } as Timeline;
}

/** Overlay-lane items (start / end in seconds) for an export range: items outside drop, the rest are clipped to the range and moved to start at 0. */
export function applyRangeToOverlays<O extends { start: number; end: number }>(overlays: O[], range: { start: number; end: number } | null): O[] {
  if (!range) return overlays;
  return overlays.filter((o) => o.end > range.start && o.start < range.end)
    .map((o) => ({ ...o, start: Math.max(o.start, range.start) - range.start, end: Math.min(o.end, range.end) - range.start }));
}
