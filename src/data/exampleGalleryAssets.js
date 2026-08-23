import { minimaxH3Demos, CATEGORY_ROUTES, getCreateTarget } from './minimaxH3Demos.js';
import { minimaxH3Demos as beatapiMinimaxH3Demos, CATEGORY_ROUTES as minimaxRoutes, getCreateTarget as minimaxGetCreateTarget } from './beatapiMinimaxH3Demos.js';
import { seedance25Demos, CATEGORY_ROUTES as seedanceRoutes, getCreateTarget as seedanceGetCreateTarget } from './beatapiSeedance25Demos.js';
import { zeroLuDemos, CATEGORY_ROUTES as zeroLuRoutes, getCreateTarget as zeroLuGetCreateTarget } from './zeroLuDemos.js';
import { ACADEMY_STUDIO_ADAPTERS } from './academyStudioAdapters.js';
import { getAssetById as getAcademyAssetById } from './academy/catalog.js';
import { youmindImagePrompts } from './youmindImagePrompts.js';
import { YOUMIND_STUDIO_ASSETS } from './youmindStudioAssets.js';

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

const AUDIO_TAGS = new Set([
  'audio-or-sound-direction',
  'background-music-audio',
  'native-audio',
  'reference-audio',
  'spoken-voice-audio',
]);
const IMAGE_TAGS = new Set([
  'product-photography',
  'headshot',
  'portrait',
  'lookbook',
  'editorial',
  'stock',
  'mockup',
  'e-commerce',
  'catalog',
  'product',
  'beauty',
  'skincare',
  'perfume',
  'cosmetic',
]);
const IMAGE_ASPECT_RATIOS = new Set(['1:1', '9:16', '4:5', '3:4', '2:3']);
const AVATAR_KEYWORDS = ['avatar', 'consistent'];
const CHAR_TAGS = new Set(['character-reference', 'rider-character', 'warrior-character-image', 'character-consistency', 'character-sheet', 'character-bible', 'character']);
const CHAR_KEYWORDS = [
  'character consistency', 'character reference', 'consistent character',
  'character sheet', 'character bible', 'face id preservation', 'subject consistency',
  'character concept', 'character design', 'character illustration',
  '3d character', 'anime character', 'character introduction'
];
const INFLUENCER_TAGS = new Set(['beauty', 'lifestyle', 'fashion', 'makeup', 'model', 'vlog', 'ugc']);
const INFLUENCER_KEYWORDS = ['beauty', 'makeup', 'lifestyle', 'influencer', 'model'];
const EFFECTS_TAGS = new Set(['vfx', 'visual-effects', 'motion-graphics', 'video-fx', 'video-effects', 'ai-video-effects', 'motion-controls']);
const EFFECTS_KEYWORDS = ['vfx', 'visual effects', 'motion graphics', 'video effects', 'video fx', 'ai video effects', 'motion controls', 'motion-controls'];

function isAudio(demo) {
  return (demo.tags || []).some((t) => AUDIO_TAGS.has(t));
}
function isImage(demo) {
  return (demo.tags || []).some((t) => IMAGE_TAGS.has(t)) || IMAGE_ASPECT_RATIOS.has(demo.aspectRatio);
}
function isAvatar(demo) {
  const text = ((demo.title || '') + ' ' + (demo.useCase || '')).toLowerCase();
  return (demo.tags || []).some((t) => AVATAR_KEYWORDS.some((k) => t.toLowerCase().includes(k))) ||
    text.includes('avatar') ||
    text.includes('consistent character');
}
function isCharacter(demo) {
  const text = ((demo.title || '') + ' ' + (demo.useCase || '')).toLowerCase();
  return (demo.tags || []).some((t) => CHAR_TAGS.has(t)) ||
    CHAR_KEYWORDS.some((k) => text.includes(k));
}
function isInfluencer(demo) {
  const text = ((demo.title || '') + ' ' + (demo.useCase || '')).toLowerCase();
  return (demo.tags || []).some((t) => INFLUENCER_TAGS.has(t)) ||
    (INFLUENCER_KEYWORDS.some((k) => text.includes(k)) && !['model', 'models'].some((k) => text.includes(k)));
}
function isEffects(demo) {
  const text = ((demo.title || '') + ' ' + (demo.useCase || '')).toLowerCase();
  const category = (demo.category || '').toLowerCase();
  return (demo.tags || []).some((t) => EFFECTS_TAGS.has(t)) ||
    EFFECTS_KEYWORDS.some((k) => text.includes(k)) ||
    category === 'vfx' ||
    category === 'ai-vfx';
}

