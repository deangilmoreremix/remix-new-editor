// Stage 8: the classic editor (#/timeline-classic), its Recorder modal, and the CineGen voice-over recorder entry still open with no page errors.
//   SMOKE_PORT=3100 CHROMIUM_PATH=... node docs/stage-8/smoke/routes-smoke.cjs      (dev server running)
const L = require('./combined-lib.cjs');
let failed = 0; const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) failed++; };
const benign = /Supabase|Clerk|MUAPI|favicon|Failed to load resource|net::ERR|Retrying failed fetch|Download the React DevTools|NotAllowed|getUserMedia|Permission/i;
(async () => {
  let { b, pg, cons } = await L.launch();
  await pg.goto('http://127.0.0.1:' + (process.env.SMOKE_PORT || 3100) + '/#/timeline-classic', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(12000);
  const body = await pg.evaluate(() => document.body.innerText.length);
  const chips = await pg.getByText('Recorder', { exact: true }).count();
  assert(body > 200 && chips > 0, 'classic editor opens (body text ' + body + ' chars, Recorder chip present: ' + chips + ')');
  if (chips) {
    await pg.getByText('Recorder', { exact: true }).first().click(); await pg.waitForTimeout(3000);
    const modal = await pg.evaluate(() => !!document.querySelector('[class*=modal], dialog, [role=dialog]') && /record|screen|webcam/i.test(document.body.innerText));
    assert(modal, 'classic editor Recorder modal opens');
  }
  const errs = cons.filter((m) => !benign.test(m));
  assert(errs.length === 0, 'classic editor: no console/page errors ' + JSON.stringify(errs.slice(0, 3)));
  const before = cons.length;
  const pg2 = await (await pg.context().newPage()); pg2.on('console', (m) => { if (m.type() === 'error') cons.push(m.text().slice(0, 240)); }); pg2.on('pageerror', (e) => cons.push('PAGEERR ' + String(e).slice(0, 300)));
  await pg2.addInitScript(() => { try { sessionStorage.setItem('setup_popup_shown', '1'); } catch {} });
  const pgc = pg; pg = pg2; await pgc.close();
  await L.goTimeline(pg, 'timeline'); await L.newProject(pg, 'routes'); await L.clickBtn(pg, '^EDIT$'); await pg.waitForTimeout(3000);
  const rec = await pg.evaluate(() => [...document.querySelectorAll('button')].some((x) => /voice|record|mic/i.test((x.title || '') + (x.getAttribute('aria-label') || '') + x.innerText)));
  assert(rec, 'CineGen edit tab has its recorder / voice-over control');
  const errs2 = cons.slice(before).filter((m) => !benign.test(m));
  assert(errs2.length === 0, 'CineGen edit tab: no console/page errors ' + JSON.stringify(errs2.slice(0, 3)));
  await b.close(); process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('ERR', e); process.exit(2); });
