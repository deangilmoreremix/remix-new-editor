// src/lib/outreach/thumbnailPick.js
//
// Suggest good thumbnail moments (requirement 22). Plain image statistics on frames you already sampled:
// sharpness (variance of a Laplacian on brightness), exposure (how close the average brightness is to mid-grey)
// and contrast. It ranks frames to look at; it does NOT detect faces and does NOT predict opens or conversions.
//
// A frame is ImageData-like: { data: Uint8ClampedArray (RGBA), width, height }.

const luma = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

/** @returns {{ sharpness:number, brightness:number, contrast:number }} brightness 0-255, contrast = std dev of brightness. */
export function frameStats(img, { step = 1 } = {}) {
  const { data, width, height } = img || {};
  if (!data || !width || !height) return { sharpness: 0, brightness: 0, contrast: 0 };
  const L = new Float32Array(width * height);
  for (let p = 0, i = 0; p < L.length; p += 1, i += 4) L[p] = luma(data, i);
  let sum = 0; let sumSq = 0; let n = 0;
  for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) { const v = L[y * width + x]; sum += v; sumSq += v * v; n += 1; }
  const mean = sum / Math.max(1, n);
  const contrast = Math.sqrt(Math.max(0, sumSq / Math.max(1, n) - mean * mean));
  let lapSum = 0; let lapSq = 0; let m = 0;
  for (let y = 1; y < height - 1; y += step) {
    for (let x = 1; x < width - 1; x += step) {
      const c = y * width + x;
      const v = 4 * L[c] - L[c - 1] - L[c + 1] - L[c - width] - L[c + width];
      lapSum += v; lapSq += v * v; m += 1;
    }
  }
  const lapMean = lapSum / Math.max(1, m);
  return { sharpness: Math.max(0, lapSq / Math.max(1, m) - lapMean * lapMean), brightness: mean, contrast };
}

/** 0-100, and the plain-words reasons. */
export function scoreFrame(stats) {
  const { sharpness = 0, brightness = 0, contrast = 0 } = stats || {};
  const sharp = Math.min(1, sharpness / 300);
  const exposure = Math.max(0, 1 - Math.abs(brightness - 120) / 120);
  const contr = Math.min(1, contrast / 60);
  const reasons = [];
  reasons.push(sharp >= 0.5 ? 'sharp' : 'soft or blurry');
  if (brightness < 50) reasons.push('too dark'); else if (brightness > 205) reasons.push('too bright'); else reasons.push('well lit');
  if (contr < 0.3) reasons.push('flat, low contrast');
  return { score: Math.round(sharp * 50 + exposure * 35 + contr * 15), reasons };
}

/**
 * Rank sampled frames, best first.
 * @param {{ time:number, image:object }[]} frames
 */
export function rankFrames(frames) {
  return (Array.isArray(frames) ? frames : [])
    .map((f) => { const stats = frameStats(f.image); return { time: f.time, stats, ...scoreFrame(stats) }; })
    .sort((a, b) => b.score - a.score || a.time - b.time);
}

/** Evenly spaced moments to sample: skips the first and last 5% (fade-ins, the end card). */
export function sampleTimes(duration, count = 8) {
  const d = Number(duration) || 0;
  if (d <= 0) return [0];
  const from = d * 0.05; const to = d * 0.95;
  if (count <= 1) return [Math.round(((from + to) / 2) * 10) / 10];
  return Array.from({ length: count }, (_, i) => Math.round((from + ((to - from) * i) / (count - 1)) * 10) / 10);
}
