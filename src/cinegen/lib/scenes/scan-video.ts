// [remix] Stage 4: browser side of scene detection: sample a video's frames on a canvas (seek + drawImage, small frames), build histograms,
// find cuts (histogram-cuts.ts), refine each to about one frame, cut thumbnails. Cancellable with an AbortSignal. [remix] Fix B3: runs in a Web Worker
// (WebCodecs through mediabunny, OffscreenCanvas; scan-worker.ts) when the browser has them, otherwise on the main thread with a yield between frames.
import { rgbHistogram } from './histogram-cuts';
import type { SceneInfo } from './scenes';
import { abortError, scanWithSampler, type ScanOptions, type VideoSampler } from './scan-core';
import { canScanInWorker, scanScenesInWorker } from './scan-worker-client';
export type { ScanOptions, VideoSampler };
export { scanWithSampler };

export async function openSampler(src: string, signal?: AbortSignal, sampleWidth = 64): Promise<VideoSampler> {
  if (signal?.aborted) throw abortError();
  const v = document.createElement('video');
  v.muted = true; v.preload = 'auto'; v.playsInline = true; v.crossOrigin = 'anonymous';
  v.src = src;
  await new Promise<void>((res, rej) => {
    const t = window.setTimeout(() => rej(new Error('Timed out opening the video.')), 30000);
    v.onloadeddata = () => { clearTimeout(t); res(); };
    v.onerror = () => { clearTimeout(t); rej(new Error('This media could not be opened for scene detection.')); };
    signal?.addEventListener('abort', () => { clearTimeout(t); rej(abortError()); }, { once: true });
  });
  const seek = (t: number) => new Promise<void>((res) => {
    const target = Math.min(Math.max(0, t), Math.max(0, (v.duration || 0) - 0.001));
    if (Math.abs(v.currentTime - target) < 1e-4 && v.readyState >= 2) return res();
    const done = () => { v.removeEventListener('seeked', done); clearTimeout(to); res(); };
    const to = window.setTimeout(done, 5000);
    v.addEventListener('seeked', done);
    v.currentTime = target;
  });
  const draw = (w: number) => {
    const h = Math.max(1, Math.round((w * (v.videoHeight || 9)) / (v.videoWidth || 16)));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(v, 0, 0, w, h);
    return { c, ctx, w, h };
  };
  return {
    duration: v.duration, width: v.videoWidth, height: v.videoHeight,
    async histAt(t) { await seek(t); const { ctx, w, h } = draw(sampleWidth); return rgbHistogram(ctx.getImageData(0, 0, w, h).data); },
    async thumbAt(t, maxW = 160) { await seek(t); return draw(maxW).c.toDataURL('image/jpeg', 0.7); },
    dispose() { v.removeAttribute('src'); v.load(); },
  };
}

/** Detect scenes of one video. Throws AbortError when cancelled. Uses the worker when available (and falls back to the main thread if it cannot run). */
export async function scanScenes(assetId: string, src: string, opts: ScanOptions = {}): Promise<SceneInfo[]> {
  if (opts.useWorker !== false && canScanInWorker()) {
    try { return await scanScenesInWorker(assetId, src, opts); } catch (e) {
      if ((e as { name?: string } | null)?.name === 'AbortError' || opts.signal?.aborted) throw e;
      console.info('[scenes] worker scan unavailable, scanning on the main thread:', (e as Error)?.message);
    }
  }
  const sampler = await openSampler(src, opts.signal);
  try { return await scanWithSampler(sampler, assetId, opts); } finally { sampler.dispose(); }
}

/** The clip's real average frame rate (the web import records a fixed 30). Null when it cannot be read. */
export async function detectFps(src: string): Promise<number | null> {
  try {
    const mb = await import('mediabunny');
    const input = new mb.Input({ source: new mb.UrlSource(src), formats: mb.ALL_FORMATS });
    try {
      const track = await input.getPrimaryVideoTrack();
      const stats = track ? await track.computePacketStats(120) : null;
      const fps = stats?.averagePacketRate ?? 0;
      return fps > 1 && fps < 480 ? Math.round(fps * 100) / 100 : null;
    } finally { input.dispose(); }
  } catch { return null; }
}
