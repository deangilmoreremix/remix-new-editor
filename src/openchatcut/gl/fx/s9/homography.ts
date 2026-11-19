// [remix] Fix C (corner pin). Planar homographies between the unit square and an arbitrary quad. Original code (the square -> quad
// closed form is the standard projective-mapping result, e.g. Heckbert 1989); FreeCut's corner-pin overlay was only a UI reference.
// Matrices are row-major 3x3 as number[9]. Pure.

export type Pt = [number, number];
/** quad corners in the order top-left, top-right, bottom-right, bottom-left */
export type Quad = [Pt, Pt, Pt, Pt];
export type Mat3 = number[];

export const IDENTITY_QUAD: Quad = [[0, 0], [1, 0], [1, 1], [0, 1]];

/** Matrix M such that M * (u, v, 1) ~ (x, y, w) maps the unit square corners (0,0) (1,0) (1,1) (0,1) onto the quad. null when degenerate. */
export function squareToQuad(q: Quad): Mat3 | null {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g: number, h: number;
  if (Math.abs(dx3) < 1e-12 && Math.abs(dy3) < 1e-12) { g = 0; h = 0; } else {
    const den = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(den) < 1e-12) return null;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
  }
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  const m = [a, b, c, d, e, f, g, h, 1];
  return Math.abs(det3(m)) < 1e-12 ? null : m;
}

export const det3 = (m: Mat3): number =>
  m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);

export function invert3(m: Mat3): Mat3 | null {
  const d = det3(m);
  if (Math.abs(d) < 1e-12) return null;
  const [a, b, c, e, f, g, h, i, j] = m;
  return [
    (f * j - g * i) / d, (c * i - b * j) / d, (b * g - c * f) / d,
    (g * h - e * j) / d, (a * j - c * h) / d, (c * e - a * g) / d,
    (e * i - f * h) / d, (b * h - a * i) / d, (a * f - b * e) / d,
  ];
}

export function applyH(m: Mat3, [x, y]: Pt): Pt {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}

/** Inverse map for the shader: output position (frame coords) -> source position (0..1). null when the quad is degenerate. */
export function quadToSquare(q: Quad): Mat3 | null {
  const m = squareToQuad(q);
  return m && invert3(m);
}

/** A quad is usable when it is convex and non-degenerate (the warp of a self-crossing quad is not a picture). */
export function isConvexQuad(q: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) < 1e-9) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s; else if (s !== sign) return false;
  }
  return true;
}
