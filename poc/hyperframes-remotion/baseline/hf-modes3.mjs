// Capture-only: import a sample clip into the NEW editor (ephemeral profile), place it on the timeline, export.
// Usage: SAMPLE=/abs/sample.mp4 BASE=http://127.0.0.1:3101 node baseline/new-import.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:3101'; const SAMPLE = process.env.SAMPLE; const out = 'out/modes3'; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH }); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 140)));
p.on('console', (m) => { if (m.type() === 'error') console.log('console.error', m.text().slice(0, 140)); });
const text = () => p.evaluate(() => document.body.innerText);
await p.addInitScript(() => { if (!sessionStorage.getItem('__hfinit')) { sessionStorage.setItem('__hfinit', '1'); localStorage.setItem('remix.hyperframes.v1', '1'); } });
const store = new Map(); const SAMPLE_BUF = (await import('node:fs')).readFileSync(process.env.SAMPLE);
await p.route('https://mock.supabase.co/**', async (route) => { const rq = route.request(); const u = new URL(rq.url()); const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  if (rq.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  const up = /^\/storage\/v1\/object\/uploads\/(.+)$/.exec(u.pathname);
  if (up && ['POST', 'PUT'].includes(rq.method())) { const buf = rq.postDataBuffer(); const ct = rq.headers()['content-type'] || ''; const bm = /boundary=(.+)$/.exec(ct); let data = buf; if (bm) { const str = buf.toString('latin1'); const st = str.indexOf('\r\n\r\n', str.indexOf('filename')) + 4; const en = str.lastIndexOf('\r\n--' + bm[1]); data = buf.subarray(st, en); } store.set(up[1], data); console.log('UPLOAD', up[1], buf.length, data.length, ct.slice(0, 60)); return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ Key: 'uploads/' + up[1] }) }); }
  const g = /^\/storage\/v1\/object\/public\/uploads\/(.+)$/.exec(u.pathname);
  if (g && store.has(g[1])) return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'video/mp4', 'accept-ranges': 'bytes' }, body: SAMPLE_BUF });
  return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: '{}' }); });
await p.goto(`${BASE}/#/timeline`, { waitUntil: 'load' });
for (let i = 0; i < 40 && !(await text()).includes('set up your API keys'); i++) await p.waitForTimeout(1000);
await p.evaluate(() => { const m = document.querySelector('div.fixed.inset-0.z-\\[100\\]'); [...(m?.querySelectorAll('button') || [])].find((x) => /Skip for now/.test(x.textContent))?.click(); }); await p.waitForTimeout(1500);
for (let i = 0; i < 60 && !/Project Manager|Projects/.test(await text()); i++) await p.waitForTimeout(2000);
await p.getByRole('button', { name: 'New Project' }).last().click(); await p.waitForTimeout(3500);
await p.getByPlaceholder('Project name...').fill('baseline-import'); await p.getByRole('button', { name: 'Create' }).click(); await p.waitForTimeout(4000);
await p.evaluate(() => { const el = [...document.querySelectorAll('button,[role=tab]')].find((e) => e.offsetParent && e.getBoundingClientRect().x > 90 && e.textContent.trim() === 'Edit'); el?.click(); });
await p.waitForTimeout(2500);
console.log('file inputs:', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('input[type=file]')].map((i) => ({ accept: i.accept, multiple: i.multiple })))));
await p.screenshot({ path: `${out}/00-edit-tab.png` });
await p.waitForTimeout(2000);
console.log('overlay-ish text:', JSON.stringify((await text()).split('\n').filter((l) => /overlay|motion|hyperframes|add/i.test(l)).slice(0, 20)));


