/* Port I2 smoke: REAL in-browser narration with Kokoro 82M (q8, WASM) in headless Chromium, through the Media tools > Audio UI.
 * Run: `npx vite --port 3140`, then
 *   HF_DIR=<dir with kokoro files, see below> SMOKE_PORT=3140 SMOKE_DIR=<out dir>/ CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node docs/stage-11/smoke/local-ai-audio-smoke.cjs
 * HF_DIR holds the real files of onnx-community/Kokoro-82M-v1.0-ONNX (config.json tokenizer.json tokenizer_config.json onnx/model_quantized.onnx
 * voices/af_heart.bin) fetched with curl through the sandbox proxy. Headless Chromium cannot trust the proxy CA, so requests to
 * huggingface.co are redirected by Playwright to those local files (start `node docs/stage-11/smoke/static-cors.cjs $HF_DIR 3151` first) (the page still runs its real download / progress / cache code against them);
 * cdn.jsdelivr.net (onnxruntime-web wasm) is fulfilled from node_modules. With HF_DIR unset only the UI gating checks run. */
const fs = require('fs'); const path = require('path'); const { execSync } = require('child_process');
const L = require('../../stage-8/smoke/combined-lib.cjs');
const SP = L.SP; const HF = process.env.HF_DIR; const results = []; let failed = 0;
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); results.push({ ok: !!c, m }); if (!c) failed++; };
const info = (m) => console.log('INFO', m);
const ORT = path.join(__dirname, '../../../node_modules/onnxruntime-web/dist');
const MIME = (f) => (f.endsWith('.json') ? 'application/json' : f.endsWith('.wasm') ? 'application/wasm' : f.endsWith('.mjs') || f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
const requested = [];

async function routes(pg, { stallModel = false } = {}) {
  await pg.route(/huggingface\.co\//, async (r) => {
    const u = new URL(r.request().url()); const rel = u.pathname.replace(/^\/onnx-community\/Kokoro-82M-v1\.0-ONNX\/resolve\/main\//, '');
    requested.push('HF ' + rel);
    if (!/^\/onnx-community\/Kokoro/.test(u.pathname) || !HF) return r.abort();
    if (stallModel && /model\.onnx|model_quantized/.test(rel)) return; // never answered: the page can only cancel
    const f = path.join(HF, rel); if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: 'nf' });
    // redirect to static-cors.cjs serving HF_DIR on STATIC_PORT: the 92 MB weights would overflow Playwright's 100 MB devtools pipe if fulfilled inline; the context uses bypassCSP because the page CSP only allows connect-src 'self' https: (huggingface.co is https, so the real app is not affected)
    await r.fulfill({ status: 302, headers: { location: 'http://127.0.0.1:' + (process.env.STATIC_PORT || 3151) + '/' + rel, 'access-control-allow-origin': '*' } });
  });
  await pg.route(/cdn\.jsdelivr\.net\//, async (r) => {
    const name = r.request().url().split('/').pop().split('?')[0]; if (/^ort/.test(name)) requested.push('CDN ' + name);
    const f = path.join(ORT, name);
    if (!/^ort/.test(name) || !fs.existsSync(f)) return r.continue();
    await r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': MIME(f), 'access-control-allow-origin': '*' } });
  });
}
const openAudio = async (pg) => {
  for (let i = 0; i < 8 && !(await pg.locator('[data-testid=s4-tab-audio]').count()); i++) { await pg.evaluate(() => document.querySelector('[data-testid=s4-open]')?.click()); await pg.waitForTimeout(2500); }
  await pg.waitForSelector('[data-testid=s4-tab-audio]', { timeout: 10000 }); await pg.evaluate(() => document.querySelector('[data-testid=s4-tab-audio]').click());
  await pg.evaluate(() => document.querySelector('[data-testid=lai-toggle]').click()); await pg.waitForSelector('[data-testid=local-audio-panel] [data-testid=lai-model-kokoro-82m-q8]', { timeout: 10000 });
};
const findDeep = (o, pred, d = 0) => { if (!o || typeof o !== 'object' || d > 8) return undefined; if (pred(o)) return o; for (const v of Object.values(o)) { const r = findDeep(v, pred, d + 1); if (r) return r; } return undefined; };
const store = async (pg) => { const s = await L.readStore(pg); const k = Object.keys(s).find((x) => /project\.json$/.test(x)); const p = JSON.parse(s[k]); const all = []; for (const v of Object.values(s)) { try { all.push(typeof v === 'string' ? JSON.parse(v) : v); } catch {} } return { p, all, tl: p.timelines.find((t) => t.id === p.activeTimelineId) || p.timelines[0] }; };
async function runExport(pg, base) {
  await L.clickBtn(pg, '^EXPORT$'); await pg.waitForTimeout(2000);
  const qa = pg.locator('[data-testid=export-auto-qa]'); if (await qa.count() && await qa.isChecked()) await qa.uncheck();
  const dl = pg.waitForEvent('download', { timeout: 280000 }).catch((e) => ({ err: String(e) }));
  await pg.waitForSelector('.export-settings__render-btn', { timeout: 20000 }); await pg.evaluate(() => document.querySelector('.export-settings__render-btn').click()); // DOM click: a stale add-video backdrop intercepts pointer events
  const d = await dl;
  if (!d || !d.saveAs) { info('NO DOWNLOAD ' + JSON.stringify(d)); return null; }
  const ext = (/\.(\w+)$/.exec(d.suggestedFilename()) || [, 'mp4'])[1];
  const out = SP + base + '.' + ext; await d.saveAs(out); info('SAVED ' + out); return out;
}

