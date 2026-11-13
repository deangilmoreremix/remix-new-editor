// Recorder Studio project: turns recorded takes into files + scenes for the vendored
// Remotion Recorder composition, and exposes the edit operations the Studio UI needs.
import type { Caption } from "@remotion/captions";
import type { SelectableScene, SelectableVideoScene } from "./composition/config/scenes";
import {
  COMPOSITION_ID,
  createProjectStore,
  setActiveProjectStore,
} from "./project-store";
import type { ProjectStore, StudioProps } from "./project-store";
import { clearProjectFiles, deleteStaticFile, getStaticFiles, registerBlobFile } from "./studio-shim";

export type TakePrefix = "webcam" | "display" | "alternative1" | "alternative2";

export type TakeSource = { kind: TakePrefix; blob: Blob; mimeType?: string };

export const defaultVideoScene = (overrides: Partial<SelectableVideoScene> = {}): SelectableVideoScene => ({
  type: "videoscene",
  webcamPosition: "bottom-right",
  startOffset: 0,
  endOffset: 0,
  transitionToNextScene: false,
  newChapter: "",
  stopChapteringAfterThis: false,
  music: "none",
  bRolls: [],
  ...overrides,
});

export const extensionFor = (blob: Blob, mimeType?: string) => {
  const t = (mimeType || blob.type || "").toLowerCase();
  if (t.includes("mp4")) return "mp4";
  if (t.includes("quicktime")) return "mov";
  if (t.includes("matroska")) return "mkv";
  return "webm";
};

const takeFileName = (prefix: string, timestamp: number, ext: string) =>
  `${COMPOSITION_ID}/${prefix}${timestamp}.${ext}`;

export const captionsFileName = (timestamp: number) => `${COMPOSITION_ID}/subs${timestamp}.json`;

export const initialProps = (): StudioProps => ({
  theme: "light",
  canvasLayout: "landscape",
  platform: "youtube",
  scenes: [],
});

export type RecorderProject = ReturnType<typeof createRecorderProject>;

export const createRecorderProject = () => {
  const store: ProjectStore = createProjectStore(initialProps());

  // Take timestamps in recording order: the k-th video scene shows the k-th take.
  const takeTimestamps = (): number[] => {
    const stamps = new Set<number>();
    for (const f of getStaticFiles()) {
      const m = f.name.match(new RegExp(`^${COMPOSITION_ID}/webcam(\\d+)\\.`));
      if (m) stamps.add(Number(m[1]));
    }
    return [...stamps].sort((a, b) => a - b);
  };

  const filesOfTake = (timestamp: number) =>
    getStaticFiles().filter((f) => new RegExp(`^${COMPOSITION_ID}/[a-z0-9]+${timestamp}\\.`).test(f.name));

  const setScenes = (fn: (scenes: SelectableScene[]) => SelectableScene[]) =>
    store.setProps((p) => ({ ...p, scenes: fn(p.scenes) }));

  return {
    store,
    activate: () => setActiveProjectStore(store),
    deactivate: () => setActiveProjectStore(null),

    takeTimestamps,

    /** Registers the files of a finished take and appends a video scene for it. */
    addTake: ({ sources, timestamp = Date.now() }: { sources: TakeSource[]; timestamp?: number }) => {
      if (!sources.some((s) => s.kind === "webcam")) {
        throw new Error("A take needs a Webcam recording.");
      }
      for (const s of sources) {
        registerBlobFile(takeFileName(s.kind, timestamp, extensionFor(s.blob, s.mimeType)), s.blob);
      }
      setScenes((scenes) => [...scenes, defaultVideoScene()]);
      return timestamp;
    },

    setCaptions: (timestamp: number, captions: Caption[]) => {
      registerBlobFile(captionsFileName(timestamp), new Blob([JSON.stringify(captions, null, 2)], { type: "application/json" }));
      store.bumpRevision();
    },

    addScene: (scene: SelectableScene, index?: number) =>
      setScenes((scenes) => {
        const at = index ?? scenes.length;
        return [...scenes.slice(0, at), scene, ...scenes.slice(at)];
      }),

    updateScene: (index: number, patch: Partial<SelectableScene>) =>
      setScenes((scenes) => scenes.map((s, i) => (i === index ? ({ ...s, ...patch } as SelectableScene) : s))),

    moveScene: (index: number, delta: -1 | 1) =>
      setScenes((scenes) => {
        const target = index + delta;
        if (target < 0 || target >= scenes.length) return scenes;
        // Video scenes are tied to takes by order, so only swap scenes if it keeps that order.
        const a = scenes[index]!;
        const b = scenes[target]!;
        if (a.type === "videoscene" && b.type === "videoscene") return scenes;
        const next = scenes.slice();
        next[index] = b;
        next[target] = a;
        return next;
      }),

    /** Removes a scene; for a video scene its take files are deleted too (like the Recorder). */
    removeScene: async (index: number) => {
      const scenes = store.getProps().scenes;
      const scene = scenes[index];
      if (!scene) return;
      if (scene.type === "videoscene") {
        const videoIndex = scenes.slice(0, index).filter((s) => s.type === "videoscene").length;
        const stamp = takeTimestamps()[videoIndex];
        if (stamp !== undefined) await Promise.all(filesOfTake(stamp).map((f) => deleteStaticFile(f.name)));
      }
      setScenes((all) => all.filter((_, i) => i !== index));
      store.bumpRevision();
    },

    setTheme: (theme: StudioProps["theme"]) => store.setProps((p) => ({ ...p, theme })),
    setCanvasLayout: (canvasLayout: StudioProps["canvasLayout"]) => store.setProps((p) => ({ ...p, canvasLayout })),
    setPlatform: (platform: StudioProps["platform"]) => store.setProps((p) => ({ ...p, platform })),

    reset: () => {
      clearProjectFiles(`${COMPOSITION_ID}/`);
      store.setProps(initialProps());
      store.bumpRevision();
    },
  };
};

// One project per page session, so successive takes accumulate scenes like in the Recorder.
let current: RecorderProject | null = null;
export const getRecorderProject = (): RecorderProject => (current ??= createRecorderProject());
