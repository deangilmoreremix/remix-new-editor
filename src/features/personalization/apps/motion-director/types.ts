import type { BrandInput } from './demosrc/_fixtures/Brand';

/** 工程数据模型：Project → Track → Clip。所有时间量以时间轴帧为单位（默认 30fps）。 */

export interface ClipData {
  id: string;
  cardId: string;
  /** 时间轴上的起点（帧） */
  start: number;
  /** 时间轴上占据的长度（帧）——可短于/长于卡片原始时长（裁剪/定格延长） */
  duration: number;
  /** 裁入点：从卡片素材的第几帧开始播（源帧），控制动效的进场时机 */
  inOffset: number;
  /** 变速倍率：每走 1 时间轴帧，源时间前进 speed 帧 */
  speed: number;
  /** 图层不透明度 0–1 */
  opacity: number;
  /** 图层整体缩放 */
  scale: number;
  /** 图层位移（px，合成坐标系） */
  x: number;
  y: number;
  /** 卡片专属属性覆盖（缺省值来自卡片 schema） */
  props: Record<string, unknown>;
  /** 时间轨上显示的自定义标签（缺省显示卡片名）——导入成片时的镜头/音效用它标注 */
  label?: string;
}

export interface TrackData {
  id: string;
  name: string;
  /** Stable role, independent of the UI language the name was written in. */
  role?: "music";
  hidden?: boolean;
  clips: ClipData[];
}

export interface ProjectData {
  /** Visual preset; absent means the manifest's default, preserving older JSON. */
  themeId?: string;
  themeColors?: Record<string, string>;
  /** The colours captured from the film's site: the base of the "Your site" theme (lib/palette). */
  sitePalette?: Record<string, string>;
  name: string;
  fps: number;
  width: number;
  height: number;
  /** 舞台底色（成片工程 AbsoluteFill 的 background；缺省近黑） */
  background?: string;
  /** 由哪个成片清单导入（清单 name + total）——`?import=project` 用它判断是否需要重新导入 */
  source?: string;
  /** Company identity the recipe demos speak with (absent = the studio's own SmartVideo GO). */
  brand?: BrandInput;
  /** The design spec the film was built from (brief, tokens, storyboard rows, data rules). */
  spec?: DesignSpec;
  tracks: TrackData[];
}

let seq = 0;
export const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`;

/** 内容精确结束帧（最晚 clip 结束；导出成片用，不带余量） */
export const projectEndFrame = (project: ProjectData): number => {
  let end = 0;
  for (const t of project.tracks)
    for (const c of t.clips) end = Math.max(end, c.start + c.duration);
  return end;
};

/** 工程总时长（帧）：最晚 clip 结束 + 1s 余量，最短 5s（编辑预览用；按工程 fps 换算） */
export const projectDuration = (project: ProjectData): number =>
  Math.max(5 * project.fps, projectEndFrame(project) + project.fps);

/** 会话里的一条对话（用户指令 / Agent 回执）。 */
export interface SessionMessage {
  role: "user" | "assistant";
  content: string;
  /** ISO 时间戳 */
  ts: string;
}

/** 会话快照：把一个工程状态作为可再打开的“会话”保存，供 SessionPanel 列表/恢复用。 */
export interface SessionData {
  id: string;
  name: string;
  prompt?: string;
  aspectRatio?: string;
  duration?: number;
  projectSnapshot: ProjectData;
  updatedAt: string;
  /** 对话条数（= messages.length，保留旧字段名以兼容既有存档） */
  messageCount: number;
  sourceSessionId?: string;
  /** 本会话在编辑的动效配方（卡片 / 模板 id）——用于跨多轮继续编辑同一配方 */
  recipeId?: string;
  /** 配方的展示名（卡片名 / 模板名） */
  recipeName?: string;
  /** 与会话一起保存的完整对话 */
  messages: SessionMessage[];
}

/** 会话里的素材片段总数（对话气条里的消息条数类比）。 */
export const sessionClipCount = (session: SessionData): number =>
  session.projectSnapshot.tracks.reduce((sum, t) => sum + t.clips.length, 0);

/** 兼容旧存档：老会话没有 messages 字段，补一个空数组。 */
export const normalizeSession = (session: SessionData): SessionData => ({
  ...session,
  messages: Array.isArray(session.messages) ? session.messages : [],
  messageCount: Array.isArray(session.messages)
    ? session.messages.length
    : (session.messageCount ?? 0),
});

/** What a film was asked to be, saved with it (see lib/designSpec). */
export interface DesignSpec {
  version: 1;
  brief: string;
  product: string;
  url: string | null;
  sampleOnly: boolean;
  tokens: {
    background: string;
    text: string;
    accent: string;
    font: string | null;
    /** The motion voice picked from the brand (lib/motionPreset). */
    motion?: { id: string; label: string; mainFrames: number; easing: string; overshoot: number; squash: number };
  };
  scenes: Array<{ n: number; start: number; durationSec: number; kind: 'shot' | 'title'; recipeId: string; line: string }>;
  dataRules: string[];
  /** Stage 2: feature → first-choice card, fallback card, what it expresses, the page state it needs. */
  mapping?: Array<{ feature: string; firstShot: string; altShot: string; expresses: string; pageState: string }>;
  /** Stage 3: the release check run before the storyboard was shown. */
  release?: Array<{ code: string; ok: boolean; text: string }>;
  /** Stage 1: the chosen visual direction, why, and its trade-off. */
  direction?: string;
}
