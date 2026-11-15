// Fix C shader-level verification in headless Chromium (WebGL2 via SwiftShader): curves LUT, corner pin, pen-path mask.
// Run from the repo root:  node docs/stage-9/smoke/fixc-gl-check.cjs   (no dev server; bundles with esbuild). Compares the GPU output with the CPU twins.
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const { chromium } = require('playwright');
const out = path.join(process.env.FX_OUT || require('os').tmpdir(), 'fixc-gl-bundle.js');
const rawPlugin = {
  name: 'raw',
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: path.resolve(a.resolveDir, a.path.replace(/\?raw$/, '')), namespace: 'raw' }));
    b.onLoad({ filter: /.*/, namespace: 'raw' }, (a) => ({ contents: fs.readFileSync(a.path, 'utf8'), loader: 'text' }));
  },
};
(async () => {
  await esbuild.build({ entryPoints: [path.join(__dirname, 'fixc-gl-entry.ts')], bundle: true, format: 'iife', outfile: out, plugins: [rawPlugin], logLevel: 'error', define: { 'import.meta.env': '{}' } });
  const exe = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1243'].map((d) => { try { return require('child_process').execSync(`find ${d} -type f \\( -name chrome -o -name headless_shell \\) | head -1`).toString().trim(); } catch { return ''; } }).find(Boolean);
  const browser = await chromium.launch({ executablePath: exe || undefined, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setContent('<canvas id="o" width="256" height="144"></canvas>');
  await page.addScriptTag({ path: out });
  const res = await page.evaluate(() => {
    const F = window.__fx;
    const W = 256, H = 144, ASPECT = W / H;
    const src = document.createElement('canvas'); src.width = W; src.height = H;
    const c = src.getContext('2d');
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#102040'); g.addColorStop(0.5, '#a05030'); g.addColorStop(1, '#f0e0a0');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'].forEach((col, i) => { c.fillStyle = col; c.fillRect(i * 40 + 8, 8, 32, 30); });
    c.fillStyle = '#e0b090'; c.fillRect(20, 60, 60, 50);
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(170, 90, 28, 0, 7); c.fill();
    const outCanvas = document.getElementById('o');
    const mk = () => F.createGlRuntime(document.createElement('canvas'));
    const read = (rt, id, overrides) => {
      rt.canvas.width = W; rt.canvas.height = H;
      rt.renderFxChain(F.fxPasses([{ def: F.ALL_FX[id], overrides }], 1), src);
      const x = outCanvas.getContext('2d', { willReadFrequently: true }); x.clearRect(0, 0, W, H); x.drawImage(rt.canvas, 0, 0);
      return x.getImageData(0, 0, W, H).data;
    };
    const inputData = (() => { const x = document.createElement('canvas'); x.width = W; x.height = H; const q = x.getContext('2d'); q.drawImage(src, 0, 0); return q.getImageData(0, 0, W, H).data; })();
    const same = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
    const mad = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return s / (a.length / 4 * 3); };
    const rt1 = mk(); const rt2 = mk();
    const r = {};
    // ---- curves ------------------------------------------------------------------------------------------------------------
    const curveRef = (props) => { const lut = F.buildCurveLut(props); const o = new Uint8ClampedArray(inputData.length); for (let i = 0; i < o.length; i += 4) { for (let k = 0; k < 3; k++) o[i + k] = Math.round(F.lutLookup(lut, k, inputData[i + k] / 255) * 255); o[i + 3] = inputData[i + 3]; } return o; };
    const curves = {};
    curves.identityDiff = +mad(read(rt1, 'builtin:fx-curves', {}), inputData).toFixed(3);
    const legacy = { p1: 0.1, p3: 0.9, r_mid: 0.2 };
    curves.legacyVsCpuRef = +mad(read(rt1, 'builtin:fx-curves', legacy), curveRef(legacy)).toFixed(3);
    curves.legacyDiffFromInput = +mad(read(rt1, 'builtin:fx-curves', legacy), inputData).toFixed(3);
    const scurve = { curve_m: F.pointsToFlat([{ x: 0, y: 0 }, { x: 0.25, y: 0.15 }, { x: 0.75, y: 0.85 }, { x: 1, y: 1 }]), curve_r: F.pointsToFlat([{ x: 0, y: 0.1 }, { x: 1, y: 0.9 }]), curve_g: [0, 0, 1, 1], curve_b: [0, 0, 1, 1] };
    curves.newVsCpuRef = +mad(read(rt1, 'builtin:fx-curves', scurve), curveRef(scurve)).toFixed(3);
    curves.newDiffFromInput = +mad(read(rt1, 'builtin:fx-curves', scurve), inputData).toFixed(3);
    const flatRed = { curve_m: [0, 0.4, 0.5, 0.5, 1, 1], curve_r: [0, 0, 1, 0], curve_g: [0, 0, 1, 1], curve_b: [0, 0, 1, 1] }; // what the editor stores after dragging the red end point to the bottom
    curves.flatRedVsCpuRef = +mad(read(rt1, 'builtin:fx-curves', flatRed), curveRef(flatRed)).toFixed(3);
    curves.flatRedKillsRed = (() => { const d = read(rt1, 'builtin:fx-curves', flatRed); let m = 0; for (let i = 0; i < d.length; i += 4) m = Math.max(m, d[i]); return m === 0; })();
    curves.deterministic = same(read(rt1, 'builtin:fx-curves', scurve), read(rt2, 'builtin:fx-curves', scurve));
    curves.ok = curves.identityDiff <= 1.5 && curves.legacyVsCpuRef <= 1.5 && curves.legacyDiffFromInput > 2 && curves.newVsCpuRef <= 1.5 && curves.newDiffFromInput > 2 && curves.deterministic && curves.flatRedVsCpuRef <= 1.5 && curves.flatRedKillsRed;
    r.curves = curves;
    // ---- corner pin --------------------------------------------------------------------------------------------------------
    const cp = {};
    cp.identityDiff = +mad(read(rt1, 'builtin:fx-corner-pin', {}), inputData).toFixed(3);
    const half = read(rt1, 'builtin:fx-corner-pin', F.propsFromQuad([[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75]]));
    const px = (d, x, y) => { const i = (Math.round(y * H) * W + Math.round(x * W)) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
    // output (0.4, 0.4) shows source (0.1, 0.1) when the frame is shrunk to the centre half... (x - 0.25) / 0.5 -> source (0.3, 0.3)
    const a = px(half, 0.4, 0.4), b = px(inputData, 0.3, 0.3);
    cp.halfSampleDiff = Math.max(...[0, 1, 2].map((k) => Math.abs(a[k] - b[k])));
    cp.halfOutsideAlpha = px(half, 0.1, 0.1)[3]; cp.halfInsideAlpha = px(half, 0.5, 0.5)[3];
    // perspective quad vs CPU inverse homography (bilinear-ish: compare mean abs diff against nearest sampling of the CPU map)
    const quad = [[0.15, 0.1], [0.9, 0.2], [0.8, 0.9], [0.05, 0.75]];
    const persp = read(rt1, 'builtin:fx-corner-pin', F.propsFromQuad(quad));
    const inv = F.quadToSquare(quad);
    let s = 0, n = 0, inside = 0, outsideBad = 0;
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const ux = (x + 0.5) / W, uy = (y + 0.5) / H;
      const w = inv[6] * ux + inv[7] * uy + inv[8];
      const sx = (inv[0] * ux + inv[1] * uy + inv[2]) / w, sy = (inv[3] * ux + inv[4] * uy + inv[5]) / w;
      const i = (y * W + x) * 4;
      if (sx > 0.02 && sx < 0.98 && sy > 0.02 && sy < 0.98) {
        inside++;
        const sxp = Math.min(W - 1, Math.max(0, Math.floor(sx * W))), syp = Math.min(H - 1, Math.max(0, Math.floor(sy * H)));
        const j = (syp * W + sxp) * 4;
        s += (Math.abs(persp[i] - inputData[j]) + Math.abs(persp[i + 1] - inputData[j + 1]) + Math.abs(persp[i + 2] - inputData[j + 2])) / 3; n++;
        if (persp[i + 3] < 250) outsideBad++;
      } else if (sx < -0.02 || sx > 1.02 || sy < -0.02 || sy > 1.02) { if (persp[i + 3] > 5) outsideBad++; }
    }
    cp.perspectiveMeanAbsVsCpuMap = +(s / n).toFixed(3); cp.perspectiveInsidePixels = inside; cp.perspectiveAlphaErrors = outsideBad;
    cp.deterministic = same(persp, read(rt2, 'builtin:fx-corner-pin', F.propsFromQuad(quad)));
    cp.degenerateTransparent = read(rt1, 'builtin:fx-corner-pin', F.propsFromQuad([[0, 0], [1, 1], [0, 1], [1, 0]]))[3] === 0; // bow-tie quad
    cp.ok = cp.identityDiff <= 1.5 && cp.halfSampleDiff <= 12 && cp.halfOutsideAlpha === 0 && cp.halfInsideAlpha === 255 && cp.perspectiveMeanAbsVsCpuMap < 12 && cp.perspectiveAlphaErrors < 40 && cp.deterministic && cp.degenerateTransparent;
    r.cornerPin = cp;
    // ---- path mask ----------------------------------------------------------------------------------------------------------
    const star = []; for (let i = 0; i < 10; i++) { const a2 = (i / 10) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? 0.12 : 0.3; star.push({ x: 0.5 + (rr * Math.cos(a2)) / ASPECT, y: 0.5 + rr * Math.sin(a2), inX: 0, inY: 0, outX: 0, outY: 0 }); }
    const cases = {
      ellipseFeather: { path: F.pathToFlat(F.ellipsePath(0.5, 0.5, 0.25, 0.3)), feather: 0.06 },
      rectInvert: { path: F.pathToFlat(F.rectPath(0.2, 0.25, 0.7, 0.8)), feather: 0.03, invert: 1 },
      starOpacity: { path: F.pathToFlat(star), feather: 0.04, opacity: 0.6 },
      transformed: { path: F.pathToFlat(F.ellipsePath(0.4, 0.5, 0.2, 0.15)), feather: 0.05, rotate: 40, scale: 1.4, offsetX: 0.1, offsetY: -0.05 },
      expanded: { path: F.pathToFlat(F.ellipsePath(0.5, 0.5, 0.2, 0.2)), feather: 0.04, expand: 0.1 },
      animatedAnchor: { path: F.pathToFlat(F.rectPath(0.3, 0.3, 0.7, 0.7)), feather: 0.03, v0x: 0.1, v0y: 0.05 },
    };
    const pm = { cases: {} }; let allOk = true;
    for (const [name, props] of Object.entries(cases)) {
      const d = read(rt1, 'builtin:fx-path-mask', props);
      let maxErr = 0, sum = 0, cnt = 0, partial = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const ref = F.maskAlphaAt(props, (x + 0.5) / W, 1 - (H - y - 0.5) / H, ASPECT); // y is already top-down in the readback
        const got = d[(y * W + x) * 4 + 3] / 255;
        const e = Math.abs(ref - got); maxErr = Math.max(maxErr, e); sum += e; cnt++; if (ref > 0.05 && ref < 0.95) partial++;
      }
      const cm = { maxAlphaErr: +maxErr.toFixed(4), meanAlphaErr: +(sum / cnt).toFixed(5), partialPixels: partial, ok: maxErr < 0.06 && sum / cnt < 0.004 && partial > 30 };
      if (name === 'rectInvert' || name === 'starOpacity') cm.ok = maxErr < 0.06 && sum / cnt < 0.004;
      pm.cases[name] = cm; allOk = allOk && cm.ok;
    }
    pm.fewerThan3PointsIsPassThrough = mad(read(rt1, 'builtin:fx-path-mask', { path: [0.5, 0.5, 0, 0, 0, 0] }), inputData) <= 1.5;
    pm.deterministic = same(read(rt1, 'builtin:fx-path-mask', cases.starOpacity), read(rt2, 'builtin:fx-path-mask', cases.starOpacity));
    pm.ok = allOk && pm.fewerThan3PointsIsPassThrough && pm.deterministic;
    r.pathMask = pm;
    // night vision tint (colour prop): default = old green, a red tint changes the hue
    const nv = {}; const g1 = read(rt1, 'builtin:fx-nightvision', {}); const g2 = read(rt1, 'builtin:fx-nightvision', { tint: [1, 0.1, 0.1] });
    const mean = (d, k) => { let s2 = 0; for (let i = 0; i < d.length; i += 4) s2 += d[i + k]; return s2 / (d.length / 4); };
    nv.defaultGreenDominant = mean(g1, 1) > mean(g1, 0) * 2; nv.redTintRedDominant = mean(g2, 0) > mean(g2, 1) * 2; nv.ok = nv.defaultGreenDominant && nv.redTintRedDominant;
    r.nightvisionTint = nv;
    return r;
  });
  console.log(JSON.stringify(res, null, 2));
  if (errors.length) console.log('PAGE ERRORS', errors);
  fs.writeFileSync(path.join(__dirname, 'fixc-gl-results.json'), JSON.stringify(res, null, 2));
  const ok = Object.values(res).every((v) => v.ok) && !errors.length;
  console.log(ok ? 'ALL PASS' : 'FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
