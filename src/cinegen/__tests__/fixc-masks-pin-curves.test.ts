// Fix C: pen-path masks, corner pin, draggable curves (spline / LUT), colour props. Pure maths, persistence round trip, keyframes and the real
// export mapping. GPU output vs the CPU twins is checked in docs/stage-9/smoke/fixc-gl-check.cjs (headless Chromium).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_FX, FX_IDS } from '../../openchatcut/gl/fx/effects';
import { fxPasses, fxUniforms } from '../../openchatcut/gl/fx/uniforms';
import { monotoneCurve, monotoneTangents, normalizeCurvePoints, sampleCurve } from '../../openchatcut/gl/fx/s9/curveSpline';
import { LUT_SIZE, addPoint, buildCurveLut, channelFunctions, editorPoints, hasNewCurves, lutLookup, movePoint, pointsToFlat, removePoint } from '../../openchatcut/gl/fx/s9/curves';
import { IDENTITY_QUAD, applyH, invert3, isConvexQuad, quadToSquare, squareToQuad, type Quad } from '../../openchatcut/gl/fx/s9/homography';
import { cornerPinUniforms, propsFromQuad, quadFromProps } from '../../openchatcut/gl/fx/s9/cornerPin';
import { MAX_EDGES, distanceToPolygon, ellipsePath, flattenPath, fromPathSpace, insertVertexNear, maskAlphaAt, pathAt, pathMaskUniforms, pathToFlat, pointInPolygon, polyCentroid, rectPath, toPathSpace, maskParams } from '../../openchatcut/gl/fx/s9/pathMask';
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv } from '../../openchatcut/gl/fx/s9/colour';
import { bakeVertexKeys, hasVertexKeys, keyAllAnchorsPatch, moveAnchorPatch, sampledFxAt, scalarPatch, setPathPatch } from '@cinegen/lib/occ/fx-edit-model';
import { clipFxInstances, clipFxPasses } from '@cinegen/lib/occ/clip-fx';
import { createDefaultTimeline, addClipToTrack } from '@cinegen/lib/editor/timeline-operations';
import { exportClipsFromTimeline, exportItem, exportTracksFromTimeline, exportTransitionsFromTimeline, buildExportState } from '@cinegen/lib/editor/export-mapping';
import { clipToRow, timelineFromRows, trackToRow, transitionToRow } from '@cinegen/lib/db-converters';
// @ts-expect-error plain JS module
import { timelineToComposition } from '../../lib/editor/remotion/timelineToComposition.js';
import type { Asset } from '@cinegen/types/project';
import type { Clip, Timeline } from '@cinegen/types/timeline';

