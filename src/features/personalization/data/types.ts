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
};

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
