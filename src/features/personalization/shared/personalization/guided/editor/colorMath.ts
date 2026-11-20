/**
 * Pure color helpers for the editor's color popover: hex parsing, RGB <-> HSV, WCAG contrast, an
 * "auto" text color, and a small palette extractor. No DOM, so everything here is unit-tested.
 */
import { contrastRatio, hexLuminance } from '../../preview/placement/geometry';

export interface Rgb { r: number; g: number; b: number }
export interface Hsv { h: number; s: number; v: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const byte = (v: number) => clamp(Math.round(v), 0, 255);

/** '#rgb' / '#rrggbb' (hash optional, any case) -> '#rrggbb', else null. */
export function parseHex(input: string | null | undefined): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((input ?? '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return `#${h.toLowerCase()}`;
}

export function hexToRgb(hex: string): Rgb {
  const h = (parseHex(hex) ?? '#000000').slice(1);
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => byte(v).toString(16).padStart(2, '0')).join('')}`;
}

/** h in [0,360), s and v in [0,1]. */
export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp(s, 0, 1);
  const vv = clamp(v, 0, 1);
  const c = vv * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = vv - c;
  const [r, g, b] =
    hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
  return { r: byte((r + m) * 255), g: byte((g + m) * 255), b: byte((b + m) * 255) };
}

export const hexToHsv = (hex: string): Hsv => rgbToHsv(hexToRgb(hex));
export const hsvToHex = (hsv: Hsv): string => rgbToHex(hsvToRgb(hsv));

/** WCAG contrast ratio between two hex colors (1..21). */
export function contrastBetween(a: string, b: string): number {
  return contrastRatio(hexLuminance(a), hexLuminance(b));
}

export type ContrastGrade = 'AAA' | 'AA' | 'large-text' | 'low'

export function gradeContrast(ratio: number): ContrastGrade {
  return ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'large-text' : 'low';
}

/** White or near-black, whichever reads better on `backdrop`. */
export function autoTextColor(backdrop: string, dark = '#000000'): string {
  return contrastBetween('#ffffff', backdrop) >= contrastBetween(dark, backdrop) ? '#ffffff' : dark;
}

/** Average color of an RGBA buffer (hex), ignoring transparent pixels. Null for an empty/transparent buffer. */
export function averageColor(data: ArrayLike<number>): string | null {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 16) continue;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  return n ? rgbToHex({ r: r / n, g: g / n, b: b / n }) : null;
}

/**
 * The `count` most common distinct colors of an RGBA buffer. Colors are bucketed to 4 bits per
 * channel, counted, and a color is skipped when it is too close to one already picked, so the result
 * is a spread of different colors and not five shades of one.
 */
export function extractPalette(data: ArrayLike<number>, count = 5, minDistance = 48): string[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key);
    if (e) { e.n++; e.r += r; e.g += g; e.b += b; } else buckets.set(key, { n: 1, r, g, b });
  }
  const ranked = [...buckets.values()].sort((a, b) => b.n - a.n);
  const picked: Rgb[] = [];
  for (const e of ranked) {
    const c = { r: e.r / e.n, g: e.g / e.n, b: e.b / e.n };
    if (picked.every((p) => Math.hypot(p.r - c.r, p.g - c.g, p.b - c.b) >= minDistance)) picked.push(c);
    if (picked.length >= count) break;
  }
  return picked.map(rgbToHex);
}

/** Recently used colors: newest first, unique, valid hex only, capped. */
export function pushRecent(list: readonly string[], color: string, max = 8): string[] {
  const hex = parseHex(color);
  if (!hex) return [...list];
  return [hex, ...list.filter((c) => c !== hex)].slice(0, max);
}
