/**
 * In-browser speech-to-text (Whisper via Transformers.js, Apache-2.0;
 * Whisper weights MIT). Runs off the main thread; WebGPU when available,
 * WASM otherwise. The model downloads once and is cached by the browser.
 *
 * in:  { type: 'transcribe', id, audio: Float32Array (16 kHz mono), model, language, device: 'auto' | 'webgpu' | 'wasm' }
 * out: { type: 'progress', id, stage, progress } | { type: 'done', id, chunks, text } | { type: 'error', id, message }
 */
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

const pipes = new Map();

// device: 'auto' (WebGPU when the browser has it, else WebAssembly), 'webgpu' or 'wasm'.
// A WebGPU pipeline that fails to build (missing op, lost device) is retried on WebAssembly.
async function getPipe(model, id, device = 'auto') {
  const hasGpu = device !== 'wasm' && !!(self.navigator?.gpu && await self.navigator.gpu.requestAdapter().catch(() => null));
  const key = `${model}|${hasGpu ? 'webgpu' : 'wasm'}`;
  if (pipes.has(key)) return pipes.get(key);
  const files = new Map();
  const build = (gpu) => pipeline('automatic-speech-recognition', model, {
    device: gpu ? 'webgpu' : 'wasm',
    dtype: gpu ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
    progress_callback: (e) => {
      if (e.status !== 'progress' || !e.total) return;
      files.set(e.file, [e.loaded, e.total]);
      const [loaded, total] = [...files.values()].reduce((a, [l, t]) => [a[0] + l, a[1] + t], [0, 0]);
      self.postMessage({ type: 'progress', id, stage: 'download', progress: total ? loaded / total : 0 });
    },
  });
  const p = hasGpu && device === 'auto' ? build(true).catch(() => build(false)) : build(hasGpu);
  pipes.set(key, p);
  p.catch(() => pipes.delete(key));
  return p;
}

self.onmessage = async ({ data }) => {
  if (data?.type !== 'transcribe') return;
  const { id, audio, model = 'onnx-community/whisper-base_timestamped', language, device = 'auto' } = data;
  try {
    const asr = await getPipe(model, id, device);
    self.postMessage({ type: 'progress', id, stage: 'transcribe', progress: 0 });
    const opts = { chunk_length_s: 30, stride_length_s: 5, task: 'transcribe', ...(language && language !== 'auto' ? { language } : {}) };
    let out;
    try {
      out = await asr(audio, { ...opts, return_timestamps: 'word' });
    } catch {
      out = await asr(audio, { ...opts, return_timestamps: true }); // sentence-level fallback
    }
    self.postMessage({ type: 'done', id, text: out.text || '', chunks: out.chunks || [] });
  } catch (err) {
    self.postMessage({ type: 'error', id, message: String(err?.message || err) });
  }
};
