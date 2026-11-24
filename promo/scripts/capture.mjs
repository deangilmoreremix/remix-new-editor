// Capture real SmartVideo studio states as 2x textures + layout.json.
// Starts `vite preview` itself (it dies between shell commands), uses ?dev auth bypass (no keys, nothing billed).
// Never clicks generate/create/delete/publish/send/buy/upload/download/export/record/apply/connect.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '../..');
const OUT = path.resolve(import.meta.dirname, '../public/textures/live');
const LAYOUT = path.resolve(import.meta.dirname, '../src/live-layout.json');
const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const PROMPT = process.env.PROMPT || 'A lone cyclist crosses a neon-lit bridge at dusk, cinematic slow push-in';
const DANGER = /generate|create|delete|publish|send|buy|purchase|upload|download|export|record|apply|connect|sign|log ?in|pay|upgrade|subscribe/i;
const seeds = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'seeds.json'), 'utf8'));
const STATES = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'states.json'), 'utf8'));

// Injected into every page: hides product count badges ("15+ models" etc: the app disagrees with itself on counts),
// toasts and the Ask panel. Counts shown in the video come from code, never from these badges.
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
  const st = document.createElement('style');
  st.textContent = '[class*="toast"],[id*="toast"],vite-error-overlay,[data-ask]{display:none!important}';
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st));
};

const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: REPO, stdio: 'ignore' });
const stop = () => { try { srv.kill('SIGTERM'); } catch { /* already gone */ } };
process.on('exit', stop);
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(BASE); if (r.ok) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 1000));
}

