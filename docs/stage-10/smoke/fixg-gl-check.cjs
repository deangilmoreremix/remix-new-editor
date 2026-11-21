// Fix G shader-level verification of Pixel Sort in headless Chromium (WebGL2 via SwiftShader).
// Run from the repo root:  node docs/stage-10/smoke/fixg-gl-check.cjs   (no dev server; bundles with esbuild)
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../..');
const out = path.join(process.env.FX_OUT || require('os').tmpdir(), 'fixg-gl-bundle.js');
const rawPlugin = {
  name: 'raw',
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: path.resolve(a.resolveDir, a.path.replace(/\?raw$/, '')), namespace: 'raw' }));
    b.onLoad({ filter: /.*/, namespace: 'raw' }, (a) => ({ contents: fs.readFileSync(a.path, 'utf8'), loader: 'text' }));
  },
};
(async () => {
  await esbuild.build({ entryPoints: [path.join(__dirname, 'fixg-gl-entry.ts')], bundle: true, format: 'iife', outfile: out, plugins: [rawPlugin], logLevel: 'error', define: { 'import.meta.env': '{}' } });
  const exe = '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
  const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setContent('<canvas id="o"></canvas>');
  await page.addScriptTag({ path: out });
  const results = await page.evaluate(() => {
    const { createGlRuntime, ALL_FX, fxPasses, pixelSortCpu, sortKey } = window.__fx;
    const W = 257, H = 151; // odd, non-square
    const def = ALL_FX['builtin:fx-pixel-sort'];
    // synthetic gradient + deterministic noise (mulberry32)
    let seed = 12345; const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const src = document.createElement('canvas'); src.width = W; src.height = H;
    const sc = src.getContext('2d'); const im = sc.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4; const g = x / (W - 1);
      im.data[i] = Math.min(255, Math.max(0, Math.round(255 * g * 0.9 + rnd() * 90 - 20)));
      im.data[i + 1] = Math.min(255, Math.max(0, Math.round(255 * (1 - y / (H - 1)) * 0.8 + rnd() * 100 - 20)));
      im.data[i + 2] = Math.min(255, Math.max(0, Math.round(120 + 100 * Math.sin(x / 9 + y / 13) + rnd() * 60 - 30)));
      im.data[i + 3] = 255;
    }
    sc.putImageData(im, 0, 0);
    const inputData = sc.getImageData(0, 0, W, H).data;
    const outCanvas = document.getElementById('o'); outCanvas.width = W; outCanvas.height = H;
    const oc = outCanvas.getContext('2d', { willReadFrequently: true });
    const mk = () => createGlRuntime(document.createElement('canvas'));
    const readChain = (rt, chain) => {
      rt.canvas.width = W; rt.canvas.height = H;
      const passes = fxPasses(chain, 0);
      rt.renderFxChain(passes, src);
      oc.clearRect(0, 0, W, H); oc.drawImage(rt.canvas, 0, 0);
      return { data: oc.getImageData(0, 0, W, H).data, passes: passes.length };
    };
    const read = (rt, o) => readChain(rt, [{ def, overrides: o }]);
    const maxDiff = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };
    const same = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
    const toPx = (d) => { const o = new Array(W * H); for (let i = 0; i < W * H; i++) o[i] = { r: d[i * 4] / 255, g: d[i * 4 + 1] / 255, b: d[i * 4 + 2] / 255, a: d[i * 4 + 3] / 255 }; return o; };
    const rt1 = mk(); const rt2 = mk();
    const R = { checks: [], size: [W, H] };
    const ok = (name, pass, info) => R.checks.push({ name, pass: !!pass, info });
    const px = (d, i) => ({ r: d[i * 4] / 255, g: d[i * 4 + 1] / 255, b: d[i * 4 + 2] / 255, a: 1 });
    const inMask = (p, s) => { const k = sortKey(p, s.key); const inside = k >= s.low && k <= s.high; return s.invert > 0.5 ? !inside : inside; };

    // 1. compile / link / render at defaults
    let dflt; try { dflt = read(rt1, {}); ok('compiles, links and renders at defaults (' + dflt.passes + ' passes)', dflt.passes === 33, dflt.passes); } catch (e) { ok('compiles and renders at defaults', false, String(e)); return R; }
    ok('defaults change the picture', maxDiff(dflt.data, inputData) > 10, maxDiff(dflt.data, inputData));

    // 2. identity at neutral settings
    for (const o of [{ length: 0 }, { low: 1, high: 0 }, { strength: 0 }, { low: 1, high: 0, length: 64 }]) {
      const r = read(rt1, o); ok('identity at neutral ' + JSON.stringify(o) + ' (passes ' + r.passes + ')', maxDiff(r.data, inputData) === 0, maxDiff(r.data, inputData));
    }

    // 3. sorted runs: invariants + CPU twin, several parameter sets
    const cases = [
      { name: 'horizontal luma ascending, window 0.25..0.85, 64 passes', o: { low: 0.25, high: 0.85, key: 0, axis: 0, ascending: 1, length: 64, strength: 1, invert: 0 } },
      { name: 'vertical hue descending inverted mask, 48 passes', o: { low: 0.2013, high: 0.6007, key: 1, axis: 1, ascending: 0, length: 48, strength: 1, invert: 1 } },
      { name: 'horizontal saturation ascending, 20 passes', o: { low: 0.1013, high: 1, key: 2, axis: 0, ascending: 1, length: 20, strength: 1, invert: 0 } },
      { name: 'vertical brightness ascending, 64 passes', o: { low: 0.3, high: 0.95, key: 3, axis: 1, ascending: 1, length: 64, strength: 1, invert: 0 } },
    ];
    for (const c of cases) {
      const s = c.o; const g = read(rt1, s).data;
      const vert = s.axis > 0.5; const lines = vert ? W : H; const len = vert ? H : W;
      const at = (line, i) => (vert ? i * W + line : line * W + i);
      let unmaskedChanged = 0, unmaskedTotal = 0, multisetBad = 0, runsChecked = 0, runsMonotone = 0, longRuns = 0, tested = 0;
      for (let line = 0; line < lines; line++) {
        const idx = []; for (let i = 0; i < len; i++) idx.push(at(line, i));
        // unmasked (by INPUT) pixels unchanged
        for (const p of idx) { if (!inMask(px(inputData, p), s)) { unmaskedTotal++; for (let ch = 0; ch < 4; ch++) if (g[p * 4 + ch] !== inputData[p * 4 + ch]) { unmaskedChanged++; break; } } }
        // multiset of the line preserved
        const cnt = new Map(); for (const p of idx) { const k = inputData[p * 4] * 65536 + inputData[p * 4 + 1] * 256 + inputData[p * 4 + 2]; cnt.set(k, (cnt.get(k) || 0) + 1); }
        for (const p of idx) { const k = g[p * 4] * 65536 + g[p * 4 + 1] * 256 + g[p * 4 + 2]; cnt.set(k, (cnt.get(k) || 0) - 1); }
        for (const v of cnt.values()) if (v !== 0) { multisetBad++; break; }
        // maximal masked runs (from the input mask); a run of length <= passes must be completely sorted
        let i = 0;
        while (i < len) {
          if (!inMask(px(inputData, idx[i]), s)) { i++; continue; }
          let j = i; while (j + 1 < len && inMask(px(inputData, idx[j + 1]), s)) j++;
          const L = j - i + 1; tested++;
          if (L >= 2 && L <= s.length) {
            runsChecked++; let mono = true;
            for (let t = i; t < j; t++) { const ka = sortKey(px(g, idx[t]), s.key); const kb = sortKey(px(g, idx[t + 1]), s.key); if (s.ascending > 0.5 ? ka > kb + 1e-5 : ka < kb - 1e-5) { mono = false; break; } }
            if (mono) runsMonotone++;
          } else if (L > s.length) longRuns++;
          i = j + 1;
        }
      }
      ok(c.name + ': unmasked pixels bit-identical (' + unmaskedTotal + ' px)', unmaskedTotal > 0 && unmaskedChanged === 0, unmaskedChanged);
      ok(c.name + ': every line is a permutation of the input line', multisetBad === 0, multisetBad);
      ok(c.name + ': ' + runsChecked + ' fully-reachable runs all monotone in the key (' + longRuns + ' longer runs only partly sorted)', runsChecked >= 20 && runsMonotone === runsChecked, runsMonotone + '/' + runsChecked);
      const cpu = pixelSortCpu(toPx(inputData), W, H, s); let bad = 0;
      for (let i = 0; i < W * H; i++) if (Math.abs(cpu[i].r * 255 - g[i * 4]) > 0.5 || Math.abs(cpu[i].g * 255 - g[i * 4 + 1]) > 0.5 || Math.abs(cpu[i].b * 255 - g[i * 4 + 2]) > 0.5) bad++;
      ok(c.name + ': GPU equals CPU reference (' + bad + ' of ' + W * H + ' px differ; allowed 0.1% for f32 vs f64 key ties)', bad <= W * H * 0.001, bad);
    }

    // 4. determinism: same runtime twice, fresh runtime, and after rendering something else in between
    const a = read(rt1, cases[0].o).data; read(rt1, cases[1].o); const b = read(rt1, cases[0].o).data; const c3 = read(rt2, cases[0].o).data;
    ok('deterministic: same runtime twice (with another render in between)', same(a, b));
    ok('deterministic: fresh runtime', same(a, c3));
    // 5. strength blend: strength 0.5 == mix of original and sorted within 1 level
    const full = read(rt1, { ...cases[0].o, strength: 1 }); const half = read(rt1, { ...cases[0].o, strength: 0.5 });
    let worst = 0; for (let i = 0; i < full.data.length; i += 4) for (let ch = 0; ch < 3; ch++) worst = Math.max(worst, Math.abs(half.data[i + ch] - (inputData[i + ch] + full.data[i + ch]) / 2));
    ok('strength 0.5 = mean of original and sorted (+1 mix pass = ' + half.passes + ' passes), worst error in levels', worst <= 1.01 && half.passes === full.passes + 1, worst);
    // 6. chained with another effect (slot rebase): sort then invert == 255 - sorted
    const inv = ALL_FX['builtin:fx-invert'];
    const ch = readChain(rt1, [{ def, overrides: cases[0].o }, { def: inv, overrides: {} }]);
    let wi = 0; for (let i = 0; i < full.data.length; i += 4) for (let k = 0; k < 3; k++) wi = Math.max(wi, Math.abs(ch.data[i + k] - (255 - full.data[i + k])));
    ok('chain [pixel sort, invert] equals invert(sorted) (passes ' + ch.passes + ')', wi <= 1, wi);
    const ch2 = readChain(rt1, [{ def: inv, overrides: {} }, { def, overrides: cases[0].o }]);
    const invIn = new Uint8ClampedArray(inputData.length); for (let i = 0; i < invIn.length; i++) invIn[i] = i % 4 === 3 ? 255 : 255 - inputData[i];
    const cpu2 = pixelSortCpu(toPx(invIn), W, H, cases[0].o); let bad2 = 0;
    for (let i = 0; i < W * H; i++) if (Math.abs(cpu2[i].r * 255 - ch2.data[i * 4]) > 0.5 || Math.abs(cpu2[i].g * 255 - ch2.data[i * 4 + 1]) > 0.5 || Math.abs(cpu2[i].b * 255 - ch2.data[i * 4 + 2]) > 0.5) bad2++;
    ok('chain [invert, pixel sort] equals CPU sort of inverted input (' + bad2 + ' px differ)', bad2 <= W * H * 0.001, bad2);
    // 7. every prop at its max/min still renders
    let propFail = 0; for (const p of def.props) for (const v of [p.min, p.max]) { try { read(rt1, { [p.key]: v }); } catch (e) { propFail++; } }
    ok('every prop at min and max renders (' + def.props.length * 2 + ' renders)', propFail === 0, propFail);
    // 8. timing (documents the cost on software GL)
    const t0 = performance.now(); read(rt1, { ...cases[0].o, length: 64 }); const t1 = performance.now(); read(rt1, { ...cases[0].o, length: 0 }); const t2 = performance.now();
    R.timing = { ms64passes_257x151_swiftshader: +(t1 - t0).toFixed(1), ms0passes: +(t2 - t1).toFixed(1) };
    return R;
  });
  let fail = 0;
  for (const c of results.checks) { console.log((c.pass ? 'PASS ' : 'FAIL ') + c.name + (c.info !== undefined ? '  [' + c.info + ']' : '')); if (!c.pass) fail++; }
  console.log('size', results.size, 'timing', JSON.stringify(results.timing));
  if (errors.length) { console.log('page errors:', errors.slice(0, 5)); fail++; }
  fs.writeFileSync(path.join(__dirname, 'fixg-gl-results.json'), JSON.stringify(results, null, 1));
  await browser.close();
  console.log(fail ? `FAILED (${fail})` : 'ALL PASS');
  process.exit(fail ? 1 : 0);
})();
