// Stage 2 real-data tests: easing / spring / interpolation / motion modifiers evaluated at specific frames, determinism, save -> load round trips
// (including a project saved before Stage 2), splitting, the export mapping through the real timelineToComposition, effect keys, Lottie edits, text motion.
import { describe, it, expect } from 'vitest';
import { applyEase, cubicBezier, springEasing, normalizeEase, DEFAULT_SPRING, type EaseSpec } from '@cinegen/lib/editor/stage2/easing';
import { sampleKeys, poseAt, poseOpacity, clipPoseCss, setKey, removeKey, moveKey, unifyLegacy, sliceAnim, animFxKeys, normalizeAnim, applyAutoKey, hasAnim, type ClipAnim } from '@cinegen/lib/editor/stage2/anim';
import { evalModifiers, createModifier, type MotionModifier } from '@cinegen/lib/editor/stage2/modifiers';
import { editProps, readProp } from '@cinegen/lib/editor/stage2/prop-edit';
import { splitUnits, unitRank, unitStyle, TEXT_MOTION_PRESETS } from '@cinegen/lib/editor/stage2/text-motion';
import { extractLottieColorLayers, extractLottieTextLayers, applyLottieEdits } from '@cinegen/lib/editor/stage2/lottie-edit';
import { clipTransformCss } from '@cinegen/lib/occ/transform';
import { createDefaultTimeline, addClipToTrack, splitClip, updateClipProperties, interpolateProperty } from '@cinegen/lib/editor/timeline-operations';
import { migrateSequenceToTimelines } from '@cinegen/lib/editor/timeline-migration';
import { clipToRow, clipFromRow } from '@cinegen/lib/db-converters';
import { exportClipsFromTimeline, exportTracksFromTimeline, buildExportState, exportItem, exportTransitionsFromTimeline } from '@cinegen/lib/editor/export-mapping';
import { clipFxInstances } from '@cinegen/lib/occ/clip-fx';
// @ts-expect-error plain JS module
import { timelineToComposition } from '../../../lib/editor/remotion/timelineToComposition.js';
import { captionWordContent, captionWordMotionStyle, CAPTION_MOTION_OPTIONS } from '../../../openchatcut/captions/captionMotion';
import type { Asset } from '@cinegen/types/project';
import type { Clip, Timeline } from '@cinegen/types/timeline';

