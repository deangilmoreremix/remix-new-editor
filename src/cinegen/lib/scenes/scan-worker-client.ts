// [remix] Fix B3: main-thread side of the scene-scan worker. One short-lived worker per scan; progress is forwarded, abort cancels (the worker is
// told, then terminated), any worker failure rejects so scanScenes can fall back to the main thread.
import type { SceneInfo } from './scenes';
import type { ScanOptions } from './scan-core';
import { abortError } from './scan-core';

/** Needs a module Worker, OffscreenCanvas and WebCodecs (mediabunny decodes with them). */
export const canScanInWorker = (): boolean => typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof VideoDecoder !== 'undefined';

export type ScanWorkerMessage =
  | { type: 'progress'; fraction: number; phase: 'scan' | 'refine' | 'thumbs' }
  | { type: 'done'; scenes: SceneInfo[] }
  | { type: 'error'; name: string; message: string };

export function scanScenesInWorker(assetId: string, src: string, opts: ScanOptions): Promise<SceneInfo[]> {
  return new Promise<SceneInfo[]>((resolve, reject) => {
    if (opts.signal?.aborted) { reject(abortError()); return; }
    const worker = new Worker(new URL('./scan-worker.ts', import.meta.url), { type: 'module' });
    const finish = (fn: () => void) => { opts.signal?.removeEventListener('abort', onAbort); worker.terminate(); fn(); };
    const onAbort = () => { try { worker.postMessage({ type: 'cancel' }); } catch { /* gone */ } finish(() => reject(abortError())); };
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    worker.onmessage = (ev: MessageEvent<ScanWorkerMessage>) => {
      const m = ev.data;
      if (m.type === 'progress') opts.onProgress?.(m.fraction, m.phase);
      else if (m.type === 'done') finish(() => resolve(m.scenes));
      else finish(() => reject(m.name === 'AbortError' ? abortError() : new Error(m.message)));
    };
    worker.onerror = (e) => finish(() => reject(new Error(e.message || 'The scene scan worker failed.')));
    const { signal: _s, onProgress: _p, ...plain } = opts; void _s; void _p;
    worker.postMessage({ type: 'scan', assetId, src, opts: plain });
  });
}
