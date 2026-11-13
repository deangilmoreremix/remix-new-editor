// Stage 6: vendored gl-transitions in the CineGen editor. Real timeline operations, the real row converters (project save/load),
// the real export mapping, and the real composition model. Nothing under test is mocked.
import { describe, it, expect } from 'vitest';
import { createDefaultTimeline, addClipToTrack } from '@cinegen/lib/editor/timeline-operations';
import { exportClipsFromTimeline, exportTransitionsFromTimeline, exportTracksFromTimeline, buildExportState, exportItem } from '@cinegen/lib/editor/export-mapping';
import { buildGlTransitionLayers } from '@cinegen/lib/editor/gl-transition-export';
import { addGlTransition, setGlParams, setGlType, activeGlTransition, glTransitionLabel } from '@cinegen/lib/occ/transitions';
import { resolveTransition, isKnownTransition } from '@cinegen/lib/occ/plugins';
import { timelineFromRows, trackToRow, clipToRow, transitionToRow, transitionFromRow } from '@cinegen/lib/db-converters';
// @ts-expect-error plain JS module
import { timelineToComposition } from '../../../lib/editor/remotion/timelineToComposition.js';
import { gltFrag, gltUniforms } from '../../../openchatcut/gl/glt';
import { clipEndTime } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';
import type { Timeline } from '@cinegen/types/timeline';

const asset = (id: string, duration = 10): Asset => ({ id, name: id, type: 'video', url: `https://x.test/${id}.mp4`, duration, createdAt: '2026-01-01' });
const ASSETS = [asset('A'), asset('B')];
const trackId = (tl: Timeline, n: string) => tl.tracks.find((t) => t.name === n)!.id;

function twoClips(): { tl: Timeline; a: Timeline['clips'][number]; b: Timeline['clips'][number] } {
  let tl = createDefaultTimeline('t');
  tl = addClipToTrack(tl, trackId(tl, 'V1'), ASSETS[0], 0);
  tl = addClipToTrack(tl, trackId(tl, 'V2'), ASSETS[1], 7);
  // spare source material on both sides of the cut (CineGen needs trim handles to overlap clips)
  const vids = tl.clips.filter((c) => c.trackId === trackId(tl, 'V1') || c.trackId === trackId(tl, 'V2'));
  tl = { ...tl, clips: tl.clips.map((c) => (c.id === vids[0].id ? { ...c, trimEnd: 3 } : c.id === vids[1].id ? { ...c, trimStart: 3 } : c)) };
  const [a, b] = tl.clips.filter((c) => vids.some((v) => v.id === c.id));
  return { tl, a, b };
}

describe('Stage 6: vendored gl-transitions in a project', () => {
  it('glt transitions are known to the preview resolver and use the wrapped shader + stored params', () => {
    expect(isKnownTransition('glt-cube')).toBe(true);
    const r = resolveTransition('glt-cube', undefined, { persp: 0.2 })!;
    expect(r.frag).toBe(gltFrag('glt-cube'));
    expect((r.uniforms({ time: 0, aspect: 1.7 }) as Record<string, number>).persp).toBe(0.2);
    expect(glTransitionLabel('glt-cross-warp')).toBe('Cross Warp');
  });

  it('project save -> load round trip keeps glType + glParams (db rows), and old rows without params still load', () => {
    const { tl, a, b } = twoClips();
    const withTr = addGlTransition(tl, a, b, 'glt-cube', 1, undefined, { persp: 0.2, floating: 5 });
    const tr = withTr.transitions[0];
    expect(tr).toMatchObject({ glType: 'glt-cube', glParams: { persp: 0.2, floating: 5 } });
    const rows = withTr.clips.map((c) => ({ ...clipToRow(c, withTr.id), keyframes: [] }));
    const trRows = withTr.transitions.map((t) => transitionToRow(t, withTr.id));
    expect(trRows[0].gl_params_json).toBe(JSON.stringify({ persp: 0.2, floating: 5 }));
    // through JSON like the project store does
    const loaded = timelineFromRows({ id: withTr.id, name: withTr.name, duration: withTr.duration, markers: '[]' }, withTr.tracks.map((t, i) => trackToRow(t, withTr.id, i)), JSON.parse(JSON.stringify(rows)), JSON.parse(JSON.stringify(trRows)));
    expect(loaded.transitions[0]).toEqual(tr);
    // JSON project path (unknown fields kept as they are)
    expect(JSON.parse(JSON.stringify(withTr)).transitions[0]).toEqual(tr);
    // a row saved before Stage 6 (no gl_params_json) loads without params
    const legacyRow = { ...trRows[0] }; delete legacyRow.gl_params_json;
    expect(transitionFromRow(legacyRow).glParams).toBeUndefined();
    expect(transitionFromRow(legacyRow).glType).toBe('glt-cube');
    // no params -> column stays null
    expect(transitionToRow({ ...tr, glParams: undefined }, withTr.id).gl_params_json).toBeNull();
  });

  it('setGlParams edits and clears overrides; changing the type resets them', () => {
    const { tl, a, b } = twoClips();
    let t2 = addGlTransition(tl, a, b, 'glt-pixelize', 1);
    const id = t2.transitions[0].id;
    expect(t2.transitions[0].glParams).toBeUndefined();
    t2 = setGlParams(t2, id, { squaresMin: [4, 4], reverse: true });
    expect(t2.transitions[0].glParams).toEqual({ squaresMin: [4, 4], reverse: true });
    t2 = setGlType(t2, id, 'glt-swirl');
    expect(t2.transitions[0].glParams).toBeUndefined();
    t2 = setGlParams(setGlParams(t2, id, { rotation: 3 }), id, {});
    expect(t2.transitions[0].glParams).toBeUndefined();
  });

  it('preview: the active transition carries its params at mid-overlap', () => {
    const { tl, a, b } = twoClips();
    const t2 = addGlTransition(tl, a, b, 'glt-ripple', 1, undefined, { amplitude: 50 });
    const nb = t2.clips.find((c) => c.id === b.id)!;
    const na = t2.clips.find((c) => c.id === a.id)!;
    const mid = (nb.startTime + clipEndTime(na)) / 2;
    const act = activeGlTransition(t2, mid)!;
    expect(act).toMatchObject({ glType: 'glt-ripple', glParams: { amplitude: 50 } });
    expect(act.progress).toBeGreaterThan(0.3); expect(act.progress).toBeLessThan(0.7);
  });
});