const browser = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'], headless: true });
fs.mkdirSync(OUT, { recursive: true });
let layout = {};
try { layout = JSON.parse(fs.readFileSync(LAYOUT, 'utf8')); } catch { /* first run */ }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const st of STATES) {
  if (ONLY.length && !ONLY.includes(st.name)) continue;
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: st.vh || 1080, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument(() => { try { sessionStorage.setItem('setup_popup_shown', '1'); } catch { /* ignore */ } });
  await page.evaluateOnNewDocument(HIDE);
  const entry = { route: st.route, boxes: {}, cutouts: [] };
  try {
    await page.goto(`${BASE}/?dev=#/${st.route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => (document.getElementById('content-area') || document.body).innerText.length > 150, { timeout: 40000 }).catch(() => {});
    if (st.seed) {
      await page.evaluate(new Function(seeds[st.seed]));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.body.innerText.length > 150, { timeout: 40000 }).catch(() => {});
    }
    await sleep(st.wait ?? 9000);
    for (const step of st.steps || []) {
      if (step.eval) await page.evaluate(new Function(step.eval));
      if (step.frameEval) {
        for (const fr of page.frames()) { try { await fr.evaluate(new Function(step.frameEval)); } catch { /* frame not ready */ } }
      }
      if (step.frameType) {
        // input lives inside an iframe (Video Agent): find it in any frame, type with the keyboard, and measure glyph widths in that frame
        let done = false;
        for (const fr of page.frames()) {
          const h = await fr.$(step.frameType);
          if (!h) continue;
          const bb = await h.boundingBox();
          if (!bb || bb.width < 50) continue;
          await h.click();
          await page.keyboard.type(step.text || PROMPT, { delay: 4 });
          entry.measure = await fr.evaluate((sel, text, bx, by, bh, bw) => {
            const t = document.querySelector(sel); const cs = getComputedStyle(t);
            const c = document.createElement('canvas').getContext('2d'); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
            return { x0: bx + parseFloat(cs.paddingLeft || '0'), y: by, h: bh, w: bw, font: c.font, offsets: [...text].map((_, i) => c.measureText(text.slice(0, i + 1)).width) };
          }, step.frameType, step.text, bb.x, bb.y, bb.height, bb.width);
          console.log('  frame input found', Math.round(bb.x), Math.round(bb.y), Math.round(bb.width), Math.round(bb.height));
          done = true;
          break;
        }
        if (!done) console.log('  frameType miss', step.frameType);
      }
      if (step.type) {
        const h = await page.$(step.type);
        if (h) { await h.click(); await page.keyboard.type(step.text || PROMPT, { delay: 4 }); } else console.log('  type miss', step.type);
      }
      if (step.click) {
        if (DANGER.test(step.click)) { console.log('SKIP dangerous', step.click); continue; }
        if (step.click.startsWith('text:')) {
          const want = step.click.slice(5);
          const ok = await page.evaluate((w) => {
            const el = [...document.querySelectorAll('button,[role=button],[role=tab],div,span,a')]
              .filter((e) => e.getBoundingClientRect().width > 0 && (e.innerText || '').trim() === w)
              .sort((a, b) => a.innerText.length - b.innerText.length)[0];
            if (el) { el.click(); return true; }
            return false;
          }, want);
          if (!ok) console.log('  click miss', want);
        } else {
          const h = await page.$(step.click);
          if (h) await h.click(); else console.log('  click miss', step.click);
        }
      }
      await sleep(step.wait ?? 1200);
    }
    if (st.measure) {
      // cumulative text width per character (same font as the real textarea) so Remotion can reveal typing exactly
      entry.measure = await page.evaluate((sel, text) => {
        const t = document.querySelector(sel); const cs = getComputedStyle(t); const r = t.getBoundingClientRect();
        const c = document.createElement('canvas').getContext('2d'); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        return { x0: r.x + parseFloat(cs.paddingLeft || '0'), y: r.y, h: r.height, w: r.width, font: c.font, offsets: [...text].map((_, i) => c.measureText(text.slice(0, i + 1)).width) };
      }, st.measure.selector, st.measure.text);
    }
    entry.pageH = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({ path: `${OUT}/${st.name}-full.png`, fullPage: !!st.vh });
    for (const b of st.boxes || []) {
      entry.boxes[b.key] = await page.evaluate((sel, all) => {
        const m = (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
        const els = [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().width > 0);
        return all ? els.slice(0, 60).map(m) : els[0] ? m(els[0]) : null;
      }, b.selector, !!b.all);
    }
    for (const c of st.cutouts || []) {
      let els = await page.$$(c.selector);
      for (let u = 0; u < (c.up || 0); u++) {
        const parents = [];
        for (const e of els) {
          const h = await e.evaluateHandle((n) => n.parentElement);
          if (h.asElement()) parents.push(h.asElement());
        }
        els = parents;
      }
      const vis = [];
      for (const e of els) { const bb = await e.boundingBox(); if (bb && bb.width > 20 && bb.height > 20) vis.push(e); }
      const picked = c.all ? vis.slice(0, c.max ?? 12) : vis.slice(0, 1);
      for (let i = 0; i < picked.length; i++) {
        const file = c.all ? `${st.name}-${c.name}${i + 1}.png` : `${st.name}-${c.name}.png`;
        try {
          const bb = await picked[i].boundingBox();
          await picked[i].screenshot({ path: `${OUT}/${file}`, omitBackground: !!c.omitBackground });
          entry.cutouts.push({ file, x: bb.x, y: bb.y, w: bb.width, h: bb.height });
        } catch (e) { console.log('  cutout miss', file, e.message.slice(0, 60)); }
      }
    }
    entry.countText = await page.evaluate(() => {
      const re = /\d+\+|\(\d+\)\s*$|[·•]\s*\d+\s*$|\b\d+\s+(?:\w+\s+){0,2}(?:models?|tools?|methods?|examples?|apps?|features?|templates?|styles?|presets?|items?|voices?|languages?|cameras?|effects?|studios?)\b/i;
      return [...document.querySelectorAll('*')].filter((e) => e.childElementCount === 0 && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0 && re.test((e.textContent || '').trim())).map((e) => e.textContent.trim().slice(0, 40));
    });
    console.log('ok', st.name, 'cutouts', entry.cutouts.length, entry.countText.length ? 'COUNTS:' + JSON.stringify(entry.countText.slice(0, 4)) : '');
  } catch (e) { console.log('ERR', st.name, String(e).slice(0, 120)); }
  layout[st.name] = entry;
  await page.close();
}
fs.writeFileSync(LAYOUT, JSON.stringify(layout, null, 1));
await browser.close();
stop();
process.exit(0);
