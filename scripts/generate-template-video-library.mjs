// Generates src/data/templateVideoLibrary.js — the clip library behind the timeline editor's
// "Template videos" modal. Read-only on every existing demo data file.
//
//   node scripts/generate-template-video-library.mjs
//
// scripts/template-video-allowlist.json lists the {set, slug} pairs that were reviewed and found to
// carry no logo / watermark / caption overlay. Remote clips (https://media.beatapi.io/...) are rewritten
// to the same-origin /cdn/beatapi/... path (see netlify.toml + vite.config.js) because the CDN sends no
// CORS headers and the editor loads media with crossOrigin="anonymous".
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SETS = {
  mmx25: { file: 'src/data/beatapiMinimaxH3Demos.js', label: 'MiniMax H3' },
  sd25: { file: 'src/data/beatapiSeedance25Demos.js', label: 'Seedance 2.5' },
  zerolu: { file: 'src/data/zeroLuDemos.js', label: 'Seedance 2.0' },
  mmxLegacy: { file: 'src/data/minimaxH3Demos.js', label: 'MiniMax H3' },
  sdLegacy: { file: 'src/data/seedanceDemos.js', label: 'Seedance' },
};
const CDN = 'https://media.beatapi.io/';
const PROXY = '/cdn/beatapi/';
const same = (u) => (typeof u === 'string' && u.startsWith(CDN) ? PROXY + u.slice(CDN.length) : u);

const allow = JSON.parse(readFileSync(resolve(root, 'scripts/template-video-allowlist.json'), 'utf8'));
const bySet = {};
for (const s of Object.keys(SETS)) {
  const m = await import(pathToFileURL(resolve(root, SETS[s].file)).href);
  const arr = Object.values(m).find((v) => Array.isArray(v) && v[0]?.slug);
  bySet[s] = new Map(arr.map((d) => [d.slug, d]));
}

const rows = [];
const missing = [];
for (const { set, slug } of allow) {
  const d = bySet[set]?.get(slug);
  if (!d || !d.videoSrc) { missing.push(`${set}:${slug}`); continue; }
  rows.push({
    id: `${set}:${slug}`,
    slug,
    title: d.title,
    category: d.category,
    duration: d.duration ?? null,
    aspectRatio: d.aspectRatio ?? '16:9',
    videoSrc: same(d.videoSrc),
    posterSrc: same(d.posterSrc) ?? null,
    tags: d.tags ?? [],
    source: SETS[set].label,
  });
}
if (missing.length) { console.error('Missing from data files:', missing); process.exit(1); }

const PREFERRED = ['Action', 'Animation', 'Cinema', 'Commercial', 'Fashion', 'Social', 'UGC', 'VFX'];
const present = new Set(rows.map((r) => r.category));
const CATEGORY_ORDER = [...PREFERRED.filter((c) => present.has(c)), ...[...present].filter((c) => !PREFERRED.includes(c)).sort()];

const out = `// AUTO-GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/generate-template-video-library.mjs
// ${rows.length} clips reviewed as free of logos / watermarks / captions; see scripts/template-video-allowlist.json.

/** @typedef {{ id: string, slug: string, title: string, category: string, duration: number | null, aspectRatio: string, videoSrc: string, posterSrc: string | null, tags: string[], source: string }} TemplateVideo */

/** @type {TemplateVideo[]} */
export const templateVideos = ${JSON.stringify(rows, null, 1)};

/** Category tabs in display order (only categories that actually hold clips). */
export const TEMPLATE_VIDEO_CATEGORIES = ${JSON.stringify(CATEGORY_ORDER)};
`;
writeFileSync(resolve(root, 'src/data/templateVideoLibrary.js'), out);
console.log(`wrote ${rows.length} clips`);
