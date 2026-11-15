/**
 * Turns a render with an alpha channel into a still that shows what the animation is.
 *
 * An animation is often a small element (a lower third, a name bar, an icon) or dark type on a transparent background. Shot over a dark
 * frame it vanishes. Here the element is cropped to its own bounds, enlarged to fill most of a 16:9 tile, and placed on a backdrop that
 * contrasts with it (light behind dark artwork, the app's dark behind light artwork). Fully opaque renders (scenes, backgrounds,
 * full-frame effects) keep their whole frame. A sparse full-frame overlay (a HUD, a frame, scan lines) is shown over a real photo, so
 * you can see what it does to footage.
 *
 *   composeStill(pngBuffer) → { jpeg: Buffer|null, kind: 'empty' | 'opaque' | 'cropped', coverage, backdrop }
 */
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('sharp');

export const TILE = { w: 480, h: 270 };
export const BACKDROP = { dark: '#0b0f16', light: '#e9edf4' };
const ALPHA_ON = 24;           // a pixel counts as drawn above this alpha
const FILL = 0.82;             // the element fills this much of the tile
const MAX_ZOOM = 1.6;          // never enlarge the rendered pixels more than this (it would turn to mush)
const hex = (h) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });

/** @param {Buffer} input PNG (or any image) with alpha, rendered over a transparent page */
/** @param {{ photo?: Buffer }} opts photo: a real picture to show sparse overlays over */
export async function composeStill(input, { jpegQuality = 85, photo = null } = {}) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  let minX = W, minY = H, maxX = -1, maxY = -1, drawn = 0, dark = 0, lumSum = 0;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < ALPHA_ON) continue;
      drawn += 1;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      lumSum += lum;
      if (lum < 70) dark += 1;
    }
  }
  const coverage = drawn / (W * H);
  // a handful of stray pixels is not a picture
  if (drawn < 40 || coverage < 0.0004) return { jpeg: null, kind: 'empty', coverage, backdrop: null };

  const bg = (name) => hex(BACKDROP[name]);
  const flat = (name) => ({ create: { width: TILE.w, height: TILE.h, channels: 3, background: bg(name) } });

  // a (nearly) full frame: keep it whole, on the dark tile colour
  if (coverage > 0.9) {
    const whole = await sharp(input).flatten({ background: bg('dark') }).resize(TILE.w, TILE.h, { fit: 'contain', background: bg('dark') }).jpeg({ quality: jpegQuality }).toBuffer();
    return { jpeg: whole, kind: 'opaque', coverage, backdrop: 'dark' };
  }

  // a sparse overlay that spans the frame (HUD marks, borders, scan lines): over a real photo, whole
  const spansFrame = (maxX - minX) / W > 0.6 && (maxY - minY) / H > 0.6;
  if (spansFrame && coverage < 0.25 && photo) {
    const base = await sharp(photo).resize(TILE.w, TILE.h, { fit: 'cover' }).modulate({ brightness: 0.85 }).toBuffer();
    const layer = await sharp(input).resize(TILE.w, TILE.h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    return { jpeg: await sharp(base).composite([{ input: layer }]).jpeg({ quality: jpegQuality }).toBuffer(), kind: 'overlay', coverage, backdrop: 'photo' };
  }

  // a small element: crop to its bounds (with a little air), enlarge, and put it on a contrasting backdrop
  const bw = maxX - minX + 1; const bh = maxY - minY + 1;
  const pad = Math.max(6, Math.round(Math.max(bw, bh) * 0.04));
  const left = Math.max(0, minX - pad); const top = Math.max(0, minY - pad);
  const cw = Math.min(W - left, bw + pad * 2); const ch = Math.min(H - top, bh + pad * 2);
  // light artwork reads on the dark tile; anything with real dark areas (dark bars, black type) needs the light one
  const backdrop = dark / drawn > 0.25 || lumSum / drawn < 90 ? 'light' : 'dark';
  const k = Math.min((TILE.w * FILL) / cw, (TILE.h * FILL) / ch, MAX_ZOOM);
  const outW = Math.max(1, Math.round(cw * k)); const outH = Math.max(1, Math.round(ch * k));
  const piece = await sharp(input).extract({ left, top, width: cw, height: ch }).resize(outW, outH, { kernel: 'lanczos3' }).png().toBuffer();
  const jpeg = await sharp(flat(backdrop)).composite([{ input: piece, gravity: 'centre' }]).jpeg({ quality: jpegQuality }).toBuffer();
  return { jpeg, kind: 'cropped', coverage, backdrop };
}

/** Share of a (jpeg) still that differs from its dominant tone: ~0 for an empty-looking tile. Used to find stills that need redoing. */
export async function contentShare(input) {
  const { data } = await sharp(input).greyscale().resize(64, 36).raw().toBuffer({ resolveWithObject: true });
  const sorted = [...data].sort((a, b) => a - b);
  const med = sorted[sorted.length >> 1];
  let n = 0;
  for (const v of data) if (Math.abs(v - med) > 25) n += 1;
  return n / data.length;
}
