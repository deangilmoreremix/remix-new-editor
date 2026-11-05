import { create } from "zustand";
import type { ClipData, ProjectData, SessionData, SessionMessage, TrackData } from "./types";
import { uid, normalizeSession } from "./types";
import { CARDS } from "./cards/registry";
import { clipDefaultsFor } from "./cards/types";
import { demoProject } from "./demoProject";
import { MANIFEST } from "./cards/projectCards";
import { manifestKey } from "./cards/manifest";
import { buildProjectFromManifest } from "./projectImport";
import { upgradeLegacyTheme } from './theme';
import { t } from "./i18n";
import { isProjectShape } from "./App";

export { projectDuration } from "./types";

// Kept for backwards compatibility with saved projects written by the original
// "shotcraft-workbench" tool so returning users keep their existing project.
const STORAGE_KEY = "motion-director:project-v1";
const SESSIONS_STORAGE_KEY = "motion-director:sessions-v1";

const loadSaved = (): ProjectData | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as ProjectData;
      if (p && isProjectShape(p)) return p;
    }
  } catch {
    /* 损坏的存档直接回退 */
  }
  return null;
};

const loadSavedSessions = (): SessionData[] => {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as SessionData[];
      // 旧存档没有 messages 字段：补空数组，messageCount 取真实条数
      if (Array.isArray(s)) return s.map(normalizeSession);
    }
  } catch {
    /* 损坏的存档直接回退 */
  }
  return [];
};

/** 初始工程：
 *  - URL 带 `?import=project`（scripts/open.mjs 交付后打开时加）且已链接成片：
 *    存档不是这一版成片（清单内容哈希不同，见 manifestKey）就按清单重新导入，
 *    旧存档压进撤销栈（⌘Z 可找回改动）；是这一版的保留用户改动
 *  - 否则读存档；没有存档时用演示工程 */
