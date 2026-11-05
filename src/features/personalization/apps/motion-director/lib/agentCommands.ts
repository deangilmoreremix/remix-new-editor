/**
 * Motion Agent —— 本地确定性指令解释器。
 *
 * 没有外部 LLM、没有付费 API：把一句自然语言指令解析成对工程参数的真实改动
 * （`ops`），再由 `lib/agentApply.ts` 落到 store 上；Remotion Player 拿到新的
 * `project` 就自动重渲染。
 *
 * `interpretAgentCommand` 是**纯函数**：只读 ctx，不碰 store、不碰网络、不看
 * 当前时间。未来要换成 LLM 后端，只要让模型输出同样的 ops 即可，UI 一行不用改。
 */
import type { ClipData, ProjectData } from "../types";
import type { PropField } from "../cards/types";
import { schemaForCard } from "../cards/cardSchemas";
import { englishRecipeName } from "../../../data/motionRecipeCatalog";

/** 卡片元数据（解释器只需要 id / 名字 / 属性面） */
export interface CardMeta {
  id: string;
  name?: string;
  nameEn?: string;
  schema?: PropField[];
}

export interface AgentContext {
  /** 当前工程 */
  project: ProjectData;
  /** 时间轴上选中的 clip（优先作用对象） */
  selectedClipId?: string | null;
  /** 卡片注册表（用于查属性面）——不给时回落到 cards/cardSchemas.ts 的内置表 */
  cards?: Record<string, CardMeta>;
}

/** 一条真实改动：应用层负责把它落到 store 上 */
export type AgentOp =
  | { kind: "updateClipProps"; clipId: string; props: Record<string, unknown>; label: string }
  | { kind: "updateClip"; clipId: string; patch: Partial<ClipData>; label: string }
  | { kind: "setBackground"; color: string; label: string }
  | { kind: "setThemeColors"; colors: Record<string, string>; label: string }
  | {
      kind: "addClip";
      cardId: string;
      trackId?: string;
      at?: number;
      props?: Record<string, unknown>;
      label: string;
    }
  | { kind: "removeClip"; clipId: string; label: string };

export interface AgentResult {
  /** 要落地的真实改动（空数组 = 没听懂） */
  ops: AgentOp[];
  /** 回执：逐条说明改了什么 */
  reply: string;
}

// —— 词表 ——

const COLOR_WORDS: Record<string, string> = {
  red: "#ef4444",
  crimson: "#dc2626",
  blue: "#3b82f6",
  green: "#22c55e",
  black: "#000000",
  white: "#ffffff",
  yellow: "#facc15",
  orange: "#f97316",
  purple: "#a855f7",
  pink: "#ec4899",
  cyan: "#22d3ee",
  magenta: "#d946ef",
  gray: "#6b7280",
  grey: "#6b7280",
  silver: "#c0c0c0",
  brown: "#92400e",
  gold: "#c58a2a",
  lime: "#84cc16",
  teal: "#14b8a6",
  navy: "#1e3a8a",
  violet: "#8b5cf6",
  beige: "#e6dfd0",
};

/** 颜色词（写死，避免把 "to" / "bigger" 之类的普通词当成颜色） */
const COLOR_TOKEN =
  "(#[0-9a-fA-F]{3,8}|red|crimson|blue|green|black|white|yellow|orange|purple|pink|cyan|magenta|gray|grey|silver|brown|gold|lime|teal|navy|violet|beige)";

/** 可被 Agent 新建 / 追加的卡片 */
const ADDABLE: { re: RegExp; cardId: string; label: string }[] = [
  { re: /\b(?:caption|subtitle)\b/, cardId: "inkpress-caption", label: "caption strip" },
  { re: /\b(?:flash|transition)\b/, cardId: "inkpress-flash-cut", label: "flash cut" },
  { re: /\b(?:title|headline)\b/, cardId: "inkpress-title-card", label: "title card" },
  { re: /\b(?:logo|wordmark|lockup)\b/, cardId: "inkpress-title-card", label: "title card" },
  { re: /\b(?:background|backdrop|bg|paper)\b/, cardId: "bg-paper", label: "paper background" },
  { re: /\b(?:text|type|copy)\b/, cardId: "text-basic", label: "text card" },
];