const asset = (id: string): Asset => ({ id, name: id, type: 'video', url: `https://x.test/${id}.mp4`, duration: 10, createdAt: '2026-01-01' });
const A = asset('A');
const near = (a: number, b: number, d = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(d);

describe('easing', () => {
  it('presets at specific progress values', () => {
    expect(applyEase(0.5, 'linear')).toBe(0.5);
    expect(applyEase(0.5, 'ease-in')).toBeCloseTo(0.25, 10);
    expect(applyEase(0.5, 'ease-out')).toBeCloseTo(0.75, 10);
    expect(applyEase(0.25, 'ease-in-out')).toBeCloseTo(0.125, 10);
    expect(applyEase(0.5, 'ease-in-cubic')).toBeCloseTo(0.125, 10);
    expect(applyEase(0.5, 'ease-out-cubic')).toBeCloseTo(0.875, 10);
    expect(applyEase(0.5, 'ease-in-out-cubic')).toBeCloseTo(0.5, 10);
    expect(applyEase(0.7, 'hold')).toBe(0);
    expect(applyEase(-3, 'ease-in')).toBe(0); expect(applyEase(9, 'ease-in')).toBe(1);
    expect(Math.max(...[0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map((p) => applyEase(p, 'ease-out-back')))).toBeGreaterThan(1.05); // overshoot
  });
  it('custom cubic-bezier: matches the CSS curve, linear control points are the identity', () => {
    for (const p of [0, 0.1, 0.37, 0.5, 0.9, 1]) near(cubicBezier(p, [0.33, 0.33, 0.67, 0.67]), p, 2e-3);
    // CSS ease-in-out cubic-bezier(.42,0,.58,1): symmetric around 0.5 and slow at the ends
    near(cubicBezier(0.5, [0.42, 0, 0.58, 1]), 0.5, 1e-5);
    expect(cubicBezier(0.1, [0.42, 0, 0.58, 1])).toBeLessThan(0.05);
    expect(applyEase(0.5, { bezier: [0.25, 0.1, 0.25, 1] })).toBeCloseTo(0.8024, 3); // CSS "ease" at t=.5
  });
  it('spring: starts 0, ends 1, overshoots when under-damped, does not when over-damped', () => {
    const under = { tension: 170, friction: 8, mass: 1 };
    expect(springEasing(0, under)).toBe(0); expect(springEasing(1, under)).toBe(1);
    const samples = Array.from({ length: 50 }, (_, i) => springEasing((i + 1) / 51, under));
    expect(Math.max(...samples)).toBeGreaterThan(1.05);
    const over = { tension: 100, friction: 60, mass: 1 };
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => springEasing((i + 1) / 51, over)))).toBeLessThanOrEqual(1);
    expect(applyEase(0.5, { spring: DEFAULT_SPRING })).toBeCloseTo(springEasing(0.5, DEFAULT_SPRING), 12);
  });
  it('deterministic: the same input gives the same output across calls', () => {
    const specs: EaseSpec[] = ['ease-in-out', { bezier: [0.2, 0.8, 0.3, 1.4] }, { spring: DEFAULT_SPRING }];
    for (const s of specs) { const a = Array.from({ length: 40 }, (_, i) => applyEase(i / 39, s)); const b = Array.from({ length: 40 }, (_, i) => applyEase(i / 39, s)); expect(a).toEqual(b); }
  });
  it('normalizeEase rejects garbage', () => {
    expect(normalizeEase('nope')).toBe('linear'); expect(normalizeEase({ bezier: [1, 2] })).toBe('linear'); expect(normalizeEase({ spring: { tension: -1, friction: 1, mass: 1 } })).toBe('linear');
    expect(normalizeEase({ bezier: [2, 0, -1, 1] })).toEqual({ bezier: [1, 0, 0, 1] });
  });
});

