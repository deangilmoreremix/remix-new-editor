// Takes in a project: each webcam recording with its display / alternative angles and captions.
// Generate captions (in-browser Whisper), import outside recordings (Recorder's "external
// recordings"), and delete takes. Recorder did these with files in public/<folder>/.
import React, { useRef, useState } from "react";
import {
  ALTERNATIVE1_PREFIX,
  ALTERNATIVE2_PREFIX,
  CAPTIONS_PREFIX,
  DISPLAY_PREFIX,
  WEBCAM_PREFIX,
} from "../config/cameras";
import { ensureSceneForEachTake } from "../app/helpers/upload-file";
import { transcribeVideoOnServer } from "../app/helpers/transcribe-video";
import type { ProcessStatus } from "../app/components/ProcessingStatus";
import { deleteStaticFile, getStaticFiles, type StaticFile, writeStaticFile } from "./project-store";

export type Take = {
  timestamp: number;
  webcam: StaticFile;
  display: StaticFile | null;
  alternative1: StaticFile | null;
  alternative2: StaticFile | null;
  captions: StaticFile | null;
};

const PREFIXES = [WEBCAM_PREFIX, DISPLAY_PREFIX, ALTERNATIVE1_PREFIX, ALTERNATIVE2_PREFIX, CAPTIONS_PREFIX] as const;

/** Takes of a project, oldest first (the order Recorder assigns them to video scenes). */
export const listTakes = (folder: string, files: StaticFile[] = getStaticFiles()): Take[] => {
  const inFolder = files.filter((f) => f.name.startsWith(`${folder}/`));
  const find = (prefix: string, ts: string) =>
    inFolder.find((f) => f.name.startsWith(`${folder}/${prefix}${ts}.`)) ?? null;
  return inFolder
    .filter((f) => f.name.startsWith(`${folder}/${WEBCAM_PREFIX}`))
    .map((webcam) => {
      const ts = webcam.name.slice(`${folder}/${WEBCAM_PREFIX}`.length).replace(/\.[^.]+$/, "");
      return {
        timestamp: Number(ts),
        webcam,
        display: find(DISPLAY_PREFIX, ts),
        alternative1: find(ALTERNATIVE1_PREFIX, ts),
        alternative2: find(ALTERNATIVE2_PREFIX, ts),
        captions: find(CAPTIONS_PREFIX, ts),
      };
    })
    .filter((t) => Number.isFinite(t.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
};

const extOf = (file: File) => {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["mp4", "webm", "mov", "mkv"].includes(fromName)) return fromName;
  return file.type.includes("webm") ? "webm" : "mp4";
};

/** Add an outside recording as a new take (or as another angle of a take). */
export const importTakeFile = async ({
  folder,
  file,
  prefix = WEBCAM_PREFIX,
  timestamp = Date.now(),
}: {
  folder: string;
  file: File;
  prefix?: (typeof PREFIXES)[number];
  timestamp?: number;
}) => {
  await writeStaticFile({ filePath: `${folder}/${prefix}${timestamp}.${extOf(file)}`, contents: file });
  if (prefix === WEBCAM_PREFIX) await ensureSceneForEachTake(folder);
  return timestamp;
};

export const deleteTake = async (take: Take) => {
  for (const f of [take.webcam, take.display, take.alternative1, take.alternative2, take.captions]) {
    if (f) await deleteStaticFile(f.name);
  }
};

const fmtSize = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

export const TakesPanel: React.FC<{ folder: string; files: StaticFile[] }> = ({ folder, files }) => {
  const takes = listTakes(folder, files);
  const importRef = useRef<HTMLInputElement>(null);
  const angleRef = useRef<HTMLInputElement>(null);
  const [angleFor, setAngleFor] = useState<{ ts: number; prefix: (typeof PREFIXES)[number] } | null>(null);
  const [status, setStatus] = useState<ProcessStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const caption = async (take: Take) => {
    setError(null);
    try {
      await transcribeVideoOnServer({ endDate: take.timestamp, selectedFolder: folder, onProgress: setStatus });
    } catch (e) {
      if (!(e as Error).message.includes("aborted by user")) setError((e as Error).message);
    } finally {
      setStatus(null);
    }
  };

  return (
    <div className="flex flex-col gap-3" data-recorder="takes-panel">
      {takes.length === 0 ? <p className="text-xs text-white/50">No takes yet. Record one in the Record tab, or import a video.</p> : null}
      <ol className="flex flex-col gap-2">
        {takes.map((take, i) => (
          <li key={take.timestamp} className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5" data-take={take.timestamp}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Take {i + 1}</span>
              <span className="text-[11px] text-white/45">{new Date(take.timestamp).toLocaleString()}</span>
              <span className="flex-1" />
              <a className="text-[11px] text-white/70 hover:text-white" href={take.webcam.src} target="_blank" rel="noreferrer">
                Watch
              </a>
              <button type="button" className="text-[11px] text-red-300 hover:text-red-200" onClick={() => confirm("Delete this take and its files?") && deleteTake(take)}>
                Delete
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">Webcam · {fmtSize(take.webcam.sizeInBytes)}</span>
              {(
                [
                  ["Screen", DISPLAY_PREFIX, take.display],
                  ["Angle 2", ALTERNATIVE1_PREFIX, take.alternative1],
                  ["Angle 3", ALTERNATIVE2_PREFIX, take.alternative2],
                ] as const
              ).map(([label, prefix, file]) =>
                file ? (
                  <span key={prefix} className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">
                    {label}
                  </span>
                ) : (
                  <button
                    key={prefix}
                    type="button"
                    className="rounded border border-dashed border-white/20 px-1.5 py-0.5 text-white/50 hover:text-white"
                    onClick={() => {
                      setAngleFor({ ts: take.timestamp, prefix });
                      angleRef.current?.click();
                    }}
                  >
                    + {label}
                  </button>
                ),
              )}
              {take.captions ? (
                <span className="rounded bg-primary/20 px-1.5 py-0.5 text-primary">Captions</span>
              ) : (
                <button type="button" data-recorder="caption-take" disabled={Boolean(status)} className="rounded bg-primary px-1.5 py-0.5 font-bold text-black disabled:opacity-40" onClick={() => caption(take)}>
                  Generate captions
                </button>
              )}
              {take.captions ? (
                <button type="button" disabled={Boolean(status)} className="rounded border border-white/15 px-1.5 py-0.5 text-white/70 hover:text-white disabled:opacity-40" onClick={() => caption(take)}>
                  Redo captions
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {status ? (
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-[11px] text-white/80">
          <span className="flex-1">
            {status.title} · {status.description}
          </span>
          {status.abort ? (
            <button type="button" className="text-red-300" onClick={() => status.abort?.()}>
              Stop
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-[11px] text-red-300">{error}</p> : null}
      <input
        ref={importRef}
        type="file"
        accept="video/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) await importTakeFile({ folder, file });
        }}
      />
      <input
        ref={angleRef}
        type="file"
        accept="video/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && angleFor) await importTakeFile({ folder, file, prefix: angleFor.prefix, timestamp: angleFor.ts });
          setAngleFor(null);
        }}
      />
      <button type="button" data-recorder="import-take" className="self-start rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white hover:border-primary/60" onClick={() => importRef.current?.click()}>
        Import a video as a take
      </button>
      <p className="text-[10px] leading-relaxed text-white/40">
        Captions are made in your browser (Whisper, downloaded once, about 80 MB). Click a caption in the
        preview to fix a word.
      </p>
    </div>
  );
};
