// Fix E (1): the GL transition window is composited like a clip (blend mode, background fill, opacity against what is below, z position).
import { describe, it, expect } from 'vitest';
import { createDefaultTimeline, addClipToTrack, updateClipProperties } from '@cinegen/lib/editor/timeline-operations';
import { exportClipsFromTimeline, exportTransitionsFromTimeline, exportTracksFromTimeline, buildExportState, exportItem } from '@cinegen/lib/editor/export-mapping';
import { buildGlTransitionLayers, attachGlSideLooks } from '@cinegen/lib/editor/gl-transition-export';
import { addGlTransition } from '@cinegen/lib/occ/transitions';
// @ts-expect-error plain JS
import { timelineToComposition } from '../../../lib/editor/remotion/timelineToComposition.js';
// @ts-expect-error plain JS
import { glSideLayerFrom, resolveSideLook } from '../../../lib/editor/remotion/glSideLook.js';
import { drawStyledFrame } from '../../../openchatcut/gl/styledFrame';
import type { Asset } from '@cinegen/types/project';

const asset = (id: string): Asset => ({ id, name: id, type: 'video', url: `https://x.test/${id}.mp4`, duration: 10, createdAt: '2026-01-01' });
const ASSETS = [asset('A'), asset('B'), asset('L')];

function build() {
  let tl = createDefaultTimeline('t');
  const v1 = tl.tracks.find((t) => t.name === 'V1')!.id; const v2 = tl.tracks.find((t) => t.name === 'V2')!.id;
  tl = addClipToTrack(tl, v1, ASSETS[2], 0);
  tl = addClipToTrack(tl, v2, ASSETS[0], 0); tl = addClipToTrack(tl, v2, ASSETS[1], 3);
  tl = { ...tl, clips: tl.clips.map((c) => (c.assetId === 'L' ? { ...c, duration: 6 } : { ...c, duration: 10, trimStart: 2, trimEnd: 5 })), duration: 6 };
  const [a, b] = tl.clips.filter((c) => c.trackId === v2);
  for (const c of [a, b]) tl = updateClipProperties(tl, c.id, { opacity: 0.6, blendMode: 'screen', transform: { x: 0, y: 0, scale: 0.8, rotation: 0, fit: 'contain', fill: 50 } } as never);
  tl = addGlTransition(tl, tl.clips.find((c) => c.id === a.id)!, tl.clips.find((c) => c.id === b.id)!, 'cross-dissolve', 1);
  const clips = exportClipsFromTimeline(tl, ASSETS); const transitions = exportTransitionsFromTimeline(tl);
  const { state } = buildExportState({ clips, tracks: exportTracksFromTimeline(tl), transitions, totalDuration: tl.duration }, exportItem);
  const model = timelineToComposition(state, { fps: 30, quality: '720p' }) as { layers: Array<Record<string, any>>; glTransitions?: any[] };
  model.glTransitions = attachGlSideLooks(buildGlTransitionLayers(transitions, clips as never, 30), clips as never, model.layers as never, glSideLayerFrom);
  return { model, tl };
}

describe('Fix E: GL transition window composition', () => {
  it('the spec names the two composition layers, and they carry blend mode, opacity keys and the fill', () => {
    const { model } = build();
    const g = model.glTransitions![0];
    const out = model.layers.find((l) => l.id === g.outLayerId); const inn = model.layers.find((l) => l.id === g.innLayerId);
    expect(out && inn).toBeTruthy();
    // the window is drawn at the incoming layer's z position: it sits on the same track, above the lower-track clip
    expect(model.layers.indexOf(inn!)).toBeGreaterThan(model.layers.findIndex((l) => l.kind === 'video' && l.id !== out!.id && l.id !== inn!.id) - 99);
    for (const side of [g.outLook, g.innLook]) {
      expect(side.clipBlend).toBe('screen'); expect(side.clipTransform.fill).toBe(50); expect(side.keyframes.opacity.length).toBeGreaterThan(0);
    }
  });

  it('resolveSideLook: opacity 0.6 and the fill (moved by key transform only) at every frame of the window, no jump at its start', () => {
    const { model } = build();
    const g = model.glTransitions![0];
    const at = (side: any, f: number) => resolveSideLook(side, f, 30);
    for (let f = g.from - 2; f <= g.from + 2; f++) { const r = at(g.outLook, f); expect(r.look.opacity).toBeCloseTo(0.6, 3); expect(r.fill).toMatchObject({ strength: 50 }); expect(r.fill.opacity).toBeCloseTo(0.6, 3); }
    expect(at(g.innLook, g.from + g.durationInFrames - 1).look.opacity).toBeCloseTo(0.6, 3);
  });

  it('drawStyledFrame: keeps alpha (no background), draws the fill first with its own opacity, and composites with the blend mode when keeping the canvas', () => {
    const calls: string[] = []; const stack: Array<[string, number, string]> = [];
    const ctx: any = {
      canvas: { width: 100, height: 50 }, filter: '', globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '',
      setTransform: () => calls.push('setTransform'), clearRect: () => calls.push('clear'), fillRect: () => calls.push('fillRect'),
      save: () => { stack.push([ctx.filter, ctx.globalAlpha, ctx.globalCompositeOperation]); }, restore: () => { [ctx.filter, ctx.globalAlpha, ctx.globalCompositeOperation] = stack.pop() as [string, number, string]; }, translate: () => {}, scale: () => {}, rotate: () => {}, beginPath: () => {}, rect: () => {}, clip: () => {},
      drawImage: (src: any) => calls.push(`draw:${src.tag}:${ctx.globalAlpha}:${ctx.globalCompositeOperation}:${ctx.filter}`),
    };
    drawStyledFrame(ctx, { tag: 'pic' } as any, { opacity: 0.6, fill: { source: { tag: 'fill' } as any, filter: 'blur(9px)', scale: 1.1, opacity: 0.6 } });
    expect(calls).not.toContain('fillRect'); expect(calls[1]).toBe('clear');
    expect(calls.filter((c) => c.startsWith('draw'))).toEqual(['draw:fill:0.6:source-over:blur(9px)', 'draw:pic:0.6:source-over:']);
    calls.length = 0;
    drawStyledFrame(ctx, { tag: 'pic' } as any, { opacity: 1, keep: true, blend: 'multiply' });
    expect(calls).not.toContain('clear'); expect(calls.find((c) => c.startsWith('draw'))).toBe('draw:pic:1:multiply:');
  });
});
