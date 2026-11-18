// tests/e2e/guide-screenshots.spec.js
//
// Captures the screenshots used by the public studio guide pages
// (/studios/<slug>): one overview per studio, plus one per feature with that
// feature's control highlighted (and opened, for safe tabs and dropdowns).
//
//   1. npm run dev                      (http://localhost:3100)
//   2. npm run capture:guides           (all studios)
//      GUIDES=image-studio,video-studio npm run capture:guides   (some)
//   3. node scripts/build-studio-guides.mjs --index-only
//
// Output: public/guides/<slug>/overview.webp and <feature-id>.webp, plus
// src/data/guideScreenshots.json (the manifest the guide pages read).
// Uses ?dev (auth bypass, placeholder key), so nothing is generated or billed.

import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildGuides } from '../../src/data/studioGuides.core.js';
import { TARGETS, DANGEROUS } from './guide-screenshot-targets.js';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'public/guides');
const MANIFEST = path.join(ROOT, 'src/data/guideScreenshots.json');
const BASE = process.env.GUIDE_BASE_URL || 'http://localhost:3100';
const LOAD_MS = Number(process.env.GUIDE_LOAD_MS || 18000);

const kbDir = path.join(ROOT, 'src/data/askKb');
const kb = Object.fromEntries(
  fs.readdirSync(kbDir).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(kbDir, f), 'utf8'))]),
);
const only = (process.env.GUIDES || '').split(',').filter(Boolean);
const GUIDES = buildGuides(kb).filter((g) => !only.length || only.includes(g.slug));

test.use({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox'] } } : {}),
});
test.setTimeout(15 * 60 * 1000);

const STOP = new Set(['the', 'and', 'with', 'for', 'from', 'your', 'into', 'this', 'that', 'mode', 'modes', 'studio', 'image', 'images', 'video', 'videos', 'button', 'panel', 'option', 'options', 'tool', 'tools', 'feature', 'features', 'menu', 'list', 'card', 'cards', 'view', 'page', 'smart']);
const tokens = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-z0-9+]+/).filter((t) => t.length >= 3 && !STOP.has(t));

// UI labels quoted or named in the feature's description, e.g. "the Draw button".
function labelsFrom(text) {
  const out = new Set();
  const t = String(text || '');
  for (const m of t.matchAll(/['"‘“]([^'"’”]{2,40})['"’”]/g)) out.add(m[1].trim());
  for (const m of t.matchAll(/\b((?:[A-Z][\w+&/-]*\s?){1,4})\s(?:button|tab|panel|menu|toggle|dropdown|picker|switch|section)\b/g)) out.add(m[1].trim());
  return [...out].filter((x) => x.length >= 2 && !/^(the|a|an|this|it)$/i.test(x)).map((x) => x.toLowerCase());
}

function toWebp(png, webp) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-c:v', 'libwebp', '-quality', '80', webp]);
  fs.unlinkSync(png);
}

function readManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { return {}; }
}

async function dismissOverlays(page) {
  for (let i = 0; i < 3; i++) {
    const skip = page.getByRole('button', { name: /skip for now|maybe later|not now|got it|dismiss|close/i }).first();
    if (await skip.isVisible().catch(() => false)) { await skip.click().catch(() => {}); await page.waitForTimeout(400); continue; }
    break;
  }
  await page.keyboard.press('Escape').catch(() => {});
  // Hide the floating assistant button so it doesn't cover the studio.
  await page.addStyleTag({ content: '[data-ask-smartvideo],.ask-smartvideo-launcher,#ask-smartvideo-root{display:none!important}' }).catch(() => {});
}

// Find the best visible control for a feature. Returns an element handle or null.
async function findControl(page, feature, target) {
  if (target?.selector) {
    const el = page.locator(target.selector).filter({ visible: true }).first();
    if (await el.count()) return el.elementHandle();
  }
  if (target?.text) return matchControl(page, [target.text.toLowerCase()], []);
  return (await matchControl(page, null, tokens(feature.name)))
    || matchControl(page, labelsFrom(`${feature.definition} ${feature.inputRequired}`), []);
}

