// [remix] Stage 2: per-character / per-word / per-line text animation as a pure function of elapsed time (no clock, no random).
// Design follows FreeCut's text-motion (https://github.com/freecut/freecut, MIT, commit 5ceeeb388eef5423640b7db157706274bf1b8165,
// src/shared/typography/text-motion/*: unit segmentation, stagger + order, per-unit progress) but FreeCut's evaluator is wired to its GPU
// glyph-atlas renderer, so only the idea is reused here: units are rendered as DOM spans by the existing caption renderer, and this module
// only decides each unit's opacity / transform from the elapsed milliseconds.
import { applyEase, type EaseSpec } from './easing';

export type TextUnit = 'char' | 'word' | 'line';
export type TextEffect = 'fade' | 'rise' | 'pop' | 'wave';
export type TextOrder = 'forward' | 'backward' | 'center' | 'random';

export interface TextMotionSpec {
  unit: TextUnit;
  effect: TextEffect;
  /** per-unit animation length (wave: cycle length) */
  durationMs: number;
  /** delay between neighbouring units (in `order`) */
  staggerMs: number;
  order: TextOrder;
  /** seed for `random` order */
  seed?: number;
  ease?: EaseSpec;
}

/** Split text into animation units. Characters are Unicode code points; `line` splits on line breaks; `word` keeps the whitespace with the preceding word. */
export function splitUnits(text: string, unit: TextUnit): string[] {
  if (unit === 'char') return Array.from(text);
  if (unit === 'line') return text.split(/(?<=\n)/u);
  return text.match(/\S+\s*|\s+/gu) ?? [];
}

const hash = (n: number) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

/** Rank (0 = first to animate) of unit `i` of `n`. `random` is a seeded permutation: the same seed always gives the same order. */
export function unitRank(i: number, n: number, order: TextOrder, seed = 1): number {
  if (n <= 1) return 0;
  switch (order) {
    case 'backward': return n - 1 - i;
    case 'center': return Math.round(Math.abs(i - (n - 1) / 2));
    case 'random': {
      const mine = hash(seed * 131 + i);
      let rank = 0;
      for (let j = 0; j < n; j++) { const h = hash(seed * 131 + j); if (h < mine || (h === mine && j < i)) rank++; }
      return rank;
    }
    default: return i;
  }
}

export interface UnitStyle { opacity: number; transform?: string }
const f = (n: number) => Number(n.toFixed(4));

/** Style of unit `i` of `n` after `elapsedMs` since the text appeared. Revealing effects hold their end state (opacity 1, no transform). */
export function unitStyle(spec: TextMotionSpec, i: number, n: number, elapsedMs: number): UnitStyle {
  const rank = unitRank(i, n, spec.order, spec.seed);
  const local = elapsedMs - rank * spec.staggerMs;
  const dur = Math.max(1, spec.durationMs);
  if (spec.effect === 'wave') {
    if (local < 0) return { opacity: 1 };
    return { opacity: 1, transform: `translateY(${f(Math.sin((local / dur) * Math.PI * 2) * -0.15)}em)` };
  }
  const p = Math.max(0, Math.min(1, local / dur));
  if (local < 0) return { opacity: 0, ...(spec.effect === 'rise' ? { transform: 'translateY(0.4em)' } : spec.effect === 'pop' ? { transform: 'scale(0.5)' } : {}) };
  if (p >= 1 && !(typeof spec.ease === 'object' && spec.ease !== null && 'spring' in spec.ease)) return { opacity: 1 };
  const e = applyEase(p, spec.ease ?? (spec.effect === 'pop' ? 'ease-out-back' : 'ease-out-cubic'));
  switch (spec.effect) {
    case 'fade': return { opacity: f(e) };
    case 'rise': return { opacity: f(Math.min(1, e * 1.5)), transform: `translateY(${f((1 - e) * 0.4)}em)` };
    case 'pop': return { opacity: f(Math.min(1, p * 4)), transform: `scale(${f(0.5 + 0.5 * e)})` };
    default: return { opacity: 1 };
  }
}

/** Caption motion presets that use this module (ids stored in CaptionsData.motionPreset). */
export const TEXT_MOTION_PRESETS = {
  'char-rise': { unit: 'char', effect: 'rise', durationMs: 220, staggerMs: 30, order: 'forward' },
  'char-pop': { unit: 'char', effect: 'pop', durationMs: 260, staggerMs: 35, order: 'forward' },
  'char-wave': { unit: 'char', effect: 'wave', durationMs: 900, staggerMs: 60, order: 'forward' },
  'word-rise': { unit: 'word', effect: 'rise', durationMs: 260, staggerMs: 0, order: 'forward' },
} as const satisfies Record<string, TextMotionSpec>;
export type TextMotionPresetId = keyof typeof TEXT_MOTION_PRESETS;
export const isTextMotionPreset = (id: unknown): id is TextMotionPresetId => typeof id === 'string' && id in TEXT_MOTION_PRESETS;
