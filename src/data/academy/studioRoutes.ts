// studioRoutes.ts
//
// Maps an Academy track / category slug to the target SmartVideo studio that
// should open when a learner clicks "Try this in Studio" on an example asset
// (LEARN → SEE → CREATE flow).
//
// `studio` is the human-facing studio name (used for labels / badges);
// `route` is the router-native key that `navigate()` / `openStyleInStudio()`
// consume. This app is a hash-routed SPA, so we navigate by key, not by URL
// (a real `/video` href would 404 on the server). `model` is the optional
// default model to pre-select in the destination studio.

export type AcademyStudioName =
  | 'VideoStudio'
  | 'CinemaStudio'
  | 'AvatarStudio'
  | 'AudioStudio'
  | 'ImageStudio'
  | 'TemplateStudio'
  | 'CommercialStudio';

export interface AcademyStudioTarget {
  studio: AcademyStudioName;
  route: string;
  model?: string;
}

// Keyed by the short track slug (without the leading "NN-" number). The helper
// `getAcademyStudioRoute` also accepts the full slug ("01-ai-video-ads-ugc")
// and normalises it.
export const ACADEMY_STUDIO_ROUTES: Record<string, AcademyStudioTarget> = {
  'ai-video-ads-ugc': { studio: 'VideoStudio', route: 'video', model: 'MiniMax Hailuo 3 (H3)' },
  'ai-filmmaking': { studio: 'CinemaStudio', route: 'cinema' },
  'faceless-ai-channels': { studio: 'VideoStudio', route: 'video' },
  'ai-content-factories': { studio: 'TemplateStudio', route: 'templates' },
  'ai-avatars-and-influencers': { studio: 'AvatarStudio', route: 'avatar' },
  'ai-audio-and-music': { studio: 'AudioStudio', route: 'audio' },
  'ai-product-photography': { studio: 'ImageStudio', route: 'image' },
  'ai-fashion-and-virtual-tryon': { studio: 'ImageStudio', route: 'image' },
  'ai-real-estate-staging': { studio: 'ImageStudio', route: 'image' },
  'ai-headshots-and-portraits': { studio: 'ImageStudio', route: 'image' },
  'ai-print-on-demand-and-merch': { studio: 'ImageStudio', route: 'image' },
  'ai-stock-content-and-licensing': { studio: 'VideoStudio', route: 'video' },
  'ai-tools-mastery': { studio: 'VideoStudio', route: 'video' },
  'ai-freelancing-and-agency-business': { studio: 'TemplateStudio', route: 'templates' },
  'ai-agents-and-vibe-coding': { studio: 'VideoStudio', route: 'video' },
};

/** Strip the leading "NN-" track-number prefix: "01-ai-video-ads-ugc" → "ai-video-ads-ugc". */
function normalizeCategorySlug(category: string): string {
  return category.replace(/^\d+-/, '');
}

/**
 * Resolve an Academy track / category slug (full form like "01-ai-video-ads-ugc"
 * or the short form "ai-video-ads-ugc") to its target studio. Returns null when
 * no mapping exists (e.g. an unmapped category).
 */
export function getAcademyStudioRoute(category?: string): AcademyStudioTarget | null {
  if (!category) return null;
  return ACADEMY_STUDIO_ROUTES[normalizeCategorySlug(category)] || null;
}

export default ACADEMY_STUDIO_ROUTES;
