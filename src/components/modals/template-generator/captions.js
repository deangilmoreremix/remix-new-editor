/**
 * Template Generator — word-timed captions.
 *
 * Two free, on-device speech-to-text engines (no API key, nothing leaves the browser, works offline once the model is cached):
 *   - Whisper WebGPU : Whisper through Transformers.js (the engine behind @remotion/whisper-webgpu). Uses the GPU when the browser has
 *                      WebGPU and falls back to WASM. The default.
 *   - Whisper.cpp    : Whisper.cpp compiled to WebAssembly (@remotion/whisper-web, the browser build of @remotion/install-whisper-cpp,
 *                      which itself installs a native binary and cannot run in a browser). Needs a cross-origin-isolated page
 *                      (SharedArrayBuffer); when the page is not, we say so and use Whisper WebGPU instead.
 *
 * Both give word timings `[{ text, start, end }]` in milliseconds from the start of the audio, which is what the editor's captions use
 * (`CaptionsData.words`). With no audio to listen to, `evenWords` spreads the written script over the video like the wizard always did.
 */

export const CAPTION_ENGINES = [
  { id: 'whisper-webgpu', label: 'Whisper WebGPU', note: 'Free, on-device. Uses your GPU when the browser has WebGPU.' },
  { id: 'whisper-cpp', label: 'Whisper.cpp (WASM)', note: 'Free, on-device. Needs a cross-origin-isolated page.' },
];
export const DEFAULT_CAPTION_ENGINE = 'whisper-webgpu';

/** Model choices per engine: [id, label]. */
export const CAPTION_MODELS = {
  'whisper-webgpu': [['onnx-community/whisper-base_timestamped', 'Accurate (≈ 80 MB)'], ['onnx-community/whisper-tiny_timestamped', 'Fast (≈ 40 MB)']],
  'whisper-cpp': [['base', 'Accurate (≈ 140 MB)'], ['tiny', 'Fast (≈ 75 MB)'], ['small', 'Best (≈ 460 MB, slower)']],
};
export const defaultModelFor = (engine) => (CAPTION_MODELS[engine] || CAPTION_MODELS[DEFAULT_CAPTION_ENGINE])[0][0];
export const CAPTION_LANGUAGES = [['auto', 'Detect'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['it', 'Italian'], ['nl', 'Dutch'], ['hi', 'Hindi'], ['ar', 'Arabic'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese']];

/** Longest stretch of audio we transcribe in one go (keeps a laptop responsive; longer scripts use their written text). */
export const MAX_CAPTION_AUDIO_SEC = 180;

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

/** The written script spread over the video, one word at a time, in proportion to word length (no audio needed). */
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

/** Whether an engine can run in this browser right now: `{ ok, reason?, fallback? }`. */
export async function engineStatus(engine, { model } = {}) {
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

async function runWebGpu(src, { model, language, onProgress, signal, fromSec, toSec }) {
  const { transcribeInBrowser } = await import('../../../lib/editor/remotion/transcribe.js');
  const out = await transcribeInBrowser(src, { fromSec, toSec, model, language: language && language !== 'auto' ? language : undefined, onProgress, signal });
  return captionsToWords(out.captions);
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
  return captionsToWords(wasm.toCaptions({ whisperWebOutput: result }).captions);
}

/**
 * Listen to `src` (a URL) and return `{ words, engine, note? }`. `engine` is the one that really ran: when Whisper.cpp cannot run here the
 * request moves to Whisper WebGPU and `note` says why. Throws on abort or when the audio cannot be decoded.
 */
export async function transcribeCaptions(src, { engine = DEFAULT_CAPTION_ENGINE, model, language, onProgress, signal, fromSec = 0, toSec } = {}) {
  const limit = fromSec + MAX_CAPTION_AUDIO_SEC;
  const opts = { language, onProgress, signal, fromSec, toSec: Number.isFinite(toSec) ? Math.min(toSec, limit) : limit };
  let use = engine;
  let note;
  if (use === 'whisper-cpp') {
    const st = await engineStatus('whisper-cpp', { model });
    if (!st.ok) { use = st.fallback; note = st.reason; }
  }
  const mdl = CAPTION_MODELS[use].some(([id]) => id === model) ? model : defaultModelFor(use);
  const words = use === 'whisper-cpp' ? await runCpp(src, { ...opts, model: mdl }) : await runWebGpu(src, { ...opts, model: mdl });
  if (!words.length) throw new Error('No speech was found to caption.');
  return { words, engine: use, model: mdl, ...(note ? { note } : {}) };
}
