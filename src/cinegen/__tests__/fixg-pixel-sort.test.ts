// Fix G: Pixel Sort registry, pass graph (slots / cost bound), CPU reference semantics, persistence, anim keys, export mapping, provenance.
// GPU output vs the CPU reference / invariants is checked in docs/stage-10/smoke/fixg-gl-check.cjs (headless Chromium).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_FX, FX_IDS } from '../../openchatcut/gl/fx/effects';
import { fxPasses, fxUniforms } from '../../openchatcut/gl/fx/uniforms';
import { PIXEL_SORT_FX, PIXEL_SORT_ID, PIXEL_SORT_MAX_LENGTH, pixelSortPasses } from '../../openchatcut/gl/fx/s10/pixelSort';
import { pixelSortCpu, sortKey, type Px, type SortParams } from '../../openchatcut/gl/fx/s10/pixelSortRef';
import { clipFxPasses } from '@cinegen/lib/occ/clip-fx';
import { createDefaultTimeline, addClipToTrack } from '@cinegen/lib/editor/timeline-operations';
import { exportClipsFromTimeline, exportItem } from '@cinegen/lib/editor/export-mapping';
import { HELP } from '../lib/help/help-content';
import type { Asset } from '@cinegen/types/project';
import type { Clip } from '@cinegen/types/timeline';

const dir = path.resolve(__dirname, '../../openchatcut/gl/fx/s10');
const asset = (id: string): Asset => ({ id, name: id, type: 'video', url: `https://x.test/${id}.mp4`, duration: 10, createdAt: '2026-01-01' });
const mkClip = (over: Partial<Clip> = {}): Clip => ({ id: 'c1', assetId: 'A', trackId: 't', name: 'c', startTime: 0, duration: 4, trimStart: 0, trimEnd: 0, speed: 1, opacity: 1, volume: 1, flipH: false, flipV: false, keyframes: [], ...over });
const base: SortParams = { low: 0, high: 1, key: 0, axis: 0, ascending: 1, length: 64, invert: 0 };
const grey = (v: number): Px => ({ r: v, g: v, b: v, a: 1 });

describe('pixel sort registry', () => {
  it('is registered once in ALL_FX / FX_IDS with a name, description and schema-valid props', () => {
    expect(ALL_FX[PIXEL_SORT_ID]).toBe(PIXEL_SORT_FX); expect(FX_IDS.filter((i) => i === PIXEL_SORT_ID)).toHaveLength(1);
    expect(PIXEL_SORT_FX.props.map((p) => p.key)).toEqual(['low', 'high', 'key', 'axis', 'ascending', 'length', 'strength', 'invert']);
    for (const p of PIXEL_SORT_FX.props) { if (p.kind === 'color') throw new Error('number props only'); expect(p.min).toBeLessThan(p.max); expect(p.default).toBeGreaterThanOrEqual(p.min); expect(p.default).toBeLessThanOrEqual(p.max); }
    expect(PIXEL_SORT_FX.props.find((p) => p.key === 'length')!.max).toBe(PIXEL_SORT_MAX_LENGTH);
  });
  it('clamps wild / NaN overrides', () => {
    const u = fxUniforms(PIXEL_SORT_FX, { length: 1e9, low: -5, high: 9, strength: NaN });
    expect(u).toMatchObject({ u_length: 64, u_low: 0, u_high: 1, u_strength: 1 });
  });
  it('all three shaders are GLSL ES 3.00, read u_input, are original (no WGSL) and attribute FreeCut as inspiration', () => {
    for (const f of ['pixel-sort-prep.frag', 'pixel-sort-step.frag', 'pixel-sort-mix.frag']) {
      const s = fs.readFileSync(path.join(dir, f), 'utf8');
      expect(s.startsWith('#version 300 es')).toBe(true); expect(s).toMatch(/uniform\s+sampler2D\s+u_input/); expect(s).toMatch(/out\s+vec4\s+fragColor/);
      expect(s).not.toMatch(/@compute|@fragment|var<storage|workgroup/);
    }
    const prep = fs.readFileSync(path.join(dir, 'pixel-sort-prep.frag'), 'utf8'); expect(prep).toMatch(/inspired by FreeCut/i); expect(prep).toContain('5ceeeb388eef5423640b7db157706274bf1b8165');
    const notice = fs.readFileSync(path.resolve(dir, '../s35/THIRD_PARTY_NOTICE.md'), 'utf8'); expect(notice).toContain('Pixel Sort'); expect(notice).toContain('5ceeeb388eef5423640b7db157706274bf1b8165');
  });
  it('has hover help', () => { expect(Object.keys(HELP).some((k) => k.includes('pixel sort'))).toBe(true); });
});