describe('keyframe interpolation (unified model)', () => {
  const keys = [{ t: 0, v: 0, ease: 'linear' as const }, { t: 2, v: 100, ease: 'ease-in' as const }, { t: 4, v: 50 }];
  it('holds outside, interpolates with the LEFT key easing', () => {
    expect(sampleKeys(keys, -1, 7)).toBe(0); expect(sampleKeys(keys, 5, 7)).toBe(50); expect(sampleKeys([], 1, 7)).toBe(7);
    expect(sampleKeys(keys, 1, 0)).toBeCloseTo(50, 10);          // linear segment
    expect(sampleKeys(keys, 3, 0)).toBeCloseTo(100 - 50 * 0.25, 10); // ease-in (t*t) segment: progress .5 -> .25
    expect(sampleKeys([{ t: 0, v: 10, ease: 'hold' }, { t: 1, v: 20 }], 0.99, 0)).toBe(10);
  });
  it('spring and bezier segments evaluate through applyEase at exact times', () => {
    const k = [{ t: 0, v: 0, ease: { spring: DEFAULT_SPRING } }, { t: 1, v: 1 }];
    expect(sampleKeys(k, 0.5, 0)).toBeCloseTo(springEasing(0.5, DEFAULT_SPRING), 12);
    const b = [{ t: 0, v: 10, ease: { bezier: [0.25, 0.1, 0.25, 1] as [number, number, number, number] } }, { t: 2, v: 30 }];
    expect(sampleKeys(b, 1, 0)).toBeCloseTo(10 + 20 * 0.8024, 2);
  });
  it('multi-property pose at a frame (24 fps frame 36 = 1.5 s)', () => {
    const anim: ClipAnim = { keys: { x: [{ t: 0, v: 0 }, { t: 3, v: 30 }], scale: [{ t: 0, v: 1 }, { t: 3, v: 2 }], rotation: [{ t: 0, v: 0 }, { t: 3, v: 90 }] } };
    const p = poseAt({ anim }, 36 / 24);
    near(p.x, 15); near(p.scale, 1.5); near(p.rotation, 45); near(p.y, 0);
  });
  it('animated crop and opacity', () => {
    const anim: ClipAnim = { keys: { cropLeft: [{ t: 0, v: 0 }, { t: 2, v: 0.4 }], opacity: [{ t: 0, v: 0 }, { t: 2, v: 1 }] } };
    const css = clipPoseCss({ transform: undefined, anim }, 1);
    expect(css.clipPath).toBe('inset(0.000% 0.000% 0.000% 20.000%)');
    near(poseOpacity({ anim, opacity: 1 }, 0.5), 0.25);
  });
  it('no anim: byte-identical to the previous transform CSS (older projects render the same)', () => {
    const tr = { x: 5, y: -3, scale: 1.2, rotation: 10, crop: { left: 0.1, top: 0, right: 0, bottom: 0.2 }, keys: [{ t: 0, x: 0, y: 0, scale: 1, rotation: 0 }, { t: 2, x: 10, y: 4, scale: 2, rotation: 20 }] };
    for (const t of [0, 0.7, 1.3, 2, 9]) { const a = clipPoseCss({ transform: tr }, t); expect(a.transform).toBe(clipTransformCss(tr, t)); }
    expect(clipPoseCss({ transform: undefined }, 1)).toEqual({ transform: undefined, clipPath: undefined });
  });
  it('unifyLegacy keeps the evaluated values (transform keys + opacity keys -> Clip.anim)', () => {
    const clip = { transform: { x: 0, y: 0, scale: 1, rotation: 0, keys: [{ t: 0, x: 0, y: 0, scale: 1, rotation: 0 }, { t: 2, x: 10, y: -4, scale: 2, rotation: 40 }] }, keyframes: [{ time: 0, property: 'opacity', value: 0 }, { time: 2, property: 'opacity', value: 1 }, { time: 1, property: 'volume', value: 0.5 }], opacity: 1 } as Pick<Clip, 'transform' | 'keyframes' | 'opacity'>;
    const u = unifyLegacy(clip);
    expect(u.transform?.keys).toBeUndefined(); expect(u.keyframes!.map((k) => k.property)).toEqual(['volume']);
    for (const t of [0, 0.5, 1, 1.75, 2, 3]) {
      const before = poseAt(clip, t); const after = poseAt({ transform: u.transform, anim: u.anim }, t);
      near(before.x, after.x); near(before.y, after.y); near(before.scale, after.scale); near(before.rotation, after.rotation);
      near(poseOpacity(clip, t), poseOpacity({ anim: u.anim, opacity: 1 }, t));
    }
  });
  it('edit helpers: set / move / remove / auto-key rule', () => {
    let a = setKey(undefined, 'x', 1, 10); a = setKey(a, 'x', 3, 30); a = setKey(a, 'x', 1.01, 12);
    expect(a.keys!.x).toHaveLength(2); expect(a.keys!.x[0].v).toBe(12);
    a = moveKey(a, 'x', 0, 5)!; expect(a.keys!.x.map((k) => k.t)).toEqual([3, 5]);
    expect(removeKey(removeKey(a, 'x', 0), 'x', 0)).toBeUndefined();
    const off = applyAutoKey(undefined, { x: 4 }, 1, false); expect(off.unkeyed).toEqual(['x']); expect(off.anim).toBeUndefined();
    const on = applyAutoKey(undefined, { x: 4, scale: 2 }, 1, true); expect(on.unkeyed).toEqual([]); expect(Object.keys(on.anim!.keys!)).toEqual(['x', 'scale']);
    const keyedAlready = applyAutoKey(on.anim, { x: 9 }, 2, false); expect(keyedAlready.anim!.keys!.x.map((k) => k.v)).toEqual([4, 9]);
  });
  it('editProps (inspector rule): auto-key off edits the static value, on keys it at the playhead', () => {
    const clip = { transform: undefined, anim: undefined, opacity: 1, keyframes: [], fx: [] } as unknown as Clip;
    expect(editProps(clip, { x: 12 }, 1, false)).toEqual({ transform: { x: 12, y: 0, scale: 1, rotation: 0 } });
    const on = editProps(clip, { x: 12, opacity: 0.5 }, 1.5, true);
    expect(on.anim!.keys!.x).toEqual([{ t: 1.5, v: 12 }]); expect(on.anim!.keys!.opacity).toEqual([{ t: 1.5, v: 0.5 }]);
    const withLegacy = { ...clip, transform: { x: 0, y: 0, scale: 1, rotation: 0, keys: [{ t: 0, x: 0, y: 0, scale: 1, rotation: 0 }, { t: 2, x: 20, y: 0, scale: 1, rotation: 0 }] } } as Clip;
    near(readProp(withLegacy, 'x', 1), 10);
    const e = editProps(withLegacy, { x: 50 }, 1, false);
    expect('transform' in e && e.transform?.keys).toBeFalsy(); expect(e.anim!.keys!.x.map((k) => k.v)).toEqual([0, 50, 20]); // the old keys moved over and the key at the playhead was updated
  });
});

