#!/usr/bin/env node
/**
 * Generates YouMind studio asset data and viral overflow from the canonical
 * youmindImagePrompts.js source.
 *
 *   node scripts/generate-youmind-studio-assets.mjs
 *
 * Reads:
 *   src/data/youmindImagePrompts.js  (272 image prompts)
 *
 * Writes:
 *   src/data/youmindStudioAssets.js   (112 curated items, 28 per studio)
 *   src/data/youmindViralOverflow.js  (remaining items in VPF format)
 *
 * Studio categorization rules:
 *   avatar    — category "Profile / Avatar" OR tags include "avatar"/"portrait"/"selfie"
 *   character — category contains "Character" OR tags include "character"
 *               OR title contains "character"/"anime" OR tags include "illustration"
 *   commercial— category "Product Marketing" OR "E-commerce" OR contains "Commercial"
 *               OR tags include "product"/"marketing"/"e-commerce"
 *   influencer— category contains "Social Media" OR tags include "social"/"fashion"/
 *               "influencer"/"model"/"lifestyle"
 *   viral     — everything else
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SRC_DIR = join(REPO_ROOT, 'src', 'data');

const SOURCE_PATH = join(SRC_DIR, 'youmindImagePrompts.js');
const STUDIO_OUT = join(SRC_DIR, 'youmindStudioAssets.js');
const VIRAL_OUT = join(SRC_DIR, 'youmindViralOverflow.js');

const STUDIOS = ['avatar', 'character', 'commercial', 'influencer'];
const MAX_PER_STUDIO = 28;

// ---------- helpers ----------

function toSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function escapeJsStr(str) {
  return JSON.stringify(str);
}

function isAvatar(item) {
  const cat = (item.category || '').toLowerCase();
  const tags = (item.tags || []).map(t => t.toLowerCase());
  return (
    cat === 'profile / avatar' ||
    tags.includes('avatar') ||
    tags.includes('portrait') ||
    tags.includes('selfie')
  );
}

function isCharacter(item) {
  const cat = (item.category || '').toLowerCase();
  const tags = (item.tags || []).map(t => t.toLowerCase());
  const title = (item.title || '').toLowerCase();
  return (
    cat.includes('character') ||
    tags.includes('character') ||
    title.includes('character') ||
    title.includes('anime') ||
    tags.includes('illustration')
  );
}

function isCommercial(item) {
  const cat = (item.category || '').toLowerCase();
  const tags = (item.tags || []).map(t => t.toLowerCase());
  return (
    cat === 'product marketing' ||
    cat === 'e-commerce' ||
    cat.includes('commercial') ||
    tags.includes('product') ||
    tags.includes('marketing') ||
    tags.includes('e-commerce')
  );
}

function isInfluencer(item) {
  const cat = (item.category || '').toLowerCase();
  const tags = (item.tags || []).map(t => t.toLowerCase());
  return (
    cat.includes('social media') ||
    tags.includes('social') ||
    tags.includes('fashion') ||
    tags.includes('influencer') ||
    tags.includes('model') ||
    tags.includes('lifestyle')
  );
}

function categorize(item) {
  if (isAvatar(item)) return 'avatar';
  if (isCharacter(item)) return 'character';
  if (isCommercial(item)) return 'commercial';
  if (isInfluencer(item)) return 'influencer';
  return 'viral';
}

// ---------- parse source ----------

const sourceText = readFileSync(SOURCE_PATH, 'utf8');
const match = sourceText.match(/export const youmindImagePrompts = (\[[\s\S]*?\]);/);
if (!match) {
  throw new Error('Could not find youmindImagePrompts array in source file');
}

// Parse the JS array literal. The file contains only JSON-compatible objects
// inside the array, so a safe eval of just the bracketed portion works.
const items = eval(match[1]);
if (!Array.isArray(items) || items.length === 0) {
  throw new Error('youmindImagePrompts array is empty or not an array');
}

// ---------- bucket ----------

const buckets = { avatar: [], character: [], commercial: [], influencer: [], viral: [] };
items.forEach((item) => {
  const studio = categorize(item);
  buckets[studio].push(item);
});

// ---------- ensure exactly 28 per studio ----------
// Influencer may be short; backfill from viral overflow if needed.
// Any items trimmed from over-subscribed studios also go to viral overflow.
const curated = {};
const overflowAccum = [];
for (const studio of STUDIOS) {
  const pool = buckets[studio];
  if (pool.length >= MAX_PER_STUDIO) {
    curated[studio] = pool.slice(0, MAX_PER_STUDIO);
    overflowAccum.push(...pool.slice(MAX_PER_STUDIO));
  } else {
    const deficit = MAX_PER_STUDIO - pool.length;
    const backfill = buckets.viral.splice(0, deficit);
    curated[studio] = [...pool, ...backfill];
  }
}
const overflow = [...buckets.viral, ...overflowAccum];

// ---------- build outputs ----------

const now = new Date().toISOString();

const studioItems = curated.avatar.flatMap((item, idx) => {
  const studio = 'avatar';
  return [
    {
      id: item.id,
      source: 'youmind',
      studio,
      title: item.title,
      category: item.category,
      thumbnail: item.thumbnail || '',
      videoSrc: '',
      tags: item.tags || [],
      slug: toSlug(item.title) || item.id,
      routeParams: {},
      prompt: item.prompt || '',
    },
  ];
});

// Helper to build a single studio asset
function buildStudioAsset(item, studio) {
  return {
    id: item.id,
    source: 'youmind',
    studio,
    title: item.title,
    category: item.category,
    thumbnail: item.thumbnail || '',
    videoSrc: '',
    tags: item.tags || [],
    slug: toSlug(item.title) || item.id,
    routeParams: {},
    prompt: item.prompt || '',
  };
}

function buildVpfItem(item) {
  const author = item.author || '';
  const thumb = item.thumbnail || '';
  return {
    imglumeId: item.id,
    title: item.title,
    prompt: item.prompt || '',
    mediaType: 'image',
    media: [
      {
        type: 'image',
        previewUrl: thumb,
        sourceUrl: thumb,
      },
    ],
    categories: [item.category].filter(Boolean),
    tags: item.tags || [],
    recommendedModel: 'nanobanana',
    source: {
      author: {
        handle: '',
        name: author,
        url: '',
      },
      engagement: {
        likes: 0,
        reposts: 0,
        replies: 0,
      },
      publishedAt: item.published || '',
      url: '',
    },
    provenance: {
      updatedAt: now,
    },
  };
}

function renderObject(obj, indent = 2) {
  const pad = ' '.repeat(indent);
  const entries = Object.entries(obj);
  if (entries.length === 0) return '{}';
  const lines = entries.map(([key, val]) => {
    if (val === null || val === undefined) return `${pad}${key}: null`;
    if (typeof val === 'string') return `${pad}${key}: ${escapeJsStr(val)}`;
    if (Array.isArray(val)) return `${pad}${key}: [${val.map(v => typeof v === 'string' ? escapeJsStr(v) : renderObject(v, indent + 2)).join(', ')}]`;
    if (typeof val === 'object') return `${pad}${key}: ${renderObject(val, indent + 2)}`;
    return `${pad}${key}: ${JSON.stringify(val)}`;
  });
  return `{\n${lines.join(',\n')}\n${' '.repeat(indent - 2)}}`;
}

function renderArray(arr, indent = 2) {
  if (arr.length === 0) return '[]';
  const pad = ' '.repeat(indent);
  const items = arr.map(item => {
    if (typeof item === 'string') return `${pad}${escapeJsStr(item)}`;
    return `${pad}${renderObject(item, indent + 2)}`;
  });
  return `[\n${items.join(',\n')}\n]`;
}

// ---------- write studio assets ----------

const studioAssets = [];
for (const studio of STUDIOS) {
  for (const item of curated[studio]) {
    studioAssets.push(buildStudioAsset(item, studio));
  }
}

const studioHeader = `// AUTO-GENERATED FILE — do not edit by hand.
//
// Regenerate with:
//   node scripts/generate-youmind-studio-assets.mjs
//
// Source of truth:
//   src/data/youmindImagePrompts.js
//
// Curated into 4 studios (${MAX_PER_STUDIO} each) with overflow routed to
// youmindViralOverflow.js. Curation rules are defined in the generator script.
`;

const studioBody = `${studioHeader}
export const YOUMIND_STUDIO_ASSETS = ${renderArray(studioAssets)};

export function getYoumindAssetsByStudio(studio) {
  return YOUMIND_STUDIO_ASSETS.filter((asset) => asset.studio === studio);
}

export function getYoumindAssetById(id) {
  return YOUMIND_STUDIO_ASSETS.find((asset) => asset.id === id);
}

export function getAllYoumindStudioAssets() {
  return YOUMIND_STUDIO_ASSETS;
}
`;

mkdirSync(SRC_DIR, { recursive: true });
writeFileSync(STUDIO_OUT, studioBody + '\n');

// ---------- write viral overflow ----------

const viralItems = overflow.map(buildVpfItem);

const viralHeader = `// AUTO-GENERATED FILE — do not edit by hand.
//
// Regenerate with:
//   node scripts/generate-youmind-studio-assets.mjs
//
// Source of truth:
//   src/data/youmindImagePrompts.js
//
// Items that did not fit the avatar / character / commercial / influencer
// curation rules live here as a VPF-style feed for SmartVideo Viral Studio.
// Each item follows the VPF format consumed by SmartVideoViral.js.
`;

const viralBody = `${viralHeader}
export const YOUMIND_VIRAL_OVERFLOW = ${renderArray(viralItems)};

export function getYoumindViralOverflow() {
  return YOUMIND_VIRAL_OVERFLOW;
}
`;

writeFileSync(VIRAL_OUT, viralBody + '\n');

// ---------- summary ----------

console.log(`Wrote ${STUDIO_OUT}   (${studioAssets.length} assets)`);
console.log(`Wrote ${VIRAL_OUT}   (${viralItems.length} overflow items)`);
console.log('Studio counts:', Object.fromEntries(STUDIOS.map(s => [s, curated[s].length])));
console.log('Viral overflow:', overflow.length);
console.log('Total items processed:', items.length);
