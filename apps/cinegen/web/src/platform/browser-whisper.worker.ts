// Runs Whisper in the browser with Transformers.js (WebGPU when available,
// WASM otherwise). Free and keyless: the model is downloaded once from the
// Hugging Face CDN and cached by the browser.

import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

export interface WhisperWorkerRequest {
  id: string;
  audio: Float32Array;
  model: string;
  language?: string;
}

export type WhisperWorkerMessage =
  | { id: string; type: 'status'; message: string }
  | { id: string; type: 'done'; text: string; chunks: Array<{ text: string; timestamp: [number, number | null] }> }
  | { id: string; type: 'error'; error: string };

const pipelines = new Map<string, Promise<AutomaticSpeechRecognitionPipeline>>();

async function hasWebGpu(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return Boolean(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

function loadPipeline(model: string, report: (message: string) => void) {
  let pending = pipelines.get(model);
  if (!pending) {
    pending = (async () => {
      const webgpu = await hasWebGpu();
      report(`Loading Whisper model (${webgpu ? 'WebGPU' : 'WASM'}) — first run downloads it`);
      // Cast: the pipeline() overloads are too complex for TypeScript to infer here.
      const createPipeline = pipeline as unknown as (
        task: 'automatic-speech-recognition', modelId: string, options: Record<string, unknown>,
      ) => Promise<AutomaticSpeechRecognitionPipeline>;
      return (await createPipeline('automatic-speech-recognition', model, {
        device: webgpu ? 'webgpu' : 'wasm',
        dtype: webgpu ? 'fp32' : 'q8',
        progress_callback: (info: { status?: string; progress?: number; file?: string }) => {
          if (info.status === 'progress' && typeof info.progress === 'number' && info.file?.endsWith('.onnx')) {
            report(`Downloading model ${Math.round(info.progress)}%`);
          }
        },
      })) as AutomaticSpeechRecognitionPipeline;
    })();
    pending.catch(() => pipelines.delete(model));
    pipelines.set(model, pending);
  }
  return pending;
}

self.onmessage = async (event: MessageEvent<WhisperWorkerRequest>) => {
  const { id, audio, model, language } = event.data;
  const post = (message: WhisperWorkerMessage) => (self as unknown as Worker).postMessage(message);
  try {
    const transcriber = await loadPipeline(model, (message) => post({ id, type: 'status', message }));
    post({ id, type: 'status', message: 'Transcribing in your browser' });
    const output = await transcriber(audio, {
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
      ...(language && language !== 'auto' ? { language } : {}),
    });
    const result = Array.isArray(output) ? output[0] : output;
    post({
      id,
      type: 'done',
      text: String(result?.text ?? '').trim(),
      chunks: (result?.chunks ?? []) as Array<{ text: string; timestamp: [number, number | null] }>,
    });
  } catch (error) {
    post({ id, type: 'error', error: error instanceof Error ? error.message : String(error) });
  }
};
