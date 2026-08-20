#!/usr/bin/env node
/**
 * Generates the BeatAPI Seedance 2.5 demo manifest from GitHub.
 *
 * Source repo: https://github.com/BeatAPI/awesome-seedance-2-5-prompts
 *   - catalog.json with 300 entries in a "prompts" array
 *   - All 300 have working video URLs in media.video on media.beatapi.io CDN
 *
 * English-only filtering: skips 50 entries whose prompt is predominantly CJK.
 *
 * Writes:
 *   src/data/beatapiSeedance25Demos.js
 *   src/data/beatapiSeedance25Prompts.json
 *   src/data/beatapiSeedance25Prompts.js
 *
 *   node scripts/generate-beatapi-seedance25.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isMostlyEnglish,
  autoTitle,
  parseDuration,
  CATEGORY_ROUTES,
  DEFAULT_CREATE_ROUTE,
  slugify,
  writeJSON,
} from './shared/repo-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUT_DIR = join(REPO_ROOT, 'src', 'data');

// --- Repo configuration --------------------------------------------------

const REPO = 'BeatAPI/awesome-seedance-2-5-prompts';
const CATALOG_URL = `https://raw.githubusercontent.com/${REPO}/main/prompts/catalog.json`;
const MODEL_NAME = 'Seedance 2.5 (ByteDance)';
const MODEL_REF = 'seedance-2.5';
const MEDIA_DIR = '/media/seedance-2.5';

/**
 * Slugs to exclude — entries whose source video contains visible "Higgsfield"
 * branding overlays, or whose prompt explicitly references running on the
 * Higgsfield platform. These are third-party branded outputs we must not
 * redistribute.
 */
const EXCLUDED_HIGGSFIELD_SLUGS = new Set([
  'higgsfield-ha-publicado-the-cully-hill-boys-al-completo-705224',
  'y-han-abierto-el-proyecto-al-pblico-086191',
  'here-s-one-of-the-first-tests-211150',
  'eyecannndycom-for-transitions-019153',
  'creators-are-going-to-love-this-605556',
  'cinematic-story-study-728019',
  'seedance-2-5-on-higgsfield-ai-012374',
  'retro-y2k-pop-duo-music-video',
]);

// Seedance 2.5 raw category → 12-label showcase category
const CATEGORY_MAP = {
  'cinematic-story': 'Cinema',
  'cinematic-action': 'Action',
  'brand-film': 'Commercial',
  'music-video': 'Social',
  'vlog': 'Social',
  'animation': 'Animation',
  'fantasy': 'Cinema',
  'documentary': 'Cinema',
  'comedy': 'Social',
  'horror': 'Cinema',
  'dance': 'Fashion',
  'performance': 'Social',
  'dialogue': 'Social',
};

// --- Data fetching -------------------------------------------------------

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'beats-demo-generator/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

/**
 * Fetches the catalog.json from the BeatAPI Seedance 2.5 repo.
 * Returns array of prompt entries (already parsed).
 */
