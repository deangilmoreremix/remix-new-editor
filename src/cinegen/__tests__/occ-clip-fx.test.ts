// [remix] CineGen clips ↔ OpenChatCut GL engine bridge.
import { describe, it, expect } from 'vitest';
import { clipFxInstances, clipFxPasses, clipHasFx } from '@cinegen/lib/occ/clip-fx';
import { updateClipProperties } from '@cinegen/lib/editor/timeline-operations';
import { ALL_FX, FX_IDS, LUT_IDS } from '../../openchatcut/gl/fx/effects';
import type { Clip, Timeline } from '@cinegen/types/timeline';

const clip = (over: Partial<Clip> = {}): Clip => ({ id: 'c1', assetId: 'a', trackId: 't', name: 'c', startTime: 0, duration: 4, trimStart: 0, trimEnd: 0, speed: 1, opacity: 1, volume: 1, flipH: false, flipV: false, keyframes: [], ...over });
const tl = (c: Clip): Timeline => ({ id: 'tl', name: 'T', tracks: [], clips: [c], duration: 4, transitions: [], markers: [] });

describe('OpenChatCut effects on CineGen clips', () => {
  it('ships 54 effects (33 + 21 Stage 3/5) and 16 LUT/looks', () => {
    expect(FX_IDS.length).toBe(54);
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

import { registerUserLut, userLutTextSync, USER_LUT_PREFIX } from '@cinegen/lib/occ/user-luts';
describe('imported .cube LUTs', () => {
  const cube = 'LUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n';
  it('registers as a selectable LUT that builds a pass with its 3D table', () => {
    const id = `${USER_LUT_PREFIX}test`;
    registerUserLut({ id, name: 'Mine', text: cube });
    expect(ALL_FX[id].name).toBe('Mine');
    expect(userLutTextSync(id)).toBe(cube);
    const passes = clipFxPasses(clip({ lut: { id, intensity: 0.6 } }), 0);
    expect(passes).toHaveLength(1);
    expect(passes[0].lut3d?.size).toBe(2);
    expect(passes[0].uniforms?.u_intensity).toBe(0.6);
  });
  it('rejects a file that is not a 3D cube', async () => {
    const { importCubeFile } = await import('@cinegen/lib/occ/user-luts');
    await expect(importCubeFile(new File(['LUT_1D_SIZE 2\n0 0 0\n1 1 1\n'], 'x.cube'))).rejects.toThrow();
  });
});

import { followZoomFromTrack } from '@cinegen/lib/occ/follow-zoom';
import { zoomAt } from '../../openchatcut/editor/zoom';
describe('zoom + follow subject', () => {
  it('zoom persists through the row converters', () => {
    const c = clip({ zoom: { magnification: 2, shape: 'punch', focalPointX: 0.3, focalPointY: 0.6 } });
    expect(clipFromRow(JSON.parse(JSON.stringify(clipToRow(c, 'tl')))).zoom).toEqual(c.zoom);
  });
  it('tracking points become a reframe curve their zoomAt follows', () => {
    const pts = Array.from({ length: 11 }, (_, i) => ({ frame: i * 3, x: 0.2 + i * 0.05, y: 0.5, confidence: 0.9 }));
    const z = followZoomFromTrack(pts, 2.5);
    expect(z.reframeCurve!.keyframes[0]).toMatchObject({ frame: 0, focalPointX: 0.2, magnification: 2.5 });
    const mid = zoomAt(z, 15, 30);
    expect(mid.magnification).toBe(2.5);
    expect(mid.focalX).toBeCloseTo(0.45, 2);
    expect(zoomAt(z, 30, 30).focalX).toBeCloseTo(0.7, 2);
  });
  it('a plain shape zoom pushes in and settles', () => {
    const z = { magnification: 2, shape: 'hold' as const };
    expect(zoomAt(z, 0, 90).magnification).toBeCloseTo(1, 1);
    expect(zoomAt(z, 45, 90).magnification).toBe(2);
  });
});

import { cinegenFcpxml } from '@cinegen/lib/occ/fcpxml';
describe('FCPXML export', () => {
  it('writes a valid FCPXML for a CineGen timeline (video + linked audio, trims, speed)', () => {
    const t = { id: 'tl', name: 'My <cut>', duration: 6, transitions: [], markers: [],
      tracks: [{ id: 'tv', name: 'V1', kind: 'video', color: '', muted: false, solo: false, locked: false, visible: true, volume: 1 }, { id: 'ta', name: 'A1', kind: 'audio', color: '', muted: false, solo: false, locked: false, visible: true, volume: 1 }],
      clips: [clip({ id: 'v', trackId: 'tv', startTime: 1, duration: 5, trimStart: 1, speed: 1 }), clip({ id: 'a', trackId: 'ta', startTime: 1, duration: 5, trimStart: 1 })] } as unknown as Timeline;
    const xml = cinegenFcpxml(t, [{ id: 'a', name: 'shot.mp4', type: 'video', url: 'blob:x', createdAt: '', status: 'ready' } as never]);
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('<spine>');
    expect(xml).toContain('My &lt;cut&gt;');
    expect((xml.match(/<asset-clip/g) ?? []).length).toBe(2);
    expect(xml).toContain('lane="-1"');
    expect(xml).not.toMatch(/undefined|NaN/);
  });
});

// [remix] OpenChatCut clip fades (editor/clipFade.ts) in the CineGen timeline model
import { interpolateProperty } from '@cinegen/lib/editor/timeline-operations';
describe('clip fades', () => {
  const clip: any = { id: 'a', assetId: 'x', trackId: 't', name: 'a', startTime: 0, duration: 10, trimStart: 0, trimEnd: 0, speed: 1, opacity: 1, volume: 1, flipH: false, flipV: false, keyframes: [], fadeIn: 2, fadeOut: 2 };
  it('ramps in, holds, ramps out (opacity and volume)', () => {
    expect(interpolateProperty(clip, 'opacity', 0)).toBe(0);
    expect(interpolateProperty(clip, 'opacity', 1)).toBeCloseTo(0.5);
    expect(interpolateProperty(clip, 'volume', 5)).toBe(1);
    expect(interpolateProperty(clip, 'volume', 9)).toBeCloseTo(0.5);
  });
  it('propagates fades to the linked clip', () => {
    const a = { ...clip, id: 'a', linkedClipIds: ['b'], fadeIn: undefined, fadeOut: undefined };
    const b = { ...clip, id: 'b', linkedClipIds: ['a'], fadeIn: undefined, fadeOut: undefined };
    const tl: any = { id: 't', clips: [a, b], tracks: [], duration: 10, markers: [], transitions: [] };
    const out = updateClipProperties(tl, 'a', { fadeIn: 1.5 });
    expect(out.clips.find((c: any) => c.id === 'b').fadeIn).toBe(1.5);
  });
});

import { sampledFxProps } from '@cinegen/lib/occ/clip-fx';
describe('keyframed effect properties', () => {
  const clip: any = { fx: [{ id: 'builtin:fx-vignette', props: { intensity: 0.2 }, keys: { intensity: [{ frame: 0, value: 0 }, { frame: 30, value: 1 }] } }] };
  it('interpolates keyed properties over the clip time and leaves static ones', () => {
    expect(sampledFxProps({ intensity: 0.2, other: 3 }, clip.fx[0].keys, 0.5).intensity).toBeCloseTo(0.5);
    expect(sampledFxProps({ intensity: 0.2, other: 3 }, clip.fx[0].keys, 0.5).other).toBe(3);
    expect(sampledFxProps({ intensity: 0.2 }, clip.fx[0].keys, 5).intensity).toBe(1);
    expect(sampledFxProps({ intensity: 0.2 }, undefined, 5).intensity).toBe(0.2);
  });
  it('clipFxInstances returns the sampled overrides for the playhead time', () => {
    const id = Object.keys(ALL_FX).find((k) => /vignette/.test(k))!;
    const c: any = { fx: [{ id, props: {}, keys: { intensity: [{ frame: 0, value: 0 }, { frame: 60, value: 1 }] } }] };
    expect(clipFxInstances(c, 1)[0].overrides.intensity).toBeCloseTo(0.5);
  });
});
