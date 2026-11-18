// Browser version of Recorder's captioning (scripts/captions/caption-file.ts used Whisper.cpp).
// Whisper runs in a worker in the browser (src/lib/editor/remotion/transcribe.js) and the
// result is saved as Recorder caption JSON: `<folder>/subs<endDate>.json`, an array of
// @remotion/captions Caption objects.
import type { Caption } from "@remotion/captions";
import { CAPTIONS_PREFIX, WEBCAM_PREFIX } from "../../config/cameras";
import { TRANSCRIPTION_LANGUAGE, WHISPER_MODEL } from "../../config/whisper";
import { getStaticFiles, writeStaticFile } from "../../studio/project-store";
import type { ProcessStatus } from "../components/ProcessingStatus";
import { cancelTranscribeOnServer, newTranscribeSignal } from "./cancel-transcribe";

type Transcriber = (
  src: string,
  opts: { model?: string; language?: string; signal?: AbortSignal; onProgress?: (p: { stage?: string; progress?: number }) => void },
) => Promise<{ captions: Caption[] }>;

let transcriber: Transcriber | null = null;
/** For tests. */
export const setTranscriber = (t: Transcriber | null) => {
  transcriber = t;
};

const loadTranscriber = async (): Promise<Transcriber> => {
  if (transcriber) return transcriber;
  // @ts-expect-error JS module without types
  const mod = await import("../../../../lib/editor/remotion/transcribe.js");
  return mod.transcribeInBrowser as Transcriber;
};

export const transcribeVideoOnServer = async ({
  onProgress,
  endDate,
  selectedFolder,
}: {
  onProgress: (status: ProcessStatus) => void;
  endDate: number;
  selectedFolder: string;
}) => {
  const webcam = getStaticFiles().find((f) =>
    f.name.startsWith(`${selectedFolder}/${WEBCAM_PREFIX}${endDate}.`),
  );
  if (!webcam) throw new Error(`No webcam take ${WEBCAM_PREFIX}${endDate} in ${selectedFolder}`);
  const filename = webcam.name.split("/").pop() as string;
  const abort = () => {
    cancelTranscribeOnServer();
  };
  const signal = newTranscribeSignal();
  const transcribe = await loadTranscriber();
  try {
    const { captions } = await transcribe(webcam.src, {
      model: WHISPER_MODEL,
      language: TRANSCRIPTION_LANGUAGE ?? undefined,
      signal,
      onProgress: (p) => {
        if (p.stage === "download") {
          onProgress({ title: "Downloading Whisper model", description: `${Math.round((p.progress ?? 0) * 100)}%`, abort });
          return;
        }
        onProgress({ title: `Transcribing ${filename}`, description: p.stage === "decode" ? "Reading audio..." : "In progress...", abort });
      },
    });
    await writeStaticFile({
      filePath: `${selectedFolder}/${CAPTIONS_PREFIX}${endDate}.json`,
      contents: JSON.stringify(captions, null, 2) + "\n",
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("aborted by user");
    throw e;
  }
};
