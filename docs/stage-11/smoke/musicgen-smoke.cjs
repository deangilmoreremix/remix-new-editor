/* Fix Q: REAL MusicGen Small (742 MB, CC-BY-NC-4.0, the owner holds the licence) end to end through Media tools > Audio > Local AI audio > Music:
 * consent + non-commercial acknowledgement, download from huggingface.co (real network), generate SECS seconds, clip on the timeline, WAV not silent, export contains it.
 * Run: `npx vite --port 5191`, then  [WEBGPU=1] SMOKE_PORT=5191 SMOKE_DIR=<out dir>/ CHROMIUM_PATH=<chrome> node docs/stage-11/smoke/musicgen-smoke.cjs
 * Only onnxruntime-web's wasm is served from node_modules (cdn.jsdelivr.net) and the context bypasses the page CSP, like local-ai-audio-smoke.cjs. */
const fs = require('fs'); const path = require('path'); const { execSync } = require('child_process');
const L = require('../../stage-8/smoke/combined-lib.cjs');
const SP = L.SP; const SECS = Number(process.env.SECS || 3); const results = []; let failed = 0;
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); results.push({ ok: !!c, m }); if (!c) failed++; };
const info = (m) => console.log('INFO', new Date().toISOString().slice(11, 19), m);
const ORT = path.join(__dirname, '../../../node_modules/onnxruntime-web/dist');
const MIME = (f) => (f.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
const rss = () => { try { return execSync("ps -eo rss,args | grep -E 'chrome|chromium' | grep -v grep | awk '{s+=$1} END {print int(s/1024)}'").toString().trim(); } catch { return '?'; } };
(async () => {
  const { chromium } = require('playwright'); const cons = [];
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'].concat(process.env.WEBGPU ? ['--enable-unsafe-webgpu'] : []) });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 950 }, acceptDownloads: true, bypassCSP: true });
  const pg = await ctx.newPage();
  pg.on('console', (m) => { const t = m.text(); if (m.type() === 'error') cons.push(t.slice(0, 240)); if (/musicgen|memory|abort|out of|OOM|alloc|fail/i.test(t) && m.type() !== 'log') info('console ' + m.type() + ' ' + t.slice(0, 240)); });
  pg.on('pageerror', (e) => { cons.push('PAGEERR ' + String(e).slice(0, 300)); console.log('PAGEERR', String(e).slice(0, 300)); });
  pg.on('crash', () => console.log('PAGE CRASH'));
  await pg.addInitScript(() => { try { sessionStorage.setItem('setup_popup_shown', '1'); } catch {} });
  await pg.route(/cdn\.jsdelivr\.net\//, async (r) => {
    const name = r.request().url().split('/').pop().split('?')[0]; const f = path.join(ORT, name);
    if (!/^ort/.test(name) || !fs.existsSync(f)) return r.continue();
    await r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': MIME(f), 'access-control-allow-origin': '*' } });
  });
  await L.goTimeline(pg); await L.newProject(pg, 'musicgen');
  execSync(`ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=640x360:rate=25 -t 8 -pix_fmt yuv420p -an ${SP}clipV.mp4`);
  await L.addVideo(pg, SP + 'clipV.mp4');
  for (let i = 0; i < 8 && !(await pg.locator('[data-testid=s4-tab-audio]').count()); i++) { await pg.evaluate(() => document.querySelector('[data-testid=s4-open]')?.click()); await pg.waitForTimeout(2500); }
  await pg.evaluate(() => document.querySelector('[data-testid=s4-tab-audio]').click());
  await pg.evaluate(() => document.querySelector('[data-testid=lai-toggle]').click());
  await pg.waitForSelector('[data-testid=local-audio-panel]', { timeout: 10000 });
  await pg.evaluate(() => document.querySelector('[data-testid=lai-kind-music]').click()); await pg.waitForTimeout(500);
  await pg.waitForSelector('[data-testid=lai-model-musicgen-small]');
  const dl = pg.locator('[data-testid=lai-download-musicgen-small]');
  assert(await dl.isDisabled(), 'Download disabled before the acknowledgement + consent');
  await pg.evaluate(() => document.querySelector('[data-testid=lai-nc-musicgen-small]').click());   // the owner's non-commercial acknowledgement
  await pg.evaluate(() => document.querySelector('[data-testid=lai-consent-musicgen-small]').click());
  assert(!(await dl.isDisabled()), 'Download enabled after both boxes are ticked');
  const t0 = Date.now(); info('rss MB before download ' + rss());
  await pg.evaluate(() => document.querySelector('[data-testid=lai-download-musicgen-small]').click());
  const tick = setInterval(async () => { try { const v = await pg.locator('[data-testid=lai-progress-musicgen-small]').getAttribute('data-value', { timeout: 1000 }); info('download progress ' + v + ' rss MB ' + rss()); } catch {} }, 30000);
  await pg.waitForSelector('[data-testid=lai-delete-musicgen-small]', { timeout: 1500000 }).catch(async (e) => { clearInterval(tick); info('install wait failed: ' + (await pg.locator('[data-testid=lai-model-musicgen-small]').innerText()).replace(/\n/g, ' | ').slice(-400)); throw e; });
  clearInterval(tick);
  info('download + load ms=' + (Date.now() - t0) + ' rss MB ' + rss());
  const card = (await pg.locator('[data-testid=lai-model-musicgen-small]').innerText()).replace(/\n/g, ' | ');
  assert(/installed/.test(card), 'model reports installed'); info('card tail: ' + card.slice(-200));
  assert(/running on (WASM|WebGPU)/.test(card), 'device shown: ' + (/running on ([\w ()]+)/.exec(card) || [])[1]);
  const cached = await pg.evaluate(async () => { const c = await caches.open('transformers-cache'); const ks = await c.keys(); return ks.map((r) => r.url).filter((u) => /musicgen-small/i.test(u)).length; });
  assert(cached >= 5, 'musicgen weight files are in Cache Storage: ' + cached);
  await pg.locator('[data-testid=lai-prompt]').fill('calm lo-fi piano with soft drums');
  await pg.locator('input[aria-label="Music length seconds"]').fill(String(SECS));
  const t1 = Date.now();
  await pg.evaluate(() => document.querySelector('[data-testid=lai-generate]').click());
  const gtick = setInterval(async () => { try { info('generate: ' + (await pg.locator('[data-testid=lai-msg]').innerText({ timeout: 1000 })) + ' rss MB ' + rss()); } catch {} }, 30000);
  await pg.waitForFunction(() => /^Added/.test(document.querySelector('[data-testid=lai-msg]')?.textContent || '') || document.querySelector('[data-testid=lai-error]'), null, { timeout: 3000000 }).catch((e) => info('generate wait failed ' + String(e).slice(0, 100)));
  clearInterval(gtick);
  const err = await pg.locator('[data-testid=lai-error]').count() ? await pg.locator('[data-testid=lai-error]').innerText() : '';
  info('generation ms=' + (Date.now() - t1) + ' rss MB ' + rss() + ' msg=' + (await pg.locator('[data-testid=lai-msg]').innerText().catch(() => '')));
  assert(!err, 'generation finished without error ' + err);
  await pg.waitForTimeout(3000);
  const s = await L.readStore(pg); const k = Object.keys(s).find((x) => /project\.json$/.test(x)); const p = JSON.parse(s[k]); const tl = p.timelines.find((t) => t.id === p.activeTimelineId) || p.timelines[0];
  const clip = tl.clips.find((c) => /lo-fi|calm|piano|music/i.test(c.name) || (c.assetId || c.asset_id) && p.assets && false) || tl.clips.filter((c) => !/clipV/.test(c.name))[0];
  info('timeline clips ' + JSON.stringify(tl.clips.map((c) => [c.name, c.start_time, c.duration, c.track_id])));
  assert(!!clip, 'a music clip is on the timeline: ' + (clip && clip.name));
  const aid = clip && (clip.assetId || clip.asset_id);
  const findDeep = (o, pred, d = 0) => { if (!o || typeof o !== 'object' || d > 8) return undefined; if (pred(o)) return o; for (const v of Object.values(o)) { const r = findDeep(v, pred, d + 1); if (r) return r; } return undefined; };
  const asset = findDeep(p, (o) => o.id === aid && 'file_ref' in o);
  assert(asset && asset.type === 'audio', 'saved audio asset: ' + JSON.stringify(asset && { type: asset.type, dur: asset.duration, md: asset.metadata }).slice(0, 300));
  assert(clip && clip.duration >= SECS - 0.5 && clip.duration <= SECS + 1.5, 'clip duration ~ requested ' + SECS + ' s: ' + (clip && clip.duration));
  const dump = await pg.evaluate(async (u) => { const buf = new Uint8Array(await (await fetch(u)).arrayBuffer()); let x = ''; for (let i = 0; i < buf.length; i += 0x8000) x += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(x); }, asset.file_ref);
  fs.writeFileSync(SP + 'music.wav', Buffer.from(dump, 'base64'));
  const vd = execSync(`ffmpeg -hide_banner -i ${SP}music.wav -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume|Duration|Audio:"`).toString(); info(vd.replace(/\n/g, ' | '));
  const maxv = parseFloat(/max_volume: (-?[\d.]+) dB/.exec(vd)[1]); assert(maxv > -40, 'music WAV is not silent (max_volume ' + maxv + ' dB)');
  // export must contain it (the video track is silent)
  try {
    await L.clickBtn(pg, '^EXPORT$'); await pg.waitForTimeout(2000);
    const qa = pg.locator('[data-testid=export-auto-qa]'); if (await qa.count() && await qa.isChecked()) await qa.uncheck();
    const dlp = pg.waitForEvent('download', { timeout: 280000 }).catch((e) => ({ err: String(e) }));
    await pg.waitForSelector('.export-settings__render-btn', { timeout: 20000 }); await pg.evaluate(() => document.querySelector('.export-settings__render-btn').click());
    const d = await dlp; assert(d && d.saveAs, 'export produced a download');
    const out = SP + 'export-music.mp4'; await d.saveAs(out);
    info('export streams ' + execSync(`ffprobe -v error -show_entries stream=codec_type,duration -of csv=p=0 ${out}`).toString().trim().replace(/\n/g, ' ; '));
    const evd = execSync(`ffmpeg -hide_banner -i ${out} -af volumedetect -vn -f null - 2>&1 | grep -E "mean_volume|max_volume"`).toString().replace(/\n/g, ' | '); info('export volumedetect ' + evd);
    assert(parseFloat(/max_volume: (-?[\d.]+) dB/.exec(evd)[1]) > -40, 'exported file contains the music');
  } catch (e) { assert(false, 'export step: ' + String(e).slice(0, 200)); }
  info('final rss MB ' + rss()); await b.close();
  fs.writeFileSync(SP + 'musicgen-results.json', JSON.stringify({ results, cons: cons.slice(0, 10) }, null, 1));
  console.log(failed ? 'FAILED ' + failed : 'ALL PASS'); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('SMOKE CRASH', e); process.exit(2); });
