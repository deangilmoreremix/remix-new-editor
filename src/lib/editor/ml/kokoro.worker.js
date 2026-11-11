/**
 * Free text-to-speech on the user's device: Kokoro-82M (Apache-2.0) via
 * kokoro-js. Kept in its own worker because kokoro-js ships its own
 * Transformers.js build.
 *
 * in:  { id, task: 'speak', input: { text, voice, speed } } | { id, task: 'preload' }
 * out: { id, type: 'progress', progress } | { id, type: 'done', result: { wav: Blob } } | { id, type: 'error', message }
 */
import { KokoroTTS, env } from 'kokoro-js';
// kokoro-js pins Transformers.js 3.x, which would load its ONNX runtime from
// a CDN. Serve that exact runtime from our own bundle instead.
import ortMjs from '../../../../node_modules/kokoro-js/node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs?url';
import ortWasm from '../../../../node_modules/kokoro-js/node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import { LOCAL_MODELS } from './modelRegistry.js';

env.wasmPaths = { mjs: new URL(ortMjs, self.location.href).href, wasm: new URL(ortWasm, self.location.href).href };

let ttsPromise = null;

function load(id) {
  if (ttsPromise) return ttsPromise;
  ttsPromise = (async () => {
    const gpu = !!(self.navigator?.gpu && await self.navigator.gpu.requestAdapter().catch(() => null));
    const files = new Map();
    return KokoroTTS.from_pretrained(LOCAL_MODELS.kokoro.id, {
      device: gpu ? 'webgpu' : 'wasm',
      dtype: gpu ? 'fp32' : 'q8',
      progress_callback: (e) => {
        if (e.status !== 'progress' || !e.total) return;
        files.set(e.file, [e.loaded, e.total]);
        const [l, t] = [...files.values()].reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
        self.postMessage({ id, type: 'progress', stage: 'download', model: 'kokoro', progress: t ? l / t : 0 });
      },
    });
  })();
  ttsPromise.catch(() => { ttsPromise = null; });
  return ttsPromise;
}

self.onmessage = async ({ data }) => {
  const { id, task, input = {} } = data || {};
  if (!id) return;
  try {
    const tts = await load(id);
    if (task === 'preload') { self.postMessage({ id, type: 'done', result: { key: 'kokoro' } }); return; }
    if (task !== 'speak') throw new Error(`Unknown task: ${task}`);
    const text = String(input.text || '').trim();
    if (!text) throw new Error('Nothing to say');
    const audio = await tts.generate(text, { voice: input.voice || 'af_heart', speed: Number(input.speed) || 1 });
    const wav = audio.toBlob();
    self.postMessage({ id, type: 'done', result: { wav, duration: audio.audio.length / audio.sampling_rate } });
  } catch (err) {
    self.postMessage({ id, type: 'error', message: String(err?.message || err) });
  }
};
