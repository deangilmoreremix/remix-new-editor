// [remix] CineGen clips ↔ OpenChatCut GL engine bridge.
import { describe, it, expect } from 'vitest';
import { clipFxInstances, clipFxPasses, clipHasFx } from '@cinegen/lib/occ/clip-fx';
import { updateClipProperties } from '@cinegen/lib/editor/timeline-operations';
import { ALL_FX, FX_IDS, LUT_IDS } from '../../openchatcut/gl/fx/effects';
import type { Clip, Timeline } from '@cinegen/types/timeline';

const clip = (over: Partial<Clip> = {}): Clip => ({ id: 'c1', assetId: 'a', trackId: 't', name: 'c', startTime: 0, duration: 4, trimStart: 0, trimEnd: 0, speed: 1, opacity: 1, volume: 1, flipH: false, flipV: false, keyframes: [], ...over });
const tl = (c: Clip): Timeline => ({ id: 'tl', name: 'T', tracks: [], clips: [c], duration: 4, transitions: [], markers: [] });

describe('OpenChatCut effects on CineGen clips', () => {
  it('ships 33 effects and 16 LUT/looks', () => {
    expect(FX_IDS.length).toBe(33);
    expect(LUT_IDS.length).toBe(16);
  });
  it('a clip without fx has no passes', () => {
    expect(clipHasFx(clip())).toBe(false);
    expect(clipFxPasses(clip(), 0)).toEqual([]);
  });
  it('builds passes in order: fx stack then LUT, with slider overrides clamped', () => {
    const c = clip({ fx: [{ id: 'builtin:fx-vignette', props: {} }, { id: 'builtin:fx-film-grain', props: {}, enabled: false }], lut: { id: 'builtin:look-teal-orange', intensity: 0.4 } });
    expect(clipFxInstances(c).map((i) => i.def.id)).toEqual(['builtin:fx-vignette', 'builtin:look-teal-orange']);
    const passes = clipFxPasses(c, 1.5);
    expect(passes.length).toBeGreaterThanOrEqual(2);
    expect(passes[passes.length - 1].uniforms?.u_intensity).toBe(0.4);
  });
  it('unknown effect ids are ignored', () => {
    expect(clipHasFx(clip({ fx: [{ id: 'builtin:nope', props: {} }] }))).toBe(false);
  });
  it('fx / lut / blendMode round-trip through updateClipProperties and can be cleared', () => {
    const fx = [{ id: Object.keys(ALL_FX)[0], props: { intensity: 0.5 } }];
    let t = updateClipProperties(tl(clip()), 'c1', { fx, lut: { id: LUT_IDS[0], intensity: 1 }, blendMode: 'screen' });
    expect(t.clips[0]).toMatchObject({ fx, lut: { id: LUT_IDS[0], intensity: 1 }, blendMode: 'screen' });
    t = updateClipProperties(t, 'c1', { fx: undefined, lut: undefined, blendMode: undefined });
    expect(clipHasFx(t.clips[0])).toBe(false);
    expect(JSON.parse(JSON.stringify(t)).clips[0].fx).toBeUndefined();
  });
});

import { clipFromRow, clipToRow, transitionFromRow, transitionToRow } from '@cinegen/lib/db-converters';
describe('persistence rows', () => {
  it('fx / lut / blend survive clipToRow → JSON → clipFromRow', () => {
    const c = clip({ fx: [{ id: 'builtin:fx-vignette', props: { intensity: 0.7 } }], lut: { id: 'builtin:look-mono', intensity: 0.5 }, blendMode: 'screen' });
    const back = clipFromRow(JSON.parse(JSON.stringify(clipToRow(c, 'tl'))));
    expect(back).toMatchObject({ fx: c.fx, lut: c.lut, blendMode: 'screen' });
  });
  it('clips saved before effects existed still load', () => {
    const back = clipFromRow(JSON.parse(JSON.stringify(clipToRow(clip(), 'tl'))));
    expect(back.fx).toBeUndefined(); expect(back.lut).toBeUndefined(); expect(back.blendMode).toBeUndefined();
  });
  it('transition glType round-trips', () => {
    const tr = { id: 't', type: 'dissolve' as const, duration: 1, clipAId: 'a', clipBId: 'b', glType: 'page-curl' };
    expect(transitionFromRow(JSON.parse(JSON.stringify(transitionToRow(tr, 'tl')))).glType).toBe('page-curl');
  });
});
