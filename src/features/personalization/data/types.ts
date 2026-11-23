// Shared type layer for all AI video demo data.
// Every demo data file (minimaxH3Demos, seedance25Demos, seedance1Demos, etc.)
// exports the same `VideoDemo` type so components stay framework-agnostic.
//
// The canonical `getCreateUrl()` lives here so every demo — regardless of source —
// maps to the correct existing studio route.

/** The 7 canonical landing-page categories. Source repos may use different
 *  labels (e.g. "music-video", "sci-fi-cyberpunk"); map them to these. */
export const DEMO_CATEGORIES = [
  'Action',
  'Animation',
  'Cinema',
  'Commercial',
  'Fashion',
  'Social',
  'UGC',
] as const;
export type DemoCategory = (typeof DEMO_CATEGORIES)[number];

export type VideoDemo = {
  id: number;
  slug: string;
  title: string;
  category: DemoCategory;
  rawCategory: string;
  useCase: string;
  duration?: number;
  durationLabel?: string;
  aspectRatio?: string;
  videoSrc: string;
  posterSrc: string;
  prompt: string;
  featured?: boolean;
  hero?: boolean;
  interactive?: boolean;
  studioTab: string;
  tags: string[];
  /** Original source URL for attribution (CC BY 4.0 etc.). */
  sourceUrl?: string;
  /** Short identifier for the source data file (e.g. "minimax-h3", "seedance-25"). */
  sourceRepo: string;
  /** Optional model identifier to pre-select in VideoStudio. */
  model?: string;
  /** Optional display name for the model. */
  modelName?: string;
  /** `none` = reviewed, no visible logo / watermark / credit; `logo` = has one; `unreviewed` = not labeled yet. Unset only for demos outside the registry. */
  branding?: 'none' | 'logo' | 'unreviewed';
};

/**
 * The model each demo collection's prompts were written for, used when a demo
 * doesn't record its own. Prompt Feed is left out on purpose: its community
 * prompts target a mix of models.
 */
export const MODEL_BY_SOURCE: Record<string, string> = {
  'minimax-h3': 'MiniMax Hailuo',
  'seedance-25': 'Seedance 2.5',
  'seedance-1': 'Seedance 1',
  seedance2prompt: 'Seedance 2.0',
};

/**
 * The model a demo's prompt is for: its own recorded model if it has one,
 * otherwise its collection's model, otherwise "Community prompt".
 */
export function getModelLabel(demo: Pick<VideoDemo, 'modelName' | 'sourceRepo'>): string {
  return demo.modelName || MODEL_BY_SOURCE[demo.sourceRepo] || 'Community prompt';
}

/**
 * Map a demo to the real, existing studio route it should launch.
 * Do NOT hardcode full URLs across components — use this single layer.
 *
 * The template param format uses `|` as separator to avoid ambiguity with
 * hyphenated sourceRepo values (e.g. "minimax-h3", "seedance-25"):
 *   /studio/{tab}?template={sourceRepo}|{slug}
 * e.g. /studio/video?template=seedance-25|cinematic-story
 */
export function getCreateUrl(demo: VideoDemo): string {
  const tab = demo.studioTab || 'video';
  if (!demo.sourceRepo) {
    throw new Error(`VideoDemo missing sourceRepo for slug: ${demo.slug}`);
  }
  const templateId = `${demo.sourceRepo}|${demo.slug}`;
  return `/studio/${tab}?template=${encodeURIComponent(templateId)}`;
}