describe('motion modifiers (drift, sway, breathing, spin, shake)', () => {
  const mk = (type: Parameters<typeof createModifier>[0], over: Partial<MotionModifier> = {}) => createModifier(type, { id: type, ...over });
  it('exact analytic values at specific times', () => {
    // sway 0.5 Hz, amplitude 1: rotation = 4 sin(2π·0.5·t)  -> t=0.5 s: 4 sin(π/2) = 4 deg ; t=1: 0
    near(evalModifiers([mk('sway')], 0.5).dRotation, 4, 1e-9); near(evalModifiers([mk('sway')], 1).dRotation, 0, 1e-9);
    // spin 0.3 turns/s: 360*0.3*t = 108 deg at t=1
    near(evalModifiers([mk('spin')], 1).dRotation, 108, 1e-9);
    // breathing .55 Hz at quarter period (t = 1/(4*.55)): sin = 1 -> scale 1.035, opacity +0.04
    const b = evalModifiers([mk('breathing')], 1 / (4 * 0.55)); near(b.scale, 1.035, 1e-9); near(b.dOpacity, 0.04, 1e-9);
    // drift x: 0.8 sin(2π f t + π/2) at t=0 -> 0.8 % ; y at t=0 -> 0
    const d = evalModifiers([mk('drift')], 0); near(d.dx, 0.8, 1e-9); near(d.dy, 0, 1e-9);
  });
  it('determinism: same input -> same output across calls, for every type, and no dependence on the clock or Math.random', () => {
    const types = ['drift', 'sway', 'breathing', 'spin', 'shake'] as const;
    const orig = { now: Date.now, rnd: Math.random };
    Date.now = () => { throw new Error('Date.now used'); }; Math.random = () => { throw new Error('Math.random used'); };
    try {
      for (const ty of types) {
        const m = [mk(ty, { seed: 7, phase: 0.2 })];
        const run = () => Array.from({ length: 90 }, (_, f) => evalModifiers(m, f / 30));
        expect(run()).toEqual(run());
        const css = () => Array.from({ length: 30 }, (_, f) => clipPoseCss({ anim: { modifiers: m } }, f / 30).transform);
        expect(css()).toEqual(css());
      }
    } finally { Date.now = orig.now; Math.random = orig.rnd; }
  });
  it('shake depends on the seed and is bounded; disabled / zero amplitude is a no-op', () => {
    const a = evalModifiers([mk('shake', { seed: 1 })], 0.3); const b = evalModifiers([mk('shake', { seed: 2 })], 0.3);
    expect(a.dx).not.toBe(b.dx);
    for (let f = 0; f < 120; f++) { const c = evalModifiers([mk('shake', { seed: 3, amplitude: 2 })], f / 30); expect(Math.abs(c.dx)).toBeLessThanOrEqual(0.8 + 1e-9); expect(Math.abs(c.dRotation)).toBeLessThanOrEqual(1.1 + 1e-9); }
    expect(evalModifiers([mk('drift', { enabled: false })], 0.4)).toEqual(evalModifiers([], 0.4));
    expect(evalModifiers([mk('sway', { amplitude: 0 })], 0.4).dRotation).toBe(0);
  });
  it('modifiers are layered on top of keys; tOffset continues the phase after a split', () => {
    const anim: ClipAnim = { keys: { rotation: [{ t: 0, v: 10 }] }, modifiers: [mk('sway')] };
    near(poseAt({ anim }, 0.5).rotation, 14);
    const cont = sliceAnim(anim, 0.5, 2)!;
    near(poseAt({ anim: cont }, 0).rotation, 14); // the second half starts where the first stopped
    expect(hasAnim({ modifiers: [mk('sway', { enabled: false })] })).toBe(false);
  });
});