const asset = (id: string): Asset => ({ id, name: id, type: 'video', url: `https://x.test/${id}.mp4`, duration: 10, createdAt: '2026-01-01' });
const mkClip = (over: Partial<Clip> = {}): Clip => ({ id: 'c1', assetId: 'A', trackId: 't', name: 'c', startTime: 0, duration: 4, trimStart: 0, trimEnd: 0, speed: 1, opacity: 1, volume: 1, flipH: false, flipV: false, keyframes: [], ...over });
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe('monotone spline', () => {
  it('passes through the points and is the identity for the default line', () => {
    const f = monotoneCurve([{ x: 0, y: 0 }, { x: 0.3, y: 0.5 }, { x: 1, y: 1 }]);
    expect(f(0)).toBeCloseTo(0, 6); expect(f(0.3)).toBeCloseTo(0.5, 6); expect(f(1)).toBeCloseTo(1, 6);
    const id = monotoneCurve(undefined);
    for (const x of [0, 0.13, 0.5, 0.99, 1]) expect(id(x)).toBeCloseTo(x, 6);
  });
  it('never overshoots between monotone points (Fritsch-Carlson) and stays monotone', () => {
    const pts = [{ x: 0, y: 0 }, { x: 0.4, y: 0.05 }, { x: 0.5, y: 0.9 }, { x: 1, y: 1 }]; // sharp step: a Catmull-Rom would ring
    const f = monotoneCurve(pts);
    let prev = -1;
    for (const y of sampleCurve(f, 400)) { expect(y).toBeGreaterThanOrEqual(prev - 1e-9); expect(y).toBeLessThanOrEqual(1 + 1e-9); expect(y).toBeGreaterThanOrEqual(-1e-9); prev = y; }
    expect(Math.max(...monotoneTangents(normalizeCurvePoints(pts)))).toBeLessThan(40);
  });
  it('normalises unsorted / duplicate / out-of-range / non-finite input and pins the end points', () => {
    const n = normalizeCurvePoints([{ x: 0.8, y: 2 }, { x: 0.2, y: -1 }, { x: 0.2001, y: 0.3 }, { x: NaN, y: 0 }]);
    expect(n.map((p) => p.x)).toEqual([0, 0.2, 0.8, 1]);
    expect(n.every((p) => p.y >= 0 && p.y <= 1)).toBe(true);
    expect(normalizeCurvePoints([])).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  });
  it('a hand-computed S-curve value (Hermite, tangent 0 at a flat step)', () => {
    const f = monotoneCurve([{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]);
    expect(f(0.25)).toBeCloseTo(0.25, 6); // collinear points: straight line
    const g = monotoneCurve([{ x: 0, y: 0 }, { x: 0.5, y: 0.2 }, { x: 1, y: 1 }]);
    expect(g(0.5)).toBeCloseTo(0.2, 6); expect(g(0.25)).toBeLessThan(0.2); expect(g(0.75)).toBeGreaterThan(0.2);
  });
});

describe('curves LUT', () => {
  it('has 128 rows x 4 floats; default props are the identity', () => {
    const lut = buildCurveLut({});
    expect(lut).toHaveLength(LUT_SIZE * 4);
    for (const x of [0, 0.1, 0.5, 0.77, 1]) for (const c of [0, 1, 2] as const) expect(lutLookup(lut, c, x)).toBeCloseTo(x, 2);
  });
  it('legacy projects (p0..p4 + *_mid only) keep the old Catmull-Rom result, and are detected as legacy', () => {
    const legacy = { p0: 0, p1: 0.1, p2: 0.5, p3: 0.9, p4: 1, r_mid: 0.2 };
    expect(hasNewCurves(legacy)).toBe(false);
    // old shader maths evaluated by hand at x = 0.5 (segment i=2, t=0): value = p2 = 0.5; red adds mid * 4 * o * (1 - o) = 0.2
    const [fr, fg] = channelFunctions(legacy);
    expect(fr(0.5)).toBeCloseTo(0.7, 6); expect(fg(0.5)).toBeCloseTo(0.5, 6);
    // x = 0.25 (segment 1, t = 0): value = p1 = 0.1
    expect(fg(0.25)).toBeCloseTo(0.1, 6);
    expect(lutLookup(buildCurveLut(legacy), 1, 0.25)).toBeCloseTo(0.1, 2);
    expect(editorPoints(legacy, 'm').map((p) => p.y)).toEqual([0, 0.1, 0.5, 0.9, 1]); // the editor starts from the saved points
  });
  it('new curves: master composes with the channel curve; channel curves are independent', () => {
    const props = { curve_m: pointsToFlat([{ x: 0, y: 0.1 }, { x: 1, y: 1 }]), curve_r: pointsToFlat([{ x: 0, y: 0 }, { x: 1, y: 0.5 }]), curve_g: [0, 0, 1, 1], curve_b: [0, 0, 1, 1] };
    expect(hasNewCurves(props)).toBe(true);
    const [fr, fg, fb] = channelFunctions(props);
    expect(fg(0)).toBeCloseTo(0.1, 6); expect(fb(1)).toBeCloseTo(1, 6);
    expect(fr(1)).toBeCloseTo(0.5, 6); expect(fr(0)).toBeCloseTo(0.1 * 0.5, 2);
  });
  it('editor operations keep the curve valid', () => {
    let pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    const a = addPoint(pts, 0.4, 0.6); pts = a.points; expect(pts.map((p) => p.x)).toEqual([0, 0.4, 1]); expect(a.index).toBe(1);
    pts = movePoint(pts, 1, 5, 2); expect(pts[1].x).toBeCloseTo(0.99, 6); expect(pts[1].y).toBe(1); // clamped between neighbours, y in 0..1
    pts = movePoint(pts, 0, 0.5, 0.2); expect(pts[0]).toEqual({ x: 0, y: 0.2 }); // end points keep x
    expect(removePoint(pts, 0)).toHaveLength(3); expect(removePoint(pts, 2)).toHaveLength(3); expect(removePoint(pts, 1)).toHaveLength(2);
    expect(addPoint(pts, 0.995, 0.3).points).toHaveLength(3); // near-duplicate x moves the existing point
  });
});

describe('homography / corner pin', () => {
  const near = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 8));
  it('identity quad gives the identity matrix and the inverse map is the identity', () => {
    const m = squareToQuad(IDENTITY_QUAD)!;
    near(m, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    near(quadToSquare(IDENTITY_QUAD)!, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const u = cornerPinUniforms({});
    expect(u.u_valid).toBe(1); expect(u.u_h0).toEqual([1, 0, 0]); expect(u.u_h2).toEqual([0, 0, 1]);
  });
  it('maps the square corners onto known quads (translate, scale, general perspective)', () => {
    const quads: Quad[] = [
      [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75]],
      [[0.1, 0.2], [1.1, 0.2], [1.1, 1.2], [0.1, 1.2]],
      [[0.15, 0.1], [0.9, 0.2], [0.8, 0.9], [0.05, 0.75]],
      [[0.3, 0], [0.7, 0], [1, 1], [0, 1]], // trapezoid
    ];
    const corners: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (const q of quads) {
      const m = squareToQuad(q)!;
      corners.forEach((c, i) => { const p = applyH(m, c); expect(p[0]).toBeCloseTo(q[i][0], 9); expect(p[1]).toBeCloseTo(q[i][1], 9); });
      const inv = quadToSquare(q)!;
      q.forEach((p, i) => { const s = applyH(inv, p); expect(s[0]).toBeCloseTo(corners[i][0], 9); expect(s[1]).toBeCloseTo(corners[i][1], 9); });
      // round trip of an interior point
      const mid = applyH(m, [0.37, 0.61]); const back = applyH(inv, mid); expect(back[0]).toBeCloseTo(0.37, 9); expect(back[1]).toBeCloseTo(0.61, 9);
      expect(invert3(invert3(m)!)!.map((v, i) => v / invert3(invert3(m)!)![8] - m[i] / m[8]).every((v) => Math.abs(v) < 1e-9)).toBe(true);
    }
    // trapezoid (top edge 0.4 wide, bottom 1 wide): the square's centre lands at top / (top + bottom) = 0.4 / 1.4 of the height, not 0.5 (perspective, not affine)
    const c = applyH(squareToQuad(quads[3])!, [0.5, 0.5]);
    expect(c[0]).toBeCloseTo(0.5, 9); expect(c[1]).toBeCloseTo(0.4 / 1.4, 9);
    // the half-size translate quad: output (0.4, 0.4) shows source (0.3, 0.3)
    const s = applyH(quadToSquare(quads[0])!, [0.4, 0.4]); expect(s[0]).toBeCloseTo(0.3, 9); expect(s[1]).toBeCloseTo(0.3, 9);
  });
  it('degenerate and self-crossing quads are not valid (the effect then outputs nothing)', () => {
    expect(squareToQuad([[0, 0], [0, 0], [0, 0], [0, 0]])).toBeNull();
    expect(isConvexQuad([[0, 0], [1, 1], [0, 1], [1, 0]])).toBe(false); // bow-tie
    expect(isConvexQuad(IDENTITY_QUAD)).toBe(true);
    expect(cornerPinUniforms(propsFromQuad([[0, 0], [1, 1], [0, 1], [1, 0]])).u_valid).toBe(0);
  });
  it('props <-> quad and clamping', () => {
    const q: Quad = [[0.1, 0.2], [0.9, 0.1], [0.8, 0.95], [0.05, 0.7]];
    expect(quadFromProps(propsFromQuad(q))).toEqual(q);
    expect(quadFromProps({ tlx: 1e9, tly: NaN })[0]).toEqual([3, 0]);
    expect(quadFromProps(undefined)).toEqual(IDENTITY_QUAD);
  });
});

