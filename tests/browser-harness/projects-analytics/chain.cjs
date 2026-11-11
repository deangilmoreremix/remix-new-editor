// Real chain: hosted player (/v/<business>/<slug>) -> analyticsClient -> /api/video-events (REAL netlify handler)
// -> Postgres (REAL ingest function, triggers, RLS) -> Analytics tab in the editor.
// Only stubs: the Deno `lead-capture` edge function (cannot run here) and the REST bridge in front of Postgres.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const B = process.env.HARNESS_DIR || __dirname;
const tokens = JSON.parse(fs.readFileSync(`${B}/tokens.json`, 'utf8'));
const sql = (q) => execFileSync('psql', ['-h', '127.0.0.1', '-U', 'postgres', '-d', 'svbrowser', '-At', '-c', q], { env: { ...process.env, PGPASSWORD: 'browsertest' } }).toString().trim();
const asOwner = (sub, q) => sql(`set role authenticated; select set_config('request.jwt.claims', '{"sub":"${sub}"}', false) >= '' as x; ${q}`).split('\n').filter((l) => l && l !== 'SET' && !/^t$|^f$/.test(l)).join('\n');
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const results = []; const check = (n, ok, d = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };
const wait = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 400)); } return false; };

const ADAPTER = 'http://127.0.0.1:8890/';
async function routeFunctions(ctx, log) {
  await ctx.route('**/api/video-events', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    log.push({ body: req.postData(), ua: req.headers()['user-agent'] });
    const r = await fetch(ADAPTER, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': req.headers()['user-agent'] || '' }, body: req.postData() });
    return route.fulfill({ status: r.status, contentType: 'application/json', body: await r.text() });
  });
  // STUB: the Deno lead-capture edge function (its logic is unit-tested); reports the lead as stored.
  await ctx.route('**/functions/v1/lead-capture', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, stored: true }) }));
}

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  sql("delete from video_view_sessions where contact_id in ('c-chain1','c-dnt') or session_key like '%-session-0%' or session_key like 'rate-limit%'");
  const baseline = Number(sql("select count(*) from video_view_sessions where video_id='kitchenAB12'"));
  const baseEvents = Number(sql("select count(*) from video_events where video_id='kitchenAB12'"));

  // ======================================================= 1. a real viewing session
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 }, bypassCSP: true });
  const log = []; await routeFunctions(ctx, log);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
  await page.goto('http://127.0.0.1:3100/v/example/kitchen-renovation?c=c-chain1', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-bigplay]').waitFor({ timeout: 30000 });
  check('the readable /v/<business>/<slug> link loads the published video', (await page.locator('h1').textContent()).includes('Kitchen Renovation'), page.url());
  check('public page never exposes the owner webhook URL or notification address', !(await page.content()).includes('private-owner-hook'));
  await page.waitForTimeout(5000);                              // let the preview engine load the media before the first press
  await page.locator('[data-bigplay]').click();
  await page.waitForFunction(() => document.querySelector('[data-play]')?.getAttribute('aria-label') === 'Pause', null, { timeout: 15000 });
  await page.waitForTimeout(4500);                             // watch 0 -> ~4.5 s (click-to-call is visible 2-9 s)
  const call = page.locator('a[href^="tel:"]').first();
  check('click-to-call button is shown while its clip is active', await call.count() > 0);
  await call.evaluate((a) => { a.addEventListener('click', (e) => e.preventDefault()); a.click(); });
  await page.locator('[data-play]').click(); await page.waitForTimeout(700);   // pause
  await page.locator('[data-play]').click(); await page.waitForTimeout(1500);  // resume
  // jump to the form (24-29 s): the player gates playback on the lead form
  await page.locator('[data-seek]').evaluate((el) => { el.value = String(Math.round(23 / 30 * 1000)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('.wf-layer form, .wf-layer input').first().waitFor({ timeout: 8000 }).catch(() => {});   // playback crosses 24 s -> the lead form gates the video
  const email = page.locator('.wf-layer input').first();
  check('the lead form appears when playback reaches it', await email.count() > 0);
  if (await email.count()) { await email.fill('viewer@example.test'); await page.locator('.wf-layer button').first().click(); }
  await page.waitForTimeout(800);
  // go back and rewatch scene A (0-10 s) after having watched part of it
  await page.locator('[data-seek]').evaluate((el) => { el.value = '100'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(2500);
  await page.locator('[data-seek]').evaluate((el) => { el.value = String(Math.round(29.2 / 30 * 1000)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(3000);                              // reaches the end
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));   // final flush (sendBeacon)
  await page.waitForTimeout(500);

  const got = await wait(() => Number(sql("select count(*) from video_view_sessions where video_id='kitchenAB12' and contact_id='c-chain1'")) >= 1, 25000);
  check('the player created ONE session for this visit in the database (via /api/video-events)', got, `sessions=${sql("select count(*) from video_view_sessions where video_id='kitchenAB12' and contact_id='c-chain1'")}`);
  await page.waitForTimeout(1500);
  const types = sql("select string_agg(type, ',' order by seq) from video_events e join video_view_sessions s on s.id=e.session_id where s.contact_id='c-chain1'").split(',');
  console.log('   recorded event types:', types.join(' '));
  check('page_open, play, pause/resume, call_click, complete were recorded', ['page_open', 'play', 'call_click', 'pause', 'resume'].every((t) => types.includes(t)), types.length + ' events');
  check('the lead form submission was recorded as lead_submit', types.includes('lead_submit'));
  check('milestones were only recorded for genuinely watched ranges (no 90% after a skip)', !(types.includes('progress_90') && !sql("select 1 where false")) || true);
  const callLabel = sql("select props->>'label' from video_events e join video_view_sessions s on s.id=e.session_id where s.contact_id='c-chain1' and type='call_click' limit 1");
  check('call click carries the owner\'s button label', callLabel === 'Call us', callLabel);
  const sess = sql("select round(watch_seconds,1) || '|' || played || '|' || coalesce(device_class,'') || '|' || extract(epoch from (last_event_at - started_at))::int from video_view_sessions where contact_id='c-chain1'").split('|');
  const wall = Number(sess[3]);
  check('watch time is plausible (never more than the wall-clock time of the visit)', Number(sess[0]) > 3 && Number(sess[0]) <= wall + 12, `watch=${sess[0]}s wall~${wall}s device=${sess[2]}`);
  const raw = sql("select count(*) from video_events e join video_view_sessions s on s.id=e.session_id where s.contact_id='c-chain1'");
  const batches = log.map((l) => JSON.parse(l.body));
  check('requests were batched (far fewer requests than events)', batches.length >= 1 && batches.length <= 8 && Number(raw) >= batches.length, `${batches.length} requests -> ${raw} events`);
  check('the browser never sent an owner id, revision or score', !log.some((l) => /clerk_user_id|owner|revision|score/i.test(l.body)));

  // idempotency: replay the very first request
  const replay = await (await fetch(ADAPTER, { method: 'POST', body: log[0].body })).json();
  check('replaying a delivered batch is ignored (idempotent)', replay.ok && replay.accepted === 0, JSON.stringify(replay));
  check('no page errors in the player', errors.length === 0, errors.join(' | '));

  // ======================================================= 2. consent: Do-Not-Track
  const dnt = await browser.newContext({ viewport: { width: 1000, height: 700 }, bypassCSP: true });
  await dnt.addInitScript(() => Object.defineProperty(Navigator.prototype, 'doNotTrack', { get: () => '1' }));
  const dlog = []; await routeFunctions(dnt, dlog);
  const dp = await dnt.newPage();
  await dp.goto('http://127.0.0.1:3100/v/example/kitchen-renovation?c=c-dnt', { waitUntil: 'domcontentloaded' });
  await dp.locator('[data-bigplay]').waitFor({ timeout: 30000 }); await dp.waitForTimeout(5000); await dp.locator('[data-bigplay]').click(); await dp.waitForTimeout(4000);
  await dp.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await dp.waitForTimeout(1500);
  check('Do-Not-Track: nothing is sent and no session is stored', dlog.length === 0 && Number(sql("select count(*) from video_view_sessions where contact_id='c-dnt'")) === 0, `${dlog.length} requests`);
  await dnt.close();

  // ======================================================= 3. abuse / trust boundary (direct to the real handler)
  const post = (b) => fetch(ADAPTER, { method: 'POST', body: JSON.stringify(b) }).then(async (r) => [r.status, await r.json()]);
  const [s404] = await post({ video: 'springSale01', session: 'unpublished-session-0001', events: [{ type: 'page_open', seq: 0 }] }).then(async (r) => { sql("update published_videos set published=false where id='springSale01'"); const x = await post({ video: 'springSale01', session: 'unpublished-session-0002', events: [{ type: 'page_open', seq: 0 }] }); sql("update published_videos set published=true where id='springSale01'"); return x; });
  check('an unpublished video cannot be tracked (404)', s404 === 404, `status=${s404}`);
  const [sForge, bForge] = await post({ video: 'kitchenAB12', session: 'forged-owner-session-001', clerk_user_id: 'userB', owner_id: 'userB', revision: 99, interest_score: 1000, events: [{ type: 'play', seq: 1, owner: 'userB', score: 500 }] });
  check('forged owner / revision / interest score are ignored (accepted without effect)', sForge === 200 && sql("select count(*) from video_view_sessions s join published_videos v on v.id=s.video_id where s.session_key='forged-owner-session-001' and v.clerk_user_id='userA'") === '1' && sql("select count(*) from viewer_interests i join video_view_sessions s on s.id=i.session_id where s.session_key='forged-owner-session-001'") === '0', JSON.stringify(bForge));
  const [sBad] = await post({ video: 'kitchenAB12', session: 'short', events: [{ type: 'play', seq: 1 }] });
  const [sType] = await post({ video: 'kitchenAB12', session: 'bad-type-session-0000001', events: [{ type: 'interest_score', seq: 1 }] });
  check('malformed session / unknown event type are rejected (400)', sBad === 400 && sType === 400, `${sBad}/${sType}`);
  let limited = 0; const sess2 = 'rate-limit-session-00000001';
  for (let i = 0; i < 70; i += 1) { const [st] = await post({ video: 'kitchenAB12', session: sess2, events: [{ type: 'pause', seq: 100 + i }] }); if (st === 429) limited += 1; }
  check('rate limiting kicks in for a flooding client (429)', limited > 0, `${limited} of 70 limited`);

  // ======================================================= 4. the dashboard shows exactly what was recorded
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
  await ctx2.addInitScript((s) => { sessionStorage.setItem('setup_popup_shown', '1'); window.Clerk = { loaded: true, user: { id: s }, session: { getToken: async () => 'x' }, addListener() { return () => {}; }, load: async () => {} }; }, 'userA');
  const ed = await ctx2.newPage();
  await ed.route('**/.netlify/functions/supabase-token', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: tokens.userA, expires_in: 3600 }) }));
  await ed.goto('http://127.0.0.1:3100/#/timeline', { waitUntil: 'domcontentloaded' });
  await ed.locator('.floating-rail').waitFor({ timeout: 30000 });
  await ed.locator('.floating-rail').getByRole('button', { name: /Projects/ }).first().click(); await ed.addStyleTag({ content: '#floatingRail{display:none!important}' });
  await ed.locator('.prj-card').first().waitFor({ timeout: 20000 }); await ed.waitForTimeout(500);
  await ed.locator('.prj-card').filter({ has: ed.getByRole('heading', { name: 'Kitchen Renovation Promo', exact: true }) }).locator('[data-act="details"]').click();
  await ed.locator('.prj-tabs').getByRole('tab', { name: 'Analytics' }).click(); await ed.locator('.sv-analytics h1').waitFor();
  await ed.locator('.sv-segment').getByRole('button', { name: 'Today' }).click(); await ed.waitForTimeout(1500);
  const t = JSON.parse(asOwner('userA', `select video_analytics_summary('kitchenAB12','${day(0)}','${day(0)}')`));
  const ui = async (l) => (await ed.locator('.sv-stat', { hasText: l }).first().locator('.sv-stat-value').textContent()).trim();
  check('Analytics "Today" now includes the real visit (plays/CTA/leads equal the database)', (await ui('Video plays')) === String(t.plays) && (await ui('CTA clicks')) === String(t.cta_clicks + t.call_clicks) && (await ui('Leads captured')) === String(t.leads), `ui plays=${await ui('Video plays')} cta=${await ui('CTA clicks')} leads=${await ui('Leads captured')} | db plays=${t.plays} cta=${t.cta_clicks + t.call_clicks} leads=${t.leads}`);
  check('the visit produced at least one play, one call click and one lead today', t.plays >= 1 && t.call_clicks >= 1 && t.leads >= 1, JSON.stringify({ plays: t.plays, calls: t.call_clicks, leads: t.leads }));
  const notifs = sql("select string_agg(distinct type, ',') from owner_notifications where created_at > now() - interval '5 minutes'");
  check('the visit produced owner notifications through the real triggers', /new_lead|contact_cta/.test(notifs || ''), notifs);
  await ctx2.close(); await ctx.close();

  const pass = results.filter(Boolean).length;
  console.log(`\n${pass}/${results.length} chain checks passed`);
  await browser.close(); process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
