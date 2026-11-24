// Studio feature guides: turns the per-studio Ask SmartVideo knowledge files
// (src/data/askKb/<route>.json) into the public /studios/<slug> guide pages.
//
// Pure JS with no Vite-only APIs, so the browser (src/data/studioGuides.js)
// and the build-time prerender (scripts/build-studio-guides.mjs) share it.

import { STUDIO_ROUTES } from '../lib/studioRoutes.js';
import { STUDIO_LANDING_PAGES } from './studioLandingPages.js';

export const SITE_NAME = 'Smart Video AI Studio';

// Category order and the heading shown on the hub and the landing section.
export const GUIDE_CATEGORIES = [
  { id: 'Image', title: 'Image Studios', blurb: 'Generate, edit, upscale and brand still images.' },
  { id: 'Video', title: 'Video Studios', blurb: 'Generate, direct, animate, voice and finish video.' },
  { id: 'Generate', title: 'Quick Generators', blurb: 'Single-purpose pages and an all-in-one hub for fast image and video generation.' },
  { id: 'Brand', title: 'Brand & Campaigns', blurb: 'Brand kits, product photo shoots, campaigns and asset editing.' },
  { id: 'Agents', title: 'AI Agents & Automation', blurb: 'Agents and tools that plan, build, personalize and send video for you.' },
  { id: 'Home', title: 'Getting Started', blurb: 'Find apps, templates, inspiration and training.' },
  { id: 'My Work', title: 'My Work', blurb: 'Everything you have made, saved and organized.' },
];

// Guide category for routes whose app-menu category is not a guide category (or is missing).
const CATEGORY_OVERRIDES = {
  'smart-video-studio': 'Generate',
  'smart-video-scheduler': 'Agents',
};

// Knowledge files that get no public guide page (the in-app assistant still uses them).
// smart-video-studio: the page does not open yet (missing stylesheet path, React mount, /api/model-registry).
// smartwarmupai is public (the owner chose to publish it; its brand README still notes a trademark check for the name).
export const UNLISTED_GUIDES = new Set(['smart-video-studio']);

// Slugs that should not just be the slugified studio name.
const SLUG_OVERRIDES = {
  'muapi-studio': 'muapi-studio',
  'content-library': 'content-library',
  academy: 'smart-video-academy',
};

// Fallback images that exist in public/ for studios with no captured screenshot.
const FALLBACK_IMAGES = {
  image: '/thumbnails/studios/image.webp',
  edit: '/thumbnails/studios/edit.webp',
  upscale: '/thumbnails/studios/upscale.webp',
  character: '/thumbnails/studios/character.webp',
  commercial: '/thumbnails/studios/commercial.webp',
  influencer: '/thumbnails/heroes/influencer.webp',
  video: '/thumbnails/studios/video.webp',
  cinema: '/thumbnails/studios/cinema.webp',
  'cinema-template': '/thumbnails/heroes/cinema.webp',
  storyboard: '/thumbnails/studios/storyboard.webp',
  effects: '/thumbnails/studios/effects.webp',
  'ai-vfx': '/thumbnails/heroes/effects.webp',
  animate: '/thumbnails/heroes/v2v.webp.png',
  lipsync: '/thumbnails/studios/lipsync.webp',
  videotools: '/thumbnails/studios/videotools.webp',
  avatar: '/thumbnails/studios/avatar.webp',
  audio: '/thumbnails/studios/audio.webp',
  'video-agent': '/thumbnails/heroes/videoagent.webp.png',
  director: '/thumbnails/heroes/director.webp',
  timeline: '/thumbnails/heroes/timeline.webp.png',
  workbench: '/thumbnails/heroes/workbench.webp',
  viral: '/thumbnails/heroes/viral.webp',
  personalizer: '/thumbnails/heroes/personalizer.webp',
  'website-builder': '/thumbnails/heroes/website-builder.webp',
  render: '/thumbnails/studios/render.webp',
  templates: '/thumbnails/pages/templates.webp.png',
  explore: '/thumbnails/pages/explore.webp.png',
  library: '/thumbnails/pages/library.webp',
};
const DEFAULT_IMAGE = '/thumbnails/pages/placeholder.webp';

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const arr = (v) => (Array.isArray(v) ? v : []);
const strs = (v) => arr(v).filter((x) => typeof x === 'string' && x.trim());

function clip(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  return cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : cut.length).replace(/[,;:.\s]+$/, '') + '…';
}

// Glossary is a {term: definition} object in most files, a list in a few.
function glossaryList(g) {
  if (Array.isArray(g)) return g.filter((x) => x && x.term).map((x) => ({ term: x.term, definition: x.definition || '' }));
  if (g && typeof g === 'object') return Object.entries(g).map(([term, definition]) => ({ term, definition: String(definition) }));
  return [];
}

// Some list fields are objects in most files and plain strings in a few.
function titled(list, toObj) {
  return arr(list).map((x) => (typeof x === 'string' ? toObj(x) : x)).filter(Boolean);
}

function uniqueIds(names) {
  const seen = {};
  return names.map((n) => {
    let id = slugify(n) || 'feature';
    if (seen[id]) id = `${id}-${++seen[id]}`;
    else seen[id] = 1;
    return id;
  });
}

/**
 * Build all guides.
 * @param {Record<string, object>} kbByRoute  askKb JSON keyed by route (e.g. "image")
 * @param {Record<string, {overview?: string, features?: Record<string,string>}>} shots
 *        captured screenshots keyed by slug (src/data/guideScreenshots.json)
 */
