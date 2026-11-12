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
 *   node scripts/generate-template-generator-thumbs.mjs [--force] [--only=hf|mg|tpl] [--limit=N] [--workers=4]
 *
 * Existing files are kept unless --force. Run it again after the catalogs change.
 * Set CHROMIUM_PATH to use a specific Chromium (e.g. /opt/pw-browsers/chromium).
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v = true] = a.replace(/^--/, '').split('='); return [k, v]; }));
const root = process.cwd();
const PORT = 5198;
const exists = (p) => access(p).then(() => true, () => false);

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
  for (const e of entries) { const file = join(root, 'public', e.url); if (args.force || !(await exists(file))) todo.push({ ...e, file }); }
  const limited = args.limit ? todo.slice(0, Number(args.limit)) : todo;
  console.log(`${entries.length} items, ${limited.length} to render`);

  const queue = [...limited]; let done = 0; const failed = [];
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
          await page.evaluate((x) => window.__thumbs.render(x), { kind: e.kind, id: e.id });
          await mkdir(dirname(e.file), { recursive: true });
          await page.locator('#host').screenshot({ path: e.file, type: 'jpeg', quality: 74 });
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
  if (failed.length) { console.log(`\n${failed.length} failed:`); failed.slice(0, 20).forEach((f) => console.log(' -', f)); process.exitCode = 1; }
} finally {
  await browser.close();
  await server.close();
}
