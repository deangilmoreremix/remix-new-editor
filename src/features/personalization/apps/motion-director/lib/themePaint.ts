/**
 * Re-skin for recipes that draw in colours of their own instead of the Look roles (upstream
 * template/themes `themePaint`, THEMES.md): each colour a recipe draws is given a role by what it is —
 * the page ground, a surface, the text, muted text, a border, or the accent — and drawn in the film's
 * colour for that role. Warm light is lighting, not accent, and stays; a colour of no clear role stays.
 * A recipe designed on the other ground than the film's (a dark recipe in a light film) only takes the
 * accent, like `skinLook` (its blend modes and glows are tuned to its own ground).
 *
 * It runs on the recipe's rendered elements after every commit (inline styles and SVG paint
 * attributes), so preview, stills and the export agree. Colours already in the palette are left alone,
 * which keeps it idempotent across frames.
 */
import type { FilmPalette } from './palette';

type Ground = 'dark' | 'light';
interface RGBA { r: number; g: number; b: number; a: number }

const parseHex = (h: string): RGBA | null => {
  const m = /^#([0-9a-f]{3,8})$/i.exec(h.trim());
  if (!m) return null;
  let s = m[1];
  if (s.length === 3 || s.length === 4) s = [...s].map((c) => c + c).join('');
  if (s.length !== 6 && s.length !== 8) return null;
  const n = (i: number) => parseInt(s.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: s.length === 8 ? n(6) / 255 : 1 };
};

function hsl({ r, g, b }: RGBA): { h: number; s: number; l: number } {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

export type PaintRole = 'page' | 'surface' | 'text' | 'muted' | 'border' | 'accent' | null;

/** The role a colour plays in a recipe designed on a `ground` of this kind. */
export function paintRole(c: RGBA, ground: Ground): PaintRole {
  const { h, s, l } = hsl(c);
  if (s > 0.35 && l > 0.18 && l < 0.88) {
    // Warm light (amber / gold highlights) is the stage's lighting, not the brand.
    if (h >= 25 && h <= 55 && l > 0.62) return null;
    return 'accent';
  }
  if (s > 0.35) return null;
  if (ground === 'dark') {
    if (l < 0.11) return 'page';
    if (l < 0.26) return 'surface';
    if (l < 0.42) return 'border';
    if (l < 0.78) return 'muted';
    return 'text';
  }
  if (l > 0.94) return 'page';
  if (l > 0.84) return 'surface';
  if (l > 0.62) return 'border';
  if (l > 0.3) return 'muted';
  return 'text';
}

const rgbOf = (hex: string): RGBA | null => parseHex(hex);
const out = (c: RGBA, a: number) => (a >= 1 ? `rgb(${c.r}, ${c.g}, ${c.b})` : `rgba(${c.r}, ${c.g}, ${c.b}, ${+a.toFixed(3)})`);

export interface Painter {
  /** A colour token (hex / rgb() / rgba()) repainted, or the token as it was. */
  color: (token: string) => string;
  /** Every colour token in a CSS value (gradients, shadows) repainted. */
  value: (css: string) => string;
}

const TOKEN = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)/g;

export function makePainter(p: FilmPalette, ground: Ground): Painter | null {
  const filmDark = p.page ? hsl(rgbOf(p.page) ?? { r: 0, g: 0, b: 0, a: 1 }).l < 0.5 : null;
  const sameGround = filmDark === null ? false : filmDark === (ground === 'dark');
  const roles: Partial<Record<Exclude<PaintRole, null>, RGBA>> = {};
  const set = (role: Exclude<PaintRole, null>, hex: string | undefined) => {
    const c = hex ? rgbOf(hex) : null;
    if (c) roles[role] = c;
  };
  set('accent', p.accent);
  if (sameGround) {
    set('page', p.page);
    set('surface', p.surface ?? p.field);
    set('text', p.text);
    set('muted', p.muted);
    set('border', p.border);
  }
  if (!Object.keys(roles).length) return null;
  const mine = new Set(Object.values(roles).map((c) => `${c!.r},${c!.g},${c!.b}`));
  const color = (token: string): string => {
    let c: RGBA | null = null;
    if (token.startsWith('#')) c = parseHex(token);
    else {
      const n = token.match(/[\d.]+/g)?.map(Number) ?? [];
      if (n.length >= 3) c = { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 };
    }
    if (!c || c.a === 0) return token;
    if (mine.has(`${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)}`)) return token;
    const role = paintRole(c, ground);
    const to = role ? roles[role] : undefined;
    return to ? out(to, c.a) : token;
  };
  return { color, value: (css) => css.replace(TOKEN, color) };
}

const SVG_PAINT = ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color'];

/** Repaint the inline colours under `root` (elements' style attributes and SVG paint attributes). */
export function applyPaint(root: Element, painter: Painter): void {
  const all = root.querySelectorAll('*');
  const visit = (el: Element) => {
    const style = el.getAttribute('style');
    if (style && TOKEN.test(style)) {
      TOKEN.lastIndex = 0;
      const next = painter.value(style);
      if (next !== style) el.setAttribute('style', next);
    }
    TOKEN.lastIndex = 0;
    for (const a of SVG_PAINT) {
      const v = el.getAttribute(a);
      if (v && v !== 'none' && !v.startsWith('url(')) {
        const next = painter.value(v);
        if (next !== v) el.setAttribute(a, next);
      }
    }
  };
  visit(root);
  all.forEach(visit);
}
