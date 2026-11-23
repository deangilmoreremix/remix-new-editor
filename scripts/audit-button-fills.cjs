/* global process, console, document, getComputedStyle, location */
/**
 * Lists every visible button on the app's main routes that has a fill (non-transparent background or a gradient)
 * or text too dark to read on the dark app. Exit code 1 when any are found.
 *
 *   npm run dev -- --port 5197          (in another terminal)
 *   BASE=http://127.0.0.1:5197/ node scripts/audit-button-fills.cjs
 *
 * Needs Playwright with a Chromium (`npx playwright install chromium`), or set CHROMIUM=/path/to/chromium.
 * AUDIT_BUDGET_MS (default 10 minutes) bounds the whole run: exit code 2 if it runs out before every route is read.
 */
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('playwright-core')); }
const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:5197/';
const OUT = process.env.OUT || 'button-fill-audit.json';
const NAV = (process.env.NAV || 'explore,image,video,cinema,storyboard,edit,upscale,character,commercial,apps,templates,brand,muapi-studio,viral,avatar,audio,lipsync,photo-studio,personalizer,contacts,social').split(',');
const probeInline = () => {
  const out = [];
  for (const el of document.querySelectorAll('button[style*="background"], [role=button][style*="background"]')) {
    const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.height > 90) continue;
    const cs = getComputedStyle(el); const text = (el.innerText || el.getAttribute('aria-label') || '').trim();
    if (!text || /swatch|color/i.test(typeof el.className === 'string' ? el.className : '')) continue;
    const bgc = cs.backgroundColor; if (bgc === 'rgba(0, 0, 0, 0)' && cs.backgroundImage === 'none') continue;
    out.push({ tag: 'button[inline]', cls: (typeof el.className === 'string' ? el.className : '').split(/\s+/).slice(0, 4).join('.'), id: el.id || '', text: text.slice(0, 28), bg: cs.backgroundImage !== 'none' ? cs.backgroundImage.slice(0, 40) : bgc, w: Math.round(r.width) });
  }
  return out;
};
const probe = () => {
  const SKIP = /swatch|color-chip|colour|palette|avatar|thumb-dot|progress|slider|switch-track|indicator/i;
  const sel = 'button, [role=button], [role=tab], [role=radio], a[class*=btn], a[class*=button], input[type=button], input[type=submit], summary, label[class*=btn]';
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    if (el.matches('[role=switch],[data-keep-fill],[style*="background"]:empty') || /background-image/.test(el.getAttribute('style') || '') || el.querySelector(':scope > video, :scope > canvas, :scope > picture, :scope > img[class*="object-cover"], :scope > div > img[class*="object-cover"]')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const cls = typeof el.className === 'string' ? el.className : '';
    if (SKIP.test(cls) || el.getAttribute('role') === 'switch') continue;
    const bgc = cs.backgroundColor;
    let alpha = 0;
    if (bgc && bgc !== 'transparent') {
      const slash = bgc.match(/\/\s*([\d.]+%?)\s*\)/);
      if (slash) alpha = slash[1].endsWith('%') ? parseFloat(slash[1]) / 100 : parseFloat(slash[1]);
      else { const m = bgc.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(',').map(x => parseFloat(x)); alpha = p.length === 4 ? p[3] : 1; } else alpha = 1; }
    }
    const img = cs.backgroundImage !== 'none';
    let invisible = false;
    if (alpha <= 0.015 && !img) {
      const c = document.createElement('canvas'); c.width = c.height = 1; const g = c.getContext('2d', { willReadFrequently: true });
      g.clearRect(0, 0, 1, 1); g.fillStyle = '#000'; g.fillStyle = cs.color; g.fillRect(0, 0, 1, 1);
      const [R, G, B, A] = g.getImageData(0, 0, 1, 1).data;
      const lum = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255;
      invisible = A > 20 && lum < 0.3;
    }
    if (invisible && (el.innerText || '').trim()) out.push({ tag: el.tagName.toLowerCase(), cls: 'INVISIBLE-TEXT ' + (typeof el.className === 'string' ? el.className : '').split(/\s+/).slice(0, 6).join('.'), id: '', text: (el.innerText || '').trim().slice(0, 28), bg: cs.color, w: Math.round(r.width) });
    if (alpha > 0.015 || img) {
      out.push({ tag: el.tagName.toLowerCase(), cls: cls.split(/\s+/).filter(Boolean).slice(0, 8).join('.'), id: el.id || '', text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 28), bg: img ? cs.backgroundImage.slice(0, 40) : cs.backgroundColor, w: Math.round(r.width) });
    }
  }
  return out;
};
/** Waits until the page has rendered: the number of buttons is non-zero and stops changing for ~2 seconds (max 30s). */
async function settle(p, maxMs = 30000) {
  const end = Date.now() + maxMs;
  let last = -1, steady = 0;
  while (Date.now() < end) {
    const n = await p.evaluate(() => document.querySelectorAll('button, [role=button]').length).catch(() => -1);
    steady = n === last && n > 0 ? steady + 1 : 0;
    if (steady >= 4) return true;
    last = n;
    await p.waitForTimeout(500);
  }
  return false;
}
(async () => {
  const launch = { args: ['--no-sandbox'] };
  if (process.env.CHROMIUM) launch.executablePath = process.env.CHROMIUM;
  const b = await chromium.launch(launch);
  const deadline = Date.now() + (Number(process.env.AUDIT_BUDGET_MS) || 10 * 60 * 1000);
  let incomplete = false;
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const result = {};
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await settle(p);
  result['landing'] = await p.evaluate(probe);
  console.log('landing', result['landing'].length);
  await p.locator('header a, header button, nav a, nav button').filter({ hasText: /^Explore$/ }).first().click({ timeout: 8000 }).catch(() => {});
  await settle(p);
  for (const name of NAV) {
    if (Date.now() > deadline) { incomplete = true; console.log('Out of time before', name); break; }
    try {
      await p.evaluate((h) => { location.hash = '#/' + h }, name);
      await settle(p);
      result[name] = (await p.evaluate(probe)).concat(await p.evaluate(probeInline));
      
      console.log(name, result[name].length);
    } catch (e) { console.log(name, 'NAV FAIL', e.message.slice(0, 80)); }
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  await b.close();
  const total = Object.values(result).reduce((n, v) => n + v.length, 0);
  console.log(total ? `FOUND ${total} filled or unreadable buttons (see ${OUT})` : incomplete ? 'No filled buttons in the routes read, but the run was incomplete' : 'OK: no filled buttons');
  process.exit(total ? 1 : incomplete ? 2 : 0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
