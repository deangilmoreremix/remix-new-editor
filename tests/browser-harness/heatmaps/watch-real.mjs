// Stage 7 end-to-end check on the REAL watch page (src/pages/WatchPage.jsx via the vite dev server), not a synthetic page.
// Only the network layer is mocked (Playwright route interception):
//   - Supabase RPC get_published_video  -> a fixture project (a real 10 s webm, a link CTA, a tel: CTA)
//   - /api/video-events                 -> recorded (and answered 200); the recorded batches are then pushed through the REAL
//                                          netlify/functions/video-events.js handler into a local Postgres 16 (mkdb.sh) and the owner RPCs are read back.
// Local only, not CI. Needs: vite dev server on $VITE_PORT started with VITE_SUPABASE_URL=https://supa.test VITE_SUPABASE_ANON_KEY=x,
// Chromium ($CHROME), ffmpeg-made $MEDIA/clip.webm, a running Postgres cluster (root can `su postgres`), database created by mkdb.sh <DB>.
//   node watch-real.mjs
import { createRequire } from 'node:module';
import { spawnSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(`${ROOT}/package.json`);
const { chromium } = require('playwright');
const PORT = process.env.VITE_PORT || '3140';
const APP = `http://127.0.0.1:${PORT}`;
const SUPA = 'https://supa.test';
const MEDIA = process.env.MEDIA || '/tmp/watchreal';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const DB = process.env.DB || 'heatreal';
const VID = 'abcdefgh12';
const OUT = process.env.OUT || '/tmp/watchreal';
const MEDIA_BUF = fs.readFileSync(`${MEDIA}/clip.webm`);
const { handle } = await import(`${ROOT}/netlify/functions/video-events.js`);

const results = { passed: [], failed: [] };
const check = (label, cond, extra = '') => { (cond ? results.passed : results.failed).push(label); console.log(cond ? 'PASS' : 'FAIL', label, extra); };

// ---- local Postgres helpers
let qn = 0;
fs.mkdirSync(`${OUT}/q`, { recursive: true });
fs.chmodSync(OUT, 0o755); fs.chmodSync(`${OUT}/q`, 0o777);
const sql = (q, role) => {
  const f = `${OUT}/q/q${qn++}.sql`;
  fs.writeFileSync(f, `${role ? `set role ${role.r}; set request.jwt.claims = '${JSON.stringify(role.c || {})}';` : ''}\n${q}`);
  fs.chmodSync(f, 0o644);
  const r = spawnSync('runuser', ['-u', 'postgres', '--', 'psql', '-d', DB, '-At', '-q', '-v', 'ON_ERROR_STOP=1', '-f', f], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};
execSync(`bash ${ROOT}/tests/browser-harness/heatmaps/mkdb.sh ${DB}`, { stdio: 'ignore' });

// ---- fixture: a published video (12 s timeline; one real 10 s webm; a link CTA; a click-to-call CTA)
const T = 10;
const pct = (s) => (s / T) * 100;
const clip = (a, b, extra) => ({ left: pct(a), width: pct(b - a), ...extra });
const project = {
  version: 1, title: 'Promo', timelineSeconds: T,
  tracks: [
    { id: 'v', type: 'video', items: [clip(0, T, { id: 'vid', type: 'video', src: 'https://media.test/clip.webm' })] },
    { id: 't', type: 'text', items: [
      clip(0, T, { id: 'cta1', type: 'click-to-call', linkUrl: 'https://example.com/book', buttonText: 'Book a call', style: { posLeft: 30, posTop: 50, posWidth: 25 } }),
      clip(0, T, { id: 'cta2', type: 'click-to-call', phoneNumber: '+1 555 123 4567', buttonText: 'Call now', style: { posLeft: 70, posTop: 50, posWidth: 25 } }),
    ] },
  ],
  listBuilder: null,
};
sql(`insert into published_videos(id,title,project,clerk_user_id) values ('${VID}','Promo','${JSON.stringify(project)}','userA');`);
const fixture = { id: VID, title: 'Promo', privacy: 'public', project };

// fetchImpl for the real handler: PostgREST rpc -> real Postgres (service role)
const lit = (v) => (v == null ? 'null' : `$v$${v}$v$`);
const jlit = (v) => `$j$${JSON.stringify(v)}$j$::jsonb`;
const fetchImpl = async (url, init) => {
  const name = url.split('/rpc/')[1];
  if (name === 'rate_limit_check') return { ok: true, json: async () => ({ allowed: true }) };
  const a = JSON.parse(init.body);
  const q = name === 'ingest_video_events'
    ? `select public.ingest_video_events(${lit(a.p_video_id)},${lit(a.p_session_key)},${lit(a.p_viewer_hash)},${lit(a.p_contact_id)},${lit(a.p_device)},${lit(a.p_referrer)},${jlit(a.p_events)});`
    : `select public.ingest_video_heat_events(${lit(a.p_video_id)},${lit(a.p_session_key)},${jlit(a.p_events)});`;
  const out = sql(q, { r: 'service_role' });
  return { ok: true, json: async () => JSON.parse(out.split('\n').pop()) };
};

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });

