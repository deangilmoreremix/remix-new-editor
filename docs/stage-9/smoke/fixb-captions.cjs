// Fix B4 smoke: line-rise / line-fade caption motion through the real Remotion preview (Player Thumbnail DOM) and the real web-renderer export (mp4).
// Run: npx vite --port 3100 ; SMOKE_DIR=<out dir>/ CHROMIUM_PATH=... node fixb-captions.cjs   (needs ffmpeg)
const { chromium } = require('playwright');
const fs = require('fs'); const { execFileSync } = require('child_process');
const SP = (process.env.SMOKE_DIR || __dirname) + '/';
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 800, height: 500 } });
  pg.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 300)));
  await pg.goto('http://127.0.0.1:3100/#/timeline', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(6000);
  const H = '/docs/stage-9/smoke/captions-harness.tsx';
  const styles = (motion, frame) => pg.evaluate(async ([H, motion, frame]) => (await import(H)).previewStyles(motion, frame), [H, motion, frame]);
  // frame = ms * 30 / 1000. line 0 = "Rendering animated" starts 500 ms (frame 15), line 1 = "captions line by line" starts 1100 ms (frame 33)
  const f = { before: 12, l0mid: 16, l0done: 27, l1hidden: 30, l1mid: 34, both: 50 };
  const snap = {};
  for (const [k, fr] of Object.entries(f)) snap[k] = await styles('line-rise', fr);
  console.log(JSON.stringify(snap));
  const op = (arr) => arr.map((x) => Number(x[1]));
  assert(snap.before.length === 0 || op(snap.before).every((o) => o === 0), 'preview: before the first line nothing is visible');
  assert(snap.l0mid.length >= 2 && op(snap.l0mid).slice(0, 2).every((o, i, a) => o > 0 && o < 1 && o === a[0]), 'preview: 33 ms into line 0 its two words share one partial opacity ' + op(snap.l0mid).slice(0, 2));
  assert(snap.l0mid.slice(0, 2).every((x) => /translateY/.test(x[2])), 'preview: line 0 words rise (translateY) while animating');
  assert(snap.l0done.slice(0, 2).every((x) => x[1] === '1' && x[2] === ''), 'preview: line 0 settled (opacity 1, no transform)');
  assert(snap.l1hidden.filter((x) => x[1] === '0').length >= 2 && snap.l1hidden.slice(0, 2).every((x) => x[1] === '1'), 'preview: line 1 still hidden while line 0 is settled');
  assert(snap.l1mid.slice(2).some((x) => Number(x[1]) > 0 && Number(x[1]) < 1), 'preview: line 1 rises from its own start');
  assert(snap.both.every((x) => x[1] === '1'), 'preview: all lines settled (opacity 1)');
  // determinism: the same frame twice, and a non-sequential visit order, give identical styles
  assert(JSON.stringify(await styles('line-rise', 16)) === JSON.stringify(snap.l0mid), 'preview: deterministic (frame 16 revisited out of order is identical)');
  const fade = await styles('line-fade', 17);
  assert(fade.length >= 2 && fade.slice(0, 2).every((x) => x[2] === '' && Number(x[1]) > 0 && Number(x[1]) < 1), 'preview: line-fade changes opacity only');

  // export: real web renderer
  const ex = await pg.evaluate(async (H) => { const t = performance.now(); const r = await (await import(H)).exportBlob('line-rise', 3); return { n: r.bytes.length, bytes: r.bytes, ms: Math.round(performance.now() - t) }; }, H).catch((e) => ({ err: String(e).slice(0, 300) }));
  if (ex.err) { assert(false, 'export render failed: ' + ex.err); await b.close(); return; }
  fs.writeFileSync(SP + 'captions-line-rise.mp4', Buffer.from(ex.bytes));
  console.log('export mp4 bytes', ex.n, 'ms', ex.ms);
  const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', SP + 'captions-line-rise.mp4']).toString());
  assert(dur > 2.8 && dur < 3.3, 'export: mp4 of 3 s (' + dur + ' s)');
  // brightness of the text area (lower 60 % of the picture): the background is #101820 (dark), the caption text is light
  const bright = (t) => { const raw = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', SP + 'captions-line-rise.mp4', '-frames:v', '1', '-vf', 'crop=iw:ih*0.6:0:ih*0.4,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 }); let n = 0; for (const v of raw) if (v > 150) n++; return n; };
  const px = { t0_30: bright(0.30), t0_90: bright(0.90), t1_60: bright(1.60), t2_50: bright(2.50) };
  console.log('bright pixels in caption area', JSON.stringify(px));
  assert(px.t0_30 < 50, 'export: nothing drawn before the first line starts');
  assert(px.t0_90 > 300, 'export: line 0 visible at 0.9 s');
  assert(px.t1_60 > px.t0_90 * 1.3, 'export: line 1 adds text by 1.6 s (' + px.t1_60 + ' vs ' + px.t0_90 + ')');
  await b.close();
})();
