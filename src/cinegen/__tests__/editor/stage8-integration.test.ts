// Stage 8 (CineGen): interaction tests across Stages 1-6. Each stage has its own tests; these combine the features the way a project does:
// save/load of EVERY new field in one project (the DB row converters the web store uses), and export parity of the same combined timeline
// (real exportClipsFromTimeline + buildExportState + timelineToComposition) including audio (no silent / doubled exports).
import { describe, it, expect } from 'vitest';
import { createDefaultTimeline, addClipToTrack, updateClipProperties } from '@cinegen/lib/editor/timeline-operations';
import { groupClips, createCompound, flattenCompounds, applySpeedRamp, RAMP_PRESETS } from '@cinegen/lib/editor/stage1';
import { addGlTransition } from '@cinegen/lib/occ/transitions';
import { clipToRow, timelineFromRows, trackToRow, transitionToRow } from '@cinegen/lib/db-converters';
import { exportClipsFromTimeline, exportTracksFromTimeline, exportTransitionsFromTimeline, exportItem } from '@cinegen/lib/editor/export-mapping';
import { buildExportStateWithAudio } from '@cinegen/lib/audio/export-prepare';
import { defaultClipEq } from '@cinegen/lib/audio/eq';
import { buildGlTransitionLayers } from '@cinegen/lib/editor/gl-transition-export';
import { migrateSequenceToTimelines } from '@cinegen/lib/editor/timeline-migration';
import { timelineToComposition } from '../../../lib/editor/remotion/timelineToComposition.js';
import type { Asset } from '@cinegen/types/project';
import type { Timeline } from '@cinegen/types/timeline';

const asset = (id: string, duration = 10): Asset => ({ id, name: id, type: 'video', url: `https://x.test/${id}.mp4`, duration, createdAt: '2026-01-01' });
const A = asset('A'); const B = asset('B');
const T = (tl: Timeline, n: string) => tl.tracks.find((t) => t.name === n)!.id;
const clone = <X,>(x: X): X => JSON.parse(JSON.stringify(x));

/** V1: A (0-3, spare 7 s at the end), B (3-6 after trim, spare 1 s before) with linked audio on A1; every new field set. */
function featureTimeline(): { tl: Timeline; aId: string; aAudId: string; bId: string } {
  let tl = createDefaultTimeline('t');
  tl = addClipToTrack(tl, T(tl, 'V1'), A, 0);
  tl = addClipToTrack(tl, T(tl, 'V1'), B, 3);
  const a = tl.clips.find((c) => c.assetId === 'A' && c.trackId === T(tl, 'V1'))!;
  const aAud = tl.clips.find((c) => c.assetId === 'A' && c.trackId !== T(tl, 'V1'))!;
  const b = tl.clips.find((c) => c.assetId === 'B' && c.trackId === T(tl, 'V1'))!;
  const bAud = tl.clips.find((c) => c.assetId === 'B' && c.trackId !== T(tl, 'V1'))!;
  const trim = (id: string, trimStart: number, trimEnd: number, duration: number) => { tl = { ...tl, clips: tl.clips.map((c) => (c.id === id ? { ...c, trimStart, trimEnd, duration: 10 } : c)) }; void duration; };
  trim(a.id, 0, 7, 3); trim(aAud.id, 0, 7, 3); trim(b.id, 1, 6, 3); trim(bAud.id, 1, 6, 3);
  tl = updateClipProperties(tl, a.id, { anim: { keys: { x: [{ t: 0.25, v: -30, ease: 'ease-out' }, { t: 1.25, v: 30, ease: { bezier: [0.4, 0, 0.2, 1] } }], 'fx:0:exposure': [{ t: 0, v: -1 }, { t: 2, v: 1, ease: { spring: { tension: 170, friction: 26, mass: 1 } } }] }, modifiers: [{ id: 'm1', type: 'sway', enabled: true, amplitude: 1, frequency: 0.5, phase: 0, seed: 1 }] } } as never);
  tl = updateClipProperties(tl, a.id, { fx: [{ id: 'builtin:fx-exposure', props: { exposure: 0.5 }, keys: { exposure: [{ frame: 0, value: -2 }, { frame: 60, value: 1.5 }] } } as never, { id: 'builtin:fx-glass', props: { amount: 0.02 } } as never, { id: 'builtin:fx-scanlines', props: {} } as never] });
  tl = updateClipProperties(tl, aAud.id, { eq: { ...defaultClipEq(), enabled: true, bands: defaultClipEq().bands.map((b, i) => (i === 1 ? { ...b, enabled: true, frequency: 440, gain: -12 } : b)) } });
  tl = groupClips(tl, [a.id, aAud.id]).timeline;
  tl = addGlTransition(tl, tl.clips.find((c) => c.id === a.id)!, tl.clips.find((c) => c.id === b.id)!, 'glt-directional-wipe', 0.5, undefined, { direction: [1, 0], smoothness: 0 });
  tl = { ...tl, masterVolume: 0.5 };
  void bAud;
  return { tl, aId: a.id, aAudId: aAud.id, bId: b.id };
}

