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

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'public/guides');
// GUIDE_MANIFEST lets parallel trial runs write somewhere else.
const MANIFEST = process.env.GUIDE_MANIFEST || path.join(ROOT, 'src/data/guideScreenshots.json');
const BASE = process.env.GUIDE_BASE_URL || 'http://localhost:3100';
const MAX_LOAD_MS = Number(process.env.GUIDE_MAX_LOAD_MS || 45000);

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

const API_MODAL = /set up your API keys/i;

// Is the "Welcome — set up your API keys" modal visible in the page or any iframe?
async function apiModalOpen(page) {
  for (const frame of page.frames()) {
    const t = frame.getByText(API_MODAL).first();
    if (await t.isVisible().catch(() => false)) return true;
  }
  return false;
}

// Close the API-key modal the way a user does: click its X (aria-label="Close",
// src/components/SettingsModal.js). It opens on first load and again whenever
// a control needs a key (AuthModal), in the page and in studio iframes.
// Returns true if the modal is gone.
async function closeApiModal(page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    let found = false;
    for (const frame of page.frames()) {
      const title = frame.getByText(API_MODAL).first();
      if (!(await title.isVisible().catch(() => false))) continue;
      found = true;
      const overlay = frame.locator('div.fixed').filter({ has: title }).last();
      const x = overlay.locator('button[aria-label="Close"]').first();
      const skip = overlay.getByRole('button', { name: /skip for now/i }).first();
      const where = frame === page.mainFrame() ? 'page' : 'iframe';
      if (await x.isVisible().catch(() => false)) {
        await x.click({ timeout: 3000 }).catch(() => {});
        console.log(`    · closed API key modal with its X (${where})`);
      }
      else if (await skip.isVisible().catch(() => false)) {
        await skip.click({ timeout: 3000 }).catch(() => {});
        console.log(`    · closed API key modal with Skip (${where})`);
      }
      await title.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    }
    if (!found) return true;
    await page.waitForTimeout(500);
  }
  return !(await apiModalOpen(page));
}

async function dismissOverlays(page) {
  for (let i = 0; i < 3; i++) {
    const skip = page.getByRole('button', { name: /skip for now|maybe later|not now|got it|dismiss/i }).first();
    if (await skip.isVisible().catch(() => false)) { await skip.click().catch(() => {}); await page.waitForTimeout(400); continue; }
    break;
  }
  await page.keyboard.press('Escape').catch(() => {});
  await closeApiModal(page);
  // Hide the floating assistant button so it doesn't cover the studio.
  await page.addStyleTag({ content: '[data-ask-smartvideo],.ask-smartvideo-launcher,#ask-smartvideo-root{display:none!important}' }).catch(() => {});
}

// Wait until the studio has rendered: its text stops changing (max MAX_LOAD_MS).
async function waitForStudio(page) {
  const start = Date.now();
  let last = -1; let stable = 0;
  await page.waitForTimeout(4000);
  while (Date.now() - start < MAX_LOAD_MS) {
    const n = await page.evaluate(() => (document.getElementById('content-area') || document.body).innerText.length).catch(() => -1);
    stable = n === last && n > 150 ? stable + 1 : 0;
    if (stable >= 3) break;
    last = n;
    await page.waitForTimeout(1500);
  }
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500); // images and entrance animations
}

async function open(page, route) {
  // ?dev= is the form the app rewrites ?dev to (no navigation race). Going via about:blank forces a
  // real load even when only the hash changes, so seeded localStorage is read again.
  await page.goto('about:blank');
  await page.goto(`${BASE}/?dev=#/${route}`, { waitUntil: 'domcontentloaded' });
  await waitForStudio(page);
  await dismissOverlays(page);
  await page.evaluate(() => window.scrollTo(0, 0));
}

// Find the best visible control for a feature. Returns an element handle or null.
async function findControl(page, feature, target) {
  if (target?.selector) {
    for (const frame of page.frames()) {
      const el = frame.locator(target.selector).filter({ visible: true }).first();
      if (await el.count().catch(() => 0)) return el.elementHandle();
    }
    if (!target.text) return null;
  }
  if (target?.text) return matchControl(page, [target.text.toLowerCase()], []);
  return (await matchControl(page, null, tokens(feature.name)))
    || matchControl(page, labelsFrom(`${feature.definition} ${feature.inputRequired}`), []);
}

// Search the page, then any embedded studio iframes (Workbench, Video Agent).
async function matchControl(page, want, toks) {
  if (want && !want.length) return null;
  if (!want && !toks.length) return null;
  for (const frame of page.frames()) {
    const el = await matchInFrame(frame, want, toks).catch(() => null);
    if (el) return el;
  }
  return null;
}

async function matchInFrame(frame, want, toks) {
  const handle = await frame.evaluateHandle(({ want, toks }) => {
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
