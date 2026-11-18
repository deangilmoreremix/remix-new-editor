// Fix B3 smoke: scene scan in a Web Worker, real Chromium, real mp4 with 3 hard cuts (cuts.mp4, see docs/stage-4/smoke/stage4-lib-browser.cjs for the ffmpeg line).
// Run: npx vite --port 3100 ; SMOKE_DIR=<dir with cuts.mp4> CHROMIUM_PATH=... node fixb-scenes.cjs
const { chromium } = require('playwright');
const path = require('path');
const DIR = process.env.SMOKE_DIR || __dirname;
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const pg = await b.newPage({ viewport: { width: 1200, height: 800 } });
  pg.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 300)));
  await pg.addInitScript(() => { // count workers created by the page
    const W = window.Worker; window.__workers = []; window.Worker = function (...a) { const w = new W(...a); window.__workers.push({ url: String(a[0]), terminated: false, w }); const t = w.terminate.bind(w); w.terminate = () => { window.__workers[window.__workers.length - 1].terminated = true; t(); }; return w; };
  });
  const bytes = require('fs').readFileSync(path.join(DIR, 'cuts.mp4'));
  await pg.route('**/__cuts.mp4', (r) => {
    const m = /bytes=(\d*)-(\d*)/.exec(r.request().headers().range || '');
    const h = { 'accept-ranges': 'bytes', 'content-type': 'video/mp4', 'access-control-allow-origin': '*' };
    if (!m) return r.fulfill({ status: 200, headers: { ...h, 'content-length': String(bytes.length) }, body: bytes });
    const a = m[1] ? Number(m[1]) : 0; const z = m[2] ? Math.min(Number(m[2]), bytes.length - 1) : bytes.length - 1;
    return r.fulfill({ status: 206, headers: { ...h, 'content-range': `bytes ${a}-${z}/${bytes.length}`, 'content-length': String(z - a + 1) }, body: bytes.subarray(a, z + 1) });
  });
  await pg.goto('http://127.0.0.1:3100/#/timeline', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(8000);
  const caps = await pg.evaluate(() => ({ worker: typeof Worker, offscreen: typeof OffscreenCanvas, vd: typeof VideoDecoder }));
  console.log('capabilities', JSON.stringify(caps));

  const run = (useWorker) => pg.evaluate(async (useWorker) => {
    const m = await import('/src/cinegen/lib/scenes/scan-video.ts');
    const progress = []; const t0 = performance.now();
    // main-thread responsiveness: a 10 ms timer; the largest gap while scanning
    let last = performance.now(); let maxGap = 0; const iv = setInterval(() => { const n = performance.now(); maxGap = Math.max(maxGap, n - last); last = n; }, 10);
    const before = window.__workers.length;
    const scenes = await m.scanScenes('cuts', '/__cuts.mp4', { assetName: 'cuts.mp4', thumbnails: true, useWorker, onProgress: (f, p) => progress.push([Math.round(f * 1000) / 1000, p]) });
    clearInterval(iv);
    return { ms: Math.round(performance.now() - t0), maxGap: Math.round(maxGap), workersCreated: window.__workers.length - before, progress, scenes: scenes.map((s) => ({ a: s.startSec, b: s.endSec, thumbOk: (s.thumb || '').startsWith('data:image/jpeg') && s.thumb.length > 500 })) };
  }, useWorker);

  await run(true); // warm-up: the first call also compiles the modules on the main thread
  const w = await run(true);
  console.log('worker run', JSON.stringify({ ms: w.ms, maxGap: w.maxGap, workers: w.workersCreated, cuts: w.scenes.map((s) => s.a.toFixed(3)), nProgress: w.progress.length }));
  const want = [2.0, 4.4, 6.0];
  assert(w.workersCreated === 1, 'a Web Worker was created for the scan');
  assert(w.scenes.length === 4, 'worker: 4 scenes (3 cuts)');
  assert(w.scenes.slice(1).every((s, i) => Math.abs(s.a - want[i]) <= 0.1), 'worker: cuts within 0.1 s of 2.0 / 4.4 / 6.0: ' + w.scenes.slice(1).map((s) => s.a.toFixed(3)).join(', '));
  assert(w.scenes.every((s) => s.thumbOk), 'worker: every scene has a JPEG thumbnail');
  assert(w.progress.length > 3 && w.progress.every((p, i) => i === 0 || p[0] >= w.progress[i - 1][0] - 0.0001) && w.progress[w.progress.length - 1][0] > 0.9, 'worker: progress is reported and non-decreasing up to ~1');
  assert(new Set(w.progress.map((p) => p[1])).size === 3, 'worker: all three phases reported (scan, refine, thumbs)');

  const m = await run(false);
  console.log('main-thread run', JSON.stringify({ ms: m.ms, maxGap: m.maxGap, workers: m.workersCreated, cuts: m.scenes.map((s) => s.a.toFixed(3)) }));
  assert(w.maxGap < m.maxGap || w.maxGap < 100, 'main thread stays responsive during the worker scan: longest timer gap ' + w.maxGap + ' ms (main-thread scan: ' + m.maxGap + ' ms)');
  assert(m.workersCreated === 0, 'useWorker:false stays on the main thread');
  assert(m.scenes.length === w.scenes.length && m.scenes.every((s, i) => Math.abs(s.a - w.scenes[i].a) <= 0.05 && Math.abs(s.b - w.scenes[i].b) <= 0.05), 'worker and main-thread results agree within 0.05 s (' + w.scenes.map((s) => s.a.toFixed(3)) + ' vs ' + m.scenes.map((s) => s.a.toFixed(3)) + ')');
  assert(m.scenes.slice(1).every((s, i) => Math.abs(s.a - want[i]) <= 0.1), 'main thread (existing path) cuts still 2.0 / 4.4 / 6.0');

  // cancel: worker scan aborted midway -> AbortError, worker terminated
  const c = await pg.evaluate(async () => {
    const mod = await import('/src/cinegen/lib/scenes/scan-video.ts');
    const ac = new AbortController(); const before = window.__workers.length; setTimeout(() => ac.abort(), 150);
    let r; try { await mod.scanScenes('cuts', '/__cuts.mp4', { signal: ac.signal, stepSec: 0.02 }); r = 'finished'; } catch (e) { r = e.name; }
    const ws = window.__workers.slice(before);
    // already-aborted signal never starts a worker
    const ac2 = new AbortController(); ac2.abort(); let r2; try { await mod.scanScenes('cuts', '/__cuts.mp4', { signal: ac2.signal }); r2 = 'finished'; } catch (e) { r2 = e.name; }
    return { r, r2, workers: ws.length, terminated: ws.every((x) => x.terminated), after: window.__workers.length - before };
  });
  console.log('cancel', JSON.stringify(c));
  assert(c.r === 'AbortError' && c.workers === 1 && c.terminated, 'worker scan is cancellable (AbortError) and the worker is terminated');
  assert(c.r2 === 'AbortError' && c.after === 1, 'an already-aborted signal rejects without starting another worker');

  // fallback: a source the worker cannot open (unreachable URL) -> falls back to the main thread, which reports its own error (not a hang)
  const f = await pg.evaluate(async () => {
    const mod = await import('/src/cinegen/lib/scenes/scan-video.ts');
    try { await mod.scanScenes('x', '/__missing.mp4', {}); return 'finished'; } catch (e) { return String(e.message).slice(0, 80); }
  });
  console.log('fallback on bad source:', f);
  assert(f !== 'finished', 'a bad source rejects (worker error then main-thread fallback error)');
  await b.close();
})();
