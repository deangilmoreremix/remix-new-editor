import { useEffect, useRef, useState } from "react";
import { renderStudio } from "../export";
import type { ExportResult } from "../export";
import type { MetadataState } from "../useStudioMetadata";
import { Check } from "./controls";

const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

export const ExportPanel = ({
  state,
  landscape,
  onAddToTimeline,
}: {
  state: MetadataState;
  landscape: boolean;
  onAddToTimeline?: (result: ExportResult) => void;
}) => {
  const [burn, setBurn] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => { abort.current?.abort(); }, []);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const ready = state.status === "ready" ? state.metadata : null;
  const rendering = progress !== null;

  const run = async () => {
    if (!ready) return;
    setError("");
    setResult(null);
    setResultUrl(null);
    setProgress(0);
    abort.current = new AbortController();
    try {
      const out = await renderStudio({ metadata: ready, burnLandscapeCaptions: burn, onProgress: setProgress, signal: abort.current.signal });
      setResult(out);
      setResultUrl(URL.createObjectURL(out.blob));
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message || "Export failed.");
    } finally {
      setProgress(null);
    }
  };

  return (
    <>
      {landscape ? <Check checked={burn} onChange={setBurn} label="Burn captions into the video" /> : null}
      {landscape ? <span className="rs-hint">{burn ? "Captions are part of the video." : "Captions are saved as a separate .srt file you can upload to YouTube."}</span> : null}

      {rendering ? (
        <>
          <div className="rs-bar"><i style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} /></div>
          <span className="rs-hint">Rendering… {Math.round((progress ?? 0) * 100)}%. Keep this tab open.</span>
          <button className="rs-btn" onClick={() => abort.current?.abort()}>Cancel</button>
        </>
      ) : (
        <button className="rs-btn primary" disabled={!ready} onClick={() => void run()}>
          {result ? "Render again" : "Render video"}
        </button>
      )}
      {!ready && !rendering ? <span className="rs-hint">Add a recording or scene to enable export.</span> : null}
      {error ? <span className="rs-hint" style={{ color: "#fca5a5" }} role="alert">{error}</span> : null}

      {result && resultUrl ? (
        <div className="rs-card">
          <video className="rs-video" src={resultUrl} controls />
          <span className="rs-hint">
            {result.container.toUpperCase()} · {(result.blob.size / 1024 / 1024).toFixed(1)} MB · {result.durationInSeconds.toFixed(1)} s
          </span>
          <div className="rs-row">
            {onAddToTimeline ? <button className="rs-btn primary" onClick={() => onAddToTimeline(result)}>Add to timeline</button> : null}
            <button className="rs-btn" onClick={() => download(result.blob, `recorder-studio.${result.container}`)}>Download video</button>
            {result.srt.trim() ? <button className="rs-btn" onClick={() => download(new Blob([result.srt], { type: "text/plain" }), "captions.srt")}>Download .srt</button> : null}
          </div>
        </div>
      ) : null}
    </>
  );
};
