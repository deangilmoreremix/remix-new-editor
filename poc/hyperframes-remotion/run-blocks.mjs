// Runs every installed block through the Remotion web renderer in headless Chromium.
// Needs `npx vite --port 3199` running, public/blocks populated (setup-blocks.mjs), and meta.json
// (name -> {dims,duration,times}) produced from `hyperframes catalog --json`.
// Usage: META=/path/meta.json [ONLY=a,b] [CONC=3] node run-blocks.mjs  -> out/blocks/<name>/t<sec>.png + out/blocks.json
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const meta = JSON.parse(readFileSync(process.env.META, 'utf8'));
const only = process.env.ONLY ? process.env.ONLY.split(',') : Object.keys(meta).filter((n) => existsSync(`public/blocks/${n}.html`));
const CONC = +(process.env.CONC || 3);
mkdirSync('out/blocks', { recursive: true });
// Default Chromium flags. The combination --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader
// --enable-unsafe-webgpu made blurred layers composite with transparency (false SSIM 0.71 on code-diff).
const browser = await chromium.launch({ args: (process.env.FLAGS || '').split(' ').filter(Boolean) });
const results = existsSync('out/blocks.json') && process.env.MERGE ? JSON.parse(readFileSync('out/blocks.json', 'utf8')) : {};
let idx = 0;
async function worker() {
  while (idx < only.length) {
    const name = only[idx++]; const m = meta[name];
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 200)));
    try {
      await page.goto('http://127.0.0.1:3199/', { waitUntil: 'load' });
      const r = await Promise.race([
        page.evaluate(([n, o]) => window.__poc.block(n, o), [name, { width: m.dims.width, height: m.dims.height, duration: m.duration, times: m.times }]),
        new Promise((_, rej) => setTimeout(() => rej(new Error('block timeout 150s')), 150000)),
      ]);
      rmSync(`out/blocks/${name}`, { recursive: true, force: true }); // never leave stale PNGs from earlier runs
      mkdirSync(`out/blocks/${name}`, { recursive: true });
      for (const f of r.frames) if (f.png) { writeFileSync(`out/blocks/${name}/t${f.t}.png`, Buffer.from(f.png, 'base64')); delete f.png; }
      results[name] = { ...r, pageErrors: [...new Set(pageErrors)].slice(0, 4) };
    } catch (e) { results[name] = { fatal: String(e).slice(0, 300), pageErrors }; }
    await page.close();
    console.log(`[${Object.keys(results).length}/${only.length}] ${name}`, results[name].fatal || results[name].errors?.join(' | ') || 'ok');
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
writeFileSync('out/blocks.json', JSON.stringify(results));
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]); // media pages can stall close()
process.exit(0);
