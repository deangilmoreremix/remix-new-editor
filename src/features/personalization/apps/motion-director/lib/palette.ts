import type { ManifestTheme } from '../cards/manifest';
import palettes from './palettes.json';

/**
 * Film colours the upstream way (video-shotcraft template/src/themes + THEMES.md): seven semantic
 * colours per palette, a preset per film, and per-clip edits that win over it.
 *
 * Motion Director adds two presets to upstream's eight palettes:
 * - `as-designed`: every recipe keeps the Look it was designed in (the 2026-10 library), like Ink Press upstream.
 * - `site`: the colours read from the captured site (the film's own tokens, SKILL principle 2).
 */
export const PALETTE_KEYS = ['page', 'surface', 'field', 'text', 'muted', 'accent', 'border'] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];
export type Palette = Record<PaletteKey, string>;
/** A palette plus what the product adds beyond colour. */
export type FilmPalette = Partial<Palette> & { accent2?: string; font?: string };

export const AS_DESIGNED = 'as-designed';
export const SITE_THEME = 'site';
export const PRESET_PALETTES = palettes as Record<string, Palette>;

// "中文 · English", the label format the Themes tab reads (i18n themeLabel; upstream themes/manifest.tsx).
const LABELS: Array<[string, string]> = [
  [AS_DESIGNED, '原样 · As designed'],
  [SITE_THEME, '你的网站 · Your site'],
  ['modern-light', '现代浅色 · Modern Light'],
  ['midnight', '暗黑 · Midnight'],
  ['solar-pop', '清新鼠尾草 · Sage'],
  ['coral-burst', '珊瑚点缀 · Coral'],
  ['color-play', '柔和鸢尾 · Iris'],
  ['deep-ocean', '深海蓝 · Deep Ocean'],
  ['obsidian-violet', '黑曜紫 · Obsidian Violet'],
  ['vintage-kraft', '复古牛皮纸 · Vintage Kraft'],
];

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

/** The themes the workbench offers for a director film (THEMES.md presets + the two above). */
export const DIRECTOR_THEMES: ManifestTheme[] = LABELS.map(([id, label]) => {
  const palette = id === AS_DESIGNED ? undefined : PRESET_PALETTES[id === SITE_THEME ? 'modern-light' : id];
  return { id, label, background: palette?.page ?? '#0e0e10', ...(palette ? { palette: { ...palette } } : {}) } as ManifestTheme;
});

/** Keep only valid colours of known keys (same filter as upstream `resolveTheme`). */
export const cleanPalette = (colors: unknown): FilmPalette => {
  if (!colors || typeof colors !== 'object') return {};
  const out: FilmPalette = {};
  for (const [k, v] of Object.entries(colors as Record<string, unknown>)) {
    if ((PALETTE_KEYS as readonly string[]).includes(k) || k === 'accent2') {
      if (isHex(v)) (out as Record<string, string>)[k] = v;
    } else if (k === 'font' && typeof v === 'string' && v.trim() && v.length < 200) out.font = v;
  }
  return out;
};

/**
 * Resolution order, as upstream: the preset, then the film's colours, then this clip's own.
 * `as-designed` with no colours anywhere returns null: the recipe draws in its own look.
 */
export const resolvePalette = (themeId?: unknown, filmColors?: unknown, clipColors?: unknown, sitePalette?: unknown): FilmPalette | null => {
  const id = typeof themeId === 'string' ? themeId : AS_DESIGNED;
  const film = cleanPalette(filmColors);
  const clip = cleanPalette(clipColors);
  const base = themeBase(id, sitePalette) ?? {};
  const out = { ...base, ...film, ...clip };
  return Object.keys(out).length ? out : null;
};

/** The preset palette a theme starts from; "Your site" starts from the colours captured for this film. */
export function themeBase(themeId: string | undefined, sitePalette?: unknown): Palette | null {
  if (!themeId || themeId === AS_DESIGNED) return null;
  if (themeId === SITE_THEME) {
    const site = cleanPalette(sitePalette);
    return PALETTE_KEYS.every((k) => isHex(site[k])) ? (site as Palette) : PRESET_PALETTES['modern-light'];
  }
  return PRESET_PALETTES[themeId] ?? null;
}

// ───────── colour helpers ─────────
const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
export const mixHex = (a: string, b: string, t: number) => {
  if (!isHex(a) || !isHex(b)) return a;
  const x = rgb(a);
  const y = rgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};
export const luma = (hex: string) => {
  if (!isHex(hex)) return 0.5;
  const c = rgb(hex);
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
};
export const isDarkPalette = (p: FilmPalette) => (p.page ? luma(p.page) < 0.5 : null);
const onColor = (hex: string) => (luma(hex) > 0.55 ? '#0b0b0f' : '#ffffff');