async function matchControl(page, want, toks) {
  if (want && !want.length) return null;
  if (!want && !toks.length) return null;
  const handle = await page.evaluateHandle(({ want, toks }) => {
    const root = document.getElementById('content-area') || document.body;
    const els = root.querySelectorAll('button,[role=tab],[role=button],a,label,summary,select,textarea,input[placeholder],h2,h3,h4,[aria-haspopup]');
    let best = null; let bestScore = 0;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || getComputedStyle(el).visibility === 'hidden') continue;
      const text = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.innerText || el.title || '').trim().toLowerCase();
      if (!text || text.length > 80) continue;
      let score;
      if (want) score = want.some((w) => text.includes(w)) ? 10 : 0;
      else {
        const hits = toks.filter((t) => text.includes(t)).length;
        if (!hits) continue;
        score = hits / toks.length + hits * 0.25 - text.length / 400 + (/^h[234]$/i.test(el.tagName) ? 0.15 : 0);
      }
      if (score > bestScore) { best = el; bestScore = score; }
    }
    return bestScore >= (want ? 1 : 0.5) ? best : null;
  }, { want, toks });
  return handle.asElement();
}

async function highlight(page, el, opened) {
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.evaluate((node, opened) => {
    // An opened panel usually appears below its control: keep the control near the top.
    if (opened) window.scrollBy(0, node.getBoundingClientRect().top - 140);
    else node.scrollIntoView({ block: 'center', inline: 'nearest' });
    const r = node.getBoundingClientRect();
    const box = document.createElement('div');
    box.id = '__guide_hl';
    Object.assign(box.style, {
      position: 'fixed', left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px`,
      border: '3px solid #22d3ee', borderRadius: '12px', boxShadow: '0 0 0 9999px rgba(0,0,0,.35), 0 0 24px rgba(34,211,238,.8)',
      zIndex: 2147483647, pointerEvents: 'none',
    });
    document.body.appendChild(box);
  }, opened);
}

const clearHighlight = (page) => page.evaluate(() => document.getElementById('__guide_hl')?.remove()).catch(() => {});

for (const guide of GUIDES) {
  test(`guide screenshots: ${guide.slug}`, async ({ page }) => {
    const dir = path.join(OUT, guide.slug);
    fs.mkdirSync(dir, { recursive: true });
    const url = `${BASE}/?dev#/${guide.route}`;
    const shot = { features: {} };

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(LOAD_MS);
    await dismissOverlays(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(dir, 'overview.png') });
    toWebp(path.join(dir, 'overview.png'), path.join(dir, 'overview.webp'));
    shot.overview = `/guides/${guide.slug}/overview.webp`;

    const targets = TARGETS[guide.slug] || {};
    for (const f of guide.features) {
      const target = targets[f.id];
      if (target?.skip) continue;
      if (target?.route) {
        // The feature is its own page (e.g. Brand → Campaign Studio at #/campaign).
        await page.goto(`${BASE}/?dev#/${target.route}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(LOAD_MS);
        await dismissOverlays(page);
        const png = path.join(dir, `${f.id}.png`);
        await page.screenshot({ path: png });
        toWebp(png, path.join(dir, `${f.id}.webp`));
        shot.features[f.id] = `/guides/${guide.slug}/${f.id}.webp`;
        console.log(`  ✓ ${guide.slug}/${f.id} ← page #/${target.route}`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(LOAD_MS);
        await dismissOverlays(page);
        continue;
      }
      const el = await findControl(page, f, target);
      if (!el) { console.log(`  - ${guide.slug}/${f.id}: no matching control, uses overview`); continue; }

      const label = (await el.evaluate((n) => (n.innerText || n.getAttribute('aria-label') || '').trim()).catch(() => '')) || '';
      const isOpener = await el.evaluate((n) => n.getAttribute('role') === 'tab' || n.hasAttribute('aria-haspopup') || n.tagName === 'SUMMARY' || !!n.querySelector('svg polyline, svg path[d*="M6 9"]')).catch(() => false);
      const shouldClick = target?.click ?? (isOpener && !DANGEROUS.test(label));
      const hashBefore = await page.evaluate(() => location.hash);

      const opened = Boolean(shouldClick && !DANGEROUS.test(label));
      if (opened) {
        await el.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(1200);
      }
      // A click that navigated away: go back and only highlight.
      if ((await page.evaluate(() => location.hash)) !== hashBefore) {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(LOAD_MS);
        await dismissOverlays(page);
        continue;
      }
      await highlight(page, el, opened);
      const png = path.join(dir, `${f.id}.png`);
      await page.screenshot({ path: png });
      await clearHighlight(page);
      toWebp(png, path.join(dir, `${f.id}.webp`));
      shot.features[f.id] = `/guides/${guide.slug}/${f.id}.webp`;
      console.log(`  ✓ ${guide.slug}/${f.id} ← "${label.slice(0, 40).replace(/\s+/g, ' ')}"${opened ? ' (opened)' : ''}`);

      await page.keyboard.press('Escape').catch(() => {});
      await page.keyboard.press('Escape').catch(() => {});
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
    }

    const manifest = readManifest();
    manifest[guide.slug] = shot;
    const sorted = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]));
    fs.writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + '\n');
  });
}
