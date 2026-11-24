// Records REAL walkthroughs of the real SmartVideo UI (Playwright screen recording, ?dev auth bypass, no keys, nothing generated, nothing billed).
// Usage: node scripts/record-tour.mjs video [image ...]      (studio keys from scripts/tour-steps.mjs)
// Output per studio: public/tour/<key>.mp4 (trimmed to start when the page is ready) + public/tour/<key>.json (step + event times in seconds).
// Safety: a step action whose target text matches DANGER (generate/create/delete/publish/send/buy/upload/download/export/record/apply/connect/...) is skipped.
// A fake cursor is injected (Playwright recordings do not draw the OS cursor): it follows real mouse events and pulses on mousedown.
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { STUDIOS } from './tour-steps.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const OUT = path.resolve(import.meta.dirname, '../public/tour');
fs.mkdirSync(OUT, { recursive: true });
const keys = process.argv.slice(2);
const WF = 0.55; // pace factor on waits/holds (a tour, not real-time)
const DANGER = /generate|create (?:landing|video|image)|delete|remove all|publish|send|buy|purchase|upload|download|export|record|apply|connect|sign|log ?in|pay|upgrade|subscribe|regenerate|open in render/i;

const HIDE = () => {
  const re = /\d+\+|\b\d+\s+(?:\w+\s+){0,2}(?:models?|tools?|methods?|examples?|apps?|features?|templates?|styles?|presets?|items?|voices?|languages?|cameras?|effects?|studios?)\b/i;
  const tail = /(\s*[·•]\s*\d+|\s*\(\d+\))\s*$/;
  const run = () => document.querySelectorAll('*').forEach((e) => {
    if (e.childElementCount !== 0) return;
    const t = (e.textContent || '').trim();
    if (t.length < 200 && (re.test(t) || (/^\d{1,3}$/.test(t) && parseFloat(getComputedStyle(e).fontSize) <= 13))) e.style.visibility = 'hidden';
    else if (tail.test(t)) e.textContent = t.replace(tail, '');
  });
  setInterval(run, 250);
  new MutationObserver(run).observe(document, { subtree: true, childList: true, characterData: true });
};
const CURSOR = () => {
  const mk = () => {
    if (document.getElementById('fake-cursor')) return;
    const c = document.createElement('div');
    c.id = 'fake-cursor';
    c.style.cssText = 'position:fixed;left:0;top:0;width:40px;height:40px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);transition:none';
    c.innerHTML = '<svg width="40" height="40" viewBox="0 0 24 24" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,.55))"><path d="M4.5 2.5 L4.5 19.2 L8.9 15 L11.9 21.6 L14.9 20.3 L11.9 13.8 L18.2 13.4 Z" fill="#fff" stroke="#050505" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    (document.body || document.documentElement).appendChild(c);
    const ring = document.createElement('div');
    ring.id = 'fake-ring';
    ring.style.cssText = 'position:fixed;left:0;top:0;width:70px;height:70px;border-radius:50%;border:3px solid #d9ff00;z-index:2147483646;pointer-events:none;opacity:0;transform:translate(-100px,-100px) scale(.3)';
    (document.body || document.documentElement).appendChild(ring);
    window.__track = window.__track || [];
    window.addEventListener('mousemove', (e) => { window.__track.push([performance.now(), e.clientX, e.clientY]); c.style.transform = `translate(${e.clientX - 4}px,${e.clientY - 3}px)`; }, true);
    window.addEventListener('mousedown', (e) => {
      c.firstChild.style.transform = 'scale(.84)'; c.firstChild.style.transformOrigin = '4px 3px';
      ring.style.transition = 'none'; ring.style.opacity = '.9'; ring.style.transform = `translate(${e.clientX - 35}px,${e.clientY - 35}px) scale(.3)`;
      requestAnimationFrame(() => { ring.style.transition = 'transform .5s ease-out, opacity .5s ease-out'; ring.style.opacity = '0'; ring.style.transform = `translate(${e.clientX - 35}px,${e.clientY - 35}px) scale(1.3)`; });
    }, true);
    window.addEventListener('mouseup', () => { c.firstChild.style.transform = 'scale(1)'; }, true);
  };
  document.addEventListener('DOMContentLoaded', mk);
  setInterval(mk, 500);
};

const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort', '--host', '127.0.0.1'], { cwd: path.resolve(import.meta.dirname, '../..'), stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:4173')).ok) break; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 1000)); }
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });

