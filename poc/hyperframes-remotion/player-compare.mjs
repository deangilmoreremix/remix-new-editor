// Player vs Remotion vs native for the SAME personalized composition at the same time.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
mkdirSync('out/player', { recursive: true });
const name = process.argv[2], t = parseFloat(process.argv[3]), w = process.argv[4] || '1920', h = process.argv[5] || '1080';
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
await p.goto(`http://127.0.0.1:3199/player.html?block=${name}&w=${w}&h=${h}`);
const ready = await Promise.race([p.evaluate(() => window.__ready), new Promise((r) => setTimeout(() => r('timeout'), 20000))]);
let info = {};
if (ready === true) {
  await p.evaluate((x) => window.__player.seek(x), t); await p.waitForTimeout(1500);
  info = await p.evaluate(() => ({ t: window.__player.currentTime, d: window.__player.duration, paused: window.__player.paused }));
}
await p.screenshot({ path: `out/player/${name}-t${t}.png` });
writeFileSync(`out/player/${name}-t${t}.json`, JSON.stringify({ ready, info, errs }));
console.log(JSON.stringify({ ready, info, errs: errs.slice(0, 3) })); await b.close();
