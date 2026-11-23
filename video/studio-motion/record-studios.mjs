// Real-motion recordings of every studio: safe interactions only, no generation. Counts hidden (no claims yet).
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { TARGETS, DANGEROUS } = await import('/home/user/remix-new-editor/tests/e2e/guide-screenshot-targets.js');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const studios = JSON.parse(fs.readFileSync(path.join(HERE, 'studios.json'), 'utf8'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const BASE = process.env.BASE || 'http://127.0.0.1:4173';
const CONC = Number(process.env.CONC || 3);
const PROMPT = 'A cinematic product shot on a marble pedestal, soft studio light';

const HIDE = () => {
  const re = /\d+\+|\b\d+\s+(?:\w+\s+){0,2}(?:models?|tools?|methods?|examples?|apps?|features?|templates?|styles?|presets?|items?|voices?|languages?|cameras?|effects?|studios?)\b/i;
  const tail = /(\s*[·•]\s*\d+|\s*\(\d+\))\s*$/;
  const run = () => document.querySelectorAll('*').forEach((e) => {
    if (e.childElementCount !== 0) return;
    const t = (e.textContent || '').trim();
    if (t.length < 200 && (re.test(t) || (/^\d{1,3}$/.test(t) && parseFloat(getComputedStyle(e).fontSize) <= 13))) e.style.visibility = 'hidden';
    else if (tail.test(t)) e.textContent = t.replace(tail, '');
  });
  setInterval(run, 250); new MutationObserver(run).observe(document, { subtree: true, childList: true, characterData: true });
};
const SCAN = () => {
  const re = /\d+\+|\(\d+\)\s*$|[·•]\s*\d+\s*$|\b\d+\s+(?:\w+\s+){0,2}(?:models?|tools?|methods?|examples?|apps?|features?|templates?|styles?|presets?|items?|voices?|languages?|cameras?|effects?|studios?)\b/i;
  return [...document.querySelectorAll('*')].filter((e) => e.childElementCount === 0 && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0 && re.test((e.textContent || '').trim())).map((e) => e.textContent.trim().slice(0, 50));
};
const scrollMain = (p, y) => p.evaluate((y) => { const e = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 100 && e.clientHeight > 500 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)).sort((a, b) => b.scrollHeight - a.scrollHeight)[0]; if (e) e.scrollBy({ top: y, behavior: 'smooth' }); }, y);

function safeClicks(slug) {
  const t = TARGETS[slug] || {}; const out = [];
  for (const [k, v] of Object.entries(t)) {
    if (k === '__overview' || !v || v.skip || v.setup || v.route) continue;
    if (v.click && v.text && !DANGEROUS.test(v.text)) out.push(v.text);
    for (const s of v.steps || []) if (s.text && !DANGEROUS.test(s.text)) out.push(s.text);
  }
  return [...new Set(out)].slice(0, 3);
}

async function record(browser, s) {
  const dir = path.join(HERE, 'raw', s.route); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'dark', bypassCSP: true, recordVideo: { dir, size: { width: 1920, height: 1080 } } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('setup_popup_shown', '1'); } catch {} });
  await ctx.addInitScript(HIDE);
  const p = await ctx.newPage(); const T0 = Date.now(); const now = () => +((Date.now() - T0) / 1000).toFixed(2);
  const meta = { route: s.route, slug: s.slug, name: s.name, ok: false, did: [], violations: [] };
  try {
    await p.goto('about:blank'); await p.goto(`${BASE}/?dev=#/${s.route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForFunction(() => (document.getElementById('content-area') || document.body).innerText.length > 150, null, { timeout: 40000 }).catch(() => {});
    await p.waitForTimeout(7000);
    meta.tReady = now(); meta.textLen = (await p.innerText('body').catch(() => '')).length;
    // 1) cursor drift
    await p.mouse.move(500, 380); await p.mouse.move(1300, 560, { steps: 45 }); meta.did.push('cursor');
    // 2) type a prompt (never submit); skip the global assistant box
    const ta = p.locator('textarea:visible').filter({ hasNot: p.locator('[data-ask]') });
    const n = await ta.count();
    for (let i = 0; i < n; i++) {
      const ph = (await ta.nth(i).getAttribute('placeholder')) || '';
      if (/^ask\b/i.test(ph)) continue;
      await ta.nth(i).click({ timeout: 3000 }).catch(() => {}); await ta.nth(i).pressSequentially(PROMPT, { delay: 38 }).catch(() => {}); meta.did.push('typed:' + ph.slice(0, 30)); break;
    }
    // 3) harness-approved safe clicks (tabs, dropdowns, panels)
    for (const text of safeClicks(s.slug)) {
      const el = p.getByText(text, { exact: false }).filter({ visible: true }).first();
      if (await el.count().catch(() => 0)) { await el.click({ timeout: 2500 }).catch(() => {}); await p.waitForTimeout(1100); meta.did.push('click:' + text); }
    }
    // 4) hover tour over real cards/buttons (hover states are visible; never clicked)
    const targets = await p.evaluate((danger) => {
      const re = new RegExp(danger, 'i'); const out = [];
      for (const e of document.querySelectorAll('a,button,[role=button],[role=tab],img,.card,[class*=card]')) {
        const r = e.getBoundingClientRect(); if (r.width < 70 || r.height < 36 || r.top < 130 || r.bottom > 1050 || r.left < 80 || r.right > 1880) continue;
        const t = (e.innerText || e.getAttribute('aria-label') || '').trim(); if (re.test(t) && t.length < 40) continue;
        const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
        if (out.every((o) => Math.hypot(o.x - cx, o.y - cy) > 260)) out.push({ x: cx, y: cy });
        if (out.length >= 5) break;
      }
      return out;
    }, DANGEROUS.source);
    for (const t of targets) { await p.mouse.move(t.x, t.y, { steps: 22 }); await p.waitForTimeout(650); }
    if (targets.length) meta.did.push('hover:' + targets.length);
    // 5) scroll down and back (window and inner scroller)
    await p.evaluate(() => window.scrollBy({ top: 600, behavior: 'smooth' })); await scrollMain(p, 700); await p.waitForTimeout(1600);
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await scrollMain(p, -700); await p.waitForTimeout(1200); meta.did.push('scroll');
    meta.violations = await p.evaluate(SCAN).catch(() => []);
    meta.tEnd = now(); meta.ok = true;
  } catch (e) { meta.err = String(e).slice(0, 160); meta.tEnd = now(); }
  await ctx.close();
  const f = fs.readdirSync(dir).find((x) => x.endsWith('.webm')); if (f) fs.renameSync(path.join(dir, f), path.join(dir, 'rec.webm'));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 1));
  console.log(`${meta.ok ? 'ok ' : 'ERR'} ${s.route.padEnd(22)} ready=${meta.tReady} end=${meta.tEnd} did=${meta.did.join(',')}${meta.violations.length ? ' VIOL=' + JSON.stringify(meta.violations.slice(0, 3)) : ''}${meta.err ? ' ' + meta.err : ''}`);
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const queue = studios.filter((s) => !ONLY.length || ONLY.includes(s.route));
await Promise.all(Array.from({ length: CONC }, async () => { while (queue.length) await record(browser, queue.shift()); }));
await browser.close(); console.log('RECORD_DONE');
