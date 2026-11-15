// [remix] Fix C (corner pin): the effect's props <-> quad, and the uniforms for corner-pin.frag. Pure.
import { IDENTITY_QUAD, isConvexQuad, quadToSquare, type Quad } from './homography';

export const CORNER_KEYS = [['tlx', 'tly'], ['trx', 'try'], ['brx', 'bry'], ['blx', 'bly']] as const;
type Props = Record<string, number | number[] | undefined>;
const clampN = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(3, Math.max(-2, v)) : d);

/** Corners in frame coordinates (0..1, origin top-left, y down; may lie outside the frame). Missing props = the frame's own corners. */
export function quadFromProps(p: Props | undefined): Quad {
  return CORNER_KEYS.map(([kx, ky], i) => [clampN(p?.[kx], IDENTITY_QUAD[i][0]), clampN(p?.[ky], IDENTITY_QUAD[i][1])]) as Quad;
}
export const propsFromQuad = (q: Quad): Record<string, number> => Object.fromEntries(CORNER_KEYS.flatMap(([kx, ky], i) => [[kx, q[i][0]], [ky, q[i][1]]]));

export function cornerPinUniforms(p: Props | undefined): Record<string, number | number[]> {
  const q = quadFromProps(p);
  const inv = isConvexQuad(q) ? quadToSquare(q) : null;
  const m = inv ?? [1, 0, 0, 0, 1, 0, 0, 0, 1];
  return { u_h0: m.slice(0, 3), u_h1: m.slice(3, 6), u_h2: m.slice(6, 9), u_valid: inv ? 1 : 0 };
}
