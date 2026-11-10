// Headless runner: starts nothing itself; expects `npm run dev` on :3199.
// Usage: node run-poc.mjs  -> writes out/<name>.mp4|webm and out/<name>-f<N>.png
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
mkdirSync('out', { recursive: true });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage();
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:3199/');
const results = {};
for (const name of (process.env.ONLY || 'lower-third,footage-overlay,shader').split(',')) {
  for (const f of [0, 20, 45, 90]) {
    try {
      const b64 = await page.evaluate(([n, fr]) => window.__poc.still(n, fr), [name, f]);
      writeFileSync(`out/${name}-f${f}.png`, Buffer.from(b64, 'base64'));
    } catch (e) { console.log(`still ${name}@${f} FAILED:`, String(e).slice(0, 300)); }
  }
  for (const [container, videoCodec] of [['mp4', null], ['webm', null]]) {
    try {
      const r = await page.evaluate(([n, o]) => window.__poc.render(n, o), [name, { container, videoCodec }]);
      writeFileSync(`out/${name}.${container}`, Buffer.from(r.b64, 'base64'));
      results[`${name}.${container}`] = { ms: r.ms, bytes: r.bytes };
      console.log(`render ${name}.${container}: ${r.ms}ms ${r.bytes}B`);
      break;
    } catch (e) { console.log(`render ${name}.${container} FAILED:`, String(e).slice(0, 300)); }
  }
}
await browser.close();
console.log(JSON.stringify(results));