export function buildGuides(kbByRoute, shots = {}, { includeUnlisted = false } = {}, videos = null) {
  const routes = Object.keys(kbByRoute).filter((r) => !r.startsWith('_') && (includeUnlisted || !UNLISTED_GUIDES.has(r))).sort();
  const slugOf = {};
  for (const route of routes) slugOf[route] = SLUG_OVERRIDES[route] || slugify(kbByRoute[route].name || route);

  const guides = routes.map((route) => {
    const kb = kbByRoute[route];
    const meta = STUDIO_ROUTES[route] || {};
    const legacy = STUDIO_LANDING_PAGES[route];
    const slug = slugOf[route];
    const name = kb.name || meta.label || route;
    const shot = shots[slug] || {};
    const thumbnail = FALLBACK_IMAGES[route] || DEFAULT_IMAGE;
    const overview = shot.overview || thumbnail;

    const fx = arr(kb.featureExplanations).filter((f) => f && f.feature);
    const ids = uniqueIds(fx.map((f) => f.feature));
    const features = fx.map((f, i) => ({
      id: ids[i],
      name: f.feature,
      definition: f.explanation || '',
      whyToUse: f.whyToUse || '',
      inputRequired: f.inputRequired || '',
      restrictions: f.restrictions || '',
      screenshot: (shot.features && shot.features[ids[i]]) || overview,
      hasOwnScreenshot: Boolean(shot.features && shot.features[ids[i]]),
    }));

    const keywords = [
      ...(legacy?.seo ? [legacy.seo.primaryKeyword, ...arr(legacy.seo.secondaryKeywords)] : []),
      `${name} guide`,
      `${name} features`,
      `how to use ${name}`,
      ...features.slice(0, 6).map((f) => `${f.name} AI`),
    ].filter(Boolean);

    const tourInfo = videos?.studios?.[slug];
    return {
      slug,
      route,
      // No public /studios page: the assistant shows it without guide links.
      unlisted: UNLISTED_GUIDES.has(route),
      name,
      // The studio's tour video, when one is uploaded (src/data/guideVideos.json).
      tour: tourInfo ? { video: `${videos.base}/${slug}/tour.mp4`, captions: `${videos.base}/${slug}/captions.vtt`, poster: `${videos.base}/${slug}/poster.webp`, seconds: tourInfo.seconds } : null,
      category: CATEGORY_OVERRIDES[route] || meta.category || 'Agents',
      shortDescription: kb.shortDescription || '',
      description: kb.description || '',
      fullDescription: kb.fullDescription || '',
      bestFor: kb.bestFor || '',
      whenToUse: strs(kb.whenToUse),
      keyFeatures: strs(kb.keyFeatures),
      features,
      howToUse: kb.howToUse || '',
      steps: strs(kb.howToSteps),
      gettingStarted: strs(kb.gettingStarted),
      inputs: arr(kb.inputDetails).filter((x) => x && x.name),
      modes: titled(kb.modeExplanations, null)
        .filter((m) => m && m.mode)
        .map((m) => ({ mode: m.mode, description: m.description || m.explanation || '', useCase: m.useCase || '' })),
      modelCapabilities: kb.modelCapabilities || '',
      outputs: strs(kb.outputs),
      limitations: arr(kb.limitationDetails).filter((x) => x && x.limitation),
      useCases: titled(kb.useCases, (s) => ({ title: s, description: '', steps: [] })).filter((u) => u.title),
      workflows: titled(kb.exampleWorkflows, (s) => ({ title: s, steps: [] })).filter((w) => w.title),
      problems: titled(kb.commonProblems, (s) => ({ problem: s })).filter((p) => p.problem),
      tips: [...strs(kb.tips), ...strs(kb.bestPractices)],
      faqs: arr(kb.faqs).filter((q) => q && q.question && q.answer),
      glossary: glossaryList(kb.glossary),
      relatedRoutes: strs(kb.relatedStudios),
      relatedGuidance: arr(kb.relatedStudioGuidance).filter((x) => x && x.studio),
      thumbnail: shot.overview || thumbnail,
      overview,
      seo: {
        title: `${name}: Features, How It Works & Complete Guide | ${SITE_NAME}`,
        description: clip(`${name}: ${kb.description || kb.shortDescription}`, 158),
        keywords: [...new Set(keywords.map((k) => k.toLowerCase()))].join(', '),
      },
    };
  });

  // Resolve related studios to guide links (skip any without a guide).
  const bySlugRoute = Object.fromEntries(guides.map((g) => [g.route, g]));
  for (const g of guides) {
    const guidance = Object.fromEntries(g.relatedGuidance.map((x) => [x.studio, x]));
    g.related = g.relatedRoutes
      .map((r) => bySlugRoute[r])
      .filter(Boolean)
      .map((r) => ({ slug: r.slug, name: r.name, shortDescription: r.shortDescription, thumbnail: r.thumbnail, why: guidance[r.route]?.relationship || '', whenToMove: guidance[r.route]?.whenToMove || '' }));
  }

  const order = GUIDE_CATEGORIES.map((c) => c.id);
  guides.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name));
  return guides;
}

export function groupByCategory(guides) {
  return GUIDE_CATEGORIES.map((c) => ({ ...c, guides: guides.filter((g) => g.category === c.id) })).filter((c) => c.guides.length);
}
