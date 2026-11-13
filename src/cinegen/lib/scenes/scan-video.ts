// [remix] Stage 4: browser side of scene detection: sample a video's frames on a canvas (seek + drawImage, small frames), build histograms,
// find cuts (histogram-cuts.ts), refine each to about one frame, cut thumbnails. Cancellable with an AbortSignal; runs on the main thread
// with a yield between frames so the UI stays responsive (a worker would need OffscreenCanvas + video decode, which is WebCodecs-only).
import { detectCuts, refineCut, rgbHistogram, type CutOptions, type FrameSample } from './histogram-cuts';
import { scenesFromCuts, type SceneInfo } from './scenes';

const abortError = () => new DOMException('Scene scan cancelled', 'AbortError');

export interface VideoSampler { duration: number; width: number; height: number; histAt(t: number): Promise<Float32Array>; thumbAt(t: number, maxW?: number): Promise<string>; dispose(): void }

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

export interface ScanOptions extends CutOptions { stepSec?: number; precisionSec?: number; signal?: AbortSignal; onProgress?: (fraction: number, phase: 'scan' | 'refine' | 'thumbs') => void; thumbnails?: boolean; thumbWidth?: number; assetName?: string }

/** Detect scenes of one video. Throws AbortError when cancelled. */
export async function scanScenes(assetId: string, src: string, opts: ScanOptions = {}): Promise<SceneInfo[]> {
  const sampler = await openSampler(src, opts.signal);
  try {
    const dur = sampler.duration || 0;
    const step = opts.stepSec ?? Math.min(0.25, Math.max(0.05, dur / 600));
    const samples: FrameSample[] = [];
    for (let t = 0; t < dur; t += step) {
      if (opts.signal?.aborted) throw abortError();
      samples.push({ timeSec: t, hist: await sampler.histAt(t) });
      opts.onProgress?.(Math.min(1, t / Math.max(dur, 1e-6)) * 0.6, 'scan');
      if (samples.length % 8 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    const coarse = detectCuts(samples, dur, opts);
    const cuts: number[] = [];
    for (let i = 0; i < coarse.length; i++) {
      const after = samples.find((s) => Math.abs(s.timeSec - coarse[i].timeSec) < step / 2 + 1e-6);
      const before = after ? samples[samples.indexOf(after) - 1] : undefined;
      cuts.push(after && before ? await refineCut((t) => sampler.histAt(t), before, after, opts.precisionSec ?? 1 / 30, opts.signal) : coarse[i].timeSec);
      opts.onProgress?.(0.6 + 0.2 * ((i + 1) / coarse.length), 'refine');
    }
    const scenes = scenesFromCuts(assetId, opts.assetName ?? assetId, cuts, dur);
    if (opts.thumbnails !== false) {
      for (let i = 0; i < scenes.length; i++) {
        if (opts.signal?.aborted) throw abortError();
        scenes[i].thumb = await sampler.thumbAt((scenes[i].startSec + scenes[i].endSec) / 2, opts.thumbWidth ?? 160);
        opts.onProgress?.(0.8 + 0.2 * ((i + 1) / scenes.length), 'thumbs');
      }
    }
    return scenes;
  } finally { sampler.dispose(); }
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