async function fetchSeedance25Catalog() {
  console.log(`Fetching ${CATALOG_URL}...`);
  const data = await fetchJSON(CATALOG_URL);
  const prompts = data.prompts || [];
  console.log(`Found ${prompts.length} entries in catalog.json`);

  const entries = [];
  let skipped = 0;

  for (const p of prompts) {
    const prompt = p.prompt || '';

    // English-only filter: skip entries with Chinese prompts
    if (!isMostlyEnglish(prompt)) {
      skipped++;
      continue;
    }

    // Branded content filter: skip entries with visible Higgsfield branding
    const rawSlug = p.slug || '';
    if (EXCLUDED_HIGGSFIELD_SLUGS.has(rawSlug) ||
        (p.source && p.source.name && p.source.name.toLowerCase().includes('higgsfield')) ||
        (p.source && p.source.url && p.source.url.toLowerCase().includes('higgsfield')) ||
        (prompt.toLowerCase().includes('higgsfield') &&
         prompt.toLowerCase().includes('ran in @higgsfield'))) {
      skipped++;
      continue;
    }

    // Extract bilingual title/description
    const titleRaw = p.title || '';
    const titleEn = typeof titleRaw === 'string' ? titleRaw : (titleRaw?.en || '');
    const descRaw = p.description || '';
    const descEn = typeof descRaw === 'string' ? descRaw : (descRaw?.en || '');

    const rawCategory = p.category || 'cinematic-story';
    const mappedCategory = CATEGORY_MAP[rawCategory] || 'Cinema';

    const useCase =
      descEn.slice(0, 200) ||
      `Seedance 2.5 prompt in the ${mappedCategory.toLowerCase()} category`;

    // Parse duration
    const duration = parseDuration(p.duration);

    // Extract media URLs from nested media object
    const media = p.media || {};
    const videoUrl = media.video || '';
    const thumbnailUrl = media.thumbnail || videoUrl.replace('.webm', '-poster.webp');

    // Normalize source
    const source = p.source || {};
    const sourceAuthor = source.name || '@anonymous';
    const sourceUrl = source.url || p.promptSourceUrls?.[0] || '';

    // Map mode to workflow
    // BeatAPI mode field: text-to-video, reference-to-video, image-to-video, multimodal, video-to-video
    const mode = p.mode || 'text-to-video';
    const workflow = mode === 'text-to-video' ? 't2v' : 'i2v';

    // Auto-title
    const title = autoTitle(p.slug || '', titleEn, prompt, rawCategory);
    const slug = slugify(p.slug || title) || p.slug;

    // Tags
    const tags = [
      rawCategory,
      mode,
      ...(p.ingredients || []).map((i) => i.toLowerCase().replace(/\s+/g, '-')),
    ].filter(Boolean);

    entries.push({
      slug,
      title,
      category: mappedCategory,
      useCase,
      duration,
      aspectRatio: p.aspectRatio || '16:9',
      videoUrl,
      thumbnailUrl,
      tags,
      upstreamCategory: rawCategory,
      sourceAuthor,
      sourceUrl,
      workflow,
      prompt,
      workflowMode: p.workflowMode || '',
    });
  }

  console.log(`\nResults: ${entries.length} English entries, ${skipped} skipped (Chinese)`);
  return entries;
}

// --- Manifest generation ------------------------------------------------

function buildDemos(entries) {
  return entries.map((entry, index) => ({
    id: index + 1,
    slug: entry.slug,
    title: entry.title,
    category: entry.category,
    useCase: entry.useCase,
    duration: entry.duration,
    aspectRatio: entry.aspectRatio,
    videoSrc: entry.videoUrl,  // CDN hotlink by default
    posterSrc: entry.thumbnailUrl,
    tags: entry.tags,
    upstreamCategory: entry.upstreamCategory,
    sourceAuthor: entry.sourceAuthor,
    sourceUrl: entry.sourceUrl,
    workflow: entry.workflow,
  }));
}

function ts(v) {
  return JSON.stringify(v);
}

const SHOWCASE_CATEGORIES = [
  'All',
  'Action',
  'Animation',
  'Beauty',
  'Characters',
  'Cinema',
  'Commercial',
  'Fashion',
  'Food',
  'Social',
  'UGC',
  'VFX',
  'Web / UI',
];

