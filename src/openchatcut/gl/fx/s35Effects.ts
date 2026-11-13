// [remix] Stage 3 (colour grading / FreeCut-inspired) + Stage 5 (Seriously.js-derived) GL effects.
// Every effect is a single-input GLSL ES 3.00 pass registered like the rest of FX_EFFECTS (see shaderEffects.ts), so the
// inspector sliders, per-property keyframes (ClipFx.keys), project persistence (Clip.fx[].props) and the Remotion
// web-renderer export (ClipFx.tsx resolves ALL_FX by id) all work unchanged. Only number props are used so that every
// parameter can be keyframed from the inspector. Licence / provenance of each effect is in S35_META (and THIRD_PARTY_NOTICES).
import type { FxDef, FxProperty } from './uniforms';
import curvesFrag from './s35/curves.frag?raw';
import gradientMapFrag from './s35/gradient-map.frag?raw';
import vibranceFrag from './s35/vibrance.frag?raw';
import temperatureTintFrag from './s35/temperature-tint.frag?raw';
import sharpenFrag from './s35/sharpen.frag?raw';
import radialBlurFrag from './s35/radial-blur.frag?raw';
import boxBlurHFrag from './s35/box-blur-H.frag?raw';
import boxBlurVFrag from './s35/box-blur-V.frag?raw';
import twirlFrag from './s35/twirl.frag?raw';
import waveFrag from './s35/wave.frag?raw';
import bulgePinchFrag from './s35/bulge-pinch.frag?raw';
import glassFrag from './s35/glass.frag?raw';
import edgeDetectFrag from './s35/edge-detect.frag?raw';
import vhsFrag from './s35/vhs.frag?raw';
import asciiTextFrag from './s35/ascii-text.frag?raw';
import exposureFrag from './s35/exposure.frag?raw';
import embossFrag from './s35/emboss.frag?raw';
import scanlinesFrag from './s35/scanlines.frag?raw';
import polarFrag from './s35/polar.frag?raw';
import nightvisionFrag from './s35/nightvision.frag?raw';
import sketchFrag from './s35/sketch.frag?raw';
import rippleFrag from './s35/ripple.frag?raw';

const n = (key: string, label: string, def: number, min: number, max: number, step = 0.01): FxProperty => ({ key, label, default: def, min, max, step });
const flag = (key: string, label: string, def = 0): FxProperty => n(key, label, def, 0, 1, 1);
const cx = [n('center_x', 'Center X', 0.5, 0, 1), n('center_y', 'Center Y', 0.5, 0, 1)];

export interface S35Meta {
  stage: 3 | 5;
  /** 'original' = written for this repo; 'seriously-mit' = adapted from the cited Seriously.js file (MIT) */
  origin: 'original' | 'seriously-mit';
  license: string;
  /** upstream file + commit (vendored effects only) */
  upstream?: { repo: string; path: string; commit: string };
  /** property values at which the effect is (approximately) the identity; absent = no neutral setting */
  neutral?: Record<string, number>;
  /** property values that must make the output measurably different from the input */
  probe: Record<string, number>;
  /** true when the output depends on u_time */
  animated?: boolean;
}
const SER = (file: string) => ({ repo: 'https://github.com/brianchirls/Seriously.js', path: `effects/seriously.${file}.js`, commit: '513d2b8696b76fe764b3033aa6dc7c99005acccd' });
const ORIG = 'AGPL-3.0-or-later (original work in this repo)';
const MIT = 'MIT, Copyright (c) 2012-2014 Brian Chirls';

