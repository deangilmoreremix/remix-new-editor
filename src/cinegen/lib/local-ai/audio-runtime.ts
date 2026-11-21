// [remix] Port I2: the browser side of the audio model manager: capability check, Cache Storage inspection / deletion, storage quota and
// the real pipelines (kokoro-js for speech, @huggingface/transformers MusicGen for music). Everything is imported lazily so the app
// bundle does not pay for it until the user opens the feature. Weights are fetched from huggingface.co by the library, never bundled.
import { AudioModelManager, ManagerError, type GenerateRequest, type ModelRuntime, type RawAudio } from './audio-manager';
import { AUDIO_MODELS, type AudioModel } from './models-audio';
import { chunkText, concatSamples } from './wav';

const CACHE_NAME = 'transformers-cache'; // transformers.js default env.cacheKey

let gpuProbe: Promise<boolean> | null = null;
// [remix] Fix Q: once a WebGPU model load has failed in this tab, onnxruntime-web cannot create a WASM session in the same page any more (the retry threw the
// same raw number), so remember it for the tab (sessionStorage): after a reload the capability check reports no WebGPU and the model loads on WASM.
const GPU_FAILED_KEY = 'cinegen.localai.webgpu-failed';
const gpuFailedBefore = () => { try { return sessionStorage.getItem(GPU_FAILED_KEY) === '1'; } catch { return false; } };
export function markWebgpuFailed(): void { try { sessionStorage.setItem(GPU_FAILED_KEY, '1'); } catch { /* not remembered */ } }
/** A readable message for a failed model load: the runtime can throw a bare number (an emscripten exception pointer) that used to be shown as the error. */
export function describeLoadFailure(e: unknown, device: 'webgpu' | 'wasm'): Error {
  if (e instanceof Error) return e;
  const code = typeof e === 'number' || typeof e === 'string' ? String(e) : 'unknown';
  return new Error(device === 'webgpu'
    ? `The WebGPU runtime could not start on this device (internal code ${code}). Reload the page and download or load the model again: it will then run on WASM (CPU).`
    : `The WASM runtime could not start (internal code ${code}). Reload the page and try again.`);
}
/** `navigator.gpu` can exist with no usable adapter (headless Chromium, blocklisted GPUs): ask for an adapter once. */
function hasGpuAdapter(): Promise<boolean> {
  gpuProbe ??= (async () => {
    if (gpuFailedBefore()) return false;
    try {
      const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<{ requestDevice?: () => Promise<{ destroy?: () => void }> } | null> } }).gpu;
      const adapter = gpu ? await gpu.requestAdapter() : null;
      if (!adapter) return false;
      // an adapter is not enough: when requestDevice() fails the runtime cannot start any session in this page (see GPU_FAILED_KEY), so prove a device exists first
      const dev = await adapter.requestDevice?.();
      try { dev?.destroy?.(); } catch { /* probe device only */ }
      return true;
    } catch { return false; }
  })();
  return gpuProbe;
}
export async function detectCapability(): Promise<{ webgpu: boolean; wasm: boolean }> {
  return { webgpu: typeof navigator !== 'undefined' && (await hasGpuAdapter()), wasm: typeof WebAssembly !== 'undefined' };
}

async function cacheKeys(): Promise<{ cache: Cache; keys: readonly Request[] } | null> {
  try {
    if (!globalThis.caches || !(await caches.has(CACHE_NAME))) return null;
    const cache = await caches.open(CACHE_NAME);
    return { cache, keys: await cache.keys() };
  } catch { return null; }
}

export async function isModelCached(m: AudioModel): Promise<boolean> {
  const c = await cacheKeys();
  return !!c && c.keys.some((r) => r.url.toLowerCase().includes(m.loader.cacheFragments[0]));
}

export async function deleteModelCache(m: AudioModel): Promise<void> {
  const c = await cacheKeys();
  if (!c) return;
  for (const r of c.keys) if (m.loader.cacheFragments.some((f) => r.url.toLowerCase().includes(f))) await c.cache.delete(r);
  // also the repo's small shared files (tokenizer, config, voices) — unless another installed model of the same repo still needs them
  const repo = m.loader.repo?.toLowerCase();
  if (!repo) return;
  const left = await c.cache.keys();
  const needed = AUDIO_MODELS.some((o) => o.id !== m.id && o.loader.repo?.toLowerCase() === repo && left.some((r) => o.loader.cacheFragments.some((f) => r.url.toLowerCase().includes(f))));
  if (needed) return;
  for (const r of left) if (r.url.toLowerCase().includes(`/${repo}/`)) await c.cache.delete(r);
}

