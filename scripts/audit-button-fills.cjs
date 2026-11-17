/**
 * Lists every visible button on the app's main routes that has a fill (non-transparent background or a gradient)
 * or text too dark to read on the dark app. Exit code 1 when any are found.
 *
 *   npm run dev -- --port 5197          (in another terminal)
 *   BASE=http://127.0.0.1:5197/ node scripts/audit-button-fills.cjs
 *
 * Needs playwright and a Chromium: set CHROMIUM=/path/to/chromium if it is not at the default.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:5197/';
const OUT = process.env.OUT || 'button-fill-audit.json';
const NAV = (process.env.NAV || 'explore,image,video,cinema,storyboard,edit,upscale,character,commercial,apps,templates,brand,viral,avatar,audio,lipsync,photo-studio,personalizer,contacts,social').split(',');
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
    if (el.matches('[role=switch],[data-keep-fill]') || el.matches('[class*="overflow-hidden"], [class*="aspect-"]') || el.querySelector(':scope > video, :scope > canvas, :scope > picture, :scope > img[class*="object-cover"], :scope > div > img[class*="object-cover"]') || /background/.test(el.getAttribute('style') || '')) continue;
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
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const result = {};
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(9000);
  result['landing'] = await p.evaluate(probe);
  console.log('landing', result['landing'].length);
  await p.locator('header a, header button, nav a, nav button').filter({ hasText: /^Explore$/ }).first().click({ timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(12000);
  for (const name of NAV) {
    try {
      await p.evaluate((h) => { location.hash = '#/' + h }, name);
      await p.waitForTimeout(10000);
      result[name] = (await p.evaluate(probe)).concat(await p.evaluate(probeInline));
      
      console.log(name, result[name].length);
    } catch (e) { console.log(name, 'NAV FAIL', e.message.slice(0, 80)); }
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  await b.close();
  const total = Object.values(result).reduce((n, v) => n + v.length, 0);
  console.log(total ? `FOUND ${total} filled or unreadable buttons (see ${OUT})` : 'OK: no filled buttons');
  process.exit(total ? 1 : 0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