/** The roles of a recipe Look (see demosrc/_fixtures/Look.tsx). */
export interface LookRoles {
  dark: boolean;
  bg: [string, string, string];
  light: string;
  surface: string;
  surface2: string;
  line: string;
  ink: string;
  ink2: string;
  ink3: string;
  accent: string;
  accent2: string;
  onAccent: string;
  shadow: string;
}

/**
 * Re-skin one designed Look with a film palette (SKILL principle 2: structure and motion stay,
 * colours follow the product). The recipe's polarity is part of its technique (screen vs multiply,
 * glow on dark ground…), so a palette of the other polarity only brings its accent: the cards say a
 * dark-only recipe on light ground "needs a full re-palette", which a colour swap cannot do.
 */
export function skinLook<T extends LookRoles>(look: T, p: FilmPalette, monochrome = false): T {
  const out: T = { ...look, bg: [...look.bg] as [string, string, string] };
  const accent = isHex(p.accent) ? p.accent : null;
  if (accent) {
    const second = isHex(p.accent2) && p.accent2 !== accent ? p.accent2 : mixHex(accent, luma(accent) > 0.5 ? '#000000' : '#ffffff', 0.35);
    if (monochrome) out.accent2 = accent;
    else {
      out.accent = accent;
      out.accent2 = second;
      out.onAccent = onColor(accent);
      out.light = accent;
    }
  }
  const dark = isDarkPalette(p);
  if (dark === null || dark !== look.dark || !isHex(p.page)) return out;
  const page = p.page;
  const text = isHex(p.text) ? p.text : look.ink;
  out.bg = [dark ? mixHex(page, '#ffffff', 0.05) : mixHex(page, '#ffffff', 0.3), page, mixHex(page, '#000000', dark ? 0.35 : 0.06)];
  out.surface = isHex(p.surface) ? p.surface : dark ? mixHex(page, '#ffffff', 0.06) : '#ffffff';
  out.surface2 = isHex(p.field) ? p.field : dark ? mixHex(page, '#ffffff', 0.12) : mixHex(page, '#000000', 0.04);
  out.ink = text;
  out.ink2 = isHex(p.muted) ? p.muted : mixHex(text, page, 0.35);
  out.ink3 = mixHex(out.ink2, page, 0.45);
  out.line = isHex(p.border) ? p.border : mixHex(text, page, dark ? 0.85 : 0.88);
  return out;
}

/** What the capture read off the site (src/server/browserDiscovery readBrandStyles). */
export interface SiteBrand {
  background?: string | null;
  text?: string | null;
  accent?: string | null;
  surface?: string | null;
  field?: string | null;
  muted?: string | null;
  border?: string | null;
  fontFamily?: string | null;
}

/**
 * The site's own palette (the "Your site" theme): its background, text and action colour, with the
 * other roles read from the page when they belong to the same ground, and derived otherwise.
 */
export function paletteFromBrand(b: SiteBrand | null | undefined): Palette | null {
  if (!b || !isHex(b.background) || !isHex(b.text)) return null;
  const page = b.background;
  const dark = luma(page) < 0.5;
  const near = (c: unknown, limit: number) => isHex(c) && Math.abs(luma(c) - luma(page)) < limit;
  const text = Math.abs(luma(b.text) - luma(page)) > 0.35 ? b.text : dark ? '#f2f4f8' : '#16181d';
  const accent = isHex(b.accent) && Math.abs(luma(b.accent) - luma(page)) > 0.08 ? b.accent : dark ? '#61d9ef' : '#2563eb';
  return {
    page,
    surface: near(b.surface, 0.12) ? (b.surface as string) : dark ? mixHex(page, '#ffffff', 0.06) : mixHex(page, '#ffffff', 0.6),
    field: near(b.field, 0.15) ? (b.field as string) : dark ? mixHex(page, '#ffffff', 0.1) : mixHex(page, '#000000', 0.03),
    text,
    muted: isHex(b.muted) && Math.abs(luma(b.muted) - luma(page)) > 0.2 ? b.muted : mixHex(text, page, 0.38),
    accent,
    border: near(b.border, 0.25) ? (b.border as string) : mixHex(text, page, dark ? 0.82 : 0.86),
  };
}

/** The product's font as a CSS family name, or undefined for a generic stack ("sans-serif" alone says nothing). */
export function siteFont(family: string | null | undefined): string | undefined {
  const first = (family ?? '').split(',')[0]?.trim();
  if (!first || /^(sans-serif|serif|monospace|system-ui|-apple-system|inherit|initial)$/i.test(first.replace(/["']/g, ''))) return undefined;
  return first;
}
