// In-browser Whisper through transformers.js. Runs in a worker (see transcribe.ts) but has
// no worker-specific code so it can also run on the main thread or in Node for tests.
import type { Caption } from "@remotion/captions";
import { fromWordChunks } from "./to-captions";

export type WhisperModelId = "tiny" | "base";
export type TranscribeProgress = { stage: "loading-model" | "transcribing"; progress: number | null; detail?: string };

const MODEL_IDS: Record<WhisperModelId, { en: string; multilingual: string }> = {
  tiny: { en: "Xenova/whisper-tiny.en", multilingual: "Xenova/whisper-tiny" },
  base: { en: "Xenova/whisper-base.en", multilingual: "Xenova/whisper-base" },
};

export const modelFor = (model: WhisperModelId, language: string | null) =>
  language === null || language === "en" ? MODEL_IDS[model].en : MODEL_IDS[model].multilingual;

type Transcriber = (audio: Float32Array, options: Record<string, unknown>) => Promise<{ text: string; chunks?: { text: string; timestamp: [number, number | null] }[] }>;

let cache: { id: string; promise: Promise<Transcriber> } | null = null;

const loadTranscriber = (id: string, onProgress: (p: TranscribeProgress) => void, device?: string): Promise<Transcriber> => {
  const key = `${id}|${device ?? "auto"}`;
  if (cache?.id === key) return cache.promise;
  const promise = (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    // Same settings as the editor's other in-browser models (src/lib/editor/ml/ml.worker.js).
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    const hasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator;
    const make = (dev: string) =>
      pipeline("automatic-speech-recognition", id, {
        device: dev,
        dtype: dev === "webgpu" ? "fp32" : "q8",
        progress_callback: (p: { status?: string; progress?: number; file?: string }) => {
          if (p.status === "progress" && typeof p.progress === "number") {
            onProgress({ stage: "loading-model", progress: p.progress / 100, detail: p.file });
          }
        },
      } as never) as unknown as Promise<Transcriber>;
    if (device) return make(device); // explicit choice (tests / Node: "cpu")
    try {
      return await make(hasWebGpu ? "webgpu" : "wasm");
    } catch (err) {
      if (!hasWebGpu) throw err;
      return make("wasm"); // WebGPU can fail on some drivers; WASM always works
    }
  })();
  cache = { id: key, promise };
  promise.catch(() => {
    if (cache?.promise === promise) cache = null;
  });
  return promise;
};

export const transcribeAudio = async ({
  audio,
  model = "base",
  language = null,
  onProgress = () => {},
  device,
}: {
  device?: string;
  audio: Float32Array;
  model?: WhisperModelId;
  language?: string | null;
  onProgress?: (p: TranscribeProgress) => void;
}): Promise<Caption[]> => {
  const transcriber = await loadTranscriber(modelFor(model, language), onProgress, device);
  onProgress({ stage: "transcribing", progress: null });
  const result = await transcriber(audio, {
    return_timestamps: "word",
    chunk_length_s: 30,
    stride_length_s: 5,
    ...(language && language !== "en" ? { language, task: "transcribe" } : {}),
  });
  return fromWordChunks(result.chunks ?? []);
};
