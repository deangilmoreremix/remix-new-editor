// Stage 11 (port J): lift / extract the in-out range. Real timeline operations, values checked clip by clip.
import { describe, it, expect } from 'vitest';
import { createDefaultTimeline, addClipToTrack, updateTrack, addTransition, trimClip } from '@cinegen/lib/editor/timeline-operations';
import { liftRange, extractRange } from '@cinegen/lib/editor/stage11/range-edit';
import { clipEndTime } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';
import type { Timeline } from '@cinegen/types/timeline';

const A: Asset = { id: 'A', name: 'A', type: 'video', url: 'https://x.test/A.mp4', duration: 10, createdAt: '2026-01-01' };
const B: Asset = { id: 'B', name: 'B', type: 'video', url: 'https://x.test/B.mp4', duration: 6, createdAt: '2026-01-01' };
const T = (tl: Timeline, n: string) => tl.tracks.find((t) => t.name === n)!.id;
const on = (tl: Timeline, id: string) => tl.clips.filter((c) => c.trackId === id).sort((a, b) => a.startTime - b.startTime);
const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

/** V1: A 0-10, B 10-16; A1: linked audio of both */
function base(): Timeline {
  let tl = createDefaultTimeline('t');
  tl = addClipToTrack(tl, T(tl, 'V1'), A, 0);
  tl = addClipToTrack(tl, T(tl, 'V1'), B, 10);
  return { ...tl, markers: [{ id: 'm1', time: 1, color: '#fff', label: 'before' }, { id: 'm2', time: 4, color: '#fff', label: 'inside' }, { id: 'm3', time: 12, color: '#fff', label: 'after' }] };
}

describe('extract range (ripple delete)', () => {
  it('cuts [3,6) out of A, closes the gap, moves B, linked audio follows, markers shift', () => {
    const tl = base();
    const r = extractRange(tl, { start: 3, end: 6 });
    expect(r.changed).toBe(true);
    const v = on(r.timeline, T(tl, 'V1')); const a = on(r.timeline, T(tl, 'A1'));
    expect(v.map((c) => c.assetId)).toEqual(['A', 'A', 'B']);
    near(v[0].startTime, 0); near(clipEndTime(v[0]), 3);
    near(v[1].startTime, 3); near(clipEndTime(v[1]), 7); near(v[1].trimStart, 6); // the source after the cut: 6..10
    near(v[2].startTime, 7);
    expect(a.map((c) => c.assetId)).toEqual(['A', 'A', 'B']);
    near(a[1].startTime, 3); near(a[1].trimStart, 6); near(a[2].startTime, 7);
    // links pair the new halves
    expect(v[1].linkedClipIds).toEqual([a[1].id]);
    near(r.timeline.duration, 13);
    expect(r.timeline.markers.map((m) => [m.label, m.time])).toEqual([['before', 1], ['after', 9]]); // the inside marker is gone, the later one moved by 3
  });

  it('removing whole clips: a range covering B entirely', () => {
    const tl = base();
    const r = extractRange(tl, { start: 10, end: 16 });
    expect(on(r.timeline, T(tl, 'V1')).map((c) => c.assetId)).toEqual(['A']);
    expect(r.removedClipIds.length).toBe(2); // video + its audio
    near(r.timeline.duration, 10);
  });

  it('a locked track is not cut and not moved; the unlocked clips still ripple', () => {
    let tl = base();
    tl = updateTrack(tl, T(tl, 'A1'), { locked: true });
    const before = JSON.stringify(on(tl, T(tl, 'A1')));
    const r = extractRange(tl, { start: 3, end: 6 });
    expect(JSON.stringify(on(r.timeline, T(tl, 'A1')))).toBe(before);
    near(on(r.timeline, T(tl, 'V1')).at(-1)!.startTime, 7);
  });

  it('keeps a dissolve whose two clips both survive (and both ripple), drops it when a clip of it is removed', () => {
    // A (0-8, handle 2 s at its end) dissolving into B (starts 7 after the 1 s overlap, handle 2 s at its start)
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, T(tl, 'V1'), A, 0);
    const a0 = on(tl, T(tl, 'V1'))[0];
    tl = trimClip(tl, a0.id, 0, 2);
    tl = addClipToTrack(tl, T(tl, 'V1'), B, 8);
    const b0 = on(tl, T(tl, 'V1')).find((c) => c.assetId === 'B')!;
    tl = trimClip(tl, b0.id, 2, 0, 8);
    tl = addTransition(tl, { id: 'tr1', type: 'dissolve', duration: 1, clipAId: a0.id, clipBId: b0.id });
    const v0 = on(tl, T(tl, 'V1'));
    near(v0[1].startTime, 7); near(clipEndTime(v0[0]), 8);
    // extract the middle of A: both clips of the dissolve survive and the overlap is unchanged
    const keep = extractRange(tl, { start: 2, end: 5 });
    expect(keep.timeline.transitions).toHaveLength(1);
    const vk = on(keep.timeline, T(tl, 'V1'));
    expect(vk.map((c) => c.assetId)).toEqual(['A', 'A', 'B']);
    expect(keep.timeline.transitions[0].clipAId).toBe(vk[1].id); // the outgoing side follows the piece that still ends at the dissolve
    expect(keep.timeline.transitions[0].clipBId).toBe(vk[2].id);
    near(clipEndTime(vk[1]) - vk[2].startTime, 1);
    // extract the overlap area including the end of A: a clip of the dissolve is gone, so is the dissolve
    const drop = extractRange(tl, { start: 6, end: 9 });
    expect(drop.timeline.transitions).toHaveLength(0);
    expect(drop.droppedTransitions).toBe(1);
  });

  it('a range shorter than a frame, or empty, changes nothing', () => {
    const tl = base();
    expect(extractRange(tl, { start: 3, end: 3 }).changed).toBe(false);
    expect(extractRange(tl, { start: 3, end: 3 }).timeline).toBe(tl);
  });

  it('does not mutate its input (undo = the old object)', () => {
    const tl = base(); const snap = JSON.stringify(tl);
    extractRange(tl, { start: 3, end: 6 }); liftRange(tl, { start: 3, end: 6 });
    expect(JSON.stringify(tl)).toBe(snap);
  });
});

describe('lift range (delete, leave the gap)', () => {
  it('leaves a gap of exactly the range length and does not move later clips', () => {
    const tl = base();
    const r = liftRange(tl, { start: 3, end: 6 });
    const v = on(r.timeline, T(tl, 'V1'));
    near(clipEndTime(v[0]), 3); near(v[1].startTime, 6); near(clipEndTime(v[1]), 10); near(v[2].startTime, 10);
    near(r.timeline.duration, 16);
    expect(r.timeline.markers.map((m) => m.time)).toEqual([1, 12]);
    expect(r.shifted).toBe(0);
  });
});
