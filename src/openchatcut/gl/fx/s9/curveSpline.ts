// [remix] Fix C (curves editor). Adapted from FreeCut (https://github.com/freecut/freecut, MIT, Copyright (c) 2025 FreeCut),
// commit 5ceeeb388eef5423640b7db157706274bf1b8165, file src/shared/utils/curve-spline.ts: the Fritsch-Carlson monotone tangent
// limiter and the point normalisation are kept in substance. Changes: tangents are computed once per curve (not per sample), the
// evaluator and the LUT builder are separate, the result is a plain function. Pure: no DOM, no clock, no random.

export interface CurvePoint { x: number; y: number }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const IDENTITY_CURVE: CurvePoint[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }];

/** Monotone (Fritsch-Carlson) tangents of already normalised points. */
export function monotoneTangents(points: CurvePoint[]): number[] {
  const n = points.length;
  if (n <= 1) return [0];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) slopes.push((points[i + 1].y - points[i].y) / Math.max(1e-6, points[i + 1].x - points[i].x));
  const t: number[] = new Array(n);
  t[0] = slopes[0];
  t[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    const s = slopes[i];
    if (Math.abs(s) < 1e-6) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / s;
    const b = t[i + 1] / s;
    const m = a * a + b * b;
    if (m > 9) { const k = 3 / Math.sqrt(m); t[i] = k * a * s; t[i + 1] = k * b * s; }
  }
  return t;
}

/** Sort, clamp to 0..1, drop near-duplicate x and pin the first / last point to x = 0 / 1. */
export function normalizeCurvePoints(points: CurvePoint[] | undefined | null): CurvePoint[] {
  const src = (points ?? []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!src.length) return IDENTITY_CURVE.map((p) => ({ ...p }));
  const sorted = src.map((p) => ({ x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) })).sort((a, b) => a.x - b.x);
  const out: CurvePoint[] = [];
  for (const p of sorted) { const prev = out[out.length - 1]; if (!prev || Math.abs(prev.x - p.x) > 0.0005) out.push(p); }
  if (out[0].x > 0.0001) out.unshift({ x: 0, y: out[0].y }); else out[0] = { x: 0, y: out[0].y };
  const last = out[out.length - 1];
  if (last.x < 0.9999) out.push({ x: 1, y: last.y }); else out[out.length - 1] = { x: 1, y: last.y };
  return out;
}

/** A function y = f(x) through the points (monotone cubic Hermite; never overshoots between points). */
export function monotoneCurve(points: CurvePoint[] | undefined | null): (x: number) => number {
  const p = normalizeCurvePoints(points);
  const tan = monotoneTangents(p);
  return (xIn: number) => {
    const x = clamp(xIn, 0, 1);
    if (x <= p[0].x) return p[0].y;
    if (x >= p[p.length - 1].x) return p[p.length - 1].y;
    let i = 0;
    while (i < p.length - 2 && x > p[i + 1].x) i++;
    const l = p[i]; const r = p[i + 1];
    const w = Math.max(1e-6, r.x - l.x);
    const t = clamp((x - l.x) / w, 0, 1);
    const t2 = t * t; const t3 = t2 * t;
    return clamp((2 * t3 - 3 * t2 + 1) * l.y + (t3 - 2 * t2 + t) * w * tan[i] + (-2 * t3 + 3 * t2) * r.y + (t3 - t2) * w * tan[i + 1], 0, 1);
  };
}

/** `size` samples of a curve at x = i / (size - 1). */
export function sampleCurve(fn: (x: number) => number, size: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < size; i++) out.push(fn(i / (size - 1)));
  return out;
}
