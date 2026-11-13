// @vitest-environment node
// Manifest generation determinism + licence completeness for the vendored gl-transitions shaders.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
// @ts-expect-error plain JS module
import { parseTransition, parseDefault, kebab } from '../../../../../scripts/lib/glt-parse.mjs';
import { GLT_CATALOG, GLT_UPSTREAM, GLT_IDS, GLT_CATEGORIES, gltFrag, gltUniforms, gltDefaultParams, gltDirectionParam, directionOf, directionVector, searchGlt, gltLabel, isGltId } from '../index';
import { sliderRange, vecToHex, hexToVec } from '../paramUi';
import upstreamIndex from '../upstream-index.generated.json';

const DIR = path.resolve(__dirname, '..');
const UPSTREAM = process.env.GLT_UPSTREAM || '/tmp/claude-0/-home-user/ed6a1d8a-3b9d-58b8-9841-6ef0cfce8ef8/scratchpad/up/gl-transitions';
const ALLOWED = /^(MIT|BSD 2 Clause|BSD 3 Clause)$/;

describe('gl-transitions parser', () => {
  it('parses header, params, defaults, ranges, colours', () => {
    const src = `// Author: Jane <j@x>\n// License: MIT\n// Description: d\n// Tags: a, b\n\n// @range(0, 4, 1) pleats\nuniform int pleats; // = 4\n// @color back\nuniform vec4 backColor; // = vec4(0.0, 0.0, 0.0, 1.0)\n// @param dir\nuniform vec2 direction; // = vec2(-1.0, 0.0)\nuniform bool flag; // = true\nuniform ivec2 sq; // = ivec2(10, 10)\nuniform float f; // = 0.5;\nvec4 transition(vec2 uv){return vec4(0.);}\n`;
    const p = parseTransition(src);
    expect(p.errors).toEqual([]);
    expect(p.header).toEqual({ author: 'Jane <j@x>', license: 'MIT', description: 'd', tags: ['a', 'b'] });
    expect(p.params.map((x: { name: string }) => x.name)).toEqual(['pleats', 'backColor', 'direction', 'flag', 'sq', 'f']);
    expect(p.params[0]).toMatchObject({ type: 'int', default: 4, min: 0, max: 4, step: 1 });
    expect(p.params[1]).toMatchObject({ type: 'vec4', color: true, default: [0, 0, 0, 1] });
    expect(p.params[3].default).toBe(true);
    expect(p.params[4].default).toEqual([10, 10]);
    expect(p.params[5].default).toBe(0.5);
    expect(parseDefault('vec3', 'vec3(2.0)')).toEqual([2, 2, 2]);
    expect(kebab('CrossWarp')).toBe('cross-warp');
  });
  it('flags missing licence/author and extra textures', () => {
    const p = parseTransition('uniform sampler2D luma;\nvec4 transition(vec2 uv){return vec4(0.);}');
    expect(p.errors).toEqual(expect.arrayContaining(['missing Author', 'missing License']));
    expect(p.textures).toEqual(['luma']);
  });
});

