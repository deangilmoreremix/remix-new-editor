/**
 * Animated call-to-action buttons (upstream "JSON Button" / CTA library).
 *
 * Upstream's CTA library was a set of Lottie files kept on its old backend.
 * These are new, original animations generated as Lottie JSON, so the
 * button text, colours and font stay editable. They play in the editor
 * preview (lottie-web), the Remotion preview/export (@remotion/lottie) and
 * the published player, where the button is clickable.
 *
 * Canvas 600×200 at 30 fps, 2-second loop. The button box keeps a 3:1
 * aspect ratio wherever it is drawn.
 */
import { hexToRgb01, measureText } from './lowerThirds.js';

export const CTA_FPS = 30;
export const CTA_OP = 60;
export const CTA_W = 600;
export const CTA_H = 200;
export const CTA_ASPECT = CTA_W / CTA_H;

// Pill geometry
const PX = 30;
const PY = 40;
const PW = 540;
const PH = 120;
const CX = PX + PW / 2;
const CY = PY + PH / 2;

const LINEAR = { o: { x: [0.33], y: [0] }, i: { x: [0.67], y: [1] } };
const st = (k) => ({ a: 0, k });
const anim = (frames) => ({
  a: 1,
  k: frames.map(([t, s, ease], i) => {
    const kf = { t, s: Array.isArray(s) ? s : [s] };
    if (i < frames.length - 1) Object.assign(kf, ease || LINEAR);
    return kf;
  }),
});
const wrap = (v) => (v && v.a !== undefined ? v : st(v));
const tf = ({ p = [0, 0, 0], a = [0, 0, 0], s = [100, 100, 100], o = 100, r = 0 } = {}) => ({ o: wrap(o), r: wrap(r), p: wrap(p), a: wrap(a), s: wrap(s) });
const layer = (ind, nm, ty, ks, extra = {}) => ({ ddd: 0, ind, ty, nm, sr: 1, ks, ao: 0, ip: 0, op: CTA_OP, st: 0, bm: 0, ...extra });
const groupTr = () => ({ ty: 'tr', nm: 'tr', p: st([0, 0]), a: st([0, 0]), s: st([100, 100]), r: st(0), o: st(100), sk: st(0), sa: st(0) });

function pill(ind, nm, { color, stroke, strokeWidth = 6, opacity = 100, ks, extra, inset = 0 }) {
  const items = [{ ty: 'rc', d: 1, nm: 'rect', s: st([PW - inset * 2, PH - inset * 2]), p: st([CX, CY]), r: st((PH - inset * 2) / 2) }];
  if (color) items.push({ ty: 'fl', nm: 'fill', c: st([...color, 1]), o: wrap(opacity), r: 1 });
  if (stroke) items.push({ ty: 'st', nm: 'stroke', c: st([...stroke, 1]), o: st(100), w: st(strokeWidth), lc: 2, lj: 2 });
  items.push(groupTr());
  return layer(ind, nm, 4, ks || tf(), { shapes: [{ ty: 'gr', nm, it: items }], ...extra });
}

function shapeLayer(ind, nm, items, ks, extra) {
  return layer(ind, nm, 4, ks || tf(), { shapes: [{ ty: 'gr', nm, it: [...items, groupTr()] }], ...extra });
}

/** Closed or open polyline path. */
const path = (pts, closed = true) => ({
  ty: 'sh', nm: 'path', ks: st({ i: pts.map(() => [0, 0]), o: pts.map(() => [0, 0]), v: pts, c: closed }),
});
const fill = (c, o = 100) => ({ ty: 'fl', nm: 'fill', c: st([...c, 1]), o: wrap(o), r: 1 });
const stroke = (c, w) => ({ ty: 'st', nm: 'stroke', c: st([...c, 1]), o: st(100), w: st(w), lc: 2, lj: 2 });

function text(ind, { text: str, size, color, x, ks }) {
  const baseline = CY + size * 0.35;
  return layer(ind, 'text', 5, ks || tf({ p: [x, baseline, 0] }), {
    t: {
      d: { k: [{ s: { s: size, f: 'CTABold', t: str, j: 2, tr: 0, lh: size * 1.2, ls: 0, fc: color }, t: 0 }] },
      p: {},
      m: { g: 1, a: st([0, 0]) },
      a: [],
    },
  });
}

