/**
 * Free, on-device speech-to-text engines. Nothing here calls a paid API or uploads audio.
 *
 *   whisper-webgpu  Transformers.js + Whisper on the GPU       word timestamps   fastest
 *   whisper-wasm    Transformers.js + Whisper on WebAssembly   word timestamps   works in any modern browser
 *   webspeech       Web Speech API (live microphone only)      approximate word timing, on-device where the browser offers it
 */
import { transcribeInBrowser, WHISPER_MODELS } from './transcribeClient.js';

export { WHISPER_MODELS };

const WHISPER_LANGUAGES = 'en English|zh Chinese|de German|es Spanish|ru Russian|ko Korean|fr French|ja Japanese|pt Portuguese|tr Turkish|pl Polish|ca Catalan|nl Dutch|ar Arabic|sv Swedish|it Italian|id Indonesian|hi Hindi|fi Finnish|vi Vietnamese|he Hebrew|uk Ukrainian|el Greek|ms Malay|cs Czech|ro Romanian|da Danish|hu Hungarian|ta Tamil|no Norwegian|th Thai|ur Urdu|hr Croatian|bg Bulgarian|lt Lithuanian|la Latin|mi Maori|ml Malayalam|cy Welsh|sk Slovak|te Telugu|fa Persian|lv Latvian|bn Bengali|sr Serbian|az Azerbaijani|sl Slovenian|kn Kannada|et Estonian|mk Macedonian|br Breton|eu Basque|is Icelandic|hy Armenian|ne Nepali|mn Mongolian|bs Bosnian|kk Kazakh|sq Albanian|sw Swahili|gl Galician|mr Marathi|pa Punjabi|si Sinhala|km Khmer|sn Shona|yo Yoruba|so Somali|af Afrikaans|oc Occitan|ka Georgian|be Belarusian|tg Tajik|sd Sindhi|gu Gujarati|am Amharic|yi Yiddish|lo Lao|uz Uzbek|fo Faroese|ht Haitian Creole|ps Pashto|tk Turkmen|nn Nynorsk|mt Maltese|sa Sanskrit|lb Luxembourgish|my Myanmar|bo Tibetan|tl Tagalog|mg Malagasy|as Assamese|tt Tatar|haw Hawaiian|ln Lingala|ha Hausa|ba Bashkir|jw Javanese|su Sundanese';
/** 'Detect language' first, English second, then the other 98 languages Whisper can transcribe, A–Z. */
export const CAPTION_LANGUAGES = [
  ['auto', 'Detect language'],
  ...WHISPER_LANGUAGES.split('|').map((p) => { const i = p.indexOf(' '); return [p.slice(0, i), p.slice(i + 1)]; })
    .sort((a, b) => (a[0] === 'en' ? -1 : b[0] === 'en' ? 1 : a[1].localeCompare(b[1]))),
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