const TEXT_PROP_KEYS = ["title", "text", "content", "headline", "caption"];
const SIZE_PROP_KEYS = ["fontsize", "titlesize", "textsize", "size"];

export const AGENT_HELP =
  "Try: “make the text bigger”, “set the title to Hello”, “increase the duration to 8s”, " +
  "“slow down by 0.5x”, “change the background to red”, “move the logo to the right”, " +
  "“add a caption clip”.";

// —— 小工具 ——

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** 颜色词 / hex → 规范 hex（#abc 展开成 #aabbcc） */
const colorFrom = (word: string): string | null => {
  const w = (word ?? "").trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(w)) return `#${w.slice(1).split("").map((c) => c + c).join("")}`;
  if (/^#[0-9a-f]{6}$/.test(w)) return w;
  if (/^#[0-9a-f]{8}$/.test(w)) return w.slice(0, 7);
  return COLOR_WORDS[w] ?? null;
};

const clipsOf = (project: ProjectData) =>
  project.tracks.flatMap((track) => track.clips.map((clip) => ({ clip, trackId: track.id })));

const cardSchema = (ctx: AgentContext, cardId: string): PropField[] => {
  const fromRegistry = ctx.cards?.[cardId]?.schema;
  if (fromRegistry && fromRegistry.length) return fromRegistry;
  return schemaForCard(cardId) ?? [];
};

/** clip 上某个属性的当前值：clip 自带的覆盖优先，其次是 schema 默认值 */
const propValue = (ctx: AgentContext, clip: ClipData, key: string): unknown => {
  const own = clip.props?.[key];
  if (own !== undefined) return own;
  const field = cardSchema(ctx, clip.cardId).find((f) => f.key === key);
  return field ? field.default : undefined;
};

const textField = (schema: PropField[]) => {
  const candidates = schema.filter((f) => f.type === "text" || f.type === "textarea");
  for (const key of TEXT_PROP_KEYS) {
    const hit = candidates.find((f) => f.key.toLowerCase() === key);
    if (hit) return hit;
  }
  return candidates[0];
};

const sizeField = (schema: PropField[]) => {
  const numeric = schema.filter((f) => f.type === "number" || f.type === "slider");
  for (const key of SIZE_PROP_KEYS) {
    const hit = numeric.find((f) => f.key.toLowerCase() === key);
    if (hit) return hit;
  }
  return numeric.find((f) => /size/i.test(f.key));
};

const colorField = (schema: PropField[]) => {
  const colors = schema.filter((f) => f.type === "color");
  return (
    colors.find((f) => /title|ink|fg|text|foreground/i.test(f.key)) ??
    colors.find((f) => /color|tint/i.test(f.key)) ??
    colors[0]
  );
};

const numericField = (field: PropField | undefined): field is PropField & { min?: number; max?: number } =>
  !!field && (field.type === "number" || field.type === "slider");

// —— 作用对象（哪条 clip） ——

type TargetKind = "title" | "caption" | "logo" | "text" | "any";

const clipHaystack = (ctx: AgentContext, clip: ClipData) => {
  const meta = ctx.cards?.[clip.cardId];
  const props = Object.values(clip.props ?? {})
    .filter((v) => typeof v === "string")
    .join(" ");
  return `${clip.cardId} ${clip.label ?? ""} ${meta?.name ?? ""} ${meta?.nameEn ?? ""} ${props}`.toLowerCase();
};

const matchesKind = (ctx: AgentContext, clip: ClipData, kind: TargetKind): boolean => {
  const hay = clipHaystack(ctx, clip);
  const schema = cardSchema(ctx, clip.cardId);
  if (kind === "logo") return /logo|wordmark|lockup/.test(hay);
  if (kind === "caption") return /caption|subtitle/.test(hay);
  if (kind === "title") {
    const field = textField(schema);
    if (field && field.key.toLowerCase() === "title") return true;
    return /title|headline|字卡/.test(hay);
  }
  if (kind === "text") return Boolean(sizeField(schema)) || Boolean(textField(schema));
  return true;
};

/** 选一条 clip 当作用对象：先按类型匹配（选中的优先），再退回选中的 / 第一条 */
const resolveTarget = (ctx: AgentContext, kind: TargetKind): ClipData | null => {
  const all = clipsOf(ctx.project);
  const selected = ctx.selectedClipId
    ? all.find((c) => c.clip.id === ctx.selectedClipId)?.clip
    : undefined;
  if (kind !== "any") {
    const ordered = selected
      ? [selected, ...all.map((c) => c.clip).filter((c) => c.id !== selected.id)]
      : all.map((c) => c.clip);
    const hit = ordered.find((c) => matchesKind(ctx, c, kind));
    if (hit) return hit;
  }
  if (selected) return selected;
  const allClips = all.map((c) => c.clip);
  return (
    allClips.find((c) => sizeField(cardSchema(ctx, c.cardId))) ??
    allClips.find((c) => textField(cardSchema(ctx, c.cardId))) ??
    allClips[0] ??
    null
  );
};

/** 给人看的名字：卡片名 → clip 标签 → cardId */
const clipName = (ctx: AgentContext, clip: ClipData): string => {
  const meta = ctx.cards?.[clip.cardId];
  return (meta?.nameEn && englishRecipeName(meta.nameEn)) || meta?.name || clip.label || clip.cardId;
};

const stripQuotes = (v: string) =>
  v
    .trim()
    .replace(/^["'`“”‘’]+/, "")
    .replace(/["'`“”‘’]+$/, "")
    .trim();

// —— 指令解析 ——

const ADD_RE = /\b(?:add|insert|place|append|drop)\b\s*(?:a|an|one|another)?\s*([\w\s-]{2,40}?)(?:\s+clip)?\s*$/;
const AT_RE = /\bat\s+(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)?\b/;
const DELETE_RE = /\b(?:delete|remove|drop)\s+(?:the\s+)?(?:clip|shot|layer|scene)\b/;
const SET_TEXT_RE =
  /\b(?:set|change|update|replace|rename|make)\s+(?:the\s+)?(title|headline|text|caption|subtitle|content|label|copy)\s*(?:to|as|=|:|into)\s+(.+)$/i;
const BG_RE = new RegExp(
  `\\b(?:background|backdrop|stage|canvas|surface|bg)\\b\\s*(?:colou?r)?\\s*(?:to|=|:)?\\s*(${COLOR_TOKEN})`,
);
const DURATION_RE = /\b(?:duration|length)\b[^0-9]{0,14}(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)?\b/;
const DURATION_LONG_RE = /\b(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\s+long\b/;
const DURATION_LENGER_RE = /\b(?:longer|lengthen|stretch)\b/;
const DURATION_SHORTER_RE = /\b(?:shorter|shorten|trim)\b/;
const SPEED_TO_RE = /\b(?:speed|playback\s*rate|rate)\b[^0-9]{0,10}(\d+(?:\.\d+)?)\s*x\b/;
const SPEED_SLOW_TO_RE = /\bslow\s+down\s+to\s+(\d+(?:\.\d+)?)\s*x\b/;
const SPEED_UP_TO_RE = /\bspeed\s+up\s+to\s+(\d+(?:\.\d+)?)\s*x\b/;
const SPEED_SLOW_BY_RE = /\bslow\s+(?:down|it\s+down)\s+by\s+(\d+(?:\.\d+)?)\s*x\b/;
const SPEED_UP_BY_RE = /\bspeed\s+up\s+by\s+(\d+(?:\.\d+)?)\s*x\b/;
const SPEED_SLOW_RE = /\bslow\s+(?:down|it\s+down)\b/;
const SPEED_UP_RE = /\bspeed\s+up\b/;
const SIZE_SET_RE = /\b(?:font|text|title)\s*size\b[^0-9]{0,12}(?:to|=|:)\s*(\d+(?:\.\d+)?)/;
const SIZE_DELTA_RE = /\b(?:font|text|title)\s*size\b[^0-9]{0,12}(?:by\s+)?(\d+(?:\.\d+)?)/;
const SIZE_MENTIONS_RE = /\b(?:font|text|title)\s*size\b/;
const SIZE_UP_RE = /\b(?:bigger|larger)\b/;
const SIZE_DOWN_RE = /\b(?:smaller|tinier)\b/;
const MOVE_RE = /\b(?:move|shift|slide|nudge)\b[^.]*?\b(left|right|up|down|top|bottom|center|centre)\b/;
const CENTER_RE = /\b(?:center|centre)\b/;
const MOVE_PX_RE = /\b(?:move|shift)\b[^.]*?(\d+)\s*px[^.]*?\b(left|right|up|down)\b/;
const TEXT_COLOR_RE = new RegExp(
  `\\b(?:text|title|font|caption|headline)\\b[^.]*?\\b(${COLOR_TOKEN})\\b`,
);
const TRANSPARENT_RE = /\b(?:more\s+transparent|less\s+opaque|fade\s+(?:it|the\s+\w+)\s+out)\b/;
const OPAQUE_RE = /\b(?:more\s+opaque|less\s+transparent)\b/;
const ZOOM_IN_RE = /\b(?:zoom\s*in|scale\s*up|magnif\w+)\b/;
const ZOOM_OUT_RE = /\b(?:zoom\s*out|scale\s*down|shrink\s+the\s+shot)\b/;

/** 指令里指的图层（logo / caption / title / text） */
const kindOf = (lower: string): TargetKind => {
  if (/\blogos?\b/.test(lower)) return "logo";
  if (/\b(?:captions?|subtitles?)\b/.test(lower)) return "caption";
  if (/\b(?:titles?|headlines?)\b/.test(lower)) return "title";
  if (/\b(?:texts?|copy|words?|typography|font)\b/.test(lower)) return "text";
  return "any";
};

/**
 * 解析一句自然语言指令 → 真实改动。
 *
 * @param text 用户的原始指令
 * @param ctx  当前工程 / 选中项 / 卡片表（只读）
 */
export const interpretAgentCommand = (text: string, ctx: AgentContext): AgentResult => {
  const raw = (text ?? "").toString().trim();
  if (!raw) return { ops: [], reply: AGENT_HELP };

  const lower = raw.toLowerCase();
  const fps = Math.max(1, Math.round(ctx.project.fps ?? 30));

  // ——— 1. 新增一个片段 ———
  const addMatch = lower.match(ADD_RE);
  if (addMatch) {
    const what = addMatch[1];
    const pick = ADDABLE.find((a) => a.re.test(what));
    const cardId = pick?.cardId ?? "text-basic";
    const atMatch = lower.match(AT_RE);
    const at = atMatch ? Math.max(0, Math.round(Number(atMatch[1]) * fps)) : undefined;
    const all = clipsOf(ctx.project);
    const selectedTrack = ctx.selectedClipId
      ? all.find((c) => c.clip.id === ctx.selectedClipId)?.trackId
      : undefined;
    const trackId = selectedTrack ?? ctx.project.tracks[0]?.id;
    const label = `Added a ${pick?.label ?? "text card"} clip${at !== undefined ? ` at ${round2(Number(atMatch![1]))}s` : ""}.`;
    return {
      ops: [{ kind: "addClip", cardId, trackId, at, label }],
      reply: label,
    };
  }

  // ——— 2. 删除片段 ———
  if (DELETE_RE.test(lower)) {
    const clip = resolveTarget(ctx, kindOf(lower));
    if (!clip) return { ops: [], reply: "There is no clip on the timeline to delete yet." };
    const name = clipName(ctx, clip);
    const label = `Deleted “${name}”.`;
    return { ops: [{ kind: "removeClip", clipId: clip.id, label }], reply: label };
  }

  // ——— 3. 改文案 ———
  const setText = raw.match(SET_TEXT_RE);
  if (setText) {
    const noun = setText[1].toLowerCase();
    const value = stripQuotes(setText[2]);
    const kind: TargetKind =
      noun === "title" || noun === "headline"
        ? "title"
        : noun === "caption" || noun === "subtitle"
          ? "caption"
          : "text";
    const clip = resolveTarget(ctx, kind);
    if (!clip) return { ops: [], reply: "There is no clip on the timeline yet — add one first." };
    const field = textField(cardSchema(ctx, clip.cardId));
    if (!field) {
      return {
        ops: [],
        reply: `“${clipName(ctx, clip)}” has no text property to change. Pick a text or title card first.`,
      };
    }
    const name = clipName(ctx, clip);
    const label = `Set the text on “${name}” to “${value}”.`;
    return {
      ops: [{ kind: "updateClipProps", clipId: clip.id, props: { [field.key]: value }, label }],
      reply: label,
    };
  }

  // ——— 4. 背景色 ———
  const bg = lower.match(BG_RE);
  if (bg) {
    const color = colorFrom(bg[1]);
    if (color) {
      const label = `Changed the background to ${color}.`;
      return {
        ops: [
          { kind: "setBackground", color, label },
          { kind: "setThemeColors", colors: { page: color }, label },
        ],
        reply: label,
      };
    }
  }

  // ——— 5. 时长 ———
  const durNum =
    lower.match(DURATION_RE)?.[1] ?? lower.match(DURATION_LONG_RE)?.[1] ?? undefined;
  if (durNum !== undefined) {
    const clip = resolveTarget(ctx, "any");
    if (!clip) return { ops: [], reply: "There is no clip on the timeline yet — add one first." };
    const seconds = Math.max(0.1, Number(durNum));
    const duration = Math.max(2, Math.round(seconds * fps));
    const name = clipName(ctx, clip);
    const label = `Set the duration of “${name}” to ${round2(seconds)}s (${duration} frames @ ${fps}fps).`;
    return {
      ops: [{ kind: "updateClip", clipId: clip.id, patch: { duration }, label }],
      reply: label,
    };
  }
  if (DURATION_LENGER_RE.test(lower) || DURATION_SHORTER_RE.test(lower)) {
    const clip = resolveTarget(ctx, "any");
    if (!clip) return { ops: [], reply: "There is no clip on the timeline yet — add one first." };
    const longer = DURATION_LENGER_RE.test(lower);
    const duration = Math.max(2, Math.round(clip.duration * (longer ? 1.25 : 0.8)));
    const name = clipName(ctx, clip);
    const label = `Made “${name}” ${longer ? "longer" : "shorter"}: ${round2(clip.duration / fps)}s → ${round2(duration / fps)}s.`;
    return {
      ops: [{ kind: "updateClip", clipId: clip.id, patch: { duration }, label }],
      reply: label,
    };
  }

  // ——— 6. 速度 ———
  const speedTarget = () => resolveTarget(ctx, "any");
  // "by X" 是相对倍率，必须先于 "to X"（否则 "speed up by 0.5x" 会被当成绝对速度）
  const slowBy = lower.match(SPEED_SLOW_BY_RE)?.[1];
  const upBy = lower.match(SPEED_UP_BY_RE)?.[1];
  if (slowBy !== undefined || upBy !== undefined) {
    const clip = speedTarget();
    if (!clip) return { ops: [], reply: "There is no clip on the timeline yet — add one first." };
    const slowing = slowBy !== undefined;
    const amount = Number(slowing ? slowBy : upBy);
    const next = slowing
      ? clip.speed * (amount <= 1 ? amount : 1 / amount)
      : clip.speed * (amount < 1 ? 1 + amount : amount);
    const name = clipName(ctx, clip);
    const label = `${slowing ? "Slowed" : "Sped up"} “${name}” to ${round2(next)}× (was ${round2(clip.speed)}×).`;
    return {
      ops: [{ kind: "updateClip", clipId: clip.id, patch: { speed: clamp(next, 0.1, 4) }, label }],
      reply: label,
    };
  }
  const slowTo = lower.match(SPEED_SLOW_TO_RE)?.[1];
  const upTo = lower.match(SPEED_UP_TO_RE)?.[1];
  const speedTo = lower.match(SPEED_TO_RE)?.[1];
  if (slowTo !== undefined || upTo !== undefined || speedTo !== undefined) {
    const clip = speedTarget();
    if (!clip) return { ops: [], reply: "There is no clip on the timeline yet — add one first." };
    const next = clamp(Number(slowTo ?? upTo ?? speedTo), 0.1, 4);
    const name = clipName(ctx, clip);
    const label = `Set the playback speed of “${name}” to ${round2(next)}× (was ${round2(clip.speed)}×).`;
    return {
      ops: [{ kind: "updateClip", clipId: clip.id, patch: { speed: next }, label }],
      reply: label,
    };
  }
  if (SPEED_SLOW_RE.test(lower) || SPEED_UP_RE.test(lower)) {
    const clip = speedTarget();
    if (!clip) return { ops: [], reply: "There is no clip on the timeline yet — add one first." };
    const slower = SPEED_SLOW_RE.test(lower);
    const next = clamp(clip.speed * (slower ? 0.5 : 1.5), 0.1, 4);
    const name = clipName(ctx, clip);
    const label = `${slower ? "Slowed" : "Sped up"} “${name}” to ${round2(next)}× (was ${round2(clip.speed)}×).`;
    return {
      ops: [{ kind: "updateClip", clipId: clip.id, patch: { speed: next }, label }],
      reply: label,
    };
  }

  // ——— 7. 字号 ———
  const sizeSet = lower.match(SIZE_SET_RE)?.[1];
  const sizeDelta = lower.match(SIZE_DELTA_RE)?.[1];
  const mentionsSize = SIZE_MENTIONS_RE.test(lower);
  const wantsBigger =
    SIZE_UP_RE.test(lower) || (mentionsSize && /\b(?:increase|raise|grow|boost|enlarge)\b/.test(lower));
  const wantsSmaller =
    SIZE_DOWN_RE.test(lower) || (mentionsSize && /\b(?:decrease|reduce|shrink|lower)\b/.test(lower));
  if (sizeSet !== undefined || sizeDelta !== undefined || wantsBigger || wantsSmaller) {
    const clip = resolveTarget(ctx, kindOf(lower) === "any" ? "text" : kindOf(lower));
    if (!clip) return { ops: [], reply: "There is no clip on the timeline yet — add one first." };
    const schema = cardSchema(ctx, clip.cardId);
    const field = sizeField(schema);
    const name = clipName(ctx, clip);
    if (!numericField(field)) {
      // 没有字号属性：退到图层缩放（仍然是真的改动）
      const next = clamp(clip.scale * (wantsSmaller ? 0.85 : 1.18), 0.2, 3);
      const label = `“${name}” has no text-size property — scaled the layer to ${round2(next)}× (was ${round2(clip.scale)}×).`;
      return {
        ops: [{ kind: "updateClip", clipId: clip.id, patch: { scale: next }, label }],
        reply: label,
      };
    }
    const current = Number(propValue(ctx, clip, field.key) ?? field.default);
    const min = field.min ?? 8;
    const max = field.max ?? 400;
    let next = current;
    if (sizeSet !== undefined) next = Number(sizeSet);
    else if (sizeDelta !== undefined) next = current + Number(sizeDelta);
    else if (wantsBigger) next = current * 1.18;
    else if (wantsSmaller) next = current * 0.85;
    next = clamp(Math.round(next), min, max);
    const label = `Set the text size on “${name}” to ${next}px (was ${Math.round(current)}px).`;
    return {
      ops: [{ kind: "updateClipProps", clipId: clip.id, props: { [field.key]: next }, label }],
      reply: label,
    };
  }

  // ——— 8. 位置 ———
  const movePx = lower.match(MOVE_PX_RE);
  const moveDir = lower.match(MOVE_RE)?.[1];
  if (!moveDir && CENTER_RE.test(lower)) {
    const clip = resolveTarget(ctx, kindOf(lower));
    if (!clip) return { ops: [], reply: "There is no clip on the timeline yet — add one first." };
    const name = clipName(ctx, clip);
    const label = `Centered “${name}” on the frame.`;
    return {
      ops: [{ kind: "updateClip", clipId: clip.id, patch: { x: 0, y: 0 }, label }],
      reply: label,
    };
  }
  if (moveDir) {
    const clip = resolveTarget(ctx, kindOf(lower));
    if (!clip) return { ops: [], reply: "There is no clip on the timeline yet — add one first." };
    const step = movePx ? Number(movePx[1]) : 120;
    const dir = (movePx?.[2] ?? moveDir).toLowerCase();
    let x = clip.x;
    let y = clip.y;
    if (dir === "right") x += step;
    else if (dir === "left") x -= step;
    else if (dir === "up") y -= step;
    else if (dir === "down") y += step;
    else if (dir === "top") y -= step * 2;
    else if (dir === "bottom") y += step * 2;
    else {
      x = 0;
      y = 0;
    }
    const name = clipName(ctx, clip);
    const label =
      dir === "center" || dir === "centre"
        ? `Centered “${name}” on the frame.`
        : `Moved “${name}” ${step}px ${dir}.`;
    return {
      ops: [{ kind: "updateClip", clipId: clip.id, patch: { x, y }, label }],
      reply: label,
    };
  }

  // ——— 9. 文字颜色 ———
  const textColor = lower.match(TEXT_COLOR_RE)?.[1];
  if (textColor) {
    const color = colorFrom(textColor);
    if (color) {
      const clip = resolveTarget(ctx, kindOf(lower) === "any" ? "text" : kindOf(lower));
      if (!clip) return { ops: [], reply: "There is no clip on the timeline yet — add one first." };
      const field = colorField(cardSchema(ctx, clip.cardId));
      if (!field) {
        return {
          ops: [],
          reply: `“${clipName(ctx, clip)}” has no color property to change.`,
        };
      }
      const name = clipName(ctx, clip);
      const label = `Set the text color on “${name}” to ${color}.`;
      return {
        ops: [{ kind: "updateClipProps", clipId: clip.id, props: { [field.key]: color }, label }],
        reply: label,
      };
    }
  }

  // ——— 10. 不透明度 ———
  if (TRANSPARENT_RE.test(lower) || OPAQUE_RE.test(lower)) {
    const clip = resolveTarget(ctx, kindOf(lower));
    if (!clip) return { ops: [], reply: "There is no clip on the timeline yet — add one first." };
    const more = TRANSPARENT_RE.test(lower);
    const opacity = clamp(clip.opacity + (more ? -0.2 : 0.2), 0, 1);
    const name = clipName(ctx, clip);
    const label = `Set the opacity of “${name}” to ${Math.round(opacity * 100)}% (was ${Math.round(clip.opacity * 100)}%).`;
    return {
      ops: [{ kind: "updateClip", clipId: clip.id, patch: { opacity }, label }],
      reply: label,
    };
  }

  // ——— 11. 图层缩放 ———
  if (ZOOM_IN_RE.test(lower) || ZOOM_OUT_RE.test(lower)) {
    const clip = resolveTarget(ctx, kindOf(lower));
    if (!clip) return { ops: [], reply: "There is no clip on the timeline yet — add one first." };
    const inwards = ZOOM_IN_RE.test(lower);
    const scale = clamp(clip.scale * (inwards ? 1.2 : 0.85), 0.2, 3);
    const name = clipName(ctx, clip);
    const label = `Scaled “${name}” to ${round2(scale)}× (was ${round2(clip.scale)}×).`;
    return {
      ops: [{ kind: "updateClip", clipId: clip.id, patch: { scale }, label }],
      reply: label,
    };
  }

  return {
    ops: [],
    reply: `I could not turn that into a change yet. ${AGENT_HELP}`,
  };
};
