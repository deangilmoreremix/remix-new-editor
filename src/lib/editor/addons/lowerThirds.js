/**
 * Original animated lower-third templates, generated as Lottie JSON.
 *
 * Upstream's Lower Thirds (lib/popcorn/plugins/jsonAnimation) played Lottie
 * files from its vidcloud catalog with the text swapped in. Those files are
 * not available and third-party ones can't be redistributed inside the
 * editor, so these templates are authored here from scratch: each template
 * builds a Lottie animation (shape + text layers) from the user's name,
 * title, colours and font. They are original work owned by this project.
 *
 * Every template uses the same timeline at 30 fps so playback can be synced
 * to any clip length (see lowerThirdFrame):
 *   0–18   in       18–45  hold       45–60  out
 */

export const LT_FPS = 30;
export const LT_IN_END = 18;
export const LT_HOLD_FRAME = 30;
export const LT_OUT_START = 45;
export const LT_OP = 60;
export const LT_W = 1000;
export const LT_H = 250;

const EASE_OUT = { o: { x: [0.16], y: [1] }, i: { x: [0.3], y: [1] } };
const EASE_IN = { o: { x: [0.7], y: [0] }, i: { x: [0.84], y: [0] } };

// ---------------------------------------------------------------- primitives

const st = (k) => ({ a: 0, k });

/** Animated property from [[frame, value, ease?], ...]; values are arrays. */
function anim(frames) {
  return {
    a: 1,
    k: frames.map(([t, s, ease], i) => {
      const kf = { t, s: Array.isArray(s) ? s : [s] };
      if (i < frames.length - 1) Object.assign(kf, ease || EASE_OUT);
      return kf;
    }),
  };
}

