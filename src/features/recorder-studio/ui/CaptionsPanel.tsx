import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { captionsFileName } from "../project";
import type { RecorderProject } from "../project";
import { COMPOSITION_ID } from "../project-store";
import { deleteStaticFile, getStaticFiles } from "../studio-shim";
import { transcribeTake } from "../captions/transcribe";
import type { TranscribeProgress, WhisperModelId } from "../captions/transcribe-core";
import { Field, Select } from "./controls";

const LANGUAGES = [
  { value: "english", label: "English" },
  { value: "spanish", label: "Spanish" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
  { value: "italian", label: "Italian" },
  { value: "portuguese", label: "Portuguese" },
  { value: "dutch", label: "Dutch" },
  { value: "japanese", label: "Japanese" },
  { value: "chinese", label: "Chinese" },
  { value: "hindi", label: "Hindi" },
] as const;

type Provider = "browser" | "cloud";

type Job = { timestamp: number; progress: TranscribeProgress | null };

export const CaptionsPanel = ({ project }: { project: RecorderProject }) => {
  const { store } = project;
  // Re-render on any project change (files and scenes).
  useSyncExternalStore(store.subscribe, store.getRevision);
  useSyncExternalStore(store.subscribe, store.getProps);

  const [model, setModel] = useState<WhisperModelId>("base");
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]["value"]>("english");
  const [provider, setProvider] = useState<Provider>("browser");
  const [cloudAvailable, setCloudAvailable] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let live = true;
    import("../../../lib/apiKeyManager.js")
      .then((m) => live && setCloudAvailable(Boolean(m.apiKeyManager?.hasOpenAIKey?.())))
      .catch(() => {});
    return () => {
      live = false;
      abort.current?.abort();
    };
  }, []);

  const files = getStaticFiles();
  const takes = project.takeTimestamps();

  const generate = async (timestamp: number) => {
    const source = files.find((f) => f.name.startsWith(`${COMPOSITION_ID}/webcam${timestamp}.`));
    if (!source) return;
    setError("");
    setJob({ timestamp, progress: null });
    abort.current = new AbortController();
    try {
      const blob = await (await fetch(source.src)).blob();
      const captions = await transcribeTake(blob, {
        provider,
        model,
        language: language === "english" ? null : language,
        signal: abort.current.signal,
        onProgress: (progress) => setJob({ timestamp, progress }),
      });
      if (!captions.length) throw new Error("No speech was found in this recording.");
      project.setCaptions(timestamp, captions);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message || "Transcription failed.");
    } finally {
      setJob(null);
    }
  };

  const pct = job?.progress?.progress != null ? Math.round(job.progress.progress * 100) : null;

  return (
    <>
      <div className="rs-row">
        <Field label="Language">
          <Select value={language} options={[...LANGUAGES]} onChange={setLanguage} />
        </Field>
        <Field label="Quality">
          <Select value={model} options={[{ value: "tiny", label: "Fast (tiny)" }, { value: "base", label: "Better (base)" }]} onChange={setModel} />
        </Field>
      </div>
      {cloudAvailable ? (
        <Field label="Transcribe with">
          <Select value={provider} options={[{ value: "browser", label: "This browser (private)" }, { value: "cloud", label: "Cloud (Whisper API)" }]} onChange={setProvider} />
        </Field>
      ) : null}
      <span className="rs-hint">
        {provider === "browser"
          ? "Runs on your device; your audio never leaves the browser. The speech model (about 80 to 150 MB) downloads once, then is cached."
          : "Sends the audio to the transcription service."}
        {language !== "english" ? " Non-English accuracy is lower with these small models." : ""}
      </span>

      {takes.length === 0 ? <span className="rs-hint">Record a take first.</span> : null}

      {takes.map((timestamp, i) => {
        const has = files.some((f) => f.name === captionsFileName(timestamp));
        const busy = job?.timestamp === timestamp;
        return (
          <div className="rs-card" key={timestamp}>
            <div className="rs-row">
              <strong style={{ marginRight: "auto", fontSize: 13 }}>Recording {i + 1}</strong>
              <span className={`rs-badge${has ? " ok" : ""}`}>{has ? "Captions ready" : "No captions"}</span>
            </div>
            {busy ? (
              <>
                <div className="rs-bar"><i style={{ width: `${pct ?? 100}%` }} /></div>
                <span className="rs-hint">
                  {job?.progress?.stage === "loading-model" ? `Downloading speech model${pct !== null ? ` ${pct}%` : ""}…` : "Transcribing…"}
                </span>
                <button className="rs-btn" onClick={() => abort.current?.abort()}>Cancel</button>
              </>
            ) : (
              <div className="rs-row">
                <button className="rs-btn primary" disabled={job !== null} onClick={() => void generate(timestamp)}>
                  {has ? "Regenerate captions" : "Generate captions"}
                </button>
                {has ? (
                  <button className="rs-btn danger" onClick={() => void deleteStaticFile(captionsFileName(timestamp)).then(() => store.bumpRevision())}>
                    Remove
                  </button>
                ) : null}
              </div>
            )}
          </div>
        );
      })}

      {error ? <span className="rs-hint" style={{ color: "#fca5a5" }} role="alert">{error}</span> : null}
      <span className="rs-hint">Click any caption in the preview to correct its words. Captions also trim silence at the start and end of each recording.</span>
    </>
  );
};
