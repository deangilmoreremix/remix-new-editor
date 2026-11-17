/* Stage 11 (port H) real-browser smoke: real #/timeline, import an ffmpeg-made 440 Hz mp4, set +12 semitones in Media tools > Audio, check the preview
 * (AudioWorklet loaded, node in the graph, live output ~880 Hz measured with an AnalyserNode), save (stage4_json), then a REAL export; the exported audio
 * is measured by pitch-analyze.py (numpy FFT).
 * Run: `npx vite --port 3120` (first load ~70 s), SMOKE_DIR=<dir>/ (holds sine440.mp4, see docs/stage-11/PORT_H_REPORT.md) SMOKE_PORT=3120
 *   CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node docs/stage-11/smoke/pitch-smoke.cjs
 * Env: SEMI (default 12; 0 = no shift), RAMP (a Stage 1 speed-ramp preset id, e.g. speed-up: applied to the selected clip before the pitch is set),
 *      NOPRESERVE=1 (untick "Preserve pitch when speed changes"), OUT (export base name). */
const fs = require('fs');
const L = require('../../stage-8/smoke/combined-lib.cjs');
const SP = L.SP;
const SEMI = Number(process.env.SEMI ?? 12);
const results = []; let failed = 0;
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); results.push({ ok: !!c, m }); if (!c) failed++; };
const info = (m) => console.log('INFO', m);
const timelineRow = (store) => { const k = Object.keys(store).find((x) => /project\.json$/.test(x)); const p = JSON.parse(store[k]); return p.timelines.find((t) => t.id === p.activeTimelineId) || p.timelines[0]; };

