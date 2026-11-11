/**
 * NOTICE — code provenance & rebrand.
 * Motion Studio (formerly "ShotCraft Workbench") is the motion-editing surface of
 * SmartVideo GO. This module is derived from `video-shotcraft` by Wei Yihao
 * (vincentwei1021), licensed under Apache-2.0, and has been rebranded as
 * Motion Studio / SmartVideo GO.
 *   Original project : https://github.com/vincentwei1021/video-shotcraft (Apache-2.0)
 *   License          : http://www.apache.org/licenses/LICENSE-2.0
 * Customer-facing "ShotCraft / Workbench" branding has been replaced with
 * "Motion Studio / SmartVideo GO". Internal identifiers (storage keys, card ids,
 * palette format id, the `@proj/workbench` manifest contract, ...) are intentionally
 * kept unchanged for backwards compatibility with existing saved projects/palettes.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PillButton } from "../design-agent/ui";
import LibraryPanel from "./panels/LibraryPanel";
import { Inspector } from "./panels/Inspector";
import { PreviewPanel } from "./preview/PreviewPanel";
import { Timeline } from "./timeline/Timeline";
import MotionAgentPanel from "./components/MotionAgentPanel";
import { findClip, resetProject, useStore } from "./store";
import { seekTo, togglePlay } from "./playerRef";
import type { ClipData, ProjectData, TrackData } from "./types";
import { applyLocaleToDocument, LOCALES, useLocale, useT, type Locale } from "./i18n";
import { MOTION_CATEGORIES, getMotionTemplateByComponent, motionCardId, type MotionTemplate } from "../../data/motionRecipeCatalog";
import ExportButton from "./ExportButton";
import "./styles.css";

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isPosNum = (v: unknown): v is number => isNum(v) && v > 0;

/** Clip shape the timeline, the inspector and the Player all rely on. */
const isClipShape = (v: unknown): v is ClipData =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.cardId) &&
  isNum(v.start) &&
  v.start >= 0 &&
  isPosNum(v.duration) &&
  isNum(v.inOffset) &&
  v.inOffset >= 0 &&
  isPosNum(v.speed) &&
  isNum(v.opacity) &&
  isNum(v.scale) &&
  isNum(v.x) &&
  isNum(v.y) &&
  isObj(v.props) &&
  (v.label === undefined || isStr(v.label));

const isTrackShape = (v: unknown): v is TrackData =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.name) &&
  Array.isArray(v.clips) &&
  v.clips.every(isClipShape) &&
  (v.hidden === undefined || typeof v.hidden === "boolean");

/**
 * A project JSON the studio can install: the required fields plus every nested
 * track and clip. Without this a `{"tracks":[]}` object reaches the store, the
 * Player and the autosave, and `projectDuration()` turns into NaN.
 */
export const isProjectShape = (v: unknown): v is ProjectData =>
  isObj(v) &&
  isStr(v.name) &&
  isPosNum(v.fps) &&
  isPosNum(v.width) &&
  isPosNum(v.height) &&
  Array.isArray(v.tracks) &&
  v.tracks.every(isTrackShape) &&
  (v.themeId === undefined || isStr(v.themeId)) &&
  (v.background === undefined || isStr(v.background)) &&
  (v.source === undefined || isStr(v.source)) &&
  (v.brand === undefined || isObj(v.brand)) &&
  (v.spec === undefined || isObj(v.spec)) &&
  (v.themeColors === undefined ||
    (isObj(v.themeColors) && Object.values(v.themeColors).every(isStr)));

/** 面板尺寸：可拖拽调整，落 localStorage */
const usePanelSize = (key: string, def: number) => {
  const [v, setV] = useState<number>(() => {
    const s = localStorage.getItem(key);
    return s ? Number(s) : def;
  });
  useEffect(() => {
    localStorage.setItem(key, String(v));
  }, [key, v]);
  return [v, setV] as const;
};

