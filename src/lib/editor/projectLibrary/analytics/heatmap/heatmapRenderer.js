/**
 * Small canvas radial-gradient heatmap renderer (Stage 7).
 *
 * Adapted from the approach of heatmap.js by Patrick Wied (pa7/heatmap.js @ 4e64f5ae5754c84fea363f0fcf24bea4795405ff,
 * MIT licence, (c) 2015 Patrick Wied; see docs/stage-7/STAGE_7_REPORT.md): every point is drawn as a black radial
 * gradient whose alpha follows its value into a greyscale "shadow" canvas, then each pixel's alpha indexes a
 * 256-colour gradient palette. Only the technique is reused; this is a fresh implementation (no upstream code, no npm
 * dependency) with what the upstream lacks: normalized 0..1 coordinates, device-pixel-ratio handling and pure,
 * unit-testable math (palette, alpha, colorize) that does not need a canvas.
 */

// heatmap.js default gradient (value stop -> colour).
export const DEFAULT_GRADIENT = Object.freeze({ 0.25: [0, 0, 255], 0.55: [0, 255, 0], 0.85: [255, 255, 0], 1.0: [255, 0, 0] });

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** 256 x RGBA lookup table interpolated linearly between gradient stops. Pure. */
export function buildPalette(gradient = DEFAULT_GRADIENT) {
  const stops = Object.keys(gradient).map(Number).filter((k) => k >= 0 && k <= 1).sort((a, b) => a - b);
  const out = new Uint8ClampedArray(256 * 4);
  if (!stops.length) return out;
  for (let i = 0; i < 256; i += 1) {
    const t = i / 255;
    let lo = stops[0]; let hi = stops[stops.length - 1];
    for (const s of stops) { if (s <= t) lo = s; if (s >= t) { hi = s; break; } }
    const a = gradient[lo]; const b = gradient[hi];
    const f = hi === lo ? 0 : (t - lo) / (hi - lo);
    out[i * 4] = a[0] + (b[0] - a[0]) * f;
    out[i * 4 + 1] = a[1] + (b[1] - a[1]) * f;
    out[i * 4 + 2] = a[2] + (b[2] - a[2]) * f;
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Normalized (0..1) point -> pixel position on a w x h canvas (CSS px). Pure. */
export const toPixel = (p, w, h) => ({ x: clamp(p.x, 0, 1) * w, y: clamp(p.y, 0, 1) * h });

/** Point weight -> drawing alpha for the shadow canvas (value / max, scaled by intensity, kept visible). Pure. */
export function pointAlpha(value, max, { intensity = 1, minOpacity = 0.05 } = {}) {
  if (!(max > 0) || !(value > 0)) return 0;
  return clamp((value / max) * intensity, minOpacity, 1);
}

/** Default blob radius in CSS px for a canvas size (about 4% of the shorter side, at least 10 px). */
export const defaultRadius = (w, h) => Math.max(10, Math.round(Math.min(w, h) * 0.04));

/**
 * Colorize the greyscale shadow in place: the alpha channel selects a palette colour; output alpha is the shadow alpha
 * scaled into [minOpacity, maxOpacity] (255 scale). Pure: works on any Uint8ClampedArray of RGBA.
 */
export function colorize(data, palette, { minOpacity = 0, maxOpacity = 255 } = {}) {
  for (let i = 3; i < data.length; i += 4) {
    const alpha = data[i];
    if (!alpha) continue;
    const o = alpha * 4;
    data[i - 3] = palette[o];
    data[i - 2] = palette[o + 1];
    data[i - 1] = palette[o + 2];
    data[i] = clamp(Math.max(alpha, minOpacity) , 0, maxOpacity);
  }
  return data;
}

/** Largest weight in a list of {value}. */
export const maxValue = (points) => points.reduce((m, p) => (p.value > m ? p.value : m), 0);

/**
 * Draw points onto a canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {{x:number,y:number,value:number}[]} points  x/y normalized 0..1
 * @param {object} o  { width, height (CSS px), dpr, radius, blur, intensity, gradient, maxOpacity }
 * @returns {boolean} false when 2D canvas is unavailable (nothing drawn)
 */
export function renderHeatmap(canvas, points, o = {}) {
  const width = Math.max(1, Math.round(o.width ?? canvas.clientWidth ?? 300));
  const height = Math.max(1, Math.round(o.height ?? canvas.clientHeight ?? 150));
  const dpr = clamp(o.dpr ?? globalThis.devicePixelRatio ?? 1, 1, 3);
  const doc = canvas.ownerDocument || globalThis.document;
  let ctx = null;
  try { ctx = canvas.getContext('2d'); } catch { ctx = null; }
  if (!ctx) return false;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!points.length) return true;

  const radius = (o.radius ?? defaultRadius(width, height)) * dpr;
  const blur = clamp(o.blur ?? 0.85, 0, 1);
  const max = o.max ?? maxValue(points);
  const shadow = doc.createElement('canvas');
  shadow.width = canvas.width; shadow.height = canvas.height;
  const sctx = shadow.getContext('2d');
  if (!sctx) return false;

  // One radial-gradient "brush" per point: opaque centre fading to transparent edge (blur controls the fall-off).
  const brush = doc.createElement('canvas');
  const size = Math.ceil(radius * 2);
  brush.width = size; brush.height = size;
  const bctx = brush.getContext('2d');
  const g = bctx.createRadialGradient(radius, radius, radius * (1 - blur) * 0.5, radius, radius, radius);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  bctx.fillStyle = g;
  bctx.fillRect(0, 0, size, size);

  for (const p of points) {
    const a = pointAlpha(p.value, max, { intensity: o.intensity ?? 1 });
    if (!a) continue;
    const px = toPixel(p, canvas.width, canvas.height);
    sctx.globalAlpha = a;
    sctx.drawImage(brush, px.x - radius, px.y - radius);
  }
  const img = sctx.getImageData(0, 0, shadow.width, shadow.height);
  colorize(img.data, buildPalette(o.gradient), { maxOpacity: Math.round(255 * (o.maxOpacity ?? 0.9)) });
  ctx.putImageData(img, 0, 0);
  return true;
}
