/**
 * In-browser speech-to-text (Whisper via Transformers.js, Apache-2.0;
 * Whisper weights MIT). Runs off the main thread; WebGPU when available,
 * WASM otherwise. The model downloads once and is cached by the browser.
 *
 * in:  { type: 'transcribe', id, audio: Float32Array (16 kHz mono), model, language }
 * out: { type: 'progress', id, stage, progress } | { type: 'done', id, chunks, text } | { type: 'error', id, message }
 */
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

const pipes = new Map();

async function getPipe(model, id) {
  if (pipes.has(model)) return pipes.get(model);
  const hasGpu = !!(self.navigator?.gpu && await self.navigator.gpu.requestAdapter().catch(() => null));
  const files = new Map();
  const p = pipeline('automatic-speech-recognition', model, {
    device: hasGpu ? 'webgpu' : 'wasm',
    dtype: hasGpu ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
    progress_callback: (e) => {
      if (e.status !== 'progress' || !e.total) return;
      files.set(e.file, [e.loaded, e.total]);
      const [loaded, total] = [...files.values()].reduce((a, [l, t]) => [a[0] + l, a[1] + t], [0, 0]);
      self.postMessage({ type: 'progress', id, stage: 'download', progress: total ? loaded / total : 0 });
    },
  });
  pipes.set(model, p);
  p.catch(() => pipes.delete(model));
  return p;
}

self.onmessage = async ({ data }) => {
  if (data?.type !== 'transcribe') return;
  const { id, audio, model = 'onnx-community/whisper-base_timestamped', language } = data;
  try {
    const asr = await getPipe(model, id);
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
