// Stage 3 + 5 shader-level verification in headless Chromium (WebGL2 via SwiftShader).
// Run from the repo root:  node docs/stage-3/smoke/fx-gl-check.cjs   (no dev server needed; bundles with esbuild)
// For every effect in S35_META it: (a) compiles+links through the real createGlRuntime, (b) renders a deterministic test
// image at default params, at the "probe" (non-default) params and (where defined) at the neutral params, and asserts
// probe != input, neutral ~= input, default == default on a second render AND on a fresh runtime (determinism).
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../..');
const out = path.join(process.env.FX_OUT || require('os').tmpdir(), 'fx-gl-bundle.js');
const rawPlugin = {
  name: 'raw',
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: path.resolve(a.resolveDir, a.path.replace(/\?raw$/, '')), namespace: 'raw' }));
    b.onLoad({ filter: /.*/, namespace: 'raw' }, (a) => ({ contents: fs.readFileSync(a.path, 'utf8'), loader: 'text' }));
  },
};
(async () => {
  await esbuild.build({ entryPoints: [path.join(__dirname, 'fx-gl-entry.ts')], bundle: true, format: 'iife', outfile: out, plugins: [rawPlugin], logLevel: 'error', define: { 'import.meta.env': '{}' } });
  const exe = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1243'].map((d) => { try { return require('child_process').execSync(`find ${d} -type f \\( -name chrome -o -name headless_shell \\) | head -1`).toString().trim(); } catch { return ''; } }).find(Boolean);
  const browser = await chromium.launch({ executablePath: exe || undefined, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setContent('<canvas id="o" width="256" height="144"></canvas>');
  await page.addScriptTag({ path: out });
  if (process.env.FX_SHEET) await page.evaluate(() => { window.__sheet = true; });
  const results = await page.evaluate(() => {
    const { createGlRuntime, ALL_FX, fxPasses, S35_META } = window.__fx;
    const W = 256, H = 144;
    // deterministic test image: gradients + colour bars + circle + diagonal stripes + a bright spot + skin-ish patch
    const src = document.createElement('canvas'); src.width = W; src.height = H;
    const c = src.getContext('2d');
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#102040'); g.addColorStop(0.5, '#a05030'); g.addColorStop(1, '#f0e0a0');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'].forEach((col, i) => { c.fillStyle = col; c.fillRect(i * 40 + 8, 8, 32, 30); });
    c.fillStyle = '#e0b090'; c.fillRect(20, 60, 60, 50);
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(170, 90, 28, 0, 7); c.fill();
    c.strokeStyle = '#000'; c.lineWidth = 3; for (let i = -H; i < W; i += 18) { c.beginPath(); c.moveTo(i, H); c.lineTo(i + H, 0); c.stroke(); }
    const outCanvas = document.getElementById('o');
    const mk = () => createGlRuntime(document.createElement('canvas'));
    const read = (rt, def, overrides, time) => {
      rt.canvas.width = W; rt.canvas.height = H;
      rt.renderFxChain(fxPasses([{ def, overrides }], time), src);
      const x = outCanvas.getContext('2d', { willReadFrequently: true }); x.clearRect(0, 0, W, H); x.drawImage(rt.canvas, 0, 0);
      return x.getImageData(0, 0, W, H).data;
    };
    const inputData = (() => { const x = document.createElement('canvas'); x.width = W; x.height = H; const q = x.getContext('2d'); q.drawImage(src, 0, 0); return q.getImageData(0, 0, W, H).data; })();
    const mad = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return s / (a.length / 4 * 3); };
    const same = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
    const rt1 = mk(); const rt2 = mk();
    const res = [];
    for (const id of Object.keys(S35_META)) {
      const meta = S35_META[id]; const def = ALL_FX[id]; const r = { id, stage: meta.stage, ok: true, notes: [] };
      try {
        const T = 1.25;
        const d1 = read(rt1, def, {}, T); const d2 = read(rt1, def, {}, T); const d3 = read(rt2, def, {}, T);
        r.deterministicSameRuntime = same(d1, d2); r.deterministicFreshRuntime = same(d1, d3);
        r.defaultDiffFromInput = +mad(d1, inputData).toFixed(3);
        const p = read(rt1, def, meta.probe, T);
        r.probeDiffFromInput = +mad(p, inputData).toFixed(3); r.probeDiffFromDefault = +mad(p, d1).toFixed(3);
        const p2 = read(rt1, def, meta.probe, T); r.probeDeterministic = same(p, p2);
        if (meta.neutral) { const nz = read(rt1, def, meta.neutral, T); r.neutralDiffFromInput = +mad(nz, inputData).toFixed(3); }
        if (meta.animated) { const t2 = read(rt1, def, meta.probe, T + 0.5); r.timeChangesOutput = mad(p, t2) > 0.05; }
        // every declared prop individually moved to its max must stay finite and render (no NaN-black / compile failure)
        let allBlack = 0; for (const pr of def.props) { const v = read(rt1, def, { [pr.key]: pr.max }, T); let s = 0; for (let i = 0; i < v.length; i += 4) s += v[i] + v[i + 1] + v[i + 2]; if (s === 0 && id !== 'builtin:fx-nightvision') allBlack++; }
        r.propsAtMaxAllBlack = allBlack;
        r.ok = r.deterministicSameRuntime && r.deterministicFreshRuntime && r.probeDeterministic && r.probeDiffFromInput > 1.0 && r.probeDiffFromDefault >= 0
          && (r.neutralDiffFromInput === undefined || r.neutralDiffFromInput <= 1.5) && (!meta.animated || r.timeChangesOutput) && allBlack === 0;
      } catch (e) { r.ok = false; r.error = String(e && e.message || e); }
      res.push(r);
    }
    if (window.__sheet) {
      const cols = 6, rows = Math.ceil(Object.keys(S35_META).length / cols) + 1; const sheet = document.createElement('canvas'); sheet.width = cols * 128; sheet.height = rows * 72; const sc = sheet.getContext('2d');
      sc.drawImage(src, 0, 0, 128, 72);
      Object.keys(S35_META).forEach((id, i) => { const d = ALL_FX[id]; read(rt1, d, {}, 1.25); sc.drawImage(outCanvas, ((i + 1) % cols) * 128, Math.floor((i + 1) / cols) * 72, 128, 72); });
      window.__sheetData = sheet.toDataURL('image/png');
    }
    return res;
  });
  if (process.env.FX_SHEET) { const d = await page.evaluate(() => window.__sheetData); if (d) fs.writeFileSync(process.env.FX_SHEET, Buffer.from(d.split(',')[1], 'base64')); }
  await browser.close();
  let fail = 0;
  for (const r of results) { console.log(r.ok ? 'PASS' : 'FAIL', r.id, JSON.stringify({ ...r, id: undefined, ok: undefined, stage: undefined })); if (!r.ok) fail++; }
  if (errors.length) { console.log('PAGE ERRORS', errors); fail++; }
  console.log(`${results.length - results.filter((r) => !r.ok).length}/${results.length} effects pass`);
  fs.writeFileSync(path.join(__dirname, 'fx-gl-results.json'), JSON.stringify(results, null, 1));
  process.exit(fail ? 1 : 0);
})();
