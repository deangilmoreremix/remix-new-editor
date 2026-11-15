/**
 * Template Generator — the better cut-out engine: BG0 (BiRefNet, WebGPU with a WebAssembly fallback), already used by the Asset Finder.
 * On the photo where the older MODNet model kept 5% of the picture, BG0 keeps the whole person. It works on still images, so for video it
 * is used on sampled frames (the video pipeline in lib/editor/remotion/bgRemoval.js takes a mask function).
 */

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];

/** Re-encode anything the engine does not take (gif, avif, unknown type) as a PNG. */
export async function toSupportedBlob(blob) {
  if (ALLOWED.includes(blob.type)) return blob;
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  bmp.close?.();
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('Could not read the picture'))), 'image/png'));
}

const stageOf = (s) => (s === 'downloading' || s === 'preparing' ? 'download' : 'process');

/** Wrap BG0's client module as { prepare, removeImage, maskFn }. `m` is injected so tests do not load the model. */
export function makeBg0Engine(m) {
  const run = (blob, opts = {}) => m.removeAssetBackground(blob, {
    quality: 'fast',
    signal: opts.signal,
    onProgress: opts.onProgress ? (p) => opts.onProgress({ stage: stageOf(p?.stage), progress: p?.progress ?? 0 }) : undefined,
  });
  return {
    name: 'bg0',
    /** Download and initialise the model ahead of the first frame (one-time, about 190 MB). */
    async prepare() { await m.prefetchBackgroundRemovalModel(); },
    /** @returns {Promise<Blob>} transparent PNG */
    async removeImage(blob, opts) { return (await run(await toSupportedBlob(blob), opts)).blob; },
    /** The alpha (0-255 per pixel) for one video frame, in the frame's own size. */
    async maskFn(imageData) {
      const { width: w, height: h } = imageData;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').putImageData(imageData, 0, 0);
      const png = await new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('Could not read the frame'))), 'image/png'));
      const out = await run(png);
      const bmp = await createImageBitmap(out.blob);
      const r = document.createElement('canvas'); r.width = w; r.height = h;
      const g = r.getContext('2d', { willReadFrequently: true });
      g.drawImage(bmp, 0, 0, w, h);
      bmp.close?.();
      const px = g.getImageData(0, 0, w, h).data;
      const alpha = new Uint8Array(w * h);
      for (let i = 0; i < alpha.length; i += 1) alpha[i] = px[i * 4 + 3];
      return alpha;
    },
  };
}

/** BG0 when this browser can run it, else null (the caller falls back to MODNet). */
export async function loadBg0() {
  try {
    const m = await import('../../../features/personalization/shared/personalization/backgroundRemoval/backgroundRemovalClient.ts');
    return (await m.canRemoveBackgrounds()) ? makeBg0Engine(m) : null;
  } catch {
    return null;
  }
}
