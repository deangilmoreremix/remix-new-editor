import type { PropField } from "./types";

/**
 * 属性 schema 的单一来源。
 *
 * 卡片的 `schema` 与 Motion Agent 的属性解析都读这里：Agent 必须知道一张卡
 * 有哪些可调属性（文案 / 字号 / 颜色…），否则只能改图层变换，改不了内容。
 *
 * 放在这里而不是各组件模块里，是为了让 `lib/agentCommands.ts` 的解释器不必
 * import Remotion 组件树（150 张 demo 卡 + png 纹理）就能读到属性面。
 */

/** 通用文字卡（text-basic） */
export const TEXT_BASIC_SCHEMA: PropField[] = [
  { type: "textarea", key: "content", label: "文字内容", default: "Type your text here" },
  { type: "slider", key: "fontSize", label: "字号", default: 64, min: 16, max: 180, step: 1, unit: "px" },
  { type: "color", key: "color", label: "文字颜色", default: "#1d1d1f" },
  {
    type: "select", key: "fontWeight", label: "字重", default: "700",
    options: [
      { value: "400", label: "常规 400" },
      { value: "600", label: "半粗 600" },
      { value: "700", label: "加粗 700" },
      { value: "900", label: "特粗 900" },
    ],
  },
  { type: "slider", key: "letterSpacing", label: "字距", default: 0, min: -4, max: 24, step: 0.5, unit: "px" },
  {
    type: "select", key: "align", label: "对齐", default: "center",
    options: [
      { value: "left", label: "左对齐" },
      { value: "center", label: "居中" },
      { value: "right", label: "右对齐" },
    ],
  },
  {
    type: "select", key: "anim", label: "入场动画", default: "fade-up",
    options: [
      { value: "fade-up", label: "淡入上浮" },
      { value: "slam", label: "砸出" },
      { value: "mask", label: "遮罩揭示" },
      { value: "typewriter", label: "打字机" },
      { value: "fade", label: "纯淡入" },
      { value: "none", label: "无" },
    ],
  },
  { type: "slider", key: "delay", label: "入场延迟", default: 0.3, min: 0, max: 3, step: 0.05, unit: "s" },
  { type: "slider", key: "animDur", label: "动画时长", default: 0.4, min: 0.1, max: 2, step: 0.05, unit: "s" },
  { type: "color", key: "bg", label: "背景色", default: "#ffffff" },
  { type: "boolean", key: "transparentBg", label: "透明背景", default: false },
];

/** 字卡 · Ink Press */
export const TITLE_CARD_SCHEMA: PropField[] = [
  { type: "textarea", key: "text", label: "文案（*词* = 强调）", default: "All your team’s research, *one* place to go." },
  { type: "text", key: "sub", label: "副标（等宽小字）", default: "" },
  { type: "text", key: "subDigits", label: "副标滚动数字", default: "" },
  { type: "color", key: "bg", label: "纸底", default: "#f7f4ee" },
  { type: "color", key: "ink", label: "墨色", default: "#1c1a17" },
  { type: "color", key: "accent", label: "强调色", default: "#b5651d" },
  { type: "slider", key: "fontSize", label: "字号", default: 116, min: 60, max: 160, step: 1, unit: "px" },
  { type: "slider", key: "underlineWidth", label: "下划线宽", default: 220, min: 0, max: 600, step: 10, unit: "px" },
  { type: "text", key: "logo", label: "Logo（图片地址）", default: "" },
  { type: "slider", key: "logoHeight", label: "Logo 高度", default: 110, min: 40, max: 320, step: 2, unit: "px" },
];

/** 解说字幕条 · Ink Press */
export const CAPTION_STRIP_SCHEMA: PropField[] = [
  { type: "text", key: "text", label: "文案", default: "SEARCH · FILTER · OPEN" },
  { type: "slider", key: "bottom", label: "底距", default: 72, min: 20, max: 400, step: 2, unit: "px" },
  { type: "slider", key: "fontSize", label: "字号", default: 22, min: 14, max: 48, step: 1, unit: "px" },
  { type: "color", key: "color", label: "文字色", default: "#615c54" },
  { type: "color", key: "accent", label: "方点色", default: "#b5651d" },
  { type: "boolean", key: "uppercase", label: "全大写", default: true },
];

