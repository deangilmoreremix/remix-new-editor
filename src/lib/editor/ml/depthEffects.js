/**
 * Depth-based effects (pure pixel math, no model): blur the background behind
 * a subject, and a 2.5D parallax camera move for stills. Depth maps come from
 * Depth Anything V2 (localAI.js), 0 = far, 255 = near.
 */

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / Math.max(1e-6, e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Mix a sharp and a blurred copy of an image by depth: pixels nearer than
 * `focus` stay sharp, farther ones fade to the blurred copy.
 * @param {Uint8ClampedArray} sharp RGBA
 * @param {Uint8ClampedArray} blurred RGBA (same size)
 * @param {Uint8Array} depth one byte per pixel
 * @param {object} opts { focus 0–1 (default 0.55), softness 0–1 (default 0.15) }
 * @returns {Uint8ClampedArray} RGBA
 */
export function mixByDepth(sharp, blurred, depth, { focus = 0.55, softness = 0.15 } = {}) {
  const out = new Uint8ClampedArray(sharp.length);
  const lo = (focus - softness) * 255;
  const hi = (focus + softness) * 255;
  for (let p = 0, n = depth.length; p < n; p += 1) {
    const keep = smoothstep(lo, hi, depth[p]); // 1 = near (sharp)
    const i = p * 4;
    out[i] = blurred[i] + (sharp[i] - blurred[i]) * keep;
    out[i + 1] = blurred[i + 1] + (sharp[i + 1] - blurred[i + 1]) * keep;
    out[i + 2] = blurred[i + 2] + (sharp[i + 2] - blurred[i + 2]) * keep;
    out[i + 3] = sharp[i + 3];
  }
  return out;
}

/**
 * One parallax frame: near pixels shift more than far ones. Backward warp
 * using the destination depth (good enough for gentle moves).
 * @param {Uint8ClampedArray} src RGBA
 * @param {Uint8Array} depth
 * @param {number} w
 * @param {number} h
 * @param {object} move { dx, dy } max shift in pixels for the nearest depth; zoom ≥ 1 hides edges
 */
export function parallaxFrame(src, depth, w, h, { dx = 0, dy = 0, zoom = 1.06 } = {}) {
  const out = new Uint8ClampedArray(src.length);
  const cx = w / 2;
  const cy = h / 2;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = y * w + x;
      const d = depth[p] / 255 - 0.5;
      let sx = cx + (x - cx) / zoom - dx * d;
      let sy = cy + (y - cy) / zoom - dy * d;
      sx = Math.min(w - 1, Math.max(0, Math.round(sx)));
      sy = Math.min(h - 1, Math.max(0, Math.round(sy)));
      const si = (sy * w + sx) * 4;
      const di = p * 4;
      out[di] = src[si]; out[di + 1] = src[si + 1]; out[di + 2] = src[si + 2]; out[di + 3] = src[si + 3];
    }
  }
  return out;
}

/** Camera path for a parallax move: t in [0,1] → { dx, dy, zoom }. */
export function parallaxPath(t, { style = 'orbit', amount = 24 } = {}) {
  const ease = 0.5 - Math.cos(Math.PI * t) / 2;
  if (style === 'push') return { dx: 0, dy: 0, zoom: 1.04 + 0.12 * ease };
  if (style === 'pan') return { dx: amount * (ease * 2 - 1), dy: 0, zoom: 1.08 };
  return { dx: amount * Math.sin(2 * Math.PI * t), dy: (amount / 3) * Math.cos(2 * Math.PI * t), zoom: 1.08 };
}
