// Browser version: stops the in-browser Whisper run started by transcribe-video.ts.
let controller: AbortController | null = null;

export const newTranscribeSignal = () => {
  controller = new AbortController();
  return controller.signal;
};

export const cancelTranscribeOnServer = async () => {
  controller?.abort();
};