for (const key of keys) {
  const S = STUDIOS[key];
  if (!S) { console.log('unknown studio', key); continue; }
  const dir = path.join(OUT, `raw-${key}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'dark', recordVideo: { dir, size: { width: 1920, height: 1080 } } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('setup_popup_shown', '1'); } catch { /* ignore */ } });
  await ctx.addInitScript(HIDE);
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  const tPage = Date.now();
  const now = () => (Date.now() - tPage) / 1000;
  const meta = { key, title: S.title, blurb: S.blurb, steps: [], events: [], skipped: [], failed: [] };
  let mx = 960, my = 700;
  await page.goto(`http://127.0.0.1:4173/?dev=#/${S.route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(S.loadWait ?? 9000);
  await page.mouse.move(mx, my);
  meta.tReady = now();
  const p0 = await page.evaluate(() => performance.now());
  const target = async (sel) => (typeof sel === 'string' ? (sel.startsWith('ph:') ? page.getByPlaceholder(sel.slice(3)).first() : sel.startsWith('text:') ? page.getByText(sel.slice(5), { exact: false }).or(page.locator(`[aria-label*="${sel.slice(5)}" i],[title*="${sel.slice(5)}" i],[placeholder*="${sel.slice(5)}" i]`)).filter({ visible: true }).first() : page.locator(sel).first()) : null);
  const moveTo = async (sel, dwell = 350) => {
    const loc = await target(sel);
    const bb = await loc.boundingBox({ timeout: 4000 });
    if (!bb) throw new Error('no box');
    const x = Math.round(bb.x + bb.width / 2), y = Math.round(bb.y + bb.height / 2);
    await page.mouse.move(x, y, { steps: 28 });
    mx = x; my = y;
    await page.waitForTimeout(dwell);
    return { x, y, loc };
  };
  for (const step of S.steps) {
    meta.steps.push({ t: +now().toFixed(2), say: step.say, sub: step.sub || '' });
    for (const a of step.do) {
      try {
        const label = JSON.stringify(a).slice(0, 90);
        if (a.click || a.hover) {
          const sel = a.click || a.hover;
          if (DANGER.test(sel) && a.click) { meta.skipped.push(label); continue; }
          const { loc, x, y } = await moveTo(sel, a.dwell ?? 350);
          if (a.click) { meta.events.push({ t: +now().toFixed(2), kind: 'click', x, y }); await page.mouse.click(x, y); }
        } else if (a.type) {
          const { loc } = await moveTo(a.type.sel, 300);
          await page.mouse.click(mx, my);
          meta.events.push({ t: +now().toFixed(2), kind: 'click' });
          const t0 = now();
          await page.keyboard.type(a.type.text, { delay: (a.type.delay ?? 70) * 0.7 });
          meta.events.push({ t: +t0.toFixed(2), kind: 'type', dur: +(now() - t0).toFixed(2) });
        } else if (a.key) { await page.keyboard.press(a.key); }
        else if (a.scroll) {
          await page.evaluate((y) => { const e = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 100 && e.clientHeight > 500 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)).sort((x, z) => z.scrollHeight - x.scrollHeight)[0]; (e || window).scrollBy({ top: y, behavior: 'smooth' }); }, a.scroll);
        } else if (a.move) { await page.mouse.move(a.move[0], a.move[1], { steps: 30 }); mx = a.move[0]; my = a.move[1]; }
        else if (a.eval) { await page.evaluate(new Function(a.eval)); }
        await page.waitForTimeout((a.wait ?? 700) * WF);
      } catch (e) { meta.failed.push({ step: step.say, action: JSON.stringify(a).slice(0, 90), err: String(e).slice(0, 80) }); }
    }
    await page.waitForTimeout((step.hold ?? 1200) * WF);
  }
  await page.waitForTimeout(1500);
  meta.tEnd = +now().toFixed(2);
  const trk = await page.evaluate(() => window.__track || []);
  meta.track = []; let lastT = -1;
  for (const [pt, x, y] of trk) { const t = +(((pt - p0) / 1000) + meta.tReady).toFixed(2); if (t - lastT >= 0.06) { meta.track.push([t, Math.round(x), Math.round(y)]); lastT = t; } }
  await ctx.close();
  const webm = fs.readdirSync(dir).find((f) => f.endsWith('.webm'));
  const start = Math.max(0, meta.tReady - 0.4);
  const mp4 = path.join(OUT, `${key}.mp4`);
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(start), '-i', path.join(dir, webm), '-r', '30', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', mp4]);
  const shift = (t) => +(t - start).toFixed(2);
  meta.steps.forEach((s) => { s.t = shift(s.t); });
  meta.events.forEach((e) => { e.t = shift(e.t); });
  meta.track = meta.track.map(([t, x, y]) => [shift(t), x, y]).filter(([t]) => t >= 0);
  meta.duration = +(meta.tEnd - start).toFixed(2);
  fs.writeFileSync(path.join(OUT, `${key}.json`), JSON.stringify(meta, null, 1));
  fs.rmSync(dir, { recursive: true, force: true });
  const all = {}; for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith('.json'))) { const j = JSON.parse(fs.readFileSync(path.join(OUT, f))); all[j.key] = j; }
  fs.writeFileSync(path.resolve(import.meta.dirname, '../src/tour-data.json'), JSON.stringify(all));
  console.log(`${key}: ${meta.duration}s, ${meta.steps.length} steps, ${meta.events.length} events, skipped ${meta.skipped.length}, failed ${meta.failed.length}`);
  meta.failed.forEach((f) => console.log('   FAILED', f.step, '|', f.action, '|', f.err));
}
await browser.close();
srv.kill('SIGTERM');
process.exit(0);
