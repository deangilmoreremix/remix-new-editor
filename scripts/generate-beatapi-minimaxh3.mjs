#!/usr/bin/env node
/**
 * Generates the BeatAPI MiniMax H3 demo manifest from GitHub.
 *
 * Source repo: https://github.com/BeatAPI/awesome-minimax-h3-prompts
 *   - 300 individual prompt JSON files in prompts/
 *   - Empty catalog.json (0 bytes) — must enumerate via GitHub API
 *   - All 300 have working video URLs on media.beatapi.io CDN
 *
 * English-only filtering: skips 46 entries whose prompt is predominantly CJK.
 *
 * Writes:
 *   src/data/beatapiMinimaxH3Demos.js
 *   src/data/beatapiMinimaxH3Prompts.json
 *   src/data/beatapiMinimaxH3Prompts.js
 *
 *   node scripts/generate-beatapi-minimaxh3.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isMostlyEnglish,
  autoTitle,
  parseDuration,
  SHOWCASE_CATEGORIES,
  CATEGORY_ROUTES,
  DEFAULT_CREATE_ROUTE,
  slugify,
  writeJSON,
} from './shared/repo-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUT_DIR = join(REPO_ROOT, 'src', 'data');

// --- Repo configuration --------------------------------------------------

const REPO = 'BeatAPI/awesome-minimax-h3-prompts';
const PROMPTS_DIR = 'prompts';
const MODEL_NAME = 'MiniMax Hailuo 3 (H3)';
const MODEL_REF = 'minimax-h3';
const CDN_BASE = 'media.beatapi.io';
const MEDIA_DIR = '/media/minimax-h3';

/**
 * Slugs to exclude — entries whose source video contains visible "Higgsfield"
 * branding overlays, or whose prompt explicitly references running on the
 * Higgsfield platform. These are third-party branded outputs we must not
 * redistribute.
 */
const EXCLUDED_HIGGSFIELD_SLUGS = new Set([
  'player-stats-ui-170293',
]);

// MiniMax H3 raw category → 12-label showcase category
const CATEGORY_MAP = {
  'cinematic-story': 'Cinema',
  'product-commercial': 'Commercial',
  'music-video': 'Social',
  'anime': 'Animation',
  'action': 'Action',
  'cinematic-travel': 'Cinema',
  'fashion': 'Fashion',
  'horror': 'Cinema',
  'gameplay': 'Action',
  'motion-graphics': 'VFX',
  'comedy': 'Social',
  'vlog': 'Social',
  'animation': 'Animation',
  'brand-film': 'Commercial',
  'viral-short': 'Social',
  'title-sequence': 'VFX',
  'product-demo': 'Commercial',
};

// --- Data fetching -------------------------------------------------------

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'beats-demo-generator/1.0',
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'beats-demo-generator/1.0',
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

/**
 * Fetches all JSON prompt files from a GitHub repo's prompts/ directory.
 * Returns array of parsed JSON objects.
 */
