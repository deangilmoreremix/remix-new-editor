// [remix] Fix C: colour conversions for the inspector colour picker. Pure.
// Colour props are [r, g, b] in 0..1; gradient-map stops are hue (0..360) / sat / val sliders, converted with the same formula as the shader's hsv().
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export type Rgb = [number, number, number];

export function rgbToHex(c: ArrayLike<number>): string {
  return `#${[0, 1, 2].map((i) => Math.round(clamp01(Number.isFinite(c[i]) ? c[i] : 0) * 255).toString(16).padStart(2, '0')).join('')}`;
}
export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
/** Same maths as gradient-map.frag's hsv(h, s, v). */
export function hsvToRgb(h: number, s: number, v: number): Rgb {
  const k = (n: number) => { const x = (((h / 60 + n) % 6) + 6) % 6; return clamp01(Math.abs(x - 3) - 1); };
  const ks = [k(0), k(4), k(2)];
  return ks.map((kk) => v * (1 + (kk - 1) * s)) as Rgb;
}
export function rgbToHsv([r, g, b]: Rgb): { h: number; s: number; v: number } {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 1e-9) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: Math.round(h * 60 * 100) / 100, s: max <= 1e-9 ? 0 : d / max, v: max };
}
