/* global window, process, console, URL */
// Fix E preview smoke: drives docs/stage-10/smoke/fixe-preview-harness.html (real GlClipLayer / GlGroupLayer over real <video>s, real timeline, real
// activeGlTransition / flattenCompounds) in headless Chromium and checks the centre pixel of the stage screenshot.
//   ?mode=win : lower-track L, V2 A -> B with blend screen + opacity 0.6, 1 s GL cross-dissolve at 2-3 s. Expected = 0.4*L + 0.6*screen(L, mix(A,B,smoothstep(u))).
//   ?mode=grp : compound group opacity 0.5 over overlapping A (V1 0-4) and B (V2 2-6): the overlap must be 0.5*B (one group), not 0.5*B + 0.25*A.
// Run: media as in fixe-export-smoke.cjs in $FIXE_DIR/media, `npx vite --port 3110 --strictPort &`, then `FIXE_DIR=$DIR node docs/stage-10/smoke/fixe-preview-smoke.cjs`
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const DIR = process.env.FIXE_DIR; const PORT = process.env.FIXE_PORT || '3110';
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
let failed = 0; const results = {}; const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); results[m] = !!c; if (!c) failed++; };
const px = (png, x = 640, y = 200) => { const b = execFileSync('ffmpeg', ['-v', 'error', '-i', png, '-vf', `crop=8:8:${x}:${y},scale=1:1:flags=area`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-']); return [b[0], b[1], b[2]]; };
const srcPx = (n) => { const b = execFileSync('ffmpeg', ['-v', 'error', '-i', path.join(DIR, 'media', `${n}.webm`), '-vf', 'select=eq(n\\,30),crop=8:8:300:100,scale=1:1:flags=area', '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-']); return [b[0], b[1], b[2]]; };
const maxErr = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const screen = (cb, cs) => cb.map((b, i) => { const B = b / 255; const S = cs[i] / 255; return (B + S - B * S) * 255; });
const mix = (a, b, p) => a.map((v, i) => v + (b[i] - v) * p); const smooth = (u) => u * u * (3 - 2 * u);
const L = srcPx('L'); const A = srcPx('A'); const B = srcPx('B');
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const out = {};
  for (const mode of ['win', 'grp']) {
    const page = await browser.newPage({ viewport: { width: 1300, height: 740 } });
    page.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 300)));
    page.on('console', (m) => { if (m.type() === 'error') console.log('CON', m.text().slice(0, 200)); });
    await page.route('**/__fixe/*.webm', async (route) => {
      const buf = fs.readFileSync(path.join(DIR, 'media', path.basename(new URL(route.request().url()).pathname)));
      const range = route.request().headers()['range']; const h = { 'content-type': 'video/webm', 'accept-ranges': 'bytes' };
      if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const s = +m[1]; const e = m[2] ? +m[2] : buf.length - 1; return route.fulfill({ status: 206, headers: { ...h, 'content-range': `bytes ${s}-${e}/${buf.length}` }, body: buf.subarray(s, e + 1) }); }
      return route.fulfill({ status: 200, headers: h, body: buf });
    });
    await page.goto(`http://127.0.0.1:${PORT}/docs/stage-10/smoke/fixe-preview-harness.html?mode=${mode}`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    const rows = [];
    for (const t of (mode === 'win' ? [1.5, 1.99, 2.01, 2.3, 2.5, 2.8, 2.99, 3.01, 3.5] : [1, 3, 5])) {
      await page.evaluate((tt) => window.__show(tt), t); await page.waitForTimeout(900);
      const png = path.join(DIR, `preview-${mode}-${t}.png`); await page.locator('#stage').screenshot({ path: png });
      rows.push({ t, m: px(png) }); console.log(mode, 't=' + t, rows[rows.length - 1].m);
    }
    out[mode] = rows; await page.close();
  }
  await browser.close();
  const w = out.win; const g = out.grp;
  const expectWin = (t) => { const u = t < 2 ? -1 : t >= 3 ? 2 : (t - 2); const C = u < 0 ? A : u > 1 ? B : mix(A, B, smooth(u)); return mix(L, screen(L, C), 0.6); };
  for (const r of w) { r.e = expectWin(r.t).map(Math.round); r.err = maxErr(r.m, r.e); }
  console.log('win errors vs expected (levels):', w.map((r) => `${r.t}:${r.err.toFixed(0)}`).join(' '));
  assert(w.every((r) => r.err <= 20), `preview window: before / inside / after the GL window the viewer shows 0.4*lower + 0.6*screen(lower, A->B) (max error ${Math.max(...w.map((r) => r.err)).toFixed(0)} levels)`);
  const step = (a, b) => maxErr(w.find((r) => r.t === a).m, w.find((r) => r.t === b).m);
  assert(step(1.99, 2.01) <= 20 && step(2.99, 3.01) <= 20, `preview window: no jump at the window start (${step(1.99, 2.01).toFixed(0)}) or end (${step(2.99, 3.01).toFixed(0)}) levels`);
  const half = (c) => c.map((v) => v * 0.5);
  assert(maxErr(g[0].m, half(A)) <= 12 && maxErr(g[2].m, half(B)) <= 12, `preview group: A alone / B alone at 50 % (${g[0].m} / ${g[2].m})`);
  assert(maxErr(g[1].m, half(B)) <= 12, `preview group: the overlap is ONE 50 % layer = 0.5*B (${g[1].m} vs ${half(B).map(Math.round)}), not 0.5*B + 0.25*A (${[0, 1, 2].map((i) => Math.round(0.5 * B[i] + 0.25 * A[i]))})`);
  fs.writeFileSync(path.join(DIR, 'fixe-preview-results.json'), JSON.stringify({ assertions: results, out }, null, 1));
  process.exit(failed ? 1 : 0);
})();
