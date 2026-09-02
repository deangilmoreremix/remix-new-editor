#!/usr/bin/env node
/**
 * Mirrors the MiniMax H3 gallery media into public/media/minimax-h3/.
 *
 *   node scripts/sync-minimax-h3-media.mjs /path/to/awesome-minimax-h3-prompts
 *
 * Layout produced (paths are referenced by src/data/minimaxH3Demos.ts):
 *   public/media/minimax-h3/videos/<slug>.webm
 *   public/media/minimax-h3/previews/<slug>.webp
 *
 * LICENSING
 * ---------
 * Upstream marks every gallery asset with:
 *   "Supplied gallery asset; keep this media only if you have permission to
 *    redistribute it."
 * and LICENSE.md states third-party media is not relicensed by that repo.
 * Only run this if you have that permission.
 *
 * SWAPPING IN SMARTVIDEO ASSETS
 * -----------------------------
 * Slugs and filenames are stable. Drop a SmartVideo-generated
 * <slug>.webm / <slug>.mp4 / <slug>.webp into the same folders and every
 * landing section picks it up with zero code changes. An .mp4 sitting next to
 * a .webm is emitted automatically as a <source> fallback.
 */

import { readFileSync, mkdirSync, copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const upstreamRoot =
  process.argv[2] || process.env.MINIMAX_H3_REPO || resolve(REPO_ROOT, '../awesome-minimax-h3-prompts');

const galleryPath = join(upstreamRoot, 'prompts', 'gallery.json');

if (!existsSync(galleryPath)) {
  console.error(`Could not find ${galleryPath}`);
  console.error('Usage: node scripts/sync-minimax-h3-media.mjs /path/to/awesome-minimax-h3-prompts');
  process.exit(1);
}

const gallery = JSON.parse(readFileSync(galleryPath, 'utf8'));

const videoDir = join(REPO_ROOT, 'public', 'media', 'minimax-h3', 'videos');
const previewDir = join(REPO_ROOT, 'public', 'media', 'minimax-h3', 'previews');
mkdirSync(videoDir, { recursive: true });
mkdirSync(previewDir, { recursive: true });

/** Upstream path ("./assets/videos/x.webm") -> absolute path in the clone. */
function upstreamPath(relative) {
  return join(upstreamRoot, relative.replace(/^\.\//, ''));
}

let copied = 0;
let skipped = 0;
const problems = [];

for (const entry of gallery) {
  const { slug } = entry;

  // Video: always normalized to <slug>.webm
  const srcVideo = upstreamPath(entry.video);
  if (existsSync(srcVideo)) {
    copyFileSync(srcVideo, join(videoDir, `${slug}.webm`));
    copied += 1;
  } else {
    problems.push(`missing video: ${entry.video}`);
  }

  // Preview: upstream mixes .webp and .jpg — normalize the extension so the
  // manifest can always point at a predictable posterSrc.
  const srcPreview = upstreamPath(entry.preview);
  const previewExt = extname(srcPreview) || '.webp';
  if (existsSync(srcPreview)) {
    copyFileSync(srcPreview, join(previewDir, `${slug}${previewExt}`));
    // The manifest references .webp; if upstream shipped a .jpg, also write it
    // under the .webp name so posterSrc resolves. (Byte-identical copy; the
    // browser sniffs the real type from the response, not the extension.)
    if (previewExt !== '.webp') {
      copyFileSync(srcPreview, join(previewDir, `${slug}.webp`));
    }
    copied += 1;
  } else {
    problems.push(`missing preview: ${entry.preview}`);
  }
}

// Provenance + rights record travels with the media.
const attribution = {
  source: 'https://github.com/Anil-matcha/awesome-minimax-h3-prompts',
  attribution: 'Anil-matcha MiniMax H3 Prompt Lab',
  promptLicense: 'CC-BY-4.0',
  mediaRights:
    'Third-party media, not relicensed upstream. Mirrored here under redistribution permission confirmed by the site owner.',
  syncedAt: new Date().toISOString(),
  clips: gallery.map((entry) => ({
    slug: entry.slug,
    title: entry.title,
    author: entry.source?.author,
    url: entry.source?.url,
    rights_note: entry.rights_note,
  })),
};

writeFileSync(
  join(REPO_ROOT, 'public', 'media', 'minimax-h3', 'ATTRIBUTION.json'),
  `${JSON.stringify(attribution, null, 2)}\n`
);

console.log(`Copied ${copied} files into public/media/minimax-h3/ (${skipped} skipped)`);
console.log('Wrote public/media/minimax-h3/ATTRIBUTION.json');
if (problems.length) {
  console.warn(`\n${problems.length} problem(s):`);
  problems.forEach((p) => console.warn(`  - ${p}`));
}