async function viewer({ query = '', dnt = false, gpc = false, w = 900, h = 500, actions = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  if (dnt) await ctx.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { value: '1' }));
  if (gpc) await ctx.addInitScript(() => Object.defineProperty(navigator, 'globalPrivacyControl', { value: true }));
  // Headless Chromium has no handler for tel: and a click on such a link leaves the page unresponsive to later input; let the page's own
  // listeners run (they are registered earlier / in the capture phase) and then cancel the navigation, as a desktop browser without a phone app would.
  await ctx.addInitScript(() => window.addEventListener('click', (e) => { if (e.target?.closest?.('a[href^="tel:"]')) e.preventDefault(); }));
  // Records whether the preview engine ever showed its "play pending" state (a Play queued before the Remotion player bound).
  await ctx.addInitScript(() => {
    window.__pendingSeen = false;
    new MutationObserver(() => { if (document.querySelector('[data-play-pending]')) window.__pendingSeen = true; })
      .observe(document, { subtree: true, attributes: true, attributeFilter: ['data-play-pending'], childList: true });
  });
  const page = await ctx.newPage();
  const posts = [];
  const rpcCalls = [];
  await page.route(`${SUPA}/**`, async (route) => {
    rpcCalls.push(route.request().url());
    const hdr = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: hdr });
    if (route.request().url().includes('/rpc/get_published_video')) return route.fulfill({ status: 200, headers: hdr, contentType: 'application/json', body: JSON.stringify(fixture) });
    return route.fulfill({ status: 200, headers: hdr, contentType: 'application/json', body: '[]' });
  });
  // the preview engine needs byte-range support to decode the media (without it the clock never advances)
  await page.route('https://media.test/**', (route) => {
    const base = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': '*', 'accept-ranges': 'bytes' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: base });
    const range = route.request().headers().range;
    if (range) {
      const m = /bytes=(\d+)-(\d*)/.exec(range); const a = +m[1]; const e = m[2] ? +m[2] : MEDIA_BUF.length - 1;
      return route.fulfill({ status: 206, headers: { ...base, 'content-range': `bytes ${a}-${e}/${MEDIA_BUF.length}` }, contentType: 'video/webm', body: MEDIA_BUF.subarray(a, e + 1) });
    }
    return route.fulfill({ status: 200, headers: { ...base, 'content-length': String(MEDIA_BUF.length) }, contentType: 'video/webm', body: MEDIA_BUF });
  });
  await page.route('https://example.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>external</p>' }));
  // context-level route: the final flush is a sendBeacon issued while the page is unloading, which a page-level route can miss
  await ctx.route(`${APP}/api/video-events`, async (route) => {
    posts.push(JSON.parse(route.request().postData()));
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${APP}/watch/${VID}${query}`);
  await page.waitForSelector('[data-bigplay]', { timeout: 30000 });
  return { ctx, page, posts, rpcCalls, errors };
}

// The page is hidden the way a browser does when a tab is backgrounded/closed: visibilitychange(hidden) -> analyticsClient's final flush (sendBeacon).
// (A beacon sent during a real unload is not observable through Playwright routing, so the unload itself is not asserted here.)
const hide = async (page) => { await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); await page.waitForTimeout(1500); };
const waitTime = (page, sec) => page.waitForFunction((n) => { const [m, x] = document.querySelector('[data-time]').textContent.split(':').map(Number); return m * 60 + x >= n; }, sec, { timeout: 30000, polling: 200 }); // clock-driven, not sleep-driven (the machine may be slow)
const rectOf = (page) => page.evaluate(() => { const r = document.querySelector('#app').getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height, scrollH: document.documentElement.scrollHeight, vh: innerHeight }; });
const flat = (posts) => posts.flatMap((p) => p.events.map((e) => ({ ...e, _s: p.session, _p: p })));

// ---------- consenting viewers (5 + 1 essential-consent) -> real WatchPage, real player, real mouse
const allPosts = [];
let first = null;
for (let i = 0; i < 6; i += 1) {
  // Safety net: if the software-rendered player (SwiftShader + WebCodecs) on a loaded machine still never starts its clock, the run is discarded and redone in a fresh context.
  for (let attempt = 0; ; attempt += 1) {
    let cur = null;
    try {
      const v = await viewer({ query: i === 5 ? '?consent=essential' : '' });
      cur = v;
      const { ctx, page, posts, rpcCalls, errors } = v;
      await page.waitForSelector('a.wf-cta', { timeout: 20000 });
      const before = await rectOf(page);
      const cta1 = await page.locator('a.wf-cta[href^="https://example.com"]').first();
      const cta2 = await page.locator('a.wf-cta[href^="tel:"]').first();
      const b1 = await cta1.boundingBox();
      const b2 = await cta2.boundingBox();
      // Wait for the preview engine before pressing play: a play() issued before the Remotion player ref is bound is silently lost
      // (UI shows "Pause", clock stays 0:00). Pre-existing, outside Stage 7; a person never clicks that fast, a script does.
      await page.waitForSelector('[data-stage] .__remotion-player', { timeout: 30000 });
      await page.waitForTimeout(3000);
      await page.click('[data-bigplay]');
      await waitTime(page, 1);
      if (i === 0) console.log('player clock reached', await page.textContent('[data-time]'), 'play btn:', await page.getAttribute('[data-play]', 'aria-label'));
      // click the link CTA (opens in a new tab: handle popup), the tel CTA, an empty spot on the picture, and a duplicate click in the same 1% cell
      const popup = ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null);
      await page.mouse.click(b1.x + b1.width / 2, b1.y + b1.height / 2);
      (await popup)?.close();
      await page.bringToFront(); // a real user returns to the tab after closing the link's new tab
      await page.waitForTimeout(500);
      await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);
      await page.waitForTimeout(500);
      await waitTime(page, 4);                // keep playing
      // scroll to the bottom (real scroll events). A synthetic wheel is not used: after the link/tel CTA clicks headless Chromium stops honouring wheel input on this page
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForFunction(() => window.scrollY > 0, null, { timeout: 30000 }); // the wheel is processed late on a loaded machine
      const scrollY = await page.evaluate(() => window.scrollY);
      // a click on the picture itself toggles playback (player behaviour): the double click = pause + resume; both clicks fall in the same 1% cell within 400 ms -> recorded once
      const stage = await page.locator('[data-stage]').boundingBox();
      const px = Math.max(stage.x, 0) + 20, py = Math.max(stage.y, 0) + 20;
      await page.mouse.dblclick(px, py);       // two click events in the same 1% cell
      await waitTime(page, 6);                // playing again
      await page.click('[data-play]');        // pause -> closes the watch run
      await page.waitForTimeout(800);
      const after = await rectOf(page);
      if (i === 0) {
        first = { before, after, b1, b2, px, py, stage, scrollY };
        await page.screenshot({ path: `${OUT}/watch-real-session0.png` });
      }
      await hide(page);                        // final flush (beacon)
      allPosts.push({ i, posts, rpcCalls, errors });
      await ctx.close();
      break;
    } catch (e) {
      await cur?.ctx.close().catch(() => {});
      if (attempt >= 4) throw e;
      console.log(`session ${i}: player stalled, retrying (attempt ${attempt + 1})`, String(e).split('\n')[0].slice(0, 90));
    }
  }
}

// ---------- Stage 10 (Fix F): Play pressed IMMEDIATELY after load, before the Remotion player is bound (was silently lost).
// Three ways to press it: the big-play overlay, the control-bar button, the keyboard (Space on the page). Nothing waits for the player.
// Each run must (a) have really pressed before the player existed (asserted via the stage having no .__remotion-player at click time),
// (b) show a pending state meanwhile, (c) start playback by itself once the player binds (clock advances), (d) not double-fire
// (control-bar label still "Pause", exactly one play-through bucket range starting at 0), (e) send watch_buckets.
const earlyResults = [];
const earlyOk = (r) => r.clockOk && r.labelAtPress === 'Pause' && r.pendingSeen && r.pendingCleared && r.ranges.length === 1 && r.ranges[0][0] <= 1 && r.ranges[0][1] >= 1 && r.types.includes('watch_buckets');
for (const mode of ['bigplay', 'playbtn', 'keyboard']) {
  let r = null;
  // Retried only for a stalled software-rendered player (clock never starts on a loaded machine, same safety net as above) or a flush
  // that did not arrive in time; every attempt still presses BEFORE the player exists, so a lost press fails every attempt.
  for (let attempt = 1; attempt <= 4 && !(r && earlyOk(r)); attempt += 1) {
    const v = await viewer();
    const { ctx, page, posts } = v;
    const unbound = await page.evaluate(() => !document.querySelector('[data-stage] .__remotion-player'));
    if (!unbound) { await ctx.close(); continue; }          // machine too fast this time: the player was already bound, retry
    if (mode === 'bigplay') await page.click('[data-bigplay]');
    else if (mode === 'playbtn') await page.click('[data-play]');
    else { await page.focus('[data-seek]'); await page.keyboard.press('Space'); }
    const labelAtPress = await page.getAttribute('[data-play]', 'aria-label');
    const pendingSeen = await page.evaluate(() => window.__pendingSeen);
    let clockOk = true;
    try { await waitTime(page, 2); } catch { clockOk = false; }
    const label = await page.getAttribute('[data-play]', 'aria-label').catch(() => null);
    const pendingCleared = await page.evaluate(() => !document.querySelector('[data-play-pending]')).catch(() => false);
    if (clockOk) await page.click('[data-play]');            // pause: closes the play-through so the range is flushed
    for (let w = 0; w < 30 && !flat(posts).some((e) => e.type === 'watch_buckets'); w += 1) await page.waitForTimeout(500); // regular batch flush on a slow machine
    await hide(page);
    const ev = flat(posts);
    const ranges = ev.filter((e) => e.type === 'watch_buckets').flatMap((e) => e.props.r);
    r = { mode, attempt, unbound, labelAtPress, pendingSeen, clockOk, label, pendingCleared, ranges, types: [...new Set(ev.map((e) => e.type))] };
    await ctx.close();
  }
  earlyResults.push(r || { mode, attempt: 0 });
}
for (const mode of ['bigplay', 'playbtn', 'keyboard']) {
  const r = earlyResults.find((x) => x.mode === mode);
  check(`early Play (${mode}) pressed before the player existed: not lost, clock advances, no double fire, pending state shown then cleared, watch_buckets sent`,
    !!r && r.attempt > 0 && earlyOk(r), JSON.stringify(r));
}

// ---- assertions on what the real page sent
const s0 = flat(allPosts[0].posts);
const types0 = {}; s0.forEach((e) => { types0[e.type] = (types0[e.type] || 0) + 1; });
console.log('session0 event types', JSON.stringify(types0), 'batches', allPosts[0].posts.length);
check('real page: video fetched through the mocked Supabase RPC, no page errors', allPosts[0].rpcCalls.some((u) => u.includes('get_published_video')) && allPosts[0].errors.length === 0, allPosts[0].errors.join('|'));
const clicks0 = s0.filter((e) => e.type === 'heat_click');
check('clicks: 5 recorded for 6 real clicks (big play button, link CTA, tel CTA, picture double click counted once, pause button)', clicks0.length === 5, JSON.stringify(clicks0.map((c) => c.props)));
const linkClick = clicks0.find((c) => c.props.cta === 'cta1');
const telClick = clicks0.find((c) => c.props.cta === 'cta2');
check('click on link CTA: id, kind book_call (from the owner label wording), owner label, tablet viewport class (900 px wide)', !!linkClick && linkClick.props.kind === 'book_call' && linkClick.props.label === 'Book a call' && linkClick.props.vp === 'tablet', JSON.stringify(linkClick?.props));
check('click on tel: CTA: id, kind call_now, label', !!telClick && telClick.props.kind === 'call_now' && telClick.props.label === 'Call now', JSON.stringify(telClick?.props));
if (linkClick && first) {
  const exp = { x: (first.b1.x + first.b1.width / 2 - first.before.left) / first.before.width, y: (first.b1.y + first.b1.height / 2 - first.before.top) / first.before.height };
  check('click coordinates are the real click point normalized to the page container (+-0.005)', Math.abs(linkClick.props.x - exp.x) < 0.005 && Math.abs(linkClick.props.y - exp.y) < 0.005, `got ${linkClick.props.x},${linkClick.props.y} expected ${exp.x.toFixed(4)},${exp.y.toFixed(4)}`);
}
const plain = clicks0.filter((c) => !c.props.cta).pop();
check('plain click has no cta/kind/label', !!plain && plain.props.cta === undefined && plain.props.kind === undefined);
check('existing cta_click / call_click events still sent for the same clicks', s0.filter((e) => e.type === 'cta_click').length >= 1 && s0.filter((e) => e.type === 'call_click').length >= 1, JSON.stringify(types0));
const imp = s0.filter((e) => e.type === 'cta_impression');
check('cta impressions: once each for the two CTAs', imp.length === 2 && new Set(imp.map((e) => e.props.cta)).size === 2, JSON.stringify(imp.map((e) => e.props)));
const scEv = s0.filter((e) => e.type === 'scroll_depth');
const sc = scEv.map((e) => e.props.v);
const lastClickSeq = Math.max(...clicks0.map((e) => e.seq));
const ev100 = scEv.find((e) => e.props.v === 100);
check('scroll milestones: 25/50/75/100 once each; the page really scrolls (taller than the viewport) and 100 is sent only after scrolling to the bottom (after the CTA clicks)', JSON.stringify([...sc].sort((a, b) => a - b)) === '[25,50,75,100]' && first.after.scrollH > first.after.vh && ev100.seq > Math.max(...clicks0.filter((c) => c.props.cta).map((e) => e.seq)) && scEv.filter((e) => e.props.v === 25)[0].seq < Math.min(...clicks0.map((e) => e.seq)), JSON.stringify(scEv.map((e) => [e.props.v, e.seq])) + ` pageH=${first.after.scrollH} vh=${first.after.vh} scrollY=${first.scrollY} lastClickSeq=${lastClickSeq}`);
const wb = s0.filter((e) => e.type === 'watch_buckets').flatMap((e) => e.props.r);
const wbSecs = wb.reduce((n, [a, b]) => n + (b - a + 1), 0);
check('watch buckets: ranges (not per-tick), covering roughly the 5-6 s actually played', wb.length >= 1 && wb.length <= 4 && wbSecs >= 3 && wbSecs <= 9 && wb[0][0] <= 1, JSON.stringify(wb));
check('every event carries a per-session monotonically increasing seq (idempotency key)', (() => { const q = s0.map((e) => e.seq).filter((n) => n != null); return q.length === s0.length && q.every((n, k) => k === 0 || n > q[k - 1]); })(), JSON.stringify(s0.map((e) => e.seq)));
check('no element text / selector / pointer trace in any request body', !JSON.stringify(allPosts.flatMap((x) => x.posts)).includes('+1 555') && !/selector|innerText|mousemove/i.test(JSON.stringify(allPosts[0].posts)));
const ess = flat(allPosts[5].posts);
check('?consent=essential still captures heat events, but with no viewer id', ess.some((e) => e.type === 'heat_click') && allPosts[5].posts.every((p) => !p.viewer), JSON.stringify(allPosts[5].posts.map((p) => Object.keys(p))));

// ---- consent: nothing sent
for (const [label, opt] of [['Do-Not-Track', { dnt: true }], ['Global Privacy Control', { gpc: true }], ['?consent=0', { query: '?consent=0' }], ['?consent=off', { query: '?consent=off' }]]) {
  const { ctx, page, posts } = await viewer(opt);
  const b = await page.locator('a.wf-cta').first().boundingBox().catch(() => null);
  await page.click('[data-bigplay]');
  await page.waitForTimeout(800);
  if (b) await page.mouse.click(b.x + 5, b.y + 5);
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(2800);
  await hide(page);
  check(`${label}: zero requests to /api/video-events (no clicks, impressions, scroll or watch data)`, posts.length === 0, `posts=${posts.length}`);
  await ctx.close();
}

// ---- push the batches the page really sent through the real handler into real Postgres
let handled = 0, notOk = 0;
for (const { posts } of allPosts) {
  for (const p of posts) {
    const res = await handle(p, { fetchImpl, env: { SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'k' }, ip: '1.1.1.1', ua: 'Mozilla/5.0' });
    handled += 1; if (res.statusCode !== 200) { notOk += 1; console.log('handler', res.statusCode, res.body); }
  }
}
check(`real handler accepted every batch (${handled})`, notOk === 0 && handled > 0);

const own = { r: 'authenticated', c: { sub: 'userA' } };
const J = (f, extra = '') => JSON.parse(sql(`select public.${f}('${VID}', current_date - 1, current_date + 1${extra});`, own));
const rpcs = { clicks: J('video_heat_clicks'), cta: J('video_heat_cta_stats'), scroll: J('video_heat_scroll'), eng: J('video_heat_engagement') };
console.log(JSON.stringify(rpcs).slice(0, 1500));
const sent = flat(allPosts.flatMap((x) => x.posts)).filter((e) => e.type === 'heat_click').length;
check('db: 6 sessions pass the cohort threshold; stored clicks equal clicks sent by the pages', rpcs.clicks.suppressed === false && rpcs.clicks.clicks === sent && sent === 30, `db=${rpcs.clicks.clicks} sent=${sent}`);
const ctas = Object.fromEntries((rpcs.cta.ctas || []).map((c) => [c.cta_key, c]));
check('db: impressions 6 per CTA', ctas.cta1?.impressions === 6 && ctas.cta2?.impressions === 6, JSON.stringify(rpcs.cta.ctas));
check('db: heat clicks per CTA = 6 each with kinds', ctas.cta1?.clicks === 6 && ctas.cta2?.clicks === 6 && ctas.cta1?.kind === 'book_call' && ctas.cta2?.kind === 'call_now' && ctas.cta1?.ctr === 1, JSON.stringify(ctas));
check('db: scroll depth 100 reached by all 6 sessions', rpcs.scroll.reached && rpcs.scroll.reached['100'] === 6, JSON.stringify(rpcs.scroll));
const eng = rpcs.eng.seconds || {};
check('db: per-second viewers: seconds 0..3 watched by all 6', eng.viewers && [0, 1, 2, 3].every((s) => eng.viewers[s] === 6), JSON.stringify(eng.viewers));
check('db: no replays (single play-through) and no second beyond the video', eng.replays && eng.replays.every((n) => n === 0) && (eng.viewers.length <= T + 1), JSON.stringify(eng.replays));
const sentSessions = new Set(allPosts.flatMap((x) => x.posts.map((p) => p.session))).size;
check('db: the existing analytics rows were written too (one session row per session the pages sent)', Number(sql(`select count(*) from video_view_sessions where video_id='${VID}';`)) === sentSessions && sentSessions === 6, `sentSessions=${sentSessions}`);

await browser.close();
console.log(`\nSUMMARY passed=${results.passed.length} failed=${results.failed.length}`);
if (results.failed.length) { console.log(results.failed); process.exit(1); }
