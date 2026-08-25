// video-frame-worker.js
// OffscreenCanvas worker: applies per-frame transforms for in-browser video
// processing (color-correct, upscale, create-shorts, stabilize).
//
// The main thread owns a <video> for decoding and a <canvas> whose control is
// transferred here. We draw transformed frames that the main thread records via
// canvas.captureStream() + MediaRecorder (Option A — zero dependencies, WebM).

let canvas = null;
let ctx = null;
let outW = 0;
let outH = 0;

// Stabilization state (center-of-gravity deshake approximation).
let stabilize = false;
let drawScale = 1; // zoom factor to hide edges after translation
let offX = 0;
let offY = 0; // smoothed corrective offset (px)
let prevCentroid = null;

// Small offscreen used only to estimate the luminance centroid cheaply.
let sampleCanvas = null;
let sampleCtx = null;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function ensureSample() {
  if (!sampleCanvas) {
    sampleCanvas = new OffscreenCanvas(64, 64);
    sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  }
}

function computeCentroid(bmp) {
  ensureSample();
  try {
    sampleCtx.drawImage(bmp, 0, 0, 64, 64);
    const { data } = sampleCtx.getImageData(0, 0, 64, 64);
    let sx = 0;
    let sy = 0;
    let s = 0;
    const n = 64 * 64;
    for (let i = 0; i < n; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      const x = i % 64;
      const y = (i / 64) | 0;
      sx += l * x;
      sy += l * y;
      s += l;
    }
    if (s === 0) return null;
    return { x: sx / s / 64, y: sy / s / 64 };
  } catch (_) {
    return null;
  }
}

self.onmessage = (e) => {
  const msg = e.data;

  if (msg.type === 'init') {
    canvas = msg.canvas;
    ctx = canvas.getContext('2d', { alpha: false });
    outW = canvas.width;
    outH = canvas.height;
    stabilize = !!msg.stabilize;
    drawScale = stabilize ? 1.15 : 1;
    offX = offY = 0;
    prevCentroid = null;
    self.postMessage({ type: 'ready' });
    return;
  }

  if (msg.type === 'frame') {
    const bmp = msg.bitmap;
    const t = msg.transform || {};
    if (!ctx || !bmp) {
      if (bmp && bmp.close) bmp.close();
      return;
    }
    try {
      ctx.save();
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, outW, outH);

      // Color correction via CSS-style filter string.
      const f = [];
      if (t.brightness != null) f.push(`brightness(${clamp(1 + Number(t.brightness), 0, 2)})`);
      if (t.contrast != null) f.push(`contrast(${clamp(Number(t.contrast), 0, 2)})`);
      if (t.saturation != null) f.push(`saturate(${clamp(Number(t.saturation), 0, 2)})`);
      ctx.filter = f.length ? f.join(' ') : 'none';

      // Stabilization: track luminance centroid, counter the motion.
      let tx = 0;
      let ty = 0;
      if (stabilize) {
        const c = computeCentroid(bmp);
        if (c && prevCentroid) {
          const dx = (c.x - prevCentroid.x) * outW * drawScale;
          const dy = (c.y - prevCentroid.y) * outH * drawScale;
          offX = clamp(offX - dx * 0.7, -outW * 0.1, outW * 0.1);
          offY = clamp(offY - dy * 0.7, -outH * 0.1, outH * 0.1);
        }
        if (c) prevCentroid = c;
        tx = offX;
        ty = offY;
      }

      const srcRatio = bmp.width / bmp.height;

      if (t.crop === '9:16' || t.crop === '1:1') {
        // Cover-fit into the target aspect (no letterbox), centered crop.
        const targetRatio = t.crop === '9:16' ? 9 / 16 : 1;
        let dw;
        let dh;
        if (srcRatio > targetRatio) {
          dh = outH;
          dw = outH * srcRatio;
        } else {
          dw = outW;
          dh = outW / srcRatio;
        }
        const dx = (outW - dw) / 2;
        const dy = (outH - dh) / 2;
        ctx.drawImage(bmp, dx, dy, dw, dh);
      } else {
        // Contain-fit with optional stabilize zoom/offset.
        const dstRatio = outW / outH;
        let dw;
        let dh;
        const scaledW = outW * drawScale;
        const scaledH = outH * drawScale;
        if (srcRatio > dstRatio) {
          dh = scaledH;
          dw = scaledH * srcRatio;
        } else {
          dw = scaledW;
          dh = scaledW / srcRatio;
        }
        const dx = (outW - dw) / 2 + tx;
        const dy = (outH - dh) / 2 + ty;
        ctx.drawImage(bmp, dx, dy, dw, dh);
      }

      ctx.restore();
    } catch (err) {
      try {
        ctx.filter = 'none';
        ctx.drawImage(bmp, 0, 0, outW, outH);
      } catch (_) {
        /* ignore */
      }
    } finally {
      if (bmp && bmp.close) bmp.close();
    }
  }

  if (msg.type === 'close') {
    try {
      if (canvas && canvas.close) canvas.close();
    } catch (_) {
      /* ignore */
    }
    self.close();
  }
};