export async function storageQuota(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e && e.quota ? { usage: e.usage ?? 0, quota: e.quota } : null;
  } catch { return null; }
}

type Progress = { status?: string; file?: string; loaded?: number; total?: number };
/** Sum of bytes loaded over the known download size: files arrive one after another so a per-file ratio would jump around. */
function progressTracker(m: AudioModel, emit: (message: string, fraction: number) => void) {
  const files = new Map<string, number>();
  return (p: Progress) => {
    if (p.status !== 'progress' || !p.file || typeof p.loaded !== 'number') return;
    files.set(p.file, p.loaded);
    const got = [...files.values()].reduce((a, b) => a + b, 0);
    const f = Math.min(0.99, got / (m.sizeMB * 1e6));
    emit(`Downloading ${m.name} ${Math.round(f * 100)}% (${Math.round(got / 1e6)} of ${m.sizeMB} MB)`, f);
  };
}

/**
 * Make the library's Hugging Face downloads abortable: while a load runs, requests to huggingface.co carry its signal, so Cancel stops the
 * transfer instead of letting it finish in the background. Done on the global fetch because kokoro-js bundles its own copy of
 * transformers.js (a different `env` than the app's) and both fetch through the global. One permanent wrapper + loads run one at a time,
 * so overlapping loads cannot leave a stale (aborted) signal installed.
 */
let activeSignal: AbortSignal | null = null;
let fetchPatched = false;
// kokoro-js leaves an internal promise rejected ("Could not locate file ...") when its download is aborted, and it can surface long after the cancel.
// One permanent, narrow filter: only that error, and only within a minute of a cancelled load.
const underlying: Promise<unknown>[] = [];
let lastAbortAt = 0; let filterInstalled = false;
function installStrayRejectionFilter() {
  if (filterInstalled || typeof globalThis.addEventListener !== 'function') return; filterInstalled = true;
  globalThis.addEventListener('unhandledrejection', ((ev: PromiseRejectionEvent) => {
    const r = ev.reason as { message?: string } | undefined;
    if (Date.now() - lastAbortAt < 60_000 && /Could not locate file/.test(String(r?.message ?? r))) ev.preventDefault();
  }) as EventListener);
}
let loadChain: Promise<unknown> = Promise.resolve();
function patchFetchOnce() {
  if (fetchPatched) return; fetchPatched = true;
  const orig = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return activeSignal && /^https:\/\/([\w-]+\.)?huggingface\.co\//.test(url) ? orig(input, { ...init, signal: activeSignal }) : orig(input, init);
  }) as typeof fetch;
}
function withAbortableFetch<T>(signal: AbortSignal, fn: () => Promise<T>): Promise<T> {
  const run = loadChain.then(async () => {
    if (signal.aborted) throw aborted();
    patchFetchOnce(); activeSignal = signal;
    signal.addEventListener('abort', () => { lastAbortAt = Date.now(); }, { once: true });
    installStrayRejectionFilter();
    try { return await fn(); } finally {
      // a cancelled load returns early (withAbort) while the library keeps running: keep the abort signal on its fetches until it has stopped, or its next file
      // downloads unabortably in the background and fails later with a stray rejection
      const rest = underlying.splice(0);
      if (signal.aborted && rest.length) await Promise.race([Promise.allSettled(rest), new Promise((r) => setTimeout(r, 10_000))]);
      activeSignal = null;
    }
  });
  loadChain = run.catch(() => undefined);
  return run;
}
async function transformers() {
  const t = await import('@huggingface/transformers');
  t.env.useBrowserCache = true;
  t.env.allowLocalModels = false;
  return t;
}

const aborted = () => new ManagerError('cancelled', 'Cancelled.');
const withAbort = <T,>(p: Promise<T>, signal: AbortSignal): Promise<T> => {
  underlying.push(p.catch(() => undefined));
  return new Promise<T>((res, rej) => { if (signal.aborted) { rej(aborted()); return; } const on = () => rej(aborted()); signal.addEventListener('abort', on, { once: true }); p.then(res, rej).finally(() => signal.removeEventListener('abort', on)); });
};

