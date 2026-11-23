// Deterministic motion primitives (no Date.now / Math.random). Same easing set as the skill's demos/_fixtures/Motion.tsx.
export const E = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => t * (2 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  outBack: (t: number, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
};

export const lerp = (t: number, a: number, b: number) => a + (b - a) * t;

/** Segment progress: t clamped to [t0,t1], normalised, eased. */
export const seg = (t: number, t0: number, t1: number, ease: (x: number) => number = E.linear) =>
  ease(Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));

/** CSS-style cubic-bezier easing (same maths as Remotion's Easing.bezier). */
export const bezier = (x1: number, y1: number, x2: number, y2: number) => {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = (sx(t) - x) / (((3 * ax * t + 2 * bx) * t) + cx || 1);
      t -= d;
    }
    t = Math.min(1, Math.max(0, t));
    return sy(t);
  };
};

/** Seeded pseudo-random in [0,1). */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
