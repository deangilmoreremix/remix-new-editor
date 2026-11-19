// src/lib/guideImages.js
// The studio guide screenshots (public/guides/<studio-slug>/overview.webp and one image per feature), mapped by
// src/data/guideScreenshots.json: { <slug>: { overview, features: { <featureId>: '/guides/<slug>/<file>.webp' } } }.
import GUIDES from '../data/guideScreenshots.json';

/** The overview screenshot for a guide folder slug, or null (the studio has none). */
export function getGuideOverview(slug) {
  return (slug && GUIDES[slug]?.overview) || null;
}

/** One feature's screenshot, or null. */
export function getGuideFeature(slug, featureId) {
  return (slug && GUIDES[slug]?.features?.[featureId]) || null;
}

/** { <featureId>: path } for a studio ({} when it has none). */
export function getGuideFeatures(slug) {
  return (slug && GUIDES[slug]?.features) || {};
}

export const guideSlugs = () => Object.keys(GUIDES);