/** Breathing scale around the button centre. */
const breathe = (amount = 5) => tf({
  a: [CX, CY, 0], p: [CX, CY, 0],
  s: anim([[0, [100, 100, 100]], [15, [100 + amount, 100 + amount, 100]], [30, [100, 100, 100]], [60, [100, 100, 100]]]),
});

const ICON_X_LEFT = PX + 70;
const ICON_X_RIGHT = PX + PW - 70;

const arrowIcon = (c) => [path([[-10, -18], [8, 0], [-10, 18]], false), stroke(c, 9)];
const playIcon = (c) => [path([[-12, -18], [16, 0], [-12, 18]]), fill(c)];
/**
 * SVG path data (absolute/relative M L H V C Z) → Lottie bezier shape
 * vertices, scaled by `k` and centred on (cx, cy) of the source viewBox.
 */
export function svgPathToLottie(d, { k = 1, cx = 0, cy = 0 } = {}) {
  const tokens = String(d).match(/[MmLlHhVvCcZz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const shapes = [];
  let cur = null;
  let x = 0; let y = 0; let cmd = ''; let i = 0;
  const num = () => Number(tokens[i++]);
  const P = (px, py) => [(px - cx) * k, (py - cy) * k];
  const start = (px, py) => { cur = { v: [P(px, py)], i: [[0, 0]], o: [[0, 0]], c: false }; shapes.push(cur); };
  const lineTo = (px, py) => { cur.v.push(P(px, py)); cur.i.push([0, 0]); cur.o.push([0, 0]); };
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case 'M': { const nx = num() + (rel ? x : 0); const ny = num() + (rel ? y : 0); x = nx; y = ny; start(x, y); cmd = rel ? 'l' : 'L'; break; }
      case 'L': { x = num() + (rel ? x : 0); y = num() + (rel ? y : 0); lineTo(x, y); break; }
      case 'H': { x = num() + (rel ? x : 0); lineTo(x, y); break; }
      case 'V': { y = num() + (rel ? y : 0); lineTo(x, y); break; }
      case 'C': {
        const c1x = num() + (rel ? x : 0); const c1y = num() + (rel ? y : 0);
        const c2x = num() + (rel ? x : 0); const c2y = num() + (rel ? y : 0);
        const ex = num() + (rel ? x : 0); const ey = num() + (rel ? y : 0);
        const last = cur.v.length - 1;
        cur.o[last] = [(c1x - x) * k, (c1y - y) * k];
        cur.v.push(P(ex, ey)); cur.i.push([(c2x - ex) * k, (c2y - ey) * k]); cur.o.push([0, 0]);
        x = ex; y = ey;
        break;
      }
      case 'Z': {
        cur.c = true;
        // A closing point equal to the start merges into it.
        const a = cur.v[0]; const b = cur.v[cur.v.length - 1];
        if (cur.v.length > 1 && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) {
          cur.i[0] = cur.i.pop(); cur.v.pop(); cur.o.pop();
        }
        x = (cur.v[0][0] / k) + cx; y = (cur.v[0][1] / k) + cy;
        break;
      }
      default: i++;
    }
  }
  return shapes.map((sh) => ({ ty: 'sh', nm: 'path', ks: st(sh) }));
}

// Material-style phone handset (24×24 viewBox), drawn about 52 px tall.
const PHONE_PATH = 'M6.62 10.79C8.06 13.62 10.38 15.93 13.21 17.38L15.41 15.18C15.68 14.91 16.08 14.82 16.43 14.94C17.55 15.31 18.76 15.51 20 15.51C20.55 15.51 21 15.96 21 16.51V20C21 20.55 20.55 21 20 21C10.61 21 3 13.39 3 4C3 3.45 3.45 3 4 3H7.5C8.05 3 8.5 3.45 8.5 4C8.5 5.25 8.7 6.45 9.07 7.57C9.18 7.92 9.1 8.31 8.82 8.59L6.62 10.79Z';
const phoneIcon = (c) => [...svgPathToLottie(PHONE_PATH, { k: 2.4, cx: 12, cy: 12 }), fill(c)];
const cartIcon = (c) => [path([[-20, -14], [-12, -14], [-4, 10], [18, 10], [22, -6], [-9, -6]], false), stroke(c, 6),
  { ty: 'el', d: 1, nm: 'w1', s: st([9, 9]), p: st([-1, 20]) }, { ty: 'el', d: 1, nm: 'w2', s: st([9, 9]), p: st([15, 20]) }, fill(c)];

