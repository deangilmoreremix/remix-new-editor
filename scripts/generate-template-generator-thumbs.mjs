#!/usr/bin/env node
/**
 * Real still thumbnails for the Template Generator (and the Animations modal): every HyperFrames / RemotionUI animation,
 * every motion-graphics template and every end screen / lead form is rendered with the editor's own renderer at a
 * representative frame and saved as a JPEG:
 *
 *   public/hyperframes/thumbs/<id>.jpg        animations   (rui:name → rui-name.jpg)
 *   public/occ-templates/thumbs/<id>.jpg      motion graphics
 *   public/overlay-templates/thumbs/<id>.jpg  end screens and lead forms
 *
 *   node scripts/generate-template-generator-thumbs.mjs [--force] [--blank] [--only=hf|mg|tpl] [--limit=N] [--workers=4]
 *
 * A render that comes out (almost) one flat colour — an animation that hasn't started drawing at the sampled moment — is
 * retried at other moments with a longer settle time, and the most detailed result is kept. --blank redoes only the existing
 * thumbnails that are still blank.
 *
 * Existing files are kept unless --force. Run it again after the catalogs change.
 * Set CHROMIUM_PATH to use a specific Chromium (e.g. /opt/pw-browsers/chromium).
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir, access, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('sharp');

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v = true] = a.replace(/^--/, '').split('='); return [k, v]; }));
const root = process.cwd();
const PORT = 5198;
const exists = (p) => access(p).then(() => true, () => false);
const detail = async (input) => { const st = await sharp(input).stats(); return st.channels.slice(0, 3).reduce((a, c) => a + c.stdev, 0) / 3; };
const FLAT = 6;                                   // below this the picture is effectively empty
const TRIES = [{}, { frac: 0.8, wait: 2200 }, { frac: 0.3, wait: 2200 }, { frac: 0.95, wait: 2600 }, { frac: 0.15, wait: 2600 }];

const server = await createServer({ root, logLevel: 'error', server: { port: PORT, strictPort: true, host: '127.0.0.1' } });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
const open = async () => {
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  await page.goto(`http://127.0.0.1:${PORT}/scripts/template-thumbs/page.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  return page;
};

try {
  const first = await open();
  let entries = await first.evaluate(() => window.__thumbs.list());
  if (args.only) entries = entries.filter((e) => e.kind === args.only);
  const todo = [];
  for (const e of entries) {
    const file = join(root, 'public', e.url);
    const have = await exists(file);
    if (args.force || !have || (args.blank && (await detail(file)) < FLAT)) todo.push({ ...e, file });
  }
  const limited = args.limit ? todo.slice(0, Number(args.limit)) : todo;
  console.log(`${entries.length} items, ${limited.length} to render`);

  const queue = [...limited]; let done = 0; const failed = []; const flat = [];
  // Vite re-optimises dependencies it meets for the first time and reloads the page; wait for it to settle and retry.
  const ready = async (page) => {
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForFunction(() => window.__ready === true && !!window.__thumbs, null, { timeout: 60000 });
  };
  const worker = async (page) => {
    for (let e = queue.shift(); e; e = queue.shift()) {
      let lastErr = null;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          await ready(page);
          let best = null; let bestDetail = -1;
          for (const t of TRIES) {
            await page.evaluate((x) => window.__thumbs.render(x), { kind: e.kind, id: e.id, ...t });
            const shot = await page.locator('#host').screenshot({ type: 'jpeg', quality: 74 });
            const d = await detail(shot);
            if (d > bestDetail) { best = shot; bestDetail = d; }
            if (d >= FLAT) break;
          }
          await mkdir(dirname(e.file), { recursive: true });
          await writeFile(e.file, best);
          if (bestDetail < FLAT) flat.push(`${e.kind}:${e.id}${(await page.evaluate(() => window.__thumbs.errors())).length ? ` — ${(await page.evaluate(() => window.__thumbs.errors()))[0]}` : ''}`);
          lastErr = null; break;
        } catch (err) {
          lastErr = err;
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          if (/navigation|undefined|closed|Target/.test(String(err.message))) await page.goto(page.url()).catch(() => {});
        }
      }
      if (lastErr) failed.push(`${e.kind}:${e.id} ${String(lastErr.message).split('\n')[0]}`);
      done += 1; if (done % 25 === 0 || done === limited.length) console.log(`${done}/${limited.length}`);
    }
  };
  const n = Math.max(1, Number(args.workers) || 4);
  const pages = [first, ...(await Promise.all(Array.from({ length: n - 1 }, open)))];
  await Promise.all(pages.map(worker));
  if (flat.length) { console.log(`\n${flat.length} still look empty after retries (they may really be empty at every sampled moment):`); flat.slice(0, 60).forEach((f) => console.log(' -', f)); }
  if (failed.length) { console.log(`\n${failed.length} failed:`); failed.slice(0, 20).forEach((f) => console.log(' -', f)); process.exitCode = 1; }
} finally {
  await browser.close();
  await server.close();
}