const FLAG_ON = () => p.evaluate(() => localStorage.setItem('remix.hyperframes.v1', '1'));
const FLAG_OFF = () => p.evaluate(() => localStorage.removeItem('remix.hyperframes.v1'));
const goEdit = async () => { for (let i = 0; i < 40 && !/MEDIA POOL|Video 1/i.test(await text().catch(() => '')); i++) await p.waitForTimeout(3000); await p.evaluate(() => { const el = [...document.querySelectorAll('button,[role=tab]')].find((e) => e.offsetParent && e.getBoundingClientRect().x > 90 && e.textContent.trim() === 'Edit'); el?.click(); }); await p.waitForTimeout(3000); };
const addBlock = async (query, title) => {
  const sel = await p.evaluateHandle(() => [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => /HyperFrames/i.test(o.textContent))));
  const val = await sel.evaluate((s) => [...s.options].find((o) => /HyperFrames/i.test(o.textContent)).value);
  await sel.asElement().selectOption(val); await p.waitForTimeout(1500);
  const dlg = p.getByRole('dialog', { name: 'HyperFrames animations' });
  await dlg.getByRole('textbox').first().fill(query); await p.waitForTimeout(1000);
  await dlg.getByText(title, { exact: true }).first().click(); await p.waitForTimeout(4500);
  await p.getByRole('button', { name: /Add to timeline/i }).click(); await p.waitForTimeout(2500);
};
const panelInputs = () => p.locator('input').evaluateAll((els) => els.filter((e) => e.offsetParent && e.getBoundingClientRect().x > 1150).map((e) => e.value));
const setPanel = async (i, v) => { const h = (await p.locator('input').elementHandles()); const vis = []; for (const e of h) if (await e.evaluate((x) => x.offsetParent && x.getBoundingClientRect().x > 1150)) vis.push(e); await vis[i].fill(v); await vis[i].press('Tab'); await p.waitForTimeout(1500); };
const chips = () => p.getByText(/^(Lower Third — Clean Bar|Neon Border)$/, { exact: false }).filter({ visible: true });
const snapshot = () => p.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('remix-cinegen-web', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const rows = await new Promise((res) => { const tx = db.transaction('kv', 'readonly'); const st = tx.objectStore('kv'); const keys = st.getAllKeys(); const vals = st.getAll(); tx.oncomplete = () => res(keys.result.map((k, i) => [k, vals.result[i]])); });
  const out = [];
  const walk = (x, k) => { if (Array.isArray(x)) x.forEach((e) => walk(e, k)); else if (x && typeof x === 'object') { if (x.type === 'hyperframes' && x.blockId) out.push({ key: k, id: x.id, type: x.type, blockId: x.blockId, start: x.start, end: x.end, props: x.props, hfSchema: x.hfSchema }); else Object.values(x).forEach((e) => walk(e, k)); } };
  for (const [k, v] of rows) { if (typeof v !== 'string' || !v.includes('hyperframes')) continue; try { walk(JSON.parse(v), k); } catch { /* not json */ } }
  return out.filter((o) => o.type === 'hyperframes').sort((x, y) => String(x.id).localeCompare(String(y.id)));
});
const render = async (name, preset) => {
  await p.evaluate(() => { const el = [...document.querySelectorAll('button,[role=tab]')].find((e) => e.offsetParent && e.getBoundingClientRect().x > 90 && e.textContent.trim() === 'Export'); el?.click(); }); await p.waitForTimeout(2500);
  await p.getByText(preset, { exact: true }).click(); await p.waitForTimeout(800);
  const dl = p.waitForEvent('download', { timeout: 240000 }).catch(() => null);
  await p.evaluate(() => { const el = [...document.querySelectorAll('button')].find((e) => e.offsetParent && e.textContent.trim().toUpperCase() === 'RENDER'); el?.click(); });
  const d = await dl; if (d) { await d.saveAs(`${out}/${name}.mp4`); console.log('EXPORTED', name); } else console.log('EXPORT FAILED', name);
  await p.evaluate(() => { const el = [...document.querySelectorAll('button,[role=tab]')].find((e) => e.offsetParent && e.getBoundingClientRect().x > 90 && e.textContent.trim() === 'Edit'); el?.click(); }); await p.waitForTimeout(2500);
};


const toastText = () => p.evaluate(() => document.querySelector('.app-toast')?.innerText || '');
await addBlock('clean', 'Lower Third — Clean Bar');
console.log('toast after normal add:', JSON.stringify(await toastText()));
await p.evaluate(() => localStorage.setItem('remix.hyperframes.kill', '1'));
await setPanel(1, '4.5'); // nudge the overlay so the preview layer list is rebuilt with the kill switch on
let t = ''; for (let i = 0; i < 20 && !t; i++) { await p.waitForTimeout(1000); t = await toastText(); }
console.log('toast with kill switch on:', JSON.stringify(t));
await p.screenshot({ path: `${out}/kill-toast.png` });
await b.close();