/** Seam transitions (wipe / barn-door / dip) */
export const SEAM_WIPE_SCHEMA: PropField[] = [
  { type: "color", key: "color", label: "Panel colour", default: "#14110f" },
  {
    type: "select", key: "dir", label: "Direction", default: "right",
    options: [{ value: "right", label: "→" }, { value: "left", label: "←" }, { value: "up", label: "↑" }, { value: "down", label: "↓" }],
  },
];
export const SEAM_BARN_SCHEMA: PropField[] = [{ type: "color", key: "color", label: "Panel colour", default: "#14110f" }];
export const SEAM_DIP_SCHEMA: PropField[] = [{ type: "color", key: "color", label: "Dip colour", default: "#14110f" }];

export const SEAM_LEAK_SCHEMA: PropField[] = [
  { type: "color", key: "color", label: "Glow colour", default: "#ffb45a" },
  { type: "slider", key: "peak", label: "Peak opacity", default: 0.9, min: 0.3, max: 1, step: 0.05 },
];

/** 暖白闪转场 · Ink Press */
export const FLASH_CUT_SCHEMA: PropField[] = [
  { type: "slider", key: "peak", label: "峰值不透明度", default: 0.85, min: 0.2, max: 1, step: 0.05 },
  { type: "color", key: "color", label: "暖白色", default: "#fff8eb" },
];

/**
 * 动效库（demo 卡）的属性面。
 *
 * demo 组件是顶部常量驱动的、不吃 props，所以这里给 150 张 demo 卡统一挂一层
 * 包装（`demoProps.tsx`）来消费这些 props：标题文本 / 字号 / 颜色 / 强调色 /
 * 画面染色。默认值不改变任何现有画面（标题为空、染色强度为 0）。
 */
export const DEMO_CARD_SCHEMA: PropField[] = [
  { type: "text", key: "title", label: "标题文本", default: "" },
  { type: "slider", key: "titleSize", label: "标题字号", default: 64, min: 16, max: 240, step: 1, unit: "px" },
  { type: "color", key: "titleColor", label: "标题颜色", default: "#ffffff" },
  { type: "color", key: "accent", label: "强调色", default: "#22d3ee" },
  { type: "color", key: "tint", label: "画面染色", default: "#000000" },
  { type: "slider", key: "tintOpacity", label: "染色强度", default: 0, min: 0, max: 1, step: 0.05 },
];

/** 内置卡（原生卡）的属性面，按 cardId 索引 */
export const NATIVE_CARD_SCHEMAS: Record<string, PropField[]> = {
  "text-basic": TEXT_BASIC_SCHEMA,
  "inkpress-title-card": TITLE_CARD_SCHEMA,
  "inkpress-caption": CAPTION_STRIP_SCHEMA,
  "inkpress-flash-cut": FLASH_CUT_SCHEMA,
  "inkpress-seam-wipe": SEAM_WIPE_SCHEMA,
  "inkpress-seam-barn": SEAM_BARN_SCHEMA,
  "inkpress-seam-dip": SEAM_DIP_SCHEMA,
  "inkpress-seam-whip": SEAM_DIP_SCHEMA,
  "inkpress-seam-ink": SEAM_DIP_SCHEMA,
  "inkpress-seam-leak": SEAM_LEAK_SCHEMA,
  "inkpress-seam-portal": SEAM_DIP_SCHEMA,
  "inkpress-seam-iris": SEAM_DIP_SCHEMA,
  "inkpress-seam-line": SEAM_DIP_SCHEMA,
  "inkpress-seam-glitch": [],
};

/**
 * 取一张卡的属性面：调用方（解释器）传进来的 registry 优先，
 * 否则回落到这里的内置表；`demo:` 前缀的卡用统一的动效库属性面。
 */
export const schemaForCard = (cardId: string): PropField[] | undefined => {
  if (NATIVE_CARD_SCHEMAS[cardId]) return NATIVE_CARD_SCHEMAS[cardId];
  if (cardId.startsWith("demo:")) return DEMO_CARD_SCHEMA;
  return undefined;
};