(async () => {
  const { chromium } = require('playwright'); const cons = [];
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 950 }, acceptDownloads: true, bypassCSP: true });
  const pg = await ctx.newPage();
  pg.on('console', (m) => { if (m.type() === 'error') cons.push(m.text().slice(0, 240)); });
  pg.on('pageerror', (e) => { cons.push('PAGEERR ' + String(e).slice(0, 300)); console.log('PAGEERR', String(e).slice(0, 300)); });
  await pg.addInitScript(() => { try { sessionStorage.setItem('setup_popup_shown', '1'); } catch {} });
  await routes(pg);
  await L.goTimeline(pg); await L.newProject(pg, 'localai');
  // a silent 8 s video (no audio stream) so the timeline is exportable and the only sound in the export is the narration
  execSync(`ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=640x360:rate=25 -t 8 -pix_fmt yuv420p -an ${SP}clipV.mp4`);
  await L.addVideo(pg, SP + 'clipV.mp4');
  await openAudio(pg);
  const dl = pg.locator('[data-testid=lai-download-kokoro-82m-q8]');
  assert(await dl.isDisabled(), 'Download disabled until the consent box is ticked');
  assert(!requested.some((x) => x.startsWith('HF ')), 'nothing was requested from huggingface.co before consent');
  assert(/apache-2\.0/.test(await pg.locator('[data-testid=lai-licence-kokoro-82m-q8]').innerText()), 'licence (apache-2.0) and size are shown');
  await pg.evaluate(() => document.querySelector('[data-testid=lai-kind-music]').click()); await pg.waitForTimeout(400);
  assert(/cc-by-nc-4\.0/.test(await pg.locator('[data-testid=lai-licence-musicgen-small]').innerText()), 'MusicGen shows CC-BY-NC-4.0');
  await pg.evaluate(() => document.querySelector('[data-testid=lai-consent-musicgen-small]').click());
  assert(await pg.locator('[data-testid=lai-download-musicgen-small]').isDisabled(), 'MusicGen download stays disabled without the non-commercial acknowledgement');
  await pg.evaluate(() => document.querySelector('[data-testid=lai-kind-tts]').click()); await pg.waitForTimeout(400);
  if (!HF) { await b.close(); process.exit(failed ? 1 : 0); }

  // real download + generation (q8)
  await pg.locator('[data-testid=lai-model]').selectOption('kokoro-82m-q8');
  await pg.evaluate(() => document.querySelector('[data-testid=lai-consent-kokoro-82m-q8]').click());
  const t0 = Date.now(); await pg.evaluate(() => document.querySelector('[data-testid=lai-download-kokoro-82m-q8]').click());
  pg.on('console', (m) => { const t = m.text(); if (/kokoro|onnx|wasm|model|fetch|abort|cache|memory/i.test(t)) info('console ' + m.type() + ' ' + t.slice(0, 240)); });
  await pg.waitForSelector('[data-testid=lai-delete-kokoro-82m-q8]', { timeout: 240000 }).catch(async (e) => { info('install wait failed: card = ' + (await pg.locator('[data-testid=lai-model-kokoro-82m-q8]').innerText()).replace(/\n/g, ' | ').slice(-300) + ' | cons=' + JSON.stringify(cons.slice(-5))); throw e; });
  info('model download+load ms=' + (Date.now() - t0));
  assert(/installed/.test(await pg.locator('[data-testid=lai-model-kokoro-82m-q8]').innerText()), 'model reports installed after download');
  const cached = await pg.evaluate(async () => { const c = await caches.open('transformers-cache'); return (await c.keys()).map((r) => r.url).filter((u) => /model_quantized/.test(u)).length; });
  assert(cached === 1, 'weights are in browser Cache Storage (transformers-cache)');
  const TEXT = 'Welcome to CineGen. This narration was generated entirely inside your browser.';
  await pg.locator('[data-testid=lai-text]').fill(TEXT);
  await pg.evaluate(() => document.querySelector('[data-testid=lai-generate]').click());
  await pg.waitForFunction(() => /^Added/.test(document.querySelector('[data-testid=lai-msg]')?.textContent || '') || document.querySelector('[data-testid=lai-error]'), null, { timeout: 280000 });
  const err = await pg.locator('[data-testid=lai-error]').count() ? await pg.locator('[data-testid=lai-error]').innerText() : '';
  assert(!err, 'generation finished without error ' + err);
  info(await pg.locator('[data-testid=lai-msg]').innerText());
  await pg.waitForTimeout(3000);
  const { p, all, tl } = await store(pg);
  const rawStore = await L.readStore(pg); info('store keys ' + JSON.stringify(Object.keys(rawStore).map((k) => [k, String(typeof rawStore[k] === 'string' ? rawStore[k].length : JSON.stringify(rawStore[k]).length), /local-ai/.test(typeof rawStore[k] === 'string' ? rawStore[k] : JSON.stringify(rawStore[k]))])));
  const clip = tl.clips.find((c) => /Welcome/.test(c.name)); const aid = clip && (clip.assetId || clip.asset_id); const asset = aid && all.map((v) => findDeep(v, (o) => o.id === aid && !('track_id' in o) && !('trackId' in o))).find(Boolean);
  const aurl = asset && (asset.url || asset.file_ref || asset.fileRef || asset.file_path || asset.original_path);
  info('asset keys ' + JSON.stringify(asset && Object.keys(asset)) + ' type=' + (asset && asset.type) + ' url=' + String(aurl).slice(0, 40));
  assert(!!clip && !!asset && asset.type === 'audio', 'an audio asset and clip exist in the saved project');
  assert(clip && clip.duration > 3 && clip.duration < 15, 'clip duration is sensible: ' + (clip && clip.duration));
  assert(asset && /"licence":\s*"apache-2\.0"/.test(JSON.stringify(asset).replace(/\\"/g, '"')) && /kokoro-82m-q8/.test(JSON.stringify(asset)), 'asset records model + licence');
  const wav = await pg.evaluate(async (u) => { const buf = await (await fetch(u)).arrayBuffer(); return Array.from(new Uint8Array(buf.slice(0, 64))).concat([buf.byteLength]); }, aurl);
  fs.writeFileSync(SP + 'blob-head.json', JSON.stringify(wav));
  const dump = await pg.evaluate(async (u) => { const buf = new Uint8Array(await (await fetch(u)).arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s); }, aurl);
  fs.writeFileSync(SP + 'narration.wav', Buffer.from(dump, 'base64'));
  const vd = execSync(`ffmpeg -hide_banner -i ${SP}narration.wav -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume|Duration"`).toString(); info(vd.replace(/\n/g, ' | '));
  const maxv = parseFloat(/max_volume: (-?[\d.]+) dB/.exec(vd)[1]); assert(maxv > -30, 'generated WAV is not silent (max_volume ' + maxv + ' dB)');

  // export: the narration must be audible in the rendered file
  try {
    await pg.keyboard.press('Escape');
    const out = await runExport(pg, 'export-local-ai');
    if (out) {
      const probe = execSync(`ffprobe -v error -show_entries stream=codec_type,duration -of csv=p=0 ${out}`).toString().trim().replace(/\n/g, ' ; '); info('export streams ' + probe);
      const evd = execSync(`ffmpeg -hide_banner -i ${out} -af volumedetect -vn -f null - 2>&1 | grep -E "mean_volume|max_volume"`).toString().replace(/\n/g, ' | '); info('export volumedetect ' + evd);
      const emax = parseFloat(/max_volume: (-?[\d.]+) dB/.exec(evd)[1]); assert(emax > -40, 'exported file contains the narration (max_volume ' + emax + ' dB)');
    } else assert(false, 'export produced a file');
  } catch (e) { assert(false, 'export step: ' + String(e).slice(0, 200)); }
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'EDIT')?.click()); await pg.waitForTimeout(1500);

  // survives reload (IndexedDB blob store)
  await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(8000);
  const ok = await pg.evaluate(async () => { const s = await new Promise((res) => { const r = indexedDB.open('cinegen-local-media'); r.onsuccess = () => { const db = r.result; const tx = db.transaction('blobs'); const k = tx.objectStore('blobs').getAllKeys(); tx.oncomplete = () => { db.close(); res(k.result); }; }; }); return s; });
  assert(Array.isArray(ok) && ok.includes(aid), 'generated audio is kept in the IndexedDB blob store (Fix B) across reload: ' + JSON.stringify(ok));

  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'EDIT')?.click()); await pg.waitForTimeout(2000);
  await openAudio(pg);
  assert(/downloaded|installed/.test(await pg.locator('[data-testid=lai-model-kokoro-82m-q8]').innerText()), 'after reload the model is still listed as downloaded (browser cache)');

  // cancel flow (fp32 never answers)
  await pg.unroute(/huggingface\.co\//); await routes(pg, { stallModel: true });
  await pg.locator('[data-testid=lai-model]').selectOption('kokoro-82m-fp32');
  await pg.evaluate(() => document.querySelector('[data-testid=lai-consent-kokoro-82m-fp32]').click());
  await pg.evaluate(() => document.querySelector('[data-testid=lai-download-kokoro-82m-fp32]').click());
  await pg.waitForSelector('[data-testid=lai-progress-kokoro-82m-fp32]', { timeout: 20000 });
  assert(await pg.locator('[data-testid=lai-cancel-kokoro-82m-fp32]').isVisible(), 'progress + Cancel shown while downloading');
  await pg.evaluate(() => document.querySelector('[data-testid=lai-cancel-kokoro-82m-fp32]').click()); await pg.waitForSelector('[data-testid=lai-download-kokoro-82m-fp32]', { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(500);
  assert(await pg.locator('[data-testid=lai-progress-kokoro-82m-fp32]').count() === 0 && await pg.locator('[data-testid=lai-download-kokoro-82m-fp32]').isVisible(), 'Cancel returns the model to "not downloaded"');
  await pg.unroute(/huggingface\.co\//); await pg.unroute(/cdn\.jsdelivr\.net\//); await routes(pg);

  // delete the downloaded files
  await pg.locator('[data-testid=lai-model]').selectOption('kokoro-82m-q8');
  await pg.evaluate(() => document.querySelector('[data-testid=lai-delete-kokoro-82m-q8]').click()); await pg.waitForTimeout(1500);
  const left = await pg.evaluate(async () => { const c = await caches.open('transformers-cache'); return (await c.keys()).filter((r) => /model_quantized/.test(r.url)).length; });
  assert(left === 0, 'Delete removes the weights from Cache Storage');
  await pg.goto('about:blank'); await b.close();
  console.log(JSON.stringify({ requested: [...new Set(requested)], cons: cons.slice(0, 8) }, null, 1));
  fs.writeFileSync(SP + 'localai-results.json', JSON.stringify({ results, requested: [...new Set(requested)] }, null, 1));
  console.log(failed ? 'FAILED ' + failed : 'ALL PASS'); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('SMOKE CRASH', e); process.exit(2); });
