// Replaces src/helpers/transcribe-video.ts: the editor transcribes the take (in-browser Whisper) and reports progress back.
import type { ProcessStatus } from "../../src/components/ProcessingStatus";
import { CHANNEL, inEditor, toParent, transcription } from "./bridge";
import { cancelTranscribeOnServer } from "./cancel-transcribe";

export const transcribeVideoOnServer = async ({
  onProgress,
  endDate,
  selectedFolder,
}: {
  onProgress: (status: ProcessStatus) => void;
  endDate: number;
  selectedFolder: string;
}) => {
  if (!inEditor()) return; // no transcription service when opened on its own

  const requestId = `${endDate}-${Math.random().toString(36).slice(2)}`;
  transcription.requestId = requestId;

  await new Promise<void>((resolve, reject) => {
    const finish = (fn: () => void) => {
      window.removeEventListener("message", onMessage);
      transcription.requestId = null;
      fn();
    };
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.channel !== CHANNEL || data.requestId !== requestId) return;
      if (data.type === "transcribe-progress") {
        onProgress({ title: data.title, description: data.description, abort: () => cancelTranscribeOnServer() });
      } else if (data.type === "transcribe-done") {
        finish(resolve);
      } else if (data.type === "transcribe-aborted") {
        finish(() => reject(new Error("aborted by user"))); // the exact phrase UseThisTake.tsx looks for
      } else if (data.type === "transcribe-error") {
        finish(() => reject(new Error(data.message)));
      }
    };
    window.addEventListener("message", onMessage);
    toParent({ type: "transcribe", requestId, endDate, folder: selectedFolder });
  });
};
