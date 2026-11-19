/* global window */
// Runs the vendored gl-transitions shaders in headless Chromium WebGL through the real gl/runtime.ts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);

export function findChromium() {
  const cands = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/opt/pw-browsers/chromium/chrome-linux64/chrome'].filter(Boolean);
  return cands.find((p) => fs.existsSync(p));
}

export async function openHarness() {
  const exe = findChromium();
  if (!exe) throw new Error('no chromium found');
  const esbuild = require(path.join(ROOT, 'node_modules/esbuild'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glt-harness-'));
  const out = path.join(dir, 'bundle.js');
  await esbuild.build({ entryPoints: [path.join(ROOT, 'src/openchatcut/gl/glt/__tests__/harness/entry.ts')], bundle: true, format: 'iife', outfile: out, logLevel: 'error', loader: { '.frag': 'text' } });
  const { chromium } = require(path.join(ROOT, 'node_modules/playwright-core'));
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ path: out });
  return { browser, page, errors, close: async () => { await browser.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

export async function checkAll(h, ids) {
  const list = ids ?? (await h.page.evaluate(() => window.__glt.ids));
  const results = [];
  for (const id of list) results.push(await h.page.evaluate((i) => window.__glt.check(i), id));
  return results;
}