function writeDemosJS(demos) {
  const header = `// AUTO-GENERATED FILE — do not edit by hand.
//
// Regenerate with:
//   node scripts/generate-beatapi-seedance25.mjs
//
// Source: https://github.com/${REPO}
//
// English-only: entries with non-English (CJK) prompts are excluded.
// Video URLs point to the BeatAPI CDN (media.beatapi.io). Curated clips
// are downloaded locally; remaining entries hotlink from CDN.
//
// This module is the single source of truth for every BeatAPI Seedance 2.5
// landing showcase section. Do not duplicate demo metadata inside components.
`;

  const entries = demos
    .map((d) => {
      const lines = [
        `    id: ${d.id}`,
        `    slug: ${ts(d.slug)}`,
        `    title: ${ts(d.title)}`,
        `    category: ${ts(d.category)}`,
        `    useCase: ${ts(d.useCase)}`,
        d.duration !== undefined ? `    duration: ${d.duration}` : null,
        d.aspectRatio ? `    aspectRatio: ${ts(d.aspectRatio)}` : null,
        `    videoSrc: ${ts(d.videoSrc)}`,
        `    posterSrc: ${ts(d.posterSrc)}`,
        d.tags?.length ? `    tags: [${d.tags.map(ts).join(', ')}]` : null,
        d.upstreamCategory ? `    upstreamCategory: ${ts(d.upstreamCategory)}` : null,
        d.workflow ? `    workflow: ${ts(d.workflow)}` : null,
        d.sourceAuthor ? `    sourceAuthor: ${ts(d.sourceAuthor)}` : null,
        d.sourceUrl ? `    sourceUrl: ${ts(d.sourceUrl)}` : null,
      ].filter(Boolean);
      return `  {\n${lines.join(',\n')},\n  }`;
    })
    .join(',\n');

  const categorySet = [...new Set(demos.map((d) => d.category))].sort();
  const categoriesTs = categorySet.map(ts);

  const routesEntries = Object.entries(CATEGORY_ROUTES)
    .map(([k, v]) => `  ${ts(k)}: ${ts(v)}`)
    .join(',\n');

  const TEMPLATE_PREFIX = 'seedance-2.5-';

  const getTargetFn = [
    'export function getCreateTarget(demo) {',
    '  const route = CATEGORY_ROUTES[demo.category] || DEFAULT_CREATE_ROUTE;',
    '  const params = {',
    '    template: TEMPLATE_PREFIX + demo.slug,',
    '    ref: ' + ts(MODEL_REF) + ',',
    '  };',
    '  const query = new URLSearchParams(params).toString();',
    '  return { route: route, params: params, href: "/?" + query + "#/" + route };',
    '}',
  ].join('\n');

  return header +
`/** Model used for every clip in this library. */
export const SEEDANCE_MODEL = ${ts(MODEL_NAME)};

/** Unified 12-label category vocabulary. */
export const SEEDANCE_CATEGORIES = ['All', ${categoriesTs.join(', ')}];

/** Category → router route for the "Create This Style" CTA. */
export const CATEGORY_ROUTES = {
${routesEntries}
};

export const DEFAULT_CREATE_ROUTE = ${ts(DEFAULT_CREATE_ROUTE)};
export const TEMPLATE_PREFIX = ${ts(TEMPLATE_PREFIX)};

${getTargetFn}

export function getCreateUrl(demo) {
  return getCreateTarget(demo).href;
}

export const seedance25Demos = [
${entries},
];

/* --------------------------------------------------------------- lookup utils */

const bySlug = new Map(seedance25Demos.map((demo) => [demo.slug, demo]));

export function getDemoBySlug(slug) {
  return bySlug.get(slug);
}

export function requireDemo(slug) {
  const demo = bySlug.get(slug);
  if (!demo) throw new Error('[seedance25Demos] unknown demo slug: ' + slug);
  return demo;
}

export function getDemosBySlugs(slugs) {
  return slugs.map((slug) => requireDemo(slug));
}

export function getFeaturedDemos() {
  return seedance25Demos.slice(0, 6);
}

export function getDemosByCategory(category) {
  if (!category || category === 'All') return seedance25Demos;
  return seedance25Demos.filter((demo) => demo.category === category);
}

export function getCategoryCounts() {
  return seedance25Demos.reduce((acc, demo) => {
    acc[demo.category] = (acc[demo.category] || 0) + 1;
    return acc;
  }, {});
}

export function ratioToNumber(aspectRatio, fallback = 16 / 9) {
  if (!aspectRatio) return fallback;
  const [w, h] = aspectRatio.split(':').map(Number);
  if (!w || !h) return fallback;
  return w / h;
}

export function isVertical(demo) {
  return ratioToNumber(demo.aspectRatio) < 1;
}

export function formatDuration(demo) {
  return demo.duration ? demo.duration + 's' : '—';
}

export async function loadDemoPrompt(slug) {
  const { beatapiSeedance25Prompts } = await import('./beatapiSeedance25Prompts');
  return beatapiSeedance25Prompts[slug];
}
`;
}