describe('pixel sort pass graph', () => {
  const u = (o: Record<string, number>) => fxUniforms(PIXEL_SORT_FX, o);
  it('identity settings give a single copy pass', () => {
    expect(pixelSortPasses(u({ length: 0 }))).toHaveLength(1);
    expect(pixelSortPasses(u({ strength: 0 }))).toHaveLength(1);
  });
  it('pass count = 1 + length (+1 mix when strength < 1), capped at 64 steps; parity alternates', () => {
    expect(pixelSortPasses(u({ length: 10 }))).toHaveLength(11);
    expect(pixelSortPasses(u({ length: 10, strength: 0.5 }))).toHaveLength(12);
    const max = pixelSortPasses(u({ length: 999 })); expect(max).toHaveLength(65);
    expect(max.slice(1, 5).map((p) => p.uniforms!.u_parity)).toEqual([0, 1, 0, 1]);
  });
  it('ping-pongs between at most three FBO slots, never reading the slot it writes, mix reads the copy (slot 0)', () => {
    for (const length of [1, 2, 3, 7, 64]) for (const strength of [1, 0.4]) {
      const ps = pixelSortPasses(u({ length, strength }));
      const slots = ps.map((p, i) => p.slot ?? i); expect(Math.max(...slots)).toBeLessThanOrEqual(2); expect(Math.max(...slots)).toBeLessThan(ps.length);
      ps.forEach((p, i) => { if (i === 0) return; expect(slots[i]).not.toBe(slots[p.inputFrom ?? i - 1]); for (const idx of Object.values(p.samplers ?? {})) { expect(idx).toBeLessThan(i); expect(slots[idx]).toBe(0); expect(slots[i]).not.toBe(0); } });
    }
  });
  it('fxPasses rebases slots when chained after another effect', () => {
    const passes = fxPasses([{ def: ALL_FX['builtin:fx-invert'] }, { def: PIXEL_SORT_FX, overrides: { length: 3, strength: 0.5 } }], 0);
    expect(passes).toHaveLength(1 + 5); expect(passes[1].slot).toBe(1 + 0); expect(passes[2].slot).toBe(1 + 1); expect(passes[5].samplers).toEqual({ u_orig: 1 });
  });
});

