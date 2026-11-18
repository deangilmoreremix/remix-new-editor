// [remix] Multicam camera switch (OpenChatCut planCamSwitch applied to the CineGen timeline).
import { describe, it, expect } from 'vitest';
import { cutToCamera } from '@cinegen/lib/occ/cam-switch';
import { clipEndTime, type Clip, type Timeline } from '@cinegen/types/timeline';

const clip = (id: string, trackId: string, startTime: number, duration: number, extra: Partial<Clip> = {}): Clip => ({ id, assetId: id, trackId, name: id, startTime, duration, trimStart: 0, trimEnd: 0, speed: 1, opacity: 1, volume: 1, flipH: false, flipV: false, keyframes: [], ...extra });
const track = (id: string, kind: 'video' | 'audio') => ({ id, name: id, kind, color: '#fff', muted: false, solo: false, locked: false, visible: true, volume: 1 });
const tl = (clips: Clip[]): Timeline => ({ id: 't', name: 't', tracks: [track('V1', 'video'), track('V2', 'video'), track('A1', 'audio')], clips, markers: [], transitions: [], duration: 20 } as never);

describe('cutToCamera', () => {
  it('removes the other camera inside the interval only, leaving the rest in place', () => {
    const base = tl([clip('camA', 'V1', 0, 20), clip('camB', 'V2', 0, 20)]);
    const r = cutToCamera(base, 'camA', 5, 10);
    if ('error' in r) throw new Error(r.error);
    const onV2 = r.timeline.clips.filter((c) => c.trackId === 'V2').sort((a, b) => a.startTime - b.startTime);
    expect(onV2).toHaveLength(2);
    expect(onV2[0].startTime).toBe(0); expect(clipEndTime(onV2[0])).toBeCloseTo(5, 2);
    expect(onV2[1].startTime).toBeCloseTo(10, 2); expect(clipEndTime(onV2[1])).toBeCloseTo(20, 2);
    expect(onV2[1].trimStart).toBeCloseTo(10, 2);               // the tail still plays the right source moment
    expect(r.timeline.clips.filter((c) => c.trackId === 'V1')).toHaveLength(1);   // target camera untouched
    expect(r.gapSeconds).toBe(0);
    expect(r.removed[0]).toMatchObject({ fromSec: 5, toSec: 10 });
  });
  it('reports a gap when the target camera does not cover the interval', () => {
    const base = tl([clip('camA', 'V1', 0, 6), clip('camB', 'V2', 0, 20)]);
    const r = cutToCamera(base, 'camA', 5, 10);
    if ('error' in r) throw new Error(r.error);
    expect(r.gapSeconds).toBeCloseTo(4, 1);
  });
  it('rejects a non-video clip and a zero-length switch', () => {
    const base = tl([clip('a', 'A1', 0, 5), clip('camA', 'V1', 0, 20)]);
    expect('error' in cutToCamera(base, 'a', 1, 2)).toBe(true);
    expect('error' in cutToCamera(base, 'camA', 3, 3)).toBe(true);
  });
  it('linked audio of the removed camera goes with it', () => {
    const base = tl([clip('camA', 'V1', 0, 20), clip('camB', 'V2', 0, 20, { linkedClipIds: ['audB'] }), clip('audB', 'A1', 0, 20, { linkedClipIds: ['camB'] })]);
    const r = cutToCamera(base, 'camA', 5, 10);
    if ('error' in r) throw new Error(r.error);
    const audio = r.timeline.clips.filter((c) => c.trackId === 'A1').sort((a, b) => a.startTime - b.startTime);
    expect(audio.some((c) => c.startTime < 10 && clipEndTime(c) > 5.01)).toBe(false);
  });
});
