/**
 * Template Generator — word-timed captions.
 *
 * Three free speech-to-text engines (no API key). Each returns word timings `[{ text, start, end }]` in milliseconds from the start of
 * the audio, which is what the editor's captions use (`CaptionsData.words`):
 *   - Whisper WebGPU        : `@remotion/whisper-webgpu`, run in a worker, on the GPU; works offline once the model is cached. The default.
 *                             The package needs WebGPU, so in a browser without it (or if its model cannot be fetched) the editor's own
 *                             Transformers.js Whisper (the same engine underneath, with a CPU path) does the listening instead.
 *   - Whisper.cpp (WASM)    : `@remotion/whisper-web`, Whisper.cpp built for the browser. Needs a cross-origin-isolated page
 *                             (SharedArrayBuffer); when the page is not, we say so and use Whisper WebGPU.
 *   - Whisper.cpp (local)   : `@remotion/install-whisper-cpp`, the native Whisper.cpp, run by `scripts/captions-server.mjs` on the user's own
 *                             computer (a native program cannot run in a tab or on Netlify). Offered only while that server answers.
 * With no audio to listen to, `evenWords` spreads the written script over the video like the wizard always did.
 */

export const LOCAL_SERVER_URL = 'http://127.0.0.1:8787';

export const CAPTION_ENGINES = [
  { id: 'whisper-webgpu', label: 'Whisper WebGPU', note: 'Free, on-device, on your GPU (a browser without WebGPU uses the CPU, slower). Works offline after the model downloads.' },
  { id: 'whisper-cpp', label: 'Whisper.cpp (WASM)', note: 'Free, on-device. Needs a cross-origin-isolated page.' },
];
export const LOCAL_ENGINE = { id: 'whisper-cpp-local', label: 'Whisper.cpp (local server)', note: 'Free. The native Whisper.cpp running on your computer (scripts/captions-server.mjs): fastest and most accurate.' };
export const DEFAULT_CAPTION_ENGINE = 'whisper-webgpu';

