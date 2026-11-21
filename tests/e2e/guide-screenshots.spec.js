// tests/e2e/guide-screenshots.spec.js
//
// Captures the screenshots used by the public studio guide pages
// (/studios/<slug>): one overview per studio, plus one per feature with that
// feature's control highlighted (and opened, for safe tabs and dropdowns).
//
//   1. npm run dev                      (http://localhost:3100)
//   2. npm run capture:guides           (all studios, ~25 min)
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
import { TARGETS, DANGEROUS, SKIP_STUDIOS } from './guide-screenshot-targets.js';
import { BASE, apiModalOpen, closeApiModal, open, findControl } from './guide-helpers.js';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'public/guides');
// GUIDE_MANIFEST lets parallel trial runs write somewhere else.
const MANIFEST = process.env.GUIDE_MANIFEST || path.join(ROOT, 'src/data/guideScreenshots.json');

const kbDir = path.join(ROOT, 'src/data/askKb');
const kb = Object.fromEntries(
  fs.readdirSync(kbDir).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(kbDir, f), 'utf8'))]),
);
const only = (process.env.GUIDES || '').split(',').filter(Boolean);
const GUIDES = buildGuides(kb).filter((g) => (only.length ? only.includes(g.slug) : !SKIP_STUDIOS.includes(g.slug)));

test.use({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  bypassCSP: true, // dev CSP lacks unsafe-eval, which the /motion-agent/ player needs (production sends none)
  ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox'] } } : {}),
});
test.setTimeout(15 * 60 * 1000);


function toWebp(png, webp) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-c:v', 'libwebp', '-quality', '80', webp]);
  fs.unlinkSync(png);
}

function readManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { return {}; }
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
      // The app's lime accent, with a dark inner ring so the box still reads on lime buttons.
      border: '3px solid #d9ff00', borderRadius: '12px', boxShadow: '0 0 0 9999px rgba(0,0,0,.35), 0 0 24px rgba(217,255,0,.75), inset 0 0 0 1px rgba(0,0,0,.6)',
      zIndex: 2147483647, pointerEvents: 'none',
    });
    document.body.appendChild(box);
  }, opened);
}

const clearHighlight = (page) => Promise.all(page.frames().map((f) => f.evaluate(() => document.getElementById('__guide_hl')?.remove()).catch(() => {})));