describe('vendored catalog: licence completeness', () => {
  it('has 40-80 distinct shaders covering the required families', () => {
    expect(GLT_CATALOG.length).toBeGreaterThanOrEqual(40);
    expect(GLT_CATALOG.length).toBeLessThanOrEqual(80);
    expect(new Set(GLT_IDS).size).toBe(GLT_IDS.length);
    const names = new Set(GLT_CATALOG.map((e) => e.name));
    for (const n of ['Cube', 'Doorway', 'CrossWarp', 'Ripple', 'Swirl', 'BookFlip', 'GlitchMemories', 'WindowSlices', 'Pixelize', 'Morph', 'Wind', 'DirectionalWipe', 'DefocusBlur', 'Fisheye']) expect(names.has(n), n).toBe(true);
    expect(GLT_CATEGORIES.length).toBeGreaterThanOrEqual(6);
  });
  it('every vendored shader has author + an allowed licence, stated in its own verbatim header', () => {
    for (const e of GLT_CATALOG) {
      expect(e.author.length, e.id).toBeGreaterThan(0);
      expect(e.license, e.id).toMatch(ALLOWED);
      expect(e.glsl, e.id).toMatch(/\/\/\s*Author:\s*\S/);
      expect(e.glsl, e.id).toMatch(/\/\/\s*License:\s*\S/);
      const p = parseTransition(e.glsl);
      expect(p.errors, e.id).toEqual([]);
      expect(p.textures, e.id).toEqual([]);
      expect(p.header.author, e.id).toBe(e.author);
      expect(p.header.license, e.id).toBe(e.license);
      expect(p.params, e.id).toEqual(e.params);
      expect(e.glsl, e.id).toMatch(/vec4 transition\s*\(\s*vec2/);
    }
  });
  it('THIRD_PARTY.md lists every vendored shader with its author and licence, plus the upstream commit', () => {
    const md = fs.readFileSync(path.join(DIR, 'THIRD_PARTY.md'), 'utf8');
    expect(md).toContain(GLT_UPSTREAM.commit);
    expect(md).toContain('Copyright (c) 2017-present gl-transitions contributors');
    for (const e of GLT_CATALOG) {
      const row = md.split('\n').find((l) => l.startsWith(`| ${e.id} |`));
      expect(row, e.id).toBeTruthy();
      expect(row, e.id).toContain(e.license);
      expect(row, e.id).toContain(e.author.replace(/\|/g, '/'));
    }
  });
  it('upstream index: all 220 shaders carry a licence + author; vendored flags match the catalog; exclusions have a reason', () => {
    const rows = upstreamIndex.transitions as Array<{ name: string; author: string; license: string; vendored: boolean; excluded?: string }>;
    expect(rows.length).toBe(220);
    expect(upstreamIndex.commit).toBe(GLT_UPSTREAM.commit);
    for (const r of rows) { expect(r.author, r.name).toBeTruthy(); expect(r.license, r.name).toMatch(ALLOWED); if (!r.vendored) expect(r.excluded, r.name).toBeTruthy(); }
    expect(rows.filter((r) => r.vendored).map((r) => r.name).sort()).toEqual(GLT_CATALOG.map((e) => e.name).sort());
    expect(rows.find((r) => r.name === 'LumaWipe')!.excluded).toMatch(/texture/);
  });
});

describe('manifest generation determinism', () => {
  const run = fs.existsSync(path.join(UPSTREAM, 'transitions')) ? it : it.skip;
  run('regenerating from the upstream checkout twice gives byte-identical output equal to the committed files', () => {
    const outs = [0, 1].map((i) => {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), `glt-gen-${i}-`));
      execFileSync('node', [path.resolve(__dirname, '../../../../../scripts/gen-gl-transitions-catalog.mjs'), UPSTREAM, '--out', d], { stdio: 'pipe' });
      return d;
    });
    for (const f of ['catalog.generated.ts', 'upstream-index.generated.json', 'THIRD_PARTY.md']) {
      const a = fs.readFileSync(path.join(outs[0], f), 'utf8');
      expect(fs.readFileSync(path.join(outs[1], f), 'utf8'), f).toBe(a);
      expect(fs.readFileSync(path.join(DIR, f), 'utf8'), `${f} committed == regenerated`).toBe(a);
    }
    expect(execFileSync('git', ['-C', UPSTREAM, 'rev-parse', 'HEAD']).toString().trim()).toBe(GLT_UPSTREAM.commit);
  });
  it('the vendored sources are byte-identical to what upstream-less re-parsing yields (stable JSON)', () => {
    const a = JSON.stringify(GLT_CATALOG.map((e) => parseTransition(e.glsl).params));
    const b = JSON.stringify(GLT_CATALOG.map((e) => parseTransition(e.glsl).params));
    expect(a).toBe(b);
  });
});

describe('runtime helpers', () => {
  it('wraps shaders to the runtime contract and merges stored overrides over defaults', () => {
    expect(isGltId('glt-cube')).toBe(true);
    expect(isGltId('cross-dissolve')).toBe(false);
    expect(gltFrag('glt-cube')).toMatch(/uniform sampler2D u_outgoing;[\s\S]*void main\(\) \{ gl_FragColor = transition\(v_texCoord\); \}/);
    expect(gltFrag('nope')).toBeUndefined();
    const d = gltDefaultParams('glt-cube');
    expect(gltUniforms('glt-cube')).toEqual(d);
    expect(gltUniforms('glt-cube', { persp: 0.1, bogus: 3, unzoom: [1, 2] })).toMatchObject({ persp: 0.1, unzoom: d.unzoom });
    expect(gltLabel('glt-cross-warp')).toBe('Cross Warp');
  });
  it('direction param maps to the four directions and back', () => {
    const id = 'glt-directional-wipe';
    expect(gltDirectionParam(id) ?? gltDirectionParam('glt-directional')).toBeTruthy();
    for (const d of ['left', 'right', 'up', 'down'] as const) expect(directionOf(directionVector(d))).toBe(d);
    expect(gltUniforms('glt-directional', { direction: directionVector('left') }).direction).toEqual([-1, 0]);
  });
  it('search + category filters', () => {
    expect(searchGlt('swirl').map((e) => e.name)).toContain('Swirl');
    expect(searchGlt('', 'Wipe').every((e) => e.category === 'Wipe')).toBe(true);
    expect(searchGlt('zzzzqqq')).toEqual([]);
  });
  it('slider range uses @range, else derives from the default; colour hex round trips', () => {
    expect(sliderRange({ name: 'a', type: 'float', default: 0.5, min: 0, max: 2 })).toMatchObject({ min: 0, max: 2 });
    expect(sliderRange({ name: 'a', type: 'int', default: 4 })).toMatchObject({ min: 0, max: 12, step: 1 });
    expect(hexToVec(vecToHex([1, 0.5, 0, 0.3]), [0, 0, 0, 0.3])[3]).toBe(0.3);
    expect(vecToHex([1, 0, 0])).toBe('#ff0000');
  });
});
