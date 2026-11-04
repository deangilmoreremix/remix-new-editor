/**
 * Auto-captions: decode a clip's audio and transcribe it in the browser
 * (transcribe.worker.js). Returns Remotion captions relative to the clip.
 */
import { chunksToCaptions } from './captions.js';

export const WHISPER_MODELS = [
  ['onnx-community/whisper-base_timestamped', 'Accurate (≈ 80 MB)'],
  ['onnx-community/whisper-tiny_timestamped', 'Fast (≈ 40 MB)'],
];

/** Fetch media and decode it to 16 kHz mono PCM, cut to [fromSec, toSec). */
export async function decodeAudio(src, { fromSec = 0, toSec = Infinity, signal } = {}) {
  const res = await fetch(src, { signal });
  if (!res.ok) throw new Error(`Couldn't load the clip's media (HTTP ${res.status})`);
  const buf = await res.arrayBuffer();
  const Ctx = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Ctx) throw new Error('This browser cannot decode audio');
  const ctx = new Ctx(1, 1, 16000);
  let audio;
  try {
    audio = await ctx.decodeAudioData(buf);
  } catch {
    throw new Error('This clip has no audio track that the browser can decode');
  }
  const rate = audio.sampleRate;
  const start = Math.max(0, Math.floor(fromSec * rate));
  const end = Math.min(audio.length, Number.isFinite(toSec) ? Math.ceil(toSec * rate) : audio.length);
  const out = new Float32Array(Math.max(0, end - start));
  for (let c = 0; c < audio.numberOfChannels; c += 1) {
    const ch = audio.getChannelData(c);
    for (let i = 0; i < out.length; i += 1) out[i] += ch[start + i] / audio.numberOfChannels;
  }
  if (rate === 16000) return out;
  // Linear resample (decodeAudioData normally already resampled to 16 kHz).
  const ratio = rate / 16000;
  const res16 = new Float32Array(Math.floor(out.length / ratio));
  for (let i = 0; i < res16.length; i += 1) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    res16[i] = out[i0] + (out[Math.min(out.length - 1, i0 + 1)] - out[i0]) * (x - i0);
  }
  return res16;
}

let worker = null;
let seq = 0;
const getWorker = () => {
  if (!worker) worker = new Worker(new URL('./transcribe.worker.js', import.meta.url), { type: 'module' });
  return worker;
};

/**
 * @returns {Promise<{ captions, text }>} captions in ms from `fromSec`
 */
export async function transcribeInBrowser(src, { fromSec = 0, toSec = Infinity, model, language, onProgress, signal } = {}) {
  onProgress?.({ stage: 'decode', progress: 0 });
  const audio = await decodeAudio(src, { fromSec, toSec, signal });
  if (!audio.length) throw new Error('The clip has no audio to transcribe');
  const w = getWorker();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      // Terminating is the only way to stop a running inference.
      worker?.terminate();
      worker = null;
      reject(Object.assign(new Error('Transcription cancelled'), { name: 'AbortError' }));
    };
    const onMsg = ({ data }) => {
      if (data?.id !== id) return;
      if (data.type === 'progress') onProgress?.(data);
      else if (data.type === 'done') { cleanup(); resolve({ text: data.text, captions: chunksToCaptions(data.chunks) }); }
      else if (data.type === 'error') { cleanup(); reject(new Error(data.message)); }
    };
    const onErr = (e) => { cleanup(); reject(new Error(e.message || 'Transcription worker failed')); };
    const cleanup = () => {
      w.removeEventListener('message', onMsg);
      w.removeEventListener('error', onErr);
      signal?.removeEventListener('abort', onAbort);
    };
    w.addEventListener('message', onMsg);
    w.addEventListener('error', onErr);
    signal?.addEventListener('abort', onAbort);
    w.postMessage({ type: 'transcribe', id, audio, model, language }, [audio.buffer]);
  });
}
