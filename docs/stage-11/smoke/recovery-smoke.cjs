/* Stage 11 (port J) crash-recovery smoke. Real #/timeline, real imported mp4.
 * Run: npx vite --port 3150 ; SMOKE_PORT=3150 SMOKE_DIR=<dir with clipA.mp4>/ CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node recovery-smoke.cjs
 * Scenario: (1) place a clip, wait for a normal save; (2) make an edit (speed ramp) while the project save is blocked (the page cannot write the project
 * to IndexedDB, as in a crash / failed save; the save keeps failing), (3) kill the page WITHOUT a clean unload, (4) reopen: the prompt must appear, Recover must bring the edit
 * back and it must then be saved; (5) a reload after a normal save shows no prompt; (6) Discard path. */
const L = require('../../stage-8/smoke/combined-lib.cjs');
const results = []; let failed = 0;
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); results.push({ ok: !!c, m }); if (!c) failed++; };
const PNAME = 'recov-' + Date.now().toString(36);
const PORT = process.env.SMOKE_PORT || 3150;
const cards = (pg) => pg.locator('.clip-card').count();
const dismiss = async (pg) => { for (let i = 0; i < 4 && await pg.locator('.element-modal__backdrop').count(); i++) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); } };
const timelineClips = (store) => { const k = Object.keys(store).find((x) => /project\.json$/.test(x)); const p = JSON.parse(store[k]); const tl = p.timelines.find((t) => t.id === p.activeTimelineId) || p.timelines[0]; return tl.clips.length; };
async function openProject(pg, name, reload = false) {
  if (reload) await pg.reload({ waitUntil: 'domcontentloaded' });
  else await pg.goto('http://127.0.0.1:' + PORT + '/#/timeline', { waitUntil: 'domcontentloaded' });
  await pg.getByRole('button', { name: 'Skip for now' }).click({ timeout: 8000 }).catch(() => {});
  await pg.waitForSelector('.pm-window, .workspace-content', { timeout: 150000 }); await pg.waitForTimeout(2500);
  let hit = true;
  if (await pg.locator('.pm-window').count()) { // the project manager is showing: open the project (after a reload the app may open it by itself)
    hit = await pg.evaluate((n) => { const el = [...document.querySelectorAll('.pm-window *')].find((x) => x.children.length === 0 && new RegExp(n).test(x.textContent || '')); if (!el) return false; el.click(); return true; }, name);
    await pg.waitForTimeout(500);
    await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => /^open/i.test(x.innerText.trim()))?.click());
  }
  await pg.waitForTimeout(5000);
  return hit;
}
(async () => {
  const { b, ctx, pg } = await L.launch();
  // block project writes on demand (the web store keeps projects in IndexedDB db "remix-cinegen-web", store "kv")
  await ctx.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...a) {
      if (window.__blockSave && this.transaction.db.name === 'remix-cinegen-web') throw new DOMException('simulated: storage unavailable', 'QuotaExceededError'); // the project save fails, as in a crash / full disk
      return put.apply(this, a);
    };
  });
  await L.goTimeline(pg); await L.newProject(pg, PNAME);
  await L.clickBtn(pg, '^EDIT$'); await pg.waitForTimeout(3000);
  await L.addVideo(pg, L.SP + 'clipA.mp4');
  await pg.locator('[title="clipA.mp4"]').first().dblclick(); await pg.waitForTimeout(1500);
  await pg.locator('[data-testid=insert-edit]').click(); await pg.waitForTimeout(1500); await dismiss(pg);
  const n0 = await cards(pg);
  assert(n0 >= 1, 'clip placed (' + n0 + ' cards)');
  await pg.waitForTimeout(3000); // normal autosave
  const saved0 = timelineClips(await L.readStore(pg));
  assert(saved0 >= 1, 'normal save reached the store (' + saved0 + ' clips)');
  assert(await pg.locator('[data-testid=crash-recovery]').count() === 0, 'no prompt in the live session');

  // (2) edit with the save blocked
  await pg.evaluate(() => { window.__blockSave = true; });
  await pg.locator('.clip-card').filter({ hasNotText: '(audio)' }).first().click(); await pg.waitForTimeout(400);
  await pg.selectOption('[data-testid=ramp-select]', 'speed-up'); await pg.waitForTimeout(1200);
  const n1 = await cards(pg);
  assert(n1 > n0, 'edit applied in the editor: ' + n0 + ' -> ' + n1 + ' cards');
  await pg.waitForTimeout(1500); // snapshot (150 ms debounce) written; the save attempts keep failing/diverting
  const snapCount = await pg.evaluate(() => new Promise((res) => { const r = indexedDB.open('cinegen-recovery'); r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('snapshots')) return res(-1); const q = db.transaction('snapshots').objectStore('snapshots').count(); q.onsuccess = () => res(q.result); }; r.onerror = () => res(-2); }));
  assert(snapCount === 1, 'a recovery snapshot exists while the save is pending (' + snapCount + ')');
  const savedNow = timelineClips(await L.readStore(pg));
  assert(savedNow === saved0, 'the saved project still has the OLD state (' + savedNow + ' clips)');

  // (3) kill the page without unloading cleanly
  await pg.close({ runBeforeUnload: false });
  const pg2 = await ctx.newPage();
  await pg2.addInitScript(() => { try { sessionStorage.setItem('setup_popup_shown', '1'); } catch {} });
  const found = await openProject(pg2, PNAME);
  assert(found, 'project reopened');
  await pg2.waitForSelector('[data-testid=crash-recovery]', { timeout: 15000 }).catch(() => {});
  assert(await pg2.locator('[data-testid=crash-recovery]').count() === 1, 'prompt "Recover unsaved changes?" is shown after the unclean exit');
  const text = await pg2.locator('[data-testid=crash-recovery]').innerText().catch(() => '');
  console.log('INFO prompt text:', text.replace(/\s+/g, ' ').slice(0, 220));
  await pg2.evaluate(() => [...document.querySelectorAll('button')].find((x) => /^EDIT$/.test(x.innerText.trim()))?.click()); await pg2.waitForTimeout(2500);
  const before = await cards(pg2);
  assert(before === n0, 'before Recover the editor shows the saved state (' + before + ' cards)');
  await pg2.locator('[data-testid=crash-recovery-recover]').click(); await pg2.waitForTimeout(1500);
  const after = await cards(pg2);
  assert(after === n1, 'after Recover the ramp edit is back (' + after + ' cards, expected ' + n1 + ')');
  assert(await pg2.locator('[data-testid=crash-recovery]').count() === 0, 'prompt closed');
  await pg2.waitForTimeout(3500); // autosave of the recovered state
  const savedAfter = timelineClips(await L.readStore(pg2));
  assert(savedAfter > saved0, 'recovered state was saved to the project (' + savedAfter + ' clips)');
  const snapLeft = await pg2.evaluate(() => new Promise((res) => { const r = indexedDB.open('cinegen-recovery'); r.onsuccess = () => { const q = r.result.transaction('snapshots').objectStore('snapshots').count(); q.onsuccess = () => res(q.result); }; }));
  assert(snapLeft === 0, 'snapshot removed once the save landed (' + snapLeft + ')');

  // (5) reload after a normal save: no prompt
  await openProject(pg2, PNAME, true);
  assert(await pg2.locator('[data-testid=crash-recovery]').count() === 0, 'no prompt after a normal save + reload');

  // (6) Discard path: another unsaved edit, kill, reopen, Discard
  await pg2.evaluate(() => [...document.querySelectorAll('button')].find((x) => /^EDIT$/.test(x.innerText.trim()))?.click()); await pg2.waitForTimeout(2500);
  const m0 = await cards(pg2);
  await pg2.evaluate(() => { window.__blockSave = true; });
  await pg2.locator('.clip-card').filter({ hasNotText: '(audio)' }).first().click(); await pg2.waitForTimeout(400);
  await pg2.keyboard.press('Delete'); await pg2.waitForTimeout(1500);
  const m1 = await cards(pg2);
  assert(m1 < m0, 'delete applied (' + m0 + ' -> ' + m1 + ')');
  await pg2.close({ runBeforeUnload: false });
  const pg3 = await ctx.newPage(); await pg3.addInitScript(() => { try { sessionStorage.setItem('setup_popup_shown', '1'); } catch {} });
  await openProject(pg3, PNAME);
  await pg3.waitForSelector('[data-testid=crash-recovery]', { timeout: 15000 }).catch(() => {});
  assert(await pg3.locator('[data-testid=crash-recovery]').count() === 1, 'prompt shown again for the second unclean exit');
  await pg3.locator('[data-testid=crash-recovery-discard]').click(); await pg3.waitForTimeout(800);
  await pg3.evaluate(() => [...document.querySelectorAll('button')].find((x) => /^EDIT$/.test(x.innerText.trim()))?.click()); await pg3.waitForTimeout(2000);
  assert(await cards(pg3) === m0, 'Discard keeps the saved project (' + await cards(pg3) + ' cards)');
  await b.close();
  require('fs').writeFileSync(L.SP + 'recovery-results.json', JSON.stringify(results, null, 1));
  console.log(failed ? 'FAILED ' + failed : 'ALL PASS');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(2); });
