#!/usr/bin/env node
// Downloads the muapi Studio app cover images into public/thumbnails/muapi-apps/<app-id>.webp
// (resized to at most 800px on the long side, WebP q82, to keep the repo small).
//
// These images are muapi's artwork (© Vadoo Internet Services Private Limited). They are used here
// with muapi's permission, as confirmed by the project owner on 2026-11-23. See public/thumbnails/muapi-apps/NOTICE.md.
//
//   node scripts/fetch-muapi-app-thumbnails.mjs [--force]
//
// Reads the cover URLs from the Studio catalog the same way build-muapi-apps-map.mjs does, so it
// needs the same cache folder: run build-muapi-apps-map.mjs first (or pass --cache <dir>).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const force = process.argv.includes('--force');
const cache = arg('--cache', join(tmpdir(), 'muapi-cache'));
const outDir = join(root, 'public/thumbnails/muapi-apps');
mkdirSync(outDir, { recursive: true });

// The map already carries each app's id; the cover URL follows muapi's stable pattern
// https://cdn.muapi.ai/assets/<studio-slug>.webp, but the exact URL is read from the catalog chunk.
const map = JSON.parse(readFileSync(join(root, 'src/data/muapiStudioAppsMap.json'), 'utf8'));
let covers = {};
const chunkDir = join(cache, 'chunks');
if (existsSync(chunkDir)) {
  for (const f of readdirSync(chunkDir)) {
    const src = readFileSync(join(chunkDir, f), 'utf8');
    for (const m of src.matchAll(/"slug":"([a-z0-9-]+)"[^{}]*?"cover":"(https:\/\/cdn\.muapi\.ai\/[^"]+)"/g)) covers[m[1]] = m[2];
  }
}
let made = 0, kept = 0, missing = [];
for (const app of map.apps) {
  const url = covers[app.id];
  if (!url) { missing.push(app.id); continue; }
  const dest = join(outDir, `${app.id}.webp`);
  if (existsSync(dest) && !force) { kept++; continue; }
  const tmp = join(tmpdir(), `muapi-cover-${app.id}.webp`);
  execFileSync('curl', ['-fsSL', '--max-time', '30', '-o', tmp, url]);
  execFileSync('python3', ['-I', '-c', [
    'import sys',
    'from PIL import Image',
    'im=Image.open(sys.argv[1]).convert("RGB")',
    'im.thumbnail((800,800))',
    'im.save(sys.argv[2],"WEBP",quality=82,method=6)',
  ].join('\n'), tmp, dest]);
  rmSync(tmp, { force: true });
  made++;
}
console.log(`muapi app thumbnails: ${made} written, ${kept} kept${force ? '' : ' (use --force to refresh)'}${missing.length ? `, MISSING cover url for: ${missing.join(', ')}` : ''}`);
if (missing.length) process.exit(1);