const loadInitial = (): { project: ProjectData; past: ProjectData[]; imported: boolean } => {
  const raw = loadSaved();
  const saved = raw ? upgradeLegacyTheme(raw, MANIFEST, CARDS) : null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("import") === "project" && MANIFEST) {
    window.history.replaceState(null, "", window.location.pathname);
    if (saved?.source !== manifestKey(MANIFEST))
      return { project: buildProjectFromManifest(MANIFEST), past: saved ? [saved] : [], imported: true };
  }
  return { project: saved ?? demoProject(), past: [], imported: false };
};
const initial = loadInitial();

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const findClip = (
  project: ProjectData,
  clipId: string,
): { track: TrackData; clip: ClipData } | null => {
  for (const track of project.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
};

/** 素材库点击预览：卡片走 Player 实时预览，文件走原生 video/img/audio */
export type PreviewItem =
  | { kind: "card"; cardId: string }
  | { kind: "video" | "image" | "audio"; file: string; label: string }
  | null;

interface WorkbenchState {
  project: ProjectData;
  sessions: SessionData[];
  activeSessionId: string | null;
  selectedClipId: string | null;
  playhead: number;
  playing: boolean;
  pxPerFrame: number;
  previewItem: PreviewItem;
  past: ProjectData[];
  future: ProjectData[];

  /** 一次编辑手势开始前调用：压入撤销快照 */
  commit: () => void;
  undo: () => void;
  redo: () => void;

  setProject: (p: ProjectData) => void;
  /** Live palette edit; the caller commits once at the start of a gesture. */
  setThemeColors: (colors: ProjectData["themeColors"]) => void;
  /** 舞台底色（成片 AbsoluteFill 的 background） */
  setBackground: (color: string) => void;
  select: (id: string | null) => void;
  setPlayhead: (f: number) => void;
  setPlaying: (b: boolean) => void;
  setZoom: (pxPerFrame: number) => void;
  setPreview: (p: PreviewItem) => void;

  /** 会话管理 */
  addSession: (session: SessionData) => void;
  updateSession: (id: string, patch: Partial<SessionData>) => void;
  /** 追加一条对话（用户指令 / Agent 回执），并刷新 messageCount 与 updatedAt */
  appendSessionMessage: (id: string, msg: SessionMessage) => void;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => void;
  /** 把会话的工程快照载入当前工作台，并设为当前会话 */
  applySession: (id: string) => void;
  updateActiveSessionProject: (project: ProjectData) => void;

  addTrack: () => void;
  removeTrack: (trackId: string) => void;
  toggleTrackHidden: (trackId: string) => void;
  /** 拖拽排序：把轨道移到插入位 toIndex（按原数组下标：0 = 最上层，tracks.length = 最下层） */
  moveTrack: (trackId: string, toIndex: number) => void;

  addClip: (
    cardId: string,
    trackId?: string,
    at?: number,
    extra?: { props?: Record<string, unknown>; label?: string; duration?: number },
  ) => void;
  updateClip: (clipId: string, patch: Partial<ClipData>) => void;
  updateClipProps: (clipId: string, propPatch: Record<string, unknown>) => void;
  removeClip: (clipId: string) => void;
  splitClip: (clipId: string, atFrame: number) => void;
  duplicateClip: (clipId: string) => void;
  moveClipToTrack: (clipId: string, trackId: string) => void;
  /** 把 clip 放到另一轨道（toTrackId）或同一轨道的新起点（toStart）——一步撤销。
   *  未指定 toTrackId 时只在原轨道内改起点；未指定 toStart 时保留原起点。 */
  reorderClips: (clipId: string, opts: { toTrackId?: string; toStart?: number }) => void;
}

const mutateProject = (
  project: ProjectData,
  fn: (draft: ProjectData) => void,
): ProjectData => {
  const draft = clone(project);
  fn(draft);
  return draft;
};

export const useStore = create<WorkbenchState>((set, get) => ({
  project: initial.project,
  sessions: loadSavedSessions(),
  activeSessionId: null,
  selectedClipId: null,
  playhead: 0,
  playing: false,
  pxPerFrame: 2,
  previewItem: null,
  past: initial.past,
  future: [],

  commit: () =>
    set((s) => ({ past: [...s.past.slice(-49), clone(s.project)], future: [] })),

  undo: () =>
    set((s) => {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return {
        project: prev,
        past: s.past.slice(0, -1),
        future: [clone(s.project), ...s.future.slice(0, 49)],
        selectedClipId: null,
      };
    }),

  redo: () =>
    set((s) => {
      if (!s.future.length) return s;
      const next = s.future[0];
      return {
        project: next,
        past: [...s.past.slice(-49), clone(s.project)],
        future: s.future.slice(1),
        selectedClipId: null,
      };
    }),

  setProject: (p) => {
    get().commit();
    set({ project: upgradeLegacyTheme(p, MANIFEST, CARDS), selectedClipId: null });
  },
  setThemeColors: (themeColors) =>
    set((s) => ({ project: { ...s.project, themeColors }, previewItem: null })),
  setBackground: (color) =>
    set((s) => ({ project: { ...s.project, background: color }, previewItem: null })),
  select: (id) => set({ selectedClipId: id }),
  setPlayhead: (f) => set({ playhead: Math.max(0, Math.round(f)) }),
  setPlaying: (b) => set({ playing: b }),
  setZoom: (pxPerFrame) =>
    set({ pxPerFrame: Math.min(10, Math.max(0.3, pxPerFrame)) }),
  setPreview: (p) => set({ previewItem: p }),

  addSession: (session) =>
    set((s) => ({
      sessions: [...s.sessions, normalizeSession(session)],
      activeSessionId: session.id,
    })),
  updateSession: (id, patch) =>
    set((s) => ({
      sessions: s.sessions.map((ses) =>
        ses.id === id ? normalizeSession({ ...ses, ...patch, updatedAt: new Date().toISOString() }) : ses,
      ),
    })),
  appendSessionMessage: (id, msg) =>
    set((s) => ({
      sessions: s.sessions.map((ses) => {
        if (ses.id !== id) return ses;
        const messages = [...ses.messages, msg];
        return { ...ses, messages, messageCount: messages.length, updatedAt: new Date().toISOString() };
      }),
    })),
  selectSession: (id) => set({ activeSessionId: id }),
  deleteSession: (id) =>
    set((s) => {
      const sessions = s.sessions.filter((ses) => ses.id !== id);
      return {
        sessions,
        activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
      };
    }),
  applySession: (id) =>
    set((s) => {
      const session = s.sessions.find((ses) => ses.id === id);
      if (!session) return s;
      return {
        project: session.projectSnapshot,
        activeSessionId: id,
        selectedClipId: null,
        past: [],
        future: [],
      };
    }),
  updateActiveSessionProject: (project) =>
    set((s) => {
      if (s.activeSessionId === null) return s;
      return {
        sessions: s.sessions.map((ses) =>
          ses.id === s.activeSessionId
            ? { ...ses, projectSnapshot: clone(project), updatedAt: new Date().toISOString() }
            : ses,
        ),
      };
    }),

  addTrack: () => {
    get().commit();
    set((s) => ({
      project: mutateProject(s.project, (d) => {
        d.tracks.unshift({ id: uid("track"), name: t("track.new", { n: d.tracks.length + 1 }), clips: [] });
      }),
    }));
  },

  removeTrack: (trackId) => {
    get().commit();
    set((s) => ({
      project: mutateProject(s.project, (d) => {
        d.tracks = d.tracks.filter((t) => t.id !== trackId);
      }),
      selectedClipId: null,
    }));
  },

  toggleTrackHidden: (trackId) => {
    get().commit();
    set((s) => ({
      project: mutateProject(s.project, (d) => {
        const t = d.tracks.find((t) => t.id === trackId);
        if (t) t.hidden = !t.hidden;
      }),
    }));
  },

  moveTrack: (trackId, toIndex) => {
    const tracks = get().project.tracks;
    const from = tracks.findIndex((t) => t.id === trackId);
    const to = Math.max(0, Math.min(tracks.length, Math.round(toIndex)));
    // 插到自己前面或紧跟自己后面 = 原位，不记撤销
    if (from < 0 || to === from || to === from + 1) return;
    get().commit();
    set((s) => ({
      project: mutateProject(s.project, (d) => {
        const [t] = d.tracks.splice(from, 1);
        d.tracks.splice(to > from ? to - 1 : to, 0, t);
      }),
    }));
  },

  addClip: (cardId, trackId, at, extra) => {
    const card = CARDS[cardId];
    if (!card) return;
    get().commit();
    const newId = uid("clip");
    set((s) => ({
      project: mutateProject(s.project, (d) => {
        let track =
          d.tracks.find((t) => t.id === trackId) ?? d.tracks[d.tracks.length - 1];
        if (!track) {
          // No track exists yet: create one so the clip has somewhere to live.
          track = { id: uid("track"), name: t("track.new", { n: d.tracks.length + 1 }), clips: [] };
          d.tracks.push(track);
        }
        const { duration, speed } = clipDefaultsFor(card, d.fps, extra?.duration);
        track.clips.push({
          id: newId,
          cardId,
          start: Math.max(0, Math.round(at ?? s.playhead)),
          duration,
          inOffset: 0,
          speed,
          opacity: 1,
          scale: 1,
          x: 0,
          y: 0,
          props: extra?.props ?? {},
          label: extra?.label,
        });
      }),
      selectedClipId: newId,
    }));
  },

  updateClip: (clipId, patch) =>
    set((s) => ({
      project: mutateProject(s.project, (d) => {
        const hit = findClip(d, clipId);
        if (hit) Object.assign(hit.clip, patch);
      }),
    })),

  updateClipProps: (clipId, propPatch) =>
    set((s) => ({
      project: mutateProject(s.project, (d) => {
        const hit = findClip(d, clipId);
        if (hit) hit.clip.props = { ...hit.clip.props, ...propPatch };
      }),
    })),

  removeClip: (clipId) => {
    get().commit();
    set((s) => ({
      project: mutateProject(s.project, (d) => {
        for (const t of d.tracks) t.clips = t.clips.filter((c) => c.id !== clipId);
      }),
      selectedClipId:
        s.selectedClipId === clipId ? null : s.selectedClipId,
    }));
  },

  splitClip: (clipId, atFrame) => {
    const hit = findClip(get().project, clipId);
    if (!hit) return;
    const { clip } = hit;
    const local = Math.round(atFrame - clip.start);
    if (local <= 0 || local >= clip.duration) return;
    get().commit();
    const rightId = uid("clip");
    set((s) => ({
      project: mutateProject(s.project, (d) => {
        const h = findClip(d, clipId);
        if (!h) return;
        const left = h.clip;
        const right: ClipData = {
          ...clone(left),
          id: rightId,
          start: left.start + local,
          duration: left.duration - local,
          inOffset: left.inOffset + local * left.speed,
        };
        left.duration = local;
        h.track.clips.push(right);
      }),
      selectedClipId: rightId,
    }));
  },

  duplicateClip: (clipId) => {
    const hit = findClip(get().project, clipId);
    if (!hit) return;
    get().commit();
    const newId = uid("clip");
    set((s) => ({
      project: mutateProject(s.project, (d) => {
        const h = findClip(d, clipId);
        if (!h) return;
        const copy: ClipData = {
          ...clone(h.clip),
          id: newId,
          start: h.clip.start + h.clip.duration,
        };
        h.track.clips.push(copy);
      }),
      selectedClipId: newId,
    }));
  },

  moveClipToTrack: (clipId, trackId) =>
    set((s) => ({
      project: mutateProject(s.project, (d) => {
        const hit = findClip(d, clipId);
        const target = d.tracks.find((t) => t.id === trackId);
        if (!hit || !target || hit.track.id === trackId) return;
        hit.track.clips = hit.track.clips.filter((c) => c.id !== clipId);
        target.clips.push(hit.clip);
      }),
    })),

  reorderClips: (clipId, opts) => {
    const hit = findClip(get().project, clipId);
    if (!hit) return;
    const toTrackId = opts.toTrackId ?? hit.track.id;
    const toStart = opts.toStart;
    const sameTrack = toTrackId === hit.track.id;
    const sameStart = toStart === undefined || toStart === hit.clip.start;
    // 原位落下：不记撤销
    if (sameTrack && sameStart) return;
    get().commit();
    set((s) => ({
      project: mutateProject(s.project, (d) => {
        const h = findClip(d, clipId);
        if (!h) return;
        const target = d.tracks.find((t) => t.id === toTrackId);
        if (!target) return;
        if (!sameTrack) {
          h.track.clips = h.track.clips.filter((c) => c.id !== clipId);
          target.clips.push(h.clip);
        }
        if (!sameStart) {
          h.clip.start = Math.max(0, Math.round(toStart!));
        }
      }),
    }));
  },
}));

// —— 自动保存 + 会话快照：一次 800ms 防抖窗口内一起落盘 ——
// 工程变了 → 标脏（会话快照要跟上）；安静 800ms 后：先把工程快照写进当前会话，
// 再把工程 + 会话（含 messages / recipeId）写进 localStorage。关页/切后台时立即落盘。
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let snapshotDirty = false;

const flushSave = () => {
  saveTimer = undefined;
  const state = useStore.getState();
  if (snapshotDirty) {
    snapshotDirty = false;
    if (state.activeSessionId !== null) state.updateActiveSessionProject(state.project);
  }
  try {
    const current = useStore.getState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current.project));
    // 会话连同 messages / recipeId 一起落盘
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(current.sessions));
  } catch {
    /* 存储满/隐私模式：忽略 */
  }
};

useStore.subscribe((s, prev) => {
  if (s.project === prev.project && s.sessions === prev.sessions) return;
  if (s.project !== prev.project) snapshotDirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 800);
});

window.addEventListener("beforeunload", flushSave);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushSave();
});
// 按清单重新导入的工程立即落盘：否则不改任何东西就刷新会退回旧存档
if (initial.imported) flushSave();

export const resetProject = () => {
  useStore.getState().setProject(demoProject());
};

/** 按已链接成片工程的清单重新导入（一步撤销） */
export const importProject = () => {
  if (!MANIFEST) return;
  useStore.getState().setProject(buildProjectFromManifest(MANIFEST));
};
