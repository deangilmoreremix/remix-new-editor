#!/usr/bin/env node
/**
 * Generates the ZeroLu awesome-seedance demo manifest from GitHub.
 *
 * Source repo: https://github.com/ZeroLu/awesome-seedance
 *   - README.md with 9 English use-case categories, prompts in markdown code blocks
 *   - prompts/commercial-use-cases.md — Chinese-only, skipped
 *   - videos/ directory with 17 MP4 files (excl. test.mp4)
 *
 * All 17 MP4s are committed to the repo — downloaded locally for the showcase.
 *
 * Writes:
 *   src/data/zeroLuDemos.js
 *   src/data/zeroLuPrompts.json
 *   src/data/zeroLuPrompts.js
 *
 *   node scripts/generate-zeroLu-seedance.mjs
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
} from './shared/repo-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUT_DIR = join(REPO_ROOT, 'src', 'data');

// --- Repo configuration --------------------------------------------------

const REPO = 'ZeroLu/awesome-seedance';
const MODEL_NAME = 'Seedance 2.0 (Bytedance)';
const MODEL_REF = 'seedance-2.0';
const MEDIA_DIR = '/media/awesome-seedance';

// ZeroLu README use-case categories → 12-label showcase category
const README_CATEGORY_MAP = {
  'Cinematic Film Styles': 'Cinema',
  'Advertising & Commercial Branding': 'Commercial',
  'Social Media & Viral Memes': 'Social',
  'UGC Style': 'UGC',
  'Anime & Animation Styles': 'Animation',
  'Short-form Drama & Web Series': 'Cinema',
  'Visual Effects & Experimental Styles': 'VFX',
};

// --- Data fetching -------------------------------------------------------

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'beats-demo-generator/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

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

/**
 * Fetches the README.md and extracts use-case sections with embedded prompts.
 *
 * README structure:
 *   ### 1.1. Title
 *   **Prompt:**
 *   ```
 *   prompt text here
 *   ```
 *   *Source: Creator ([@handle](url))*
 *
 * Returns array of {title, prompt, sourceAuthor, sourceUrl, category}
 */
