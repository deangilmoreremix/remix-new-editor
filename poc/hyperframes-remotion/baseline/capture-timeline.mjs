// Capture-only baseline of the existing /timeline editor. Reads the running app; changes nothing.
// Usage: node baseline/capture-timeline.mjs [outDir]   (root app on :3100)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const out = process.argv[2] || 'out/baseline'; mkdirSync(out, { recursive: true });
const b = await chromium.launch(); const log = { shots: [], console: [], pageErrors: [], requestsFailed: [] };
for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage();
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log.console.push(`${name} ${m.type()}: ${m.text().slice(0, 200)}`); });
  p.on('pageerror', (e) => log.pageErrors.push(`${name}: ${e.message.slice(0, 200)}`));
  p.on('requestfailed', (r) => log.requestsFailed.push(`${name}: ${r.url().slice(0, 120)}`));
  await p.goto('http://127.0.0.1:3100/#/timeline', { waitUntil: 'load' });
  // Cold Vite compile of the 9k-line editor can take a while: wait for the real editor, not the spinner.
  const t0 = Date.now(); let ready = false;
  while (Date.now() - t0 < 120000) {
    ready = await p.evaluate(() => !!document.querySelector('[data-testid*=timeline], #timeline-root, .timeline-editor, [class*=timeline-editor], [class*=timeline-page]') || document.body.innerText.length > 600).catch(() => false);
    if (ready) break; await p.waitForTimeout(2000);
  }
  log.shots.push({ name: name + '-ready', ready, waitedMs: Date.now() - t0 }); await p.waitForTimeout(2500);
  const info = await p.evaluate(() => ({ title: document.title, hash: location.hash, tracks: document.querySelectorAll('[class*=track]').length, buttons: document.querySelectorAll('button').length, bodyChars: document.body.innerText.length }));
  await p.screenshot({ path: `${out}/timeline-${name}.png` });
  log.shots.push({ name, vp, info });
  await ctx.close();
}
writeFileSync(`${out}/capture-log.json`, JSON.stringify(log, null, 1));
console.log(JSON.stringify(log.shots), 'pageErrors', log.pageErrors.length, 'console', log.console.length);
await b.close();
