/* global window, process, console, URL */
// Fix A preview smoke: drives docs/stage-9/smoke/fixa-preview-harness.html (the real GlClipLayer over real <video>s and the real timeline) in headless
// Chromium, screenshots the stage inside the GL transition window and measures the shift / brightness of the picture against the source frames.
// Run: ffmpeg media as in FIX_A_REPORT.md in $FIXA_DIR/media, `npx vite --port 3106 --strictPort &`, then `FIXA_DIR=$DIR node docs/stage-9/smoke/fixa-preview-smoke.cjs`
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const DIR = process.env.FIXA_DIR; const PORT = process.env.FIXA_PORT || '3106';
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const GW = 320; const GH = 180; const PXW = 1280;
let failed = 0; const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) failed++; };
const grayOf = (file, ss) => execFileSync('ffmpeg', ['-v', 'error', ...(ss === undefined ? [] : ['-ss', String(ss)]), '-i', file, '-frames:v', '1', '-vf', `scale=${GW}:${GH}:flags=area,format=gray`, '-f', 'rawvideo', '-']);
function shift(exp, src) {
  let best = -2; let bestDx = 0;
  for (let dx = -GW + 20; dx <= GW - 20; dx++) {
    let n = 0; let sa = 0; let sb = 0; let saa = 0; let sbb = 0; let sab = 0;
    for (let y = 8; y < GH - 8; y += 2) for (let x = Math.max(0, dx); x < Math.min(GW, GW + dx); x += 2) { const a = exp[y * GW + x]; const b = src[y * GW + x - dx]; n++; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; }
    const va = saa - (sa * sa) / n; const vb = sbb - (sb * sb) / n; if (va < 1e-6 || vb < 1e-6) continue;
    const r = (sab - (sa * sb) / n) / Math.sqrt(va * vb); if (r > best) { best = r; bestDx = dx; }
  }
  return { px: bestDx * (PXW / GW), ncc: best, dx: bestDx };
}
function luma(exp, src, dx) { let se = 0; let ss = 0; for (let y = 0; y < GH; y++) for (let x = Math.max(0, dx) + 4; x < Math.min(GW, GW + dx) - 4; x++) { se += exp[y * GW + x]; ss += src[y * GW + x - dx]; } return se / ss; }

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1300, height: 740 } });
  page.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CON', m.text().slice(0, 200)); });
  await page.route('**/__fixa/*.webm', async (route) => {
    const buf = fs.readFileSync(path.join(DIR, 'media', path.basename(new URL(route.request().url()).pathname)));
    const range = route.request().headers()['range']; const h = { 'content-type': 'video/webm', 'accept-ranges': 'bytes' };
    if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const s = +m[1]; const e = m[2] ? +m[2] : buf.length - 1; return route.fulfill({ status: 206, headers: { ...h, 'content-range': `bytes ${s}-${e}/${buf.length}` }, body: buf.subarray(s, e + 1) }); }
    return route.fulfill({ status: 200, headers: h, body: buf });
  });
  await page.goto(`http://127.0.0.1:${PORT}/docs/stage-9/smoke/fixa-preview-harness.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const rows = [];
  for (const legacy of [false, true]) {
    for (const [t, side] of [[2.0333, 'A'], [2.1, 'A'], [2.9, 'B'], [2.9667, 'B']]) {
      await page.evaluate(([tt, lg]) => window.__show(tt, lg), [t, legacy]);
      await page.waitForTimeout(900);
      const png = path.join(DIR, `preview-${legacy ? 'legacy' : 'new'}-${t}.png`);
      await page.locator('#stage').screenshot({ path: png });
      const exp = grayOf(png);
      const src = side === 'A' ? grayOf(path.join(DIR, 'media', 'A.webm'), t) : grayOf(path.join(DIR, 'media', 'B.webm'), 1 + (t - 2));
      const sh = shift(exp, src); const expect = side === 'A' ? 10 * t * 12.8 : (-30 + 10 * (t - 2)) * 12.8;
      rows.push({ legacy, t, side, px: sh.px, expect, ncc: sh.ncc, luma: luma(exp, src, sh.dx) });
      console.log(`${legacy ? 'legacy' : 'new   '} t=${t} ${side}: shift ${sh.px.toFixed(0)} expected ${expect.toFixed(0)} ncc ${sh.ncc.toFixed(2)} luma x${luma(exp, src, sh.dx).toFixed(2)}`);
    }
  }
  await browser.close();
  const nw = rows.filter((r) => !r.legacy); const lg = rows.filter((r) => r.legacy);
  assert(nw.every((r) => Math.abs(r.px - r.expect) <= 40), 'preview (new): both sides of the GL transition keep their keyed x position inside the window');
  assert(nw.filter((r) => r.side === 'A').every((r) => r.luma > 1.15), 'preview (new): A keeps its exposure effect inside the window');
  assert(lg.filter((r) => r.t >= 2).some((r) => Math.abs(r.px - r.expect) > 150), 'preview (legacy raw frames): the keyed position is lost inside the window (old behaviour reproduced)');
  fs.writeFileSync(path.join(DIR, 'fixa-preview-results.json'), JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
