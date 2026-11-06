/**
 * Main-thread clients for the Timeline Editor's free, in-browser AI workers
 * (ml.worker.js: Transformers.js models; kokoro.worker.js: free voiceover).
 * Each request is matched to its reply by id. Cancelling terminates the worker
 * (the only way to stop a running inference); it is recreated on the next call
 * and models reload from the browser cache.
 */
import { LOCAL_MODELS } from './modelRegistry.js';

const abortError = () => Object.assign(new Error('Cancelled'), { name: 'AbortError' });

/** A small RPC client around a lazily created Worker. */
export function createWorkerClient(factory) {
  let worker = null;
  let seq = 0;
  let make = factory;
  const pending = new Map();

  const failAll = (err) => {
    for (const job of pending.values()) { job.cleanup?.(); job.reject(err); }
    pending.clear();
  };

  function terminate() {
    if (worker) { worker.terminate?.(); worker = null; }
    failAll(abortError());
  }

  function getWorker() {
    if (worker) return worker;
    worker = make();
    worker.addEventListener('message', ({ data }) => {
      const job = pending.get(data?.id);
      if (!job) return;
      if (data.type === 'progress') { job.onProgress?.(data); return; }
      pending.delete(data.id);
      job.cleanup?.();
      if (data.type === 'error') {
        job.reject(new Error(data.message || 'Local AI failed'));
        // A failed model load can leave the ONNX runtime unusable for later
        // sessions; start a fresh worker for the next job (models reload
        // from the browser cache).
        if (!pending.size) { worker?.terminate?.(); worker = null; }
      } else job.resolve(data.result);
    });
    worker.addEventListener('error', (e) => {
      failAll(new Error(e?.message || 'Local AI worker failed'));
      worker?.terminate?.();
      worker = null;
    });
    return worker;
  }

  function run(task, input = {}, { transfer = [], onProgress, signal } = {}) {
    if (signal?.aborted) return Promise.reject(abortError());
    const w = getWorker();
    const id = ++seq;
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        pending.delete(id);
        reject(abortError());
        terminate();
      };
      const cleanup = () => signal?.removeEventListener?.('abort', onAbort);
      pending.set(id, { resolve, reject, onProgress, cleanup });
      signal?.addEventListener?.('abort', onAbort, { once: true });
      w.postMessage({ id, task, input }, transfer);
    });
  }

  return {
    run,
    terminate,
    /** Test hook: swap the Worker factory. */
    setFactory(fn) { terminate(); make = fn || factory; },
    get pendingCount() { return pending.size; },
  };
}

const mlWorker = createWorkerClient(() => new Worker(new URL('./ml.worker.js', import.meta.url), { type: 'module' }));
const kokoroWorker = createWorkerClient(() => new Worker(new URL('./kokoro.worker.js', import.meta.url), { type: 'module' }));

/** Run one task in ml.worker.js. */
export const runLocalTask = (task, input, opts) => mlWorker.run(task, input, opts);
/** Run one task in kokoro.worker.js. */
export const runVoiceTask = (task, input, opts) => kokoroWorker.run(task, input, opts);

/** Test hooks. */
export const __mlWorker = mlWorker;
export const __kokoroWorker = kokoroWorker;

/** Stop every running local-AI job. */
export function terminateLocalAI() {
  mlWorker.terminate();
  kokoroWorker.terminate();
}

/** Download a model ahead of use (shows progress), without running it. */
export function preloadModel(key, { onProgress, signal } = {}) {
  if (!LOCAL_MODELS[key]) return Promise.reject(new Error(`Unknown model: ${key}`));
  if (key === 'kokoro') return runVoiceTask('preload', {}, { onProgress, signal });
  return runLocalTask('preload', { key }, { onProgress, signal });
}

const CACHE_NAME = 'transformers-cache';
const modelUrlPart = (info) => `/${info.id}/`;

/** Whether any file for this model is already in the browser cache. */
export async function isModelCached(key) {
  const info = LOCAL_MODELS[key];
  if (!info || typeof caches === 'undefined') return false;
  try {
    const cache = await caches.open(CACHE_NAME);
    const reqs = await cache.keys();
    return reqs.some((r) => r.url.includes(modelUrlPart(info)));
  } catch {
    return false;
  }
}

/** Remove a model's files from the browser cache. Returns the number of files removed. */
export async function clearModel(key) {
  const info = LOCAL_MODELS[key];
  if (!info || typeof caches === 'undefined') return 0;
  const cache = await caches.open(CACHE_NAME);
  const reqs = await cache.keys();
  const mine = reqs.filter((r) => r.url.includes(modelUrlPart(info)));
  await Promise.all(mine.map((r) => cache.delete(r)));
  terminateLocalAI();
  return mine.length;
}

/** Whether this browser exposes WebGPU (local AI is much faster with it). */
export async function hasWebGpu() {
  try { return !!(globalThis.navigator?.gpu && await globalThis.navigator.gpu.requestAdapter()); } catch { return false; }
}