export const S35_EFFECTS: Record<string, FxDef> = {
  'builtin:fx-curves': {
    id: 'builtin:fx-curves', name: 'Curves',
    desc: 'Master tone curve with five control points (black, shadows, mids, highlights, white) plus per-channel mid bends.',
    frag: curvesFrag,
    props: [n('p0', 'Black point', 0, 0, 1), n('p1', 'Shadows', 0.25, 0, 1), n('p2', 'Midtones', 0.5, 0, 1), n('p3', 'Highlights', 0.75, 0, 1), n('p4', 'White point', 1, 0, 1),
      n('r_mid', 'Red mid bend', 0, -0.5, 0.5), n('g_mid', 'Green mid bend', 0, -0.5, 0.5), n('b_mid', 'Blue mid bend', 0, -0.5, 0.5)],
  },
  'builtin:fx-gradient-map': {
    id: 'builtin:fx-gradient-map', name: 'Gradient Map',
    desc: 'Maps luminance onto a three-stop colour ramp (shadow, mid, highlight) defined by hue / saturation / value.',
    frag: gradientMapFrag,
    props: [n('shadowHue', 'Shadow hue', 240, 0, 360, 1), n('shadowSat', 'Shadow saturation', 0.8, 0, 1), n('shadowVal', 'Shadow value', 0.12, 0, 1),
      n('midHue', 'Mid hue', 330, 0, 360, 1), n('midSat', 'Mid saturation', 0.55, 0, 1), n('midVal', 'Mid value', 0.6, 0, 1),
      n('highHue', 'Highlight hue', 45, 0, 360, 1), n('highSat', 'Highlight saturation', 0.45, 0, 1), n('highVal', 'Highlight value', 1, 0, 1),
      n('midPos', 'Mid position', 0.5, 0.05, 0.95), n('intensity', 'Intensity', 1, 0, 1)],
  },
  'builtin:fx-vibrance': {
    id: 'builtin:fx-vibrance', name: 'Vibrance',
    desc: 'Smart saturation: lifts muted colours more than saturated ones, with skin-tone protection.',
    frag: vibranceFrag,
    props: [n('vibrance', 'Vibrance', 0.5, -1, 1), n('saturation', 'Saturation', 0, -1, 1), n('protectSkin', 'Protect skin', 0.6, 0, 1)],
  },
  'builtin:fx-temperature-tint': {
    id: 'builtin:fx-temperature-tint', name: 'Temperature / Tint',
    desc: 'White-balance style warm/cool temperature and green/magenta tint, with optional luminance preservation.',
    frag: temperatureTintFrag,
    props: [n('temperature', 'Temperature', 0.3, -1, 1), n('tint', 'Tint', 0, -1, 1), n('preserveLuma', 'Preserve luma', 1, 0, 1)],
  },
  'builtin:fx-sharpen': {
    id: 'builtin:fx-sharpen', name: 'Sharpen',
    desc: 'Unsharp-mask sharpening with radius and a noise-gate threshold.',
    frag: sharpenFrag,
    props: [n('amount', 'Amount', 0.8, 0, 4), n('radius', 'Radius (px)', 1.5, 0.5, 4, 0.1), n('threshold', 'Threshold', 0.02, 0, 0.3, 0.005)],
  },
  'builtin:fx-radial-blur': {
    id: 'builtin:fx-radial-blur', name: 'Radial Blur',
    desc: 'Zoom blur (mode 0) or spin blur (mode 1) around a centre point.',
    frag: radialBlurFrag,
    props: [{ ...n('mode', 'Mode (0 zoom / 1 spin)', 0, 0, 1, 1) }, n('amount', 'Amount', 0.15, 0, 1), ...cx],
  },
  'builtin:fx-box-blur': {
    id: 'builtin:fx-box-blur', name: 'Box Blur',
    desc: 'Separable two-pass box blur with a pixel radius.',
    frag: boxBlurHFrag, passes: [boxBlurHFrag, boxBlurVFrag],
    props: [n('radius', 'Radius (px)', 6, 0, 48, 1)],
  },
  'builtin:fx-twirl': {
    id: 'builtin:fx-twirl', name: 'Twirl',
    desc: 'Swirls the image around a centre; the rotation fades out at the radius.',
    frag: twirlFrag,
    props: [...cx, n('radius', 'Radius', 0.45, 0.05, 1.5), n('angle', 'Angle (rad)', 3, -12, 12, 0.05)],
  },
  'builtin:fx-wave': {
    id: 'builtin:fx-wave', name: 'Wave',
    desc: 'Animated sine-wave displacement, horizontal or vertical.',
    frag: waveFrag,
    props: [n('amplitude', 'Amplitude', 0.02, 0, 0.15, 0.001), n('frequency', 'Frequency', 6, 0, 40, 0.5), n('speed', 'Speed', 3, -20, 20, 0.1), n('axis', 'Axis (0 horiz / 1 vert)', 0, 0, 1, 1)],
  },
  'builtin:fx-bulge-pinch': {
    id: 'builtin:fx-bulge-pinch', name: 'Bulge / Pinch',
    desc: 'Lens that magnifies (bulge) or squeezes (pinch) around a centre point.',
    frag: bulgePinchFrag,
    props: [...cx, n('radius', 'Radius', 0.4, 0.05, 1.5), n('strength', 'Strength', 0.7, -1, 1)],
  },
  'builtin:fx-glass': {
    id: 'builtin:fx-glass', name: 'Frosted Glass',
    desc: 'Refracts the image through smooth noise, optionally with vertical reeded ribs.',
    frag: glassFrag,
    props: [n('amount', 'Amount', 0.012, 0, 0.08, 0.001), n('scale', 'Scale', 40, 2, 200, 1), n('ribs', 'Ribs', 0, 0, 120, 1), n('speed', 'Drift speed', 0, 0, 5, 0.05)],
  },
  'builtin:fx-edge-detect': {
    id: 'builtin:fx-edge-detect', name: 'Edge Detect',
    desc: 'Sobel edge detection; blend the source back in or invert to dark lines on white.',
    frag: edgeDetectFrag,
    props: [n('strength', 'Strength', 3, 0, 12, 0.1), n('threshold', 'Threshold', 0.05, 0, 1, 0.01), n('mixOriginal', 'Mix original', 0, 0, 1), flag('invert', 'Invert')],
  },
  'builtin:fx-vhs': {
    id: 'builtin:fx-vhs', name: 'VHS',
    desc: 'Analog tape look: tracking jitter, chroma smear, tape noise and scanlines. Animated.',
    frag: vhsFrag,
    props: [n('tracking', 'Tracking', 0.4, 0, 1), n('chroma', 'Chroma bleed', 0.004, 0, 0.02, 0.0005), n('noise', 'Noise', 0.25, 0, 1), n('scanlines', 'Scanlines', 0.3, 0, 1), n('fade', 'Colour fade', 0.12, 0, 1)],
  },
  'builtin:fx-ascii-text': {
    id: 'builtin:fx-ascii-text', name: 'ASCII Art',
    desc: 'Replaces the picture with text-mode glyphs chosen by brightness (colour or phosphor).',
    frag: asciiTextFrag,
    props: [n('cell', 'Cell size (px)', 10, 4, 40, 1), n('brightness', 'Brightness', 1.2, 0.4, 3, 0.05), flag('colored', 'Colour', 1), flag('invert', 'Invert'), n('mixOriginal', 'Mix original', 0, 0, 1)],
  },
  'builtin:fx-exposure': {
    id: 'builtin:fx-exposure', name: 'Exposure',
    desc: 'Exposure in stops (multiplies linear-ish RGB by 2^stops).',
    frag: exposureFrag,
    props: [n('exposure', 'Exposure (stops)', 0.5, -4, 4, 0.05)],
  },
  'builtin:fx-emboss': {
    id: 'builtin:fx-emboss', name: 'Emboss',
    desc: 'Grey relief from the difference of two diagonal neighbours.',
    frag: embossFrag,
    props: [n('amount', 'Amount', 1, -4, 4, 0.05), n('distance', 'Offset (px)', 1, 0.5, 8, 0.1), n('blend', 'Blend original', 0, 0, 1)],
  },
  'builtin:fx-scanlines': {
    id: 'builtin:fx-scanlines', name: 'Scan Lines',
    desc: 'Horizontal darkening lines with adjustable count, thickness and strength.',
    frag: scanlinesFrag,
    props: [n('lines', 'Lines', 120, 10, 540, 1), n('size', 'Thickness', 0.2, 0, 1), n('intensity', 'Intensity', 0.35, 0, 1)],
  },
  'builtin:fx-polar': {
    id: 'builtin:fx-polar', name: 'Polar Coordinates',
    desc: 'Wraps the picture into polar coordinates (a "tiny planet" style transform).',
    frag: polarFrag,
    props: [n('angle', 'Angle (deg)', 0, -360, 360, 1), n('amount', 'Amount', 1, 0, 1)],
  },
  'builtin:fx-nightvision': {
    id: 'builtin:fx-nightvision', name: 'Night Vision',
    desc: 'Green phosphor night-vision goggles: luma amplification, sensor noise, round vignette. Animated.',
    frag: nightvisionFrag,
    props: [n('amplification', 'Amplification', 1.4, 0.5, 4, 0.05), n('threshold', 'Threshold', 0.05, 0, 0.5), n('noise', 'Noise', 0.25, 0, 1), n('goggle', 'Goggle vignette', 0.6, 0, 1)],
  },
  'builtin:fx-sketch': {
    id: 'builtin:fx-sketch', name: 'Pencil Sketch',
    desc: 'Sobel outlines plus cross-hatched shading on paper; optionally tinted by the source colours.',
    frag: sketchFrag,
    props: [n('lineStrength', 'Line strength', 3, 0, 10, 0.1), n('hatch', 'Hatching', 0.6, 0, 1), n('colorMix', 'Colour mix', 0, 0, 1), n('hatchScale', 'Hatch scale (px)', 3, 1, 12, 0.5)],
  },
  'builtin:fx-ripple': {
    id: 'builtin:fx-ripple', name: 'Water Ripple',
    desc: 'Concentric animated ripples spreading from a centre point.',
    frag: rippleFrag,
    props: [...cx, n('frequency', 'Frequency', 18, 1, 80, 0.5), n('amplitude', 'Amplitude', 0.015, 0, 0.1, 0.001), n('speed', 'Speed', 6, -30, 30, 0.1), n('falloff', 'Falloff', 1.2, 0, 8, 0.1)],
  },
};

