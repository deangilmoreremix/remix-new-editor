/* Stage 11 (port J): the Lottie edits in the REAL lottie-web renderer (the one the editor preview uses), headless Chromium.
 * Bundles lottie-web + the pure patcher with esbuild, loads a Lottie document in the `slots` format, renders it unedited and edited, and reads the SVG back.
 * Run: node docs/stage-11/smoke/lottie-check.cjs  (needs node_modules; CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome) */
const path = require('path'); const fs = require('fs'); const os = require('os');
const esbuild = require('esbuild'); const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../..');
const results = []; let failed = 0;
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); results.push({ ok: !!c, m }); if (!c) failed++; };
const entry = `
import lottie from 'lottie-web';
import { applyLottieEdits } from ${JSON.stringify(path.join(root, 'src/cinegen/lib/editor/stage2/lottie-edit.ts'))};
window.__render = (data, edits) => {
  const host = document.createElement('div'); host.style.cssText = 'width:200px;height:200px'; document.body.appendChild(host);
  const anim = lottie.loadAnimation({ container: host, renderer: 'svg', loop: false, autoplay: false, animationData: applyLottieEdits(data, edits) });
  anim.goToAndStop(0, true);
  const svg = host.querySelector('svg');
  const fills = [...svg.querySelectorAll('path')].map((p) => ({ fill: p.getAttribute('fill'), display: getComputedStyle(p).display, hidden: !!p.closest('[style*="display: none"]') }));
  const groups = [...svg.querySelectorAll('g')].map((g) => ({ opacity: g.getAttribute('opacity') || g.style.opacity || '', transform: g.getAttribute('transform') || g.style.transform || '', display: g.style.display }));
  const html = svg.outerHTML; anim.destroy(); host.remove();
  return { fills, groups, htmlLength: html.length };
};
`;
const rect = (nm, color) => ({ ty: 'gr', nm, it: [{ ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [40, 40] }, r: { a: 0, k: 0 } }, { ty: 'fl', c: { a: 0, k: color }, o: { a: 0, k: 100 } }, { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }] });
const doc = {
  v: '5.12.1', fr: 30, ip: 0, op: 60, w: 200, h: 200, assets: [], slots: { fade: { nm: 'Opacity', p: { a: 0, k: 100 } }, place: { nm: 'Position', p: { a: 0, k: [100, 100] } } },
  layers: [
    { ty: 4, nm: 'Badge', ind: 1, ip: 0, op: 60, st: 0, ks: { o: { a: 0, k: 100, sid: 'fade' }, r: { a: 0, k: 0 }, p: { a: 0, k: [100, 100, 0], sid: 'place' }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } }, shapes: [rect('box', [1, 0, 0, 1])] },
    { ty: 4, nm: 'Sparkle', ind: 2, ip: 0, op: 60, st: 0, ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [40, 40, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } }, shapes: [rect('dot', [0, 0, 1, 1])] },
  ],
};
(async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lottie-check-')), 'bundle.js');
  await esbuild.build({ stdin: { contents: entry, resolveDir: root, loader: 'ts' }, bundle: true, format: 'iife', outfile: out, platform: 'browser', logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' } });
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const pg = await b.newPage(); pg.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 200)));
  await pg.setContent('<html><body></body></html>'); await pg.addScriptTag({ path: out });
  const plain = await pg.evaluate((d) => window.__render(d, undefined), doc);
  const hid = await pg.evaluate((d) => window.__render(d, { hidden: ['1'] }), doc);
  const val = await pg.evaluate((d) => window.__render(d, { values: { fade: 35, place: [20, 30] } }), doc);
  const fillsOf = (r) => r.fills.filter((f) => f.display !== 'none' && !f.hidden).map((f) => f.fill);
  console.log('INFO plain fills', JSON.stringify(fillsOf(plain)), 'hidden fills', JSON.stringify(fillsOf(hid)));
  assert(plain.fills.length === 2, 'unedited document renders both shape layers (' + plain.fills.length + ' paths)');
  assert(hid.fills.length < plain.fills.length || fillsOf(hid).length < fillsOf(plain).length, 'hiding layer 1 removes its picture from the real lottie-web SVG (' + fillsOf(hid).length + ' visible vs ' + fillsOf(plain).length + ')');
  const op = (r) => r.groups.map((g) => g.opacity).filter(Boolean);
  const tf = (r) => r.groups.map((g) => g.transform).filter((t) => /matrix|translate/.test(t));
  console.log('INFO opacity plain', JSON.stringify(op(plain)), 'edited', JSON.stringify(op(val))); console.log('INFO transforms plain', JSON.stringify(tf(plain)), 'edited', JSON.stringify(tf(val)));
  assert(op(val).some((o) => Math.abs(parseFloat(o) - 0.35) < 0.01) && !op(plain).some((o) => Math.abs(parseFloat(o) - 0.35) < 0.01), 'opacity slot 35 reaches the rendered SVG (opacity 0.35)');
  assert(JSON.stringify(tf(val)) !== JSON.stringify(tf(plain)), 'position slot moves the rendered layer (transform changed)');
  fs.writeFileSync(path.join(__dirname, 'results', 'lottie-check.json'), JSON.stringify({ results, plain: { opacity: op(plain), transforms: tf(plain) }, edited: { opacity: op(val), transforms: tf(val) } }, null, 1));
  await b.close(); console.log(failed ? 'FAILED ' + failed : 'ALL PASS'); process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(2); });
