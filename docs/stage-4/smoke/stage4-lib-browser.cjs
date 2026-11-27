// Stage 4 browser checks of the library code in real Chromium (dev server on :3100). Needs ffmpeg for the test clip:
//   ffmpeg -f lavfi -i color=c=red:s=320x180:r=25:d=2 -f lavfi -i color=c=green:s=320x180:r=25:d=2.4 -f lavfi -i color=c=blue:s=320x180:r=25:d=1.6 \
//     -f lavfi -i color=c=yellow:s=320x180:r=25:d=2 -f lavfi -i sine=frequency=440:duration=8 -filter_complex "[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0[v]" \
//     -map "[v]" -map 4:a -c:v libx264 -pix_fmt yuv420p -g 25 -c:a aac -shortest cuts.mp4        (hard cuts at 2.0 s, 4.4 s, 6.0 s)
// Run: SMOKE_DIR=<dir with cuts.mp4> node stage4-lib-browser.cjs
const { chromium } = require('playwright');
const path = require('path');
const DIR = process.env.SMOKE_DIR || __dirname;
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const pg = await b.newPage({ viewport: { width: 1200, height: 800 } });
  pg.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 300)));
  // serve the clip WITH byte-range support (a plain fulfill makes Chromium unable to seek, every frame would be frame 0)
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
  console.log('UA', await pg.evaluate(() => navigator.userAgent));

  // 1. scene detection on a real mp4 with 3 hard cuts
  const sc = await pg.evaluate(async () => {
    const m = await import('/src/cinegen/lib/scenes/scan-video.ts');
    const t0 = performance.now();
    const scenes = await m.scanScenes('cuts', '/__cuts.mp4', { assetName: 'cuts.mp4', thumbnails: true });
    return { ms: Math.round(performance.now() - t0), scenes: scenes.map((s) => ({ a: s.startSec, b: s.endSec, thumb: (s.thumb || '').slice(0, 22), thumbLen: (s.thumb || '').length })) };
  });
  console.log('scenes', JSON.stringify(sc));
  const want = [2.0, 4.4, 6.0];
  assert(sc.scenes.length === 4, 'real mp4: 4 scenes (3 cuts) found');
  assert(sc.scenes.slice(1).every((s, i) => Math.abs(s.a - want[i]) <= 0.1), 'cut times within 0.1 s of 2.0 / 4.4 / 6.0: ' + sc.scenes.slice(1).map((s) => s.a.toFixed(3)).join(', '));
  assert(sc.scenes.every((s) => s.thumb.startsWith('data:image/jpeg') && s.thumbLen > 500), 'each scene has a JPEG thumbnail');

  // 1b. cancel
  const cancelled = await pg.evaluate(async () => {
    const m = await import('/src/cinegen/lib/scenes/scan-video.ts');
    const ac = new AbortController(); setTimeout(() => ac.abort(), 300);
    try { await m.scanScenes('cuts', '/__cuts.mp4', { signal: ac.signal, stepSec: 0.02 }); return 'finished'; } catch (e) { return e.name; }
  });
  assert(cancelled === 'AbortError', 'scene scan is cancellable (AbortError): ' + cancelled);

  // 2. EQ coefficients vs the browser's own BiquadFilterNode response
  const eqr = await pg.evaluate(async () => {
    const eq = await import('/src/cinegen/lib/audio/eq.ts');
    const ctx = new OfflineAudioContext(1, 128, 48000);
    const freqs = eq.logFrequencies(64, 30, 18000);
    const cases = [{ type: 'peaking', frequency: 1000, gain: 9, q: 1.4 }, { type: 'peaking', frequency: 250, gain: -7, q: 0.9 }, { type: 'lowshelf', frequency: 150, gain: 8, q: 1 },
      { type: 'highshelf', frequency: 7000, gain: -10, q: 1 }, { type: 'highpass', frequency: 90, gain: 0, q: Math.SQRT1_2 }, { type: 'lowpass', frequency: 9000, gain: 0, q: Math.SQRT1_2 }, { type: 'notch', frequency: 2000, gain: 0, q: 3 }];
    const out = [];
    for (const band of cases) {
      const f = ctx.createBiquadFilter(); f.type = band.type; f.frequency.value = band.frequency; f.gain.value = band.gain; f.Q.value = eq.webAudioQ(band);
      const mag = new Float32Array(freqs.length); const ph = new Float32Array(freqs.length); f.getFrequencyResponse(freqs, mag, ph);
      const c = eq.biquadCoefficients(band, 48000); let maxDiff = 0;
      for (let i = 0; i < freqs.length; i++) { const mine = eq.biquadMagnitudeDb(c, freqs[i], 48000); const theirs = 20 * Math.log10(Math.max(mag[i], 1e-9)); if (band.type === 'notch' && theirs < -60) continue; maxDiff = Math.max(maxDiff, Math.abs(mine - theirs)); }
      out.push({ type: band.type, maxDiff: +maxDiff.toFixed(4) });
    }
    return out;
  });
  console.log('EQ vs BiquadFilterNode', JSON.stringify(eqr));
  assert(eqr.every((r) => r.maxDiff < 0.05), 'EQ response matches BiquadFilterNode.getFrequencyResponse within 0.05 dB for all 7 band types');

  // 3. EQ bake through OfflineAudioContext on a real two-tone signal (200 Hz + 5 kHz), measured with a Goertzel filter
  const bake = await pg.evaluate(async () => {
    const eqm = await import('/src/cinegen/lib/audio/eq.ts'); const bk = await import('/src/cinegen/lib/audio/eq-bake.ts');
    const sr = 48000; const n = sr * 2; const l = new Float32Array(n);
    for (let i = 0; i < n; i++) l[i] = 0.25 * Math.sin((2 * Math.PI * 200 * i) / sr) + 0.25 * Math.sin((2 * Math.PI * 5000 * i) / sr);
    const src = bk.encodeWav16({ numberOfChannels: 2, sampleRate: sr, length: n, getChannelData: () => l });
    const url = URL.createObjectURL(new Blob([src], { type: 'audio/wav' }));
    const eq = eqm.defaultClipEq(); eq.bands[3] = { type: 'peaking', frequency: 5000, gain: -12, q: 2, enabled: true };
    const t0 = performance.now(); const out = await bk.bakeEqToBlobUrl(url, eq); const ms = Math.round(performance.now() - t0);
    const again = await bk.bakeEqToBlobUrl(url, eq); // cached
    const dec = await new OfflineAudioContext(2, 1, sr).decodeAudioData(await (await fetch(out)).arrayBuffer());
    const d = dec.getChannelData(0).subarray(sr / 2, sr * 1.5);
    const dbAt = (f) => { let re = 0, im = 0; for (let i = 0; i < d.length; i++) { re += d[i] * Math.cos((2 * Math.PI * f * i) / sr); im += d[i] * Math.sin((2 * Math.PI * f * i) / sr); } return 20 * Math.log10((2 * Math.hypot(re, im)) / d.length / 0.25); };
    const flat = await bk.bakeEqToBlobUrl(url, eqm.defaultClipEq());
    return { ms, cached: again === out, flatIsSource: flat === url, db200: dbAt(200), db5k: dbAt(5000), isWav: (await (await fetch(out)).arrayBuffer()).byteLength > 100000 };
  });
  console.log('bake', JSON.stringify(bake));
  assert(Math.abs(bake.db200) < 0.5, '200 Hz untouched by a 5 kHz notch-ish cut: ' + bake.db200.toFixed(2) + ' dB');
  assert(Math.abs(bake.db5k + 12) < 1.5, '5 kHz reduced by about 12 dB in the baked file: ' + bake.db5k.toFixed(2) + ' dB');
  assert(bake.cached && bake.flatIsSource && bake.isWav, 'bake is cached per (source, EQ); a flat EQ returns the source unchanged');

  // 4. meters / master gain on a real AudioContext graph
  const meters = await pg.evaluate(async () => {
    const { AudioFxGraph } = await import('/src/cinegen/lib/audio/audio-graph.ts');
    const ctx = new AudioContext(); await ctx.resume();
    const g = new AudioFxGraph(ctx); const osc = ctx.createOscillator(); osc.frequency.value = 1000; const gain = ctx.createGain(); gain.gain.value = 0.5;
    g.wire('osc', osc, gain); osc.start();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await wait(400); const a = g.levels();
    g.setMaster(0.5); await wait(400); const bLv = g.levels();
    g.setMaster(1);
    const eq = (await import('/src/cinegen/lib/audio/eq.ts')).defaultClipEq(); eq.bands[2] = { type: 'peaking', frequency: 1000, gain: -12, q: 1, enabled: true };
    g.setEq('osc', eq); await wait(500); const c = g.levels();
    g.setEq('osc', null); await wait(400); const d = g.levels();
    return { state: ctx.state, a: [a.left.peakDb, a.right.peakDb], b: [bLv.left.peakDb, bLv.right.peakDb], c: [c.left.peakDb], d: [d.left.peakDb] };
  });
  console.log('meters', JSON.stringify(meters));
  assert(meters.state === 'running', 'AudioContext running');
  assert(Math.abs(meters.a[0] + 6.02) < 1 && Math.abs(meters.a[1] + 6.02) < 1, 'mono 0.5 sine meters -6 dBFS on both L and R: ' + meters.a.map((x) => x.toFixed(1)));
  assert(Math.abs(meters.b[0] - meters.a[0] + 6.02) < 1, 'master 0.5 lowers the meter by 6 dB: ' + (meters.b[0] - meters.a[0]).toFixed(2));
  assert(Math.abs(meters.c[0] - meters.a[0] + 12) < 1.5, 'EQ -12 dB at 1 kHz in the live graph lowers the meter by about 12 dB: ' + (meters.c[0] - meters.a[0]).toFixed(2));
  assert(Math.abs(meters.d[0] - meters.a[0]) < 0.6, 'removing the EQ restores the level');

  // 5. IndexedDB thumbnail cache survives a new cache instance
  const idb = await pg.evaluate(async () => {
    const m = await import('/src/cinegen/lib/perf/thumb-cache.ts');
    const c1 = new m.ThumbCache(m.idbStore('stage4-test', 'thumbs')); await c1.put('thumb:x', 'data:image/jpeg;base64,AAAA');
    const c2 = new m.ThumbCache(m.idbStore('stage4-test', 'thumbs'));
    const v = await c2.get('thumb:x'); const st = await c2.stats(); await c2.clear();
    return { v, st };
  });
  assert(idb.v === 'data:image/jpeg;base64,AAAA' && idb.st.backend === 'indexeddb', 'thumbnail cache persists in real IndexedDB: ' + JSON.stringify(idb.st));

  // 6. capability report in this Chromium
  const caps = await pg.evaluate(async () => (await (await import('/src/cinegen/lib/perf/capabilities.ts')).detectCapabilities(window)).map((c) => `${c.id}=${c.status}`));
  console.log('capabilities', caps.join(' '));
  assert(caps.includes('webaudio=yes') && caps.includes('indexeddb=yes'), 'capability detector runs against the real window');

  // 7. proxy generation (mediabunny / WebCodecs) and its cancellation
  const proxy = await pg.evaluate(async () => {
    const { generateProxyBlob } = await import('/src/cinegen/lib/perf/proxy-job.ts');
    const r = {};
    try { const blob = await generateProxyBlob('/__cuts.mp4', { width: 160, onProgress: () => {} }); r.size = blob.size; r.type = blob.type; } catch (e) { r.error = `${e.name}: ${e.message}`; }
    try { const ac = new AbortController(); const p = generateProxyBlob('/__cuts.mp4', { signal: ac.signal }); ac.abort(); await p; r.cancel = 'finished'; } catch (e) { r.cancel = e.name; }
    return r;
  });
  console.log('proxy', JSON.stringify(proxy));
  assert(proxy.cancel === 'AbortError', 'proxy generation is cancellable');
  console.log(proxy.size ? 'PASS proxy blob produced: ' + proxy.size + ' bytes' : 'NOTE proxy not produced in this browser: ' + proxy.error);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
