#!/usr/bin/env node
/* global window, fetch */
/**
 * Real pictures of every Caption Studio look, for its Motion & Style tiles: public/caption-looks/<preset key>.webp (640x360).
 *
 *   node scripts/generate-caption-look-previews.mjs [--only=capite-hormozi,tiktok] [--port=5197]
 *
 * Each look is drawn by the code that burns captions into the final video (src/lib/captionStudio/painter.js: paintCaptions, with the
 * look's own font, colours, outline and highlight) on a real photo that ships with the app (public/library-previews/sample-in.jpg), with the
 * sample line "Make it pop" and the middle word being spoken. Needs Playwright (preinstalled in the cloud sessions) and network access for
 * the Google Fonts the looks use (the script refuses to keep a picture whose font did not load). A temporary Vite page is created in the repo
 * root and removed at the end.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = join(ROOT, 'public/caption-looks');
const TMP = join(ROOT, 'tmp-caption-looks');
const args = process.argv.slice(2);
const flag = (n, d = '') => (args.find((a) => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=') || d;
const ONLY = flag('only') ? flag('only').split(',') : null;
const PORT = Number(flag('port', '5197'));
export const LOOK_IMAGE_SIZE = { width: 640, height: 360 };
export const SAMPLE_IMAGE = '/library-previews/sample-in.jpg';

const HTML = '<!doctype html><html><head><meta charset="utf-8"><title>caption looks</title></head><body style="margin:0;background:#000"><canvas id="c" width="640" height="360"></canvas><script type="module" src="./main.js"></script></body></html>';
const JS = `
import { CAPTION_PRESETS, CAPITE_PRESETS, defaultCaptionStyle } from '../src/lib/captionStudio/model.js';
import { paintCaptions, ensureCaptionFont } from '../src/lib/captionStudio/painter.js';
const W = 640, H = 360;
const img = new Image();
const loaded = new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('photo did not load')); });
img.src = '${SAMPLE_IMAGE}';
const words = ['Make', ' it', ' pop'].map((text, i) => ({ text, startMs: i * 400, endMs: i * 400 + 400, timestampMs: i * 400 + 200, confidence: null }));
window.keys = () => [...Object.keys(CAPTION_PRESETS), ...Object.keys(CAPITE_PRESETS)];
window.draw = async (key) => {
  await loaded;
  const style = { ...defaultCaptionStyle(key), fontSize: 15, positionY: 0.7 };
  await ensureCaptionFont(style, 'Make it pop');
  const fontOk = document.fonts.check('16px "' + (style.fontFamily || 'Inter') + '"');
  const c = document.getElementById('c'); const ctx = c.getContext('2d');
  // cover-fit the photo
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  ctx.drawImage(img, (W - img.naturalWidth * s) / 2, (H - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  const drawn = paintCaptions(ctx, W, H, words, style, 600);
  return { drawn, fontOk, font: style.fontFamily, url: c.toDataURL('image/webp', 0.85) };
};
window.ready = true;
`;

async function waitFor(url, ms = 60000) {
  const t0 = Date.now();
  for (;;) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    if (Date.now() - t0 > ms) throw new Error(`${url} did not come up`);
    await new Promise((r) => setTimeout(r, 400));
  }
}

async function main() {
  const { chromium } = await import('playwright');
  await rm(TMP, { recursive: true, force: true });
  await mkdir(TMP, { recursive: true });
  await writeFile(join(TMP, 'index.html'), HTML);
  await writeFile(join(TMP, 'main.js'), JS);
  await mkdir(OUT, { recursive: true });
  const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  let failed = 0;
  let browser;
  try {
    const exe = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined); // the cloud sessions' pre-installed Chromium
    browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: LOOK_IMAGE_SIZE });
    const url = `http://127.0.0.1:${PORT}/tmp-caption-looks/index.html`;
    await waitFor(url);
    // Vite re-optimises dependencies on first use and reloads the page: retry until the page reports ready
    for (let i = 0; i < 8; i += 1) {
      try { await page.goto(url); await page.waitForFunction(() => window.ready, null, { timeout: 40000 }); await page.waitForTimeout(2500); if (await page.evaluate(() => window.ready)) break; } catch { /* reload during optimisation */ }
    }
    const keys = (await page.evaluate(() => window.keys())).filter((k) => !ONLY || ONLY.includes(k));
    for (const key of keys) {
      const r = await page.evaluate((k) => window.draw(k), key);
      if (!r.drawn || !r.fontOk) { console.error(`✗ ${key}: ${!r.drawn ? 'nothing drawn' : `font "${r.font}" did not load`}`); failed += 1; continue; }
      await writeFile(join(OUT, `${key}.webp`), Buffer.from(r.url.split(',')[1], 'base64'));
      console.log(`✓ ${key} (${r.font})`);
    }
  } finally {
    await browser?.close();
    vite.kill();
    await rm(TMP, { recursive: true, force: true });
  }
  if (failed) { console.error(`${failed} look(s) not written`); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
