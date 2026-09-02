// packages/assets/src/extractors/colors.ts
//
// Extract brand colors from a website's HTML. We try, in order of
// reliability:
//   1. <meta name="theme-color">         — browser chrome color (mobile)
//   2. <meta name="msapplication-TileColor">
//   3. <link rel="mask-icon"> color attr  — Safari pinned-tab color
//   4. Inline <style> blocks             — first color values used in :root
//   5. <meta name="color-scheme">
//   6. OpenAI vision model (if API key + image URL)
//
// The primary/secondary/accent heuristic uses a simple frequency count
// of CSS color tokens (hex, rgb, hsl) found in the first <style> block,
// filtered to remove low-saturation / very-dark / very-light values
// that are likely background/foreground.

import type { DiscoveredAsset } from '../types.ts';

export interface ColorExtraction {
  primary?: string;
  secondary?: string;
  accent?: string;
  allColors: Array<{ color: string; source: string; count: number }>;
  fromThemeColor?: string;
}

const HEX_RE = /#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi;
const RGB_RE = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi;
const HSL_RE = /hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%/gi;

export function extractColorsFromHtml(html: string): ColorExtraction {
  const out: ColorExtraction = { allColors: [] };

  // 1. <meta name="theme-color">
  const theme = matchAttr(html, /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i, 'content');
  if (theme) {
    const norm = normalizeColor(theme);
    if (norm) {
      out.fromThemeColor = norm;
      out.primary = norm;
      out.allColors.push({ color: norm, source: 'theme-color', count: 1 });
    }
  }

  // 2. msapplication-TileColor
  const tile = matchAttr(html, /<meta[^>]+name=["']msapplication-TileColor["'][^>]+content=["']([^"']+)["']/i, 'content');
  if (tile) {
    const norm = normalizeColor(tile);
    if (norm) out.allColors.push({ color: norm, source: 'msapplication-TileColor', count: 1 });
  }

  // 3. mask-icon color
  const mask = matchAttr(html, /<link[^>]+rel=["']mask-icon["'][^>]+color=["']([^"']+)["']/i, 'color');
  if (mask) {
    const norm = normalizeColor(mask);
    if (norm) out.allColors.push({ color: norm, source: 'mask-icon', count: 1 });
  }

  // 4. Parse the first <style> block(s) for color tokens
  const styles = collectStyleBlocks(html);
  const freq = new Map<string, number>();
  for (const css of styles) {
    for (const m of css.matchAll(HEX_RE)) {
      const norm = normalizeColor(`#${m[1]}`);
      if (norm && isBrandWorthy(norm)) freq.set(norm, (freq.get(norm) || 0) + 1);
    }
    for (const m of css.matchAll(RGB_RE)) {
      const r = +m[1], g = +m[2], b = +m[3];
      const norm = rgbToHex(r, g, b);
      if (norm && isBrandWorthy(norm)) freq.set(norm, (freq.get(norm) || 0) + 1);
    }
    for (const m of css.matchAll(HSL_RE)) {
      const h = +m[1], s = +m[2], l = +m[3];
      const norm = hslToHex(h, s, l);
      if (norm && isBrandWorthy(norm)) freq.set(norm, (freq.get(norm) || 0) + 1);
    }
  }

  const sorted = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([color, count]) => ({ color, source: 'inline-css', count }));
  for (const c of sorted) out.allColors.push(c);

  // 5. Heuristic: primary/secondary/accent
  if (!out.primary && sorted[0]) out.primary = sorted[0].color;
  if (!out.secondary && sorted[1]) out.secondary = sorted[1].color;
  if (!out.accent) {
    // pick the first color that is NOT too close to primary
    for (const c of sorted) {
      if (c.color !== out.primary && colorDistance(c.color, out.primary || '#000000') > 80) {
        out.accent = c.color;
        break;
      }
    }
  }

  return out;
}

/**
 * Update a ContactProfile-style brand.colors object in place.
 */
export function mergeIntoBrandColors(
  brand: { colors?: { primary?: string; secondary?: string; accent?: string } } | undefined,
  extraction: ColorExtraction,
): { primary?: string; secondary?: string; accent?: string } {
  const merged = { ...(brand?.colors || {}) };
  if (!merged.primary && extraction.primary) merged.primary = extraction.primary;
  if (!merged.secondary && extraction.secondary) merged.secondary = extraction.secondary;
  if (!merged.accent && extraction.accent) merged.accent = extraction.accent;
  return merged;
}

function normalizeColor(raw: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{8}$/.test(s)) return s.slice(0, 7);
  // Named colors that are common
  const named: Record<string, string> = {
    black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
    blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff',
  };
  if (named[s]) return named[s];
  return undefined;
}

function isBrandWorthy(hex: string): boolean {
  // Reject very near-black, very near-white, and very low saturation
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  if (luma < 25 || luma > 235) return false; // too dark or too light
  if (max - min < 12) return false; // too gray
  return true;
}

function colorDistance(a: string, b: string): number {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const dr = ca.r - cb.r;
  const dg = ca.g - cb.g;
  const db = ca.b - cb.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '');
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hslToHex(h: number, s: number, l: number): string {
  // h in [0,360], s and l in [0,100]
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hh < 1) { r = c; g = x; b = 0; }
  else if (hh < 2) { r = x; g = c; b = 0; }
  else if (hh < 3) { r = 0; g = c; b = x; }
  else if (hh < 4) { r = 0; g = x; b = c; }
  else if (hh < 5) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const m = lN - c / 2;
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function matchAttr(html: string, re: RegExp, group: number = 1): string | undefined {
  const m = html.match(re);
  return m ? m[group] : undefined;
}

function collectStyleBlocks(html: string): string[] {
  const blocks: string[] = [];
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    if (m[1]) blocks.push(m[1]);
  }
  return blocks;
}