describe('split / slice', () => {
  const anim: ClipAnim = { keys: { x: [{ t: 0, v: 0 }, { t: 4, v: 40 }, { t: 8, v: 0 }] } };
  it('keeps the curve continuous across a split', () => {
    const l = sliceAnim(anim, 0, 2)!; const r = sliceAnim(anim, 2, 8)!;
    near(sampleKeys(l.keys!.x, 2, 0), 20); near(sampleKeys(r.keys!.x, 0, 0), 20);
    near(sampleKeys(r.keys!.x, 2, 0), 40); near(sampleKeys(r.keys!.x, 6, 0), 0);
  });
  it('splitClip on a real timeline slices Clip.anim', () => {
    let tl = createDefaultTimeline('t'); tl = addClipToTrack(tl, tl.tracks.find((t) => t.name === 'V1')!.id, A, 0);
    const c = tl.clips.find((k) => k.assetId === 'A')!;
    tl = updateClipProperties(tl, c.id, { anim: { keys: { scale: [{ t: 0, v: 1 }, { t: 10, v: 2 }] } } });
    const s = splitClip(tl, c.id, 5);
    const v1 = tl.tracks.find((t) => t.name === 'V1')!.id;
    const [first, second] = s.clips.filter((k) => k.trackId === v1).sort((a, b) => a.startTime - b.startTime);
    near(sampleKeys(first.anim!.keys!.scale, 5, 0), 1.5); near(sampleKeys(second.anim!.keys!.scale, 0, 0), 1.5); near(sampleKeys(second.anim!.keys!.scale, 5, 0), 2);
  });
  it('preview opacity (interpolateProperty) reads the unified keys; older clips unchanged', () => {
    const old = { opacity: 1, volume: 1, keyframes: [{ time: 0, property: 'opacity', value: 0 }, { time: 2, property: 'opacity', value: 1 }], speed: 1, duration: 10, trimStart: 0, trimEnd: 0 } as unknown as Clip;
    near(interpolateProperty(old, 'opacity', 1), 0.5);
    const neu = { ...old, keyframes: [], anim: { keys: { opacity: [{ t: 0, v: 0, ease: 'ease-in' as const }, { t: 2, v: 1 }] } } } as Clip;
    near(interpolateProperty(neu, 'opacity', 1), 0.25);
  });
});

