// [remix] Stage 11 (port J): speed-ramp CURVE (pure). Stage 1 only had four stepped presets with linear speed between points. A speed curve is a list
// of points over the clip's SOURCE range (at 0..1, speed in x) where the easing of each segment is an EaseSpec (presets, cubic-bezier, spring: the same
// model and the same `applyEase` the Stage 2 keyframes and the Stage 2 curve editor use).
//
// Time remap: the time to play source fraction u is  tau(u) = S * integral_0^u dx / speed(x)  (S = visible source seconds). Both the preview and the Remotion
// export play each clip at ONE constant speed, so the curve is realised as N consecutive clips over equal source spans whose constant speed is the
// harmonic mean of the curve over that span: sp_i = (1/N) / integral_span dx/speed(x). With that choice every piece boundary lies exactly ON the remap
// (source position and timeline time are both exact at the boundaries) and the total duration equals tau(1) exactly (up to speed rounding); only the
// motion INSIDE a piece is constant-speed. Everything downstream (preview, export, undo, save) sees ordinary clips; no new renderer.
// Pure: no clock, no random. The integrator is a fixed composite Simpson rule, so the same curve always gives the same numbers.
import type { Timeline } from '@cinegen/types/timeline';
import { applyEase, normalizeEase, type EaseSpec } from '../stage2/easing';
import { applySpeedRamp, RAMP_MAX_SPEED, RAMP_MIN_SPEED, type RampResult } from '../stage1/speed-ramp';

export interface SpeedPoint { at: number; speed: number; /** easing of the segment that STARTS at this point (ignored on the last point) */ ease?: EaseSpec }
export interface SpeedCurve { points: SpeedPoint[] }

export const CURVE_MIN_STEPS = 4;
// Fix M: the earlier stall of a 40-piece export was NOT reproduced (it matches a cold dev server compiling the export runner while the machine was loaded, see docs/stage-11/FIX_M_REPORT.md); real exports of 16 to 64 pieces now finish in 13 to 21 s each (40, 48 and 64 proven, 64 twice, once under CPU load)
export const CURVE_MAX_STEPS = 64;
export const CURVE_DEFAULT_STEPS = 24;
const SIMPSON = 64; // sub-intervals per piece (even)

const clampSpeed = (s: number) => Math.max(RAMP_MIN_SPEED, Math.min(RAMP_MAX_SPEED, s));

/** Validate an untrusted curve (saved JSON, hand-edited): sorted, first point at 0, last at 1, speeds clamped, easing normalised. At least 2 points. */
export function normalizeCurve(raw: unknown): SpeedCurve {
  const list = Array.isArray((raw as SpeedCurve | undefined)?.points) ? (raw as SpeedCurve).points : [];
  const pts = list
    .filter((p) => p && Number.isFinite(p.at) && Number.isFinite(p.speed))
    .map((p) => ({ at: Math.max(0, Math.min(1, p.at)), speed: clampSpeed(p.speed), ease: p.ease === undefined ? undefined : normalizeEase(p.ease) }))
    .sort((a, b) => a.at - b.at);
  if (pts.length < 2) {
    const s = pts[0]?.speed ?? 1;
    return { points: [{ at: 0, speed: s }, { at: 1, speed: s }] };
  }
  pts[0].at = 0; pts[pts.length - 1].at = 1;
  // collapse points at the same position (keep the later one, which is the one the user dragged last)
  const out: SpeedPoint[] = [];
  for (const p of pts) { if (out.length && Math.abs(out[out.length - 1].at - p.at) < 1e-6 && out.length > 1 && p.at < 1) out[out.length - 1] = p; else out.push(p); }
  return { points: out.map((p) => (p.ease === undefined ? { at: p.at, speed: p.speed } : p)) };
}

/** Speed at source fraction u (0..1): eased interpolation between the surrounding points, clamped to the supported speed range. */
export function curveSpeedAt(curve: SpeedCurve, u: number): number {
  const p = curve.points;
  if (!p.length) return 1;
  if (u <= p[0].at) return clampSpeed(p[0].speed);
  if (u >= p[p.length - 1].at) return clampSpeed(p[p.length - 1].speed);
  for (let i = 0; i < p.length - 1; i++) {
    if (u >= p[i].at && u <= p[i + 1].at) {
      const span = p[i + 1].at - p[i].at;
      const f = span <= 0 ? 1 : (u - p[i].at) / span;
      return clampSpeed(p[i].speed + applyEase(f, p[i].ease) * (p[i + 1].speed - p[i].speed));
    }
  }
  return 1;
}

