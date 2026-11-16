#!/usr/bin/env node
/**
 * Real preview pictures of every Video Pages design, for the design pickers (the studio's New page screen and the Template Generator's
 * "Add to Video Pages" window): public/landing-previews/<template id>.jpg.
 *
 *   node scripts/generate-landing-design-previews.mjs [--force] [--only=puck-leadiq,clean] [--port=5198]
 *
 * Each design is drawn by the same code the public page uses (mountPuckPage for the editable Puck designs, renderLandingPage for the
 * others) with the design's own sample content, in headless Chrome. The script waits until every image on the page (the landing-art
 * pictures, fonts) has loaded, and refuses to keep a picture whose page has a broken image or is one flat tone. Needs Playwright
 * (preinstalled in the cloud sessions). A temporary Vite page is created in the repo root and removed at the end.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm, readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = join(ROOT, 'public/landing-previews');
const args = process.argv.slice(2);
const flag = (n, d = '') => (args.find((a) => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=') || d;
const FORCE = args.includes('--force');
const ONLY = flag('only') ? flag('only').split(',') : null;
const PORT = Number(flag('port', '5198'));
export const PREVIEW_SIZE = { width: 640, height: 400 };

const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>previews</title></head><body style="margin:0"><div id="root"></div><script type="module" src="/lp-previews-harness.js"></script></body></html>`;
const JS = `
import './styles/video-page.css';
import { TEMPLATES, defaultConfig } from './src/lib/landingPages/templates.js';
import { renderLandingPage } from './src/lib/landingPages/render.js';
import { mountPuckPage } from './src/lib/landingPages/puck/mount.jsx';
let current = null;
// the studio's New page picker no longer offers the older fixed-layout website (site) designs, so they get no picture
window.ids = () => TEMPLATES.filter((t) => !t.site).map((t) => t.id);
window.draw = (id) => {
  current?.destroy?.();
  const root = document.getElementById('root'); root.replaceChildren();
  const config = defaultConfig(id, { title: 'Launch video' });
  const page = { id: 'preview', title: 'Launch video', video_url: 'https://preview.test/video.mp4', poster_url: 'https://preview.test/poster.jpg', duration: 31, published: false, view_count: 0, config };
  const tokens = { firstname: 'Ann', company: 'Acme' };
  if (config.puck) { const host = document.createElement('div'); root.appendChild(host); current = mountPuckPage(host, { page, data: config.puck, tokens, handlers: {}, preview: true }); }
  else { const view = renderLandingPage({ page, tokens, preview: true }); root.appendChild(view.root); current = view; }
  return !!config.puck;
};
window.ready = true;
`;

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function startVite() {
  const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  await new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error('Vite did not start')), 60000);
    const on = (d) => { if (/Local:/.test(String(d))) { clearTimeout(t); ok(); } };
    proc.stdout.on('data', on); proc.stderr.on('data', on);
    proc.on('exit', () => fail(new Error('Vite exited')));
  });
  return proc;
}

async function main() {
  const { chromium } = await import('playwright');
  await mkdir(OUT, { recursive: true });
  const sample = await readFile(join(ROOT, 'public/library-previews/sample-in.jpg'));
  await writeFile(join(ROOT, 'lp-previews-harness.html'), HTML);
  await writeFile(join(ROOT, 'lp-previews-harness.js'), JS);
  let vite = null; let browser = null;
  const bad = [];
  try {
    vite = await startVite();
    // the cloud sessions keep one preinstalled Chromium; a repo-pinned Playwright of another version needs its path (CHROMIUM_PATH overrides)
    const exe = process.env.CHROMIUM_PATH || ((await exists('/opt/pw-browsers/chromium')) ? '/opt/pw-browsers/chromium' : undefined);
    browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {});
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 0.5 });
    // the sample poster stands in for the user's video frame; the video itself never loads
    await ctx.route('https://preview.test/poster.jpg', (r) => r.fulfill({ body: sample, contentType: 'image/jpeg' }));
    await ctx.route('https://preview.test/video.mp4', (r) => r.abort());
    const page = await ctx.newPage();
    const go = async () => { await page.goto(`http://127.0.0.1:${PORT}/lp-previews-harness.html`, { waitUntil: 'load', timeout: 60000 }).catch(() => {}); await page.waitForFunction(() => window.ready, null, { timeout: 60000 }).catch(() => {}); };
    await go();
    let ids = null;
    for (let k = 0; k < 8 && !ids; k += 1) { try { ids = await page.evaluate(() => window.ids()); } catch { await new Promise((r) => setTimeout(r, 4000)); await go(); } }   // Vite may reload once while it optimises
    if (!ids) throw new Error('The preview page did not load');
    const { contentShare } = await import(join(ROOT, 'scripts/template-thumbs/compose.mjs'));
    let made = 0; let kept = 0;
    for (const id of ids) {
      if (ONLY && !ONLY.includes(id)) continue;
      const file = join(OUT, `${id}.jpg`);
      if (!FORCE && !ONLY && await exists(file)) { kept += 1; continue; }
      let info = null;
      for (let k = 0; k < 4 && !info; k += 1) {
        try {
          await page.evaluate((x) => window.draw(x), id);
          // every picture the page asks for must have loaded, and the fonts
          await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 20000 }).catch(() => {});
          await page.evaluate(() => document.fonts?.ready);
          await page.waitForTimeout(700);
          info = await page.evaluate(() => ({ images: document.images.length, broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src) }));
        } catch { await new Promise((r) => setTimeout(r, 3000)); await go(); }
      }
      if (!info) { bad.push(`${id}: could not draw`); continue; }
      const broken = info.broken.filter((s) => !/preview\.test\/video\.mp4/.test(s));
      if (broken.length) { bad.push(`${id}: broken image ${broken[0]}`); continue; }
      await page.screenshot({ path: file, type: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: 1280, height: 800 } });
      if ((await contentShare(file)) < 0.01) { bad.push(`${id}: the picture is one flat tone`); await rm(file, { force: true }); continue; }
      made += 1;
      console.log(`${id}  (${info.images} images)`);
    }
    console.log(`\n${made} made, ${kept} already there, ${bad.length} problems`);
    if (bad.length) { console.log(bad.join('\n')); process.exitCode = 1; }
  } finally {
    await browser?.close();
    // npx starts vite as a child: stop the whole group, or its open pipes keep this script alive
    try { if (vite?.pid) process.kill(-vite.pid); } catch { /* already gone */ }
    await rm(join(ROOT, 'lp-previews-harness.html'), { force: true });
    await rm(join(ROOT, 'lp-previews-harness.js'), { force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main().then(() => process.exit(process.exitCode || 0)).catch((e) => { console.error(e.message); process.exit(1); });
