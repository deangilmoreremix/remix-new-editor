// [remix] Fix B3: the scene-scan algorithm, independent of where frames come from (main thread <video> or the Web Worker, see scan-worker.ts).
import { detectCuts, refineCut, type CutOptions, type FrameSample } from './histogram-cuts';
import { scenesFromCuts, type SceneInfo } from './scenes';

export const abortError = () => new DOMException('Scene scan cancelled', 'AbortError');
export interface VideoSampler { duration: number; width: number; height: number; histAt(t: number): Promise<Float32Array>; thumbAt(t: number, maxW?: number): Promise<string>; dispose(): void }

export interface ScanOptions extends CutOptions { stepSec?: number; precisionSec?: number; signal?: AbortSignal; /** false = always scan on the main thread */ useWorker?: boolean; onProgress?: (fraction: number, phase: 'scan' | 'refine' | 'thumbs') => void; thumbnails?: boolean; thumbWidth?: number; assetName?: string }

/** The scan itself, over any frame sampler (main-thread <video> sampler, or the worker's WebCodecs one). Throws AbortError when cancelled. */
export async function scanWithSampler(sampler: VideoSampler, assetId: string, opts: ScanOptions = {}): Promise<SceneInfo[]> {
  {
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
  }
}

