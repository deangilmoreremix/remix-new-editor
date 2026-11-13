// Stage 3 (colour grading / FreeCut-inspired) + Stage 5 (Seriously.js) effects: registry completeness, param schema,
// licence/attribution, project persistence round trip, keyframes, export mapping. Shader compile/render checks that need a real
// WebGL2 context live in docs/stage-3/smoke/fx-gl-check.cjs (headless Chromium), not here.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_FX, FX_IDS } from '../../openchatcut/gl/fx/effects';
import { S35_EFFECTS, S35_META } from '../../openchatcut/gl/fx/s35Effects';
import { fxUniforms, fxPasses } from '../../openchatcut/gl/fx/uniforms';
import { clipFxInstances, clipFxPasses, sampledFxProps, FX_KEY_FPS } from '@cinegen/lib/occ/clip-fx';
import { createDefaultTimeline, addClipToTrack } from '@cinegen/lib/editor/timeline-operations';
import { exportClipsFromTimeline, exportItem, exportTracksFromTimeline, exportTransitionsFromTimeline, buildExportState } from '@cinegen/lib/editor/export-mapping';
// @ts-expect-error plain JS module
import { timelineToComposition } from '../../lib/editor/remotion/timelineToComposition.js';
import { glFxSupported, warnGlFxSkipped, resetGlSupportForTests } from '../../openchatcut/gl/fx/glSupport';
import { glPreviewFailureReason } from '../../openchatcut/gl/previewAdapter';
import type { Asset } from '@cinegen/types/project';
import type { Clip } from '@cinegen/types/timeline';

const IDS = Object.keys(S35_EFFECTS);
const root = path.resolve(__dirname, '../../..');
const shaderDir = path.join(root, 'src/openchatcut/gl/fx/s35');

describe('Stage 3/5 effect registry', () => {
  it('has the 21 effects, all registered in ALL_FX / FX_IDS (no duplicates of existing ids)', () => {
    expect(IDS).toHaveLength(21);
    expect(Object.keys(S35_META).sort()).toEqual([...IDS].sort());
    expect(new Set(FX_IDS).size).toBe(FX_IDS.length);
    for (const id of IDS) { expect(ALL_FX[id]).toBe(S35_EFFECTS[id]); expect(FX_IDS).toContain(id); expect(id).toMatch(/^builtin:fx-[a-z0-9-]+$/); }
    expect(FX_IDS.length).toBe(54);
  });
  it.each(IDS)('%s: schema (name/desc, GLSL 300 es pass reading u_input, every prop wired to a declared uniform, defaults in range, number props only)', (id) => {
    const def = S35_EFFECTS[id];
    expect(def.name.length).toBeGreaterThan(2); expect(def.desc.length).toBeGreaterThan(10);
    const passes = def.passes ?? [def.frag];
    for (const frag of passes) { expect(frag.startsWith('#version 300 es')).toBe(true); expect(frag).toMatch(/uniform\s+sampler2D\s+u_input/); expect(frag).toMatch(/out\s+vec4\s+fragColor/); }
    expect(def.props.length).toBeGreaterThan(0);
    const keys = new Set<string>();
    for (const p of def.props) {
      expect(p.kind ?? 'number').toBe('number'); // keyframeable from the inspector
      if (p.kind === 'color') throw new Error('unreachable');
      expect(keys.has(p.key)).toBe(false); keys.add(p.key);
      expect(Number.isFinite(p.default) && Number.isFinite(p.min) && Number.isFinite(p.max)).toBe(true);
      expect(p.min).toBeLessThan(p.max);
      expect(p.default).toBeGreaterThanOrEqual(p.min); expect(p.default).toBeLessThanOrEqual(p.max);
      const u = p.uniform ?? `u_${p.key}`;
      expect(passes.some((f) => new RegExp(`uniform\\s+[^;]*\\b${u}\\b`).test(f))).toBe(true);
    }
    // every uniform the shader declares (besides the runtime-supplied ones) is a prop
    const runtime = new Set(['u_input', 'u_resolution', 'u_time', 'u_width', 'u_aspect']);
    const declared = new Set<string>();
    for (const f of passes) for (const m of f.matchAll(/uniform\s+\w+\s+([^;]+);/g)) m[1].split(/\s*,\s*/).forEach((n) => declared.add(n.trim()));
    // "uniform float a; uniform float b;" on one line is matched statement by statement above
    for (const d of declared) if (!runtime.has(d)) expect(def.props.some((p) => (p.uniform ?? `u_${p.key}`) === d), `${id}: uniform ${d} has no prop`).toBe(true);
  });
  it.each(IDS)('%s: uniforms clamp out-of-range / NaN overrides and map u_<key>', (id) => {
    const def = S35_EFFECTS[id];
    const wild = Object.fromEntries(def.props.map((p, i) => [p.key, i % 2 ? 1e9 : -1e9]));
    const u = fxUniforms(def, wild);
    def.props.forEach((p, i) => { if (p.kind !== 'color') expect(u[p.uniform ?? `u_${p.key}`]).toBe(i % 2 ? p.max : p.min); });
    const nan = fxUniforms(def, Object.fromEntries(def.props.map((p) => [p.key, NaN])));
    def.props.forEach((p) => { if (p.kind !== 'color') expect(nan[p.uniform ?? `u_${p.key}`]).toBe(p.default); });
  });
  it('box blur is a real two-pass graph; the others are single pass', () => {
    expect(fxPasses([{ def: S35_EFFECTS['builtin:fx-box-blur'] }], 0)).toHaveLength(2);
    expect(fxPasses([{ def: S35_EFFECTS['builtin:fx-curves'] }], 0)).toHaveLength(1);
  });
  it('probe / neutral metadata only references declared props', () => {
    for (const id of IDS) { const keys = new Set(S35_EFFECTS[id].props.map((p) => p.key)); const m = S35_META[id]; for (const k of [...Object.keys(m.probe), ...Object.keys(m.neutral ?? {})]) expect(keys.has(k), `${id}.${k}`).toBe(true); }
  });
});

