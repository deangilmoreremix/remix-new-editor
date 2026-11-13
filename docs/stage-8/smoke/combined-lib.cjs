// Shared helpers for the Stage 8 combined smoke (reuses the Stage 1 page-open helper; port via SMOKE_PORT).
const { chromium } = require('playwright');
const SP = (process.env.SMOKE_DIR || __dirname) + '/';
exports.SP = SP;
exports.launch = async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 950 }, acceptDownloads: true });
  const pg = await ctx.newPage();
  const cons = [];
  pg.on('console', (m) => { if (m.type() === 'error') cons.push(m.text().slice(0, 240)); });
  pg.on('pageerror', (e) => { cons.push('PAGEERR ' + String(e).slice(0, 300)); console.log('PAGEERR', String(e).slice(0, 300)); });
  await pg.addInitScript(() => { try { sessionStorage.setItem('setup_popup_shown', '1'); } catch {} });
  return { b, ctx, pg, cons };
};
const clickBtn = (pg, re) => pg.evaluate((s) => [...document.querySelectorAll('button')].find((x) => new RegExp(s, 'i').test(x.innerText))?.click(), re);
exports.clickBtn = clickBtn;
exports.goTimeline = async (pg, route = 'timeline') => {
  await pg.goto('http://127.0.0.1:' + (process.env.SMOKE_PORT || 3100) + '/#/' + route, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.pm-window', { timeout: 90000 });
  await pg.waitForTimeout(3000);
};
exports.newProject = async (pg, name) => {
  await pg.evaluate(() => [...document.querySelectorAll('.pm-bottombar__btn')].find((x) => x.innerText === 'New Project').click());
  await pg.waitForTimeout(800);
  await pg.fill('input[placeholder="Project name..."]', name);
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText === 'Create').click());
  await pg.waitForTimeout(6000);
};
exports.addVideo = async (pg, file) => {
  await clickBtn(pg, '^Add\\s*video');
  await pg.waitForSelector('[data-testid=add-video-file]', { state: 'attached', timeout: 8000 });
  await pg.setInputFiles('[data-testid=add-video-file]', file);
  await pg.waitForTimeout(5000);
  await pg.keyboard.press('Escape');
  await pg.evaluate(() => [...document.querySelectorAll('.element-modal__backdrop button')].find((x) => /×|close/i.test(x.innerText + x.getAttribute('aria-label')))?.click());
  await pg.waitForTimeout(500);
};
// read the saved project JSON back out of the web store (IndexedDB) so persistence is checked against the real saved bytes
exports.readStore = (pg) => pg.evaluate(() => new Promise((res, rej) => {
  const r = indexedDB.open('remix-cinegen-web', 1);
  r.onsuccess = () => { const db = r.result; const tx = db.transaction('kv', 'readonly'); const st = tx.objectStore('kv'); const keys = st.getAllKeys(); const vals = st.getAll();
    tx.oncomplete = () => { const o = {}; keys.result.forEach((k, i) => { o[k] = vals.result[i]; }); db.close(); res(o); }; tx.onerror = () => rej(tx.error); };
  r.onerror = () => rej(r.error);
}));
