// Real-data tests for the CineGen preview -> export hand-off: a timeline is built with the real timeline operations, turned into the
// export payload and state by lib/editor/export-mapping.ts, and then through the REAL timelineToComposition. Assertions are on the
// composition props the Remotion renderer receives (nothing under test is mocked).
import { describe, it, expect } from 'vitest';
import { createDefaultTimeline, addClipToTrack, addTransition, updateTrack } from '@cinegen/lib/editor/timeline-operations';
import { exportClipsFromTimeline, exportTracksFromTimeline, exportTransitionsFromTimeline, buildExportState, exportItem, opacityEnvelope } from '@cinegen/lib/editor/export-mapping';
// @ts-expect-error plain JS module
import { timelineToComposition } from '../../../lib/editor/remotion/timelineToComposition.js';
import type { Asset } from '@cinegen/types/project';
import type { Timeline } from '@cinegen/types/timeline';

const asset = (id: string, type: Asset['type'] = 'video', duration = 10): Asset => ({ id, name: id, type, url: `https://x.test/${id}.mp4`, duration, createdAt: '2026-01-01' });
const ASSETS = [asset('A'), asset('B'), asset('S', 'audio'), asset('P', 'image', 5)];

function compose(tl: Timeline, extra: { transitions?: boolean } = {}) {
  const clips = exportClipsFromTimeline(tl, ASSETS);
  const { state, warnings } = buildExportState({ clips, tracks: exportTracksFromTimeline(tl), transitions: extra.transitions === false ? [] : exportTransitionsFromTimeline(tl), totalDuration: tl.duration }, exportItem);
  const model = timelineToComposition(state, { fps: 30, quality: '720p' });
  return { model, warnings, state, clips };
}
const layerBySrc = (model: any, src: string) => model.layers.filter((l: any) => l.src === src);
const base = () => createDefaultTimeline('t');
const V1 = (tl: Timeline) => tl.tracks.find((t) => t.name === 'V1')!.id;
const V2 = (tl: Timeline) => tl.tracks.find((t) => t.name === 'V2')!.id;
const A1 = (tl: Timeline) => tl.tracks.find((t) => t.name === 'A1')!.id;
const A2 = (tl: Timeline) => tl.tracks.find((t) => t.name === 'A2')!.id;
const setClip = (tl: Timeline, i: number, patch: object): Timeline => ({ ...tl, clips: tl.clips.map((c, k) => (k === i ? { ...c, ...patch } : c)) });

