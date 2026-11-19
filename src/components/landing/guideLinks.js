// Maps a studio name or app route used on the landing page to its public
// feature guide (/studios/<slug>), so studio mentions are crawlable links.
import GUIDE_INDEX from '../../data/studioGuideIndex.json';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const BY_KEY = new Map();
for (const c of GUIDE_INDEX) {
  for (const g of c.guides) {
    BY_KEY.set(norm(g.slug), g.slug);
    BY_KEY.set(norm(g.name), g.slug);
    if (g.route) BY_KEY.set(norm(g.route), g.slug);
  }
}

// Short labels the landing page uses that differ from guide names or routes.
const ALIASES = {
  vfx: 'ai-vfx-studio',
  'lip sync': 'lip-sync-studio',
  timeline: 'timeline-editor',
  motion: 'motion-director',
  commercial: 'product-shot-studio',
  'product shot': 'product-shot-studio',
  academy: 'smart-video-academy',
  content: 'content-library',
};
for (const [k, slug] of Object.entries(ALIASES)) BY_KEY.set(norm(k), slug);

/** Guide slug for a studio name or route, or null when there is no guide. */
export function guideSlugFor(key) {
  return BY_KEY.get(norm(key)) || null;
}

/** /studios/<slug> for a studio name or route, or null when there is no guide. */
export function guideHrefFor(key) {
  const slug = guideSlugFor(key);
  return slug ? `/studios/${slug}` : null;
}
