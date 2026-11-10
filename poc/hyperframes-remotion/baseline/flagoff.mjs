// Capture-only: import a sample clip into the NEW editor (ephemeral profile), place it on the timeline, export.
// Usage: SAMPLE=/abs/sample.mp4 BASE=http://127.0.0.1:3101 node baseline/new-import.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:3101'; const SAMPLE = process.env.SAMPLE; const out = 'out/cmp/' + process.env.TAG; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH }); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 140)));
p.on('console', (m) => { if (m.type() === 'error') console.log('console.error', m.text().slice(0, 140)); });
const text = () => p.evaluate(() => document.body.innerText);
await p.goto(`${BASE}/#/timeline`, { waitUntil: 'load' });
for (let i = 0; i < 40 && !(await text()).includes('set up your API keys'); i++) await p.waitForTimeout(1000);
await p.mouse.click(883, 75); await p.waitForTimeout(1500);
for (let i = 0; i < 60 && !/Project Manager|Projects/.test(await text()); i++) await p.waitForTimeout(2000);
await p.getByRole('button', { name: 'New Project' }).last().click(); await p.waitForTimeout(3500);
await p.getByPlaceholder('Project name...').fill('baseline-import'); await p.getByRole('button', { name: 'Create' }).click(); await p.waitForTimeout(4000);
await p.evaluate(() => { const el = [...document.querySelectorAll('button,[role=tab]')].find((e) => e.offsetParent && e.getBoundingClientRect().x > 90 && e.textContent.trim() === 'Edit'); el?.click(); });
await p.waitForTimeout(2500);
console.log('file inputs:', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('input[type=file]')].map((i) => ({ accept: i.accept, multiple: i.multiple })))));
await p.screenshot({ path: `${out}/00-edit-tab.png` });
// The import icon (bottom-left of the media pool) opens a native chooser; no <input type=file> exists in the DOM.
const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null), p.mouse.click(18, 854)]);
console.log('file chooser opened:', !!fc);
if (fc) await fc.setFiles(SAMPLE);
for (let i = 0; i < 60; i++) { const t = await text().catch(() => ''); if (/MEDIA POOL/i.test(t) || /Project Manager/.test(t)) break; await p.waitForTimeout(2000); }
await p.waitForTimeout(3000);
for (let i = 0; i < 40 && !/MEDIA POOL|Video 1/i.test(await text().catch(() => '')); i++) await p.waitForTimeout(3000);
await p.evaluate(() => { const el = [...document.querySelectorAll('button,[role=tab]')].find((e) => e.offsetParent && e.getBoundingClientRect().x > 90 && e.textContent.trim() === 'Edit'); el?.click(); }); await p.waitForTimeout(3000);
console.log('url after import:', p.url());
await p.screenshot({ path: `${out}/01-after-import.png` });
console.log('pool text:', JSON.stringify((await text()).split('\n').filter((l) => /sample|\.mp4|clips|assets/i.test(l)).slice(0, 8)));
// Place the clip: drag the pool asset onto the Video 1 track with real mouse events.
await p.mouse.move(176, 146); await p.mouse.down(); await p.mouse.move(260, 300, { steps: 8 }); await p.mouse.move(470, 690, { steps: 14 }); await p.mouse.move(+(process.env.DROP_X || 445), 698, { steps: 4 }); await p.mouse.up();
await p.waitForTimeout(4000);
if (process.env.SNAP_TO_ZERO) { // drag the placed clip left; Snap pulls its start to exactly 00:00:00
  await p.mouse.move(700, 716); await p.mouse.down(); await p.mouse.move(640, 716, { steps: 6 }); await p.mouse.move(585, 716, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(2500);
}
await p.screenshot({ path: `${out}/02-after-drag.png` });
console.log('overlay menu:', JSON.stringify((await text()).split('\n').filter((l) => /overlay|HyperFrames/i.test(l)).slice(0, 8)));
console.log('timeline text:', JSON.stringify((await text()).split('\n').filter((l) => /clip|sample|00:00:0[1-9]/i.test(l)).slice(0, 8)));
// Export tab: Draft 720p -> RENDER
await p.evaluate(() => { const el = [...document.querySelectorAll('button,[role=tab]')].find((e) => e.offsetParent && e.getBoundingClientRect().x > 90 && e.textContent.trim() === 'Export'); el?.click(); });
await p.waitForTimeout(2500);
console.log('preset click:', await p.evaluate(() => { return true; }));
await p.getByText('Draft', { exact: true }).click(); await p.waitForTimeout(1000);
await p.screenshot({ path: `${out}/03-export-tab.png` });
const dl = p.waitForEvent('download', { timeout: 270000 }).catch(() => null);
console.log('render click:', await p.evaluate(() => { const el = [...document.querySelectorAll('button')].find((e) => e.offsetParent && e.textContent.trim().toUpperCase() === 'RENDER'); if (el) { el.click(); return true; } return false; }));
const t0 = Date.now(); let last = '';
for (let i = 0; i < 100; i++) { await p.waitForTimeout(2500); const t = (await text()).split('\n').filter((l) => /%|render|check|black|silence|frozen|done|fail|error/i.test(l)).slice(0, 6).join(' | '); if (t !== last) { console.log(`[${Math.round((Date.now() - t0) / 1000)}s]`, t.slice(0, 220)); last = t; } if (await Promise.race([dl.then((d) => !!d), new Promise((r) => setTimeout(() => r(false), 10))])) break; }
const d = await Promise.race([dl, new Promise((r) => setTimeout(() => r(null), 8000))]);
await p.waitForTimeout(6000); // let the in-browser QA text appear
console.log('final text:', JSON.stringify((await text()).split('\n').filter((l) => /duration|size|black|frozen|silence|peak|QA|check/i.test(l)).slice(0, 8)));
await p.screenshot({ path: `${out}/04-after-render.png` });
if (d) { await d.saveAs(`${out}/${process.env.OUT_NAME || 'new-editor-export-720p'}.mp4`); console.log('DOWNLOADED', d.suggestedFilename()); } else console.log('no download event');
await b.close();
