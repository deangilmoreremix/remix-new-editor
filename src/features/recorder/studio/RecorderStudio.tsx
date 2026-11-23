// The Remotion Recorder, in the browser: Record (Recorder's recording app), Edit (the
// composition in a Player with scene, take and caption tools, replacing Remotion Studio) and
// Export (@remotion/web-renderer). Projects and takes stay in this browser (project-store.ts).
import { Player, type PlayerRef } from "@remotion/player";
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import App from "../app/App";
import { loadSelectedFolder, persistSelectedFolder } from "../app/helpers/get-folders";
import { Main, type MainProps } from "../remotion/Main";
import { computeComposition, projectProps, type ProjectComposition } from "./composition";
import { exportProject, type ExportResult } from "./export";
import { emptyProjectProps } from "./project-defaults";
import { ProjectIdProvider } from "./project-context";
import {
  createFolder,
  deleteFolder,
  FOLDER_RE,
  getStaticFiles,
  listFolders,
  loadProjectStore,
  setProps,
  subscribeProjectStore,
} from "./project-store";
import { ScenesPanel } from "./ScenesPanel";
import { TakesPanel } from "./TakesPanel";

export type RecorderVideo = ExportResult & { name: string };

export type RecorderStudioProps = {
  /** When set, Export offers "Use this video" (e.g. the Outreach studio's Record step). */
  onUseVideo?: (video: RecorderVideo) => void;
  onClose?: () => void;
  initialTab?: Tab;
};

type Tab = "record" | "edit" | "export";

let storeVersion = 0;
const subscribe = (cb: () => void) =>
  subscribeProjectStore(() => {
    storeVersion += 1;
    cb();
  });
const useStoreVersion = () => useSyncExternalStore(subscribe, () => storeVersion);

const tabBtn = (active: boolean) =>
  `rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${active ? "bg-primary text-black" : "text-white/70 hover:text-white"}`;

const ProjectPicker: React.FC<{ folder: string | null; setFolder: (f: string) => void }> = ({ folder, setFolder }) => {
  useStoreVersion();
  const folders = listFolders();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    try {
      await createFolder(name, emptyProjectProps());
      setFolder(name);
      setName("");
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Project"
        data-recorder="project-select"
        className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white"
        value={folder ?? ""}
        onChange={(e) => setFolder(e.target.value)}
      >
        {folder === null ? <option value="">No project</option> : null}
        {folders.map((f) => (
          <option key={f} value={f} className="bg-neutral-900">
            {f}
          </option>
        ))}
      </select>
      <input
        aria-label="New project name"
        className="w-36 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white"
        placeholder="new-project"
        value={name}
        onChange={(e) => setName(e.target.value.trim())}
      />
      <button type="button" disabled={!FOLDER_RE.test(name)} className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-white disabled:opacity-40" onClick={create}>
        Create
      </button>
      {error ? <span className="text-[11px] text-red-300">{error}</span> : null}
    </div>
  );
};

const useComposition = (folder: string | null) => {
  const version = useStoreVersion();
  const [comp, setComp] = useState<ProjectComposition | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!folder) {
      setComp(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      computeComposition(folder)
        .then((c) => {
          if (!cancelled) {
            setComp(c);
            setError(null);
          }
        })
        .catch((e: Error) => !cancelled && setError(e.message));
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [folder, version]);
  return { comp, error };
};

const fmt = (frames: number, fps: number) => {
  const s = Math.max(0, Math.floor(frames / fps));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const PlaybackBar: React.FC<{ player: React.RefObject<PlayerRef | null>; durationInFrames: number; fps: number }> = ({
  player,
  durationInFrames,
  fps,
}) => {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("seeked", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    p.addEventListener("ended", onPause);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("seeked", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
      p.removeEventListener("ended", onPause);
    };
  }, [player]);
  return (
    <div className="flex items-center gap-3" data-recorder="playback">
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-black"
        onClick={() => player.current?.toggle()}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <input
        type="range"
        aria-label="Position"
        className="flex-1 accent-[#d9ff00]"
        min={0}
        max={Math.max(0, durationInFrames - 1)}
        value={Math.min(frame, durationInFrames - 1)}
        onChange={(e) => player.current?.seekTo(Number(e.target.value))}
      />
      <span className="w-20 text-right text-[11px] tabular-nums text-white/60">
        {fmt(frame, fps)} / {fmt(durationInFrames, fps)}
      </span>
    </div>
  );
};