describe('Stage 6: export mapping carries vendored transitions', () => {
  it('exportTransitionsFromTimeline -> buildGlTransitionLayers -> composition model contains the glt layer with params and the window', () => {
    const { tl, a, b } = twoClips();
    const t2 = addGlTransition(tl, a, b, 'glt-doorway', 1, undefined, { reflection: 0.1 });
    const clips = exportClipsFromTimeline(t2, ASSETS);
    const transitions = exportTransitionsFromTimeline(t2);
    expect(transitions[0]).toMatchObject({ glType: 'glt-doorway', glParams: { reflection: 0.1 } });
    const layers = buildGlTransitionLayers(transitions, clips as never, 30);
    expect(layers).toHaveLength(1);
    const L = layers[0];
    const nb = t2.clips.find((c) => c.id === b.id)!; const na = t2.clips.find((c) => c.id === a.id)!;
    expect(L).toMatchObject({ glType: 'glt-doorway', glParams: { reflection: 0.1 }, from: Math.round(nb.startTime * 30), durationInFrames: Math.round((clipEndTime(na) - nb.startTime) * 30) });
    expect(L.out.src).toBe(ASSETS[0].url); expect(L.inn.src).toBe(ASSETS[1].url);
    expect(L.customDef).toBeUndefined(); // vendored shaders are resolved by id inside the renderer, not shipped as a snapshot
    // the real composition builder keeps plain dissolve ramps off GL cuts, and the layer survives structured clone (postMessage to the runner)
    const { state } = buildExportState({ clips, tracks: exportTracksFromTimeline(t2), transitions, totalDuration: t2.duration }, exportItem);
    const model = timelineToComposition(state, { fps: 30, quality: '720p' }) as { layers: Array<{ src?: string; keyframes?: { opacity?: unknown } }> & unknown[] };
    expect(model.layers.find((l) => l.src === ASSETS[0].url)?.keyframes?.opacity).toBeUndefined();
    (model as unknown as { glTransitions: unknown }).glTransitions = layers;
    expect(structuredClone(model).glTransitions).toEqual(layers);
    expect(gltUniforms('glt-doorway', L.glParams).reflection).toBe(0.1);
  });

  it('a plain dissolve (no glType) is not emitted as a GL layer; unknown glParams do not leak when absent', () => {
    const { tl, a, b } = twoClips();
    const t2 = addGlTransition(tl, a, b, 'glt-cube', 1);
    expect(exportTransitionsFromTimeline(t2)[0]).not.toHaveProperty('glParams');
    expect(buildGlTransitionLayers([{ clipAId: a.id, clipBId: b.id }], exportClipsFromTimeline(t2, ASSETS) as never, 30)).toEqual([]);
  });
});
