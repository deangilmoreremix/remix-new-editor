// Browser entry for the studio feature guides (/studios and /studios/<slug>).
// All logic lives in studioGuides.core.js so the build-time prerender uses it too.
import { buildGuides, groupByCategory } from './studioGuides.core.js';
import screenshots from './guideScreenshots.json';
import videos from './guideVideos.json';
import appsMap from './muapiStudioAppsMap.json';

const modules = import.meta.glob('./askKb/*.json', { eager: true });
const kbByRoute = {};
for (const [path, mod] of Object.entries(modules)) {
  const route = path.split('/').pop().replace(/\.json$/, '');
  if (!route.startsWith('_')) kbByRoute[route] = mod.default || mod;
}

export const GUIDES = buildGuides(kbByRoute, screenshots, {}, videos, appsMap);
export const GUIDES_BY_CATEGORY = groupByCategory(GUIDES);
// Old guide addresses that still work after a rename (old slug -> current slug).
export const GUIDE_SLUG_ALIASES = { 'muapi-studio': 'smartvid-studio' };
export const getGuide = (slug) => GUIDES.find((g) => g.slug === (GUIDE_SLUG_ALIASES[slug] || slug)) || null;

// Every guide including unlisted ones (no public page), for the in-app assistant panel.
export const ALL_GUIDES = buildGuides(kbByRoute, screenshots, { includeUnlisted: true }, videos, appsMap);
