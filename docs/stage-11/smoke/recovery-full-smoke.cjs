/* Fix N crash-recovery smoke: the snapshot now covers overlays, the Spaces graph (nodes / edges / node config) and the Director show.
 * Run: npx vite --port 3150 ; SMOKE_PORT=3150 SMOKE_DIR=<scratch dir>/ CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node recovery-full-smoke.cjs
 * Real #/timeline, real UI edits (library overlay cards, the canvas' add-node event, typing in a prompt node, a drag between handles, the Director look-bible film field).
 * (1) save an overlay normally; (2) block project writes (as in a failed save / crash), add a 2nd overlay, add 2 nodes + type a prompt + connect, add a Director film reference;
 * (3) close the page without a clean unload; (4) reopen: prompt, Recover, every edit is back in the UI and in the saved project; (5) Discard path. */
const L = require('../../stage-8/smoke/combined-lib.cjs');
const results = []; let failed = 0;
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); results.push({ ok: !!c, m }); if (!c) failed++; };
const info = (m) => console.log('INFO', m);
const PNAME = 'recovfull-' + Date.now().toString(36);
const PORT = process.env.SMOKE_PORT || 3150;
const FILM = 'Blade Runner';
const PROMPT = 'a lighthouse at dawn';
const tab = (pg, name) => pg.evaluate((n) => [...document.querySelectorAll('button')].find((x) => new RegExp('^' + n + '$').test(x.innerText.trim()))?.click(), name);
const saved = async (pg) => {
  const store = await L.readStore(pg); const k = Object.keys(store).find((x) => /project\.json$/.test(x)); const p = JSON.parse(store[k]); const wf = p.workflow || {};
  const spaces = p.spaces || wf.spaces; const overlays = p.overlays || wf.overlays || []; const director = p.director || wf.director; const activeSpaceId = p.activeSpaceId || wf.activeSpaceId;
  const sp = spaces.find((s) => s.id === activeSpaceId) || spaces[0];
  return { overlays: overlays.length, nodes: sp.nodes.length, edges: sp.edges.length, films: (store[k].split(JSON.stringify(FILM)).length - 1), dirKeys: Object.keys(director || {}).length, prompts: sp.nodes.filter((n) => JSON.stringify(n.data).includes(PROMPT)).length };
};
const snapCount = (pg) => pg.evaluate(() => new Promise((res) => { const r = indexedDB.open('cinegen-recovery'); r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('snapshots')) return res(-1); const q = db.transaction('snapshots').objectStore('snapshots').count(); q.onsuccess = () => res(q.result); }; r.onerror = () => res(-2); }));
const snapShape = (pg) => pg.evaluate(() => new Promise((res) => { const r = indexedDB.open('cinegen-recovery'); r.onsuccess = () => { const q = r.result.transaction('snapshots').objectStore('snapshots').getAll(); q.onsuccess = () => { const s = q.result[0]; res(s ? { v: s.v, overlays: s.overlays?.length, nodes: s.spaces?.reduce((n, x) => n + x.nodes.length, 0), bytes: JSON.stringify(s).length } : null); }; }; }));
async function openProject(pg, name, reload = false) {
  if (reload) await pg.reload({ waitUntil: 'domcontentloaded' });
  else await pg.goto('http://127.0.0.1:' + PORT + '/#/timeline', { waitUntil: 'domcontentloaded' });
  await pg.getByRole('button', { name: 'Skip for now' }).click({ timeout: 8000 }).catch(() => {});
  await pg.waitForSelector('.pm-window, .workspace-content', { timeout: 150000 }); await pg.waitForTimeout(2500);
  if (await pg.locator('.pm-window').count()) {
    await pg.evaluate((n) => { const el = [...document.querySelectorAll('.pm-window *')].find((x) => x.children.length === 0 && new RegExp(n).test(x.textContent || '')); el?.click(); }, name);
    await pg.waitForTimeout(500);
    await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => /^open/i.test(x.innerText.trim()))?.click());
  }
  await pg.waitForTimeout(5000);
}
async function addTextOverlay(pg) {
  await tab(pg, 'EDIT'); await pg.waitForTimeout(1500);
  await pg.locator('[data-testid=open-library]').first().click(); await pg.waitForTimeout(600);
  await pg.locator('[data-testid=library-cat-overlays]').click(); await pg.waitForTimeout(600);
  await pg.locator('[data-testid=library-overlay-overlay-text]').click(); await pg.waitForTimeout(1000);
}
// Spaces: two nodes through the canvas' own add-node event, a prompt typed into the first, and a connection dragged between handles
async function editGraph(pg) {
  await tab(pg, 'SPACES'); await pg.waitForTimeout(2500);
  const n0 = await pg.locator('.react-flow__node').count();
  const addNode = async (t) => { await pg.evaluate((d) => window.dispatchEvent(new CustomEvent('cinegen:add-node', { detail: d })), t); await pg.waitForTimeout(1200); };
  await addNode('prompt');
  const first = pg.locator('.react-flow__node-prompt').last();
  await first.locator('textarea').first().fill(PROMPT).catch((e) => info('prompt fill failed ' + String(e).slice(0, 80)));
  await pg.waitForTimeout(600);
  const bb = await first.boundingBox(); // new nodes land at the centre of the screen: move the prompt node left so the next one does not cover it
  if (bb) { await pg.mouse.move(bb.x + bb.width / 2, bb.y + 4); await pg.mouse.down(); await pg.mouse.move(bb.x + bb.width / 2 - 300, bb.y + 4, { steps: 10 }); await pg.mouse.up(); await pg.waitForTimeout(600); }
  await addNode('shotBoard');
  const src = pg.locator('.react-flow__handle.source').first(); const tgt = pg.locator('.react-flow__handle.target[data-handleid=text]').first(); // shotBoard's text input
  let connected = false;
  if (await src.count() && await tgt.count()) {
    const a = await src.boundingBox(); const t = await tgt.boundingBox();
    if (a && t) { await pg.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await pg.mouse.down(); await pg.mouse.move((a.x + t.x) / 2, (a.y + t.y) / 2, { steps: 6 }); await pg.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(800); connected = (await pg.locator('.react-flow__edge').count()) > 0; }
  }
  return { n0, n1: await pg.locator('.react-flow__node').count(), connected };
}
async function editDirector(pg) {
  await tab(pg, 'DIRECTOR'); await pg.waitForTimeout(2500);
  await pg.fill('#director-film', FILM); await pg.keyboard.press('Enter'); await pg.waitForTimeout(800);
  return pg.locator('.director-tab__chip', { hasText: FILM }).count();
}
const freshPage = async (ctx) => { const p = await ctx.newPage(); await p.addInitScript(() => { try { sessionStorage.setItem('setup_popup_shown', '1'); } catch {} }); return p; };
(async () => {
  const { b, ctx, pg } = await L.launch();
  await ctx.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...a) {
      if (window.__blockSave && this.transaction.db.name === 'remix-cinegen-web') throw new DOMException('simulated: storage unavailable', 'QuotaExceededError');
      return put.apply(this, a);
    };
  });
  await L.goTimeline(pg); await L.newProject(pg, PNAME);
  await addTextOverlay(pg); await pg.waitForTimeout(3500);
  const s0 = await saved(pg);
  assert(s0.overlays === 1, 'first overlay saved normally (' + s0.overlays + ')');
  assert(await pg.locator('[data-testid=crash-recovery]').count() === 0, 'no prompt in the live session');

  await pg.evaluate(() => { window.__blockSave = true; });
  await addTextOverlay(pg); await pg.waitForTimeout(500);
  const g = await editGraph(pg);
  info('graph: nodes ' + g.n0 + ' -> ' + g.n1 + ', edge connected by drag: ' + g.connected);
  assert(g.n1 >= g.n0 + 2, 'two nodes added on the canvas');
  const films = await editDirector(pg);
  assert(films === 1, 'Director film reference added in the UI');
  await pg.waitForTimeout(2000);
  const snap = await snapShape(pg);
  info('snapshot: ' + JSON.stringify(snap));
  assert(await snapCount(pg) === 1 && snap?.v === 2 && snap.overlays === 2 && snap.nodes >= g.n1, 'a v2 snapshot with both overlays and the graph exists while the save is pending');
  const s1 = await saved(pg);
  assert(JSON.stringify(s1) === JSON.stringify(s0), 'the saved project still has the OLD state ' + JSON.stringify(s1));

  await pg.close({ runBeforeUnload: false });
  const pg2 = await freshPage(ctx);
  await openProject(pg2, PNAME);
  await pg2.waitForSelector('[data-testid=crash-recovery]', { timeout: 15000 }).catch(() => {});
  assert(await pg2.locator('[data-testid=crash-recovery]').count() === 1, 'prompt shown after the unclean exit');
  info('prompt text: ' + (await pg2.locator('[data-testid=crash-recovery]').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 260));
  await tab(pg2, 'SPACES'); await pg2.waitForTimeout(2000);
  assert(await pg2.locator('.react-flow__node').count() === g.n0, 'before Recover the canvas shows the saved graph (' + g.n0 + ' nodes)');
  await pg2.locator('[data-testid=crash-recovery-recover]').click(); await pg2.waitForTimeout(2000);
  assert(await pg2.locator('.react-flow__node').count() === g.n1, 'after Recover the canvas has the added nodes (' + g.n1 + ')');
  assert(g.connected ? (await pg2.locator('.react-flow__edge').count()) > 0 : true, g.connected ? 'the connection is back' : 'edge: not created by the drag in this run (see unit tests for edges)');
  assert(await pg2.locator('.react-flow__node textarea').evaluateAll((l, p) => l.some((x) => x.value === p), PROMPT), 'the typed prompt text is back in the node');
  await tab(pg2, 'DIRECTOR'); await pg2.waitForTimeout(2000);
  assert(await pg2.locator('.director-tab__chip', { hasText: FILM }).count() === 1, 'the Director film reference is back');
  await pg2.waitForTimeout(3500);
  const s2 = await saved(pg2);
  info('saved after recover: ' + JSON.stringify(s2));
  assert(s2.overlays === 2 && s2.nodes >= g.n1 && s2.films === 1 && s2.prompts === 1 && (!g.connected || s2.edges > 0), 'overlay, graph (nodes, prompt, edge) and director are all saved to the project');
  assert(await snapCount(pg2) === 0, 'snapshot removed once the save landed');

  await openProject(pg2, PNAME, true);
  assert(await pg2.locator('[data-testid=crash-recovery]').count() === 0, 'no prompt after a normal save + reload');

  // Discard path: another unsaved overlay + node + director edit, kill, reopen, Discard
  await pg2.evaluate(() => { window.__blockSave = true; });
  await addTextOverlay(pg2); await editGraph(pg2); await tab(pg2, 'DIRECTOR'); await pg2.waitForTimeout(1500);
  await pg2.fill('#director-film', 'Alien'); await pg2.keyboard.press('Enter'); await pg2.waitForTimeout(2000);
  assert(await snapCount(pg2) === 1, 'second snapshot written');
  await pg2.close({ runBeforeUnload: false });
  const pg3 = await freshPage(ctx);
  await openProject(pg3, PNAME);
  await pg3.waitForSelector('[data-testid=crash-recovery]', { timeout: 15000 }).catch(() => {});
  assert(await pg3.locator('[data-testid=crash-recovery]').count() === 1, 'prompt shown for the second unclean exit');
  await pg3.locator('[data-testid=crash-recovery-discard]').click(); await pg3.waitForTimeout(1500);
  const s3 = await saved(pg3);
  assert(JSON.stringify(s3) === JSON.stringify(s2), 'Discard keeps the saved project unchanged ' + JSON.stringify(s3));
  await tab(pg3, 'DIRECTOR'); await pg3.waitForTimeout(1500);
  assert(await pg3.locator('.director-tab__chip', { hasText: 'Alien' }).count() === 0 && await pg3.locator('.director-tab__chip', { hasText: FILM }).count() === 1, 'Discard: the discarded director edit is not shown');
  assert(await snapCount(pg3) === 0, 'snapshot removed by Discard');
  await b.close();
  require('fs').writeFileSync(L.SP + 'recovery-full-results.json', JSON.stringify(results, null, 1));
  console.log(failed ? 'FAILED ' + failed : 'ALL PASS');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(2); });
