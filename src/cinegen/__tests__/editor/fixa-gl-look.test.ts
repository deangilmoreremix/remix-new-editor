// Fix A (1): each side of a GL transition keeps its clip's own transform / keys / effects / opacity. Real data: timeline ops -> export mapping ->
// timelineToComposition -> glTransitions; then the per-frame look the GL layer draws (resolveSideLook) is compared with what the normal clip layer
// uses at the same frames, across the window boundary.
import { describe, it, expect } from 'vitest';
import { createDefaultTimeline, addClipToTrack, updateClipProperties } from '@cinegen/lib/editor/timeline-operations';
import { exportClipsFromTimeline, exportTransitionsFromTimeline, exportTracksFromTimeline, buildExportState, exportItem } from '@cinegen/lib/editor/export-mapping';
import { buildGlTransitionLayers, attachGlSideLooks } from '@cinegen/lib/editor/gl-transition-export';
import { addGlTransition } from '@cinegen/lib/occ/transitions';
import { clipPoseCss, poseAt } from '@cinegen/lib/editor/stage2/anim';
import { applyCssTransform, parseInset } from '../../../openchatcut/gl/styledFrame';
// @ts-expect-error plain JS modules
import { timelineToComposition } from '../../../lib/editor/remotion/timelineToComposition.js';
// @ts-expect-error plain JS modules
import { glSideLayerFrom, resolveSideLook } from '../../../lib/editor/remotion/glSideLook.js';
import type { Asset } from '@cinegen/types/project';

const asset = (id: string): Asset => ({ id, name: id, type: 'video', url: `https://x.test/${id}.mp4`, duration: 6, createdAt: '2026-01-01' });
const FPS = 30;

function build() {
  const assets = [asset('A'), asset('B')];
  let tl = createDefaultTimeline('t');
  const v1 = tl.tracks.find((t) => t.name === 'V1')!.id;
  tl = addClipToTrack(tl, v1, assets[0], 0); tl = addClipToTrack(tl, v1, assets[1], 3);
  const [a, b] = tl.clips.filter((c) => c.trackId === v1);
  tl = { ...tl, duration: 6, clips: tl.clips.map((c) => (c.assetId === 'A' ? { ...c, duration: 6, trimEnd: 3 } : c.assetId === 'B' ? { ...c, duration: 6, trimStart: 1, trimEnd: 2 } : c)) };
  tl = updateClipProperties(tl, a.id, {
    anim: { keys: { x: [{ t: 0, v: 0, ease: 'linear' }, { t: 3, v: 30, ease: 'linear' }], 'fx:0:exposure': [{ t: 0, v: 0, ease: 'linear' }, { t: 3, v: 3, ease: 'linear' }] } },
    fx: [{ id: 'builtin:fx-exposure', props: { exposure: 1.5 } } as never], opacity: 0.5, fadeOut: 1,
  });
  tl = updateClipProperties(tl, b.id, { transform: { x: -10, y: 5, scale: 1.2, rotation: 0, crop: { left: 0.1, top: 0, right: 0, bottom: 0 } }, flipH: true });
  tl = addGlTransition(tl, tl.clips.find((c) => c.id === a.id)!, tl.clips.find((c) => c.id === b.id)!, 'glt-directional-wipe', 1);
  const clips = exportClipsFromTimeline(tl, assets); const transitions = exportTransitionsFromTimeline(tl);
  const { state } = buildExportState({ clips, tracks: exportTracksFromTimeline(tl), transitions, totalDuration: tl.duration }, exportItem);
  const model = timelineToComposition(state, { fps: FPS, quality: '720p' }) as { layers: Array<Record<string, unknown>>; glTransitions?: unknown[] };
  const specs = attachGlSideLooks(buildGlTransitionLayers(transitions, clips as never, FPS), clips as never, model.layers as never, glSideLayerFrom);
  return { tl, a, b, model, spec: specs[0] as never as { from: number; durationInFrames: number; outLook: Record<string, unknown>; innLook: Record<string, unknown> } };
}

