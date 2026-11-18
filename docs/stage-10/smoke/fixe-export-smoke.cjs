/* global window, btoa, process, console, URL, Buffer */
// Fix E real-export smoke: feeds the REAL export models (src/cinegen/__tests__/editor/fixe-export-model.smoke.test.ts) to the REAL export runner
// (src/export-runner -> Remotion renderMediaOnWeb, VP9/WebM) in headless Chromium and measures the rendered frames with ffmpeg.
//   1. GL transition window: lower-track clip L (V1), V2 clips A -> B with blend `screen` + opacity 0.6, 1 s cross-dissolve at 2-3 s, caption inside the window.
//      Expected pixel = 0.4*L + 0.6*screen(L, mix(A,B,smoothstep(p))) from the decoded source pixels; frames before / inside / after the window.
//   2. Compound group: A (V1 0-4) + B (V2 2-6) overlap 2-4 s, group opacity 0.5: group render vs per-child (bake) render.
// Run: ffmpeg lavfi solid-colour webm (A c82828, B 1e3cdc, L 608040, 640x360 30 fps 8 s) into $FIXE_DIR/media; `npx vite --port 3110 --strictPort &`;
//   FIXE_MODEL_OUT=$FIXE_DIR/models FIXE_MEDIA_BASE=http://127.0.0.1:3110/__fixe npx vitest run src/cinegen/__tests__/editor/fixe-export-model.smoke.test.ts
//   FIXE_DIR=$FIXE_DIR node docs/stage-10/smoke/fixe-export-smoke.cjs
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const DIR = process.env.FIXE_DIR; const PORT = process.env.FIXE_PORT || '3110';
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
let failed = 0; const results = {}; const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); results[m] = !!c; if (!c) failed++; };
// frames are addressed by NUMBER (select=eq(n,F)), not by -ss (which returns the next frame for a mid-frame time)
const rgb = (file, t, x = 640, y = 200) => { const b = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `select=eq(n\\,${Math.round(t * 30)}),crop=8:8:${x}:${y},scale=1:1:flags=area`, '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-']); return [b[0], b[1], b[2]]; };
const white = (file, t) => { const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `select=eq(n\\,${Math.round(t * 30)}),crop=iw:ih*0.5:0:ih*0.5,format=rgb24`, '-frames:v', '1', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 }); let n = 0; for (let i = 0; i < raw.length; i += 3) if (raw[i] > 235 && raw[i + 1] > 235 && raw[i + 2] > 235) n++; return n; };
const src = (n) => path.join(DIR, 'media', `${n}.webm`);
const maxErr = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const screen = (cb, cs) => cb.map((b, i) => { const B = b / 255; const S = cs[i] / 255; return (B + S - B * S) * 255; });
const mix = (a, b, p) => a.map((v, i) => v + (b[i] - v) * p);
const smooth = (u) => u * u * (3 - 2 * u);

