#!/usr/bin/env node
// Writes the public SmartWarmupAI feature pages after `vite build`:
//   dist/email-warmup/index.html          hub
//   dist/email-warmup/<slug>/index.html   one per feature
// and adds their URLs to dist/sitemap.xml (written by build-studio-guides.mjs, which runs first).
// The pages are standalone static HTML (no app bundle), so they load fast and crawlers see everything.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WARMUP_PAGES, WARMUP_BASE } from '../src/data/warmupPages.js';
import { renderDocument } from '../src/components/guides/renderWarmupPages.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.resolve(root, process.argv.slice(2).find((a) => !a.startsWith('--')) || 'dist');
const origin = (process.env.SITE_URL || process.env.URL || 'https://smartvid.app').replace(/\/$/, '');

function write(rel, html) {
  const file = path.join(dist, rel, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

// Fail the build if a page points at a screenshot that does not exist.
const pub = path.join(root, 'public');
for (const p of WARMUP_PAGES) {
  if (!fs.existsSync(path.join(pub, p.shot))) throw new Error(`[warmup-pages] missing screenshot ${p.shot} for ${p.slug}`);
}

write(WARMUP_BASE.slice(1), renderDocument(null, origin));
for (const p of WARMUP_PAGES) write(`${WARMUP_BASE.slice(1)}/${p.slug}`, renderDocument(p, origin));

const urls = [`${origin}${WARMUP_BASE}/`, ...WARMUP_PAGES.map((p) => `${origin}${WARMUP_BASE}/${p.slug}/`)];
const sitemap = path.join(dist, 'sitemap.xml');
if (fs.existsSync(sitemap)) {
  const today = new Date().toISOString().slice(0, 10);
  let xml = fs.readFileSync(sitemap, 'utf8');
  const entries = urls
    .filter((u) => !xml.includes(`<loc>${u}</loc>`))
    .map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${u.endsWith(`${WARMUP_BASE}/`) ? '0.9' : '0.8'}</priority></url>`)
    .join('\n');
  if (entries) xml = xml.replace('</urlset>', `${entries}\n</urlset>`);
  fs.writeFileSync(sitemap, xml);
}

console.log(`[warmup-pages] wrote hub + ${WARMUP_PAGES.length} pages for ${origin}`);
