// Capture-only: import a sample clip into the CLASSIC editor in an ephemeral browser profile and screenshot.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const SAMPLE = process.env.SAMPLE; const out = 'out/baseline-classic'; mkdirSync(out, { recursive: true });
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true })).newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 120)));
p.on('response', async (r) => { try { const rt = r.request().resourceType(); const ct0 = r.headers()['content-type'] || ''; if ((rt === 'fetch' || rt === 'xhr') && /html/.test(ct0)) console.log('FETCH/XHR GOT HTML:', r.request().method(), r.status(), r.url().slice(0, 120)); } catch {} try { const ct = r.headers()['content-type'] || ''; if (/\/api\//.test(r.url()) && /html/.test(ct)) console.log('API returned HTML:', r.status(), r.url().slice(0, 100)); } catch {} });
// Same hermetic stubs the repo's own e2e specs use (e2e/upload-boundary.spec.js): the worker file does not exist in this repo.
await p.route('**/lib/media-worker.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: "self.onmessage = (e) => { const d = e.data || {}; self.postMessage({ success: false, action: d.action, fileId: d.fileId, error: 'media worker unavailable' }); };" }));
await p.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
await p.route('**/storage/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"stub"}' }));
await p.goto('http://127.0.0.1:3100/#/timeline', { waitUntil: 'load' });
for (let i = 0; i < 60 && !(await p.evaluate(() => document.body.innerText.includes('set up your API keys'))); i++) await p.waitForTimeout(1000);
await p.mouse.click(962, 80); await p.waitForTimeout(1500);
for (let i = 0; i < 90 && !(await p.evaluate(() => /Media Preview|RENDER READY|Timeline Editor/.test(document.body.innerText))); i++) await p.waitForTimeout(2000);
await p.waitForTimeout(2000);
const inputs = await p.evaluate(() => [...document.querySelectorAll('input[type=file]')].map((i) => ({ accept: i.accept, id: i.id, name: i.name, multiple: i.multiple })));
console.log('file inputs:', JSON.stringify(inputs));
const labels = await p.evaluate(() => [...document.querySelectorAll('button')].filter((e) => e.offsetParent).map((e) => (e.getAttribute('aria-label') || e.title || e.textContent).trim().replace(/\s+/g, ' ').slice(0, 30)).filter((x) => /media|import|upload|add|export/i.test(x)));
console.log('relevant buttons:', JSON.stringify(labels.slice(0, 20)));
await p.screenshot({ path: `${out}/01-before.png` });
await p.setInputFiles('#uploadInput', SAMPLE); await p.waitForTimeout(6000);
await p.getByText('TRACKS').first().scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(1000);
await p.screenshot({ path: `${out}/02-after-upload.png` });
await p.getByText('Export', { exact: true }).first().click().catch((e) => console.log('click export failed', String(e).slice(0, 80))); await p.waitForTimeout(3000);
await p.screenshot({ path: `${out}/03-export-dialog.png` });
console.log('dialog text:', JSON.stringify(await p.evaluate(() => document.body.innerText.split('\n').filter((l) => /export|render|resolution|720|1080|4k|quality|format|mp4|webm|basic|browser/i.test(l)).slice(0, 25))));
// Real export through the existing pipeline (empty-media timeline, 720p).
for (const h of await p.$$('select')) { const opts = await h.evaluate((e) => [...e.options].map((o) => o.text)); const hit = opts.find((o) => /720p/.test(o)); if (hit) await h.selectOption({ label: hit }); }
const dl = p.waitForEvent('download', { timeout: 240000 }).catch(() => null);
await p.getByRole('button', { name: 'Start Export' }).click();
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log('console', m.type(), m.text().slice(0, 160)); });
await p.waitForTimeout(25000);
console.log('after-click text:', JSON.stringify(await p.evaluate(() => document.body.innerText.split('\n').filter((l) => /export|render|progress|error|fail|%|unsupported|WebCodecs|browser/i.test(l)).slice(0, 14))));
console.log('frames:', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('iframe')].map((f) => f.src.slice(-30)))));
const d = await Promise.race([dl, new Promise((r) => setTimeout(() => r(null), 1000))]);
await p.screenshot({ path: `${out}/04-after-export.png` });
if (d) { await d.saveAs(`${out}/classic-export-720p-empty.mp4`); console.log('DOWNLOADED', d.suggestedFilename()); } else console.log('no download event');
console.log('mentions sample:', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && /sample/i.test(e.textContent)).map((e) => e.textContent.trim().slice(0, 60)).slice(0, 6))));
console.log('clips-ish text:', JSON.stringify(await p.evaluate(() => document.body.innerText.split('\n').filter((l) => /sample|\.mp4|clip|track/i.test(l)).slice(0, 12))));
await b.close();