/** integral from a to b of dx / speed(x), composite Simpson */
export function invSpeedIntegral(curve: SpeedCurve, a: number, b: number, n = SIMPSON): number {
  if (!(b > a)) return 0;
  const m = n % 2 ? n + 1 : n;
  const h = (b - a) / m;
  const f = (x: number) => 1 / curveSpeedAt(curve, x);
  let s = f(a) + f(b);
  for (let i = 1; i < m; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}

/** Timeline seconds needed to play source fraction 0..u of a clip with `sourceSeconds` visible source. The exact remap. */
export function curveTimeAt(curve: SpeedCurve, u: number, sourceSeconds: number, grain = 256): number {
  const uu = Math.max(0, Math.min(1, u));
  return sourceSeconds * invSpeedIntegral(curve, 0, uu, Math.max(2, Math.ceil(grain * uu)));
}

export const curveDuration = (curve: SpeedCurve, sourceSeconds: number): number => curveTimeAt(curve, 1, sourceSeconds, 1024);

/** Inverse remap: source fraction reached after `t` timeline seconds (bisection on the monotone curveTimeAt). */
export function curveSourceAt(curve: SpeedCurve, t: number, sourceSeconds: number): number {
  const total = curveDuration(curve, sourceSeconds);
  if (t <= 0) return 0;
  if (t >= total) return 1;
  let lo = 0; let hi = 1;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (curveTimeAt(curve, mid, sourceSeconds, 512) < t) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/** Constant speed per piece: harmonic mean over each of `steps` equal source spans. */
export function curvePieceSpeeds(curve: SpeedCurve, steps = CURVE_DEFAULT_STEPS): number[] {
  const n = Math.max(CURVE_MIN_STEPS, Math.min(CURVE_MAX_STEPS, Math.round(steps)));
  return Array.from({ length: n }, (_, i) => {
    const a = i / n; const b = (i + 1) / n;
    return Math.round(clampSpeed((b - a) / invSpeedIntegral(curve, a, b)) * 10000) / 10000;
  });
}

/** Samples for drawing: [fraction, speed] */
export const sampleCurve = (curve: SpeedCurve, n = 80): Array<[number, number]> => Array.from({ length: n + 1 }, (_, i) => [i / n, curveSpeedAt(curve, i / n)]);

/** Result duration (timeline seconds) of ramping a clip with the curve, from the pieces that would actually be made. */
export function pieceDuration(speeds: number[], sourceSeconds: number): number {
  return speeds.reduce((m, sp) => m + sourceSeconds / speeds.length / sp, 0);
}

export const CURVE_PRESETS: Record<string, { label: string; curve: SpeedCurve }> = {
  'ease-into-slow': { label: 'Ease into slow-mo (1x to 0.2x)', curve: { points: [{ at: 0, speed: 1, ease: 'ease-in-out' }, { at: 1, speed: 0.2 }] } },
  'ease-out-of-slow': { label: 'Ease out of slow-mo (0.2x to 1x)', curve: { points: [{ at: 0, speed: 0.2, ease: 'ease-in-out' }, { at: 1, speed: 1 }] } },
  'hero-moment': { label: 'Hero moment (1x, 0.2x, 1x)', curve: { points: [{ at: 0, speed: 1, ease: 'ease-in-out' }, { at: 0.5, speed: 0.2, ease: 'ease-in-out' }, { at: 1, speed: 1 }] } },
  'flash-forward': { label: 'Flash forward (1x, 5x, 1x)', curve: { points: [{ at: 0, speed: 1, ease: 'ease-in-out' }, { at: 0.5, speed: 5, ease: 'ease-in-out' }, { at: 1, speed: 1 }] } },
};

/** Replace the clip (and its linked clips) by `steps` pieces that follow the curve. Later clips ripple by the length change. */
export function applySpeedCurve(timeline: Timeline, clipId: string, curve: SpeedCurve, opts: { steps?: number; ripple?: boolean } = {}): RampResult {
  const c = normalizeCurve(curve);
  return applySpeedRamp(timeline, clipId, c.points.map((p) => ({ at: p.at, speed: p.speed })), { ripple: opts.ripple, speeds: curvePieceSpeeds(c, opts.steps) });
}