describe('export mapping: track state', () => {
  it('a muted video track is not exported; a soloed track silences the others (preview rule)', () => {
    let tl = base(); const v1 = V1(tl); const v2 = V2(tl);
    tl = addClipToTrack(tl, v1, ASSETS[0], 0);
    tl = addClipToTrack(tl, v2, ASSETS[1], 0);
    expect(compose(tl).model.layers.map((l: any) => l.src).sort()).toEqual([ASSETS[0].url, ASSETS[1].url]);
    const muted = updateTrack(tl, v1, { muted: true });
    expect(compose(muted).model.layers.map((l: any) => l.src)).toEqual([ASSETS[1].url]);
    const solo = updateTrack(tl, v2, { solo: true });
    const m = compose(solo).model;
    expect(m.layers.map((l: any) => l.src)).toEqual([ASSETS[1].url]);
    expect(m.audio.every((a: any) => a.src !== ASSETS[0].url)).toBe(true);
  });

  it('track volume scales the audio of an audio-track clip', () => {
    let tl = base();
    tl = addClipToTrack(tl, A1(tl), ASSETS[2], 0);
    tl = updateTrack(tl, A1(tl), { volume: 0.4 });
    const { model } = compose(tl);
    expect(model.audio).toHaveLength(1);
    expect(model.audio[0].volume).toBeCloseTo(0.4, 5);
  });

  it('clip volume x track volume, with a >1 boost clamped to unity and reported', () => {
    let tl = base();
    tl = addClipToTrack(tl, A2(tl), ASSETS[2], 0);
    tl = setClip(tl, 0, { volume: 1.8 });
    const r = compose(tl);
    expect(r.model.audio[0].volume).toBe(1);
    expect(r.warnings.join(' ')).toMatch(/above 100%/);
    tl = setClip(tl, 0, { volume: 0.5 });
    const r2 = compose(updateTrack(tl, A2(tl), { volume: 0.5 }));
    expect(r2.model.audio[0].volume).toBeCloseTo(0.25, 5);
    expect(r2.warnings).toEqual([]);
  });

  it('volume keyframes keep their shape and are scaled by the track volume', () => {
    let tl = base();
    tl = addClipToTrack(tl, A1(tl), ASSETS[2], 0);
    tl = setClip(tl, 0, { keyframes: [{ time: 0, property: 'volume', value: 0 }, { time: 2, property: 'volume', value: 1 }] });
    tl = updateTrack(tl, A1(tl), { volume: 0.5 });
    const a = compose(tl).model.audio[0];
    expect(a.keyframes.volume).toEqual([{ t: 0, v: 0 }, { t: 2, v: 0.5 }]);
    expect(a.volume).toBe(1);
  });

  it('a hidden video track drops the picture but keeps the sound', () => {
    let tl = base();
    tl = addClipToTrack(tl, V1(tl), ASSETS[0], 0);
    tl = updateTrack(tl, V1(tl), { visible: false });
    const { model } = compose(tl);
    expect(model.layers.filter((l: any) => l.kind === 'video')).toHaveLength(0);
    expect(model.audio.some((a: any) => a.src === ASSETS[0].url && a.volume > 0)).toBe(true);
  });

  it('one composition track per CineGen track keeps the stacking order (V2 above V1)', () => {
    let tl = base();
    tl = addClipToTrack(tl, V2(tl), ASSETS[1], 0);
    tl = addClipToTrack(tl, V1(tl), ASSETS[0], 1);
    const order = compose(tl).model.layers.map((l: any) => l.src);
    expect(order).toEqual([ASSETS[0].url, ASSETS[1].url]);
  });
});

describe('export mapping: clip properties', () => {
  it('static opacity and flip reach the composition layer', () => {
    let tl = base();
    tl = addClipToTrack(tl, V1(tl), ASSETS[0], 0);
    tl = setClip(tl, 0, { opacity: 0.4, flipH: true, flipV: true });
    const l = layerBySrc(compose(tl).model, ASSETS[0].url)[0];
    expect(l.flip).toEqual({ h: true, v: true });
    expect(l.keyframes.opacity.length).toBeGreaterThanOrEqual(2);
    expect(l.keyframes.opacity.every((p: any) => p.v === 0.4)).toBe(true);
  });

  it('default clips add no opacity keyframes and no flip (models stay unchanged)', () => {
    let tl = base();
    tl = addClipToTrack(tl, V1(tl), ASSETS[0], 0);
    const l = layerBySrc(compose(tl).model, ASSETS[0].url)[0];
    expect(l.flip).toBeUndefined();
    expect(l.keyframes?.opacity).toBeUndefined();
  });

  it('opacity keyframes still win over static opacity (as in the preview)', () => {
    let tl = base();
    tl = addClipToTrack(tl, V1(tl), ASSETS[0], 0);
    tl = setClip(tl, 0, { opacity: 0.2, keyframes: [{ time: 0, property: 'opacity', value: 1 }, { time: 4, property: 'opacity', value: 0 }] });
    const k = layerBySrc(compose(tl).model, ASSETS[0].url)[0].keyframes.opacity;
    expect(k[0]).toEqual({ t: 0, v: 1 });
    expect(k[k.length - 1].v).toBe(0);
  });
});