describe('Stage 3/5 licence and attribution', () => {
  const notices = fs.readFileSync(path.join(shaderDir, 'THIRD_PARTY_NOTICE.md'), 'utf8');
  it('every shader file has a registered effect and vice versa', () => {
    const files = fs.readdirSync(shaderDir).filter((f) => f.endsWith('.frag')).map((f) => f.replace('.frag', '')).map((f) => f.replace(/-(H|V)$/, '')).filter((f, i, a) => a.indexOf(f) === i);
    expect(files.sort()).toEqual(IDS.map((i) => i.replace('builtin:fx-', '')).sort());
  });
  it.each(IDS)('%s: provenance declared; vendored effects carry repo, path, commit and MIT in the shader header and in the notice', (id) => {
    const m = S35_META[id]; const frag = fs.readFileSync(path.join(shaderDir, `${id.replace('builtin:fx-', '')}${id.endsWith('box-blur') ? '-H' : ''}.frag`), 'utf8');
    expect(m.license.length).toBeGreaterThan(3);
    if (m.origin === 'seriously-mit') {
      expect(m.upstream).toBeTruthy();
      expect(frag).toContain('Seriously.js'); expect(frag).toContain(m.upstream!.commit); expect(frag).toContain(m.upstream!.path.split('/').pop()!.replace('.js', '')); expect(frag).toMatch(/Licen[cs]e: MIT/); expect(frag).toContain('Brian Chirls');
      expect(notices).toContain(m.upstream!.path); expect(notices).toContain(m.upstream!.commit);
    } else {
      expect(m.upstream).toBeUndefined();
      expect(frag).not.toMatch(/Seriously\.js \(https/); // original work must not claim a vendored header
    }
  });
  it('never vendors the NC-SA / CC-BY / unlicensed Seriously effects', () => {
    const banned = ['blur', 'directionblur', 'bleach-bypass', 'opticalflow', 'filmgrain', 'lut', 'blend', 'tvglitch', 'freeze', 'accumulator', 'throttle', 'expression'];
    for (const id of IDS) { const m = S35_META[id]; if (m.upstream) expect(banned.some((b) => m.upstream!.path === `effects/seriously.${b}.js`)).toBe(false); }
    for (const f of fs.readdirSync(shaderDir).filter((x) => x.endsWith('.frag'))) { const s = fs.readFileSync(path.join(shaderDir, f), 'utf8'); expect(s).not.toMatch(/NC-SA|v002|Andrew Benson|martinsh/i); expect(s).not.toMatch(/@fragment|@compute|@vertex|var<uniform>|\bfn\s+\w+\s*\(/); }
  });
});

const asset = (id: string): Asset => ({ id, name: id, type: 'video', url: `https://x.test/${id}.mp4`, duration: 10, createdAt: '2026-01-01' });
const mkClip = (over: Partial<Clip> = {}): Clip => ({ id: 'c1', assetId: 'A', trackId: 't', name: 'c', startTime: 0, duration: 4, trimStart: 0, trimEnd: 0, speed: 1, opacity: 1, volume: 1, flipH: false, flipV: false, keyframes: [], ...over });

describe('Stage 3/5 effects: project persistence, keyframes, export', () => {
  const fxStack = IDS.map((id) => ({ id, props: Object.fromEntries(Object.entries(S35_META[id].probe)) }));
  it('a clip carrying every new effect survives a JSON project save/load unchanged and resolves to GL passes', () => {
    const clip = mkClip({ fx: fxStack });
    const loaded = JSON.parse(JSON.stringify(clip)) as Clip;
    expect(loaded.fx).toEqual(clip.fx);
    const inst = clipFxInstances(loaded);
    expect(inst.map((i) => i.def.id)).toEqual(IDS);
    expect(inst[0].overrides).toEqual(S35_META[IDS[0]].probe);
    const passes = clipFxPasses(loaded, 1);
    expect(passes.length).toBe(IDS.length + 1); // box blur has two passes
    expect(passes.every((p) => p.frag.startsWith('#version 300 es'))).toBe(true);
    // clamped slider values reach the shader
    const over = clipFxPasses(mkClip({ fx: [{ id: 'builtin:fx-sharpen', props: { amount: 99 } }] }), 0)[0];
    expect(over.uniforms!.u_amount).toBe(4);
  });
  it('disabled effects are skipped', () => {
    expect(clipFxInstances(mkClip({ fx: [{ id: 'builtin:fx-vhs', props: {}, enabled: false }] }))).toHaveLength(0);
  });
  it('effect-parameter keyframes drive the new effects (linear between keys, persisted)', () => {
    const fx = [{ id: 'builtin:fx-exposure', props: { exposure: 0 }, keys: { exposure: [{ frame: 0, value: -1 }, { frame: 2 * FX_KEY_FPS, value: 1 }] } }];
    const clip = JSON.parse(JSON.stringify(mkClip({ fx }))) as Clip;
    const at = (s: number) => (sampledFxProps(clip.fx![0].props, clip.fx![0].keys, s).exposure as number);
    expect(at(0)).toBeCloseTo(-1, 5); expect(at(1)).toBeCloseTo(0, 5); expect(at(2)).toBeCloseTo(1, 5);
    expect(clipFxPasses(clip, 0, 1)[0].uniforms!.u_exposure).toBeCloseTo(0, 5);
    expect(clipFxPasses(clip, 0, 0)[0].uniforms!.u_exposure).toBeCloseTo(-1, 5);
  });
  it('export mapping (real functions) puts every new effect, its overrides and keyframes into the composition layer', () => {
    let tl = createDefaultTimeline('t');
    const v1 = tl.tracks.find((t) => t.name === 'V1')!.id;
    tl = addClipToTrack(tl, v1, asset('A'), 0);
    tl = { ...tl, clips: tl.clips.map((c) => ({ ...c, fx: [...fxStack.slice(0, 20), { id: 'builtin:fx-exposure', props: {}, keys: { exposure: [{ frame: 0, value: 0 }, { frame: 30, value: 2 }] } }] })) };
    const clips = exportClipsFromTimeline(tl, [asset('A')]);
    const item = exportItem(clips[0], 0) as { occFx: Array<{ id: string; overrides: Record<string, number>; keys?: unknown }> };
    expect(item.occFx.map((e) => e.id)).toEqual([...IDS.slice(0, 20), 'builtin:fx-exposure']);
    expect(item.occFx.every((e) => e.id in ALL_FX)).toBe(true); // ClipFx.tsx resolves ALL_FX by id when rendering the export
    expect(item.occFx[0].overrides).toEqual(S35_META[IDS[0]].probe);
    expect(item.occFx.at(-1)!.keys).toBeTruthy();
    const { state } = buildExportState({ clips, tracks: exportTracksFromTimeline(tl), transitions: exportTransitionsFromTimeline(tl), totalDuration: tl.duration }, exportItem);
    const model = timelineToComposition(state, { fps: 30, quality: '720p' });
    const layer = model.layers.find((l: { occFx?: unknown[] }) => l.occFx?.length);
    expect(layer.occFx.length).toBe(21);
  });
});

describe('WebGL2 unavailable fallback', () => {
  beforeEach(() => resetGlSupportForTests());
  it('detects missing WebGL2 without throwing, and classifies the runtime error as webgl-unavailable (skip effect)', () => {
    expect(glFxSupported(() => ({ getContext: () => null }))).toBe(false);
    resetGlSupportForTests();
    expect(glFxSupported(() => { throw new Error('boom'); })).toBe(false);
    resetGlSupportForTests();
    expect(glFxSupported(() => ({ getContext: () => ({}) }))).toBe(true);
    expect(glPreviewFailureReason(new Error('WebGL2 not available'))).toBe('webgl-unavailable');
  });
  it('warns exactly once', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(warnGlFxSkipped()).toBe(true); expect(warnGlFxSkipped()).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toMatch(/skipped/);
    spy.mockRestore();
  });
});