// --- Media download ------------------------------------------------------

async function downloadFile(url, destPath) {
  if (!url || !url.startsWith('http')) return false;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const buffer = await res.arrayBuffer();
    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, Buffer.from(buffer));
    return true;
  } catch (err) {
    console.error(`  ⚠ Failed to download ${url}: ${err.message}`);
    return false;
  }
}

// --- Main ----------------------------------------------------------------

async function main() {
  const entries = await fetchSeedance25Catalog();

  const videoEntries = entries.filter((e) => e.videoUrl);
  console.log(`\nVideo entries: ${videoEntries.length}`);

  // Download 30 curated clips + posters
  const CURATED_COUNT = 30;
  const curated = videoEntries.slice(0, CURATED_COUNT);

  console.log(`\nDownloading ${curated.length} curated video clips + posters...`);
  let downloaded = 0;
  for (const entry of curated) {
    const slug = entry.slug;
    const videoPath = join(REPO_ROOT, 'public/media/seedance-2.5/videos', `${slug}.webm`);
    const posterPath = join(REPO_ROOT, 'public/media/seedance-2.5/previews', `${slug}.webp`);

    const ok = await downloadFile(entry.videoUrl, videoPath);
    if (ok) downloaded++;
    await downloadFile(entry.thumbnailUrl || entry.videoUrl.replace('.webm', '-poster.webp'), posterPath);
  }
  console.log(`Downloaded ${downloaded}/${curated.length} videos`);

  // Build final demos: local paths for curated, CDN hotlink for rest
  const demos = entries.map((entry, index) => {
    const isCurated = curated.some((c) => c.slug === entry.slug);
    return {
      id: index + 1,
      slug: entry.slug,
      title: entry.title,
      category: entry.category,
      useCase: entry.useCase,
      duration: entry.duration,
      aspectRatio: entry.aspectRatio,
      videoSrc: isCurated
        ? `/media/seedance-2.5/videos/${entry.slug}.webm`
        : entry.videoUrl,
      posterSrc: isCurated
        ? `/media/seedance-2.5/previews/${entry.slug}.webp`
        : entry.thumbnailUrl,
      tags: entry.tags,
      upstreamCategory: entry.upstreamCategory,
      sourceAuthor: entry.sourceAuthor,
      sourceUrl: entry.sourceUrl,
      workflow: entry.workflow,
    };
  });

  // Write data files
  mkdirSync(OUT_DIR, { recursive: true });

  const jsContent = writeDemosJS(demos);
  writeFileSync(join(OUT_DIR, 'beatapiSeedance25Demos.js'), jsContent, 'utf8');

  const promptsJson = Object.fromEntries(
    entries.map((e) => [e.slug, e.prompt])
  );
  writeFileSync(
    join(OUT_DIR, 'beatapiSeedance25Prompts.json'),
    JSON.stringify(promptsJson, null, 2) + '\n',
    'utf8'
  );
  writeFileSync(
    join(OUT_DIR, 'beatapiSeedance25Prompts.js'),
    `import prompts from './beatapiSeedance25Prompts.json';\n\nexport const beatapiSeedance25Prompts = prompts;\n`,
    'utf8'
  );

  console.log(`\n✅ Wrote ${demos.length} entries to src/data/beatapiSeedance25Demos.js`);
  console.log(`✅ Wrote ${entries.length} prompts to src/data/beatapiSeedance25Prompts.json`);

  // Summary
  const counts = demos.reduce((acc, d) => {
    acc[d.category] = (acc[d.category] || 0) + 1;
    return acc;
  }, {});
  console.log('Categories:', counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
