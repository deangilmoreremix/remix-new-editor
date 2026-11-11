// [remix] Persistent multicam groups: decisions materialise into ordinary clips and can be revised.
import { describe, it, expect } from 'vitest';
import { createGroup, setAngle, removeDecision, nudgeAngle, deleteGroup, normalizeDecisions, type MulticamTimeline } from '@cinegen/lib/occ/multicam-groups';
import { clipEndTime, type Clip } from '@cinegen/types/timeline';

const clip = (id: string, trackId: string, startTime: number, duration: number, extra: Partial<Clip> = {}): Clip => ({ id, assetId: id, trackId, name: id, startTime, duration, trimStart: 0, trimEnd: 0, speed: 1, opacity: 1, volume: 1, flipH: false, flipV: false, keyframes: [], ...extra });
const track = (id: string, kind: 'video' | 'audio') => ({ id, name: id, kind, color: '#fff', muted: false, solo: false, locked: false, visible: true, volume: 1 });
const base = (): MulticamTimeline => ({ id: 't', name: 't', tracks: [track('V1', 'video'), track('V2', 'video'), track('A1', 'audio'), track('A2', 'audio')], markers: [], transitions: [], duration: 20,
  clips: [clip('camA', 'V1', 0, 20, { linkedClipIds: ['audA'] }), clip('audA', 'A1', 0, 20, { linkedClipIds: ['camA'] }), clip('camB', 'V2', 0, 20, { linkedClipIds: ['audB'] }), clip('audB', 'A2', 0, 20, { linkedClipIds: ['camB'] })] } as never);
const segs = (tl: MulticamTimeline, trackId: string) => tl.clips.filter((c) => c.trackId === trackId).sort((a, b) => a.startTime - b.startTime).map((c) => [Math.round(c.startTime * 100) / 100, Math.round(clipEndTime(c) * 100) / 100, Math.round(c.trimStart * 100) / 100]);

describe('multicam groups', () => {
  it('creates a group: first camera active everywhere, group persists on the timeline', () => {
    const tl = createGroup(base(), ['camA', 'camB'], 'Interview');
    if ('error' in tl) throw new Error(tl.error);
    expect(tl.multicam).toHaveLength(1);
    expect(segs(tl, 'V1')).toEqual([[0, 20, 0]]);
    expect(segs(tl, 'V2')).toEqual([]);
    expect(tl.clips.every((c) => (c as any).multicam)).toBe(true);
  });
  it('switching to another angle moves the picture and its linked audio, keeping the right source moment', () => {
    let tl = createGroup(base(), ['camA', 'camB'])! as MulticamTimeline;
    const g = tl.multicam![0];
    tl = setAngle(tl, g.id, 'cam2', 5, 10) as MulticamTimeline;
    expect(segs(tl, 'V1')).toEqual([[0, 5, 0], [10, 20, 10]]);
    expect(segs(tl, 'V2')).toEqual([[5, 10, 5]]);
    expect(segs(tl, 'A2')).toEqual([[5, 10, 5]]);
    expect(segs(tl, 'A1').length).toBe(2);
    const vB = tl.clips.find((c) => c.trackId === 'V2')!; const aB = tl.clips.find((c) => c.trackId === 'A2')!;
    expect(vB.linkedClipIds).toEqual([aB.id]);
  });
  it('a later switch overrides an earlier one and an old switch can be removed', () => {
    let tl = createGroup(base(), ['camA', 'camB'])! as MulticamTimeline;
    const gid = tl.multicam![0].id;
    tl = setAngle(tl, gid, 'cam2', 2, 12) as MulticamTimeline;
    tl = setAngle(tl, gid, 'cam1', 6, 8) as MulticamTimeline;
    expect(segs(tl, 'V2')).toEqual([[2, 6, 2], [8, 12, 8]]);
    const d = normalizeDecisions(tl.multicam![0]).find((x) => x.angleId === 'cam2' && x.from === 2)!;
    tl = removeDecision(tl, gid, d.id);
    expect(segs(tl, 'V2')).toEqual([[8, 12, 8]]);
  });
  it('nudging an angle re-syncs it; deleting restores the original clips or keeps the cut', () => {
    let tl = createGroup(base(), ['camA', 'camB'])! as MulticamTimeline;
    const gid = tl.multicam![0].id;
    tl = nudgeAngle(tl, gid, 'cam2', 1) as MulticamTimeline;
    tl = setAngle(tl, gid, 'cam2', 5, 10) as MulticamTimeline;
    expect(segs(tl, 'V2')[0][0]).toBe(5);
    expect(segs(tl, 'V2')[0][2]).toBeCloseTo(4, 1); // the camera starts 1 s later on the timeline, so the source moment at t=5 is 4 s in
    const kept = deleteGroup(tl, gid, false);
    expect(kept.multicam).toBeUndefined();
    expect(kept.clips.some((c) => (c as any).multicam)).toBe(false);
    expect(kept.clips.length).toBe(tl.clips.length);
    const restored = deleteGroup(tl, gid, true);
    expect(restored.clips.map((c) => c.id).sort()).toEqual(['audA', 'audB', 'camA', 'camB']);
  });
  it('rejects bad input', () => {
    expect('error' in (createGroup(base(), ['camA'])!)).toBe(true);
    expect('error' in (createGroup(base(), ['camA', 'audA'])!)).toBe(true);
  });
});
