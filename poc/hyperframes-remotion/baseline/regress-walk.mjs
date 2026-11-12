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
if (process.env.FLAG_ON) await p.addInitScript(() => { localStorage.setItem('remix.hyperframes.v1', '1'); });
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

const obs = {};
const clickClip = async () => { await p.mouse.click(640, 690); await p.waitForTimeout(1500); };
const tc = () => p.evaluate(() => (document.body.innerText.match(/\d\d:\d\d:\d\d:\d\d/) || [''])[0]);
const clipsText = () => p.evaluate(() => (document.body.innerText.match(/\d+ clips?/g) || []).join(','));
// 1. clip properties + Browse library (effects / LUTs / transitions)
await clickClip(); await p.mouse.click(1414, 66); await p.waitForTimeout(1800); await p.screenshot({ path: `${out}/panel.png` });
obs.panelText = (await p.evaluate(() => [...document.querySelectorAll('div')].filter((e) => e.offsetParent && e.getBoundingClientRect().x > 1150 && e.getBoundingClientRect().y < 530 && e.children.length > 3).sort((x, y) => y.getBoundingClientRect().height - x.getBoundingClientRect().height)[0]?.innerText || '')).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 60);
obs.panelSelects = await p.evaluate(() => [...document.querySelectorAll('select')].filter((e) => e.offsetParent && e.getBoundingClientRect().x > 1150).map((s) => [...s.options].map((o) => o.textContent.trim())));
obs.effectOptionCount = (obs.panelSelects[0] || []).length; obs.lutOptionCount = (obs.panelSelects[1] || []).length;
const browse = p.getByRole('button', { name: /Browse library/i }).first();
obs.browseFound = await browse.count() > 0;
if (obs.browseFound) {
  await browse.click(); await p.waitForTimeout(2000);
  obs.library = await p.evaluate(() => { const m = document.querySelector('[role=dialog], [class*=library-modal], [class*=occ-lib]'); return m ? m.innerText.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 200) : null; });
  const tabs = await p.evaluate(() => [...document.querySelectorAll('[role=dialog] button, [class*=library] button')].map((b) => b.textContent.trim()).filter((t) => /^(Effects|LUTs|Transitions|Extensions|FX)/i.test(t)));
  obs.libraryTabs = tabs; await p.screenshot({ path: `${out}/library.png` });
  for (const t of tabs) { await p.getByRole('button', { name: t, exact: true }).first().click().catch(() => {}); await p.waitForTimeout(800); const n = await p.evaluate(() => [...document.querySelectorAll('[role=dialog] [class*=card], [role=dialog] [class*=item], [class*=library] [class*=card]')].length); (obs.tabCounts ??= {})[t] = n; }
  await p.keyboard.press('Escape'); await p.waitForTimeout(800);
}
// 2. keyboard shortcuts
await p.mouse.click(700, 520); await p.waitForTimeout(500); const t0 = await tc(); obs.tc0 = t0;
await p.keyboard.press('Space'); await p.waitForTimeout(1800); await p.keyboard.press('Space'); await p.waitForTimeout(500); obs.tcAfterPlay = await tc(); obs.spacePlays = obs.tcAfterPlay !== t0;
await p.keyboard.press('Home'); await p.waitForTimeout(500); obs.tcHome = await tc();
await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400); obs.tcRight = await tc();
await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400); obs.tcRight2 = await tc();
await clickClip(); obs.clipsBefore = await clipsText();
await p.keyboard.press('Delete'); await p.waitForTimeout(1200); obs.clipsAfterDelete = await clipsText();
await p.keyboard.press('Control+z'); await p.waitForTimeout(1200); obs.clipsAfterUndo = await clipsText();
await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(1200); obs.clipsAfterRedo = await clipsText();
await p.keyboard.press('Control+z'); await p.waitForTimeout(1200); obs.clipsFinal = await clipsText();
// 3. tabs present (captions / audio tools / export)
obs.topTabs = await p.evaluate(() => [...document.querySelectorAll('button,[role=tab]')].filter((e) => e.offsetParent && e.getBoundingClientRect().y < 60 && e.getBoundingClientRect().x > 400).map((e) => e.textContent.trim()).filter(Boolean));
obs.overlayMenu = await p.evaluate(() => { const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /Add overlay/.test(o.textContent))); return s ? [...s.options].map((o) => o.textContent.trim()) : null; });
obs.audioTrack = /Audio 1/.test(await p.evaluate(() => document.body.innerText));
await p.screenshot({ path: `${out}/final.png` });
(await import('node:fs')).writeFileSync(`${out}/obs.json`, JSON.stringify(obs, null, 1)); console.log(JSON.stringify(obs).slice(0, 600)); await b.close();
