// @vitest-environment node
// Real-browser check: every vendored shader is compiled and rendered through the REAL gl/runtime.ts in headless Chromium
// (WebGL2 via SwiftShader) at progress 0 / 0.5 / 1. Progress 0 must equal the outgoing image and progress 1 the incoming one.
// Skipped when no Chromium is installed (set CHROMIUM_PATH to override the lookup).
// @ts-expect-error plain JS module
import { findChromium, openHarness, checkAll } from '../../../../../scripts/lib/glt-webgl-check.mjs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GLT_CATALOG } from '../index';

const have = !!findChromium();
const TOL = 4; // mean abs error per RGB channel (0-255) at the endpoints; bilinear/blur taps account for the slack

describe.skipIf(!have)('vendored gl-transitions in headless Chromium WebGL', () => {
  let h: Awaited<ReturnType<typeof openHarness>>;
  beforeAll(async () => { h = await openHarness(); }, 120000);
  afterAll(async () => { await h?.close(); });

  it('compiles and renders every vendored shader; progress 0 ~ from, progress 1 ~ to, 0.5 differs from both', async () => {
    const results = await checkAll(h);
    expect(results.length).toBe(GLT_CATALOG.length);
    const failed = results.filter((r: { ok: boolean }) => !r.ok);
    expect(failed, JSON.stringify(failed)).toEqual([]);
    const off = results.filter((r: { d0: number; d1: number }) => r.d0 > TOL || r.d1 > TOL);
    expect(off, JSON.stringify(off)).toEqual([]);
    const flat = results.filter((r: { mid: { toFrom: number; toTo: number } }) => r.mid.toFrom < 2 && r.mid.toTo < 2);
    expect(flat, `mid frame equals both endpoints: ${JSON.stringify(flat)}`).toEqual([]);
    expect(h.errors).toEqual([]);
  }, 240000);

  it('parameter overrides reach the shader (int, ivec2, bool, float, vec2)', async () => {
    const frame = (id: string, p: number, params?: Record<string, unknown>) => h.page.evaluate(([i, pp, pr]: [string, number, unknown]) => (window as unknown as { __glt: { frame: (a: string, b: number, c?: unknown) => { px?: number[]; error?: string } } }).__glt.frame(i, pp, pr), [id, p, params ?? null] as [string, number, unknown]);
    const diff = (a: number[], b: number[]) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
    const cases: Array<[string, Record<string, unknown>]> = [
      ['glt-pixelize', { squaresMin: [4, 4] }],      // ivec2
      ['glt-cube', { persp: 0.0, reflection: 0 }],    // floats
      ['glt-directional', { direction: [1, 0] }],     // vec2
      ['glt-pixelize', { steps: 3 }],              // int
    ];
    for (const [id, params] of cases) {
      const base = await frame(id, 0.5); const mod = await frame(id, 0.5, params);
      expect(base.error ?? mod.error, id).toBeUndefined();
      expect(diff(base.px!, mod.px!), `${id} override changes the frame`).toBeGreaterThan(0.5);
    }
    // bool param: find any vendored shader with a bool and flip it
    const boolEntry = GLT_CATALOG.find((e) => e.params.some((p) => p.type === 'bool'));
    if (boolEntry) {
      const bp = boolEntry.params.find((p) => p.type === 'bool')!;
      const a = await frame(boolEntry.id, 0.5); const b = await frame(boolEntry.id, 0.5, { [bp.name]: !bp.default });
      expect(a.error ?? b.error).toBeUndefined();
    }
  }, 60000);
});
