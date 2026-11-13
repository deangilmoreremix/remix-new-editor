// Adapted from FreeCut (https://github.com/freecut/freecut, MIT licence), commit 5ceeeb388eef5423640b7db157706274bf1b8165,
// file src/shared/utils/easing.ts: `cubicBezier` (Newton solve on the x curve) and `springEasing` (damped harmonic oscillator, scaled so
// the settle time maps onto 0..1) are kept in substance; the `@/types/keyframe` types are replaced by local ones, the CSS named curves,
// cubic variants, a `back` curve and the EaseSpec union (preset | custom cubic-bezier | spring) are new. Pure: no DOM, no clock, no random.

export type BezierPoints = [number, number, number, number];
export interface SpringParams { tension: number; friction: number; mass: number }
export const DEFAULT_SPRING: SpringParams = { tension: 170, friction: 26, mass: 1 };

/** Named presets (stored by name). `hold` keeps the left value until the next key. */
export const EASE_PRESETS = [
  'linear', 'ease-in', 'ease-out', 'ease-in-out',
  'ease-in-cubic', 'ease-out-cubic', 'ease-in-out-cubic',
  'ease-out-back', 'hold',
] as const;
export type EasePreset = (typeof EASE_PRESETS)[number];

export type EaseSpec = EasePreset | { bezier: BezierPoints } | { spring: SpringParams };

export const EASE_LABELS: Record<EasePreset, string> = {
  linear: 'Linear', 'ease-in': 'Ease in', 'ease-out': 'Ease out', 'ease-in-out': 'Ease in-out',
  'ease-in-cubic': 'Ease in (cubic)', 'ease-out-cubic': 'Ease out (cubic)', 'ease-in-out-cubic': 'Ease in-out (cubic)',
  'ease-out-back': 'Overshoot', hold: 'Hold',
};

/** Control points that draw each bezier-expressible preset in the curve editor (the quadratic ones are approximations for display only). */
export const PRESET_BEZIER: Partial<Record<EasePreset, BezierPoints>> = {
  linear: [0, 0, 1, 1], 'ease-in': [0.55, 0.085, 0.68, 0.53], 'ease-out': [0.25, 0.46, 0.45, 0.94], 'ease-in-out': [0.455, 0.03, 0.515, 0.955],
  'ease-in-cubic': [0.32, 0, 0.67, 0], 'ease-out-cubic': [0.33, 1, 0.68, 1], 'ease-in-out-cubic': [0.65, 0, 0.35, 1], 'ease-out-back': [0.34, 1.56, 0.64, 1],
};

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** CSS-style cubic-bezier(x1,y1,x2,y2): progress t (0..1, time) -> eased value. (FreeCut `cubicBezier`.) */
export function cubicBezier(t: number, [x1, y1, x2, y2]: BezierPoints): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const cx = 3 * x1; const bx = 3 * (x2 - x1) - cx; const ax = 1 - cx - bx;
  const cy = 3 * y1; const by = 3 * (y2 - y1) - cy; const ay = 1 - cy - by;
  let u = t;
  for (let i = 0; i < 8; i++) {
    const dx = ((ax * u + bx) * u + cx) * u - t;
    if (Math.abs(dx) < 1e-6) break;
    const d = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(d) < 1e-6) break;
    u = Math.max(0, Math.min(1, u - dx / d));
  }
  // bisection fallback when Newton did not converge (steep or flat x curves)
  let x = ((ax * u + bx) * u + cx) * u;
  if (Math.abs(x - t) > 1e-5) {
    let lo = 0; let hi = 1; u = t;
    for (let i = 0; i < 40; i++) { x = ((ax * u + bx) * u + cx) * u; if (x < t) lo = u; else hi = u; u = (lo + hi) / 2; }
  }
  return ((ay * u + by) * u + cy) * u;
}

/** Damped spring step response, time scaled so the settle time (4 / (zeta * omega0)) maps onto 0..1. (FreeCut `springEasing`.) */
export function springEasing(t: number, { tension, friction, mass }: SpringParams): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const omega0 = Math.sqrt(tension / mass);
  const zeta = friction / (2 * Math.sqrt(tension * mass));
  const s = t * (4 / (zeta * omega0));
  let value: number;
  if (zeta < 1) {
    const wd = omega0 * Math.sqrt(1 - zeta * zeta);
    value = 1 - Math.exp(-zeta * omega0 * s) * (Math.cos(wd * s) + ((zeta * omega0) / wd) * Math.sin(wd * s));
  } else if (zeta === 1) {
    value = 1 - Math.exp(-omega0 * s) * (1 + omega0 * s);
  } else {
    const r = Math.sqrt(zeta * zeta - 1);
    const s1 = -omega0 * (zeta - r); const s2 = -omega0 * (zeta + r);
    value = 1 - (s2 * Math.exp(s1 * s) - s1 * Math.exp(s2 * s)) / (s2 - s1);
  }
  return Math.max(0, Math.min(1.2, value));
}

/** Eased progress for linear progress `p` (0..1). Unknown specs fall back to linear. */
export function applyEase(p: number, ease: EaseSpec | undefined): number {
  const t = clamp01(Number.isFinite(p) ? p : 0);
  if (!ease || ease === 'linear') return t;
  if (typeof ease === 'string') {
    switch (ease) {
      case 'ease-in': return t * t;
      case 'ease-out': return t * (2 - t);
      case 'ease-in-out': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case 'ease-in-cubic': return t * t * t;
      case 'ease-out-cubic': return 1 - (1 - t) ** 3;
      case 'ease-in-out-cubic': return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      case 'ease-out-back': return cubicBezier(t, PRESET_BEZIER['ease-out-back']!);
      case 'hold': return 0;
      default: return t;
    }
  }
  if ('bezier' in ease && Array.isArray(ease.bezier) && ease.bezier.length === 4) return cubicBezier(t, ease.bezier);
  if ('spring' in ease && ease.spring) return springEasing(t, ease.spring);
  return t;
}

/** Validate an untrusted (loaded / hand-edited) easing value. */
export function normalizeEase(e: unknown): EaseSpec {
  if (typeof e === 'string') return (EASE_PRESETS as readonly string[]).includes(e) ? (e as EasePreset) : 'linear';
  if (e && typeof e === 'object') {
    const b = (e as { bezier?: unknown }).bezier;
    if (Array.isArray(b) && b.length === 4 && b.every((n) => typeof n === 'number' && Number.isFinite(n))) {
      return { bezier: [clamp01(b[0]), b[1], clamp01(b[2]), b[3]] as BezierPoints };
    }
    const s = (e as { spring?: Partial<SpringParams> }).spring;
    if (s && [s.tension, s.friction, s.mass].every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0)) return { spring: { tension: s.tension!, friction: s.friction!, mass: s.mass! } };
  }
  return 'linear';
}