describe('path rasterisation', () => {
  const square = rectPath(0.25, 0.25, 0.75, 0.75).map((v) => [v.x, v.y] as [number, number]);
  it('point in polygon (non-zero winding, concave shapes)', () => {
    expect(pointInPolygon(square, 0.5, 0.5)).toBe(true); expect(pointInPolygon(square, 0.1, 0.5)).toBe(false); expect(pointInPolygon(square, 0.76, 0.5)).toBe(false);
    const L: Array<[number, number]> = [[0, 0], [1, 0], [1, 0.4], [0.4, 0.4], [0.4, 1], [0, 1]];
    expect(pointInPolygon(L, 0.2, 0.8)).toBe(true); expect(pointInPolygon(L, 0.8, 0.8)).toBe(false); expect(pointInPolygon(L, 0.8, 0.2)).toBe(true);
    expect(pointInPolygon([...L].reverse(), 0.2, 0.8)).toBe(true); // orientation independent
  });
  it('distance to the polygon edge', () => {
    expect(distanceToPolygon(square, 0.5, 0.25)).toBeCloseTo(0, 9); expect(distanceToPolygon(square, 0.5, 0.5)).toBeCloseTo(0.25, 9); expect(distanceToPolygon(square, 0.9, 0.5)).toBeCloseTo(0.15, 9);
    expect(distanceToPolygon(square, 0.9, 0.9)).toBeCloseTo(Math.hypot(0.15, 0.15), 9);
  });
  it('bezier flattening: a circle stays on the radius; straight segments stay single edges', () => {
    const poly = flattenPath(ellipsePath(0.5, 0.5, 0.25, 0.25));
    expect(poly.length).toBe(32);
    for (const [x, y] of poly) expect(Math.hypot(x - 0.5, y - 0.5)).toBeCloseTo(0.25, 2);
    expect(flattenPath(rectPath())).toHaveLength(4);
    expect(pathMaskUniforms({}).u_count).toBe(32); // default path = ellipse
    expect((pathMaskUniforms({}).u_poly as number[]).length).toBe(MAX_EDGES * 4);
  });
  it('feather: inside 1, outside 0, half at the edge, monotone across the feather band', () => {
    const props = { path: pathToFlat(rectPath(0.25, 0.25, 0.75, 0.75)), feather: 0.1 };
    expect(maskAlphaAt(props, 0.5, 0.5, 1)).toBeCloseTo(1, 6); expect(maskAlphaAt(props, 0.05, 0.5, 1)).toBeCloseTo(0, 6);
    expect(maskAlphaAt(props, 0.25, 0.5, 1)).toBeCloseTo(0.5, 6);
    const xs = [0.205, 0.22, 0.25, 0.28, 0.295]; const a = xs.map((x) => maskAlphaAt(props, x, 0.5, 1));
    for (let i = 1; i < a.length; i++) expect(a[i]).toBeGreaterThan(a[i - 1]);
    expect(maskAlphaAt(props, 0.2, 0.5, 1)).toBeCloseTo(0, 6); // 0.05 outside the edge = the outer rim of the feather band
  });
  it('invert, opacity, expand', () => {
    const base = { path: pathToFlat(rectPath(0.25, 0.25, 0.75, 0.75)), feather: 0.02 };
    expect(maskAlphaAt({ ...base, invert: 1 }, 0.5, 0.5, 1)).toBeCloseTo(0, 6); expect(maskAlphaAt({ ...base, invert: 1 }, 0.05, 0.05, 1)).toBeCloseTo(1, 6);
    expect(maskAlphaAt({ ...base, opacity: 0.4 }, 0.05, 0.5, 1)).toBeCloseTo(0.6, 6); expect(maskAlphaAt({ ...base, opacity: 0.4 }, 0.5, 0.5, 1)).toBeCloseTo(1, 6);
    expect(maskAlphaAt({ ...base, opacity: 0 }, 0.05, 0.5, 1)).toBeCloseTo(1, 6); // opacity 0 = mask off
    expect(maskAlphaAt(base, 0.2, 0.5, 1)).toBeCloseTo(0, 3); expect(maskAlphaAt({ ...base, expand: 0.1 }, 0.2, 0.5, 1)).toBeCloseTo(1, 3);
    expect(maskAlphaAt({ path: [0.5, 0.5, 0, 0, 0, 0] }, 0.9, 0.9, 1)).toBe(1); // < 3 points = no mask
  });
  it('mask transform: offset moves the shape, rotation turns it, scale grows it (aspect-correct), inverse maps agree', () => {
    const props = { path: pathToFlat(rectPath(0.4, 0.4, 0.6, 0.6)), feather: 0.01 };
    expect(maskAlphaAt({ ...props, offsetX: 0.2 }, 0.7, 0.5, 1)).toBeCloseTo(1, 3); expect(maskAlphaAt({ ...props, offsetX: 0.2 }, 0.5, 0.5, 1)).toBeCloseTo(0, 3);
    expect(maskAlphaAt({ ...props, offsetX: 0.3 }, 0.5, 0.5, 1)).toBeCloseTo(0, 3);
    expect(maskAlphaAt({ ...props, scale: 2 }, 0.69, 0.5, 1)).toBeCloseTo(1, 3); expect(maskAlphaAt(props, 0.69, 0.5, 1)).toBeCloseTo(0, 3);
    // rotate 90 deg: a wide rect becomes tall
    const wide = { path: pathToFlat(rectPath(0.3, 0.45, 0.7, 0.55)), feather: 0.01, rotate: 90 };
    expect(maskAlphaAt(wide, 0.5, 0.32, 1)).toBeCloseTo(1, 3); expect(maskAlphaAt(wide, 0.2, 0.5, 1)).toBeCloseTo(0, 3);
    const m = maskParams({ rotate: 33, scale: 1.7, offsetX: 0.1, offsetY: -0.2 }); const c: [number, number] = [0.4, 0.5];
    const f = fromPathSpace(m, c, 16 / 9, 0.3, 0.7); const b = toPathSpace(m, c, 16 / 9, f[0], f[1]); expect(b[0]).toBeCloseTo(0.3, 9); expect(b[1]).toBeCloseTo(0.7, 9);
  });
  it('animated anchors (v<i>x / v<i>y) override the stored path; insertVertexNear splits the closest segment', () => {
    const props = { path: pathToFlat(rectPath(0.3, 0.3, 0.7, 0.7)), v0x: 0.1, v0y: 0.05 };
    expect(pathAt(props)[0]).toMatchObject({ x: 0.1, y: 0.05 }); expect(pathAt(props)[1]).toMatchObject({ x: 0.7, y: 0.3 });
    const r = insertVertexNear(rectPath(0.3, 0.3, 0.7, 0.7), 0.5, 0.3);
    expect(r.index).toBe(1); expect(r.path).toHaveLength(5); expect(r.path[1]).toMatchObject({ x: 0.5, y: 0.3 });
    expect(polyCentroid([[0, 0], [2, 0], [2, 2], [0, 2]])).toEqual([1, 1]);
  });
});