/** 拖拽分隔条：pointerdown 后跟踪位移，交给回调换算尺寸 */
const startSplit = (
  e: React.PointerEvent,
  onMove: (dx: number, dy: number) => void,
) => {
  e.preventDefault();
  const sx = e.clientX;
  const sy = e.clientY;
  const mm = (ev: PointerEvent) => onMove(ev.clientX - sx, ev.clientY - sy);
  const up = () => window.removeEventListener("pointermove", mm);
  window.addEventListener("pointermove", mm);
  window.addEventListener("pointerup", up, { once: true });
};

export const App: React.FC = () => {
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);
  useEffect(() => applyLocaleToDocument(locale), [locale]);
  const project = useStore((s) => s.project);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const updateName = (name: string) =>
    useStore.setState((s) => ({ project: { ...s.project, name } }));
  const fileRef = useRef<HTMLInputElement>(null);
  // wb-* localStorage keys are kept (they carry the original "workbench" branding,
  // not a customer-facing label) so returning users keep their saved panel sizes.
  const [libW, setLibW] = usePanelSize("wb-lib-w", 224);
  const [inspW, setInspW] = usePanelSize("wb-insp-w", 300);
  const [railW, setRailW] = usePanelSize("wb-rail-w", 360);
  const [tlH, setTlH] = usePanelSize("wb-tl-h", 264);
  // The edit agent ("make the text bigger"): films are made in the chat; here it only edits.
  const [railOpen, setRailOpen] = useState(true);
  const navigate = useNavigate();

  /** Clicking a recipe goes to the chat with it picked (films are made there); "Add" still puts it on the timeline. */
  const handleSelectRecipe = (recipe: MotionTemplate) => {
    navigate("/new", { state: { pickRecipe: recipe.id } });
  };

  /** Library → timeline: insert the shot at the playhead on the selected
   *  clip's track (or the bottom track when nothing is selected). */
  const handleAddToTimeline = useCallback((recipe: MotionTemplate) => {
    const s = useStore.getState();
    const cardId = motionCardId(recipe);
    const selected = s.selectedClipId ? findClip(s.project, s.selectedClipId) : null;
    const trackId =
      selected?.track.id ?? s.project.tracks[s.project.tracks.length - 1]?.id;
    s.addClip(cardId, trackId, s.playhead);
  }, []);

  // remix-new-editor: "Edit in Motion Studio" on a recipe card in the
  // personalization modal opens this editor with `?template=motion-studio|<Component>`.
  // Add that recipe at the playhead once, then drop the parameter so a reload
  // does not add it again.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const template = url.searchParams.get("template") || "";
    if (!template.startsWith("motion-studio|")) return;
    const recipe = getMotionTemplateByComponent(template.slice("motion-studio|".length));
    url.searchParams.delete("template");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    if (recipe) handleAddToTimeline(recipe);
  }, [handleAddToTimeline]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      const s = useStore.getState();
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        if (s.selectedClipId) s.removeClip(s.selectedClipId);
      } else if (e.key.toLowerCase() === "s" && !e.metaKey && !e.ctrlKey) {
        if (s.selectedClipId) s.splitClip(s.selectedClipId, s.playhead);
      } else if (e.key.toLowerCase() === "d" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (s.selectedClipId) s.duplicateClip(s.selectedClipId);
      } else if (e.key.toLowerCase() === "z" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowLeft" ? -1 : 1);
        const f = Math.max(0, s.playhead + step);
        seekTo(f);
        s.setPlayhead(f);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name || "motion-studio-project"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = (file: File) => {
    file.text().then((text) => {
      try {
        const p = JSON.parse(text);
        if (!isProjectShape(p)) throw new Error("bad format");
        useStore.getState().setProject(p);
      } catch {
        window.alert(t("import.invalid"));
      }
    });
  };

  return (
    <div className="app">
      <header className="topbar">
        <button
          type="button"
          className="ms-back"
          onClick={() => navigate("/new")}
          title="Back to the Motion Director chat (your film stays here — reopen it from Continue editing)"
          data-testid="workbench-back-to-chat"
        >
          {t("workbench.backToChat")}
        </button>
        <span className="logo">Motion <b>Director</b></span>
        <input
          className="project-name"
          value={project.name}
          onChange={(e) => updateName(e.target.value)}
          spellCheck={false}
          aria-label="Project name"
        />
        <div className="ms-mode-pills" role="group" aria-label="Studio views">
          <PillButton
            active={railOpen}
            onClick={() => setRailOpen((open) => !open)}
          title={t("workbench.editAgent.title")}
          pressed={railOpen}
          testId="topbar-agent-toggle"
        >
          {t("workbench.editAgent")}
          </PillButton>
        </div>
        <span style={{ flex: 1 }} />
        <button className="btn" disabled={!canUndo} onClick={undo} title={t("undo.title")}>
          {t("undo")}
        </button>
        <button className="btn" disabled={!canRedo} onClick={redo} title={t("redo.title")}>
          {t("redo")}
        </button>
        <span className="tl-sep" />
        <ExportButton />
        <button className="btn" onClick={exportJson}>{t("exportJson")}</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>{t("import")}</button>
        <button className="btn" onClick={() => { if (window.confirm(t("resetSample.confirm"))) resetProject(); }} data-testid="topbar-reset-sample">{t("resetSample")}</button>
        <span className="tl-sep" />
        <select
          className="btn interface-language"
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          title={t("lang.title")}
          aria-label={t("lang.title")}
        >
          {LOCALES.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importJson(f);
            e.target.value = "";
          }}
        />
      </header>

      <main className="main">
        {railOpen && (
          <>
            <div className="panel-wrap ms-rail-wrap" style={{ width: railW }}>
              <div className="ms-rail" data-testid="studio-rail">
                <div className="ms-rail-tabs">
                  <span className="ms-rail-title">{t("workbench.editAgent")}</span>
                  <span style={{ flex: 1 }} />
                  <button
                    type="button"
                    className="ms-rail-hide"
                    onClick={() => setRailOpen(false)}
                    aria-label="Hide edit agent"
                    title="Hide"
                  >
                    ×
                  </button>
                </div>
                <div className="ms-rail-body">
                  <MotionAgentPanel />
                </div>
              </div>
            </div>
            <div
              className="splitter v"
              title={t("split.inspector")}
              onPointerDown={(e) => {
                const start = railW;
                startSplit(e, (dx) => setRailW(clamp(start + dx, 260, 640)));
              }}
            />
          </>
        )}
        <div className="panel-wrap" style={{ width: libW }}>
          <LibraryPanel
            categories={MOTION_CATEGORIES.map((c) => c.key)}
            onSelectRecipe={handleSelectRecipe}
            onAddToTimeline={handleAddToTimeline}
          />
        </div>
        <div
          className="splitter v"
          title={t("split.library")}
          onPointerDown={(e) => {
            const start = libW;
            startSplit(e, (dx) => setLibW(clamp(start + dx, 160, 440)));
          }}
        />
        <PreviewPanel />
        <div
          className="splitter v"
          title={t("split.inspector")}
          onPointerDown={(e) => {
            const start = inspW;
            startSplit(e, (dx) => setInspW(clamp(start - dx, 220, 500)));
          }}
        />
        <div className="panel-wrap" style={{ width: inspW }}>
          <Inspector />
        </div>
      </main>

      <div
        className="splitter h"
        title={t("split.timeline")}
        onPointerDown={(e) => {
          const start = tlH;
          startSplit(e, (_dx, dy) => setTlH(clamp(start - dy, 150, 600)));
        }}
      />
      <div className="panel-wrap" style={{ height: tlH }}>
        <Timeline />
      </div>
    </div>
  );
};
