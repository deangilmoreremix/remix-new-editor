/* Fix M: re-editable speed curves in the real editor (Chromium, real #/timeline, real imported mp4, real save / reload).
 * (1) apply a 12-piece curve through the Speed curve popover, (2) the saved project rows carry the curve (stage1_json), (3) reload the project: the curve is
 * still there, (4) select a MIDDLE piece, open Speed curve: the editor shows the stored curve and step count, (5) change preset + steps and apply: ALL pieces
 * are replaced (video + linked audio), (6) one Ctrl+Z restores the 12-piece group, (7) delete one piece: the group is stale, the popover says why.
 * Run: SMOKE_PORT=3612 SMOKE_DIR=<dir with tcode.mp4>/ CHROMIUM_PATH=... node curve-reedit-smoke.cjs   (tcode.mp4 recipe: see export-smoke.cjs) */
const L = require('../../stage-8/smoke/combined-lib.cjs');
const PORT = process.env.SMOKE_PORT || 3150;
const results = []; let failed = 0;
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); results.push({ ok: !!c, m }); if (!c) failed++; };
const info = (m) => console.log('INFO', m);
const g = (o, a, b) => (o[a] !== undefined ? o[a] : o[b]);
const PNAME = 'reedit-' + Date.now().toString(36);
const dismiss = async (pg) => { for (let i = 0; i < 4 && await pg.locator('.element-modal__backdrop').count(); i++) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); } };
async function saved(pg) {
  const store = await L.readStore(pg); const k = Object.keys(store).find((x) => /project\.json$/.test(x)); const p = JSON.parse(store[k]); const tl = p.timelines.find((t) => t.id === p.activeTimelineId) || p.timelines[0];
  return tl.clips.map((c) => { let s1 = null; try { s1 = typeof c.stage1_json === 'string' ? JSON.parse(c.stage1_json) : c.stage1_json; } catch { /* none */ } return { id: c.id, track: g(c, 'trackId', 'track_id'), start: g(c, 'startTime', 'start_time'), speed: c.speed, sc: (s1 && s1.speedCurve) || (c.speedCurve) || null }; });
}
async function openProject(pg, name) {
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.getByRole('button', { name: 'Skip for now' }).click({ timeout: 8000 }).catch(() => {});
  await pg.waitForSelector('.pm-window, .workspace-content', { timeout: 150000 }); await pg.waitForTimeout(2500);
  if (await pg.locator('.pm-window').count()) {
    await pg.evaluate((n) => { const el = [...document.querySelectorAll('.pm-window *')].find((x) => x.children.length === 0 && new RegExp(n).test(x.textContent || '')); if (el) el.click(); }, name);
    await pg.waitForTimeout(500);
    await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => /^open/i.test(x.innerText.trim()))?.click());
  }
  await pg.waitForTimeout(5000);
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'EDIT')?.click()); await pg.waitForTimeout(2500);
}
const videoCards = (pg) => pg.locator('.clip-card').filter({ hasNotText: '(audio)' });
(async () => {
  const { b, pg } = await L.launch();
  await L.goTimeline(pg); await L.newProject(pg, PNAME);
  await L.clickBtn(pg, '^EDIT$'); await pg.waitForTimeout(3000);
  await L.addVideo(pg, L.SP + 'tcode.mp4');
  await pg.locator('[title="tcode.mp4"]').first().dblclick(); await pg.waitForTimeout(1500);
  await pg.locator('[data-testid=insert-edit]').click(); await pg.waitForTimeout(1500);
  await dismiss(pg);
  await pg.waitForSelector('.clip-card', { timeout: 30000 });
  // (1) first apply
  await videoCards(pg).first().click(); await pg.waitForTimeout(400);
  await pg.locator('[data-testid=speed-curve-btn]').click(); await pg.waitForSelector('[data-testid=speed-curve-editor]');
  assert(await pg.locator('[data-testid=speed-curve-note]').count() === 0, 'a plain clip opens the editor without a re-edit note');
  await pg.selectOption('[data-testid=speed-curve-preset]', 'hero-moment');
  await pg.locator('[data-testid=speed-steps]').fill('12'); await pg.waitForTimeout(300);
  await pg.locator('[data-testid=speed-curve-apply]').click(); await pg.waitForTimeout(2500);
  assert(await pg.locator('.clip-card').count() === 24, 'curve applied: 24 clip cards (12 video + 12 audio)');
  await pg.waitForTimeout(3500);
  // (2) saved rows carry the curve
  let rows = await saved(pg); const withSc = rows.filter((r) => r.sc);
  info('saved rows: ' + rows.length + ', with speedCurve: ' + withSc.length);
  assert(rows.length === 24 && withSc.length === 24 && withSc.every((r) => r.sc.steps === 12 && r.sc.curve.points.length === 3), 'every saved piece (video and audio) carries the curve (12 steps, 3 points)');
  const group1 = withSc[0].sc.group;
  // (3) reload: the project comes back with the curve
  await openProject(pg, PNAME);
  await pg.waitForSelector('.clip-card', { timeout: 30000 });
  assert(await pg.locator('.clip-card').count() === 24, 'after reload: 24 clip cards');
  // (4) a MIDDLE piece opens the stored curve
  await videoCards(pg).nth(6).click(); await pg.waitForTimeout(400);
  await pg.locator('[data-testid=speed-curve-btn]').click(); await pg.waitForSelector('[data-testid=speed-curve-editor]');
  const note = await pg.locator('[data-testid=speed-curve-note]').innerText().catch(() => '');
  info('note: ' + note);
  assert(/Editing the curve of this ramped clip \(12 pieces\)/.test(note), 'middle piece: the editor opens in re-edit mode');
  assert(await pg.locator('[data-testid=speed-steps-value]').innerText() === '12', 'the stored step count (12) is shown');
  assert(await pg.locator('[data-testid=speed-point-2]').count() === 1 && await pg.locator('[data-testid=speed-point-3]').count() === 0, 'the stored 3-point curve is drawn');
  const text1 = await pg.locator('[data-testid=speed-curve-result]').innerText();
  // (5) change the curve and re-apply
  await pg.selectOption('[data-testid=speed-curve-preset]', 'flash-forward');
  await pg.locator('[data-testid=speed-steps]').fill('8'); await pg.waitForTimeout(300);
  const text2 = await pg.locator('[data-testid=speed-curve-result]').innerText(); info(text1 + '  ->  ' + text2);
  await pg.locator('[data-testid=speed-curve-apply]').click(); await pg.waitForTimeout(2500);
  const notice = await pg.locator('[data-testid=stage1-notice]').innerText().catch(() => '');
  assert(await pg.locator('.clip-card').count() === 16, 're-apply replaced ALL pieces: 16 clip cards (8 video + 8 audio), notice: ' + notice);
  await pg.waitForTimeout(3500);
  rows = await saved(pg);
  const g2 = new Set(rows.filter((r) => r.sc).map((r) => r.sc.group));
  assert(rows.length === 16 && g2.size === 1 && !g2.has(group1) && rows.every((r) => r.sc && r.sc.steps === 8), 'saved: 16 rows, one new group, 8 steps, no leftovers of the old group');
  const vt = rows.filter((r) => r.sc).sort((a, c) => a.start - c.start);
  const total = parseFloat((/plays in ([\d.]+) s/.exec(text2) || [])[1]);
  assert(total > 0, 'editor predicted ' + total + ' s for the new curve');
  // (6) undo: one step back to 12 pieces
  let presses = 0; let n = 16;
  for (; presses < 3 && n !== 24;) { await pg.keyboard.press('Control+z'); presses++; await pg.waitForTimeout(3500); n = await pg.locator('.clip-card').count(); }
  assert(n === 24, 'Ctrl+Z restores the 12-piece group (24 cards) after ' + presses + ' press(es)');
  await pg.waitForTimeout(3500); rows = await saved(pg);
  assert(rows.length === 24 && rows.every((r) => r.sc && r.sc.steps === 12), 'saved state after undo: 24 rows with the 12-step curve');
  // (7) stale: delete one video piece, then open the curve on its neighbour
  await videoCards(pg).nth(4).click(); await pg.waitForTimeout(300); await pg.keyboard.press('Delete'); await pg.waitForTimeout(1200);
  const after = await pg.locator('.clip-card').count(); info('cards after delete: ' + after);
  await videoCards(pg).nth(3).click(); await pg.waitForTimeout(400);
  if (!await pg.locator('[data-testid=speed-curve-editor]').count()) await pg.locator('[data-testid=speed-curve-btn]').click();
  await pg.waitForSelector('[data-testid=speed-curve-editor]');
  const note2 = await pg.locator('[data-testid=speed-curve-note]').innerText().catch(() => '');
  info('stale note: ' + note2);
  assert(/can no longer be edited/.test(note2) && /Applying makes a new curve over this piece only/.test(note2), 'after deleting a piece the group is stale and the popover says why');
  await b.close(); console.log(failed ? 'FAILED ' + failed : 'ALL PASS'); process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(2); });
