// [remix] Fix C: tone-curve model for the Curves effect (RGB master + per-channel curves). Pure.
// Storage in Clip.fx[].props: `curve_m`, `curve_r`, `curve_g`, `curve_b` = flat [x0, y0, x1, y1, ...] (0..1). Projects saved before this
// (p0..p4 + r_mid / g_mid / b_mid sliders only) have none of those keys and are rendered through the legacy path below, which
// reproduces the old Catmull-Rom shader.
import { IDENTITY_CURVE, monotoneCurve, type CurvePoint } from './curveSpline';

export const LUT_SIZE = 128;
export type CurveChannel = 'm' | 'r' | 'g' | 'b';
export const CURVE_CHANNELS: CurveChannel[] = ['m', 'r', 'g', 'b'];
export const curveKey = (c: CurveChannel) => `curve_${c}`;
type Props = Record<string, number | number[] | undefined>;

export function flatToPoints(flat: unknown): CurvePoint[] {
  if (!Array.isArray(flat)) return IDENTITY_CURVE.map((p) => ({ ...p }));
  const out: CurvePoint[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) if (Number.isFinite(flat[i]) && Number.isFinite(flat[i + 1])) out.push({ x: flat[i], y: flat[i + 1] });
  return out.length >= 2 ? out : IDENTITY_CURVE.map((p) => ({ ...p }));
}
export const pointsToFlat = (pts: CurvePoint[]): number[] => pts.flatMap((p) => [p.x, p.y]);

export const hasNewCurves = (props: Props | undefined): boolean => !!props && CURVE_CHANNELS.some((c) => Array.isArray(props[curveKey(c)]));

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** The old 5-point Catmull-Rom master curve (identical maths to the previous curves.frag). */
function legacyMaster(props: Props): (x: number) => number {
  const y = [num(props.p0, 0), num(props.p1, 0.25), num(props.p2, 0.5), num(props.p3, 0.75), num(props.p4, 1)];
  return (xIn: number) => {
    const x = Math.min(1, Math.max(0, xIn));
    const i = Math.min(Math.floor(x * 4), 3);
    const t = x * 4 - i;
    const p0 = y[i]; const p1 = y[i + 1];
    const m0 = i === 0 ? p1 - p0 : (y[i + 1] - y[i - 1]) * 0.5;
    const m1 = i === 3 ? p1 - p0 : (y[i + 2] - y[i]) * 0.5;
    const t2 = t * t; const t3 = t2 * t;
    const v = (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
    return Math.min(1, Math.max(0, v));
  };
}

/** Per-channel functions in -> out: channel(master(x)). */
export function channelFunctions(props: Props | undefined): [(x: number) => number, (x: number) => number, (x: number) => number] {
  const p = props ?? {};
  if (!hasNewCurves(p)) {
    const m = legacyMaster(p);
    const bend = (mid: number) => (x: number) => { const o = m(x); return Math.min(1, Math.max(0, o + mid * 4 * o * (1 - o))); };
    return [bend(num(p.r_mid, 0)), bend(num(p.g_mid, 0)), bend(num(p.b_mid, 0))];
  }
  const m = monotoneCurve(flatToPoints(p[curveKey('m')]));
  const ch = (c: CurveChannel) => { const f = monotoneCurve(flatToPoints(p[curveKey(c)])); return (x: number) => f(m(x)); };
  return [ch('r'), ch('g'), ch('b')];
}

/** Flat vec4 array (LUT_SIZE rows of r, g, b, 0) for `uniform vec4 u_lut[LUT_SIZE]`. */
export function buildCurveLut(props: Props | undefined): number[] {
  const [fr, fg, fb] = channelFunctions(props);
  const out: number[] = [];
  for (let i = 0; i < LUT_SIZE; i++) { const x = i / (LUT_SIZE - 1); out.push(fr(x), fg(x), fb(x), 0); }
  return out;
}

/** Same lookup as the shader (linear interpolation of the LUT) - used by tests and the editor's preview curve. */
export function lutLookup(lut: number[], channel: 0 | 1 | 2, x: number): number {
  const f = Math.min(1, Math.max(0, x)) * (LUT_SIZE - 1);
  const i = Math.min(Math.floor(f), LUT_SIZE - 2);
  const t = f - i;
  return lut[i * 4 + channel] * (1 - t) + lut[(i + 1) * 4 + channel] * t;
}

/** Control points the editor shows for a channel; legacy projects start from their five master points. */
export function editorPoints(props: Props | undefined, c: CurveChannel): CurvePoint[] {
  const p = props ?? {};
  if (hasNewCurves(p)) return flatToPoints(p[curveKey(c)]);
  if (c === 'm') return [0, 0.25, 0.5, 0.75, 1].map((x, i) => ({ x, y: num(p[`p${i}`], x) }));
  const mid = num(p[`${c}_mid`], 0);
  return mid ? [{ x: 0, y: 0 }, { x: 0.5, y: Math.min(1, Math.max(0, 0.5 + mid)) }, { x: 1, y: 1 }] : IDENTITY_CURVE.map((q) => ({ ...q }));
}