for (const guide of GUIDES) {
  test(`guide screenshots: ${guide.slug}`, async ({ page }) => {
    const dir = path.join(OUT, guide.slug);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const shot = { features: {} };
    // Every image is taken with the API-key modal closed via its X; never save one with it open.
    const save = async (name) => {
      await page.waitForTimeout(800); // AuthModal opens asynchronously after a click
      if (!(await closeApiModal(page))) throw new Error('API key modal still open');
      const png = path.join(dir, `${name}.png`);
      await page.screenshot({ path: png });
      toWebp(png, path.join(dir, `${name}.webp`));
      return `/guides/${guide.slug}/${name}.webp`;
    };

    await open(page, guide.route);
    // Optional "__overview": { "setup": "..." } seeds state (e.g. skip a welcome wizard) before the overview shot.
    const ov = (TARGETS[guide.slug] || {}).__overview;
    if (ov?.setup) {
      await page.evaluate(ov.setup).catch((e) => console.log(`    overview setup error: ${e.message.split('\n')[0]}`));
      if (ov.reload !== false) await open(page, guide.route);
    }
    shot.overview = await save('overview');
    let here = guide.route;

    const targets = TARGETS[guide.slug] || {};
    for (const f of guide.features) {
      const target = targets[f.id];
      if (target?.skip) continue;
      const route = target?.route || guide.route;
      const fresh = Boolean(target?.setup || target?.steps);
      if (route !== here || fresh) { await open(page, route); here = route; }

      // Optional setup: run code in the page (e.g. seed a sample result), then reload.
      if (target?.setup) {
        await page.evaluate(target.setup).catch((e) => console.log(`    setup error: ${e.message.split('\n')[0]}`));
        if (target.reload !== false) await open(page, route);
      }
      // Optional steps: clicks (text or selector) to reach the feature (menus, sub-tabs, wizard steps).
      for (const step of target?.steps || []) {
        const loc = step.selector
          ? page.locator(step.selector).filter({ visible: true }).first()
          : page.getByText(step.text, { exact: Boolean(step.exact) }).filter({ visible: true }).first();
        await loc.click({ timeout: 4000 }).catch(() => console.log(`    step not found: ${step.text || step.selector}`));
        await page.waitForTimeout(step.wait || 1200);
        await closeApiModal(page);
      }
      if ((target?.steps || target?.setup) && !target.text && !target.selector) {
        try {
          shot.features[f.id] = await save(f.id);
          console.log(`  ✓ ${guide.slug}/${f.id} ← after steps`);
        } catch (e) {
          console.log(`  - ${guide.slug}/${f.id}: capture failed (${e.message.split('\n')[0]}), uses overview`);
        }
        here = null; // page state changed: reopen for the next feature
        continue;
      }

      // The feature is its own page (e.g. Brand → Campaign Studio at #/campaign).
      if (target?.route && !target.text && !target.selector) {
        try {
          shot.features[f.id] = await save(f.id);
          console.log(`  ✓ ${guide.slug}/${f.id} ← page #/${route}`);
        } catch (e) {
          console.log(`  - ${guide.slug}/${f.id}: capture failed (${e.message.split('\n')[0]}), uses overview`);
        }
        continue;
      }

      const el = await findControl(page, f, target);
      if (!el) { console.log(`  - ${guide.slug}/${f.id}: no matching control, uses overview`); continue; }

      // The visible text plus aria-label and title: an icon-only upload button is only named by its title.
      const label = (await el.evaluate((n) => [n.innerText, n.getAttribute('aria-label'), n.getAttribute('title')].filter(Boolean).join(' ').trim()).catch(() => '')) || '';
      const isOpener = await el.evaluate((n) => n.getAttribute('role') === 'tab' || n.hasAttribute('aria-haspopup') || n.tagName === 'SUMMARY' || !!n.querySelector('svg polyline, svg path[d*="M6 9"]')).catch(() => false);
      // An explicit click: true in the targets file is trusted; auto-detected openers are filtered.
      const opened = target?.click === true || (target?.click !== false && isOpener && !DANGEROUS.test(label));
      const urlBefore = page.url();
      let needsKey = false;
      if (opened) {
        await el.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(1500);
        needsKey = await apiModalOpen(page);
        if (needsKey) await closeApiModal(page);
      }
      // A click that navigated away: reload the studio and move on.
      if (page.url() !== urlBefore) {
        console.log(`  - ${guide.slug}/${f.id}: "${label.slice(0, 30)}" navigates away, uses overview`);
        here = null;
        continue;
      }
      try {
        await highlight(page, el, opened);
        shot.features[f.id] = await save(f.id);
        console.log(`  ✓ ${guide.slug}/${f.id} ← "${label.slice(0, 40).replace(/\s+/g, ' ')}"${opened ? ' (opened)' : ''}${needsKey ? ' (needs API key: modal closed)' : ''}`);
      } catch (e) {
        console.log(`  - ${guide.slug}/${f.id}: capture failed (${e.message.split('\n')[0]}), uses overview`);
        here = null;
        continue;
      }
      await clearHighlight(page);
      // Close whatever was opened: Escape, and if the page still changed, reload.
      await page.keyboard.press('Escape').catch(() => {});
      await page.keyboard.press('Escape').catch(() => {});
      if (opened || fresh) here = null; // reopen the studio before the next feature
      else await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    }

    const manifest = readManifest();
    manifest[guide.slug] = shot;
    const sorted = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]));
    fs.writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + '\n');
  });
}
