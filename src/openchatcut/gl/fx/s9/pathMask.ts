// [remix] Fix C (pen-path masks). Bezier path model, flattening, point-in-path / signed distance and the uniforms for path-mask.frag.
// The vertex model (anchor + in / out handles, normalised 0..1 coordinates, origin top-left) follows FreeCut's `MaskVertex`
// (https://github.com/freecut/freecut, MIT, commit 5ceeeb388eef5423640b7db157706274bf1b8165, src/types/masks.ts); the code is original
// (FreeCut rasterises with Canvas2D / WebGPU; this rasterises per pixel in GLSL and the same maths here for tests and the editor). Pure.
//
// Storage in Clip.fx[].props: `path` = flat [x, y, inX, inY, outX, outY] per vertex, handles are OFFSETS from the anchor. The mask is
// always closed. Anchors can be animated by the scalar keys `v<i>x` / `v<i>y` (Clip.anim `fx:<fx>:v<i>x`, or the older per-effect keys),
// which win over the stored anchor; handles are static. Mask transform = offsetX / offsetY / scale / rotate props (all keyframeable).

export interface PathVertex { x: number; y: number; inX: number; inY: number; outX: number; outY: number }
type Props = Record<string, number | number[] | undefined>;
export const MAX_VERTS = 16;
export const SEG_STEPS = 8;
export const MAX_EDGES = MAX_VERTS * SEG_STEPS;
const KAPPA = 0.5522847498;

export const vertexKey = (i: number, axis: 'x' | 'y') => `v${i}${axis}`;

export function pathFromFlat(flat: unknown): PathVertex[] {
  if (!Array.isArray(flat)) return [];
  const out: PathVertex[] = [];
  for (let i = 0; i + 5 < flat.length && out.length < MAX_VERTS; i += 6) {
    const s = flat.slice(i, i + 6);
    if (s.every((n) => typeof n === 'number' && Number.isFinite(n))) out.push({ x: s[0], y: s[1], inX: s[2], inY: s[3], outX: s[4], outY: s[5] });
  }
  return out;
}
export const pathToFlat = (p: PathVertex[]): number[] => p.flatMap((v) => [v.x, v.y, v.inX, v.inY, v.outX, v.outY]);

export function ellipsePath(cx = 0.5, cy = 0.5, rx = 0.25, ry = 0.25): PathVertex[] {
  const hx = rx * KAPPA, hy = ry * KAPPA;
  return [
    { x: cx, y: cy - ry, inX: -hx, inY: 0, outX: hx, outY: 0 },
    { x: cx + rx, y: cy, inX: 0, inY: -hy, outX: 0, outY: hy },
    { x: cx, y: cy + ry, inX: hx, inY: 0, outX: -hx, outY: 0 },
    { x: cx - rx, y: cy, inX: 0, inY: hy, outX: 0, outY: -hy },
  ];
}
export function rectPath(x0 = 0.25, y0 = 0.25, x1 = 0.75, y1 = 0.75): PathVertex[] {
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x, y, inX: 0, inY: 0, outX: 0, outY: 0 }));
}
export const DEFAULT_PATH_FLAT = pathToFlat(ellipsePath());

/** The path with any animated anchors (`v<i>x` / `v<i>y` in the sampled props) applied. Defaults to the ellipse when `path` is absent. */
export function pathAt(props: Props | undefined): PathVertex[] {
  const raw = props?.path;
  const base = Array.isArray(raw) ? pathFromFlat(raw) : pathFromFlat(DEFAULT_PATH_FLAT);
  return base.map((v, i) => {
    const kx = props?.[vertexKey(i, 'x')]; const ky = props?.[vertexKey(i, 'y')];
    return { ...v, x: typeof kx === 'number' ? kx : v.x, y: typeof ky === 'number' ? ky : v.y };
  });
}

type P2 = [number, number];
/** Closed polygon (list of points, last edge closes to the first) approximating the bezier path. Straight segments stay one edge. */
export function flattenPath(path: PathVertex[]): P2[] {
  const n = path.length;
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = path[i], b = path[(i + 1) % n];
    out.push([a.x, a.y]);
    if (!a.outX && !a.outY && !b.inX && !b.inY) continue;
    const p1: P2 = [a.x + a.outX, a.y + a.outY], p2: P2 = [b.x + b.inX, b.y + b.inY];
    for (let s = 1; s < SEG_STEPS; s++) {
      const t = s / SEG_STEPS, u = 1 - t;
      out.push([
        u * u * u * a.x + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * b.x,
        u * u * u * a.y + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * b.y,
      ]);
    }
  }
  return out;
}

/** Non-zero winding point-in-polygon (the shader uses the same rule). Coordinates in any consistent space. */
export function pointInPolygon(poly: P2[], x: number, y: number): boolean {
  let wn = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const cross = (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]);
    if (a[1] <= y) { if (b[1] > y && cross > 0) wn++; } else if (b[1] <= y && cross < 0) wn--;
  }
  return wn !== 0;
}

export function distanceToPolygon(poly: P2[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy));
  }
  return best;
}