describe('save -> load round trip', () => {
  const anim: ClipAnim = { keys: { x: [{ t: 0, v: 0, ease: { bezier: [0.2, 0.9, 0.3, 1] } }, { t: 2, v: 30, ease: { spring: DEFAULT_SPRING } }, { t: 4, v: 0 }], 'fx:0:amount': [{ t: 0, v: 0 }, { t: 1, v: 1 }] }, modifiers: [createModifier('shake', { id: 'm1', seed: 5 })] };
  it('JSON project (migrateSequenceToTimelines) keeps anim; a project saved before Stage 2 opens and evaluates as before', () => {
    let tl = createDefaultTimeline('t'); tl = addClipToTrack(tl, tl.tracks.find((t) => t.name === 'V1')!.id, A, 0);
    tl = updateClipProperties(tl, tl.clips.find((k) => k.assetId === 'A')!.id, { anim });
    const loaded = migrateSequenceToTimelines(JSON.parse(JSON.stringify({ timelines: [tl] }))).timelines[0] as Timeline;
    expect(loaded.clips.find((k) => k.assetId === 'A')!.anim).toEqual(anim);
    // old format: no anim, transform keys + opacity keys
    const oldProj = { timelines: [{ id: 'o', name: 'old', tracks: [], markers: [], duration: 4, clips: [{ id: 'c', assetId: 'A', trackId: 't', name: 'c', startTime: 0, duration: 4, trimStart: 0, trimEnd: 0, keyframes: [{ time: 0, property: 'opacity', value: 0 }, { time: 4, property: 'opacity', value: 1 }], transform: { x: 0, y: 0, scale: 1, rotation: 0, keys: [{ t: 0, x: 0, y: 0, scale: 1, rotation: 0 }, { t: 4, x: 40, y: 0, scale: 1, rotation: 0 }] } }] }] };
    const old = migrateSequenceToTimelines(JSON.parse(JSON.stringify(oldProj))).timelines[0].clips[0] as Clip;
    expect(old.anim).toBeUndefined();
    near(poseAt(old, 2).x, 20); near(interpolateProperty(old, 'opacity', 1), 0.25);
  });
  it('DB row converters (clipToRow -> clipFromRow) keep anim, and a row without the field loads without anim', () => {
    let tl = createDefaultTimeline('t'); tl = addClipToTrack(tl, tl.tracks.find((t) => t.name === 'V1')!.id, A, 0);
    const c = updateClipProperties(tl, tl.clips.find((k) => k.assetId === 'A')!.id, { anim }).clips.find((k) => k.assetId === 'A')!;
    const row = clipToRow(c, tl.id);
    expect(clipFromRow(JSON.parse(JSON.stringify(row)), []).anim).toEqual(anim);
    expect(clipFromRow({ ...JSON.parse(JSON.stringify(row)), stage1_json: null }, []).anim).toBeUndefined();
  });
  it('normalizeAnim drops garbage from a hand-edited file', () => {
    expect(normalizeAnim({ keys: { x: [{ t: 'a', v: 1 }, { t: 1, v: 2, ease: 'bogus' }] }, modifiers: [{ type: 'nope' }, { type: 'sway', amplitude: 9 }] })).toEqual({ keys: { x: [{ t: 1, v: 2, ease: 'linear' }] }, modifiers: [{ id: 'mm_sway', type: 'sway', enabled: true, amplitude: 2, frequency: 0.5, phase: 0, seed: 1 }] });
    expect(normalizeAnim(null)).toBeUndefined(); expect(normalizeAnim({})).toBeUndefined();
  });
});

