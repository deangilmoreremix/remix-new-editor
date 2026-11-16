/* Stage 11 (port J): real exports through the Export tab (Remotion web renderer): (A) a clip with a speed CURVE, frame timing checked against the piece
 * list; (B) audio-only exports (wav / mp3 / aac / flac / ogg) decoded with ffmpeg; (C) mov / mkv video containers probed with ffprobe.
 * Run: npx vite --port 3150 ; SMOKE_PORT=3150 SMOKE_DIR=<dir with tcode.mp4>/ CHROMIUM_PATH=... node export-smoke.cjs
 * tcode.mp4: ffmpeg -f lavfi -i "color=c=black:s=320x180:r=25:d=10,geq=lum='255*T/10':cb=128:cr=128" -f lavfi -i sine=frequency=440:duration=10 -c:v libx264 -pix_fmt yuv420p -g 5 -crf 10 -c:a aac -shortest tcode.mp4 */
const fs = require('fs'); const cp = require('child_process');
const L = require('../../stage-8/smoke/combined-lib.cjs');
const results = []; let failed = 0;
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); results.push({ ok: !!c, m }); if (!c) failed++; };
const info = (m) => console.log('INFO', m);
const PNAME = 'exp-' + Date.now().toString(36);
const ONLY = (process.env.ONLY || 'curve,wav,mp3,aac,flac,ogg,mov,mkv').split(',');
async function exportAs(pg, fmt, base, preset = 'Draft') {
  await L.clickBtn(pg, '^EXPORT$'); await pg.waitForTimeout(2000);
  const qa = pg.locator('[data-testid=export-auto-qa]'); if (await qa.count() && await qa.isChecked()) await qa.uncheck();
  await pg.locator('.export-settings__preset-card').filter({ hasText: preset }).first().click();
  await pg.selectOption('[data-testid=export-format]', fmt);
  const dl = pg.waitForEvent('download', { timeout: 290000 }).catch((e) => ({ err: String(e) }));
  await pg.locator('.export-settings__render-btn').click();
  const d = await dl;
  if (!d || !d.saveAs) { info('NO DOWNLOAD ' + JSON.stringify(d)); return null; }
  const out = L.SP + base + '.' + (/\.(\w+)$/.exec(d.suggestedFilename()) || [, fmt])[1]; await d.saveAs(out); info('SAVED ' + out + ' ' + fs.statSync(out).size + ' bytes'); return out;
}
const probe = (f) => JSON.parse(cp.execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,format_name:stream=codec_type,codec_name,sample_rate,channels', '-of', 'json', f]).toString());
const volume = (f) => { const r = cp.spawnSync('ffmpeg', ['-v', 'info', '-i', f, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], { encoding: 'utf8' }); const m = /mean_volume: (-?[\d.]+) dB/.exec(r.stderr); const mx = /max_volume: (-?[\d.]+) dB/.exec(r.stderr); return { mean: m ? parseFloat(m[1]) : null, max: mx ? parseFloat(mx[1]) : null }; };
const decodedDuration = (f) => { const r = cp.spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-vn', '-f', 'null', '-'], { encoding: 'utf8' }); const r2 = cp.spawnSync('ffmpeg', ['-i', f, '-vn', '-f', 'null', '-'], { encoding: 'utf8' }); const m = [...r2.stderr.matchAll(/time=(\d+):(\d+):([\d.]+)/g)].pop(); return { err: r.stderr.trim(), sec: m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : null }; };

(async () => {
  const { b, pg } = await L.launch();
  await L.goTimeline(pg); await L.newProject(pg, PNAME);
  await L.clickBtn(pg, '^EDIT$'); await pg.waitForTimeout(3000);
  await L.addVideo(pg, L.SP + 'tcode.mp4');
  await pg.locator('[title="tcode.mp4"]').first().dblclick(); await pg.waitForTimeout(1500);
  await pg.locator('[data-testid=insert-edit]').click(); await pg.waitForTimeout(1500);
  for (let i = 0; i < 4 && await pg.locator('.element-modal__backdrop').count(); i++) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); }
  // ---- calibration: the same clip exported plain, through the same pipeline (the analysis reads source time back from the picture's luma)
  // (run once with ONLY=calib first, in its own browser: a second export in the same page made Chromium run out of memory on this machine)
  const calibPath = L.SP + 'calib.mp4';
  if (ONLY.length === 1 && ONLY[0] === 'calib') {
    const f = await exportAs(pg, 'mp4', 'calib'); assert(!!f, 'calibration export (plain, 1x) produced a file');
    await b.close(); console.log(failed ? 'FAILED ' + failed : 'ALL PASS'); process.exit(failed ? 1 : 0);
  }
  const calib = calibPath; assert(fs.existsSync(calibPath), 'calibration export exists (' + calibPath + ')');
  // ---- speed curve through the real UI
  await pg.locator('.clip-card').filter({ hasNotText: '(audio)' }).first().click(); await pg.waitForTimeout(400);
  await pg.locator('[data-testid=speed-curve-btn]').click(); await pg.waitForSelector('[data-testid=speed-curve-editor]');
  const MODE = process.env.MODE || 'curve'; // curve | const
  if (MODE === 'const') { // a flat curve (SPEED, default 2x): equal pieces, isolates piece-boundary handling of the export from the curve maths
    await pg.selectOption('[data-testid=speed-curve-preset]', 'ease-into-slow');
    for (const i of [0, 1]) { await pg.locator('[data-testid=speed-point-' + i + ']').click(); await pg.locator('[data-testid=speed-point-value]').fill(process.env.SPEED || '2'); }
    await pg.locator('[data-testid=speed-segment-curve]').count(); // segment easing is irrelevant for equal end speeds
  } else await pg.selectOption('[data-testid=speed-curve-preset]', 'flash-forward');
  if (MODE === 'curve') {
  const pathBefore = await pg.locator('[data-testid=speed-curve-path]').getAttribute('points');
  // edit segment 1 with the Stage 2 bezier editor: bezier mode, x1 = 0.9
  await pg.locator('[data-testid=speed-segment-curve]').click(); await pg.waitForSelector('[data-testid=curve-editor]');
  await pg.locator('[data-testid=curve-mode-bezier]').click();
  await pg.locator('[data-testid=curve-num-0]').fill('0.9'); await pg.locator('[data-testid=curve-num-1]').fill('0');
  await pg.waitForTimeout(300);
  const pathAfter = await pg.locator('[data-testid=speed-curve-path]').getAttribute('points');
  assert(pathBefore !== pathAfter, 'editing the segment with the bezier editor changes the speed curve');
  await pg.locator('[data-testid=curve-close]').click();
  // drag the middle point up a little (pointer drag on the graph)
  const pt = await pg.locator('[data-testid=speed-point-1]').boundingBox();
  await pg.mouse.move(pt.x + pt.width / 2, pt.y + pt.height / 2); await pg.mouse.down(); await pg.mouse.move(pt.x + pt.width / 2, pt.y + pt.height / 2 - 12, { steps: 5 }); await pg.mouse.up();
  }
  await pg.locator('[data-testid=speed-steps]').fill(process.env.STEPS || '16'); await pg.waitForTimeout(300);
  const resultText = await pg.locator('[data-testid=speed-curve-result]').innerText();
  info('editor says: ' + resultText);
  if (process.env.STEPS) { await pg.locator('[data-testid=speed-steps]').fill(process.env.STEPS); await pg.waitForTimeout(300); }
  await pg.locator('[data-testid=speed-curve-apply]').click(); await pg.waitForTimeout(2500);
  const cards = await pg.locator('.clip-card').count();
  assert(cards >= 2 * 12, 'curve applied: ' + cards + ' clip cards');
  await pg.waitForTimeout(3500); // autosave
  const store = await L.readStore(pg);
  const k = Object.keys(store).find((x) => /project\.json$/.test(x)); const proj = JSON.parse(store[k]); const tl = proj.timelines.find((t) => t.id === proj.activeTimelineId) || proj.timelines[0];
  // the web store keeps rows (snake_case); tolerate the camelCase shape too
  const g = (o, a, b) => (o[a] !== undefined ? o[a] : o[b]);
  const vtracks = tl.tracks.filter((t) => t.kind === 'video').map((t) => t.id);
  const vclips = tl.clips.filter((c) => vtracks.includes(g(c, 'trackId', 'track_id'))).sort((a, c) => g(a, 'startTime', 'start_time') - g(c, 'startTime', 'start_time'));
  const pieces = vclips.map((c) => { const ts = g(c, 'trimStart', 'trim_start'); const te = g(c, 'trimEnd', 'trim_end'); const span = c.duration - ts - te; return { start: g(c, 'startTime', 'start_time'), trimStart: ts, speed: c.speed, dur: span / c.speed }; });
  fs.writeFileSync(L.SP + 'pieces.json', JSON.stringify(pieces));
  const totalPieces = pieces.reduce((m, p) => m + p.dur, 0);
  const said = /plays in ([\d.]+) s/.exec(resultText);
  assert(vclips.length >= 12 && said && Math.abs(totalPieces - parseFloat(said[1])) < 0.02, `saved pieces (${vclips.length}) total ${totalPieces.toFixed(3)} s equals the editor's result ${said && said[1]} s`);
  const speeds = pieces.map((p) => p.speed); info('piece speeds min ' + Math.min(...speeds) + ' max ' + Math.max(...speeds));
  assert(Math.max(...speeds) > 2 && Math.min(...speeds) < 1.5, 'speeds vary along the clip');

  const files = {};
  if (ONLY.includes('curve')) {
    const f = await exportAs(pg, 'mp4', 'curve'); files.curve = f; assert(!!f, 'curve export produced a file');
    if (f) {
      const r = cp.spawnSync('python3', ['-I', __dirname + '/speedcurve-analyze.py', f, calib, L.SP + 'pieces.json'], { encoding: 'utf8' });
      if (r.status !== 0) assert(false, 'analysis ran ' + r.stderr.slice(0, 300)); else {
        const a = JSON.parse(r.stdout); fs.writeFileSync(L.SP + 'curve-analysis.json', JSON.stringify(a, null, 1)); info(JSON.stringify({ ...a, local_speed: undefined }));
        assert(Math.abs(a.duration_error) < 0.25, `exported duration ${a.container_duration.toFixed(3)} s vs timeline ${a.timeline_duration.toFixed(3)} s`);
        assert(a.mean_abs_src_time_error < 0.1, `frame timing: mean |source time error| ${a.mean_abs_src_time_error.toFixed(3)} s (max ${a.max_abs_src_time_error.toFixed(3)}, p95 ${a.p95_abs_src_time_error.toFixed(3)})`);
        const sp = a.local_speed.map((x) => x.measured_speed); assert(Math.max(...sp) > 2.5 && Math.min(...sp) < 1.6, 'measured local speed in the export varies like the curve: ' + Math.min(...sp).toFixed(2) + ' .. ' + Math.max(...sp).toFixed(2));
      }
    }
  }
  // ---- audio-only
  const expectedDur = totalPieces;
  for (const fmt of ['wav', 'mp3', 'aac', 'flac', 'ogg']) {
    if (!ONLY.includes(fmt)) continue;
    const f = await exportAs(pg, fmt, 'audio-' + fmt); files[fmt] = f; assert(!!f, fmt + ' export produced a file');
    if (!f) continue;
    const p = probe(f); const streams = p.streams.map((s) => s.codec_type + ':' + s.codec_name); const dd = decodedDuration(f); const v = volume(f);
    info(fmt + ': ' + JSON.stringify({ streams, format: p.format.format_name, dur: p.format.duration, decoded: dd, vol: v }));
    assert(p.streams.length === 1 && p.streams[0].codec_type === 'audio', fmt + ': only an audio stream (' + streams + ')');
    assert(dd.err === '' && dd.sec !== null && Math.abs(dd.sec - expectedDur) < 0.5, `${fmt}: decodes with ffmpeg (${dd.sec} s, timeline ${expectedDur.toFixed(2)} s, errors: ${dd.err.slice(0, 80)})`);
    assert(v.mean !== null && v.mean > -50, fmt + ': not silent (mean ' + v.mean + ' dB)');
  }
  for (const fmt of ['mov', 'mkv']) {
    if (!ONLY.includes(fmt)) continue;
    const f = await exportAs(pg, fmt, 'video-' + fmt); files[fmt] = f; assert(!!f, fmt + ' export produced a file');
    if (!f) continue;
    const p = probe(f); const streams = p.streams.map((s) => s.codec_type + ':' + s.codec_name);
    info(fmt + ': ' + JSON.stringify({ streams, format: p.format.format_name, dur: p.format.duration }));
    const dd = decodedDuration(f);
    assert(streams.includes('video:h264') && streams.some((s) => s.startsWith('audio:')) && dd.err === '', `${fmt}: ${p.format.format_name}, ${streams.join(' ')}, decodes clean (${dd.err.slice(0, 80)})`);
  }
  fs.writeFileSync(L.SP + 'export-results.json', JSON.stringify({ results, files }, null, 1));
  await b.close();
  console.log(failed ? 'FAILED ' + failed : 'ALL PASS'); process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(2); });