export interface MaskParams {
  feather: number; expand: number; opacity: number; invert: boolean;
  offsetX: number; offsetY: number; scale: number; rotate: number;
}
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
export function maskParams(p: Props | undefined): MaskParams {
  return {
    feather: Math.min(0.5, Math.max(0, num(p?.feather, 0.01))), expand: Math.min(0.5, Math.max(-0.5, num(p?.expand, 0))),
    opacity: Math.min(1, Math.max(0, num(p?.opacity, 1))), invert: num(p?.invert, 0) > 0.5,
    offsetX: Math.min(2, Math.max(-2, num(p?.offsetX, 0))), offsetY: Math.min(2, Math.max(-2, num(p?.offsetY, 0))),
    scale: Math.min(8, Math.max(0.05, num(p?.scale, 1))), rotate: num(p?.rotate, 0),
  };
}

export const polyCentroid = (poly: P2[]): P2 => {
  if (!poly.length) return [0.5, 0.5];
  let x = 0, y = 0; for (const q of poly) { x += q[0]; y += q[1]; }
  return [x / poly.length, y / poly.length];
};

/** Frame point (0..1) -> the path's own space, inverse of the mask transform (about the centroid, rotation in aspect-correct space). */
export function toPathSpace(m: MaskParams, c: P2, aspect: number, x: number, y: number): P2 {
  const r = (-m.rotate * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r);
  const qx = (x - c[0] - m.offsetX) * aspect, qy = y - c[1] - m.offsetY;
  return [c[0] + (qx * co - qy * si) / (m.scale * aspect), c[1] + (qx * si + qy * co) / m.scale];
}
/** Path-space point -> frame point (mask transform applied). Used by the editor overlay to draw / drag a transformed mask. */
export function fromPathSpace(m: MaskParams, c: P2, aspect: number, x: number, y: number): P2 {
  const r = (m.rotate * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r);
  const qx = (x - c[0]) * aspect * m.scale, qy = (y - c[1]) * m.scale;
  return [c[0] + (qx * co - qy * si) / aspect + m.offsetX, c[1] + (qx * si + qy * co) + m.offsetY];
}

/** Mask alpha at frame position (x, y) (0..1, y down) - the CPU twin of path-mask.frag. */
export function maskAlphaAt(props: Props | undefined, x: number, y: number, aspect: number): number {
  const path = pathAt(props);
  if (path.length < 3) return 1;
  const poly = flattenPath(path);
  const m = maskParams(props);
  const c = polyCentroid(poly);
  const pq = toPathSpace(m, c, aspect, x, y);
  const sp = poly.map((q): P2 => [q[0] * aspect, q[1]]);
  const px = pq[0] * aspect, py = pq[1];
  const dist = distanceToPolygon(sp, px, py) * (pointInPolygon(sp, px, py) ? -1 : 1) * m.scale - m.expand;
  const f = Math.max(m.feather, 1e-4);
  const t = Math.min(1, Math.max(0, (dist - f / 2) / (-f)));
  let a = t * t * (3 - 2 * t);
  if (m.invert) a = 1 - a;
  return 1 - m.opacity * (1 - a);
}

/** Uniforms for path-mask.frag. `u_poly` holds one edge (x0, y0, x1, y1) per vec4. */
export function pathMaskUniforms(props: Props | undefined): Record<string, number | number[]> {
  const path = pathAt(props);
  const m = maskParams(props);
  if (path.length < 3) return { u_count: 0, u_poly: new Array(MAX_EDGES * 4).fill(0), u_center: [0.5, 0.5], u_feather: m.feather, u_expand: m.expand, u_opacity: m.opacity, u_invert: m.invert ? 1 : 0, u_offset: [m.offsetX, m.offsetY], u_scale: m.scale, u_rotate: m.rotate };
  const poly = flattenPath(path).slice(0, MAX_EDGES);
  const arr = new Array<number>(MAX_EDGES * 4).fill(0);
  poly.forEach((a, i) => { const b = poly[(i + 1) % poly.length]; arr.splice(i * 4, 4, a[0], a[1], b[0], b[1]); });
  return { u_count: poly.length, u_poly: arr, u_center: polyCentroid(poly), u_feather: m.feather, u_expand: m.expand, u_opacity: m.opacity, u_invert: m.invert ? 1 : 0, u_offset: [m.offsetX, m.offsetY], u_scale: m.scale, u_rotate: m.rotate };
}

// ---- editing (pure) ----------------------------------------------------------------------------------------------------------
export function insertVertexNear(path: PathVertex[], x: number, y: number, aspect = 1): { path: PathVertex[]; index: number } {
  if (path.length < 2) return { path: [...path, { x, y, inX: 0, inY: 0, outX: 0, outY: 0 }], index: path.length };
  let bestI = 0, best = Infinity;
  const poly = flattenPath(path);
  // find the closest flattened edge and map it back to its path segment
  let seg = 0;
  const segOf: number[] = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[(i + 1) % path.length];
    segOf.push(i);
    if (a.outX || a.outY || b.inX || b.inY) for (let s = 1; s < SEG_STEPS; s++) segOf.push(i);
  }
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = (b[0] - a[0]) * aspect, dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, (((x - a[0]) * aspect) * dx + (y - a[1]) * dy) / l2)) : 0;
    const d = Math.hypot((x - a[0]) * aspect - t * dx, y - a[1] - t * dy);
    if (d < best) { best = d; bestI = i; }
  }
  seg = segOf[bestI];
  const next = [...path];
  next.splice(seg + 1, 0, { x, y, inX: 0, inY: 0, outX: 0, outY: 0 });
  return { path: next, index: seg + 1 };
}
export const removeVertex = (path: PathVertex[], i: number): PathVertex[] => path.filter((_, j) => j !== i);