async function render(page, model) {
  return page.evaluate((m) => new Promise((resolve, reject) => {
    const id = 'r' + Math.random();
    const onMsg = async (e) => {
      const d = e.data || {}; if (d.id !== id) return;
      if (d.type === 'error') { window.removeEventListener('message', onMsg); reject(new Error(d.message)); }
      if (d.type === 'done') { window.removeEventListener('message', onMsg); const buf = new Uint8Array(await d.blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); resolve({ b64: btoa(s) }); }
    };
    window.addEventListener('message', onMsg);
    window.postMessage({ type: 'render', id, model: m, options: { container: 'webm', videoCodec: 'vp9', quality: '720p' } }, '*');
  }), model);
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const outs = {};
  for (const name of (process.env.FIXE_ONLY ? process.env.FIXE_ONLY.split(',') : ['win-new', 'win-raw', 'grp-group', 'grp-baked'])) {
    const outPath = path.join(DIR, `export-${name}.webm`);
    if (process.env.FIXE_REUSE && fs.existsSync(outPath)) { outs[name] = outPath; continue; }
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') console.log('CON', m.text().slice(0, 200)); });
    await page.route('**/__fixe/*.webm', async (route) => {
      const buf = fs.readFileSync(src(path.basename(new URL(route.request().url()).pathname, '.webm')));
      const range = route.request().headers()['range']; const h = { 'content-type': 'video/webm', 'accept-ranges': 'bytes', 'access-control-allow-origin': '*' };
      if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const s = +m[1]; const e = m[2] ? +m[2] : buf.length - 1; return route.fulfill({ status: 206, headers: { ...h, 'content-range': `bytes ${s}-${e}/${buf.length}` }, body: buf.subarray(s, e + 1) }); }
      return route.fulfill({ status: 200, headers: h, body: buf });
    });
    await page.goto(`http://127.0.0.1:${PORT}/export-runner.html`);
    await page.waitForFunction(() => typeof window.VideoEncoder === 'function', null, { timeout: 30000 });
    const model = JSON.parse(fs.readFileSync(path.join(DIR, 'models', `${name}.json`), 'utf8'));
    model.durationInFrames = +process.env.FIXE_FRAMES || 180;
    const t0 = Date.now(); const r = await render(page, model);
    fs.writeFileSync(outPath, Buffer.from(r.b64, 'base64'));
    console.log(`${name}: rendered ${(fs.statSync(outPath).size / 1024).toFixed(0)} KiB in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    outs[name] = outPath; await page.close();
  }
  await browser.close();

  const report = {};
  // ---- 1. GL window. frame f at t=(f+0.5)/30; the window is frames 60..89 (progress = (f-60)/29)
  const L = rgb(src('L'), 1); const A = rgb(src('A'), 1); const B = rgb(src('B'), 1);
  console.log('decoded source colours L/A/B:', L, A, B);
  const expectAt = (f) => { const u = f < 60 ? -1 : f > 89 ? 2 : (f - 60) / 29; const C = u < 0 ? A : u > 1 ? B : mix(A, B, smooth(u)); const S = screen(L, C); return mix(L, S, 0.6); };
  const frames = [50, 56, 58, 59, 60, 61, 62, 66, 74, 82, 88, 89, 90, 91, 92, 96];
  for (const name of ['win-new', 'win-raw']) {
    if (!outs[name]) continue;
    const rows = frames.map((f) => { const m = rgb(outs[name], f / 30); const e = expectAt(f); return { f, m, e: e.map(Math.round), err: maxErr(m, e) }; });
    report[name] = rows;
    console.log(name, '(frame: measured vs expected, max channel error)'); rows.forEach((r) => console.log(`  f${r.f}: ${r.m} vs ${r.e} err ${r.err.toFixed(1)}`));
    // largest frame-to-frame step of the measured value compared with the step of the expected value (continuity)
    const steps = rows.slice(1).filter((r, i) => r.f - rows[i].f === 1).map((r) => { const p = rows.find((x) => x.f === r.f - 1); return Math.max(...r.m.map((v, i) => Math.abs(v - p.m[i]) - Math.abs(r.e[i] - p.e[i]))); });
    report[name].excessStep = Math.max(...steps);
    console.log(`${name}: largest excess frame step vs expected ${report[name].excessStep.toFixed(1)}`);
  }
  if (report['win-new']) {
    const r = report['win-new'];
    assert(r.every((x) => x.err <= 14), `win-new: before / inside / after the window the picture equals 0.4*lower + 0.6*screen(lower, A->B) within 14 levels (max error ${Math.max(...r.map((x) => x.err)).toFixed(1)})`);
    assert(r.excessStep <= 10, `win-new: no discontinuity across the window start (f59->f60) and end (f89->f90): excess step ${r.excessStep.toFixed(1)} levels`);
    const cap = outs['win-new'] ? { before: white(outs['win-new'], 1.5), inside: white(outs['win-new'], 2.6) } : null; report.caption = cap;
    console.log('caption white pixels in the lower half: t=1.5', cap.before, 't=2.6 (inside the window)', cap.inside);
    assert(cap.inside > 400 && cap.before < 50, `win-new: the clip caption is visible inside the window (${cap.inside} white pixels vs ${cap.before} before it starts)`);
  }
  if (report['win-raw']) assert(Math.max(...report['win-raw'].filter((x) => x.f >= 60 && x.f <= 89).map((x) => x.err)) > 30, 'win-raw (specs without looks: raw frames on top, opaque): the window does NOT show the blended lower track (error > 30) - the old behaviour the fix replaces');

  // ---- 2. compound group: A (V1 0-4), B (V2 2-6) overlap 2-4; group opacity 0.5 over black. t=1 A only, t=3 overlap, t=5 B only
  for (const name of ['grp-group', 'grp-baked']) {
    if (!outs[name]) continue;
    report[name] = [1, 3, 5].map((t) => ({ t, m: rgb(outs[name], t) }));
    console.log(name, report[name].map((x) => `t=${x.t}: ${x.m}`).join('  '));
  }
  if (report['grp-group'] && report['grp-baked']) {
    const g = report['grp-group']; const b = report['grp-baked'];
    const half = (c) => c.map((v) => v * 0.5);
    assert(maxErr(g[0].m, half(A)) <= 12 && maxErr(g[2].m, half(B)) <= 12, `group: A alone and B alone are at 50 % (${g[0].m} ~ ${half(A).map(Math.round)}, ${g[2].m} ~ ${half(B).map(Math.round)})`);
    assert(maxErr(g[1].m, half(B)) <= 12, `group: the overlap (B over A) is ONE 50 % layer = 0.5*B (${g[1].m} vs ${half(B).map(Math.round)}): the overlap is not double-darkened / A does not bleed through`);
    const perChild = [0, 1, 2].map((i) => 0.5 * B[i] + 0.5 * 0.5 * A[i]);
    assert(maxErr(b[1].m, perChild) <= 12 && maxErr(g[1].m, b[1].m) >= 25, `per-child (bake): the overlap is 0.5*B + 0.25*A (${b[1].m} vs ${perChild.map(Math.round)}) and differs from the group render by ${maxErr(g[1].m, b[1].m).toFixed(0)} levels`);
  }
  fs.writeFileSync(path.join(DIR, 'fixe-export-results.json'), JSON.stringify({ assertions: results, report }, null, 1));
  process.exit(failed ? 1 : 0);
})();
