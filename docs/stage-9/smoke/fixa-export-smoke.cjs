/* global window, btoa, process, console, URL, Buffer */
// Fix A real-export smoke: feeds the REAL export models (src/cinegen/__tests__/editor/fixa-export-model.smoke.test.ts) to the REAL export runner
// (src/export-runner -> Remotion renderMediaOnWeb) in headless Chromium, then measures the rendered frames with ffmpeg:
//   - horizontal shift of the exported picture against the source frame (normalised cross-correlation) and mean luma ratio,
//   - GL transition: continuity of the keyed x position and the exposure effect across the transition window (before / at start / inside / after),
//     for the new path and for the legacy raw-frame path (model without side looks),
//   - compound clip: its own keyed x + exposure reach the exported frames.
// Run from the repo root:
//   ffmpeg ... $DIR/media/A.webm (testsrc2) and B.webm (mandelbrot), 640x360, 6 s, VP9   (see FIX_A_REPORT.md)
//   npx vite --port 3106 --strictPort &
//   FIXA_MODEL_OUT=$DIR/models FIXA_MEDIA_BASE=http://127.0.0.1:3106/__fixa npx vitest run src/cinegen/__tests__/editor/fixa-export-model.smoke.test.ts
//   FIXA_DIR=$DIR node docs/stage-9/smoke/fixa-export-smoke.cjs
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const DIR = process.env.FIXA_DIR; const PORT = process.env.FIXA_PORT || '3106';
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
let failed = 0; const results = {}; const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); results[m] = !!c; if (!c) failed++; };
const GW = 320; const GH = 180; const PXW = 1280; // gray analysis size, real frame width

function gray(file, t, scaleFilter) { // gray GWxGH frame at time t
  return execFileSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', `${scaleFilter ? scaleFilter + ',' : ''}scale=${GW}:${GH}:flags=area,format=gray`, '-f', 'rawvideo', '-']);
}
// mean luma ratio exp/src over the columns both show once exp is shifted by dx gray-px (the exposed bar of a shifted picture is excluded)
function lumaRatio(exp, src, dxPx) {
  const dx = Math.round(dxPx / (PXW / GW)); let se = 0; let ss = 0; let n = 0;
  for (let y = 0; y < GH; y++) for (let x = Math.max(0, dx) + 4; x < Math.min(GW, GW + dx) - 4; x++) { se += exp[y * GW + x]; ss += src[y * GW + x - dx]; n++; }
  return n ? se / ss : NaN;
}
// shift (in real 1280-wide px) of `exp` relative to `src`: argmax over dx of the normalised cross-correlation of exp[x] with src[x-dx]
function shift(exp, src) {
  let best = -2; let bestDx = 0;
  for (let dx = -GW + 20; dx <= GW - 20; dx++) {
    let n = 0; let sa = 0; let sb = 0; let saa = 0; let sbb = 0; let sab = 0;
    for (let y = 8; y < GH - 8; y += 2) for (let x = Math.max(0, dx); x < Math.min(GW, GW + dx); x += 2) { const a = exp[y * GW + x]; const b = src[y * GW + x - dx]; n++; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; }
    const va = saa - (sa * sa) / n; const vb = sbb - (sb * sb) / n; if (va < 1e-6 || vb < 1e-6) continue;
    const r = (sab - (sa * sb) / n) / Math.sqrt(va * vb);
    if (r > best) { best = r; bestDx = dx; }
  }
  return { px: bestDx * (PXW / GW), ncc: best };
}
const srcFile = (name) => path.join(DIR, 'media', `${name}.webm`);

