// Studio guides: screenshots live in public/guides/<slug>/ and are listed in guideScreenshots.json.
// This maps each guide slug to the SPA route of the studio it documents. Website Builder and
// Video Pages have no guide images, so they have no entry.
import screenshots from './guideScreenshots.json';

export const GUIDE_ROUTES = {
  'ai-influencer': 'influencer',
  'ai-vfx-studio': 'ai-vfx',
  'animate-studio': 'animate',
  'audio-studio': 'audio',
  'avatar-studio': 'avatar',
  'brand-studio': 'brand',
  'character-studio': 'character',
  'cinema-studio': 'cinema',
  'cinema-templates': 'cinema-template',
  'content-library': 'content-library',
  director: 'director',
  'edit-studio': 'edit',
  'effects-studio': 'effects',
  'find-my-brand': 'find-my-brand',
  'image-studio': 'image',
  'lead-finder': 'leadfinder',
  library: 'library',
  'lip-sync-studio': 'lipsync',
  'motion-director': 'motion-director',
  personalizer: 'personalizer',
  'product-shot-studio': 'commercial',
  recorder: 'recorder',
  'smart-video-academy': 'academy',
  'smart-video-viral': 'viral',
  'storyboard-studio': 'storyboard',
  templates: 'templates',
  'timeline-editor': 'timeline',
  'upscale-suite': 'upscale',
  'video-agent': 'video-agent',
  'video-outreach': 'outreach',
  'video-render': 'render',
  'video-studio': 'video',
  'video-tools': 'videotools',
  workbench: 'workbench',
  'zack-d-studio': 'zackd',
};

const ROUTE_TO_SLUG = Object.fromEntries(Object.entries(GUIDE_ROUTES).map(([slug, route]) => [route, slug]));

export const guideSlugForRoute = (route) => (ROUTE_TO_SLUG[route] && screenshots[ROUTE_TO_SLUG[route]] ? ROUTE_TO_SLUG[route] : null);
export const getGuide = (slug) => screenshots[slug] || null;

/** "photo-studio-generation-mode-brand-api-direct-muapi" -> "Photo studio generation mode brand api direct muapi" */
export function featureLabel(id) {
  const text = String(id).replace(/-/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