async function fetchBeatApiPrompts() {
  const apiUrl = `https://api.github.com/repos/${REPO}/contents/${PROMPTS_DIR}`;
  const files = await fetchJSON(apiUrl);

  const jsonFiles = files.filter(
    (f) => f.name.endsWith('.json') && !f.name.includes('catalog')
  );
  console.log(`Found ${jsonFiles.length} JSON files in ${REPO}/${PROMPTS_DIR}/`);

  const entries = [];
  let skipped = 0;

  for (const f of jsonFiles) {
    try {
      const data = await fetchJSON(f.download_url);
      const prompt = data.prompt || '';

      // English-only filter: skip entries with Chinese prompts
      if (!isMostlyEnglish(prompt)) {
        skipped++;
        continue;
      }

      // Branded content filter: skip entries with visible Higgsfield overl branding
      if (EXCLUDED_HIGGSFIELD_SLUGS.has(data.slug) ||
          (data.source && data.source.name && data.source.name.toLowerCase().includes('higgsfield')) ||
          (data.source && data.source.url && data.source.url.toLowerCase().includes('higgsfield'))) {
        skipped++;
        continue;
      }

      // Extract bilingual title/description
      const titleRaw = data.title || '';
      const titleEn = typeof titleRaw === 'string' ? titleRaw : (titleRaw?.en || titleRaw?.zh || '');
      const descRaw = data.description || '';
      const descEn = typeof descRaw === 'string' ? descRaw : (descRaw?.en || descRaw?.zh || descRaw || '');

      const rawCategory = data.category || 'cinematic-story';
      const mappedCategory = CATEGORY_MAP[rawCategory] || 'Cinema';

      const useCase =
        descEn.slice(0, 200) ||
        `MiniMax H3 prompt in the ${mappedCategory.toLowerCase()} category`;

      // Parse duration
      const duration = parseDuration(data.duration);

      // Normalize video/thumbnail URLs
      const videoUrl = data.video || data.media?.video || '';
      const thumbnailUrl = data.thumbnail || data.media?.thumbnail || videoUrl.replace('.webm', '-poster.webp');

      // Normalize source
      const source = data.source || {};
      const sourceAuthor = source.name || '@anonymous';
      const sourceUrl = source.url || data.promptSourceUrls?.[0] || '';

      // Map mode to workflow
      const mode = data.mode || 'text-to-video';
      const workflow = mode === 'text-to-video' ? 't2v' : 'i2v';

      // Auto-title
      const title = autoTitle(data.slug || '', titleEn, prompt, rawCategory);
      const slug = slugify(data.slug || title) || data.slug;

      // Tags
      const tags = [
        rawCategory,
        mode,
        ...(data.ingredients || []).map((i) => i.toLowerCase().replace(/\s+/g, '-')),
      ].filter(Boolean);

      entries.push({
        slug,
        title,
        category: mappedCategory,
        useCase,
        duration,
        aspectRatio: data.aspectRatio || '16:9',
        videoUrl,
        thumbnailUrl,
        tags,
        upstreamCategory: rawCategory,
        sourceAuthor,
        sourceUrl,
        workflow,
        prompt,
      });
    } catch (err) {
      console.error(`  ⚠ ${f.name}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\nResults: ${entries.length} English entries, ${skipped} skipped (Chinese)`);
  return entries;
}

// --- Manifest generation ------------------------------------------------

function buildManifest(entries, options = {}) {
  const { writeMedia = false, mediaRoot = MEDIA_DIR, limit = null } = options;

  // Assign sequential IDs and local paths
  const demos = entries
    .slice(0, limit || entries.length)
    .map((entry, index) => {
      const localVideoPath = `${mediaRoot}/videos/${entry.slug}.webm`;
      const localPosterPath = `${mediaRoot}/previews/${entry.slug}.webp`;

      return {
        id: index + 1,
        slug: entry.slug,
        title: entry.title,
        category: entry.category,
        useCase: entry.useCase,
        duration: entry.duration,
        aspectRatio: entry.aspectRatio,
        videoSrc:
          writeMedia === false ? entry.videoUrl : localVideoPath,
        posterSrc:
          writeMedia === false ? entry.thumbnailUrl : localPosterPath,
        tags: entry.tags,
        upstreamCategory: entry.upstreamCategory,
        sourceAuthor: entry.sourceAuthor,
        sourceUrl: entry.sourceUrl,
        workflow: entry.workflow,
        // Keep original URLs for the download step
        _downloadUrl: entry.videoUrl,
        _downloadThumbUrl: entry.thumbnailUrl,
      };
    });

  return demos;
}

function buildGetCreateTarget(modelRef, templatePrefix) {
  return function (demo) {
    const route = CATEGORY_ROUTES[demo.category] || DEFAULT_CREATE_ROUTE;
    const params = {
      template: `${templatePrefix}${demo.slug}`,
      ref: modelRef,
    };
    const query = new URLSearchParams(params).toString();
    return {
      route,
      params,
      href: `/?${query}#/${route}`,
    };
  };
}

function writeDemosJS(demos, getCreateTarget, modelRef, templatePrefix) {
  const header = `// AUTO-GENERATED FILE — do not edit by hand.
//
// Regenerate with:
//   node scripts/generate-beatapi-minimaxh3.mjs
//
// Source: https://github.com/${REPO}
//
// English-only: entries with non-English (CJK) prompts are excluded.
// Video URLs point to the BeatAPI CDN (media.beatapi.io). Curated clips
// are downloaded locally; remaining entries hotlink from CDN.
//
// This module is the single source of truth for every BeatAPI MiniMax H3
// landing showcase section. Do not duplicate demo metadata inside components.
`;

  const ts = (v) => JSON.stringify(v);

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

  const categorySet = [...new Set(demos.map((d) => d.category))];
  const categoriesTs = categorySet.map((c) => ts(c));

  // Build CATEGORY_ROUTES from the MiniMax H3 existing pattern
  const routesEntries = Object.entries(CATEGORY_ROUTES)
    .map(([k, v]) => `  ${ts(k)}: ${ts(v)}`)
    .join(',\n');

  const TEMPLATE_PREFIX = 'minimax-h3-';

  const getTargetFn = [
    'export function getCreateTarget(demo) {',
    '  const route = CATEGORY_ROUTES[demo.category] || DEFAULT_CREATE_ROUTE;',
    '  const params = {',
    '    template: TEMPLATE_PREFIX + demo.slug,',
    '    ref: ' + ts(modelRef) + ',',
    '  };',
    '  const query = new URLSearchParams(params).toString();',
    '  return { route: route, params: params, href: "/?" + query + "#/" + route };',
    '}',
  ].join('\n');

  return header +
`/** Model used for every clip in this library. */
export const MINIMAX_MODEL = ${ts(MODEL_NAME)};

/** Unified 12-label category vocabulary. */
export const MINIMAX_CATEGORIES = ['All', ${categoriesTs.join(', ')}];

/** Category → router route for the "Create This Style" CTA. */
export const CATEGORY_ROUTES = {
${routesEntries}
};

export const DEFAULT_CREATE_ROUTE = ${ts(DEFAULT_CREATE_ROUTE)};
export const TEMPLATE_PREFIX = ${ts(TEMPLATE_PREFIX)};

/**
 * Resolves the "Create This Style" destination for a demo.
 * Returns router-native values (hash-routed SPA).
 */
${getTargetFn}

export function getCreateUrl(demo) {
  return getCreateTarget(demo).href;
}

export const minimaxH3Demos = [
${entries},
];

/* --------------------------------------------------------------- lookup utils */

const bySlug = new Map(minimaxH3Demos.map((demo) => [demo.slug, demo]));

export function getDemoBySlug(slug) {
  return bySlug.get(slug);
}

export function requireDemo(slug) {
  const demo = bySlug.get(slug);
  if (!demo) throw new Error('[minimaxH3Demos] unknown demo slug: ' + slug);
  return demo;
}

export function getDemosBySlugs(slugs) {
  return slugs.map((slug) => requireDemo(slug));
}

export function getFeaturedDemos() {
  return minimaxH3Demos.filter((demo) => demo.featured);
}

export function getDemosByCategory(category) {
  if (!category || category === 'All') return minimaxH3Demos;
  return minimaxH3Demos.filter((demo) => demo.category === category);
}

export function getCategoryCounts() {
  return minimaxH3Demos.reduce((acc, demo) => {
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
  const { beatapiMinimaxH3Prompts } = await import('./beatapiMinimaxH3Prompts');
  return beatapiMinimaxH3Prompts[slug];
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
    const { writeFileSync: wf } = await import('node:fs');
    const { ensureDir } = await import('./shared/repo-utils.mjs');
    ensureDir(dirname(destPath));
    wf(destPath, Buffer.from(buffer));
    return true;
  } catch (err) {
    console.error(`  ⚠ Failed to download ${url}: ${err.message}`);
    return false;
  }
}

// --- Main ----------------------------------------------------------------

async function main() {
  console.log(`Fetching from ${REPO}...`);

  const entries = await fetchBeatApiPrompts();

  // Separate video URL entries (have media.video) from poster-only
  const videoEntries = entries.filter((e) => e.videoUrl);
  const posterOnlyEntries = entries.filter((e) => !e.videoUrl);
  console.log(`\nVideo entries: ${videoEntries.length}, poster-only: ${posterOnlyEntries.length}`);

  // For MVP, download 30 curated + hotlink the rest
  const CURATED_COUNT = 30;
  const curated = videoEntries.slice(0, CURATED_COUNT);

  console.log(`\nDownloading ${curated.length} curated video clips + posters...`);
  let downloaded = 0;
  for (const entry of curated) {
    const slug = entry.slug;
    const videoPath = join(REPO_ROOT, 'public/media/minimax-h3/videos', `${slug}.webm`);
    const posterPath = join(REPO_ROOT, 'public/media/minimax-h3/previews', `${slug}.webp`);

    const ok = await downloadFile(entry.videoUrl, videoPath);
    if (ok) downloaded++;
    // Download poster/thumbnail
    await downloadFile(entry.thumbnailUrl || entry.videoUrl.replace('.webm', '-poster.webp'), posterPath);
  }
  console.log(`Downloaded ${downloaded}/${curated.length} videos`);

  // Build manifests
  // 1. Full set (254 entries) with CDN hotlinks for non-curated
  const allDemos = buildManifest(entries);
  console.log(`\nWriting beatapiMinimaxH3Demos.js (${allDemos.length} entries)...`);

  // Override: local paths for curated, CDN for rest
  const finalDemos = allDemos.map((d) => {
    const isCurated = curated.some((c) => c.slug === d.slug);
    if (isCurated) {
      return {
        ...d,
        videoSrc: `/media/minimax-h3/videos/${d.slug}.webm`,
        posterSrc: `/media/minimax-h3/previews/${d.slug}.webp`,
      };
    }
    return d;
  });

  // Sort by category for organized display
  finalDemos.sort((a, b) => {
    const catOrder = ['Action', 'Animation', 'Beauty', 'Characters', 'Cinema', 'Commercial', 'Fashion', 'Food', 'Social', 'UGC', 'VFX', 'Web / UI'];
    const ai = catOrder.indexOf(a.category);
    const bi = catOrder.indexOf(b.category);
    return ai !== bi ? ai - bi : a.title.localeCompare(b.title);
  });

  const jsContent = writeDemosJS(finalDemos, null, 'minimax-h3', 'minimax-h3-');

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'beatapiMinimaxH3Demos.js'), jsContent, 'utf8');

  // Write prompts JSON (lazy-loaded)
  const promptsJson = Object.fromEntries(
    entries.map((e) => [e.slug, e.prompt])
  );
  writeFileSync(
    join(OUT_DIR, 'beatapiMinimaxH3Prompts.json'),
    JSON.stringify(promptsJson, null, 2) + '\n',
    'utf8'
  );
  writeFileSync(
    join(OUT_DIR, 'beatapiMinimaxH3Prompts.js'),
    `import prompts from './beatapiMinimaxH3Prompts.json';\n\nexport const beatapiMinimaxH3Prompts = prompts;\n`,
    'utf8'
  );

  console.log(`\n✅ Wrote ${finalDemos.length} entries to src/data/beatapiMinimaxH3Demos.js`);
  console.log(`✅ Wrote ${entries.length} prompts to src/data/beatapiMinimaxH3Prompts.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
