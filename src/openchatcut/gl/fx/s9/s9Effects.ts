// [remix] Fix C effects: pen-path mask, corner pin, and the curves effect definition (replaces the five-slider UI; same id and legacy props).
// Each is a single GLSL ES 3.00 pass in the normal registry, so inspector, keyframes (ClipFx.keys / Clip.anim), project persistence and the
// Remotion export (ClipFx.tsx resolves ALL_FX by id) work unchanged. Array data (mask path, curve points) lives in Clip.fx[].props.
import type { FxDef, FxProperty } from '../uniforms';
import curvesFrag from '../s35/curves.frag?raw'; // the Curves shader stays with its Stage 3 siblings
import cornerPinFrag from './corner-pin.frag?raw';
import pathMaskFrag from './path-mask.frag?raw';
import { buildCurveLut } from './curves';
import { cornerPinUniforms, CORNER_KEYS } from './cornerPin';
import { IDENTITY_QUAD } from './homography';
import { DEFAULT_PATH_FLAT, pathMaskUniforms } from './pathMask';

const n = (key: string, label: string, def: number, min: number, max: number, step = 0.01): FxProperty => ({ key, label, default: def, min, max, step });

const CURVE_DATA = { curve_m: [0, 0, 1, 1], curve_r: [0, 0, 1, 1], curve_g: [0, 0, 1, 1], curve_b: [0, 0, 1, 1] };

export const CURVES_FX: FxDef = {
  id: 'builtin:fx-curves', name: 'Curves',
  desc: 'Draggable tone curves: RGB master plus red / green / blue curves (monotone spline). Projects saved with the old five-slider Curves still render the same.',
  frag: curvesFrag,
  // legacy slider props stay declared: old projects keep their values and keyframes; once a curve is edited the curve_* data wins
  props: [n('p0', 'Black point', 0, 0, 1), n('p1', 'Shadows', 0.25, 0, 1), n('p2', 'Midtones', 0.5, 0, 1), n('p3', 'Highlights', 0.75, 0, 1), n('p4', 'White point', 1, 0, 1),
    n('r_mid', 'Red mid bend', 0, -0.5, 0.5), n('g_mid', 'Green mid bend', 0, -0.5, 0.5), n('b_mid', 'Blue mid bend', 0, -0.5, 0.5)],
  data: CURVE_DATA,
  editor: 'curves',
  hiddenProps: ['p0', 'p1', 'p2', 'p3', 'p4', 'r_mid', 'g_mid', 'b_mid'],
  derive: (o) => ({ u_lut: buildCurveLut(o) }),
};

export const CORNER_PIN_FX: FxDef = {
  id: 'builtin:fx-corner-pin', name: 'Corner Pin',
  desc: 'Perspective warp: drag the four corners on the preview. Corners are keyframeable; outside the quad is transparent.',
  frag: cornerPinFrag,
  props: CORNER_KEYS.flatMap(([kx, ky], i) => [
    n(kx, ['Top-left X', 'Top-right X', 'Bottom-right X', 'Bottom-left X'][i], IDENTITY_QUAD[i][0], -2, 3, 0.001),
    n(ky, ['Top-left Y', 'Top-right Y', 'Bottom-right Y', 'Bottom-left Y'][i], IDENTITY_QUAD[i][1], -2, 3, 0.001),
  ]),
  editor: 'cornerpin',
  derive: (o) => cornerPinUniforms(o),
};

export const PATH_MASK_FX: FxDef = {
  id: 'builtin:fx-path-mask', name: 'Path Mask',
  desc: 'Pen-tool bezier mask: draw and edit points on the preview. Feather, expand, invert, opacity, mask transform; points and transform can be keyframed.',
  frag: pathMaskFrag,
  props: [n('feather', 'Feather', 0.01, 0, 0.5, 0.001), n('expand', 'Expand', 0, -0.5, 0.5, 0.001), n('opacity', 'Mask opacity', 1, 0, 1), n('invert', 'Invert', 0, 0, 1, 1),
    n('offsetX', 'Offset X', 0, -2, 2, 0.001), n('offsetY', 'Offset Y', 0, -2, 2, 0.001), n('scale', 'Scale', 1, 0.05, 8, 0.01), n('rotate', 'Rotate (deg)', 0, -360, 360, 0.5)],
  data: { path: DEFAULT_PATH_FLAT },
  editor: 'mask',
  derive: (o) => pathMaskUniforms(o),
};

export const S9_EFFECTS: Record<string, FxDef> = {
  [CORNER_PIN_FX.id]: CORNER_PIN_FX,
  [PATH_MASK_FX.id]: PATH_MASK_FX,
};

export const S9_META: Record<string, { probe: Record<string, number>; neutral?: Record<string, number> }> = {
  'builtin:fx-corner-pin': { probe: { tlx: 0.2, try: 0.15, brx: 0.9 } },
  'builtin:fx-path-mask': { neutral: { opacity: 0 }, probe: { feather: 0.02 } },
};
