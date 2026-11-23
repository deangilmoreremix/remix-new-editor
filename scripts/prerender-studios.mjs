// Post-build prerender for /studios/<slug>: writes dist/studios/<slug>/index.html
// from dist/index.html with per-page <title>, description, canonical, Open Graph
// tags and crawlable text inside #app. main.js clears #app on boot, so users
// still get the client-rendered page; crawlers get real content without JS.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SITE = 'https://smartvid.app';
const { STUDIO_LANDING_PAGES } = await import(pathToFileURL(join(root, 'src/data/studioLandingPages.js')).href);

if (!existsSync(join(dist, 'index.html'))) throw new Error('dist/index.html missing — run the build first');
const shell = readFileSync(join(dist, 'index.html'), 'utf8');
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = (u) => (/^https?:/.test(u) ? u : SITE + u);

const setTag = (html, re, tag) => (re.test(html) ? html.replace(re, tag) : html.replace('</head>', `    ${tag}\n  </head>`));

for (const [slug, s] of Object.entries(STUDIO_LANDING_PAGES)) {
  const url = `${SITE}/studios/${slug}`;
  const title = `${s.heroTitle} | SmartVideo`;
  let html = shell;
  html = setTag(html, /<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = setTag(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${esc(s.heroDescription)}" />`);
  html = setTag(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}" />`);
  html = setTag(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(s.heroTitle)}" />`);
  html = setTag(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(s.heroDescription)}" />`);
  html = setTag(html, /<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(abs(s.thumbnail))}" />`);
  html = setTag(html, /<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${url}" />`);
  const feats = (s.features || []).map((f) => `<li>${esc(typeof f === 'string' ? f : f.title || f.name || '')}</li>`).join('');
  const body = `<main><h1>${esc(s.heroTitle)}</h1><p>${esc(s.heroDescription)}</p>${feats ? `<ul>${feats}</ul>` : ''}<p>${esc(s.valueProp || '')}</p></main>`;
  html = html.replace('<div id="app"></div>', `<div id="app">${body}</div>`);
  const out = join(dist, 'studios', slug);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'index.html'), html);
}
console.log(`[prerender-studios] wrote ${Object.keys(STUDIO_LANDING_PAGES).length} pages`);