async function render(page, model) {
  return page.evaluate((m) => new Promise((resolve, reject) => {
    const id = 'r' + Math.random();
    const onMsg = async (e) => {
      const d = e.data || {};
      if (d.id !== id) return;
      if (d.type === 'error') { window.removeEventListener('message', onMsg); reject(new Error(d.message)); }
      if (d.type === 'done') {
        window.removeEventListener('message', onMsg);
        const buf = new Uint8Array(await d.blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        resolve({ b64: btoa(s), mime: d.mimeType });
      }
    };
    window.addEventListener('message', onMsg);
    window.postMessage({ type: 'render', id, model: m, options: { container: 'webm', videoCodec: 'vp9', quality: '720p' } }, '*');
  }), model);
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const outs = {};
  for (const name of (process.env.FIXA_ONLY ? process.env.FIXA_ONLY.split(',') : ['gl-new', 'gl-legacy', 'comp-new', 'comp-base'])) {
    const outPath = path.join(DIR, `export-${name}.webm`);
    if (process.env.FIXA_REUSE && fs.existsSync(outPath)) { outs[name] = outPath; continue; }
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') console.log('CON', m.text().slice(0, 200)); });
    await page.route(`**/__fixa/*.webm`, async (route) => {
      const buf = fs.readFileSync(srcFile(path.basename(new URL(route.request().url()).pathname, '.webm')));
      const range = route.request().headers()['range']; const h = { 'content-type': 'video/webm', 'accept-ranges': 'bytes', 'access-control-allow-origin': '*' };
      if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const s = +m[1]; const e = m[2] ? +m[2] : buf.length - 1; return route.fulfill({ status: 206, headers: { ...h, 'content-range': `bytes ${s}-${e}/${buf.length}` }, body: buf.subarray(s, e + 1) }); }
      return route.fulfill({ status: 200, headers: h, body: buf });
    });
    await page.goto(`http://127.0.0.1:${PORT}/export-runner.html`);
    await page.waitForFunction(() => typeof window.VideoEncoder === 'function', null, { timeout: 30000 });
    const model = JSON.parse(fs.readFileSync(path.join(DIR, 'models', `${name}.json`), 'utf8'));
    model.durationInFrames = name.startsWith('gl') ? 150 : 180;
    const t0 = Date.now();
    const r = await render(page, model);
    const out = path.join(DIR, `export-${name}.webm`); fs.writeFileSync(out, Buffer.from(r.b64, 'base64'));
    console.log(`${name}: rendered ${(fs.statSync(out).size / 1024).toFixed(0)} KiB (${r.mime}) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    outs[name] = out; await page.close();
  }
  await browser.close();

  // ---- GL transition window = timeline [2 s, 3 s]. A: x = 10 %/s * t (+ exposure +1.5), source A at timeline t. B: x = -30 + 10 * (t - 2) %, source B at 1 + (t - 2).
  const A = (t) => 10 * t * (PXW / 100); const Bx = (t) => (-30 + 10 * (t - 2)) * (PXW / 100);
  const sampleA = (f, t) => { const e = gray(f, t); const s = gray(srcFile('A'), t); const sh = shift(e, s); return { ...sh, luma: lumaRatio(e, s, sh.px) }; };
  const sampleB = (f, t) => { const e = gray(f, t); const s = gray(srcFile('B'), 1 + (t - 2)); const sh = shift(e, s); return { ...sh, luma: lumaRatio(e, s, sh.px) }; };
  const report = {};
  for (const name of ['gl-new', 'gl-legacy']) {
    if (!outs[name]) continue;
    const f = outs[name];
    const times = [1.8, 1.9, 1.9667, 2.0, 2.0333, 2.0667, 2.1];
    const a = times.map((t) => ({ t, ...sampleA(f, t), expect: A(t) })); report[name] = { a };
    console.log(name, 'A side (shift px / expected px / luma ratio vs source):');
    a.forEach((s) => console.log(`  t=${s.t}: shift ${s.px.toFixed(0)} expected ${s.expect.toFixed(0)} ncc ${s.ncc.toFixed(2)} luma x${s.luma.toFixed(2)}`));
    const bt = [2.9, 2.9333, 2.9667, 3.0, 3.0333, 3.1];
    const b = bt.map((t) => ({ t, ...sampleB(f, t), expect: Bx(t) })); report[name].b = b;
    console.log(name, 'B side:');
    b.forEach((s) => console.log(`  t=${s.t}: shift ${s.px.toFixed(0)} expected ${s.expect.toFixed(0)} ncc ${s.ncc.toFixed(2)} luma x${s.luma.toFixed(2)}`));
    const jumpA = Math.max(...a.slice(1).map((s, i) => Math.abs(s.px - a[i].px))); const jumpB = Math.max(...b.slice(1).map((s, i) => Math.abs(s.px - b[i].px)));
    const lumaJumpA = Math.max(...a.slice(1).map((s, i) => Math.abs(s.luma - a[i].luma)));
    report[name].jumpA = jumpA; report[name].jumpB = jumpB; report[name].lumaJumpA = lumaJumpA;
    console.log(`${name}: largest frame-to-frame jump of A's position ${jumpA.toFixed(0)} px, of B's ${jumpB.toFixed(0)} px, of A's luma ratio ${lumaJumpA.toFixed(2)}`);
  }
  if (report['gl-new']) {
    const r = report['gl-new'];
    assert(r.a.every((s) => Math.abs(s.px - s.expect) <= 32), `gl-new: A keeps its keyed x position before, at the start of and inside the transition window (within 32 px of the key, expected ${r.a.map((s) => s.expect.toFixed(0))})`);
    assert(r.jumpA <= 40, `gl-new: no jump of A's position across the window start (max frame step ${r.jumpA.toFixed(0)} px)`);
    assert(r.a.every((s) => s.luma > 1.15), `gl-new: A keeps its exposure +1.5 effect (mean luma x1.15 or more vs the source) before and inside the window (luma ratios over the shared columns ${r.a.map((s) => s.luma.toFixed(2))})`);
    assert(r.lumaJumpA < 0.15, `gl-new: A's brightness is continuous across the window start (largest step of the luma ratio ${r.lumaJumpA.toFixed(2)})`);
    assert(r.b.every((s) => Math.abs(s.px - s.expect) <= 32), `gl-new: B keeps its keyed x position at the end of and after the window (expected ${r.b.map((s) => s.expect.toFixed(0))}, got ${r.b.map((s) => s.px.toFixed(0))})`);
  }
  if (report['gl-legacy']) {
    const r = report['gl-legacy'];
    assert(r.jumpA > 100 && r.lumaJumpA > 0.2, `gl-legacy (raw frames, the old behaviour): the discontinuity is measurable (A position jump ${r.jumpA.toFixed(0)} px, luma ratio jump ${r.lumaJumpA.toFixed(2)})`);
  }

  // ---- compound: own anim x -30 -> +30 % over 6 s, exposure +1.5; A plays source 0..3 s at timeline 0..3, B plays source 0..3 s at timeline 3..6
  if (outs['comp-new']) {
    const f = outs['comp-new']; const rows = [];
    for (const [t, src] of [[0.5, 'A'], [1.5, 'A'], [2.5, 'A'], [3.5, 'B'], [4.5, 'B'], [5.4, 'B']]) {
      const st = src === 'A' ? t : t - 3; const e = gray(f, t); const s = gray(srcFile(src), st); const base = outs['comp-base'] ? gray(outs['comp-base'], t) : null;
      const sh = shift(e, s); const bsh = base ? shift(base, s) : null;
      rows.push({ t, src, px: sh.px, expect: (-30 + 10 * t) * (PXW / 100), ncc: sh.ncc, luma: lumaRatio(e, s, sh.px), baseLuma: base ? lumaRatio(base, s, bsh.px) : null, basePx: bsh ? bsh.px : null });
    }
    console.log('compound (shift px / expected px / luma ratio vs source / baseline-without-look shift & luma):');
    rows.forEach((r) => console.log(`  t=${r.t} ${r.src}: shift ${r.px.toFixed(0)} expected ${r.expect.toFixed(0)} ncc ${r.ncc.toFixed(2)} luma x${r.luma.toFixed(2)}; baseline shift ${r.basePx === null ? '-' : r.basePx.toFixed(0)} luma x${r.baseLuma === null ? '-' : r.baseLuma.toFixed(2)}`));
    report.compound = rows;
    assert(rows.every((r) => Math.abs(r.px - r.expect) <= 32), 'compound: the compound clip\'s own keyed x applies to both children in the exported frames (continuous across the A|B cut at 3 s)');
    assert(rows.every((r) => r.luma > r.baseLuma * 1.15), 'compound: the compound clip\'s own exposure effect brightens both children vs the same timeline without the look');
    assert(rows.every((r) => Math.abs(r.basePx) <= 16), 'compound baseline (no look) is not shifted');
  }
  fs.writeFileSync(path.join(DIR, 'fixa-export-results.json'), JSON.stringify({ assertions: results, report }, null, 1));
  process.exit(failed ? 1 : 0);
})();
