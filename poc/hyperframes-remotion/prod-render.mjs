// Renders catalog items through the PRODUCTION adapter inside the real sandboxed preview frame (/code-preview.html, opaque origin,
// its own CSP) and saves PNG stills over black at the requested times. Same protocol the editor uses (postMessage model + frame).
//   BASE=http://127.0.0.1:3101 SPEC=spec.json OUT=out/prod node prod-render.mjs
// spec.json: [{ id, blockId, durationSec, width, height, times:[...], overrides?:{}, hostHtml?: string }]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:3101'; const OUT = process.env.OUT || 'out/prod';
const spec = JSON.parse(readFileSync(process.env.SPEC, 'utf8')); const FPS = 30; const CONC = +(process.env.CONC || 2);
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: (process.env.CHROME_ARGS || '').split(' ').filter(Boolean) });
const results = []; let idx = 0;
async function worker() {
  while (idx < spec.length) {
    const s = spec[idx++]; const r = { id: s.id, frames: [], logs: [] };
    const ctx = await b.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: 1 }); const p = await ctx.newPage();
    p.on('console', (m) => { const t = m.text(); if (/\[hyperframes\]/.test(t) || process.env.ALLLOGS) r.logs.push(t.slice(0, 260)); });
    p.on('pageerror', (e) => { if (!/sandboxed|localStorage|sessionStorage/.test(e.message)) r.logs.push('pageerror ' + e.message.slice(0, 160)); });
    const guard = setTimeout(() => { r.fatal = 'timeout'; ctx.close().catch(() => {}); }, +(process.env.ITEM_MS || 100000));
    try {
      await p.route(`${BASE}/__hf_host`, (rt) => rt.fulfill({ contentType: 'text/html', body: `<body style="margin:0;background:#000"><script>window.__pwn=[];addEventListener('message',e=>{if(e.data&&e.data.pwn)window.__pwn.push(e.data.pwn)});window.__ready=new Promise(r=>addEventListener('message',e=>{if(e.data&&e.data.type==='preview-ready')r()}))</script><iframe id="f" sandbox="allow-scripts" src="${BASE}/code-preview.html" style="position:fixed;inset:0;width:100%;height:100%;border:0;background:transparent;color-scheme:light"></iframe></body>` }));
      if (process.env.TAMPER) await p.route(new RegExp(process.env.TAMPER), async (rt) => { const res = await rt.fetch(); await rt.fulfill({ response: res, body: Buffer.concat([await res.body(), Buffer.from('\n<!-- tampered -->')]) }); });
      await p.goto(`${BASE}/__hf_host`);
      await p.evaluate(() => new Promise((res, rej) => { window.__ready.then(res); setTimeout(() => rej(new Error('preview never became ready')), 40000); }));
      const dur = Math.max(1, Math.ceil(s.durationSec * FPS));
      const layer = { id: 'L1', kind: 'hyperframes', trackIndex: 99, from: 0, durationInFrames: dur, effects: [], blockId: s.blockId, overrides: s.overrides || {}, blockWidth: s.width, blockHeight: s.height, title: s.id, ...(s.extra || {}), ...(s.hostHtml ? { hostHtml: s.hostHtml } : {}) };
      await p.evaluate(([model]) => { window.__errs = []; window.addEventListener('message', (e) => { if (e.data?.type === 'code-error') window.__errs.push(e.data.message); }); document.getElementById('f').contentWindow.postMessage({ type: 'model', model }, '*'); },
        [{ version: 1, fps: FPS, width: s.width, height: s.height, durationInFrames: dur, background: 'transparent', layers: [layer], audio: [], transitions: [], fonts: [] }]);
      await p.waitForTimeout(+(process.env.MOUNT_MS || 3500));
      mkdirSync(`${OUT}/${s.id}`, { recursive: true });
      for (const t of s.times) {
        await p.evaluate((f) => document.getElementById('f').contentWindow.postMessage({ type: 'frame', frame: f }, '*'), Math.round(t * FPS));
        await p.waitForTimeout(+(process.env.SEEK_MS || 1200));
        await p.screenshot({ path: `${OUT}/${s.id}/t${t}.png` }); r.frames.push(t);
      }
      if (process.env.DISCOVER) { // list text leaves of the composed DOM (ids stamped by the adapter) for the editable-field analysis
        const fr = p.frames().find((f) => /code-preview/.test(f.url()));
        r.leaves = await fr.evaluate(() => [...document.querySelectorAll('[data-hf-id]')].filter((e) => !e.children.length && !['SCRIPT', 'STYLE'].includes(e.tagName)).map((e) => ({ hfId: e.getAttribute('data-hf-id'), text: e.textContent.trim() })).filter((x) => x.text.length >= 2 && x.text.length <= 60).slice(0, 40));
      }
      r.codeErrors = await p.evaluate(() => window.__errs); r.pwn = await p.evaluate(() => window.__pwn);
    } catch (e) { r.fatal = String(e).slice(0, 200); }
    clearTimeout(guard); await ctx.close().catch(() => {}); r.logs = [...new Set(r.logs)].slice(0, 5); results.push(r); console.log(JSON.stringify({ id: r.id, n: r.frames.length, logs: r.logs, codeErrors: r.codeErrors, pwn: r.pwn, fatal: r.fatal }));
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
writeFileSync(`${OUT}/results${process.env.TAG || ''}.json`, JSON.stringify(results, null, 1));
await Promise.race([b.close(), new Promise((r) => setTimeout(r, 5000))]); process.exit(0);