const EditView: React.FC<{ folder: string }> = ({ folder }) => {
  const version = useStoreVersion();
  const { comp, error } = useComposition(folder);
  const player = useRef<PlayerRef>(null);
  const [side, setSide] = useState<"scenes" | "takes">("scenes");
  const props = useMemo(() => projectProps(folder), [folder, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const files = useMemo(() => getStaticFiles(), [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const component = useMemo(() => {
    const C: React.FC<MainProps> = (p) => (
      <ProjectIdProvider projectId={folder} editing>
        <Main {...p} />
      </ProjectIdProvider>
    );
    return C;
  }, [folder]);

  const save = useCallback((next: MainProps) => {
    const { scenesAndMetadata: _computed, ...rest } = next;
    setProps(folder, { ...rest, scenesAndMetadata: [] });
  }, [folder]);

  // Dev builds only: lets browser checks seek the preview.
  useEffect(() => {
    if (!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) return;
    const w = window as unknown as { __rrSeek?: (f: number) => void };
    w.__rrSeek = (f) => player.current?.seekTo(f);
    return () => {
      delete w.__rrSeek;
    };
  }, []);

  const seekToScene = (i: number) => {
    const s = comp?.props.scenesAndMetadata[i];
    if (s) player.current?.seekTo(s.from);
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto p-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
      <div className="flex min-h-0 flex-col gap-2">
        {comp ? (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black" data-recorder="player">
            <Player
              ref={player}
              component={component}
              inputProps={comp.props}
              durationInFrames={comp.durationInFrames}
              compositionWidth={comp.width}
              compositionHeight={comp.height}
              fps={comp.fps}
              // Clicks in the video edit it (captions, scene tools), as in Remotion Studio, so the
              // playback controls sit under the video instead of over the captions.
              clickToPlay={false}
              style={{ width: "100%", aspectRatio: `${comp.width} / ${comp.height}`, maxHeight: "70vh" }}
              acknowledgeRemotionLicense
            />
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-xl border border-white/10 text-xs text-white/50">
            {error ?? "Loading project…"}
          </div>
        )}
        {comp ? <PlaybackBar player={player} durationInFrames={comp.durationInFrames} fps={comp.fps} /> : null}
        {comp ? (
          <p className="text-[11px] text-white/45">
            {comp.width}×{comp.height} · {(comp.durationInFrames / comp.fps).toFixed(1)} s · hover the video for scene tools, click a caption to edit it
          </p>
        ) : null}
      </div>
      <aside className="flex min-h-0 flex-col gap-3 overflow-auto rounded-xl border border-white/10 bg-panel-bg p-3">
        <div className="flex gap-1">
          <button type="button" className={tabBtn(side === "scenes")} onClick={() => setSide("scenes")}>
            Scenes
          </button>
          <button type="button" className={tabBtn(side === "takes")} onClick={() => setSide("takes")}>
            Takes & captions
          </button>
        </div>
        {side === "scenes" ? (
          <ScenesPanel folder={folder} props={props} onChange={save} onSeekToScene={seekToScene} />
        ) : (
          <TakesPanel folder={folder} files={files} />
        )}
      </aside>
    </div>
  );
};

const download = (blob: Blob, name: string) => {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

const ExportView: React.FC<{ folder: string; onUseVideo?: (v: RecorderVideo) => void }> = ({ folder, onUseVideo }) => {
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const preview = useMemo(() => (result ? URL.createObjectURL(result.blob) : null), [result]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const run = async () => {
    abort.current = new AbortController();
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      setResult(await exportProject({ folder, onProgress: setProgress, signal: abort.current.signal }));
    } catch (e) {
      setError((e as Error).name === "AbortError" ? "Export stopped." : (e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4" data-recorder="export">
      <p className="text-sm text-white/70">
        Renders the whole project (scenes, captions, chapters, B-roll, music, end card) into one video, in this
        browser. MP4 in Chrome and Edge, otherwise WebM.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" data-recorder="export-start" disabled={progress !== null} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40" onClick={run}>
          {progress !== null ? `Exporting… ${Math.round(progress * 100)}%` : "Export video"}
        </button>
        {progress !== null ? (
          <button type="button" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white" onClick={() => abort.current?.abort()}>
            Stop
          </button>
        ) : null}
      </div>
      {progress !== null ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {result && preview ? (
        <div className="flex flex-col gap-3">
          <video src={preview} controls className="w-full rounded-xl border border-white/10 bg-black" data-recorder="export-preview" />
          <div className="flex flex-wrap gap-2">
            {onUseVideo ? (
              <button type="button" data-recorder="use-video" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-black" onClick={() => onUseVideo({ ...result, name: `${folder}.${result.ext}` })}>
                Use this video
              </button>
            ) : null}
            <button type="button" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white" onClick={() => download(result.blob, `${folder}.${result.ext}`)}>
              Download {result.ext.toUpperCase()}
            </button>
            {result.srt ? (
              <button type="button" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white" onClick={() => download(new Blob([result.srt], { type: "text/plain" }), `${folder}.srt`)}>
                Download captions (SRT)
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const RecorderStudio: React.FC<RecorderStudioProps> = ({ onUseVideo, onClose, initialTab = "record" }) => {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [folder, setFolderState] = useState<string | null>(null);
  useStoreVersion();

  useEffect(() => {
    loadProjectStore().then(async () => {
      let f = loadSelectedFolder();
      if (!f || !listFolders().includes(f)) f = listFolders()[0] ?? null;
      if (!f) {
        f = "my-video";
        await createFolder(f, emptyProjectProps());
      }
      setFolderState(f);
      persistSelectedFolder(f);
      setReady(true);
    });
  }, []);

  const setFolder = (f: string) => {
    setFolderState(f);
    persistSelectedFolder(f);
  };

  if (!ready || !folder) {
    return <div className="flex h-full items-center justify-center text-sm text-white/50">Loading recorder…</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-app-bg text-white" data-recorder="studio">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1">
          {(["record", "edit", "export"] as const).map((t) => (
            <button key={t} type="button" data-recorder-tab={t} className={tabBtn(tab === t)} onClick={() => setTab(t)}>
              {t === "record" ? "Record" : t === "edit" ? "Edit" : "Export"}
            </button>
          ))}
        </div>
        {tab !== "record" ? <ProjectPicker folder={folder} setFolder={setFolder} /> : null}
        <span className="flex-1" />
        {tab !== "record" && listFolders().length > 1 ? (
          <button
            type="button"
            className="text-[11px] text-red-300 hover:text-red-200"
            onClick={async () => {
              if (!confirm(`Delete the project "${folder}" and all its takes?`)) return;
              await deleteFolder(folder);
              setFolder(listFolders()[0] as string);
            }}
          >
            Delete project
          </button>
        ) : null}
        {onClose ? (
          <button type="button" className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white" onClick={onClose}>
            Close
          </button>
        ) : null}
      </header>
      {tab === "record" ? (
        <div className="remotion-recorder min-h-0 flex-1">
          <App
            key={folder}
            initialFolder={folder}
            onOpenProject={(f) => {
              setFolder(f);
              setTab("edit");
            }}
          />
        </div>
      ) : null}
      {tab === "edit" ? <EditView key={folder} folder={folder} /> : null}
      {tab === "export" ? <ExportView key={folder} folder={folder} onUseVideo={onUseVideo} /> : null}
    </div>
  );
};

export default RecorderStudio;