/** the same serialisation the workspace shell uses when it saves a project (components/workspace/workspace-shell.tsx) */
function toRows(tl: Timeline) {
  return {
    id: tl.id, project_id: 'p', name: tl.name, duration: tl.duration, created_at: '',
    tracks: tl.tracks.map((t, i) => trackToRow(t, tl.id, i)),
    clips: tl.clips.map((c) => ({ ...clipToRow(c, tl.id), created_at: '', keyframes: (c.keyframes ?? []).map((k) => ({ id: '', clip_id: c.id, time: k.time, property: k.property, value: k.value })) })),
    transitions: tl.transitions.map((t) => transitionToRow(t, tl.id)),
    markers: JSON.stringify(tl.markers ?? []), master_volume: tl.masterVolume ?? null,
  };
}
const fromRows = (r: ReturnType<typeof toRows>) => timelineFromRows(r as never, r.tracks as never, r.clips as never, r.transitions as never);

describe('Stage 8: save -> load of every field added by Stages 1-6 in one project', () => {
  it('rows (web store JSON) round trip: anim keys/modifiers, fx + param keys, groupId, eq, glType + glParams, masterVolume', () => {
    const { tl, aId, aAudId } = featureTimeline();
    const stored = clone(toRows(tl)); // what IndexedDB / the db RPC keeps
    const back = fromRows(stored);
    const ba = back.clips.find((c) => c.id === aId)!; const oa = tl.clips.find((c) => c.id === aId)!;
    expect(ba.anim).toEqual(oa.anim);
    expect(ba.fx).toEqual(oa.fx);
    expect(ba.groupId).toBe(oa.groupId); expect(ba.groupId).toBeTruthy();
    expect(back.clips.find((c) => c.id === aAudId)!.eq).toEqual(tl.clips.find((c) => c.id === aAudId)!.eq);
    expect(back.clips.find((c) => c.id === aAudId)!.groupId).toBe(oa.groupId);
    expect(back.transitions[0]).toMatchObject({ glType: 'glt-directional-wipe', glParams: { direction: [1, 0], smoothness: 0 } });
    expect(back.masterVolume).toBe(0.5);
    // B was moved left by the transition; positions survive
    for (const c of tl.clips) { const r = back.clips.find((x) => x.id === c.id)!; expect([r.startTime, r.duration, r.trimStart, r.trimEnd]).toEqual([c.startTime, c.duration, c.trimStart, c.trimEnd]); }
  });
  it('compound clip with animated + effected children round trips, and the loaded project flattens to the same clips', () => {
    const { tl, aId, aAudId } = featureTimeline();
    const made = createCompound(tl, [aId, aAudId]);
    expect(made.compoundId).toBeTruthy();
    const back = fromRows(clone(toRows(made.timeline)));
    const comp = back.clips.find((c) => c.id === made.compoundId)!;
    const inner = comp.compound!.clips.find((c) => c.assetId === 'A' && !!c.anim)!;
    expect(inner.anim).toEqual(tl.clips.find((c) => c.id === aId)!.anim);
    expect(inner.fx).toHaveLength(3);
    expect(comp.compound!.clips.find((c) => c.eq)?.eq).toEqual(tl.clips.find((c) => c.id === aAudId)!.eq);
    const flatA = flattenCompounds(made.timeline).clips.map((c) => [c.assetId, c.startTime, c.duration, !!c.anim, !!c.fx, !!c.eq]);
    const flatB = flattenCompounds(back).clips.map((c) => [c.assetId, c.startTime, c.duration, !!c.anim, !!c.fx, !!c.eq]);
    expect(flatB).toEqual(flatA);
  });
  it('a project saved before Stages 1-6 (no new fields anywhere) still loads with no new fields attached', () => {
    const { tl } = featureTimeline();
    const rows = clone(toRows(tl));
    for (const c of rows.clips) { for (const k of ['fx_json', 'stage1_json', 'stage4_json']) delete (c as Record<string, unknown>)[k]; }
    for (const t of rows.transitions) { delete (t as Record<string, unknown>).gl_params_json; delete (t as Record<string, unknown>).gl_type; }
    delete (rows as Record<string, unknown>).master_volume;
    const back = fromRows(rows as never);
    expect(back.clips).toHaveLength(tl.clips.length);
    for (const c of back.clips) { expect(c.anim).toBeUndefined(); expect(c.fx).toBeUndefined(); expect(c.eq).toBeUndefined(); expect(c.groupId).toBeUndefined(); }
    expect(back.masterVolume).toBeUndefined(); expect(back.transitions[0].glParams).toBeUndefined();
  });
  it('JSON project path (migrateSequenceToTimelines) keeps every new field too', () => {
    const { tl, aId } = featureTimeline();
    const loaded = migrateSequenceToTimelines(clone({ timelines: [tl] })).timelines[0] as Timeline;
    expect(loaded.clips.find((c) => c.id === aId)!.anim).toEqual(tl.clips.find((c) => c.id === aId)!.anim);
    expect(loaded.transitions[0].glParams).toEqual({ direction: [1, 0], smoothness: 0 });
    expect(loaded.masterVolume).toBe(0.5);
  });
});

