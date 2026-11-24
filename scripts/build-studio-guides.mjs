#!/usr/bin/env node
// Prerenders the public studio guide pages after `vite build`:
//   dist/studios/index.html            hub
//   dist/studios/<slug>/index.html     one per studio
//   dist/sitemap.xml, dist/robots.txt
//   src/data/studioGuideIndex.json   small index for the landing page
//                                    (`--index-only` writes just this)
// Each page is dist/index.html with that page's title, meta, canonical,
// Open Graph and JSON-LD in <head> and the full guide HTML in #app, so
// crawlers see all the content. The SPA then mounts and renders the same HTML.
//
// Site origin: SITE_URL, else Netlify's URL, else https://smartvid.app.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGuides, groupByCategory } from '../src/data/studioGuides.core.js';
import { GUIDE_CSS, renderGuideHtml, renderHubHtml, guideHead, headTagsHtml } from '../src/components/guides/renderGuide.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.resolve(root, process.argv.slice(2).find((a) => !a.startsWith('--')) || 'dist');
const origin = (process.env.SITE_URL || process.env.URL || 'https://smartvid.app').replace(/\/$/, '');

const kbDir = path.join(root, 'src/data/askKb');
const kb = {};
for (const f of fs.readdirSync(kbDir)) {
  if (f.endsWith('.json') && !f.startsWith('_')) kb[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(kbDir, f), 'utf8'));
}
const shots = JSON.parse(fs.readFileSync(path.join(root, 'src/data/guideScreenshots.json'), 'utf8'));
const videos = JSON.parse(fs.readFileSync(path.join(root, 'src/data/guideVideos.json'), 'utf8'));
const guides = buildGuides(kb, shots, {}, videos);
const groups = groupByCategory(guides);

// Small index for the landing page section (the full guide data is ~1MB).
const index = groups.map((c) => ({
  id: c.id, title: c.title, blurb: c.blurb,
  guides: c.guides.map((g) => ({ slug: g.slug, name: g.name, route: g.route, shortDescription: g.shortDescription, features: g.features.length, thumbnail: g.thumbnail })),
}));
const indexFile = path.join(root, 'src/data/studioGuideIndex.json');
const indexJson = JSON.stringify(index, null, 2) + '\n';
if (!fs.existsSync(indexFile) || fs.readFileSync(indexFile, 'utf8') !== indexJson) fs.writeFileSync(indexFile, indexJson);
if (process.argv.includes('--index-only')) {
  console.log(`[studio-guides] wrote index for ${guides.length} guides`);
  process.exit(0);
}

const templateFile = path.join(dist, 'index.html');
if (!fs.existsSync(templateFile)) {
  console.error(`[studio-guides] ${templateFile} not found: run vite build first (or pass the dist folder).`);
  process.exit(1);
}
const template = fs.readFileSync(templateFile, 'utf8');
if (!template.includes('<div id="app"></div>')) throw new Error('dist/index.html has no empty <div id="app"></div>');

function page(head, body) {
  const html = template
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+name="(title|description|keywords)"[^>]*>\s*/gi, '')
    .replace(/<meta\s+(property|name)="(og|twitter):[^"]*"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '');
  return html
    .replace('</head>', `    ${headTagsHtml(head)}\n    <style id="studio-guide-css">${GUIDE_CSS}</style>\n  </head>`)
    .replace('<div id="app"></div>', `<div id="app">${body}</div>`);
}

function write(rel, html) {
  const file = path.join(dist, rel, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

write('studios', page(guideHead(null, origin, groups), renderHubHtml(groups, guides.length)));
for (const g of guides) write(`studios/${g.slug}`, page(guideHead(g, origin, groups), renderGuideHtml(g, guides.length)));

const today = new Date().toISOString().slice(0, 10);
// Trailing slashes: each guide is a folder with index.html, which the host serves at /studios/<slug>/.
const urls = [`${origin}/`, `${origin}/studios/`, ...guides.map((g) => `${origin}/studios/${g.slug}/`)];
fs.writeFileSync(path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${u === `${origin}/` ? '1.0' : u.endsWith('/studios/') ? '0.9' : '0.8'}</priority></url>`)
    .join('\n')}\n</urlset>\n`);

const robots = path.join(dist, 'robots.txt');
if (fs.existsSync(robots)) {
  fs.writeFileSync(robots, fs.readFileSync(robots, 'utf8').replace(/^Sitemap:.*$/m, `Sitemap: ${origin}/sitemap.xml`));
}

console.log(`[studio-guides] wrote ${guides.length} guides + hub + sitemap (${urls.length} URLs) for ${origin}`);
