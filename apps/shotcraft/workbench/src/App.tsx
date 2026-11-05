import React, { useEffect, useRef, useState } from "react";
import { LibraryPanel } from "./panels/LibraryPanel";
import { Inspector } from "./panels/Inspector";
import { PreviewPanel } from "./preview/PreviewPanel";
import { Timeline } from "./timeline/Timeline";
import { resetProject, useStore } from "./store";
import { seekTo, togglePlay } from "./playerRef";
import type { ProjectData } from "./types";
import { exportProjectOnWeb, explainExportError } from "./host/webExport";
import { notifyExported } from "./host/bridge";
import { ChatPanel } from "./panels/ChatPanel";
import { ACCEPT, addFiles, useUploads } from "./host/uploads";
import { applyLocaleToDocument, LOCALES, useLocale, useT, type Locale } from "./i18n";

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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

/** SmartVid: export renders in the browser with @remotion/web-renderer (WebCodecs) —
 *  no dev server, no Lambda. The MP4 downloads locally and, when embedded, is handed
 *  to SmartVid to save in the user's library. */
const ExportButton: React.FC = () => {
  const t = useT();
  const [job, setJob] = useState<{ status: "running" | "done" | "error"; progress: number; error?: string; url?: string; name?: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (job?.url) URL.revokeObjectURL(job.url);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    const project = useStore.getState().project;
    const ac = new AbortController();
    abortRef.current = ac;
    setJob({ status: "running", progress: 0 });
    try {
      const blob = await exportProjectOnWeb(project, ({ progress }) => setJob({ status: "running", progress }), ac.signal);
      const name = `${(project.name || "smartvid-workbench").replace(/[^\w\- ]+/g, "_").slice(0, 60)}.mp4`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      notifyExported(blob, name);
      setJob({ status: "done", progress: 1, url, name });
    } catch (e) {
      if (ac.signal.aborted) { setJob(null); return; }
      const error = explainExportError(e, project);
      setJob({ status: "error", progress: 0, error });
      window.alert(error);
    }
  };

  if (job?.status === "running")
    return (
      <>
        <button className="btn primary" disabled>
          {t("export.running", { pct: Math.round(job.progress * 100) })}
        </button>
        <button className="btn" onClick={() => abortRef.current?.abort()}>Cancel</button>
      </>
    );
  if (job?.status === "done")
    return (
      <>
        <a className="btn" href={job.url} download={job.name} title={t("export.revealTitle")}>
          {t("export.done")}
        </a>
        <button className="btn primary" onClick={start}>
          {t("export.again")}
        </button>
      </>
    );
  if (job?.status === "error")
    return (
      <button className="btn danger" title={job.error} onClick={start}>
        {t("export.failedRetry")}
      </button>
    );
  return (
    <button className="btn primary" title={t("export.title")} onClick={start}>
      {t("export.film")}
    </button>
  );
};

/** SmartVid: upload the user's own videos / images / audio (also: drag files anywhere). */
const UploadButton: React.FC = () => {
  const ref = useRef<HTMLInputElement>(null);
  const items = useUploads((s) => s.items);
  const uploading = items.filter((i) => i.state === "uploading").length;
  const last = items[items.length - 1];
  const status =
    uploading > 0 ? `Uploading ${uploading}…`
    : last?.state === "error" ? `⚠ ${last.message}`
    : last?.state === "local" ? `⚠ ${last.name}: ${last.message}`
    : last?.state === "done" ? "✓ Saved to your library" : "";
  return (
    <>
      <button className="btn" onClick={() => ref.current?.click()} title="Add videos, images or audio from your computer (or drag files onto the timeline)">
        ⬆ Upload
      </button>
      {status && <span className={`upload-status${last?.state === "error" || last?.state === "local" ? " warn" : ""}`} title={status}>{status}</span>}
      <input
        ref={ref}
        type="file"
        multiple
        accept={ACCEPT}
        style={{ display: "none" }}
        aria-label="Upload media"
        onChange={(e) => {
          if (e.target.files?.length) void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
};

const useWindowSize = () => {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return size;
};

export const App: React.FC = () => {
  const t = useT();
  const win = useWindowSize();
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
  const [libW, setLibW] = usePanelSize("wb-lib-w", 224);
  const [inspW, setInspW] = usePanelSize("wb-insp-w", 300);
  const [tlH, setTlH] = usePanelSize("wb-tl-h", 264);
  // Stored sizes are kept, but what is rendered never exceeds a share of the window.
  const libMax = Math.max(160, Math.min(440, Math.round(win.w * 0.25)));
  const inspMax = Math.max(220, Math.min(500, Math.round(win.w * 0.3)));
  const tlMax = Math.max(150, Math.min(600, Math.round(win.h * 0.45)));
  const libShown = clamp(libW, 160, libMax);
  const inspShown = clamp(inspW, 220, inspMax);
  const tlShown = clamp(tlH, 150, tlMax);
  const [side, setSide] = useState<"inspector" | "ai">("inspector");

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
    // Files dropped anywhere else (preview, library…) are appended to the project, and
    // the browser never navigates away to the dropped file.
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      void addFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name || "workbench-project"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = (file: File) => {
    file.text().then((text) => {
      try {
        const p = JSON.parse(text) as ProjectData;
        if (!p || !Array.isArray(p.tracks)) throw new Error("bad format");
        useStore.getState().setProject(p);
      } catch {
        window.alert(t("import.invalid"));
      }
    });
  };

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">SmartVid <b>Workbench</b></span>
        <input
          className="project-name"
          value={project.name}
          onChange={(e) => updateName(e.target.value)}
          spellCheck={false}
        />
        <span style={{ flex: 1 }} />
        <UploadButton />
        <span className="tl-sep" />
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
        <button
          className="btn"
          onClick={() => window.confirm(t("reset.confirm")) && resetProject()}
        >
          {t("reset")}
        </button>
        <span className="tl-sep" />
        <select
          className="btn"
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
        <div className="panel-wrap" style={{ width: libShown }}>
          <LibraryPanel />
        </div>
        <div
          className="splitter v"
          title={t("split.library")}
          onPointerDown={(e) => {
            const start = libShown;
            startSplit(e, (dx) => setLibW(clamp(start + dx, 160, libMax)));
          }}
        />
        <PreviewPanel />
        <div
          className="splitter v"
          title={t("split.inspector")}
          onPointerDown={(e) => {
            const start = inspShown;
            startSplit(e, (dx) => setInspW(clamp(start - dx, 220, inspMax)));
          }}
        />
        <div className="panel-wrap" style={{ width: inspShown, display: "flex", flexDirection: "column" }}>
          <div className="side-tabs" role="tablist">
            <button className={`side-tab${side === "inspector" ? " on" : ""}`} role="tab" aria-selected={side === "inspector"} onClick={() => setSide("inspector")}>Inspector</button>
            <button className={`side-tab${side === "ai" ? " on" : ""}`} role="tab" aria-selected={side === "ai"} onClick={() => setSide("ai")}>✦ AI Chat</button>
          </div>
          <div className="side-body">{side === "inspector" ? <Inspector /> : <ChatPanel />}</div>
        </div>
      </main>

      <div
        className="splitter h"
        title={t("split.timeline")}
        onPointerDown={(e) => {
          const start = tlShown;
          startSplit(e, (_dx, dy) => setTlH(clamp(start - dy, 150, tlMax)));
        }}
      />
      <div className="panel-wrap" style={{ height: tlShown }}>
        <Timeline />
      </div>
    </div>
  );
};
