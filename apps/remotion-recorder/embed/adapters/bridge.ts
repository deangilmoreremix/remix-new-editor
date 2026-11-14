// Glue between the upstream Remotion Recorder UI (running unmodified inside an iframe in the editor) and the editor.
// The upstream UI talks to its own Bun server for five things (list/create folders, upload a take, transcribe, cancel). The files
// in this folder replace exactly those five modules at build time (see ../vite.config.mjs); nothing in ../src is edited.
export const CHANNEL = "remotion-recorder-embed";

/** Folder name the upstream UI shows as "Save to: public/<name>". Everything saved goes to the open editor project. */
export const EDITOR_FOLDER = "timeline-project";

export const inEditor = () => window.parent !== window;

export const toParent = (message: Record<string, unknown>) => {
  if (inEditor()) {
    window.parent.postMessage({ channel: CHANNEL, ...message }, window.location.origin);
  }
};

export const transcription: { requestId: string | null } = { requestId: null };