describe('export mapping: plain transitions', () => {
  it('fadeToBlack / fadeFromBlack become opacity ramps on the clip', () => {
    let tl = base();
    tl = addClipToTrack(tl, V1(tl), ASSETS[0], 0);
    const id = tl.clips[0].id;
    tl = addTransition(tl, { id: 't1', type: 'fadeToBlack', duration: 2, clipAId: id });
    tl = addTransition(tl, { id: 't2', type: 'fadeFromBlack', duration: 1, clipAId: id });
    const k = layerBySrc(compose(tl).model, ASSETS[0].url)[0].keyframes.opacity;
    expect(k[0]).toEqual({ t: 0, v: 0 });
    expect(k.find((p: any) => p.t === 1)!.v).toBe(1);
    expect(k.find((p: any) => p.t === 8)!.v).toBe(1);
    expect(k[k.length - 1]).toEqual({ t: 10, v: 0 });
  });

  it('a plain dissolve cross-fades A out and B in over the overlap', () => {
    let tl = base();
    tl = addClipToTrack(tl, V1(tl), ASSETS[0], 0);
    tl = addClipToTrack(tl, V2(tl), ASSETS[1], 8);
    // handles: A has 2s of unused tail (trimEnd), B 2s of unused head (trimStart), as addTransition requires
    tl = { ...tl, clips: tl.clips.map((c) => (c.assetId === 'A' ? { ...c, trimEnd: 2 } : c.assetId === 'B' ? { ...c, trimStart: 2 } : c)) };
    const [a, b] = tl.clips.filter((c) => c.trackId === V1(tl) || c.trackId === V2(tl));
    tl = addTransition(tl, { id: 'd', type: 'dissolve', duration: 2, clipAId: a.id, clipBId: b.id });
    const model = compose(tl).model;
    const la = layerBySrc(model, ASSETS[0].url)[0]; const lb = layerBySrc(model, ASSETS[1].url)[0];
    // addTransition shifts B left by the overlap, so the window is [B.start, A.end]
    const bStart = tl.clips.find((c) => c.id === b.id)!.startTime;
    expect(bStart).toBeCloseTo(6, 5); // B was at A's end (8), shifted left by the 2s overlap
    const aEnd = a.startTime + (a.duration - a.trimEnd);
    const win = aEnd - bStart;
    expect(win).toBeGreaterThan(0);
    const ka = la.keyframes.opacity;
    expect(ka[ka.length - 1]).toEqual({ t: aEnd - a.startTime, v: 0 });
    expect(ka.find((p: any) => Math.abs(p.t - (bStart - a.startTime)) < 1e-6)!.v).toBe(1);
    expect(lb.keyframes.opacity[0]).toEqual({ t: 0, v: 0 });
    expect(lb.keyframes.opacity.find((p: any) => Math.abs(p.t - win) < 1e-4)!.v).toBe(1);
  });

  it('GL transitions are left to the GL layer (no opacity ramps added)', () => {
    let tl = base();
    tl = addClipToTrack(tl, V1(tl), ASSETS[0], 0);
    tl = addClipToTrack(tl, V2(tl), ASSETS[1], 10);
    const [a, b] = tl.clips.filter((c) => c.trackId === V1(tl) || c.trackId === V2(tl));
    tl = addTransition(tl, { id: 'g', type: 'dissolve', duration: 2, clipAId: a.id, clipBId: b.id, glType: 'crosswarp' });
    const model = compose(tl).model;
    expect(layerBySrc(model, ASSETS[0].url)[0].keyframes?.opacity).toBeUndefined();
  });
});

describe('opacityEnvelope', () => {
  it('is null for constant unity and exact for a linear ramp', () => {
    expect(opacityEnvelope({ base: 1, kfs: [], ramps: [], duration: 5 })).toBeNull();
    const k = opacityEnvelope({ base: 1, kfs: [], ramps: [{ t0: 0, t1: 4, v0: 0, v1: 1 }], duration: 4 })!;
    expect(k[0]).toEqual({ t: 0, v: 0 });
    expect(k.find((p) => p.t === 2)!.v).toBe(0.5);
  });
});
