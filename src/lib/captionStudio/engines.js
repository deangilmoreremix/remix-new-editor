/**
 * Free, on-device speech-to-text engines. Nothing here calls a paid API or uploads audio.
 *
 *   whisper-webgpu  Transformers.js + Whisper on the GPU       word timestamps   fastest
 *   whisper-wasm    Transformers.js + Whisper on WebAssembly   word timestamps   works in any modern browser
 *   webspeech       Web Speech API (live microphone only)      approximate word timing, on-device where the browser offers it
 */
import { transcribeInBrowser, WHISPER_MODELS } from '../editor/remotion/transcribe.js';

export { WHISPER_MODELS };

export const CAPTION_LANGUAGES = [
  ['auto', 'Detect language'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'],
  ['it', 'Italian'], ['nl', 'Dutch'], ['pl', 'Polish'], ['tr', 'Turkish'], ['ru', 'Russian'], ['ar', 'Arabic'], ['hi', 'Hindi'],
  ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese'], ['id', 'Indonesian'], ['vi', 'Vietnamese'], ['sv', 'Swedish'], ['uk', 'Ukrainian'],
];

export const ENGINES = [
  { id: 'whisper-webgpu', label: 'Whisper · GPU (fastest)', device: 'webgpu', file: true, live: false, words: true },
  { id: 'whisper-wasm', label: 'Whisper · any browser (WebAssembly)', device: 'wasm', file: true, live: false, words: true },
  { id: 'webspeech', label: 'Live speech (microphone)', device: null, file: false, live: true, words: false },
];

/** What this browser can do. Never throws. */
export async function detectCapabilities() {
  const g = typeof globalThis !== 'undefined' ? globalThis : {};
  let webgpu = false;
  try { webgpu = !!(g.navigator?.gpu && await g.navigator.gpu.requestAdapter()); } catch { /* no GPU */ }
  const Rec = g.SpeechRecognition || g.webkitSpeechRecognition;
  return {
    webgpu,
    wasm: typeof g.WebAssembly === 'object',
    webSpeech: !!Rec,
    onDeviceSpeech: !!(g.SpeechRecognition && typeof g.SpeechRecognition.available === 'function'),
    webCodecs: typeof g.VideoEncoder === 'function' && typeof g.VideoDecoder === 'function',
    mediaRecorder: typeof g.MediaRecorder === 'function',
    microphone: !!g.navigator?.mediaDevices?.getUserMedia,
  };
}

export const recommendEngine = (caps) => (caps.webgpu ? 'whisper-webgpu' : 'whisper-wasm');
export const recommendModel = (caps) => (caps.webgpu ? WHISPER_MODELS[0][0] : WHISPER_MODELS[1][0]);

/**
 * Transcribe a video/audio file or URL on this device.
 * @param {string|Blob} source  blob:/https: URL, or a File/Blob
 * @returns {Promise<{ captions: object[], text: string }>} word-level captions in ms from the start of the media
 */
export async function transcribeMedia(source, { engine = 'whisper-wasm', model, language = 'auto', onProgress, signal } = {}) {
  const eng = ENGINES.find((e) => e.id === engine);
  if (!eng?.file) throw new Error('That engine only works with the live microphone.');
  let url = source;
  let revoke = null;
  if (typeof Blob !== 'undefined' && source instanceof Blob) { url = URL.createObjectURL(source); revoke = url; }
  try {
    const out = await transcribeInBrowser(url, { model, language, device: eng.device, onProgress, signal });
    if (!out.captions.length) throw new Error('No speech was found in this media.');
    return out;
  } finally {
    if (revoke) URL.revokeObjectURL(revoke);
  }
}
