import { Player } from "@remotion/player";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Main } from "./composition/remotion/Main";
import type { RecorderProject } from "./project";
import type { ExportResult } from "./export";
import { useStudioMetadata } from "./useStudioMetadata";
import { CaptionsPanel } from "./ui/CaptionsPanel";
import { ExportPanel } from "./ui/ExportPanel";
import { ScenesPanel } from "./ui/ScenesPanel";
import { StylePanel, applyBrand, loadBrand } from "./ui/StylePanel";
import "./ui/studio.css";

type Tab = "scenes" | "captions" | "style" | "export";
const TABS: { id: Tab; label: string }[] = [
  { id: "scenes", label: "Scenes" },
  { id: "captions", label: "Captions" },
  { id: "style", label: "Style" },
  { id: "export", label: "Export" },
];

export const RecorderStudio = ({
  project,
  onAddToTimeline,
}: {
  project: RecorderProject;
  onAddToTimeline?: (result: ExportResult) => void;
}) => {
  const { store } = project;
  const props = useSyncExternalStore(store.subscribe, store.getProps);
  const focused = useSyncExternalStore(store.subscribe, store.getFocusedPath);
  const state = useStudioMetadata(store);
  const [tab, setTab] = useState<Tab>("scenes");
  const [selected, setSelected] = useState(0);
  // The Player's error boundary stays tripped until it remounts, so after an error the next
  // project change gives the preview a fresh Player.
  const playerErrored = useRef(false);
  const [resetKey, setResetKey] = useState(0);

  // The vendored composition reaches its project through module-level hooks; keep this one active.
  useEffect(() => {
    project.activate();
    applyBrand(loadBrand());
    store.bumpRevision();
    return () => project.deactivate();
  }, [project, store]);

  useEffect(() => {
    if (playerErrored.current) {
      playerErrored.current = false;
      setResetKey((k) => k + 1);
    }
  }, [state]);

  const shown = state.status === "ready" ? state.metadata : state.status === "loading" || state.status === "error" ? state.previous : null;
  const liveIndex = focused && focused[0] === "scenes" && typeof focused[1] === "number" ? focused[1] : null;
  const clamped = Math.min(selected, Math.max(0, props.scenes.length - 1));

  return (
    <div className="rs-root">
      <div className="rs-main">
        <div className="rs-stage">
          {shown ? (
            <Player
              key={resetKey}
              component={Main as never}
              inputProps={shown.props as never}
              durationInFrames={Math.max(1, shown.durationInFrames)}
              compositionWidth={shown.width}
              compositionHeight={shown.height}
              fps={shown.fps}
              controls
              clickToPlay={false}
              acknowledgeRemotionLicense
              errorFallback={({ error }: { error: Error }) => {
                playerErrored.current = true;
                return (
                  <div className="rs-empty" role="alert">
                    The preview could not be drawn: {error.message}
                  </div>
                );
              }}
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <div className="rs-empty">
              {state.status === "loading" ? "Loading your recordings…" : "Nothing to preview yet. Record a take with the Screen Recorder and choose “Edit in Studio”, or add a title scene on the right."}
            </div>
          )}
          {state.status === "loading" && shown ? <div className="rs-banner">Updating preview…</div> : null}
          {state.status === "error" ? <div className="rs-banner err" role="alert">Could not build the preview: {state.message}</div> : null}
        </div>
        <span className="rs-hint">Tip: click a caption in the preview to correct its words.</span>
      </div>

      <div className="rs-side">
        <div className="rs-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={`rs-tab${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="rs-panel">
          {tab === "scenes" ? <ScenesPanel project={project} scenes={props.scenes} selected={clamped} setSelected={setSelected} liveIndex={liveIndex} /> : null}
          {tab === "captions" ? <CaptionsPanel project={project} /> : null}
          {tab === "style" ? <StylePanel project={project} /> : null}
          {tab === "export" ? <ExportPanel state={state} landscape={props.canvasLayout === "landscape"} onAddToTimeline={onAddToTimeline} /> : null}
        </div>
      </div>
    </div>
  );
};
