import { describe, it, expect } from 'vitest';
import type { Clip, Timeline } from '@cinegen/types/timeline';
import { clipEffectiveDuration } from '@cinegen/types/timeline';
import { applyExportRange, applyRangeToOverlays, loopTarget, resolveTimelineRange, setRangeIn, setRangeOut, withRange } from '@cinegen/lib/editor/range/timeline-range';
import { marksFromAsset, marksMetadataPatch } from '@cinegen/lib/editor/range/source-marks-persist';
import { setMarkIn, setMarkOut, emptyMarks } from '@cinegen/lib/editor/stage1';

const clip = (id: string, trackId: string, startTime: number, duration: number, extra: Partial<Clip> = {}): Clip => ({ id, assetId: 'a', trackId, name: id, startTime, duration, trimStart: 0, trimEnd: 0, speed: 1, opacity: 1, volume: 1, flipH: false, flipV: false, keyframes: [], ...extra });
const tl = (): Timeline => ({
  id: 't', name: 't', duration: 10,
  tracks: [{ id: 'v', kind: 'video', name: 'V1' }, { id: 'a', kind: 'audio', name: 'A1' }] as Timeline['tracks'],
  clips: [
    clip('v1', 'v', 0, 6, { linkedClipIds: ['a1'], keyframes: [{ time: 1, property: 'opacity', value: 0.2 }, { time: 4, property: 'opacity', value: 0.8 }] }),
    clip('a1', 'a', 0, 6, { linkedClipIds: ['v1'] }),
    clip('v2', 'v', 6, 4),
  ],
  transitions: [{ id: 'tr', type: 'dissolve', duration: 0.5, clipAId: 'v1', clipBId: 'v2' }],
  markers: [{ id: 'm1', time: 1, color: '#fff', label: 'early' }, { id: 'm2', time: 3, color: '#fff', label: 'in' }, { id: 'm3', time: 8, color: '#fff', label: 'late' }],
});

describe('timeline range', () => {
  it('sets, orders and resolves in / out', () => {
    let r = setRangeIn(undefined, 2, 10); expect(r).toEqual({ in: 2, out: null });
    r = setRangeOut(r, 5, 10); expect(r).toEqual({ in: 2, out: 5 });
    expect(resolveTimelineRange(r, 10)).toEqual({ start: 2, end: 5 });
    expect(setRangeIn(r, 7, 10)).toEqual({ in: 7, out: null }); // in past out drops out
    expect(setRangeOut(r, 1, 10)).toEqual({ in: null, out: 1 });
    expect(resolveTimelineRange({ in: null, out: 4 }, 10)).toEqual({ start: 0, end: 4 });
    expect(resolveTimelineRange({ in: null, out: null }, 10)).toBeNull();
    expect(resolveTimelineRange(undefined, 10)).toBeNull();
    expect(withRange(tl(), { in: null, out: null }).range).toBeUndefined();
  });
  it('loop target', () => { const r = { start: 2, end: 5 }; expect(loopTarget(r, 4.9)).toBeNull(); expect(loopTarget(r, 5)).toBe(2); expect(loopTarget(null, 9)).toBeNull(); });
  it('export range 2..7 cuts clips, slices keyframes, shifts everything to 0', () => {
    const out = applyExportRange(tl(), { start: 2, end: 7 });
    expect(out.duration).toBe(5);
    const v = out.clips.filter((c) => c.trackId === 'v').sort((a, b) => a.startTime - b.startTime);
    const a = out.clips.filter((c) => c.trackId === 'a');
    expect(v).toHaveLength(2); expect(a).toHaveLength(1);
    expect(v[0].startTime).toBe(0); expect(clipEffectiveDuration(v[0])).toBeCloseTo(4); expect(v[0].trimStart).toBeCloseTo(2);
    expect(v[1].startTime).toBeCloseTo(4); expect(clipEffectiveDuration(v[1])).toBeCloseTo(1); expect(v[1].trimEnd).toBeCloseTo(3);
    expect(a[0].startTime).toBe(0); expect(clipEffectiveDuration(a[0])).toBeCloseTo(4); expect(a[0].trimStart).toBeCloseTo(2);
    expect(v[0].keyframes).toEqual([{ time: 2, property: 'opacity', value: 0.8 }]); // key at 4 s of the source, now 2 s into the clip; the 1 s key is cut away
    expect(out.markers).toEqual([{ id: 'm2', time: 1, color: '#fff', label: 'in' }]);
    expect(Math.max(...out.clips.map((c) => c.startTime + clipEffectiveDuration(c)))).toBeCloseTo(5);
    // linked ids only point at surviving clips
    for (const c of out.clips) for (const id of c.linkedClipIds ?? []) expect(out.clips.some((x) => x.id === id)).toBe(true);
  });
  it('a range covering everything keeps all clips; no range returns the same timeline', () => {
    const t = tl(); expect(applyExportRange(t, null)).toBe(t);
    const all = applyExportRange(t, { start: 0, end: 10 }); expect(all.clips).toHaveLength(3); expect(all.duration).toBe(10);
  });
  it('speed: a 2x clip cut by timeline time trims source time x2', () => {
    const t: Timeline = { ...tl(), clips: [clip('s', 'v', 0, 8, { speed: 2 })], transitions: [], markers: [] }; // plays 4 s
    const out = applyExportRange(t, { start: 1, end: 3 });
    expect(out.clips).toHaveLength(1); expect(clipEffectiveDuration(out.clips[0])).toBeCloseTo(2); expect(out.clips[0].trimStart).toBeCloseTo(2);
  });
  it('overlays clip to the range', () => {
    const o = [{ id: 'a', start: 0, end: 1 }, { id: 'b', start: 1, end: 4 }, { id: 'c', start: 6, end: 9 }];
    expect(applyRangeToOverlays(o, { start: 2, end: 5 })).toEqual([{ id: 'b', start: 0, end: 2 }]);
  });
});

describe('source marks persistence', () => {
  it('round-trips through asset metadata and validates', () => {
    const m = setMarkOut(setMarkIn(emptyMarks('x'), 1.5, 6), 4, 6);
    const patch = marksMetadataPatch(m);
    expect(marksFromAsset({ id: 'x', duration: 6, metadata: { ...patch } })).toEqual({ assetId: 'x', markIn: 1.5, markOut: 4 });
    expect(marksFromAsset({ id: 'x', duration: 3, metadata: { ...patch } })).toEqual({ assetId: 'x', markIn: 1.5, markOut: null }); // out beyond a shorter file ignored
    expect(marksFromAsset({ id: 'x', metadata: { sourceMarks: { markIn: 'a', markOut: -1 } } })).toEqual({ assetId: 'x', markIn: null, markOut: null });
    expect(marksFromAsset({ id: 'x' })).toEqual(emptyMarks('x'));
    expect(marksMetadataPatch(emptyMarks('x'))).toEqual({ sourceMarks: null });
  });
});