/** Model choices per engine: [id, label]. */
export const CAPTION_MODELS = {
  'whisper-webgpu': [['base', 'Accurate'], ['tiny', 'Fast'], ['small', 'Best (slower)'], ['large-v3-turbo', 'Turbo (large, needs a GPU)']],
  'whisper-cpp': [['base', 'Accurate (≈ 140 MB)'], ['tiny', 'Fast (≈ 75 MB)'], ['small', 'Best (≈ 460 MB, slower)']],
  'whisper-cpp-local': [['base', 'Accurate'], ['tiny', 'Fast'], ['small', 'Best'], ['medium', 'Better (≈ 1.5 GB)'], ['large-v3-turbo', 'Turbo (≈ 1.6 GB)']],
};
export const defaultModelFor = (engine) => (CAPTION_MODELS[engine] || CAPTION_MODELS[DEFAULT_CAPTION_ENGINE])[0][0];
export const CAPTION_LANGUAGES = [['auto', 'Detect'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['it', 'Italian'], ['nl', 'Dutch'], ['hi', 'Hindi'], ['ar', 'Arabic'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese']];

/** Longest stretch of audio we transcribe in one go (keeps a laptop responsive; longer scripts use their written text). */
export const MAX_CAPTION_AUDIO_SEC = 180;

/** The older engine's model ids (the editor's own Transformers.js Whisper) for the package's model names. */
const LEGACY_MODEL = { tiny: 'onnx-community/whisper-tiny_timestamped', base: 'onnx-community/whisper-base_timestamped', small: 'onnx-community/whisper-base_timestamped', 'large-v3-turbo': 'onnx-community/whisper-base_timestamped' };

/** Remotion-style captions (`{ text, startMs, endMs }`, text may carry a leading space) → editor words (ms). */
export function captionsToWords(captions = []) {
  const out = [];
  for (const c of captions || []) {
    const text = String(c?.text ?? '').trim();
    const start = Number(c?.startMs);
    const end = Number(c?.endMs);
    if (!text || !Number.isFinite(start)) continue;
    out.push({ text, start: Math.max(0, Math.round(start)), end: Math.max(Math.round(start) + 40, Math.round(Number.isFinite(end) ? end : start + 300)) });
  }
  out.sort((a, b) => a.start - b.start);
  // words must not overlap: each ends where the next begins at the latest
  for (let i = 0; i < out.length - 1; i += 1) if (out[i].end > out[i + 1].start) out[i].end = Math.max(out[i].start + 40, out[i + 1].start);
  return out;
}

/** `@remotion/whisper-webgpu` words (seconds) → Remotion-style captions, so every engine goes through `captionsToWords`. */
export const webgpuWordsToCaptions = (words = []) => (words || []).map((w) => ({ text: w.text, startMs: Number(w.startInSeconds) * 1000, endMs: Number(w.endInSeconds) * 1000 }));

/** The written script spread over the cut, one word at a time, in proportion to word length (no audio needed). */
export function evenWords(text, durationSec) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const total = Math.max(0.5, Number(durationSec) || words.length * 0.35) * 1000;
  if (!words.length) return [];
  const weights = words.map((w) => Math.max(2, w.length) + (/[.!?]$/.test(w) ? 3 : /[,;:]$/.test(w) ? 1.5 : 0));
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = 0;
  return words.map((w, i) => {
    const start = Math.round(t);
    t += (weights[i] / sum) * total;
    return { text: w, start, end: Math.max(start + 40, Math.round(t)) };
  });
}

/** 16 kHz mono PCM (Float32) → a 16-bit WAV file (what the native Whisper.cpp reads). */
export function encodeWav(samples, sampleRate = 16000) {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i += 1) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i += 1) { const x = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
  return new Uint8Array(buf);
}

/** Is the local Whisper.cpp server running? `{ ok, models? }` (never throws; times out fast so the panel does not wait). */
export async function localServerStatus({ fetchImpl = (typeof fetch === 'function' ? fetch : null), url = LOCAL_SERVER_URL, timeoutMs = 700 } = {}) {
  if (!fetchImpl) return { ok: false };
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => ctl?.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${url}/health`, { signal: ctl?.signal });
    const j = res.ok ? await res.json() : null;
    return j?.ok ? { ok: true, models: j.models || [] } : { ok: false };
  } catch { return { ok: false }; } finally { clearTimeout(timer); }
}

/** Whether an engine can run in this browser right now: `{ ok, reason?, fallback? }`. */
export async function engineStatus(engine, { model, fetchImpl } = {}) {
  if (engine === 'whisper-cpp-local') {
    const st = await localServerStatus({ fetchImpl });
    return st.ok ? { ok: true } : { ok: false, fallback: DEFAULT_CAPTION_ENGINE, reason: 'The local Whisper.cpp server is not running (node scripts/captions-server.mjs). Using Whisper WebGPU instead.' };
  }
  if (engine !== 'whisper-cpp') return { ok: true };
  try {
    const { canUseWhisperWeb } = await import('@remotion/whisper-web');
    const r = await canUseWhisperWeb(model && CAPTION_MODELS['whisper-cpp'].some(([id]) => id === model) ? model : 'base');
    if (r.supported) return { ok: true };
    const isolated = r.reason === 'not-cross-origin-isolated';
    return { ok: false, fallback: DEFAULT_CAPTION_ENGINE, reason: isolated ? 'Whisper.cpp needs a cross-origin-isolated page, which this site is not. Using Whisper WebGPU instead.' : (r.detailedReason || 'Whisper.cpp cannot run in this browser. Using Whisper WebGPU instead.') };
  } catch (err) {
    return { ok: false, fallback: DEFAULT_CAPTION_ENGINE, reason: `Whisper.cpp could not load (${err?.message || 'error'}). Using Whisper WebGPU instead.` };
  }
}

/** Run the `@remotion/whisper-webgpu` package in its worker. Resolves `{ captions }` or rejects (`err.fallback` = the package cannot run here). */
function runPackageWorker(audio, { model, language, onProgress, signal, workerFactory }) {
  const make = workerFactory || (() => new Worker(new URL('./captions.worker.js', import.meta.url), { type: 'module' }));
  const w = make();
  return new Promise((resolve, reject) => {
    const done = () => { w.removeEventListener?.('message', onMsg); w.removeEventListener?.('error', onErr); signal?.removeEventListener?.('abort', onAbort); try { w.terminate?.(); } catch { /* ignore */ } };
    const onAbort = () => { done(); reject(Object.assign(new Error('Transcription cancelled'), { name: 'AbortError' })); };
    const onMsg = ({ data }) => {
      if (data?.type === 'progress') onProgress?.({ stage: data.stage || 'transcribe', progress: data.progress ?? 0 });
      else if (data?.type === 'done') { done(); resolve({ captions: webgpuWordsToCaptions(data.words) }); }
      else if (data?.type === 'error') { done(); reject(Object.assign(new Error(data.message || 'Whisper WebGPU failed'), { fallback: !!data.fallback })); }
    };
    const onErr = (e) => { done(); reject(Object.assign(new Error(e?.message || 'Whisper WebGPU worker failed'), { fallback: true })); };
    w.addEventListener('message', onMsg);
    w.addEventListener('error', onErr);
    if (signal?.aborted) { onAbort(); return; }
    signal?.addEventListener?.('abort', onAbort);
    w.postMessage({ type: 'transcribe', id: 1, audio, model, language }, [audio.buffer]);
  });
}

async function runWebGpu(src, { model, language, onProgress, signal, fromSec, toSec, workerFactory }) {
  const { decodeAudio, transcribeInBrowser } = await import('../../../lib/editor/remotion/transcribe.js');
  onProgress?.({ stage: 'decode', progress: 0 });
  const audio = await decodeAudio(src, { fromSec, toSec, signal });
  if (!audio.length) throw new Error('The clip has no audio to transcribe');
  try {
    const out = await runPackageWorker(audio, { model, language, onProgress, signal, workerFactory });
    return { words: captionsToWords(out.captions) };
  } catch (err) {
    if (err?.name === 'AbortError' || !err?.fallback) throw err;
    // the audio was handed to the package's worker, so the older engine reads the source itself
    const legacy = await transcribeInBrowser(src, { fromSec, toSec, model: LEGACY_MODEL[model] || LEGACY_MODEL.base, language: language && language !== 'auto' ? language : undefined, onProgress, signal });
    return { words: captionsToWords(legacy.captions), note: 'The Whisper WebGPU package could not run here, so the editor\'s built-in Whisper listened instead.' };
  }
}

async function runCpp(src, { model, language, onProgress, signal, fromSec, toSec }) {
  const [{ decodeAudio }, wasm] = await Promise.all([import('../../../lib/editor/remotion/transcribe.js'), import('@remotion/whisper-web')]);
  onProgress?.({ stage: 'download', progress: 0 });
  await wasm.downloadWhisperModel({ model, onProgress: (p) => onProgress?.({ stage: 'download', progress: p.progress }) });
  onProgress?.({ stage: 'decode', progress: 0 });
  const audio = await decodeAudio(src, { fromSec, toSec, signal }); // 16 kHz mono PCM
  if (!audio.length) throw new Error('The clip has no audio to transcribe');
  if (signal?.aborted) throw Object.assign(new Error('Transcription cancelled'), { name: 'AbortError' });
  const result = await wasm.transcribe({ channelWaveform: audio, model, language: language || 'auto', onProgress: (p) => onProgress?.({ stage: 'transcribe', progress: p }) });
  return { words: captionsToWords(wasm.toCaptions({ whisperWebOutput: result }).captions) };
}

/** The native Whisper.cpp on the user's computer, through `scripts/captions-server.mjs`: the 16 kHz audio goes out as a WAV, captions come back. */
async function runLocal(src, { model, language, onProgress, signal, fromSec, toSec, fetchImpl = fetch, url = LOCAL_SERVER_URL }) {
  const { decodeAudio } = await import('../../../lib/editor/remotion/transcribe.js');
  onProgress?.({ stage: 'decode', progress: 0 });
  const audio = await decodeAudio(src, { fromSec, toSec, signal });
  if (!audio.length) throw new Error('The clip has no audio to transcribe');
  onProgress?.({ stage: 'transcribe', progress: 0.05 });
  const qs = new URLSearchParams({ model, language: language || 'auto' });
  const res = await fetchImpl(`${url}/transcribe?${qs}`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: encodeWav(audio), signal });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.ok) throw new Error(j?.error || `The local Whisper.cpp server returned an error (${res.status}).`);
  onProgress?.({ stage: 'transcribe', progress: 1 });
  return { words: captionsToWords(j.captions) };
}

/**
 * Listen to `src` (a URL) and return `{ words, engine, model, note? }`. `engine` is the one that really ran: when an engine cannot run here
 * the request moves to Whisper WebGPU and `note` says why. Throws on abort, on audio that cannot be decoded, and on audio with no speech.
 */
export async function transcribeCaptions(src, { engine = DEFAULT_CAPTION_ENGINE, model, language, onProgress, signal, fromSec = 0, toSec, workerFactory, fetchImpl } = {}) {
  const limit = fromSec + MAX_CAPTION_AUDIO_SEC;
  const opts = { language, onProgress, signal, fromSec, toSec: Number.isFinite(toSec) ? Math.min(toSec, limit) : limit, workerFactory, ...(fetchImpl ? { fetchImpl } : {}) };
  let use = CAPTION_MODELS[engine] ? engine : DEFAULT_CAPTION_ENGINE;
  let note;
  if (use !== 'whisper-webgpu') {
    const st = await engineStatus(use, { model, fetchImpl });
    if (!st.ok) { use = st.fallback; note = st.reason; }
  }
  const mdl = CAPTION_MODELS[use].some(([id]) => id === model) ? model : defaultModelFor(use);
  const out = use === 'whisper-cpp-local' ? await runLocal(src, { ...opts, model: mdl })
    : use === 'whisper-cpp' ? await runCpp(src, { ...opts, model: mdl })
      : await runWebGpu(src, { ...opts, model: mdl });
  if (!out.words.length) throw new Error('No speech was found to caption.');
  return { words: out.words, engine: use, model: mdl, ...(note || out.note ? { note: [note, out.note].filter(Boolean).join(' ') } : {}) };
}
