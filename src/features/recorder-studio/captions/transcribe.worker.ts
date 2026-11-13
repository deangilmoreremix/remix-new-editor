import { transcribeAudio } from "./transcribe-core";
import type { TranscribeProgress, WhisperModelId } from "./transcribe-core";

type Request = { audio: Float32Array; model: WhisperModelId; language: string | null };

self.onmessage = async (event: MessageEvent<Request>) => {
  try {
    const captions = await transcribeAudio({
      ...event.data,
      onProgress: (p: TranscribeProgress) => self.postMessage({ type: "progress", progress: p }),
    });
    self.postMessage({ type: "done", captions });
  } catch (err) {
    self.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