function mapToStudio(demo, routes) {
  if (isAudio(demo)) return 'audio';
  if (isEffects(demo)) return 'effects';
  if (isAvatar(demo)) return 'avatar';
  if (isCharacter(demo)) return 'character';
  if (isImage(demo)) return 'image';
  if (isInfluencer(demo)) return 'influencer';

  const cat = demo.category;
  const route = routes[cat] || 'video';

  switch (route) {
    case 'cinema':
      return 'cinema';
    case 'commercial':
      return 'commercial';
    case 'influencer':
      return 'influencer';
    case 'video':
      return 'video';
    case 'ai-vfx':
      return 'effects';
    case 'character':
      return 'character';
    default:
      return 'video';
  }
}

function createAsset(demo, source, routes, getCreateTargetFn) {
  if (!hasProperTitle(demo)) return null;
  const target = getCreateTargetFn(demo);
  return {
    id: `${source}:${demo.slug || demo.id}`,
    source,
    studio: mapToStudio(demo, routes),
    title: demo.title,
    category: demo.category,
    thumbnail: demo.posterSrc,
    videoSrc: demo.videoSrc,
    tags: demo.tags || [],
    slug: demo.slug,
    routeParams: target?.params || {},
  };
}

export const EXAMPLE_ASSETS = [
  ...YOUMIND_STUDIO_ASSETS,
  ...minimaxH3Demos
    .map((demo) => createAsset(demo, 'minimax', CATEGORY_ROUTES, getCreateTarget))
    .filter(Boolean),
  ...beatapiMinimaxH3Demos
    .map((demo) => createAsset(demo, 'minimax', minimaxRoutes, minimaxGetCreateTarget))
    .filter(Boolean),
  ...seedance25Demos
    .map((demo) => createAsset(demo, 'seedance', seedanceRoutes, seedanceGetCreateTarget))
    .filter(Boolean),
  ...zeroLuDemos
    .filter((d) => d.videoSrc)
    .map((demo) => createAsset(demo, 'zerolu', zeroLuRoutes, zeroLuGetCreateTarget))
    .filter(Boolean),
  ...ACADEMY_STUDIO_ADAPTERS.map((adapter) => {
    const asset = getAcademyAssetById(adapter.id);
    if (!asset) return null;
    return {
      id: `academy:${asset.id}`,
      source: 'academy',
      studio: adapter.studio,
      title: asset.title,
      category: adapter.tags?.[0] || asset.category || '',
      thumbnail: asset.thumbnail || asset.src || '',
      videoSrc: asset.videoSrc || asset.src || '',
      tags: adapter.tags || asset.tags || [],
      stylePreset: adapter.stylePreset ?? null,
      prompt: adapter.prompt ?? null,
    };
  }).filter(Boolean),
  ...youmindImagePrompts.map((p) => {
    return {
      id: p.id,
      source: p.source || 'youmind',
      sourceAuthor: p.author || '',
      date: p.published || '',
      provider: 'youmind',
      studio: 'image',
      title: p.title,
      category: p.category,
      thumbnail: p.thumbnail,
      videoSrc: '',
      tags: p.tags,
      slug: p.id,
      routeParams: {},
      prompt: p.prompt,
    };
  }),
];

export function getAssetsForStudio(studioId) {
  return EXAMPLE_ASSETS
    .filter((asset) => {
      if (asset.studio !== studioId) return false;
      if (studioId === 'image' && asset.videoSrc) return false;
      return true;
    })
    .slice(0, MAX_EXAMPLES_PER_STUDIO);
}

export function getAssetById(id) {
  return EXAMPLE_ASSETS.find((asset) => asset.id === id);
}

export function getRelatedAssets(asset, limit = 8) {
  if (!asset) return [];
  const sameSource = EXAMPLE_ASSETS.filter((a) => a.id !== asset.id && a.source === asset.source);
  const sameCategory = EXAMPLE_ASSETS.filter((a) => a.id !== asset.id && a.category === asset.category && a.source !== asset.source);
  const merged = [...sameSource, ...sameCategory];
  const seen = new Set();
  return merged.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  }).slice(0, limit);
}

export function getAllExampleAssets() {
  return EXAMPLE_ASSETS;
}