describe('Stage 8: export parity of the combined project (nothing a stage added is dropped on the way to the composition)', () => {
  const compose = async (tl: Timeline, assets: Asset[]) => {
    const flat = flattenCompounds(tl);
    const clips = exportClipsFromTimeline(flat, assets);
    const transitions = exportTransitionsFromTimeline(flat);
    const built = await buildExportStateWithAudio({ clips: clips as never, tracks: exportTracksFromTimeline(flat), transitions, totalDuration: tl.duration, masterVolume: flat.masterVolume ?? 1 }, exportItem as never, undefined, async (url) => `${url}#eq-baked`);
    const model = timelineToComposition(built.state, { fps: 30, quality: '720p' }) as { layers: any[]; audio: any[]; glTransitions?: unknown[] };
    model.glTransitions = buildGlTransitionLayers(transitions, clips as never, 30);
    return { model, clips, transitions, built };
  };
  it('anim, fx (+ param keys), glParams, master volume and the baked EQ all reach the composition model', async () => {
    const { tl } = featureTimeline();
    const { model, built } = await compose(tl, [A, B]);
    const layerA = model.layers.find((l) => l.src === A.url)!;
    expect(layerA.clipAnim?.keys?.x).toHaveLength(2);
    expect(layerA.clipAnim?.modifiers?.[0]?.type).toBe('sway');
    expect(JSON.stringify(layerA.occFx ?? layerA)).toContain('builtin:fx-exposure');
    expect(JSON.stringify(layerA.occFx ?? layerA)).toContain('builtin:fx-glass');
    expect(JSON.stringify(layerA.occFx ?? layerA)).toContain('builtin:fx-scanlines');
    expect(model.glTransitions).toHaveLength(1);
    expect(model.glTransitions![0]).toMatchObject({ glType: 'glt-directional-wipe', glParams: { direction: [1, 0], smoothness: 0 } });
    // audio: the video clip's own sound is off (linked audio carries it), the audio clips carry master volume, A's audio comes from the EQ bake
    const aud = model.audio.find((a) => String(a.src).includes('A.mp4'))!;
    expect(aud.src).toContain('#eq-baked');
    expect(aud.volume ?? aud.volumeKeyframes ?? 0.5).toBeCloseTo(0.5, 5);
    expect(built.warnings).toEqual([]);
  });
  it('every clip with a linked audio clip is silent in video and audible once through its audio clip, master volume applied once', async () => {
    const { tl } = featureTimeline();
    const { built } = await compose(tl, [A, B]);
    const items = built.state.tracks.flatMap((t) => (t.items as Array<{ id: string; type?: string; src?: string; volume?: number }>).map((i) => ({ ...i, kind: t.type })));
    for (const asset of ['A', 'B']) {
      const v = items.filter((i) => i.kind === 'video' && String(i.src).includes(`/${asset}.mp4`));
      const a = items.filter((i) => i.kind === 'audio' && String(i.src).includes(`/${asset}.mp4`));
      expect(v).toHaveLength(1); expect(a).toHaveLength(1);
      expect(v[0].volume).toBe(0); expect(a[0].volume).toBeCloseTo(0.5, 5);
    }
  });
  it('a video clip WITHOUT a linked audio clip keeps its own sound (no silent export), scaled by master volume', async () => {
    let tl = createDefaultTimeline('t'); tl = addClipToTrack(tl, T(tl, 'V1'), A, 0);
    const v = tl.clips.find((c) => c.trackId === T(tl, 'V1'))!;
    tl = { ...tl, clips: tl.clips.filter((c) => c.id === v.id).map((c) => ({ ...c, linkedClipIds: undefined })), masterVolume: 0.5 };
    const { built } = await compose(tl, [A]);
    const items = built.state.tracks.flatMap((t) => t.items as Array<{ volume?: number }>);
    expect(items).toHaveLength(1); expect(items[0].volume).toBeCloseTo(0.5, 5);
  });
  it('speed-ramped and nested clips keep exactly one audible copy of their sound per piece', async () => {
    let tl = createDefaultTimeline('t'); tl = addClipToTrack(tl, T(tl, 'V1'), A, 0);
    const v = tl.clips.find((c) => c.trackId === T(tl, 'V1'))!;
    const ramped = applySpeedRamp(tl, v.id, RAMP_PRESETS['slow-dip'].points).timeline;
    const { built: rb } = await compose(ramped, [A]);
    const rItems = rb.state.tracks.flatMap((t) => (t.items as Array<{ volume?: number }>).map((i) => ({ ...i, kind: t.type })));
    const rv = rItems.filter((i) => i.kind === 'video'); const ra = rItems.filter((i) => i.kind === 'audio');
    expect(rv.length).toBeGreaterThan(2); expect(ra).toHaveLength(rv.length);
    expect(rv.every((i) => i.volume === 0)).toBe(true); expect(ra.every((i) => (i.volume ?? 0) > 0.99)).toBe(true);
    const nested = createCompound(tl, tl.clips.map((c) => c.id)).timeline;
    const { built: nb } = await compose(nested, [A]);
    const nItems = nb.state.tracks.flatMap((t) => (t.items as Array<{ volume?: number }>).map((i) => ({ ...i, kind: t.type })));
    expect(nItems.filter((i) => i.kind === 'audio')).toHaveLength(1);
    expect(nItems.filter((i) => i.kind === 'video').every((i) => i.volume === 0)).toBe(true);
  });
});