/**
 * Each style: ({ bg, fg, icon, accent, shine, label, size }) → layers (top first).
 *   bg button · fg label · icon icon glyph · accent rings/glow/ripples · shine sheen
 * `textX` shifts the label when an icon sits beside it.
 */
const STYLES = {
  pulse: {
    label: 'Pulse',
    icon: null,
    build: ({ bg, fg, accent, label, size }) => [
      text(1, { text: label, size, color: fg, x: CX, ks: tf({ a: [0, 0, 0], p: anim([[0, [CX, CY + size * 0.35, 0]], [15, [CX, CY + size * 0.35, 0]]]), s: anim([[0, [100, 100, 100]], [15, [105, 105, 100]], [30, [100, 100, 100]], [60, [100, 100, 100]]]) }) }),
      pill(2, 'button', { color: bg, ks: breathe(5) }),
      pill(3, 'ring', {
        stroke: accent, strokeWidth: 8,
        ks: tf({ a: [CX, CY, 0], p: [CX, CY, 0], s: anim([[0, [100, 100, 100]], [36, [112, 135, 100]], [60, [112, 135, 100]]]), o: anim([[0, 80], [36, 0], [60, 0]]) }),
      }),
    ],
  },
  shine: {
    label: 'Shine',
    icon: null,
    build: ({ bg, fg, shine, label, size }) => [
      text(1, { text: label, size, color: fg, x: CX }),
      // Sheen, clipped to the button by the matte layer above it.
      pill(2, 'matte', { color: [1, 1, 1], extra: { td: 1 } }),
      shapeLayer(3, 'sheen', [{ ty: 'rc', d: 1, nm: 'bar', s: st([70, 260]), p: st([0, 0]), r: st(0) }, fill(shine, 45)],
        tf({ r: 20, p: anim([[0, [-80, CY, 0]], [10, [-80, CY, 0]], [38, [CTA_W + 80, CY, 0]], [60, [CTA_W + 80, CY, 0]]]) }), { tt: 1 }),
      pill(4, 'button', { color: bg }),
    ],
  },
  bounce: {
    label: 'Bounce',
    icon: null,
    build: ({ bg, fg, label, size }) => {
      const hop = anim([[0, [0, 0, 0]], [8, [0, -18, 0]], [16, [0, 0, 0]], [22, [0, -7, 0]], [28, [0, 0, 0]], [60, [0, 0, 0]]]);
      return [
        text(1, { text: label, size, color: fg, x: CX, ks: tf({ p: { a: 1, k: hop.k.map((k) => ({ ...k, s: [CX + k.s[0], CY + size * 0.35 + k.s[1], 0] })) } }) }),
        pill(2, 'button', { color: bg, ks: tf({ p: hop }) }),
        shapeLayer(3, 'shadow', [{ ty: 'el', d: 1, nm: 'shadow', s: st([PW * 0.8, 18]), p: st([CX, PY + PH + 18]) }, fill([0, 0, 0], 25)],
          tf({ a: [CX, PY + PH + 18, 0], p: [CX, PY + PH + 18, 0], s: anim([[0, [100, 100, 100]], [8, [80, 80, 100]], [16, [100, 100, 100]], [60, [100, 100, 100]]]) })),
      ];
    },
  },
  arrow: {
    label: 'Arrow nudge',
    icon: 'arrow',
    build: ({ bg, fg, icon, label, size }) => [
      text(1, { text: label, size, color: fg, x: CX - 30 }),
      shapeLayer(2, 'arrow', arrowIcon(icon), tf({ p: anim([[0, [ICON_X_RIGHT - 10, CY, 0]], [12, [ICON_X_RIGHT + 6, CY, 0]], [24, [ICON_X_RIGHT - 10, CY, 0]], [36, [ICON_X_RIGHT + 6, CY, 0]], [48, [ICON_X_RIGHT - 10, CY, 0]], [60, [ICON_X_RIGHT - 10, CY, 0]]]) })),
      pill(3, 'button', { color: bg }),
    ],
  },
  phone: {
    label: 'Ringing phone',
    icon: 'phone',
    build: ({ bg, fg, icon, label, size }) => [
      text(1, { text: label, size, color: fg, x: CX + 30 }),
      shapeLayer(2, 'phone', phoneIcon(icon), tf({
        p: [ICON_X_LEFT, CY, 0],
        r: anim([[0, 0], [3, -16], [6, 16], [9, -16], [12, 16], [15, -10], [18, 0], [60, 0]]),
      })),
      pill(3, 'button', { color: bg, ks: breathe(3) }),
    ],
  },
  play: {
    label: 'Play / Watch',
    icon: 'play',
    build: ({ bg, fg, icon, label, size }) => [
      text(1, { text: label, size, color: fg, x: CX + 30 }),
      shapeLayer(2, 'play', playIcon(icon), tf({ a: [0, 0, 0], p: [ICON_X_LEFT, CY, 0], s: anim([[0, [100, 100, 100]], [15, [125, 125, 100]], [30, [100, 100, 100]], [60, [100, 100, 100]]]) })),
      pill(3, 'button', { color: bg }),
    ],
  },
  cart: {
    label: 'Shop now',
    icon: 'cart',
    build: ({ bg, fg, icon, label, size }) => [
      text(1, { text: label, size, color: fg, x: CX + 30 }),
      shapeLayer(2, 'cart', cartIcon(icon), tf({ p: anim([[0, [ICON_X_LEFT, CY, 0]], [10, [ICON_X_LEFT + 8, CY, 0]], [14, [ICON_X_LEFT + 4, CY, 0]], [20, [ICON_X_LEFT, CY, 0]], [60, [ICON_X_LEFT, CY, 0]]]), r: anim([[0, 0], [10, -6], [20, 0], [60, 0]]) })),
      pill(3, 'button', { color: bg }),
    ],
  },
  outline: {
    label: 'Glow outline',
    icon: null,
    build: ({ bg, fg, accent, label, size }) => [
      text(1, { text: label, size, color: fg, x: CX }),
      pill(2, 'outline', { stroke: bg, strokeWidth: 7 }),
      pill(3, 'fill', { color: bg, opacity: anim([[0, 25], [30, 85], [60, 25]]) }),
      pill(4, 'glow', { stroke: accent, strokeWidth: 16, ks: tf({ a: [CX, CY, 0], p: [CX, CY, 0], s: anim([[0, [100, 100, 100]], [30, [104, 112, 100]], [60, [100, 100, 100]]]), o: anim([[0, 10], [30, 45], [60, 10]]) }) }),
    ],
  },
  ripple: {
    label: 'Ripple',
    icon: null,
    build: ({ bg, fg, accent, label, size }) => {
      const ring = (ind, delay) => pill(ind, `ripple${ind}`, {
        stroke: accent, strokeWidth: 5,
        ks: tf({ a: [CX, CY, 0], p: [CX, CY, 0], s: anim([[delay, [100, 100, 100]], [delay + 40, [108, 145, 100]], [60, [108, 145, 100]]]), o: anim([[delay, 70], [delay + 40, 0], [60, 0]]) }),
      });
      return [text(1, { text: label, size, color: fg, x: CX }), pill(2, 'button', { color: bg }), ring(3, 0), ring(4, 14)];
    },
  },
};

