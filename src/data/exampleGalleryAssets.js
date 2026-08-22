import { minimaxH3Demos, CATEGORY_ROUTES, getCreateTarget } from './minimaxH3Demos.js';
import { ACADEMY_STUDIO_ADAPTERS } from './academyStudioAdapters.js';
import { getAssetById as getAcademyAssetById } from './academy/catalog.js';
import { youmindImagePrompts } from './youmindImagePrompts.js';

// Hard cap per studio. ExampleGallery will show at most this many cards.
export const MAX_EXAMPLES_PER_STUDIO = 28;

function hasProperTitle(demo) {
  const title = (demo.title || '').trim();
  if (!title) return false;
  if (title.length > 80) return false;
  if (title.startsWith('PROMPT')) return false;
  if (title.startsWith('[') || title.startsWith('━') || title.startsWith('_')) return false;
  if (title === title.toUpperCase() && title.length > 8) return false;
  if (/^(PART\s*\d+|SOURCE\s+AND\s+CONTINUATION|LISTEN\s+UP|STYLE\s+\+|REFERENCE\s+LAYER)/i.test(title)) return false;
  if (/^(created\s+with|made\s+with|generated\s+with)\s+/i.test(title)) return false;
  return true;
}

export const EXAMPLE_ASSETS = [
  ...minimaxH3Demos
    .filter(hasProperTitle)
    .map((demo) => {
      const target = getCreateTarget(demo);
      return {
        id: String(demo.id),
        source: 'minimax',
        studio: CATEGORY_ROUTES[demo.category] || 'video',
        title: demo.title,
        category: demo.category,
        thumbnail: demo.posterSrc,
        tags: demo.tags,
        slug: demo.slug,
        routeParams: target.params,
      };
    }),
  ...ACADEMY_STUDIO_ADAPTERS.map((adapter) => {
    const asset = getAcademyAssetById(adapter.id);
    if (!asset) return null;
    return {
      id: asset.id,
      source: 'academy',
      studio: adapter.studio,
      title: asset.title,
      category: adapter.tags?.[0] || asset.category || '',
      thumbnail: asset.thumbnail || asset.src || '',
      tags: adapter.tags || asset.tags || [],
      stylePreset: adapter.stylePreset ?? null,
      prompt: adapter.prompt ?? null,
    };
  }).filter(Boolean),
  // YouMind image prompt libraries — pure image-generation examples
  // for the image studio.
  ...youmindImagePrompts.map((p) => ({
    id: p.id,
    source: 'youmind',
    studio: 'image',
    title: p.title,
    category: p.category,
    thumbnail: p.thumbnail,
    videoSrc: '',
    tags: p.tags,
    slug: p.id,
    routeParams: {},
    prompt: p.prompt,
  })),
];

export function getAssetsForStudio(studioId) {
  return EXAMPLE_ASSETS
    .filter((asset) => asset.studio === studioId)
    .slice(0, MAX_EXAMPLES_PER_STUDIO);
}

export function getAssetById(id) {
  return EXAMPLE_ASSETS.find((asset) => asset.id === id);
}

export function getAllExampleAssets() {
  return EXAMPLE_ASSETS;
}
