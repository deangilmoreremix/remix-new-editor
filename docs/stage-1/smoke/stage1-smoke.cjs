// Run: start 'npx vite --port 3100', put a small clipA.mp4 (6 s, with audio) next to this file (or set SMOKE_DIR), then 'node stage1-smoke.cjs'.
const { open, SP } = require('./lib.cjs');
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => {
  const { b, pg } = await open();
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText === 'EDIT').click());
  await pg.waitForTimeout(3000);
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Add\s*video/i.test(x.innerText)).click());
  await pg.waitForSelector('[data-testid=add-video-file]', { state: 'attached', timeout: 8000 });
  await pg.setInputFiles('[data-testid=add-video-file]', SP + 'clipA.mp4');
  await pg.waitForTimeout(5000);
  await pg.keyboard.press('Escape');
  await pg.evaluate(() => [...document.querySelectorAll('.element-modal__backdrop button')].find((x) => /×|×|close/i.test(x.innerText + x.getAttribute('aria-label')))?.click());
  await pg.waitForTimeout(500);
  // open the pool asset in the source monitor (double click)
  const card = pg.locator('[title="clipA.mp4"]').first();
  await card.dblclick();
  await pg.waitForTimeout(1500);
  assert(await pg.locator('[data-testid=source-marks]').count() === 1, 'source monitor shows the mark in/out strip for a media-pool item');
  // mark in at 0 with key I (source time 0), seek ~50% via scrubber, mark out with key O
  await pg.keyboard.press('i');
  const sc = await pg.locator('.viewer-scrubber').first().boundingBox();
  await pg.mouse.click(sc.x + sc.width * 0.5, sc.y + sc.height / 2);
  await pg.waitForTimeout(500);
  await pg.keyboard.press('o');
  await pg.waitForTimeout(300);
  const readout = await pg.locator('[data-testid=mark-readout]').innerText();
  console.log('readout:', readout);
  assert(/00:00:00:00 to 00:00:0[23]/.test(readout), 'I and O keys set the marks');
  if (process.env.SMOKE_SHOTS) await pg.screenshot({ path: SP + 's10a.png' });
  // insert at the playhead (0)
  await pg.locator('[data-testid=insert-edit]').click();
  await pg.waitForTimeout(800);
  const clipsAfterInsert = await pg.locator('.clip-card').count();
  console.log('clip cards after insert:', clipsAfterInsert);
  assert(clipsAfterInsert >= 1, 'insert edit placed a clip on the timeline');
  // second insert at playhead (moved to the end of the first clip) with different range: clear marks then insert whole 6s -> ripple
  let undos = 0; let afterUndo = clipsAfterInsert;
  while (afterUndo > 0 && undos < 4) { await pg.keyboard.press('Control+z'); undos++; await pg.waitForTimeout(500); afterUndo = await pg.locator('.clip-card').count(); console.log('undo', undos, '-> cards', afterUndo); }
  const redos = undos;
  for (let i = 0; i < redos; i++) { await pg.keyboard.press('Control+Shift+z'); await pg.waitForTimeout(400); }
  console.log('clip cards after undo:', afterUndo);
  assert(afterUndo === 0, 'undo removes the inserted clips');
  assert((await pg.locator('.clip-card').count()) === clipsAfterInsert, 'redo restores them');
  if (process.env.SMOKE_SHOTS) await pg.screenshot({ path: SP + 's10b.png' });
  // JKL shuttle
  await pg.keyboard.press('l'); await pg.waitForTimeout(300);
  const r1 = await pg.locator('[data-testid=shuttle-readout]').innerText();
  await pg.keyboard.press('l'); await pg.waitForTimeout(200);
  const r2 = await pg.locator('[data-testid=shuttle-readout]').innerText();
  await pg.keyboard.press('k'); await pg.waitForTimeout(200);
  const r3 = await pg.locator('[data-testid=shuttle-readout]').innerText();
  await pg.keyboard.press('j'); await pg.waitForTimeout(200);
  const r4 = await pg.locator('[data-testid=shuttle-readout]').innerText();
  await pg.keyboard.press('k');
  console.log('shuttle:', r1, '|', r2, '|', r3, '|', r4);
  assert(/1x/.test(r1) && /2x/.test(r2) && r3 === 'JKL' && /◀ 1x/.test(r4), 'L, L, K, J drive the shuttle readout');
  // overwrite: playhead to 0, mark 1s..2s, overwrite -> 3 pieces on V1
  await pg.evaluate(() => document.querySelector('.clip-card')?.scrollIntoView());
  const notice = async () => (await pg.locator('[data-testid=stage1-notice]').first().innerText().catch(() => ''));
  // group the (linked) pair with Ctrl+G, then nest, then expand
  await pg.locator('.clip-card').first().click();
  await pg.waitForTimeout(300);
  await pg.keyboard.press('Control+g');
  await pg.waitForTimeout(400);
  console.log('notice after Ctrl+G:', await notice());
  assert(/Grouped/.test(await notice()), 'Ctrl+G groups the selected clips');
  await pg.locator('[data-testid=nest-btn]').click();
  await pg.waitForTimeout(600);
  const nested = await pg.locator('.clip-card').count();
  console.log('cards after nest:', nested, await notice());
  assert(nested === 1, 'Nest turns the selection into one compound clip');
  if (process.env.SMOKE_SHOTS) await pg.screenshot({ path: SP + 's10c.png' });
  // play it: the engine plays the flattened content
  await pg.evaluate(() => document.querySelector('.clip-card')?.click());
  await pg.keyboard.press('Space'); await pg.waitForTimeout(1200); await pg.keyboard.press('Space');
  await pg.locator('[data-testid=expand-btn]').click();
  await pg.waitForTimeout(600);
  const expanded = await pg.locator('.clip-card').count();
  console.log('cards after expand:', expanded, await notice());
  assert(expanded === 2, 'Expand restores the two clips');
  // speed ramp on the selected clip
  await pg.locator('.clip-card').first().click();
  await pg.selectOption('[data-testid=ramp-select]', 'slow-dip');
  await pg.waitForTimeout(600);
  const ramped = await pg.locator('.clip-card').count();
  console.log('cards after ramp:', ramped, await notice());
  assert(ramped > 2, 'Speed ramp cuts the clip into stepped pieces');
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(500);
  assert((await pg.locator('.clip-card').count()) === 2, 'undo of the ramp restores the clip');
  await pg.locator('[data-testid=overwrite-edit]').click();
  await pg.waitForTimeout(600);
  console.log('after overwrite:', await pg.locator('.clip-card').count(), await notice());
  assert(/Overwritten/.test(await notice()), 'Overwrite places the marked range at the playhead');
  if (process.env.SMOKE_SHOTS) await pg.screenshot({ path: SP + 's10d.png' });
  await b.close();
})();
