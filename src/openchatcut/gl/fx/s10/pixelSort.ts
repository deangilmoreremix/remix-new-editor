// [remix] Fix G: Pixel Sort (Stage 3's one missing effect). Deterministic WebGL2 multi-pass fragment-shader effect, no compute shaders.
// Registered like every other effect (FX_EFFECTS -> inspector, Clip.fx[].props, Clip.anim keys fx:<i>:<prop>, ClipFx.tsx export).
// Inspired by FreeCut's pixel-sort (MIT, commit 5ceeeb388eef5423640b7db157706274bf1b8165; WGSL compute, not copied): independent
// re-implementation as an odd-even transposition sort over ping-pong passes.
//
// COST (documented): passes = 1 (copy) + length (sort steps) + (1 mix if strength < 1). Each sort step is one full-frame draw with
// 2 texelFetch + 2 key evaluations per pixel. length is clamped to 64: at 1920x1080 that is 65-66 full-frame passes = about 135M
// pixel-shader invocations per frame (SwiftShader software GL: seconds per frame; a real GPU: low milliseconds). Three FBO textures are
// used however large `length` is (FxPass.slot ping-pong).
// SEMANTICS (documented): one transposition step moves a pixel at most 1 position, so `length` = maximum distance a pixel can travel.
// A masked run of L pixels is completely sorted when length >= L; longer runs are only partly sorted (the usual "streak" look).
import type { FxDef, FxProperty } from '../uniforms';
import type { FxPass, UniformValue } from '../../runtimeTypes';
import prepFrag from './pixel-sort-prep.frag?raw';
import stepFrag from './pixel-sort-step.frag?raw';
import mixFrag from './pixel-sort-mix.frag?raw';

export const PIXEL_SORT_ID = 'builtin:fx-pixel-sort';
export const PIXEL_SORT_MAX_LENGTH = 64;

const n = (key: string, label: string, def: number, min: number, max: number, step = 0.01): FxProperty => ({ key, label, default: def, min, max, step });

/** Number of sort steps for a (clamped) uniform map. */
export function pixelSortSteps(u: Record<string, UniformValue>): number {
  const len = typeof u.u_length === 'number' ? u.u_length : 0;
  return Math.max(0, Math.min(PIXEL_SORT_MAX_LENGTH, Math.round(len)));
}

/** pass graph: [copy, step x length, (mix)]; slots: copy 0, steps alternate 1 / 2, mix takes whichever of 1 / 2 the last step did not use. */
export function pixelSortPasses(u: Record<string, UniformValue>): FxPass[] {
  const steps = pixelSortSteps(u);
  const strength = typeof u.u_strength === 'number' ? u.u_strength : 1;
  if (steps === 0 || strength <= 0) return [{ frag: prepFrag, uniforms: u }]; // identity
  const out: FxPass[] = [{ frag: prepFrag, uniforms: u, slot: 0 }];
  for (let k = 0; k < steps; k++) out.push({ frag: stepFrag, uniforms: { ...u, u_parity: k & 1 }, slot: 1 + (k & 1) });
  if (strength < 0.999) {
    const lastSlot = 1 + ((steps - 1) & 1);
    out.push({ frag: mixFrag, uniforms: u, samplers: { u_orig: 0 }, slot: lastSlot === 1 ? 2 : 1 });
  }
  return out;
}

export const PIXEL_SORT_FX: FxDef = {
  id: PIXEL_SORT_ID, name: 'Pixel Sort',
  desc: 'Glitch-art pixel sorting: pixels whose brightness / hue / saturation falls inside the threshold window are sorted along rows or columns. Length = how far pixels can travel (up to 64 passes; cost grows with length).',
  frag: stepFrag,
  pipeline: pixelSortPasses,
  props: [
    n('low', 'Threshold low', 0.25, 0, 1), n('high', 'Threshold high', 0.85, 0, 1),
    n('key', 'Sort key (0 luma / 1 hue / 2 saturation / 3 brightness)', 0, 0, 3, 1),
    n('axis', 'Axis (0 horizontal / 1 vertical)', 0, 0, 1, 1),
    n('ascending', 'Ascending (1) / descending (0)', 1, 0, 1, 1),
    n('length', 'Length (passes, max 64)', 32, 0, PIXEL_SORT_MAX_LENGTH, 1),
    n('strength', 'Strength', 1, 0, 1),
    n('invert', 'Invert mask', 0, 0, 1, 1),
  ],
};

export const PIXEL_SORT_META = {
  /** property sets under which the effect must be the identity */
  neutral: [{ length: 0 }, { low: 1, high: 0 }, { strength: 0 }],
  probe: { length: 64, low: 0, high: 1 },
};