describe('pixel sort CPU reference', () => {
  const row = (vals: number[]) => vals.map(grey);
  const vals = (px: Px[]) => px.map((p) => Math.round(p.r * 100) / 100);
  it('sorts a fully reachable run ascending / descending', () => {
    const r = [0.9, 0.2, 0.7, 0.1, 0.5, 0.3, 0.8];
    expect(vals(pixelSortCpu(row(r), 7, 1, base))).toEqual([...r].sort((a, b) => a - b));
    expect(vals(pixelSortCpu(row(r), 7, 1, { ...base, ascending: 0 }))).toEqual([...r].sort((a, b) => b - a));
  });
  it('does not touch pixels outside the window and sorts each masked run on its own (invert flips the mask)', () => {
    const r = [0.9, 0.5, 0.3, 0.05, 0.4, 0.2, 0.6, 0.95];
    expect(vals(pixelSortCpu(row(r), 8, 1, { ...base, low: 0.1, high: 0.8 }))).toEqual([0.9, 0.3, 0.5, 0.05, 0.2, 0.4, 0.6, 0.95]);
    const r2 = [0.95, 0.9, 0.5, 0.05, 0.02, 0.6, 0.99, 0.85]; // inverted window: outside = 0.95 0.9 | 0.05 0.02 | 0.99 0.85
    expect(vals(pixelSortCpu(row(r2), 8, 1, { ...base, low: 0.1, high: 0.8, invert: 1 }))).toEqual([0.9, 0.95, 0.5, 0.02, 0.05, 0.6, 0.85, 0.99]);
  });
  it('length bounds the travel distance: 0 = identity, k passes move a pixel at most k places', () => {
    const r = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2];
    expect(vals(pixelSortCpu(row(r), 8, 1, { ...base, length: 0 }))).toEqual(r);
    const one = pixelSortCpu(row(r), 8, 1, { ...base, length: 1 }); expect(vals(one)).toEqual([0.8, 0.9, 0.6, 0.7, 0.4, 0.5, 0.2, 0.3]);
    const part = pixelSortCpu(row(r), 8, 1, { ...base, length: 3 }); r.forEach((v, i) => expect(Math.abs(vals(part).indexOf(v) - i)).toBeLessThanOrEqual(3));
  });
  it('vertical axis sorts columns top to bottom; non-square odd sizes work', () => {
    const w = 3; const h = 5; const col = [0.4, 0.1, 0.9, 0.3, 0.6];
    const img: Px[] = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img.push(grey(col[(y + x) % h]));
    const out = pixelSortCpu(img, w, h, { ...base, axis: 1 });
    for (let x = 0; x < w; x++) { const c = Array.from({ length: h }, (_, y) => out[y * w + x].r); expect(c).toEqual([...c].sort((a, b) => a - b)); }
  });
  it('transparent pixels are never sorted; hue / saturation / brightness keys', () => {
    const r: Px[] = [grey(0.9), { ...grey(0.1), a: 0 }, grey(0.2)];
    expect(pixelSortCpu(r, 3, 1, base)).toEqual(r);
    expect(sortKey({ r: 0, g: 1, b: 0, a: 1 }, 1)).toBeCloseTo(1 / 3, 6); expect(sortKey({ r: 1, g: 0.5, b: 0.5, a: 1 }, 2)).toBeCloseTo(0.5, 6); expect(sortKey({ r: 0.2, g: 0.6, b: 0.4, a: 1 }, 3)).toBeCloseTo(0.6, 6);
  });
  it('is deterministic', () => { const r = Array.from({ length: 40 }, (_, i) => grey(((i * 37) % 41) / 41)); expect(pixelSortCpu(r, 40, 1, base)).toEqual(pixelSortCpu(r, 40, 1, base)); });
});

describe('pixel sort persistence, keyframes and export', () => {
  const fx = [{ id: PIXEL_SORT_ID, props: { low: 0.1, high: 0.7, key: 1, axis: 1, length: 12, ascending: 0 } }];
  it('JSON round trip keeps props and resolves to GL passes', () => {
    const clip = JSON.parse(JSON.stringify(mkClip({ fx }))) as Clip;
    expect(clip.fx).toEqual(fx);
    const passes = clipFxPasses(clip, 0); expect(passes).toHaveLength(13);
    expect(passes[1].uniforms).toMatchObject({ u_low: 0.1, u_high: 0.7, u_key: 1, u_axis: 1, u_ascending: 0, u_length: 12 });
  });
  it('Clip.anim keys (fx:<i>:length) change the pass count with time (keyframeable)', () => {
    const clip = mkClip({ fx, anim: { keys: { 'fx:0:length': [{ t: 0, v: 0 }, { t: 2, v: 40 }] } } });
    expect(clipFxPasses(clip, 0, 0)).toHaveLength(1); expect(clipFxPasses(clip, 0, 1)).toHaveLength(21); expect(clipFxPasses(clip, 0, 2)).toHaveLength(41);
  });
  it('real export mapping carries the effect and its props into the composition layer', () => {
    let tl = createDefaultTimeline('t'); const v1 = tl.tracks.find((t) => t.name === 'V1')!.id; tl = addClipToTrack(tl, v1, asset('A'), 0);
    tl = { ...tl, clips: tl.clips.map((c) => ({ ...c, fx })) };
    const item = exportItem(exportClipsFromTimeline(tl, [asset('A')])[0], 0) as unknown as { occFx: Array<{ id: string; overrides: Record<string, number> }> };
    expect(item.occFx.map((e) => e.id)).toEqual([PIXEL_SORT_ID]); expect(item.occFx[0].id in ALL_FX).toBe(true); expect(item.occFx[0].overrides).toEqual(fx[0].props);
  });
});