export const S35_META: Record<string, S35Meta> = {
  'builtin:fx-curves': { stage: 3, origin: 'original', license: ORIG, neutral: {}, probe: { p1: 0.1, p3: 0.9 } },
  'builtin:fx-gradient-map': { stage: 3, origin: 'original', license: ORIG, neutral: { intensity: 0 }, probe: { midHue: 120, intensity: 1 } },
  'builtin:fx-vibrance': { stage: 3, origin: 'original', license: ORIG, neutral: { vibrance: 0, saturation: 0 }, probe: { vibrance: 1, saturation: 0.5 } },
  'builtin:fx-temperature-tint': { stage: 3, origin: 'original', license: ORIG, neutral: { temperature: 0, tint: 0 }, probe: { temperature: 0.8, tint: -0.5 } },
  'builtin:fx-sharpen': { stage: 3, origin: 'original', license: ORIG, neutral: { amount: 0 }, probe: { amount: 3 } },
  'builtin:fx-radial-blur': { stage: 3, origin: 'original', license: ORIG, neutral: { amount: 0 }, probe: { amount: 0.4 } },
  'builtin:fx-box-blur': { stage: 3, origin: 'original', license: ORIG, neutral: { radius: 0 }, probe: { radius: 12 } },
  'builtin:fx-twirl': { stage: 3, origin: 'original', license: ORIG, neutral: { angle: 0 }, probe: { angle: 6 } },
  'builtin:fx-wave': { stage: 3, origin: 'original', license: ORIG, neutral: { amplitude: 0 }, probe: { amplitude: 0.05 }, animated: true },
  'builtin:fx-bulge-pinch': { stage: 3, origin: 'original', license: ORIG, neutral: { strength: 0 }, probe: { strength: -0.8 } },
  'builtin:fx-glass': { stage: 3, origin: 'original', license: ORIG, neutral: { amount: 0 }, probe: { amount: 0.05, ribs: 30 } },
  'builtin:fx-edge-detect': { stage: 3, origin: 'original', license: ORIG, neutral: { mixOriginal: 1 }, probe: { strength: 6, invert: 1 } },
  'builtin:fx-vhs': { stage: 3, origin: 'original', license: ORIG, neutral: { tracking: 0, chroma: 0, noise: 0, scanlines: 0, fade: 0 }, probe: { tracking: 1, noise: 0.8 }, animated: true },
  'builtin:fx-ascii-text': { stage: 3, origin: 'original', license: ORIG, neutral: { mixOriginal: 1 }, probe: { cell: 16, invert: 1 } },
  'builtin:fx-exposure': { stage: 5, origin: 'seriously-mit', license: MIT, upstream: SER('exposure'), neutral: { exposure: 0 }, probe: { exposure: -1.5 } },
  'builtin:fx-emboss': { stage: 5, origin: 'seriously-mit', license: MIT, upstream: SER('emboss'), neutral: { blend: 1 }, probe: { amount: 2, distance: 3 } },
  'builtin:fx-scanlines': { stage: 5, origin: 'seriously-mit', license: MIT, upstream: SER('scanlines'), neutral: { intensity: 0 }, probe: { intensity: 1, lines: 60 } },
  'builtin:fx-polar': { stage: 5, origin: 'seriously-mit', license: MIT, upstream: SER('polar'), neutral: { amount: 0 }, probe: { amount: 1, angle: 45 } },
  'builtin:fx-nightvision': { stage: 5, origin: 'original', license: ORIG, probe: { amplification: 2.5 }, animated: true },
  'builtin:fx-sketch': { stage: 5, origin: 'original', license: ORIG, probe: { lineStrength: 6, hatch: 1 } },
  'builtin:fx-ripple': { stage: 5, origin: 'original', license: ORIG, neutral: { amplitude: 0 }, probe: { amplitude: 0.06 }, animated: true },
};

export const S35_ORDER = Object.keys(S35_EFFECTS);
