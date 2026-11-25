/**
 * Whisper WebGPU for the Template Generator's captions, off the main thread: the `@remotion/whisper-webgpu` package
 * (Whisper through Transformers.js, on the GPU). The package needs WebGPU; without it, it fails with "no available backend" and the
 * caller moves to the editor's built-in Whisper, which also runs on the CPU. A worker keeps the page usable while it listens.
 *
 * in:  { type: 'transcribe', id, audio: Float32Array (16 kHz mono), model, language }
 * out: { type: 'progress', id, stage: 'download' | 'transcribe', progress } | { type: 'done', id, words: [{ text, startInSeconds, endInSeconds }] }
 *    | { type: 'error', id, message, fallback?: true }   (`fallback`: the package cannot run here, the caller may use the older engine)
 */
import { transcribe, downloadWhisperModel } from '@remotion/whisper-webgpu';

self.onmessage = async ({ data }) => {
  if (data?.type !== 'transcribe') return;
  const { id, audio, model, language } = data;
  try {
    // the package wants the model fetched explicitly first (cached by the browser, so this is instant from the second time)
    const frac = (p) => (p?.progress == null ? 0 : Math.min(1, p.progress > 1 ? p.progress / 100 : p.progress));
    await downloadWhisperModel({ model, onProgress: (p) => self.postMessage({ type: 'progress', id, stage: 'download', progress: frac(p) }) });
    self.postMessage({ type: 'progress', id, stage: 'transcribe', progress: 0 });
    const out = await transcribe({
      channelWaveform: audio,
      model,
      ...(language && language !== 'auto' ? { language } : {}),
      onModelLoadProgress: (p) => self.postMessage({ type: 'progress', id, stage: 'download', progress: frac(p) }),
    });
    self.postMessage({ type: 'done', id, words: out.words });
  } catch (err) {
    self.postMessage({ type: 'error', id, message: err?.message || String(err), fallback: true });
  }
};
