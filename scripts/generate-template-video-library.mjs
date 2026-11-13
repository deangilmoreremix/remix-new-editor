// Generates src/data/templateVideoLibrary.js — the clip library behind the timeline editor's
// "Template videos" modal. Read-only on every existing demo data file.
//
//   node scripts/generate-template-video-library.mjs
//
// scripts/template-video-allowlist.json lists the {set, slug} pairs that were reviewed and found to
// carry no logo / watermark / caption overlay. Remote clips (https://media.beatapi.io/...) are rewritten
// to the same-origin /cdn/beatapi/... path only in --local mode (the CDN sends no CORS headers and the editor loads media with
// crossOrigin="anonymous"); by default everything is hosted in the demo-template-videos bucket (public, CORS *).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
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
// Hosting: clips and posters are served from the Supabase Storage bucket `demo-template-videos` (a public bucket dedicated to this
// library inside a project shared by many apps; layout clips/<set>/<slug>.<ext>, posters/<set>/<slug>.<ext>, see
// scripts/upload-template-videos.mjs). Override with --base-url=<url> / TEMPLATE_VIDEO_BASE_URL, or pass --local to point at the repo's
// /media files and the same-origin /cdn/beatapi proxy instead (development fallback).
const DEFAULT_BASE_URL = 'https://bzxohkrxcwodllketcpz.supabase.co/storage/v1/object/public/demo-template-videos';
const baseUrl = process.argv.includes('--local') ? '' : (process.argv.find((a) => a.startsWith('--base-url='))?.slice(11) ?? process.env.TEMPLATE_VIDEO_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
const extOf = (u) => (u.match(/\.[a-z0-9]+$/i) || [''])[0];
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

// Real durations measured in a browser (the data files carry rounded nominal ones: 15 for a 15.18s clip, 15 for a 10.1s clip).
const measured = JSON.parse(readFileSync(resolve(root, 'scripts/template-video-measured-durations.json'), 'utf8'));
// The upstream ZeroLu poster files are 8-byte stubs; real posters for the clips we use live in public/media/template-videos/posters.
const posterOverride = (set, slug) => (set === 'zerolu' && existsSync(resolve(root, `public/media/template-videos/posters/${slug}.webp`)) ? `/media/template-videos/posters/${slug}.webp` : null);

// Curated commercial-style names + subcategories (scripts/template-video-labels.json, keyed by clip id). The upstream prompt
// title is kept as `sourceTitle` for attribution/search; categories are corrected where the upstream tag was wrong.
const labels = JSON.parse(readFileSync(resolve(root, 'scripts/template-video-labels.json'), 'utf8'));

const rows = [];
const sources = {};
const credits = {};
const missing = [];
for (const { set, slug } of allow) {
  const d = bySet[set]?.get(slug);
  if (!d || !d.videoSrc) { missing.push(`${set}:${slug}`); continue; }
  const label = labels[`${set}:${slug}`];
  if (!label) { missing.push(`${set}:${slug} (no label)`); continue; }
  rows.push({
    id: `${set}:${slug}`,
    slug,
    title: label.title,
    sourceTitle: d.title,
    category: label.category,
    subcategory: label.subcategory,
    duration: measured[`${set}:${slug}`] ?? d.duration ?? null,
    aspectRatio: d.aspectRatio ?? '16:9',
    videoSrc: baseUrl ? `${baseUrl}/clips/${set}/${slug}${extOf(d.videoSrc)}` : same(d.videoSrc),
    posterSrc: (() => { const p = posterOverride(set, slug) ?? same(d.posterSrc) ?? null; return p && baseUrl ? `${baseUrl}/posters/${set}/${slug}${extOf(p)}` : p; })(),
    tags: d.tags ?? [],
    source: SETS[set].label,
  });
  credits[`${set}:${slug}`] = { author: d.sourceAuthor ?? null, url: d.sourceUrl ?? null };
}
if (missing.length) { console.error('Missing from data files:', missing); process.exit(1); }
// Where each clip/poster comes from before hosting (read by scripts/upload-template-videos.mjs).
for (const { set, slug } of allow) {
  const d = bySet[set]?.get(slug);
  if (d?.videoSrc) sources[`${set}:${slug}`] = { video: same(d.videoSrc), poster: posterOverride(set, slug) ?? same(d.posterSrc) ?? null };
}
writeFileSync(resolve(root, 'scripts/template-video-sources.json'), JSON.stringify(sources, null, 1));

const PREFERRED = ['Action', 'Animation', 'Cinema', 'Commercial', 'Fashion', 'Social', 'UGC', 'VFX'];
const present = new Set(rows.map((r) => r.category));
const CATEGORY_ORDER = [...PREFERRED.filter((c) => present.has(c)), ...[...present].filter((c) => !PREFERRED.includes(c)).sort()];
// Subcategories per category, largest first (the second row of chips in the modal).
const SUBCATEGORIES = Object.fromEntries(CATEGORY_ORDER.map((c) => {
  const n = new Map();
  rows.filter((r) => r.category === c).forEach((r) => n.set(r.subcategory, (n.get(r.subcategory) ?? 0) + 1));
  return [c, [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k)];
}));

const out = `// AUTO-GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/generate-template-video-library.mjs
// ${rows.length} clips reviewed as free of logos / watermarks / captions; see scripts/template-video-allowlist.json.

/** @typedef {{ id: string, slug: string, title: string, sourceTitle: string, category: string, subcategory: string, duration: number | null, aspectRatio: string, videoSrc: string, posterSrc: string | null, tags: string[], source: string }} TemplateVideo */

/** @type {TemplateVideo[]} */
export const templateVideos = ${JSON.stringify(rows, null, 1)};

/** Category tabs in display order (only categories that actually hold clips). */
export const TEMPLATE_VIDEO_CATEGORIES = ${JSON.stringify(CATEGORY_ORDER)};

/** Subcategory chips per category, largest first. */
export const TEMPLATE_VIDEO_SUBCATEGORIES = ${JSON.stringify(SUBCATEGORIES, null, 1)};
`;
writeFileSync(resolve(root, 'src/data/templateVideoLibrary.js'), out);
console.log(`wrote ${rows.length} clips`);

// catalog.json: the machine-readable index of the hosted library. It is uploaded to the bucket root (scripts/upload-template-videos.mjs) so
// another app, or a Claude without this repo, can discover the templates by name and category from one public URL. Only written for the
// hosted form (not --local) and without a timestamp, so regenerating does not create noise.
if (baseUrl) {
  const catalog = {
    name: 'Demo template videos',
    description: 'Ready-made AI video templates (cinematic, commercial, social, action, animation, fashion, VFX) with commercial-style names, categories and subcategories. Each clip was reviewed for logos, watermarks and burned-in captions.',
    bucket: 'demo-template-videos',
    baseUrl,
    catalogUrl: `${baseUrl}/catalog.json`,
    usage: 'Pick clips by category/subcategory. videoUrl and posterUrl are public, send Access-Control-Allow-Origin: *, and support range requests. Layout: clips/<set>/<slug>.<ext>, posters/<set>/<slug>.<ext>.',
    rights: 'Third-party media (originally shared on X and public prompt galleries). Confirm commercial-use / redistribution permission before production use; credit holds the upstream author and post where known.',
    maintainedBy: 'remix-new-editor repo: scripts/generate-template-video-library.mjs, scripts/upload-template-videos.mjs, docs/template-videos.md',
    count: rows.length,
    categories: SUBCATEGORIES,
    clips: rows.map((r) => ({
      id: r.id, title: r.title, originalTitle: r.sourceTitle, category: r.category, subcategory: r.subcategory,
      duration: r.duration, aspectRatio: r.aspectRatio, videoUrl: r.videoSrc, posterUrl: r.posterSrc, source: r.source,
      credit: credits[r.id],
    })),
  };
  writeFileSync(resolve(root, 'scripts/template-video-catalog.json'), JSON.stringify(catalog, null, 1) + '\n');
  console.log(`wrote scripts/template-video-catalog.json (${rows.length} clips)`);
}