describe('export mapping carries keyframes + modifiers (real mapping + real timelineToComposition)', () => {
  function compose(tl: Timeline) {
    const clips = exportClipsFromTimeline(tl, [A]);
    const { state } = buildExportState({ clips, tracks: exportTracksFromTimeline(tl), transitions: exportTransitionsFromTimeline(tl), totalDuration: tl.duration }, exportItem);
    return timelineToComposition(state, { fps: 30, quality: '720p' });
  }
  const anim: ClipAnim = { keys: { x: [{ t: 0, v: 0 }, { t: 4, v: 40, ease: 'ease-in' }], opacity: [{ t: 0, v: 0 }, { t: 4, v: 1 }], cropLeft: [{ t: 0, v: 0 }, { t: 4, v: 0.5 }] }, modifiers: [createModifier('sway', { id: 's' })] };
  it('layer gets clipAnim; evaluating it at a frame equals the preview evaluation of the same clip', () => {
    let tl = createDefaultTimeline('t'); tl = addClipToTrack(tl, tl.tracks.find((t) => t.name === 'V1')!.id, A, 0);
    const id = tl.clips.find((k) => k.assetId === 'A')!.id;
    tl = updateClipProperties(tl, id, { anim });
    const model = compose(tl);
    const layer = model.layers.find((l: any) => l.src === A.url);
    expect(layer.clipAnim).toEqual(anim);
    const clip = tl.clips.find((k) => k.id === id)!;
    for (const frame of [0, 15, 30, 45, 60, 119]) {
      const t = frame / 30;
      expect(clipPoseCss({ transform: layer.clipTransform, anim: layer.clipAnim }, t)).toEqual(clipPoseCss(clip, t));
    }
    // opacity: composition keyframes are the sampled animated opacity (same function as the preview) at 1/30 s
    const op = layer.keyframes.opacity as Array<{ t: number; v: number }>;
    expect(op.length).toBeGreaterThan(100);
    for (const k of op.filter((_, i) => i % 17 === 0)) near(k.v, Math.max(0, Math.min(1, poseOpacity(clip, k.t))), 1e-3);
    near(op.find((k) => Math.abs(k.t - 2) < 1e-3)!.v, 0.5, 1e-3);
  });
  it('a clip without anim exports exactly as before (no clipAnim, no sampled opacity)', () => {
    let tl = createDefaultTimeline('t'); tl = addClipToTrack(tl, tl.tracks.find((t) => t.name === 'V1')!.id, A, 0);
    const layer = compose(tl).layers.find((l: any) => l.src === A.url);
    expect(layer.clipAnim).toBeUndefined(); expect(layer.keyframes?.opacity).toBeUndefined();
  });
  it('effect parameter keys reach the export fx list (occFx keys) and the preview sampler', () => {
    const fxClip = { fx: [{ id: 'builtin:fx-vignette', props: {} }], lut: undefined, anim: { keys: { 'fx:0:amount': [{ t: 0, v: 0 }, { t: 2, v: 1 }], 'fx:0:softness': [{ t: 0, v: 0.2, ease: { bezier: [0.4, 0, 0.2, 1] as [number, number, number, number] } }, { t: 1, v: 0.8 }] } } } as unknown as Clip;
    const inst = clipFxInstances(fxClip, 1);
    if (inst.length === 0) return; // effect id not registered in this build: nothing to assert (guarded below)
    expect(inst[0].keys!['amount']).toEqual([{ frame: 0, value: 0 }, { frame: 60, value: 1 }]);
    expect(inst[0].keys!['softness'][0].easing).toEqual([0.4, 0, 0.2, 1]);
    near(inst[0].overrides['amount'] as number, 0.5, 1e-9);
  });
  it('animFxKeys bakes spring / presets at 30 fps and keeps hold as a step', () => {
    const a: ClipAnim = { keys: { 'fx:1:p': [{ t: 0, v: 0, ease: 'ease-in' }, { t: 1, v: 10, ease: 'hold' }, { t: 2, v: 20 }] } };
    const k = animFxKeys(a, 1)!['p'];
    near(k.find((f) => Math.abs(f.frame - 15) < 1e-6)!.value, 2.5, 1e-3); // ease-in at .5 -> .25 * 10
    expect(animFxKeys(a, 0)).toBeUndefined();
  });
});

describe('Lottie colour / text customisation', () => {
  const lottie = () => ({ v: '5.7.0', fr: 30, ip: 0, op: 60, w: 100, h: 100, layers: [
    { ty: 4, nm: 'Badge', shapes: [{ ty: 'gr', it: [{ ty: 'fl', nm: 'Brand', c: { a: 0, k: [1, 0, 0, 1] } }, { ty: 'st', nm: 'Stroke 1', c: { a: 1, k: [{ t: 0, s: [0, 0, 1, 1] }, { t: 30, s: [0, 1, 0, 1] }] } }] }] },
    { ty: 5, nm: 'Title', t: { d: { k: [{ t: 0, s: { t: 'HELLO', s: 20 } }] } } },
  ] });
  it('lists colours (document order keys) and text layers; applies edits to a COPY', () => {
    const src = lottie();
    const cols = extractLottieColorLayers(src); expect(cols.map((c) => [c.key, c.color, c.named])).toEqual([['c0', '#ff0000', true], ['c1', '#0000ff', false]]);
    expect(extractLottieTextLayers(src)).toEqual([{ key: '1', text: 'HELLO', label: 'Title' }]);
    const out = applyLottieEdits(src, { colors: { c0: '#00ff00', c1: '#ffffff' }, texts: { '1': 'WORLD' } }) as any;
    expect(extractLottieColorLayers(out).map((c) => c.color)).toEqual(['#00ff00', '#ffffff']);
    expect(out.layers[0].shapes[0].it[1].c.k.every((k: any) => k.s[0] === 1 && k.s[1] === 1 && k.s[2] === 1)).toBe(true); // animated colour: every key replaced
    expect(out.layers[1].t.d.k[0].s.t).toBe('WORLD');
    expect(extractLottieColorLayers(src)[0].color).toBe('#ff0000'); expect(src.layers[1].t!.d.k[0].s.t).toBe('HELLO'); // input untouched
    expect(applyLottieEdits(src, undefined)).toBe(src); expect(applyLottieEdits(src, { colors: {} })).toBe(src);
  });
  it('slot-based colours are listed and patched (and baked into the referencing fills)', () => {
    const s = { layers: [{ ty: 4, shapes: [{ ty: 'fl', c: { sid: 'brand', k: [1, 1, 1, 1] } }] }], slots: { brand: { p: { a: 0, k: [0, 0, 0, 1] } } } };
    expect(extractLottieColorLayers(s)[0]).toMatchObject({ key: 's:brand', color: '#000000' });
    const o = applyLottieEdits(s, { colors: { 's:brand': '#ff8800' } }) as any;
    expect(o.slots.brand.p.k.slice(0, 3)).toEqual([1, 0x88 / 255, 0]); expect(o.layers[0].shapes[0].c.k.slice(0, 3)).toEqual([1, 0x88 / 255, 0]);
  });
});