(async () => {
  const { b, pg, cons } = await L.launch();
  pg.on('console', (m) => { if (/pitch|worklet/i.test(m.text())) info('PAGE ' + m.type() + ': ' + m.text().slice(0, 300)); });
  await L.goTimeline(pg); await L.newProject(pg, 'pitch');
  await L.clickBtn(pg, '^EDIT$'); await pg.waitForTimeout(3000);
  await L.addVideo(pg, SP + 'sine440.mp4');
  await pg.locator('[title="sine440.mp4"]').first().dblclick(); await pg.waitForTimeout(1500);
  await pg.locator('[data-testid=insert-edit]').click(); await pg.waitForTimeout(1500);
  assert((await pg.locator('.clip-card').count()) >= 2, 'imported clip placed with its linked audio (' + (await pg.locator('.clip-card').count()) + ' cards)');

  await pg.locator('[data-testid=s4-open]').click({ force: true });
  await pg.locator('[data-testid=s4-tab-audio]').click(); await pg.waitForTimeout(500);
  await pg.locator('.clip-card').filter({ hasNotText: '(audio)' }).first().click(); await pg.waitForTimeout(500);
  if (process.env.RAMP) {
    await pg.locator('select').filter({ hasText: 'Speed ramp' }).first().selectOption(process.env.RAMP).catch(async () => { const o = await pg.locator('select').filter({ hasText: 'Speed ramp' }).first().locator('option').allInnerTexts(); info('ramp options ' + JSON.stringify(o)); });
    await pg.waitForTimeout(1500); info('clip cards after ramp: ' + (await pg.locator('.clip-card').count()));
    await pg.locator('.clip-card').filter({ hasNotText: '(audio)' }).first().click(); await pg.waitForTimeout(500);
  }
  assert(await pg.locator('[data-testid=pitch-controls]').count() === 1, 'Audio tab shows the pitch controls for the selected (video) clip via its linked audio');
  if (SEMI !== 0) { await pg.locator('[data-testid=pitch-semitones]').fill(String(SEMI)); await pg.waitForTimeout(400); assert((await pg.locator('[data-testid=pitch-heard]').innerText()).includes((SEMI > 0 ? '+' : '') + SEMI.toFixed(2)), 'heard-pitch line shows ' + SEMI); }
  if (process.env.RAMP && SEMI !== 0) { await pg.screenshot({ path: SP + 'pitch-ramp-ui.png' }); info('pitch controls: ' + (await pg.locator('[data-testid=pitch-controls]').innerText()).replace(/\s+/g, ' ')); await pg.evaluate(() => document.querySelector('[data-testid=pitch-apply-pieces]').click()); await pg.waitForTimeout(500); }
  if (process.env.NOPRESERVE) { await pg.locator('[data-testid=pitch-preserve]').uncheck(); await pg.waitForTimeout(300); }
  await pg.screenshot({ path: SP + 'pitch-ui.png' });

  // ---- preview: play and measure the live output of the master with an extra analyser tapped from the graph
  // capture the engine's master analyser (AudioFxGraph creates the L analyser first) so the live preview output can be measured
  await pg.evaluate(() => { window.__an = []; const o = AudioContext.prototype.createAnalyser; AudioContext.prototype.createAnalyser = function () { const a = o.call(this); window.__an.push(a); return a; }; });
  await pg.mouse.click(503, 517); await pg.waitForTimeout(500); // timeline ruler start
  await pg.evaluate(() => [...document.querySelectorAll('.timeline-viewer__btn--play')].pop().click()); // DOM click: the Media tools panel can cover the play button
  await pg.waitForTimeout(2500);
  const meter = await pg.evaluate(async () => {
    const r = { worklet: typeof AudioWorkletNode !== 'undefined', pitchWarn: !!document.querySelector('[data-testid=pitch-warning]') };
    r.mediaEls = [...document.querySelectorAll('video,audio')].map((v) => [v.tagName, v.paused, +v.currentTime.toFixed(2), v.preservesPitch]);
    return r;
  });
  info('preview state ' + JSON.stringify(meter));
  assert(meter.worklet && !meter.pitchWarn, 'AudioWorklet present and no pitch warning shown');
  const live = await pg.evaluate(async () => {
    const a = window.__an[0]; if (!a) return null; a.fftSize = 32768; a.smoothingTimeConstant = 0;
    await new Promise((r) => setTimeout(r, 600));
    const sr = a.context.sampleRate; const buf = new Float32Array(a.frequencyBinCount); a.getFloatFrequencyData(buf);
    let k = 1; for (let i = 1; i < buf.length - 1; i++) if (buf[i] > buf[k]) k = i;
    const la = buf[k - 1], lb = buf[k], lc = buf[k + 1]; const d = (0.5 * (la - lc)) / (la - 2 * lb + lc);
    return { hz: (k + (Number.isFinite(d) ? d : 0)) * sr / a.fftSize, db: buf[k] };
  });
  info('live preview peak ' + JSON.stringify(live));
  assert(live && Math.abs(live.hz - 440 * Math.pow(2, SEMI / 12)) / (440 * Math.pow(2, SEMI / 12)) < 0.02, 'preview output (master analyser) peaks at ~' + (440 * Math.pow(2, SEMI / 12)).toFixed(1) + ' Hz: ' + (live && live.hz.toFixed(1)));
  const dbL = Number(await pg.locator('[data-testid=meter-L]').getAttribute('data-db'));
  assert(dbL > -60, 'meters show sound while the shifted clip plays (' + dbL + ' dBFS)');
  await pg.evaluate(() => [...document.querySelectorAll('.timeline-viewer__btn--play')].pop().click()); // DOM click: the Media tools panel can cover the play button
  await pg.waitForTimeout(500);
  // worklet module: loaded through Vite, same-origin (worklet fetches are not in the page's resource timing, so ask the dev server which URL was requested)
  const wl = await pg.evaluate(() => fetch('/src/cinegen/lib/audio/pitch-worklet.processor.js?worker_file&type=module').then((r) => [r.status, r.headers.get('content-type')]).catch((e) => [String(e)]));
  info('worklet module fetch ' + JSON.stringify(wl));
  assert(wl[0] === 200, 'pitch worklet module is served same-origin by the dev server');

  // ---- persistence
  await pg.keyboard.press('Control+s'); await pg.waitForTimeout(1500);
  const tl = timelineRow(await L.readStore(pg));
  const aud = tl.clips.find((c) => /\(audio\)/.test(c.name));
  const s4 = aud && aud.stage4_json ? JSON.parse(aud.stage4_json) : null;
  info('saved stage4_json ' + JSON.stringify(s4));
  assert(s4 && s4.pitch && s4.pitch.semitones === SEMI, 'pitch saved on the audio clip row (stage4_json)');
  fs.writeFileSync(SP + 'pitch-saved-timeline.json', JSON.stringify(tl, null, 1));

  // ---- real export
  await pg.locator('[data-testid=s4-open]').click({ force: true }).catch(() => {}); await pg.waitForTimeout(500); // close the Media tools dock
  await L.clickBtn(pg, '^EXPORT$'); await pg.waitForTimeout(2000);
  await pg.screenshot({ path: SP + 'pitch-export-tab.png' });
  const qa = pg.locator('[data-testid=export-auto-qa]'); if (await qa.count() && await qa.isChecked()) await qa.uncheck();
  const dl = pg.waitForEvent('download', { timeout: 280000 }).catch((e) => ({ err: String(e) }));
  await pg.locator('.export-settings__render-btn').click();
  await pg.waitForTimeout(15000); info('export page text: ' + (await pg.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 600));
  const d = await dl;
  let out = null;
  if (d && d.saveAs) { const ext = (/\.(\w+)$/.exec(d.suggestedFilename()) || [, 'mp4'])[1]; out = SP + (process.env.OUT || 'pitch-export') + '.' + ext; await d.saveAs(out); info('SAVED ' + out); }
  assert(!!out, 'real export produced a file: ' + out);
  const warn = await pg.evaluate(() => [...document.querySelectorAll('.export-panel__warning, [data-testid=export-warnings] *')].map((x) => x.textContent).join(' | ')).catch(() => '');
  info('export warnings: ' + warn);
  info('console errors: ' + JSON.stringify(cons.slice(0, 8)));
  fs.writeFileSync(SP + 'pitch-results.json', JSON.stringify({ results, out, semi: SEMI }, null, 1));
  await b.close();
  console.log(failed ? 'FAILED ' + failed : 'ALL PASS');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('SMOKE ERROR', e); process.exit(2); });
