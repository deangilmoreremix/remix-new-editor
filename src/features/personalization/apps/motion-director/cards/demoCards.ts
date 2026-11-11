import type { CardDef } from "./types";
import { DEMO_MODULES } from "./demo-index";
import { DEMO_CATEGORIES, DEMO_CATEGORY_EN, DEMO_META } from "./demoMeta";
import { DEMO_CARD_SCHEMA } from "./cardSchemas";
import { withDemoProps } from "./demoProps";

/** 镜头卡动效库：demos/<类别>/<卡>/<Stem>.tsx 全量接入（scripts/gen-index.mjs 生成静态索引）。
 *  接入条件与 assets/scripts/smoke-render-demos.py 同口径：文件同时导出 `<Stem>: React.FC`
 *  与 `*_DURATION` / `*_DUR` 时长常量。
 *  demo 是顶部常量驱动、不吃 props，所以这里用 `withDemoProps` 包一层统一的属性面
 *  （标题 / 字号 / 颜色 / 强调色 / 画面染色，见 cards/demoProps.tsx），属性面板与
 *  Motion Agent 改的都是这些 props；默认值不改变任何现有画面。
 *  上轨后还可裁剪 / 变速 / 定格 / 图层变换。
 *  motion-lab 血统的卡（DesignStage + useT）按 Sequence 长度归一化时间：clip 拉长=动画放慢；
 *  其余卡按绝对帧走：clip 超出原时长后尾帧定格。 */
export const DEMO_CARDS: CardDef[] = DEMO_MODULES.map((m) => {
  const meta = DEMO_META[m.stem];
  // category 是存档 / zh 界面的原文（保持中文）；categoryEn 是英文界面与素材库分组、
  // 过滤用的分类键，没有对应译文时回落到英文 "Motion library"（不再是中文兜底）。
  const category = meta?.category ?? "动效库";
  return {
    id: `demo:${m.stem}`,
    name: meta?.name ?? m.stem,
    nameEn: meta?.nameEn ?? m.stem,
    category,
    categoryEn: DEMO_CATEGORY_EN[category] ?? "Motion library",
    durationInFrames: Math.max(2, Math.round(m.duration)),
    component: withDemoProps(m.component, m.stem),
    schema: DEMO_CARD_SCHEMA,
    themeKey: "demo",
    accent: "#c58a2a",
    preview: meta?.preview ? `cardpreviews/${meta.preview}` : undefined,
    summary: meta?.summary,
    summaryEn: meta?.summaryEn,
  };
});

export { DEMO_CATEGORIES };