type KokoroLike = { generate(text: string, o: { voice: string; speed: number }): Promise<{ audio: Float32Array; sampling_rate: number }> };
export function kokoroRuntime(tts: KokoroLike & { model?: { dispose?: () => Promise<void> } }): ModelRuntime {
  return {
    async generate(req: GenerateRequest, io): Promise<RawAudio> {
      if (req.kind !== 'tts') throw new ManagerError('failed', 'Kokoro makes speech only.');
      const parts = chunkText(req.text); const out: Float32Array[] = []; let sr = 24000;
      if (!parts.length) throw new ManagerError('failed', 'Type the narration text first.');
      for (const [i, part] of parts.entries()) {
        if (io.signal.aborted) throw aborted();
        io.onProgress(`Speaking part ${i + 1} of ${parts.length}…`, i / parts.length);
        const a = await tts.generate(part, { voice: req.voice, speed: req.speed });
        if (!a.audio?.length) throw new ManagerError('failed', 'The voice returned no audio for part ' + (i + 1) + '.');
        sr = a.sampling_rate; out.push(a.audio);
        out.push(new Float32Array(Math.round(sr * 0.12))); // short gap between sentences
      }
      return { samples: concatSamples(out), sampleRate: sr };
    },
    async dispose() { await tts.model?.dispose?.(); },
  };
}

export async function loadAudioModel(m: AudioModel, device: 'webgpu' | 'wasm', io: { signal: AbortSignal; onProgress: (message: string, fraction: number) => void }): Promise<ModelRuntime> {
  return loadAudioModelOn(m, device, io).catch((e) => {
    // a bare (non-Error) throw is the runtime failing to start, not a download problem: a failed WebGPU start is remembered for this tab
    if (device === 'webgpu' && !io.signal.aborted && !(e instanceof Error)) markWebgpuFailed();
    throw describeLoadFailure(e, device);
  });
}
function loadAudioModelOn(m: AudioModel, device: 'webgpu' | 'wasm', io: { signal: AbortSignal; onProgress: (message: string, fraction: number) => void }): Promise<ModelRuntime> {
  return withAbortableFetch(io.signal, async () => {
    const track = progressTracker(m, io.onProgress);
    if (m.loader.kind === 'kokoro') {
      const { KokoroTTS } = await import('kokoro-js');
      await transformers();
      const tts = await withAbort(KokoroTTS.from_pretrained(m.loader.repo, { dtype: m.loader.dtype as 'q8', device, progress_callback: track as never }), io.signal);
      return kokoroRuntime(tts as unknown as Parameters<typeof kokoroRuntime>[0]);
    }
    const t = await transformers();
    const tokenizer = await withAbort(t.AutoTokenizer.from_pretrained(m.loader.repo, { progress_callback: track as never }), io.signal);
    const model = await withAbort(t.MusicgenForConditionalGeneration.from_pretrained(m.loader.repo, { device, dtype: m.loader.dtype as never, progress_callback: track as never }), io.signal);
    return {
      async generate(req, gio): Promise<RawAudio> {
        if (req.kind !== 'music') throw new ManagerError('failed', 'MusicGen makes music only.');
        const lim = m.durationSeconds!; const seconds = Math.min(lim.max, Math.max(lim.min, req.seconds));
        const maxNew = Math.max(1, Math.round(seconds * 50));
        let n = 0;
        const streamer = { put: () => { if (gio.signal.aborted) throw aborted(); n++; gio.onProgress(`Composing… ${Math.round(Math.min(1, n / maxNew) * 100)}%`, Math.min(1, n / maxNew)); }, end: () => undefined };
        const values = await model.generate({ ...tokenizer(req.prompt), max_new_tokens: maxNew, do_sample: true, guidance_scale: 3, streamer: streamer as never });
        const sr = (model.config as { audio_encoder?: { sampling_rate?: number } }).audio_encoder?.sampling_rate ?? 32000;
        const data = (values as unknown as { data: Float32Array }).data;
        return { samples: data instanceof Float32Array ? data : new Float32Array(data as ArrayLike<number>), sampleRate: sr };
      },
      async dispose() { await (model as unknown as { dispose?: () => Promise<void> }).dispose?.(); },
    };
  });
}

let shared: AudioModelManager | null = null;
/** The app-wide manager (browser dependencies). */
export function getAudioModelManager(): AudioModelManager {
  if (!shared) shared = new AudioModelManager({
    capability: detectCapability, isCached: isModelCached, deleteCache: deleteModelCache, quota: storageQuota, load: loadAudioModel,
    storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
  });
  return shared;
}
