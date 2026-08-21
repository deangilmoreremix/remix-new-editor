import { minimaxH3Demos, CATEGORY_ROUTES, getCreateTarget } from './minimaxH3Demos.js';
import { ACADEMY_STUDIO_ADAPTERS } from './academyStudioAdapters.js';
import { getAssetById as getAcademyAssetById } from './academy/catalog.js';

export const EXAMPLE_ASSETS = [
  ...minimaxH3Demos.map((demo) => {
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
];

export function getAssetsForStudio(studioId) {
  return EXAMPLE_ASSETS.filter((asset) => asset.studio === studioId);
}

export function getAssetById(id) {
  return EXAMPLE_ASSETS.find((asset) => asset.id === id);
}

export function getAllExampleAssets() {
  return EXAMPLE_ASSETS;
}