/** Which extra colours a style uses: an icon, and an effect (ring/glow/ripple/sheen). */
const EFFECT_STYLES = new Set(['pulse', 'shine', 'outline', 'ripple']);
export function ctaColorParts(animation) {
  const style = STYLES[animation];
  return { icon: !!style?.icon, effect: EFFECT_STYLES.has(animation) };
}

/** One-click colour themes: button, text, icon and effect together. */
export const CTA_COLOR_THEMES = [
  { id: 'red', label: 'Red', buttonColor: '#eb5054', textColor: '#ffffff', iconColor: '#ffffff', accentColor: '#eb5054' },
  { id: 'cyan', label: 'Cyan', buttonColor: '#22d3ee', textColor: '#07090d', iconColor: '#07090d', accentColor: '#22d3ee' },
  { id: 'emerald', label: 'Emerald', buttonColor: '#34d399', textColor: '#07090d', iconColor: '#07090d', accentColor: '#34d399' },
  { id: 'amber', label: 'Amber', buttonColor: '#f59e0b', textColor: '#07090d', iconColor: '#07090d', accentColor: '#fbbf24' },
  { id: 'violet', label: 'Violet', buttonColor: '#7c3aed', textColor: '#ffffff', iconColor: '#fde68a', accentColor: '#a78bfa' },
  { id: 'blue', label: 'Blue', buttonColor: '#2563eb', textColor: '#ffffff', iconColor: '#ffffff', accentColor: '#60a5fa' },
  { id: 'dark', label: 'Dark', buttonColor: '#111827', textColor: '#ffffff', iconColor: '#22d3ee', accentColor: '#22d3ee' },
  { id: 'light', label: 'Light', buttonColor: '#ffffff', textColor: '#111827', iconColor: '#eb5054', accentColor: '#ffffff' },
];