export function hexToRgb01(hex, fallback = [1, 1, 1]) {
  const m = String(hex || '').replace('#', '').match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return fallback;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function transform({ p = [0, 0, 0], a = [0, 0, 0], s = [100, 100, 100], o = 100, r = 0 } = {}) {
  const wrap = (v, dims) => (v && v.a !== undefined ? v : st(dims ? v : v));
  return { o: wrap(o), r: wrap(r), p: wrap(p, 3), a: wrap(a, 3), s: wrap(s, 3) };
}

function layerBase(ind, nm, ty, ks) {
  return { ddd: 0, ind, ty, nm, sr: 1, ks, ao: 0, ip: 0, op: LT_OP, st: 0, bm: 0 };
}

/** Shape layer with one filled (rounded) rectangle. Rect given by top-left. */
function rectLayer(ind, nm, { x, y, w, h, radius = 0, color, ks }) {
  return {
    ...layerBase(ind, nm, 4, ks || transform()),
    shapes: [{
      ty: 'gr',
      nm,
      it: [
        { ty: 'rc', d: 1, nm: 'rect', s: st([w, h]), p: st([x + w / 2, y + h / 2]), r: st(radius) },
        { ty: 'fl', nm: 'fill', c: st([...color, 1]), o: st(100), r: 1 },
        { ty: 'tr', nm: 'tr', p: st([0, 0]), a: st([0, 0]), s: st([100, 100]), r: st(0), o: st(100), sk: st(0), sa: st(0) },
      ],
    }],
  };
}

function ellipseLayer(ind, nm, { cx, cy, d, color, ks }) {
  return {
    ...layerBase(ind, nm, 4, ks || transform()),
    shapes: [{
      ty: 'gr',
      nm,
      it: [
        { ty: 'el', d: 1, nm: 'ellipse', s: st([d, d]), p: st([cx, cy]) },
        { ty: 'fl', nm: 'fill', c: st([...color, 1]), o: st(100), r: 1 },
        { ty: 'tr', nm: 'tr', p: st([0, 0]), a: st([0, 0]), s: st([100, 100]), r: st(0), o: st(100), sk: st(0), sa: st(0) },
      ],
    }],
  };
}

/** Text layer; (x, baseline) is the left end of the baseline. */
function textLayer(ind, nm, { text, font, size, color, x, baseline, ks, tracking = 0 }) {
  return {
    ...layerBase(ind, nm, 5, ks || transform({ p: [x, baseline, 0] })),
    t: {
      d: { k: [{ s: { s: size, f: font, t: String(text || ''), j: 0, tr: tracking, lh: size * 1.2, ls: 0, fc: color }, t: 0 }] },
      p: {},
      m: { g: 1, a: st([0, 0]) },
      a: [],
    },
  };
}

// Common motions -------------------------------------------------------

/** Horizontal wipe: scale X from the left edge `x0`, back out at the end. */
const wipeX = (x0, cy) => transform({
  a: [x0, cy, 0],
  p: [x0, cy, 0],
  s: anim([[0, [0, 100, 100]], [LT_IN_END, [100, 100, 100]], [LT_OUT_START, [100, 100, 100], EASE_IN], [LT_OP, [0, 100, 100]]]),
});
const wipeY = (cx, y0) => transform({
  a: [cx, y0, 0],
  p: [cx, y0, 0],
  s: anim([[0, [100, 0, 100]], [LT_IN_END - 6, [100, 100, 100]], [LT_OUT_START + 4, [100, 100, 100], EASE_IN], [LT_OP, [100, 0, 100]]]),
});
const popIn = (cx, cy) => transform({
  a: [cx, cy, 0],
  p: [cx, cy, 0],
  s: anim([[0, [0, 0, 100]], [LT_IN_END, [100, 100, 100]], [LT_OUT_START, [100, 100, 100], EASE_IN], [LT_OP, [0, 0, 100]]]),
});
/** Text slides in from `dx` px left and fades, with an optional delay. */
const slideFade = (x, baseline, { dx = -40, dy = 0, delay = 4 } = {}) => transform({
  p: anim([[delay, [x + dx, baseline + dy, 0]], [LT_IN_END + delay, [x, baseline, 0]], [LT_OUT_START, [x, baseline, 0], EASE_IN], [LT_OP - 2, [x + dx / 2, baseline + dy / 2, 0]]]),
  o: anim([[delay, 0], [LT_IN_END + delay - 4, 100], [LT_OUT_START, 100, EASE_IN], [LT_OP - 4, 0]]),
});

// ---------------------------------------------------------------- measuring

let measureCtx = null;
/** Text width in px; canvas measureText in the browser, an estimate elsewhere. */
export function measureText(text, size, family, weight = 700) {
  const str = String(text || '');
  try {
    if (!measureCtx && typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      measureCtx = c.getContext && c.getContext('2d');
    }
    if (measureCtx) {
      measureCtx.font = `${weight} ${size}px "${family}", sans-serif`;
      const w = measureCtx.measureText(str).width;
      if (w > 0) return w;
    }
  } catch { /* no canvas (tests) */ }
  return str.length * size * (weight >= 600 ? 0.6 : 0.52);
}

// ---------------------------------------------------------------- templates

const M = 40; // left margin

/**
 * Each template: (o) => layers[]. `o` holds: name, title, nameSize,
 * titleSize, fonts {bold, regular}, colors {accent, bar, text, subText},
 * widths {name, title}.
 */
const TEMPLATES = {
  'classic-bar': {
    label: 'Classic Bar',
    build(o) {
      const barW = Math.min(LT_W - M - 30, Math.max(o.widths.name, o.widths.title) + 80);
      const barY = 60;
      const barH = 140;
      return [
        textLayer(1, 'name', { text: o.name, font: o.fonts.bold, size: o.nameSize, color: o.colors.text, x: M + 46, baseline: barY + 66, ks: slideFade(M + 46, barY + 66) }),
        textLayer(2, 'title', { text: o.title, font: o.fonts.regular, size: o.titleSize, color: o.colors.subText, x: M + 46, baseline: barY + 112, ks: slideFade(M + 46, barY + 112, { delay: 7 }) }),
        rectLayer(3, 'stripe', { x: M, y: barY, w: 12, h: barH, color: o.colors.accent, ks: wipeY(M + 6, barY + barH) }),
        rectLayer(4, 'bar', { x: M, y: barY, w: barW, h: barH, color: o.colors.bar, ks: wipeX(M, barY + barH / 2) }),
      ];
    },
  },
  'split-bars': {
    label: 'Split Bars',
    build(o) {
      const nameW = Math.min(LT_W - M - 30, o.widths.name + 60);
      const titleW = Math.min(LT_W - M - 30, o.widths.title + 60);
      return [
        textLayer(1, 'name', { text: o.name, font: o.fonts.bold, size: o.nameSize, color: o.colors.text, x: M + 30, baseline: 112, ks: slideFade(M + 30, 112) }),
        textLayer(2, 'title', { text: o.title, font: o.fonts.regular, size: o.titleSize, color: o.colors.subText, x: M + 30, baseline: 174, ks: slideFade(M + 30, 174, { delay: 9 }) }),
        rectLayer(3, 'name-bar', { x: M, y: 50, w: nameW, h: 84, color: o.colors.accent, ks: wipeX(M, 92) }),
        rectLayer(4, 'title-bar', {
          x: M, y: 138, w: titleW, h: 52, color: o.colors.bar,
          ks: transform({ a: [M, 164, 0], p: [M, 164, 0], s: anim([[5, [0, 100, 100]], [LT_IN_END + 5, [100, 100, 100]], [LT_OUT_START - 3, [100, 100, 100], EASE_IN], [LT_OP - 3, [0, 100, 100]]]) }),
        }),
      ];
    },
  },
  'minimal-line': {
    label: 'Minimal Line',
    build(o) {
      const lineW = Math.min(LT_W - M - 30, Math.max(o.widths.name, o.widths.title) + 10);
      return [
        textLayer(1, 'name', { text: o.name, font: o.fonts.bold, size: o.nameSize, color: o.colors.text, x: M, baseline: 110, ks: slideFade(M, 110, { dx: 0, dy: 24 }) }),
        textLayer(2, 'title', { text: o.title, font: o.fonts.regular, size: o.titleSize, color: o.colors.subText, x: M, baseline: 186, ks: slideFade(M, 186, { dx: 0, dy: -20, delay: 8 }) }),
        rectLayer(3, 'line', { x: M, y: 132, w: lineW, h: 6, radius: 3, color: o.colors.accent, ks: wipeX(M, 135) }),
      ];
    },
  },
  pill: {
    label: 'Pill',
    build(o) {
      const w = Math.min(LT_W - M - 30, Math.max(o.widths.name, o.widths.title) + 170);
      const y = 55;
      const h = 140;
      return [
        textLayer(1, 'name', { text: o.name, font: o.fonts.bold, size: o.nameSize, color: o.colors.text, x: M + 130, baseline: y + 66, ks: slideFade(M + 130, y + 66, { dx: -20 }) }),
        textLayer(2, 'title', { text: o.title, font: o.fonts.regular, size: o.titleSize, color: o.colors.subText, x: M + 130, baseline: y + 110, ks: slideFade(M + 130, y + 110, { dx: -20, delay: 7 }) }),
        ellipseLayer(3, 'dot', { cx: M + 70, cy: y + h / 2, d: 96, color: o.colors.accent, ks: popIn(M + 70, y + h / 2) }),
        rectLayer(4, 'pill', { x: M, y, w, h, radius: h / 2, color: o.colors.bar, ks: wipeX(M, y + h / 2) }),
      ];
    },
  },
  'boxed-accent': {
    label: 'Boxed Accent',
    build(o) {
      const box = 140;
      const y = 55;
      const barW = Math.min(LT_W - M - box - 20, Math.max(o.widths.name, o.widths.title) + 70);
      const initial = String(o.name || '?').trim().charAt(0).toUpperCase();
      return [
        textLayer(1, 'initial', { text: initial, font: o.fonts.bold, size: 90, color: o.colors.text, x: M + box / 2 - measureText(initial, 90, o.family) / 2, baseline: y + 102, ks: transform({ p: [M + box / 2 - measureText(initial, 90, o.family) / 2, y + 102, 0], o: anim([[6, 0], [LT_IN_END, 100], [LT_OUT_START, 100, EASE_IN], [LT_OP - 6, 0]]) }) }),
        textLayer(2, 'name', { text: o.name, font: o.fonts.bold, size: o.nameSize, color: o.colors.text, x: M + box + 30, baseline: y + 66, ks: slideFade(M + box + 30, y + 66, { delay: 8 }) }),
        textLayer(3, 'title', { text: o.title, font: o.fonts.regular, size: o.titleSize, color: o.colors.subText, x: M + box + 30, baseline: y + 112, ks: slideFade(M + box + 30, y + 112, { delay: 11 }) }),
        rectLayer(4, 'box', { x: M, y, w: box, h: box, color: o.colors.accent, ks: popIn(M + box / 2, y + box / 2) }),
        rectLayer(5, 'bar', {
          x: M + box, y, w: barW, h: box, color: o.colors.bar,
          ks: transform({ a: [M + box, y + box / 2, 0], p: [M + box, y + box / 2, 0], s: anim([[6, [0, 100, 100]], [LT_IN_END + 6, [100, 100, 100]], [LT_OUT_START, [100, 100, 100], EASE_IN], [LT_OP - 4, [0, 100, 100]]]) }),
        }),
      ];
    },
  },
  news: {
    label: 'News Strap',
    build(o) {
      const y = 120;
      const h = 90;
      const label = String(o.title || 'LIVE').toUpperCase();
      const labelW = Math.min(360, measureText(label, 36, o.family) + 50);
      return [
        textLayer(1, 'label', { text: label, font: o.fonts.bold, size: 36, color: o.colors.text, x: 25, baseline: y + 58, tracking: 40, ks: slideFade(25, y + 58, { dx: 0, dy: 20, delay: 6 }) }),
        textLayer(2, 'name', { text: o.name, font: o.fonts.bold, size: 48, color: o.colors.text, x: labelW + 30, baseline: y + 62, ks: slideFade(labelW + 30, y + 62, { delay: 10 }) }),
        rectLayer(3, 'label-box', { x: 0, y, w: labelW, h, color: o.colors.accent, ks: wipeY(labelW / 2, y + h) }),
        rectLayer(4, 'strap', { x: 0, y, w: LT_W, h, color: o.colors.bar, ks: wipeX(0, y + h / 2) }),
      ];
    },
  },
  'side-rule': {
    label: 'Side Rule',
    build(o) {
      const y = 50;
      const h = 150;
      const bgW = Math.min(LT_W - M - 30, Math.max(o.widths.name, o.widths.title) + 70);
      return [
        textLayer(1, 'name', { text: o.name, font: o.fonts.bold, size: o.nameSize, color: o.colors.text, x: M + 36, baseline: y + 70, ks: slideFade(M + 36, y + 70, { dx: 0, dy: 20 }) }),
        textLayer(2, 'title', { text: o.title, font: o.fonts.regular, size: o.titleSize, color: o.colors.subText, x: M + 36, baseline: y + 118, ks: slideFade(M + 36, y + 118, { dx: 0, dy: 20, delay: 8 }) }),
        rectLayer(3, 'rule', { x: M, y, w: 8, h, color: o.colors.accent, ks: wipeY(M + 4, y + h) }),
        rectLayer(4, 'veil', {
          x: M, y, w: bgW, h, color: o.colors.bar,
          ks: transform({ o: anim([[2, 0], [LT_IN_END, 78], [LT_OUT_START, 78, EASE_IN], [LT_OP, 0]]) }),
        }),
      ];
    },
  },
  underline: {
    label: 'Bold Underline',
    build(o) {
      const name = String(o.name || '').toUpperCase();
      const nameW = measureText(name, o.nameSize, o.family);
      return [
        textLayer(1, 'title', { text: o.title, font: o.fonts.regular, size: o.titleSize, color: o.colors.accent, x: M, baseline: 72, ks: slideFade(M, 72, { dx: 0, dy: 16 }) }),
        textLayer(2, 'name', { text: name, font: o.fonts.bold, size: o.nameSize, color: o.colors.text, x: M, baseline: 150, tracking: 20, ks: slideFade(M, 150, { dx: 0, dy: 26, delay: 5 }) }),
        rectLayer(3, 'underline', { x: M, y: 168, w: Math.min(LT_W - M - 30, nameW + 40), h: 14, color: o.colors.accent, ks: wipeX(M, 175) }),
      ];
    },
  },
};

export const LOWER_THIRD_TEMPLATES = Object.entries(TEMPLATES).map(([id, t]) => [id, t.label]);

export const LOWER_THIRD_DEFAULTS = {
  template: 'classic-bar',
  name: 'Jane Doe',
  title: 'Founder & CEO',
  fontFamily: 'Montserrat',
  accentColor: '#eb5054',
  barColor: '#111827',
  textColor: '#ffffff',
  subTextColor: '#d1d5db',
};

/**
 * Build the Lottie animation for a lower third. Text is already resolved
 * (tokens substituted) by the caller.
 */
export function buildLowerThirdLottie(options = {}) {
  const o = { ...LOWER_THIRD_DEFAULTS, ...options };
  const template = TEMPLATES[o.template] || TEMPLATES['classic-bar'];
  const family = o.fontFamily || 'Montserrat';
  let nameSize = 64;
  const titleSize = 34;
  // Shrink the name until the widest template layout fits the canvas.
  while (nameSize > 30 && measureText(o.name, nameSize, family) > LT_W - 220) nameSize -= 2;
  const ctx = {
    name: o.name,
    title: o.title,
    nameSize,
    titleSize,
    family,
    fonts: { bold: 'LTBold', regular: 'LTRegular' },
    colors: {
      accent: hexToRgb01(o.accentColor, [0.92, 0.31, 0.33]),
      bar: hexToRgb01(o.barColor, [0.07, 0.09, 0.15]),
      text: hexToRgb01(o.textColor, [1, 1, 1]),
      subText: hexToRgb01(o.subTextColor, [0.82, 0.84, 0.86]),
    },
    widths: {
      name: measureText(o.name, nameSize, family, 700),
      title: measureText(o.title, titleSize, family, 400),
    },
  };
  return {
    v: '5.7.4',
    fr: LT_FPS,
    ip: 0,
    op: LT_OP,
    w: LT_W,
    h: LT_H,
    nm: `Lower third: ${template.label}`,
    ddd: 0,
    assets: [],
    fonts: {
      list: [
        { fName: 'LTBold', fFamily: family, fStyle: 'Bold', fWeight: '700', ascent: 72 },
        { fName: 'LTRegular', fFamily: family, fStyle: 'Regular', fWeight: '400', ascent: 72 },
      ],
    },
    layers: template.build(ctx),
    markers: [],
  };
}

/**
 * Frame to show `elapsed` seconds into a lower third lasting `duration`
 * seconds: play the in, hold, and finish with the out just before the end.
 */
export function lowerThirdFrame(elapsed, duration) {
  const inSec = LT_IN_END / LT_FPS;
  const outSec = (LT_OP - LT_OUT_START) / LT_FPS;
  if (elapsed <= 0) return 0;
  if (elapsed < inSec) return elapsed * LT_FPS;
  const outStart = Math.max(inSec, duration - outSec);
  if (elapsed < outStart) return LT_HOLD_FRAME;
  return Math.min(LT_OP - 0.01, LT_OUT_START + (elapsed - outStart) * LT_FPS);
}
