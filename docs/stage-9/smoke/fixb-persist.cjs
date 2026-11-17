// Fix B1 smoke: import a local mp4, place it, save, RELOAD the page, reopen the project: the clip must have live media (no relink) and export.
// Run: npx vite --port 3100 ; SMOKE_DIR=<dir with clipA.mp4>/ CHROMIUM_PATH=... node fixb-persist.cjs
const { chromium } = require('playwright');
const SP = (process.env.SMOKE_DIR || __dirname) + '/';
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const dismiss = async (pg) => { for (let i = 0; i < 6 && await pg.locator('.element-modal__backdrop').count(); i++) { await pg.keyboard.press('Escape'); await pg.evaluate(() => document.querySelectorAll('.element-modal__close').forEach((x) => x.click())); await pg.waitForTimeout(500); } }; // e.g. the 'Background Transcription Failed' dialog (no transcription engine in the sandbox)
let markReadout = ''; let rangeReadout = '';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 950 } });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 300)));
  pg.on('console', (m) => { if (/local-media|export|render/i.test(m.text()) || m.type() === 'error') console.log('CON', m.type(), m.text().slice(0, 300)); });
  await pg.addInitScript(() => { try { sessionStorage.setItem('setup_popup_shown', '1'); } catch {} });
  await pg.goto('http://127.0.0.1:3100/#/timeline', { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.pm-window', { timeout: 90000 });
  await pg.waitForTimeout(2500);
  await pg.evaluate(() => [...document.querySelectorAll('.pm-bottombar__btn')].find((x) => x.innerText === 'New Project').click());
  await pg.waitForTimeout(800);
  await pg.fill('input[placeholder="Project name..."]', 'persist-smoke');
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText === 'Create').click());
  await pg.waitForTimeout(6000);
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText === 'EDIT').click());
  await pg.waitForTimeout(3000);
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Add\s*video/i.test(x.innerText)).click());
  await pg.waitForSelector('[data-testid=add-video-file]', { state: 'attached', timeout: 8000 });
  await pg.setInputFiles('[data-testid=add-video-file]', SP + 'clipA.mp4');
  await pg.waitForTimeout(5000);
  await dismiss(pg);
  if (process.env.SMOKE_SHOTS) await pg.screenshot({ path: SP + 'persist-before-dblclick.png' });
  await dismiss(pg); await pg.waitForTimeout(3000); await dismiss(pg);
  await pg.locator('[title="clipA.mp4"]').first().dblclick();
  await pg.waitForTimeout(1500);
  await pg.locator('[data-testid=insert-edit]').click();
  await pg.waitForTimeout(1500);
  assert(await pg.locator('.clip-card').count() >= 1, 'clip placed on the timeline');
  if (process.env.SMOKE_SHOTS) await pg.screenshot({ path: SP + 'persist-after-insert.png' });
  if (await pg.locator('.element-modal__backdrop').count()) { console.log('modal open:', (await pg.locator('.element-modal__backdrop').first().innerText()).slice(0, 200)); await pg.keyboard.press('Escape'); await pg.waitForTimeout(500); }
  // B2: source marks (I / O with the source monitor focused), saved with the project
  await dismiss(pg); await pg.locator('[title="clipA.mp4"]').first().dblclick(); await pg.waitForTimeout(800);
  await pg.keyboard.press('i');
  const scb = await pg.locator('.viewer-scrubber').first().boundingBox();
  await pg.mouse.click(scb.x + scb.width * 0.5, scb.y + scb.height / 2); await pg.waitForTimeout(500);
  await pg.keyboard.press('o'); await pg.waitForTimeout(400);
  markReadout = await pg.locator('[data-testid=mark-readout]').innerText();
  console.log('source marks before reload:', markReadout);
  assert(/to 00:00:0[23]/.test(markReadout), 'source marks set');
  // B2: timeline in / out (click the ruler = timeline focus, then I / O)
  const rb = await pg.locator('.timeline-editor__ruler').first().boundingBox();
  const pps = await pg.evaluate(() => { const t = [...document.querySelectorAll('.timeline-editor__ruler-tick--major')].map((e) => ({ left: parseFloat(e.style.left), label: e.innerText.trim() })).find((x) => x.left > 0 && /^\d\d:\d\d:\d\d:\d\d$/.test(x.label)); const [h, m, s, f] = t.label.split(':').map(Number); return t.left / (h * 3600 + m * 60 + s + f / 24); });
  console.log('pixels per second', pps);
  await pg.mouse.click(rb.x + 1 * pps, rb.y + rb.height / 2); await pg.waitForTimeout(400); await pg.keyboard.press('i');
  await pg.mouse.click(rb.x + 3 * pps, rb.y + rb.height / 2); await pg.waitForTimeout(400); await pg.keyboard.press('o'); await pg.waitForTimeout(400);
  rangeReadout = await pg.locator('[data-testid=range-readout]').innerText();
  console.log('timeline range before reload:', rangeReadout);
  assert(/00:00:0[01]:\d\d - 00:00:0[23]:\d\d/.test(rangeReadout), 'timeline I / O (timeline focused) set the range');
  assert(await pg.locator('[data-testid=mark-readout]').innerText() === markReadout, 'timeline I / O did not touch the source marks');
  const stored = await pg.evaluate(async () => new Promise((res) => { const r = indexedDB.open('cinegen-local-media'); r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('blobs')) return res(0); const q = db.transaction('blobs').objectStore('blobs').count(); q.onsuccess = () => res(q.result); }; r.onerror = () => res(-1); }));
  assert(stored >= 1, 'blob store holds the imported file (entries: ' + stored + ')');
  await pg.waitForTimeout(5000); // autosave
  // reload the page: every blob: URL of the session is dead now
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(6000);
  if (process.env.SMOKE_SHOTS) await pg.screenshot({ path: SP + 'persist-reloaded.png' });
  console.log('url after reload:', pg.url(), 'pm-window:', await pg.locator('.pm-window').count());
  const opened = await pg.evaluate(() => { const el = [...document.querySelectorAll('.pm-window *')].find((x) => x.children.length === 0 && /persist-smoke/.test(x.textContent || '')); if (!el) return false; el.click(); return true; });
  console.log('project card found:', opened);
  await pg.waitForTimeout(500);
  await pg.evaluate(() => { const o = [...document.querySelectorAll('button')].find((x) => /^open/i.test(x.innerText.trim())); o?.click(); });
  await pg.waitForTimeout(500);
  await pg.evaluate(() => { const el = [...document.querySelectorAll('.pm-window *')].find((x) => x.children.length === 0 && /persist-smoke/.test(x.textContent || '')); el?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
  await pg.waitForTimeout(6000);
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText === 'EDIT')?.click());
  await pg.waitForTimeout(4000);
  if (process.env.SMOKE_SHOTS) await pg.screenshot({ path: SP + 'persist-after-reload.png' });
  await pg.keyboard.press('Escape'); await pg.evaluate(() => document.querySelectorAll('div.fixed.inset-0').forEach((e) => /API keys/.test(e.innerText) && e.remove())); // first-run API key popup
  assert(await pg.locator('.clip-card').count() >= 1, 'clip still on the timeline after reload');
  // the clip's media: a live blob URL that plays
  const info = await pg.evaluate(async () => {
    const vids = [...document.querySelectorAll('video')];
    const srcs = vids.map((v) => v.currentSrc || v.src).filter(Boolean);
    const out = [];
    for (const s of srcs) { try { const r = await fetch(s, { headers: { Range: 'bytes=0-0' } }); out.push({ s: s.slice(0, 40), ok: r.ok || r.status === 206 }); } catch { out.push({ s: s.slice(0, 40), ok: false }); } }
    return { n: vids.length, out, ready: vids.map((v) => v.readyState), dur: vids.map((v) => v.duration) };
  });
  console.log('videos after reload:', JSON.stringify(info));
  assert(info.out.some((o) => o.ok && o.s.startsWith('blob:')), 'a <video> loaded a live restored blob: URL (no relink)');
  assert(info.dur.some((d) => d > 5.5 && d < 6.5), 'media decodes with its 6 s duration');
  assert(await pg.locator('[data-testid=range-readout]').innerText() === rangeReadout, 'timeline range persisted: ' + rangeReadout);
  await dismiss(pg); await pg.locator('[title="clipA.mp4"]').first().dblclick(); await pg.waitForTimeout(1200);
  const m2 = await pg.locator('[data-testid=mark-readout]').innerText();
  assert(m2 === markReadout, 'source marks persisted after reload: ' + m2);
  // export: the restored blob exports (no relink) and honours the range
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  await dismiss(pg);
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => /^EXPORT$/i.test(x.innerText))?.click()); await pg.waitForTimeout(2000);
  const qa = pg.locator('[data-testid=export-auto-qa]'); if (await qa.count() && await qa.isChecked()) await qa.uncheck();
  const dl = pg.waitForEvent('download', { timeout: 150000 }).catch((e) => ({ err: String(e) }));
  await pg.locator('.export-settings__render-btn').click();
  await pg.waitForTimeout(8000); console.log('render panel after 8 s:', (await pg.locator('body').innerText().catch(() => '?')).replace(/\s+/g, ' ').slice(-300));
  const d = await dl;
  if (!(d && d.saveAs)) { console.log('export tab text:', (await pg.locator('.export-tab').innerText().catch(() => '?')).replace(/\s+/g, ' ').slice(0, 600)); if (process.env.SMOKE_SHOTS) await pg.screenshot({ path: SP + 'persist-export-fail.png' }); }
  assert(!!(d && d.saveAs), 'export produced a download after reload (no relink)');
  if (d && d.saveAs) {
    const out = SP + 'persist-export.' + ((/\.(\w+)$/.exec(d.suggestedFilename()) || [, 'mp4'])[1]); await d.saveAs(out);
    const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString());
    const mean = execFileSync('ffmpeg', ['-v', 'error', '-ss', '0.5', '-i', out, '-frames:v', '1', '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('export duration', dur, 'size', fs.statSync(out).size);
    assert(dur > 1.7 && dur < 2.4, 'export honours the 1 s to 3 s range: duration ' + dur + ' s (full clip is 6 s)');
    assert(fs.statSync(out).size > 5000, 'export file has content');
  }
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText === 'EDIT')?.click()); await pg.waitForTimeout(2500);
  // media health: not offline
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Media tools/i.test(x.innerText))?.click());
  await pg.waitForTimeout(800);
  await pg.evaluate(() => [...document.querySelectorAll('button,[role=tab]')].find((x) => /Media health/i.test(x.innerText))?.click());
  await pg.waitForTimeout(500);
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Check media/i.test(x.innerText))?.click());
  await pg.waitForTimeout(2000);
  const msg = await pg.locator('[data-testid=media-health]').innerText().catch(() => '');
  console.log('media health:', msg.replace(/\s+/g, ' ').slice(-200));
  assert(/0 of 1 sources are missing/.test(msg), 'Check media: 0 of 1 sources missing after reload');
  await b.close();
})();
