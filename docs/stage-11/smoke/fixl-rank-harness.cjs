/* Real-CLIP ranking harness. env: SMOKE_PORT, VIDEO, OUT(json), QUERIES (json array, optional), DUMP=1 to dump raw vectors for extra prompts */
const path = require('path'); const fs = require('fs');
const { chromium } = require('playwright');
const L = require('../../stage-8/smoke/combined-lib.cjs');
const PROFILE = process.env.PROFILE || '/tmp/fixl-chromium-profile';
const dom = (pg, sel) => pg.evaluate((q) => document.querySelector(q).click(), sel);
const statusOf = (pg, id) => pg.locator(`[data-testid="ai-status-${id}"]`).innerText();
async function install(pg, id) {
  const isInst = (t) => /installed/.test(t) && !/not installed/.test(t);
  if (isInst(await statusOf(pg, id))) return;
  await dom(pg, `[data-testid="ai-download-${id}"]`); await dom(pg, `[data-testid="ai-accept-${id}"]`);
  await pg.waitForFunction(([i]) => { const t = document.querySelector(`[data-testid="ai-status-${i}"]`)?.textContent || ''; return /installed/.test(t) && !/not installed/.test(t); }, [id], { timeout: 600000 });
}
const openDock = async (pg, tab) => {
  if (!(await pg.locator(`[data-testid=${tab}]`).count())) { await dom(pg, '[data-testid=s4-open]'); await pg.waitForSelector(`[data-testid=${tab}]`, { timeout: 20000 }); }
  await dom(pg, `[data-testid=${tab}]`);
};
(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, { executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', headless: true, viewport: { width: 1600, height: 950 }, acceptDownloads: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = ctx.pages()[0] || await ctx.newPage();
  pg.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 300)));
  await pg.addInitScript(() => { try { sessionStorage.setItem('setup_popup_shown', '1'); } catch {}
    window.__workers = []; const o = Worker.prototype.postMessage; window.__lastEmbedText = null;
    Worker.prototype.postMessage = function (m, ...r) { try { if (!window.__workers.includes(this)) window.__workers.push(this); if (m && m.type === 'embed-text') window.__lastEmbedText = m; window.__lastEmbedWorker = this; } catch {} return o.call(this, m, ...r); }; });
  await L.goTimeline(pg); await L.newProject(pg, 'rank-' + Date.now().toString(36));
  try { await L.addVideo(pg, process.env.VIDEO); } catch (e) { await pg.screenshot({ path: 'fail.png' }); throw e; }
  await openDock(pg, 's4-tab-ai'); await pg.waitForSelector('[data-testid=local-ai-panel]');
  await install(pg, 'clip-vit-b32');
  await openDock(pg, 's4-tab-scenes');
  await dom(pg, '[data-testid=scene-detect]'); await pg.waitForFunction(() => /scenes? found/.test(document.querySelector('[data-testid=scene-msg]')?.textContent || ''), null, { timeout: 120000 });
  console.log('detect:', await pg.locator('[data-testid=scene-msg]').innerText());
  await dom(pg, '[data-testid=scene-index]'); await pg.waitForFunction(() => /Visual search ready/.test(document.querySelector('[data-testid=scene-msg]')?.textContent || ''), null, { timeout: 240000 });
  console.log('index:', await pg.locator('[data-testid=scene-msg]').innerText());
  const labels = (process.env.LABELS || 'beach_book,city,tiger,football').split(',');
  const cards = async () => pg.locator('[data-testid=scene-card]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').slice(0, 90)));
  const result = { scenes: await cards(), queries: {} };
  const queries = JSON.parse(process.env.QUERIES || '["a city street with buildings","a tiger","a beach","a football match"]');
  for (const q of queries) {
    await pg.locator('[data-testid=scene-search]').fill(''); await pg.waitForTimeout(300);
    await pg.locator('[data-testid=scene-search]').fill(q); await pg.waitForTimeout(4000);
    const order = await pg.locator('[data-testid=scene-card]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')));
    result.queries[q] = order; console.log('Q', JSON.stringify(q), '->', JSON.stringify(order.map((t) => t.slice(0, 70))));
  }
  if (process.env.DUMP) {
    const prompts = JSON.parse(fs.readFileSync(process.env.DUMP, 'utf8'));
    const dump = await pg.evaluate(async (prompts) => {
      const w = window.__lastEmbedWorker; const model = window.__lastEmbedText.model; const out = {};
      const ask = (msg) => new Promise((res) => { const h = (e) => { if (e.data && e.data.id === msg.id && e.data.type === 'vectors') { w.removeEventListener('message', h); res(e.data.vectors.map((v) => Array.from(v))); } }; w.addEventListener('message', h); w.postMessage(msg); });
      for (let i = 0; i < prompts.length; i += 16) { const part = prompts.slice(i, i + 16); const v = await ask({ type: 'embed-text', id: 900000 + i, model, texts: part }); part.forEach((p, k) => { out[p] = v[k]; }); }
      const rows = await new Promise((res) => { const r = indexedDB.open('cinegen-scene-vectors'); r.onsuccess = () => { const q = r.result.transaction('vectors').objectStore('vectors').getAll(); q.onsuccess = () => res(q.result.map((x) => ({ id: x.id, vec: Array.from(x.vec) }))); }; });
      return { text: out, images: rows };
    }, prompts);
    fs.writeFileSync(process.env.OUT_DUMP || 'dump.json', JSON.stringify(dump));
    console.log('dumped', Object.keys(dump.text).length, 'prompts,', dump.images.length, 'image vectors');
  }
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(result, null, 1));
  await ctx.close(); process.exit(0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
