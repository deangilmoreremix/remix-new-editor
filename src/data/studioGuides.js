// Browser entry for the studio feature guides (/studios and /studios/<slug>).
// All logic lives in studioGuides.core.js so the build-time prerender uses it too.
import { buildGuides, groupByCategory } from './studioGuides.core.js';
import screenshots from './guideScreenshots.json';
import videos from './guideVideos.json';

const modules = import.meta.glob('./askKb/*.json', { eager: true });
const kbByRoute = {};
for (const [path, mod] of Object.entries(modules)) {
  const route = path.split('/').pop().replace(/\.json$/, '');
  if (!route.startsWith('_')) kbByRoute[route] = mod.default || mod;
}

export const GUIDES = buildGuides(kbByRoute, screenshots, videos);
export const GUIDES_BY_CATEGORY = groupByCategory(GUIDES);
export const getGuide = (slug) => GUIDES.find((g) => g.slug === slug) || null;
