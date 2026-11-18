/* Stage 11 (port J): Lift / Extract of the timeline in-out range in the real editor. clipA.mp4 = 6 s with audio.
 * Run: SMOKE_PORT=3150 SMOKE_DIR=<dir with clipA.mp4>/ CHROMIUM_PATH=... node range-smoke.cjs */
const L = require('../../stage-8/smoke/combined-lib.cjs');
const results = []; let failed = 0;
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); results.push({ ok: !!c, m }); if (!c) failed++; };
const g = (o, a, b) => (o[a] !== undefined ? o[a] : o[b]);
async function clips(pg) {
  const store = await L.readStore(pg); const k = Object.keys(store).find((x) => /project\.json$/.test(x)); const p = JSON.parse(store[k]); const tl = p.timelines.find((t) => t.id === p.activeTimelineId) || p.timelines[0];
  const vt = tl.tracks.filter((t) => t.kind === 'video').map((t) => t.id);
  return tl.clips.filter((c) => vt.includes(g(c, 'trackId', 'track_id'))).map((c) => { const ts = g(c, 'trimStart', 'trim_start'); const te = g(c, 'trimEnd', 'trim_end'); return { start: g(c, 'startTime', 'start_time'), end: g(c, 'startTime', 'start_time') + (c.duration - ts - te) / c.speed, trimStart: ts }; }).sort((a, b) => a.start - b.start);
}
(async () => {
  const { b, pg } = await L.launch();
  await L.goTimeline(pg); await L.newProject(pg, 'range-' + Date.now().toString(36));
  await L.clickBtn(pg, '^EDIT$'); await pg.waitForTimeout(3000);
  await L.addVideo(pg, L.SP + 'clipA.mp4');
  await pg.locator('[title="clipA.mp4"]').first().dblclick(); await pg.waitForTimeout(1500);
  await pg.locator('[data-testid=insert-edit]').click(); await pg.waitForTimeout(1500);
  for (let i = 0; i < 4 && await pg.locator('.element-modal__backdrop').count(); i++) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); }
  const rb = await pg.locator('.timeline-editor__ruler').first().boundingBox();
  const pps = await pg.evaluate(() => { const t = [...document.querySelectorAll('.timeline-editor__ruler-tick--major')].map((e) => ({ left: parseFloat(e.style.left), label: e.innerText.trim() })).find((x) => x.left > 0 && /^\d\d:\d\d:\d\d:\d\d$/.test(x.label)); const [h, m, s, f] = t.label.split(':').map(Number); return t.left / (h * 3600 + m * 60 + s + f / 24); });
  const seek = async (sec) => { await pg.mouse.click(rb.x + sec * pps, rb.y + rb.height / 2); await pg.waitForTimeout(500); };
  await pg.waitForSelector('.clip-card', { timeout: 30000 }); await pg.waitForTimeout(4000);
  const before = await clips(pg); console.log('INFO before', JSON.stringify(before));
  assert(before.length === 1 && Math.abs(before[0].end - 6) < 0.1, 'one 6 s clip on V1');
  assert(await pg.locator('[data-testid=range-extract]').isDisabled(), 'Lift / Extract are disabled without a range');
  await seek(2); await pg.locator('[data-testid=range-in]').click(); await seek(4); await pg.locator('[data-testid=range-out]').click(); await pg.waitForTimeout(400);
  console.log('INFO range', await pg.locator('[data-testid=range-readout]').innerText());
  // Lift first
  await pg.locator('[data-testid=range-lift]').click(); await pg.waitForTimeout(400);
  const liftNotice = await pg.locator('[data-testid=stage1-notice]').innerText().catch(() => ''); await pg.waitForTimeout(3100);
  const lifted = await clips(pg); console.log('INFO lifted', JSON.stringify(lifted));
  assert(lifted.length === 2 && Math.abs(lifted[0].end - 2) < 0.15 && Math.abs(lifted[1].start - 4) < 0.15 && Math.abs(lifted[1].end - 6) < 0.15, 'Lift leaves a 2 s gap: pieces 0-2 and 4-6');
  assert(/Lifted 2\.\d\d s/.test(liftNotice), 'notice says what was lifted (' + liftNotice + ')');
  let presses = 0; let undone = [];
  for (; presses < 3 && !(undone.length === 1 && Math.abs(undone[0].end - 6) < 0.1);) { await pg.keyboard.press('Control+z'); presses++; await pg.waitForTimeout(3500); undone = await clips(pg); }
  assert(undone.length === 1 && Math.abs(undone[0].end - 6) < 0.1, 'undo restores the clip after ' + presses + ' Ctrl+Z press(es) (' + JSON.stringify(undone) + ')');
  console.log('INFO undo presses needed:', presses, '(more than 1 means another history entry sits after the edit: Stage 1 saw the same with Insert)');
  // Extract
  await pg.locator('[data-testid=range-extract]').click(); await pg.waitForTimeout(3500);
  const ex = await clips(pg); console.log('INFO extracted', JSON.stringify(ex));
  assert(ex.length === 2 && Math.abs(ex[0].end - 2) < 0.15 && Math.abs(ex[1].start - ex[0].end) < 0.05 && Math.abs(ex[1].end - 4) < 0.15 && Math.abs(ex[1].trimStart - 4) < 0.15, 'Extract closes the gap: 0-2 then the source from 4 s, total 4 s');
  assert(await pg.locator('[data-testid=range-extract]').isDisabled(), 'the range is cleared after Extract');
  require('fs').writeFileSync(L.SP + 'range-results.json', JSON.stringify(results, null, 1));
  await b.close(); console.log(failed ? 'FAILED ' + failed : 'ALL PASS'); process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(2); });
