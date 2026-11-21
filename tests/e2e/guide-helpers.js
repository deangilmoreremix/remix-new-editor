// tests/e2e/guide-helpers.js
//
// Studio-driving helpers shared by guide-screenshots.spec.js and guide-videos.spec.js:
// closing the API-key modal, waiting for a studio to render, opening a route and
// finding the control a guide feature describes.
export const BASE = process.env.GUIDE_BASE_URL || 'http://localhost:3100';
const MAX_LOAD_MS = Number(process.env.GUIDE_MAX_LOAD_MS || 45000);

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

export const API_MODAL = /set up your API keys/i;

// Is the "Welcome — set up your API keys" modal visible in the page or any iframe?
export async function apiModalOpen(page) {
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
export async function closeApiModal(page) {
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

export async function dismissOverlays(page) {
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
export async function waitForStudio(page) {
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

export async function open(page, route) {
  // ?dev= is the form the app rewrites ?dev to (no navigation race). Going via about:blank forces a
  // real load even when only the hash changes, so seeded localStorage is read again.
  await page.goto('about:blank');
  await page.goto(`${BASE}/?dev=#/${route}`, { waitUntil: 'domcontentloaded' });
  await waitForStudio(page);
  await dismissOverlays(page);
  await page.evaluate(() => window.scrollTo(0, 0));
}

// Find the best visible control for a feature. Returns an element handle or null.
export async function findControl(page, feature, target) {
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
