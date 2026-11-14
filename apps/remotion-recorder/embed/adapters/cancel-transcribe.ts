// Replaces src/helpers/cancel-transcribe.ts.
import { toParent, transcription } from "./bridge";

export const cancelTranscribeOnServer = async () => {
  if (transcription.requestId) {
    toParent({ type: "cancel-transcribe", requestId: transcription.requestId });
  }
};