describe('colour helpers', () => {
  it('hex <-> rgb and the gradient-map HSV formula round trip', () => {
    expect(rgbToHex([1, 0.5, 0])).toBe('#ff8000'); expect(hexToRgb('#ff8000')).toEqual([1, 128 / 255, 0]); expect(hexToRgb('nope')).toBeNull();
    for (const [h, s, v] of [[240, 0.8, 0.12], [330, 0.55, 0.6], [45, 0.45, 1], [0, 1, 1], [120, 0.5, 0.5]] as const) {
      const back = rgbToHsv(hsvToRgb(h, s, v)); expect(back.h).toBeCloseTo(h, 1); expect(back.s).toBeCloseTo(s, 5); expect(back.v).toBeCloseTo(v, 5);
    }
    expect(hsvToRgb(0, 1, 1)).toEqual([1, 0, 0]);
  });
});

describe('registry and effect definitions', () => {
  it('path mask and corner pin are registered builtin effects with editors; the curves effect keeps its id and legacy props', () => {
    for (const id of ['builtin:fx-path-mask', 'builtin:fx-corner-pin']) { expect(FX_IDS).toContain(id); expect(ALL_FX[id].frag.startsWith('#version 300 es')).toBe(true); }
    expect(ALL_FX['builtin:fx-path-mask'].editor).toBe('mask'); expect(ALL_FX['builtin:fx-corner-pin'].editor).toBe('cornerpin'); expect(ALL_FX['builtin:fx-curves'].editor).toBe('curves');
    expect(ALL_FX['builtin:fx-curves'].props.map((p) => p.key)).toEqual(expect.arrayContaining(['p0', 'p1', 'p2', 'p3', 'p4', 'r_mid', 'g_mid', 'b_mid']));
    for (const f of ['corner-pin', 'path-mask']) { const s = fs.readFileSync(path.resolve(__dirname, `../../openchatcut/gl/fx/s9/${f}.frag`), 'utf8'); expect(s).not.toMatch(/@fragment|@compute|var<uniform>|\bfn\s+\w+\s*\(/); }
  });
  it('derive uniforms reach the pass; slider values are clamped; array data is not turned into slider uniforms', () => {
    const p = fxPasses([{ def: ALL_FX['builtin:fx-path-mask'], overrides: { feather: 9, path: pathToFlat(rectPath()) } }], 0)[0].uniforms!;
    expect(p.u_feather).toBe(0.5); expect(p.u_count).toBe(4); expect(Array.isArray(p.u_poly)).toBe(true);
    expect(fxUniforms(ALL_FX['builtin:fx-path-mask'], {}).u_path).toBeUndefined();
    const c = fxPasses([{ def: ALL_FX['builtin:fx-curves'], overrides: {} }], 0)[0].uniforms!; expect((c.u_lut as number[]).length).toBe(512);
    const cp = fxPasses([{ def: ALL_FX['builtin:fx-corner-pin'], overrides: { tlx: 0.2 } }], 0)[0].uniforms!; expect(cp.u_valid).toBe(1);
  });
  it('colour props and picks: night-vision tint default equals the old hard-coded colour; gradient-map picks reference real slider props', () => {
    const nv = ALL_FX['builtin:fx-nightvision'].props.find((p) => p.key === 'tint')!;
    expect(nv.kind).toBe('color'); expect(nv.default).toEqual([0.12, 1, 0.25]);
    expect(fxPasses([{ def: ALL_FX['builtin:fx-nightvision'], overrides: { tint: [1, 0, 0] } }], 0)[0].uniforms!.u_tint).toEqual([1, 0, 0]);
    expect(fxPasses([{ def: ALL_FX['builtin:fx-nightvision'], overrides: {} }], 0)[0].uniforms!.u_tint).toEqual([0.12, 1, 0.25]);
    const gm = ALL_FX['builtin:fx-gradient-map']; const keys = new Set(gm.props.map((p) => p.key));
    expect(gm.colorPicks).toHaveLength(3); for (const c of gm.colorPicks!) { expect(keys.has(c.h) && keys.has(c.s) && keys.has(c.v)).toBe(true); }
  });
});

const maskFx = (extra: Record<string, number | number[]> = {}) => ({ id: 'builtin:fx-path-mask', props: { path: pathToFlat(rectPath(0.3, 0.3, 0.7, 0.7)), feather: 0.03, ...extra } });

describe('editing patches and keyframes (pen mask points, corner pin)', () => {
  it('static anchor move edits the stored path; a keyed anchor writes keys in Clip.anim; sampling follows the keys', () => {
    let clip = mkClip({ fx: [maskFx()] });
    const moved = moveAnchorPatch(clip, 0, 0, 0.2, 0.25, 1, false);
    expect(pathAt(moved.fx![0].props)[0]).toMatchObject({ x: 0.2, y: 0.25 });
    clip = { ...clip, ...keyAllAnchorsPatch(clip, 0, 0) } as Clip; // key every point at t = 0
    expect(hasVertexKeys(clip, 0)).toBe(true);
    expect(Object.keys(clip.anim!.keys!)).toEqual(expect.arrayContaining(['fx:0:v0x', 'fx:0:v0y', 'fx:0:v3y']));
    clip = { ...clip, ...moveAnchorPatch(clip, 0, 0, 0.1, 0.1, 2, false) } as Clip; // second key for anchor 0 at t = 2 s
    const at = (t: number) => pathAt(sampledFxAt(clip, 0, t))[0];
    expect(at(0)).toMatchObject({ x: 0.3, y: 0.3 }); expect(at(2)).toMatchObject({ x: 0.1, y: 0.1 });
    expect(at(1).x).toBeCloseTo(0.2, 3); expect(at(1).y).toBeCloseTo(0.2, 3); // linear between the keys
    expect(pathAt(sampledFxAt(clip, 0, 1))[1]).toMatchObject({ x: 0.7, y: 0.3 }); // other anchors stay
    // the render path (the same resolver the preview and export use) sees the animated polygon
    const u0 = clipFxPasses(clip, 0, 0)[0].uniforms!; const u2 = clipFxPasses(clip, 0, 2)[0].uniforms!;
    expect((u0.u_poly as number[]).slice(0, 2)).toEqual([0.3, 0.3]); expect((u2.u_poly as number[]).slice(0, 2)).toEqual([0.1, 0.1]);
    // deterministic: same input, same output
    expect(JSON.stringify(clipFxPasses(clip, 0, 1.3)[0].uniforms)).toBe(JSON.stringify(clipFxPasses(clip, 0, 1.3)[0].uniforms));
  });
  it('structural edits bake animated anchors (indices change) and clear their keys', () => {
    let clip = mkClip({ fx: [maskFx()] });
    clip = { ...clip, ...keyAllAnchorsPatch(clip, 0, 0) } as Clip;
    clip = { ...clip, ...moveAnchorPatch(clip, 0, 1, 0.9, 0.2, 2, false) } as Clip;
    const baked = { ...clip, ...bakeVertexKeys(clip, 0, 2) } as Clip;
    expect(hasVertexKeys(baked, 0)).toBe(false); expect(pathAt(baked.fx![0].props)[1]).toMatchObject({ x: 0.9, y: 0.2 });
    const next = rectPath(0.1, 0.1, 0.5, 0.5);
    const edited = { ...clip, ...setPathPatch(clip, 0, next, 2, true) } as Clip;
    expect(hasVertexKeys(edited, 0)).toBe(false); expect(pathAt(edited.fx![0].props)).toHaveLength(4); expect(pathAt(edited.fx![0].props)[0]).toMatchObject({ x: 0.1, y: 0.1 });
  });
  it('corner pin corners: static edit, auto-key creates keys, older per-effect keys are updated in place, linear between keys', () => {
    let clip = mkClip({ fx: [{ id: 'builtin:fx-corner-pin', props: {} }] });
    const st = scalarPatch(clip, 0, { tlx: 0.2, tly: 0.1 }, 1, false);
    expect(st.fx![0].props).toMatchObject({ tlx: 0.2, tly: 0.1 }); expect(st.anim).toBeUndefined();
    clip = { ...clip, ...scalarPatch(clip, 0, { tlx: 0.0 }, 0, true) } as Clip;
    clip = { ...clip, ...scalarPatch(clip, 0, { tlx: 0.4 }, 2, true) } as Clip;
    expect(sampledFxAt(clip, 0, 1).tlx).toBeCloseTo(0.2, 3);
    expect(quadFromProps(sampledFxAt(clip, 0, 2))[0][0]).toBeCloseTo(0.4, 3);
    const legacy = mkClip({ fx: [{ id: 'builtin:fx-corner-pin', props: {}, keys: { tly: [{ frame: 0, value: 0 }, { frame: 60, value: 0.3 }] } }] });
    const p = scalarPatch(legacy, 0, { tly: 0.5 }, 1, false);
    expect(p.fx![0].keys!.tly.some((k) => k.frame === 30 && k.value === 0.5)).toBe(true);
    const inv = (c: Clip, t: number) => clipFxPasses(c, 0, t)[0].uniforms!.u_h0 as number[];
    expect(inv(clip, 0)).not.toEqual(inv(clip, 2));
  });
});

describe('project persistence and export mapping', () => {
  const edited = (): Clip => mkClip({
 fx: [
    maskFx({ feather: 0.05, invert: 1, opacity: 0.8, rotate: 12, v1x: 0.8 }),
    { id: 'builtin:fx-corner-pin', props: { tlx: 0.1, try: 0.05 }, keys: { brx: [{ frame: 0, value: 1 }, { frame: 60, value: 0.8 }] } },
    { id: 'builtin:fx-curves', props: { curve_m: [0, 0, 0.3, 0.2, 1, 1], curve_r: [0, 0, 1, 1], curve_g: [0, 0, 1, 1], curve_b: [0, 0.1, 1, 0.9] } },
    { id: 'builtin:fx-nightvision', props: { tint: [1, 0.2, 0.2] } },
  ], anim: { keys: { 'fx:0:v0x': [{ t: 0, v: 0.3 }, { t: 2, v: 0.1 }] } } 
});
  const tlWith = (c: Clip): Timeline => { let tl = createDefaultTimeline('t'); const v1 = tl.tracks.find((t) => t.name === 'V1')!.id; tl = addClipToTrack(tl, v1, asset('A'), 0); return { ...tl, clips: tl.clips.map((x) => ({ ...x, fx: c.fx, anim: c.anim })) }; };
  it('JSON and DB-row round trips keep arrays, scalars, keys and anim unchanged', () => {
    const c = edited();
    expect(clone(c).fx).toEqual(c.fx);
    const tl = tlWith(c);
    const rows = { tracks: tl.tracks.map((t, i) => trackToRow(t, tl.id, i)), clips: tl.clips.map((x) => ({ ...clipToRow(x, tl.id), created_at: '', keyframes: [] })), transitions: tl.transitions.map((t) => transitionToRow(t, tl.id)) };
    const back = timelineFromRows(clone(rows) as never, clone(rows.tracks) as never, clone(rows.clips) as never, clone(rows.transitions) as never);
    expect(back.clips[0].fx).toEqual(c.fx); expect(back.clips[0].anim).toEqual(c.anim);
  });
  it('a project saved with the old five-slider curves loads and renders the same LUT as before (no migration needed)', () => {
    const old = mkClip({ fx: [{ id: 'builtin:fx-curves', props: { p0: 0, p1: 0.12, p2: 0.5, p3: 0.8, p4: 1, g_mid: -0.1 } }] });
    const loaded = clone(old);
    const u = clipFxPasses(loaded, 0)[0].uniforms!.u_lut as number[];
    const ref = buildCurveLut(old.fx![0].props);
    expect(u).toEqual(ref);
    const [, fg] = channelFunctions(old.fx![0].props); expect(lutLookup(u, 1, 0.25)).toBeCloseTo(fg(0.25), 2);
  });
  it('real export mapping carries path, scalars, curve arrays, keys and the anim keys into the composition layer', () => {
    const c = edited(); const tl = tlWith(c);
    const clips = exportClipsFromTimeline(tl, [asset('A')]);
    const item = exportItem(clips[0], 0) as { occFx: Array<{ id: string; overrides: Record<string, unknown>; keys?: Record<string, unknown[]> }> };
    expect(item.occFx.map((e) => e.id)).toEqual(['builtin:fx-path-mask', 'builtin:fx-corner-pin', 'builtin:fx-curves', 'builtin:fx-nightvision']);
    expect(item.occFx.every((e) => e.id in ALL_FX)).toBe(true);
    expect(item.occFx[0].overrides.path).toEqual(c.fx![0].props.path);
    expect(item.occFx[0].keys!.v0x).toBeTruthy(); // anim key fx:0:v0x travels as an OpenChatCut key (sampled by the composition at the frame time)
    expect(item.occFx[1].keys!.brx).toHaveLength(2);
    expect(item.occFx[2].overrides.curve_b).toEqual([0, 0.1, 1, 0.9]); expect(item.occFx[3].overrides.tint).toEqual([1, 0.2, 0.2]);
    const { state } = buildExportState({ clips, tracks: exportTracksFromTimeline(tl), transitions: exportTransitionsFromTimeline(tl), totalDuration: tl.duration }, exportItem);
    const model = timelineToComposition(state, { fps: 30, quality: '720p' });
    const layer = model.layers.find((l: { occFx?: unknown[] }) => l.occFx?.length);
    expect(layer.occFx).toHaveLength(4);
    // what the renderer does with them (ClipFx.tsx resolves ALL_FX by id; keys are sampled per frame): the same uniforms as the preview path
    const preview = clipFxInstances(tl.clips[0], 1).map((i) => fxPasses([{ def: i.def, overrides: i.overrides }], 1)[0].uniforms);
    expect(preview[0]!.u_count).toBeGreaterThanOrEqual(3);
  });
});

describe('export mirror canvas (regression found by the real export check)', () => {
  it('ClipFx clears its 2D mirror before copying the GL frame, so a transparent area that shrinks over time is not smeared by earlier frames', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../openchatcut/gl/ClipFx.tsx'), 'utf8');
    const clear = src.indexOf('clearRect(0, 0, mirror.width, mirror.height)'); const draw = src.indexOf('mctx?.drawImage(canvas, 0, 0)');
    expect(clear).toBeGreaterThan(0); expect(draw).toBeGreaterThan(clear);
  });
});