function parseReadmeSections(readme) {
  const sections = [];
  const lines = readme.split('\n');

  let currentCategory = '';
  let currentTitle = '';
  let currentPrompt = '';
  let currentAuthor = '';
  let currentUrl = '';
  let currentRawSource = '';
  let inCodeBlock = false;
  let inPromptBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Category headings: "## 1. Cinematic Film Styles"
    const catMatch = line.match(/^##\s+\d+\.\s+(.+)$/);
    if (catMatch) {
      // Save previous section
      if (currentTitle && currentPrompt) {
        sections.push({
          title: currentTitle,
          prompt: currentPrompt.trim(),
          sourceAuthor: currentAuthor,
          sourceUrl: currentUrl,
          sourceRaw: currentRawSource,
          category: README_CATEGORY_MAP[currentCategory] || 'Cinema',
        });
      }
      currentCategory = catMatch[1].trim();
      currentTitle = '';
      currentPrompt = '';
      currentAuthor = '';
      currentUrl = '';
      currentRawSource = '';
      inCodeBlock = false;
      inPromptBlock = false;
      continue;
    }

    // Section headings: "### 1.1. Hollywood Professional Racing Movie Style"
    const secMatch = line.match(/^###\s+.+?\.\s+(.+)$/);
    if (secMatch) {
      // Save previous section
      if (currentTitle && currentPrompt) {
        sections.push({
          title: currentTitle,
          prompt: currentPrompt.trim(),
          sourceAuthor: currentAuthor,
          sourceUrl: currentUrl,
          sourceRaw: currentRawSource,
          category: README_CATEGORY_MAP[currentCategory] || 'Cinema',
        });
      }
      currentTitle = secMatch[1].trim();
      currentPrompt = '';
      currentAuthor = '';
      currentUrl = '';
      currentRawSource = '';
      inCodeBlock = false;
      inPromptBlock = false;
      continue;
    }

    // Code blocks
    if (line.trim() === '```') {
      if (inCodeBlock) {
        inCodeBlock = false;
        inPromptBlock = false;
      } else {
        // Check if previous line indicates this is a prompt block
        const prevLine = lines[i - 1]?.trim();
        if (prevLine && (prevLine.includes('Prompt') || prevLine.includes('提示词') || prevLine.includes('prompt'))) {
          inPromptBlock = true;
        }
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock && inPromptBlock && line.trim()) {
      currentPrompt += line + '\n';
    }

    // Source attribution: lines like
    //   *Source: John ([@johnAGI168](https://x.com/...)) - [Post](...)*
    //   Source: Creator ([@handle](https://...))
    //   Source: Creator (@handle)(https://...)
    // Extract the handle and URL

    // Pattern: *Source: Name ([@handle](url)) ...*
    if (!currentAuthor) {
      const handleM = line.match(/\(\[?@?([\w@.-]+)\]?\]\([^)]+\)/);
      const urlM = line.match(/\(?(https?:\/\/[^)]+)\)?/);
      const nameM = line.match(/\*Source:\s*([^(]+?)\s*\(/);
      if (handleM) {
        currentAuthor = '@' + handleM[1];
        currentUrl = urlM ? urlM[0].replace(/[()]/g, '') : '';
        currentRawSource = line;
      } else if (nameM) {
        currentAuthor = nameM[1].trim();
        currentRawSource = line;
      }
    }

    // Pattern: Source: Name (@handle)(url)
    if (!currentAuthor) {
      const m = line.match(/Source:\s*([^@(]+?)\s*\(@?([\w@.-]+)\)?\)?\s*(https?:\/\/[^\s)]+)/);
      if (m) {
        currentAuthor = '@' + m[2];
        currentUrl = m[3] || '';
        currentRawSource = line;
      }
    }
  }

  // Save last section
  if (currentTitle && currentPrompt) {
    sections.push({
      title: currentTitle,
      prompt: currentPrompt.trim(),
      sourceAuthor: currentAuthor,
      sourceUrl: currentUrl,
      sourceRaw: currentRawSource,
      category: README_CATEGORY_MAP[currentCategory] || 'Cinema',
    });
  }

  // Filter to English-only
  const englishSections = sections.filter((s) => isMostlyEnglish(s.prompt));
  console.log(`Parsed ${sections.length} README sections, ${englishSections.length} English`);

  return englishSections;
}

/**
 * Fetches list of MP4 video files from the ZeroLu videos/ directory via GitHub API.
 */
async function fetchMp4List() {
  const apiUrl = `https://api.github.com/repos/${REPO}/contents/videos`;
  const files = await fetchJSON(apiUrl);
  return files
    .filter((f) => f.name.endsWith('.mp4') && !f.name.includes('test'))
    .map((f) => ({
      name: f.name,
      slug: f.name.replace('_video.mp4', '').replace('.mp4', ''),
      downloadUrl: f.download_url,
      size: f.size,
    }));
}

// --- Manifest generation ------------------------------------------------

function findMatchedSection(name, readmeSections) {
  if (!name) return null;

  const slugLower = name.toLowerCase();
  const johnMatch = name.match(/^john(\d+)$/);

  let johnIdx = 0;
  for (const s of readmeSections) {
    const titleLower = s.title.toLowerCase();
    const authorLower = (s.sourceAuthor || '').toLowerCase().replace('@', '');

    if (titleLower.includes(slugLower)) return s;
    if (authorLower && slugLower.includes(authorLower)) return s;
    if (authorLower && authorLower.includes(slugLower)) return s;
    if (s.sourceRaw && s.sourceRaw.toLowerCase().includes(slugLower)) return s;
    if (johnMatch && authorLower === 'johnagi168') {
      if (johnIdx === parseInt(johnMatch[1]) - 1) return s;
      johnIdx++;
    }
  }
  return null;
}

function deriveTitle(name, readmeSections) {
  const matched = findMatchedSection(name, readmeSections);
  if (matched) return matched.title;

  const titleFromAuto = autoTitle(name, '', '', 'Cinema');
  if (titleFromAuto && titleFromAuto !== 'Video Concept') {
    return titleFromAuto;
  }

  const cleanName = name
    .replace(/_/g, ' ')
    .replace(/video/gi, '')
    .trim();
  return `${cleanName.charAt(0).toUpperCase()}${cleanName.slice(1)} Reference Clip`;
}

function ts(v) {
  return JSON.stringify(v);
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
  console.log(`Fetching from ${REPO}...`);

  // 1. Fetch README and parse English use-case sections
  const readmeUrl = `https://raw.githubusercontent.com/${REPO}/main/README.md`;
  const readme = await fetchText(readmeUrl);
  const readmeSections = parseReadmeSections(readme);

  // 2. Fetch MP4 files from videos/ directory
  const mp4s = await fetchMp4List();
  console.log(`\nFound ${mp4s.length} MP4 files (excl. test.mp4)`);

  // 3. Download all 17 MP4s + generate poster placeholders
  console.log(`\nDownloading ${mp4s.length} MP4 files...`);
  const videoEntries = [];

  for (const mp4 of mp4s) {
    const slug = slugify(mp4.slug) || `zeroLu-${mp4.name.replace('.mp4', '')}`;
    const videoPath = join(REPO_ROOT, `public/media/awesome-seedance/videos/${slug}.mp4`);

    console.log(`  Downloading ${mp4.name} (${(mp4.size / 1024).toFixed(0)} KB)...`);
    const ok = await downloadFile(mp4.downloadUrl, videoPath);
    if (!ok) {
      console.error(`  ⚠ Failed to download ${mp4.name}`);
      continue;
    }

    // Poster will be generated client-side from the video (no CDN thumbnail for ZeroLu)
    const posterPath = join(REPO_ROOT, `public/media/awesome-seedance/previews/${slug}.webp`);
    // Create a placeholder — actual poster generation happens in mediaFrame.js
    // For now, use a 1x1 transparent PNG as placeholder
    const { writeFileSync: wf } = await import('node:fs');
    mkdirSync(dirname(posterPath), { recursive: true });
    // Write a minimal placeholder — the client-side mediaFrame.js will
    // generate the actual poster frame from the video on first interaction
    wf(posterPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    // Match to README section if possible
    const title = deriveTitle(mp4.slug, readmeSections);
    const matchedSection = findMatchedSection(mp4.slug, readmeSections);

    const category = matchedSection ? matchedSection.category : 'Cinema';
    const prompt = matchedSection ? matchedSection.prompt : '';
    const sourceAuthor = matchedSection ? matchedSection.sourceAuthor : '@ZeroLu';
    const sourceUrl = matchedSection ? matchedSection.sourceUrl : 'https://github.com/ZeroLu/awesome-seedance';
    const useCase = matchedSection
      ? matchedSection.title
      : `Seedance 2.0 reference video: ${mp4.slug}`;

    videoEntries.push({
      slug,
      title,
      category,
      useCase,
      duration: 15, // Default for ZeroLu reference clips
      aspectRatio: '16:9',
      videoSrc: `/media/awesome-seedance/videos/${slug}.mp4`,
      posterSrc: `/media/awesome-seedance/previews/${slug}.webp`,
      tags: ['reference', 'seedance-2.0', mp4.slug.replace('_video', '')],
      upstreamCategory: category,
      sourceAuthor,
      sourceUrl,
      workflow: 't2v',
      prompt,
      _originalName: mp4.name,
    });
  }

  console.log(`\nProcessed ${videoEntries.length} video entries`);

  // 4. Also include README English sections that have no matching MP4
  // These appear as poster-only (prompt-only) cards
  const matchedSlugs = new Set(videoEntries.map((v) => v._originalName));
  for (const section of readmeSections) {
    const sectionId = [section.title, section.sourceRaw, section.sourceAuthor].filter(Boolean).join('|').toLowerCase();
    const hasMatch = videoEntries.some((v) => {
      const vId = [v.title, v.useCase, v.slug, v.sourceAuthor].filter(Boolean).join('|').toLowerCase();
      return v.title === section.title || v.useCase === section.title || sectionId === vId;
    });
    if (hasMatch) continue;

    const slug = slugify(section.title);
    videoEntries.push({
      slug,
      title: section.title,
      category: section.category,
      useCase: section.title,
      duration: 15,
      aspectRatio: '16:9',
      videoSrc: null,  // no video — poster-only
      posterSrc: null,
      tags: ['prompt', 'seedance-2.0'],
      upstreamCategory: section.category,
      sourceAuthor: section.sourceAuthor || '@unknown',
      sourceUrl: section.sourceUrl || 'https://github.com/ZeroLu/awesome-seedance',
      workflow: 't2v',
      prompt: section.prompt,
    });
  }

  // Write data files
  mkdirSync(OUT_DIR, { recursive: true });

  // Build demos JS
  const demos = videoEntries.map((entry, index) => ({
    id: index + 1,
    slug: entry.slug,
    title: entry.title,
    category: entry.category,
    useCase: entry.useCase,
    duration: entry.duration,
    aspectRatio: entry.aspectRatio,
    videoSrc: entry.videoSrc,
    posterSrc: entry.posterSrc,
    tags: entry.tags,
    upstreamCategory: entry.upstreamCategory,
    sourceAuthor: entry.sourceAuthor,
    sourceUrl: entry.sourceUrl,
    workflow: entry.workflow,
  }));

  const entries = demos.map((d) => {
    const lines = [
      `    id: ${d.id}`,
      `    slug: ${ts(d.slug)}`,
      `    title: ${ts(d.title)}`,
      `    category: ${ts(d.category)}`,
      `    useCase: ${ts(d.useCase)}`,
      `    duration: ${ts(d.duration)}`,
      `    aspectRatio: ${ts(d.aspectRatio)}`,
      d.videoSrc ? `    videoSrc: ${ts(d.videoSrc)}` : null,
      d.posterSrc ? `    posterSrc: ${ts(d.posterSrc)}` : null,
      `    tags: [${(d.tags || []).map(ts).join(', ')}]`,
      `    upstreamCategory: ${ts(d.upstreamCategory)}`,
      `    workflow: ${ts(d.workflow)}`,
      `    sourceAuthor: ${ts(d.sourceAuthor)}`,
      `    sourceUrl: ${ts(d.sourceUrl)}`,
    ].filter(Boolean);
    return `  {\n${lines.join(',\n')},\n  }`;
  });

  const categorySet = [...new Set(demos.map((d) => d.category))].sort();
  const categoriesTs = categorySet.map(ts);

  const routesEntries = Object.entries(CATEGORY_ROUTES)
    .map(([k, v]) => `  ${ts(k)}: ${ts(v)}`)
    .join(',\n');

  const TEMPLATE_PREFIX = 'seedance-2.0-';

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

  const jsContent = [
    `// AUTO-GENERATED FILE — do not edit by hand.`,
    `//`,
    `// Regenerate with:`,
    `//   node scripts/generate-zeroLu-seedance.mjs`,
    `//`,
    `// Source: https://github.com/${REPO}/`,
    `//`,
    `// English-only: all prompts parsed from README.md (English sections only).`,
    `// The Chinese prompts/commercial-use-cases.md file is skipped.`,
    `// All ${mp4s.length} MP4 videos are downloaded locally.`,
    `//`,
    `// This module is the single source of truth for every ZeroLu Seedance 2.0`,
    `// landing showcase section.`,
    ``,
    `/** Model used for every clip in this library. */`,
    `export const ZERO_LU_MODEL = ${ts(MODEL_NAME)};`,
    ``,
    `/** Unified 12-label category vocabulary. */`,
    `export const ZERO_LU_CATEGORIES = [${categoriesTs.join(', ')}];`,
    ``,
    `/** Category -> router route for the "Create This Style" CTA. */`,
    `export const CATEGORY_ROUTES = {`,
    `${routesEntries}`,
    `};`,
    ``,
    `export const DEFAULT_CREATE_ROUTE = ${ts(DEFAULT_CREATE_ROUTE)};`,
    `export const TEMPLATE_PREFIX = ${ts(TEMPLATE_PREFIX)};`,
    ``,
    getTargetFn,
    ``,
    `export function getCreateUrl(demo) {`,
    `  return getCreateTarget(demo).href;`,
    `}`,
    ``,
    `export const zeroLuDemos = [`,
    entries.join(',\n'),
    `];`,
    ``,
    `/* --------------------------------------------------------------- lookup utils */`,
    ``,
    `const bySlug = new Map(zeroLuDemos.map((demo) => [demo.slug, demo]));`,
    ``,
    `export function getDemoBySlug(slug) {`,
    `  return bySlug.get(slug);`,
    `}`,
    ``,
    `export function requireDemo(slug) {`,
    `  const demo = bySlug.get(slug);`,
    `  if (!demo) throw new Error('[zeroLuDemos] unknown demo slug: ' + slug);`,
    `  return demo;`,
    `}`,
    ``,
    `export function getDemosByCategory(category) {`,
    `  if (!category || category === 'All') return zeroLuDemos;`,
    `  return zeroLuDemos.filter((demo) => demo.category === category);`,
    `}`,
    ``,
    `export function getCategoryCounts() {`,
    `  return zeroLuDemos.reduce((acc, demo) => {`,
    `    acc[demo.category] = (acc[demo.category] || 0) + 1;`,
    `    return acc;`,
    `  }, {});`,
    `}`,
    ``,
    `export function ratioToNumber(aspectRatio, fallback = 16 / 9) {`,
    `  if (!aspectRatio) return fallback;`,
    `  const [w, h] = aspectRatio.split(':').map(Number);`,
    `  if (!w || !h) return fallback;`,
    `  return w / h;`,
    `}`,
    ``,
    `export function formatDuration(demo) {`,
    `  return demo.duration ? demo.duration + 's' : '—';`,
    `}`,
    ``,
    `export async function loadDemoPrompt(slug) {`,
    `  const { zeroLuPrompts } = await import('./zeroLuPrompts');`,
    `  return zeroLuPrompts[slug];`,
    `}`,
    ``,
  ].join('\n');

  writeFileSync(join(OUT_DIR, 'zeroLuDemos.js'), jsContent, 'utf8');

  // Write prompts JSON
  const promptsJson = Object.fromEntries(
    videoEntries.filter((e) => e.prompt).map((e) => [e.slug, e.prompt])
  );
  writeFileSync(
    join(OUT_DIR, 'zeroLuPrompts.json'),
    JSON.stringify(promptsJson, null, 2) + '\n',
    'utf8'
  );
  writeFileSync(
    join(OUT_DIR, 'zeroLuPrompts.js'),
    `import prompts from './zeroLuPrompts.json';\n\nexport const zeroLuPrompts = prompts;\n`,
    'utf8'
  );

  console.log(`\n✅ Wrote ${demos.length} entries to src/data/zeroLuDemos.js`);
  console.log(`✅ Wrote ${promptsJson.length} prompts to src/data/zeroLuPrompts.json`);

  const counts = demos.reduce((acc, d) => {
    acc[d.category] = (acc[d.category] || 0) + 1;
    return acc;
  }, {});
  console.log('Categories:', counts);
  console.log(`Downloaded ${videoEntries.filter((v) => v.videoSrc).length} MP4 videos`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
