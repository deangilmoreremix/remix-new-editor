// assetShape.js
//
// One normaliser for the three asset shapes the demo components are handed.
// This is the React-side sibling of normalizeItem() in src/lib/examplesRail.js
// — same job, but it keeps the raw field names the media engine wants instead
// of collapsing everything into a rail-specific item.
//
// Supported inputs:
//   1. MiniMax demo   — getMiniMaxDemosWithTargets() / minimaxH3Demos.js
//                       { slug, title, category, useCase, duration, aspectRatio,
//                         videoSrc, posterSrc, tags, sourceAuthor, sourceUrl }
//   2. Style preset   — src/data/minimax/presets.js
//                       { slug, title, author, sourceClipUrl, thumbnail, prompt,
//                         aspectRatio, durationMs, styleTags, targetStudio, ... }
//   3. Academy asset  — src/data/academy/catalog.js
//                       { id, title, type, src, videoSrc, thumbnail, tags, prompt }

import { formatDuration, ratioToNumber } from '../../data/minimaxH3Demos.js';

const DEFAULT_RATIO = '16:9';

export function assetSlug(asset) {
  if (!asset) return '';
  if (asset.slug) return String(asset.slug);
  if (asset.id != null) return String(asset.id);
  return '';
}

/** Poster/preview still: `.webp`/`.jpg` for MiniMax, `thumbnail` elsewhere. */
export function assetPoster(asset) {
  if (!asset) return '';
  if (asset.posterSrc) return asset.posterSrc;
  if (asset.thumbnail) return asset.thumbnail;
  // Academy image/gif assets are their own preview.
  if (asset.src && asset.type !== 'video') return asset.src;
  return '';
}

export function assetVideo(asset) {
  if (!asset) return null;
  if (asset.videoSrc) return asset.videoSrc;
  if (asset.sourceClipUrl) return asset.sourceClipUrl;
  if (asset.src && asset.type === 'video') return asset.src;
  return null;
}

export function assetRatio(asset) {
  return (asset && asset.aspectRatio) || DEFAULT_RATIO;
}

export function assetDuration(asset) {
  if (!asset) return '—';
  // MiniMax demos carry `duration` in seconds; formatDuration owns the format.
  if (asset.duration) return formatDuration(asset);
  if (asset.durationMs) return `${Math.round(asset.durationMs / 1000)}s`;
  return '—';
}

export function assetTags(asset) {
  const tags = (asset && (asset.styleTags || asset.tags)) || [];
  return Array.isArray(tags) ? tags.filter(Boolean) : [];
}

export function assetCategory(asset) {
  if (!asset) return '';
  if (asset.category) return asset.category;
  const [first] = assetTags(asset);
  return first ? String(first).replace(/-/g, ' ') : '';
}

/**
 * The minimal shape createMediaFrame() reads: it only ever touches
 * `slug`, `title`, `posterSrc` and `videoSrc`.
 */
export function toMediaDemo(asset) {
  return {
    slug: assetSlug(asset),
    title: (asset && asset.title) || 'Untitled demo',
    posterSrc: assetPoster(asset),
    videoSrc: assetVideo(asset),
  };
}

/** Everything the card/modal chrome needs, resolved once per asset. */
export function describeAsset(asset) {
  const ratio = assetRatio(asset);
  return {
    slug: assetSlug(asset),
    title: (asset && asset.title) || 'Untitled demo',
    author: (asset && (asset.sourceAuthor || asset.author)) || '',
    sourceUrl: (asset && asset.sourceUrl) || '',
    ratio,
    ratioNumber: ratioToNumber(ratio),
    duration: assetDuration(asset),
    category: assetCategory(asset),
    tags: assetTags(asset),
    useCase: (asset && (asset.useCase || asset.description)) || '',
    prompt: (asset && asset.prompt) || '',
    rightsNote: (asset && asset.rightsNote) || '',
    targetStudio: (asset && (asset.targetStudio || asset.__route)) || '',
    hasVideo: Boolean(assetVideo(asset)),
  };
}

export const SOURCE_LABELS = { minimax: 'MiniMax', academy: 'Academy' };

/** Minimax = cyan, Academy = purple (roadmap §2.6: source badge is one signal). */
export function sourceTone(source) {
  return source === 'academy' ? 'purple' : 'cyan';
}

export function sourceLabel(source) {
  return SOURCE_LABELS[source] || SOURCE_LABELS.minimax;
}