describe('Stage 8: a transition keeps clip B in sync with its linked audio', () => {
  it('addTransition / addGlTransition shift B and the audio linked to it together (picture and sound stay aligned, no black tail)', () => {
    const { tl, aId, bId } = featureTimeline();
    const b = tl.clips.find((c) => c.id === bId)!;
    const bAud = tl.clips.find((c) => c.assetId === 'B' && c.trackId !== b.trackId)!;
    expect(bAud.startTime).toBeCloseTo(b.startTime, 6); // synced after the transition
    expect(b.startTime).toBeCloseTo(2.5, 6); // 3.0 shifted left by the 0.5 s transition
    expect(tl.duration).toBeCloseTo(5.5, 6); // total shortened by the overlap, for picture AND sound
    const a = tl.clips.find((c) => c.id === aId)!;
    expect(a.startTime).toBe(0);
  });
  it('a linked clip that was NOT in sync with B (user slipped the audio) keeps its offset', () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, T(tl, 'V1'), A, 0); tl = addClipToTrack(tl, T(tl, 'V1'), B, 3);
    const v = tl.clips.filter((c) => c.trackId === T(tl, 'V1')); const [a, b] = v;
    const bAud = tl.clips.find((c) => c.assetId === 'B' && c.trackId !== b.trackId)!;
    tl = { ...tl, clips: tl.clips.map((c) => (c.id === a.id ? { ...c, trimEnd: 3 } : c.id === b.id ? { ...c, trimStart: 3 } : c.id === bAud.id ? { ...c, startTime: c.startTime + 0.2 } : c)) };
    const out = addGlTransition(tl, tl.clips.find((c) => c.id === a.id)!, tl.clips.find((c) => c.id === b.id)!, 'glt-pixelize', 1);
    expect(out.clips.find((c) => c.id === bAud.id)!.startTime).toBeCloseTo(3.2, 6);
    expect(out.clips.find((c) => c.id === b.id)!.startTime).toBeLessThan(3);
  });
});
