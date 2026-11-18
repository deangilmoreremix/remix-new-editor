// Pure helpers behind the transition parameter controls (kept out of the React component so they can be unit tested).
import type { GltParam } from './index';

export interface SliderRange { min: number; max: number; step: number }

/** Slider bounds: the upstream `@range` when present, else a range derived from the default. */
export function sliderRange(p: GltParam): SliderRange {
  const isInt = p.type === 'int';
  const d = typeof p.default === 'number' ? p.default : 0;
  let min = p.min; let max = p.max;
  if (min === undefined || max === undefined || !(max > min)) {
    min = d < 0 ? d * 3 : 0;
    max = d > 0 ? Math.max(1, d * 3) : d < 0 ? Math.abs(d) : 1;
  }
  const step = p.step ?? (isInt ? 1 : (max - min) / 100);
  return { min, max, step: isInt ? Math.max(1, Math.round(step)) : step };
}

const h2 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
export const vecToHex = (v: number[]): string => `#${h2(v[0] ?? 0)}${h2(v[1] ?? 0)}${h2(v[2] ?? 0)}`;
/** #rrggbb -> [r,g,b] floats, keeping the alpha of a vec4 (alpha is not editable in the colour input). */
export function hexToVec(hex: string, prev: number[]): number[] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return prev;
  const n = parseInt(m[1], 16);
  const rgb = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  return prev.length === 4 ? [...rgb, prev[3]] : rgb;
}
