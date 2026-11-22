/**
 * Speech recognition for the teleprompter's "Follow my voice": Moonshine tiny (MIT, via
 * Transformers.js, Apache-2.0), fast enough to run every second on the last few seconds of
 * microphone audio. WebGPU when available, WASM otherwise. Nothing leaves the device.
 *
 * in:  { type: 'load' } | { type: 'hear', id, audio: Float32Array (16 kHz mono) }
 * out: { type: 'progress', progress } | { type: 'ready' } | { type: 'text', id, text } | { type: 'error', message }
 */
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

const MODEL = 'onnx-community/moonshine-tiny-ONNX';
let asr = null;

async function load() {
  if (asr) return asr;
  const hasGpu = !!(self.navigator?.gpu && await self.navigator.gpu.requestAdapter().catch(() => null));
  const files = new Map();
  asr = pipeline('automatic-speech-recognition', MODEL, {
    device: hasGpu ? 'webgpu' : 'wasm',
    dtype: hasGpu ? 'fp32' : 'q8',
    progress_callback: (e) => {
      if (e.status !== 'progress' || !e.total) return;
      files.set(e.file, [e.loaded, e.total]);
      const [l, t] = [...files.values()].reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
      self.postMessage({ type: 'progress', progress: t ? l / t : 0 });
    },
  });
  asr.catch(() => { asr = null; });
  await asr;
  self.postMessage({ type: 'ready' });
  return asr;
}

self.onmessage = async ({ data }) => {
  try {
    if (data?.type === 'load') { await load(); return; }
    if (data?.type !== 'hear') return;
    const run = await load();
    const out = await run(data.audio);
    self.postMessage({ type: 'text', id: data.id, text: String(out?.text || '').trim() });
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err?.message || err) });
  }
};