export const CTA_ANIMATIONS = [['none', 'Plain button (no animation)'], ...Object.entries(STYLES).map(([id, s]) => [id, s.label])];

export const CTA_LOTTIE_DEFAULTS = {
  animation: 'pulse',
  fontFamily: 'Montserrat',
  textColor: '#ffffff',
};

/** Font size that fits the label inside the button (beside an icon if any). */
function fitSize(label, family, hasIcon) {
  const room = PW - (hasIcon ? 170 : 90);
  let size = 56;
  while (size > 22 && measureText(label, size, family, 700) > room) size -= 2;
  return size;
}

/**
 * Lottie JSON for a CTA clip. `opts`: { animation, buttonText, fontFamily,
 * buttonColor, textColor, iconColor (default: text), accentColor (default:
 * button; the shine sheen defaults to white) }.
 * Returns null for the plain (non-animated) button.
 */
export function buildCtaLottie(opts = {}) {
  const style = STYLES[opts.animation];
  if (!style) return null;
  const label = String(opts.buttonText || 'Call Now').slice(0, 40);
  const family = opts.fontFamily || CTA_LOTTIE_DEFAULTS.fontFamily;
  const bg = hexToRgb01(opts.buttonColor, [0.92, 0.31, 0.33]);
  const fg = hexToRgb01(opts.textColor || CTA_LOTTIE_DEFAULTS.textColor, [1, 1, 1]);
  const ctx = {
    label,
    bg,
    fg,
    icon: hexToRgb01(opts.iconColor, fg),
    accent: hexToRgb01(opts.accentColor, bg),
    shine: hexToRgb01(opts.accentColor, [1, 1, 1]),
    size: fitSize(label, family, !!style.icon),
  };
  return {
    v: '5.7.4',
    fr: CTA_FPS,
    ip: 0,
    op: CTA_OP,
    w: CTA_W,
    h: CTA_H,
    nm: `CTA: ${style.label}`,
    ddd: 0,
    assets: [],
    fonts: { list: [{ fName: 'CTABold', fFamily: family, fStyle: 'Bold', fWeight: '700', ascent: 72 }] },
    layers: style.build(ctx),
    markers: [],
  };
}

/** Box (in % of the frame) a CTA occupies, keeping the 3:1 button aspect. */
export function ctaBox(style = {}, frameAspect = 16 / 9) {
  const w = Math.max(5, Math.min(100, Number(style.posWidth ?? 40)));
  const h = (w * frameAspect) / CTA_ASPECT;
  const cx = Number(style.posLeft ?? 50);
  const cy = Number(style.posTop ?? 50);
  return { left: cx - w / 2, top: cy - h / 2, width: w, height: h };
}