describe('Fix A: GL transition sides carry the clip look (export model)', () => {
  it('attaches the composition layer of each clip (also when audio clips shift the export indices) and keeps the old spec without layers', () => {
    const { model, spec, tl } = build();
    expect(spec.from).toBe(60); expect(spec.durationInFrames).toBe(30);
    const layerA = model.layers.find((l) => l.clipAnim && (l.occFx as unknown[] | undefined)?.length)!;
    expect(spec.outLook).toMatchObject({ from: 0, durationInFrames: 90, fit: layerA.fit, occFx: [{ id: 'builtin:fx-exposure' }], clipAnim: { keys: { x: expect.any(Array) } } });
    expect(spec.innLook).toMatchObject({ from: 60, clipTransform: { x: -10, y: 5, scale: 1.2 }, flip: { h: true, v: false } });
    // the layer the look came from is the real one for the clip (ids are c<index in the clip list>)
    expect(model.layers.map((l) => l.id)).toContain('c0');
    const noLayers = attachGlSideLooks(buildGlTransitionLayers(exportTransitionsFromTimeline(tl), exportClipsFromTimeline(tl, [asset('A'), asset('B')]) as never, FPS), [] as never, [], glSideLayerFrom);
    expect(noLayers[0].outLook).toBeUndefined();
  });

  it('A: its keyed x, keyed effect parameter, fade and static opacity continue across the window start (frames 58..62), B starts inside the window with its transform, crop and flip', () => {
    const { spec } = build();
    let prevX: number | null = null;
    for (let f = 56; f <= 64; f++) {
      const r = resolveSideLook(spec.outLook, f, FPS);
      const t = f / FPS;
      // the same pose string the normal clip layer (OccTransform) computes at this clip time
      expect(r.look.cssTransform).toBe(clipPoseCss({ transform: undefined, anim: spec.outLook.clipAnim as never }, t).transform);
      const x = poseAt({ anim: spec.outLook.clipAnim as never }, t).x;
      expect(x).toBeCloseTo(10 * t, 4);
      if (prevX !== null) expect(Math.abs(x - prevX)).toBeLessThan(0.5); // no jump (a raw frame had x = 0 inside the window and 20 % just before it)
      prevX = x;
      expect(r.effects).toHaveLength(1);
    }
    // keyed fx parameter (anim fx:0:exposure 0 -> 3 over 3 s) is sampled at the clip time of each composition frame, as the normal clip layer does
    expect(resolveSideLook(spec.outLook, 60, FPS).effects[0].overrides.exposure).toBeCloseTo(2, 3);
    expect(resolveSideLook(spec.outLook, 75, FPS).effects[0].overrides.exposure).toBeCloseTo(2.5, 3);
    // B at the window start
    const rb = resolveSideLook(spec.innLook, 60, FPS);
    expect(rb.look.cssTransform).toContain('translate(-10%, 5%)');
    expect(rb.look.cssTransform).toContain('scale(1.2)');
    expect(rb.look.flip).toEqual({ h: true, v: false });
    expect(rb.look.clipPath).toContain('inset(0.000% 0.000% 0.000% 10.000%)');
    expect(rb.localFrame).toBe(0);
    expect(resolveSideLook(spec.outLook, 75, FPS).localFrame).toBe(75);
  });

  it('opacity: the static 0.5 and the 1 s fade-out of A reach the side look (envelope key x fade factor), like the normal clip layer', () => {
    const { spec } = build();
    const mid = resolveSideLook(spec.outLook, 60, FPS).look.opacity as number; // clip time 2.0 s: fade-out starts at 2.0 s -> factor 1
    const late = resolveSideLook(spec.outLook, 85, FPS).look.opacity as number; // 2.833 s: fade factor 0.1667
    expect(mid).toBeCloseTo(0.5, 3);
    expect(late).toBeCloseTo(0.5 * (1 - (85 / FPS - 2)), 2);
  });
});

describe('Fix A: styled frame helpers', () => {
  it('applyCssTransform turns the % translate / rotate / scale list into canvas calls about the frame centre', () => {
    const calls: Array<[string, ...number[]]> = [];
    const ctx = { translate: (...a: number[]) => calls.push(['translate', ...a]), rotate: (...a: number[]) => calls.push(['rotate', ...a]), scale: (...a: number[]) => calls.push(['scale', ...a]) } as unknown as CanvasRenderingContext2D;
    applyCssTransform(ctx, 'scale(-1, 1) translate(20%, -10%) rotate(90deg) scale(2)', 1280, 720);
    expect(calls).toEqual([['translate', 640, 360], ['scale', -1, 1], ['translate', 256, -72], ['rotate', Math.PI / 2], ['scale', 2, 2], ['translate', -640, -360]]);
  });
  it('parseInset reads the crop clip-path', () => {
    expect(parseInset('inset(0.000% 5.000% 10.000% 20.000%)')).toEqual({ t: 0, r: 0.05, b: 0.1, l: 0.2 });
    expect(parseInset(undefined)).toBeNull();
  });
});
