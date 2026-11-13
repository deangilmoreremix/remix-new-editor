// Public transcription API for Recorder Studio.
//   "browser": private, in-browser Whisper (transformers.js) in a Web Worker. Default.
//   "cloud":   the editor's existing Whisper service (needs an API key or proxy).
import type { Caption } from "@remotion/captions";
import { decodeToMono16k } from "./audio";
import { fromServiceSegments } from "./to-captions";
import type { TranscribeProgress, WhisperModelId } from "./transcribe-core";

export type TranscribeOptions = {
  provider?: "browser" | "cloud";
  model?: WhisperModelId;
  language?: string | null; // null = English
  onProgress?: (p: TranscribeProgress) => void;
  signal?: AbortSignal;
};

const runInWorker = (audio: Float32Array, model: WhisperModelId, language: string | null, onProgress: (p: TranscribeProgress) => void, signal?: AbortSignal) =>
  new Promise<Caption[]>((resolve, reject) => {
    const worker = new Worker(new URL("./transcribe.worker.ts", import.meta.url), { type: "module" });
    const finish = (fn: () => void) => {
      signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      fn();
    };
    const onAbort = () => finish(() => reject(new DOMException("Transcription cancelled", "AbortError")));
    signal?.addEventListener("abort", onAbort);
    worker.onmessage = (e: MessageEvent<{ type: string; progress?: TranscribeProgress; captions?: Caption[]; message?: string }>) => {
      if (e.data.type === "progress") onProgress(e.data.progress!);
      else if (e.data.type === "done") finish(() => resolve(e.data.captions!));
      else finish(() => reject(new Error(e.data.message ?? "Transcription failed")));
    };
    worker.onerror = (e) => finish(() => reject(new Error(e.message || "Transcription worker crashed")));
    worker.postMessage({ audio, model, language }, [audio.buffer]);
  });

const runInCloud = async (blob: Blob, language: string | null): Promise<Caption[]> => {
  const { whisperService } = await import("../../../services/whisper-client.js");
  const result = await whisperService.transcribe(blob, { language: language ?? "auto", wordTimestamps: true });
  const captions = fromServiceSegments(result.segments ?? []);
  if (!captions.length) throw new Error("The transcription service returned no word timings.");
  return captions;
};

export const transcribeTake = async (blob: Blob, options: TranscribeOptions = {}): Promise<Caption[]> => {
  const { provider = "browser", model = "base", language = null, onProgress = () => {}, signal } = options;
  if (provider === "cloud") return runInCloud(blob, language);
  const audio = await decodeToMono16k(blob);
  return runInWorker(audio, model, language, onProgress, signal);
};
