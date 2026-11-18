/* Fix Q: cross-engine capability probe + real flow (#/timeline, import, effect, Export).
 * Run: ENGINE=firefox|webkit|chromium SMOKE_PORT=5191 SMOKE_DIR=<dir>/ PLAYWRIGHT_BROWSERS_PATH=<dir> node docs/stage-11/smoke/engine-probe.cjs
 * (chromium: also CHROMIUM_PATH). SMOKE_DIR needs clipA.mp4. Prints one JSON line per step. */
const pw = require('playwright');
const SP = process.env.SMOKE_DIR || __dirname + '/';
const ENGINE = process.env.ENGINE || 'firefox';
const port = process.env.SMOKE_PORT || 3100;
const clickBtn = (pg, re) => pg.evaluate((s) => [...document.querySelectorAll('button')].find((x) => new RegExp(s, 'i').test(x.innerText))?.click(), re);
const out = (k, v) => console.log(k, JSON.stringify(v));
(async () => {
  const type = pw[ENGINE];
  const b = await type.launch(ENGINE === 'chromium' ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  out('version', b.version());
  const ctx = await b.newContext({ viewport: { width: 1600, height: 950 }, acceptDownloads: true });
  const pg = await ctx.newPage();
  const cons = [];
  pg.on('console', (m) => { if (['error', 'warning'].includes(m.type())) cons.push(m.type() + ': ' + m.text().slice(0, 240)); });
  pg.on('pageerror', (e) => cons.push('PAGEERR ' + String(e).slice(0, 300)));
  await pg.addInitScript(() => { try { sessionStorage.setItem('setup_popup_shown', '1'); } catch {} });
  // NO_WEBCODECS=1 simulates an engine without WebCodecs video encoding (e.g. Safari < 26) to check the app's own unsupported-browser handling
  if (process.env.NO_WEBCODECS) await pg.addInitScript(() => { delete window.VideoEncoder; delete window.VideoDecoder; });
  await pg.goto(`http://127.0.0.1:${port}/#/timeline`, { waitUntil: 'domcontentloaded' });
  await pg.getByRole('button', { name: 'Skip for now' }).click({ timeout: 15000 }).catch(() => {});
  await pg.waitForSelector('.pm-window', { timeout: process.env.NO_WEBCODECS ? 20000 : 200000 }).catch((e) => out('timeline-open-FAIL', String(e).slice(0, 200)));
  await pg.waitForTimeout(3000);
  const caps = await pg.evaluate(async () => {
    const r = {};
    const t = (n) => { try { return typeof globalThis[n]; } catch (e) { return 'err'; } };
    for (const n of ['VideoEncoder', 'VideoDecoder', 'AudioEncoder', 'AudioDecoder', 'ImageDecoder', 'OffscreenCanvas', 'AudioWorkletNode', 'SharedArrayBuffer', 'WebAssembly', 'MediaRecorder', 'CompressionStream', 'FileSystemFileHandle']) r[n] = t(n);
    r.crossOriginIsolated = self.crossOriginIsolated; r.webgpu = !!navigator.gpu; r.cacheStorage = typeof caches; r.indexedDB = typeof indexedDB;
    r.opfs = await navigator.storage?.getDirectory?.().then(() => true, (e) => 'rejected ' + e.message);
    try { const c = document.createElement('canvas'); r.webgl2 = !!c.getContext('webgl2'); } catch (e) { r.webgl2 = 'err ' + e.message; }
    try { new WebAssembly.Memory({ initial: 1, maximum: 2, shared: true }); r.wasmSharedMemory = true; } catch (e) { r.wasmSharedMemory = 'no: ' + e.message; }
    try { r.wasmSimd = WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11])); } catch { r.wasmSimd = 'err'; }
    if (typeof VideoEncoder === 'function') {
      for (const [n, c] of [['h264', 'avc1.42001f'], ['vp9', 'vp09.00.10.08'], ['vp8', 'vp8'], ['av1', 'av01.0.04M.08']]) {
        try { const s = await VideoEncoder.isConfigSupported({ codec: c, width: 640, height: 360, bitrate: 1e6, framerate: 25 }); r['enc_' + n] = s.supported; } catch (e) { r['enc_' + n] = 'err ' + e.message; }
      }
    }
    if (typeof AudioEncoder === 'function') {
      for (const c of ['mp4a.40.2', 'opus']) { try { r['aenc_' + c] = (await AudioEncoder.isConfigSupported({ codec: c, sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 })).supported; } catch (e) { r['aenc_' + c] = 'err ' + e.message; } }
    }
    return r;
  });
  out('caps', caps);
  // the app's own capability panel text, if reachable
  const panelTxt = await pg.evaluate(() => [...document.querySelectorAll('[data-testid*=health],[class*=media-health]')].map((e) => e.innerText).join(' | ').slice(0, 1500));
  out('app-health-panel', panelTxt);
  // real flow
  try {
    await pg.waitForFunction(() => [...document.querySelectorAll('.pm-bottombar__btn')].some((x) => x.innerText === 'New Project'), null, { timeout: 60000 });
    await pg.evaluate(() => [...document.querySelectorAll('.pm-bottombar__btn')].find((x) => x.innerText === 'New Project').click());
    await pg.waitForTimeout(800);
    await pg.fill('input[placeholder="Project name..."]', 'engine-' + ENGINE);
    await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText === 'Create').click());
    await pg.waitForTimeout(6000);
    await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'EDIT')?.click());
    await pg.waitForTimeout(2000);
    await clickBtn(pg, '^Add\\s*video');
    await pg.waitForSelector('[data-testid=add-video-file]', { state: 'attached', timeout: 8000 });
    await pg.setInputFiles('[data-testid=add-video-file]', SP + 'clipA.mp4');
    await pg.waitForTimeout(6000);
    await pg.keyboard.press('Escape');
    await pg.evaluate(() => [...document.querySelectorAll('.element-modal__backdrop button')].find((x) => /×|close/i.test(x.innerText + x.getAttribute('aria-label')))?.click());
    await pg.waitForTimeout(800);
    await pg.locator('[title="clipA.mp4"]').first().dblclick(); await pg.waitForTimeout(1500);
    await pg.locator('[data-testid=insert-edit]').click(); await pg.waitForTimeout(1500);
    const sel = pg.locator('.clip-card').filter({ hasText: 'clipA.mp4' }).filter({ hasNotText: '(audio)' }).first();
    await sel.click(); await pg.waitForTimeout(500);
    const ins = pg.locator('[title="Show inspector"]'); if (await ins.count()) await ins.first().click(); await pg.waitForTimeout(500);
    try {
      await pg.locator('[data-testid=clip-effects]').getByText('Browse library…').click({ timeout: 8000 });
      await pg.locator('[data-testid="library-card-builtin:fx-exposure"]').click({ timeout: 8000 }); await pg.waitForTimeout(800);
      out('effect', { exposureInPanel: await pg.locator('[data-testid=clip-effects]').getByText('Exposure').count() });
    } catch (e) { out('effect-FAIL', String(e).slice(0, 200)); }
    out('import', { clipsOnTimeline: await pg.locator('.clip-card').count(),  timelineClips: await pg.locator('[title="clipA.mp4"]').count() });
    await pg.screenshot({ path: SP + `engine-${ENGINE}-edit.png` });
  } catch (e) { out('import-FAIL', String(e).slice(0, 300)); }
  try {
    await clickBtn(pg, '^EXPORT$'); await pg.waitForTimeout(2500);
    await pg.screenshot({ path: SP + `engine-${ENGINE}-export-tab.png` });
    out('export-tab-text', await pg.evaluate(() => document.body.innerText.match(/[^\n]*(unsupported|cannot encode|not support|Use Chrome)[^\n]*/gi)));
    const qa = pg.locator('[data-testid=export-auto-qa]'); if (await qa.count() && await qa.isChecked()) await qa.uncheck();
    const t0 = Date.now();
    const dl = pg.waitForEvent('download', { timeout: process.env.NO_WEBCODECS ? 20000 : 200000 }).catch((e) => ({ err: String(e).slice(0, 200) }));
    await pg.locator('.export-settings__render-btn').click();
    const res = await Promise.race([dl, pg.waitForTimeout(process.env.NO_WEBCODECS ? 15000 : 25000).then(() => 'pending25s')]);
    out('export-after-25s', typeof res === 'string' ? res : res.saveAs ? 'download' : res);
    out('export-progress-text', await pg.evaluate(() => (document.querySelector('.render-progress') || { innerText: '(no .render-progress element)' }).innerText.replace(/\n+/g, ' / ')));
    await pg.screenshot({ path: SP + `engine-${ENGINE}-export-run.png` });
    const d = typeof res === 'string' ? await dl : res;
    if (d && d.saveAs) { const f = SP + `engine-${ENGINE}-export.` + (/\.(\w+)$/.exec(d.suggestedFilename()) || [, 'mp4'])[1]; await d.saveAs(f); out('export-saved', { f, ms: Date.now() - t0 }); }
    else out('export-final', d);
  } catch (e) { out('export-FAIL', String(e).slice(0, 300)); }
  out('console', cons.slice(0, 25));
  await b.close();
})().catch((e) => { console.log('FATAL', e); process.exit(1); });