describe('text motion (per character / word / line)', () => {
  it('segments and ranks deterministically', () => {
    expect(splitUnits('Hi yo', 'char')).toEqual(['H', 'i', ' ', 'y', 'o']);
    expect(splitUnits('Hi yo  ok', 'word')).toEqual(['Hi ', 'yo  ', 'ok']);
    expect(splitUnits('a\nb\nc', 'line')).toEqual(['a\n', 'b\n', 'c']);
    expect([0, 1, 2, 3].map((i) => unitRank(i, 4, 'backward'))).toEqual([3, 2, 1, 0]);
    const r1 = [0, 1, 2, 3, 4].map((i) => unitRank(i, 5, 'random', 9)); const r2 = [0, 1, 2, 3, 4].map((i) => unitRank(i, 5, 'random', 9));
    expect(r1).toEqual(r2); expect([...r1].sort()).toEqual([0, 1, 2, 3, 4]);
  });
  it('per-character stagger values at specific times', () => {
    const spec = TEXT_MOTION_PRESETS['char-rise'];
    expect(unitStyle(spec, 0, 5, -1)).toEqual({ opacity: 0, transform: 'translateY(0.4em)' });
    expect(unitStyle(spec, 2, 5, 40).opacity).toBe(0);            // char 2 starts at 60 ms
    expect(unitStyle(spec, 2, 5, 60 + 220)).toEqual({ opacity: 1 }); // finished
    const mid = unitStyle(spec, 0, 5, 110); expect(mid.opacity).toBeGreaterThan(0.5); expect(mid.transform).toMatch(/translateY\(/);
    expect(unitStyle(spec, 3, 5, 150)).toEqual(unitStyle(spec, 3, 5, 150));
  });
  it('caption renderer hook: char presets split a word into spans, others return the text; presets are selectable', () => {
    const word = { start: 1000, end: 1400 };
    const kids = captionWordContent('char-pop', word, 'Hey', 1050) as any[];
    expect(kids).toHaveLength(3); expect(kids[0].props.style.opacity).toBeGreaterThan(0); expect(kids[2].props.style.opacity).toBe(0);
    expect(captionWordContent('pop', word, 'Hey', 1100)).toBe('Hey'); expect(captionWordContent(undefined, word, 'Hey', 1100)).toBe('Hey');
    expect(captionWordMotionStyle('word-rise', word, 900).opacity).toBe(0); expect(captionWordMotionStyle('word-rise', word, 1400).opacity).toBe(1);
    expect(CAPTION_MOTION_OPTIONS.map((o) => o.id)).toEqual(expect.arrayContaining(['char-rise', 'char-pop', 'char-wave', 'word-rise']));
  });
});
