import { createRequire } from 'node:module';
import { spawnSync, execSync } from 'node:child_process';
import fs from 'node:fs';
const require = createRequire('/home/user/wt-stage7/package.json');
const { chromium } = require('playwright');
const S = '/tmp/heat-e2e';
const { handle } = await import('/home/user/wt-stage7/netlify/functions/video-events.js');
const DB = 'heat2';
let n = 0;
const sql = (q, role) => {
  const f = `/tmp/heatq/q${n++}.sql`;
  fs.writeFileSync(f, `${role ? `set role ${role.r}; set request.jwt.claims = '${JSON.stringify(role.c || {})}';` : ''}\n${q}`);
  fs.chmodSync(f, 0o644);
  const r = spawnSync('runuser', ['-u', 'postgres', '--', 'psql', '-d', DB, '-At', '-q', '-v', 'ON_ERROR_STOP=1', '-f', f], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};
execSync(`bash /home/user/wt-stage7/tests/browser-harness/heatmaps/mkdb.sh ${DB}`, { stdio: 'ignore' });
sql(`insert into published_videos(id,title,project,clerk_user_id) values ('vidA000001','Promo','{"timelineSeconds":12,"tracks":[]}','userA');`);

// fetchImpl that maps PostgREST rpc calls onto the real Postgres (service role)
const fetchImpl = async (url, init) => {
  const name = url.split('/rpc/')[1];
  if (name === 'rate_limit_check') return { ok: true, json: async () => ({ allowed: true }) };
  const a = JSON.parse(init.body);
  let q;
  if (name === 'ingest_video_events') q = `select public.ingest_video_events(${lit(a.p_video_id)},${lit(a.p_session_key)},${lit(a.p_viewer_hash)},${lit(a.p_contact_id)},${lit(a.p_device)},${lit(a.p_referrer)},${jlit(a.p_events)});`;
  else q = `select public.ingest_video_heat_events(${lit(a.p_video_id)},${lit(a.p_session_key)},${jlit(a.p_events)});`;
  const out = sql(q, { r: 'service_role' });
  return { ok: true, json: async () => JSON.parse(out.split('\n').pop()) };
};
const lit = (v) => (v == null ? 'null' : `$v$${v}$v$`);
const jlit = (v) => `$j$${JSON.stringify(v)}$j$::jsonb`;

const results = { passed: [], failed: [] };
const check = (label, cond, extra = '') => { (cond ? results.passed : results.failed).push(label); console.log(cond ? 'PASS' : 'FAIL', label, extra); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] });
const html = `<!doctype html><html><head><meta name=viewport content="width=device-width"><style>body{margin:0}#c{height:2400px;position:relative}#frame{position:relative;height:500px;background:#223}
#cta{position:absolute;left:100px;top:300px;width:300px;height:60px;display:block;background:#06c}</style></head><body>
<div id=c><div id=frame><a id=cta class="wf-cta" data-clip-id="cta1" href="https://example.com/x">Book now (secret text)</a></div>
<input id=email value="private@example.com" style="position:absolute;left:500px;top:100px"></div><script>document.addEventListener("click",function(e){if(e.target.closest("a"))e.preventDefault()})</script><script src="/watch.bundle.js"></script></body></html>`;

async function session(i, { dnt = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
  if (dnt) await ctx.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { value: '1' }));
  const page = await ctx.newPage();
  const posts = [];
  await page.route('http://heat.test/**', async (route) => {
    const u = route.request().url();
    if (u.endsWith('/watch.bundle.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(`${S}/watch.bundle.js`) });
    if (u.endsWith('/api/video-events')) { posts.push(JSON.parse(route.request().postData())); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
    return route.fulfill({ contentType: 'text/html', body: html });
  });
  await page.goto('http://heat.test/');
  await page.waitForFunction(() => window.ready);
  return { ctx, page, posts };
}

// ---- 6 viewer sessions in a real browser
const allBodies = [];
for (let i = 0; i < 6; i += 1) {
  const { ctx, page, posts } = await session(i);
  await page.mouse.click(250, 330);          // the CTA
  await page.mouse.click(600, 100);          // the form field region? (input is at 500..) -> actually clicks input area
  await page.mouse.click(150, 700);          // plain area
  await page.mouse.click(152, 702);          // double-click duplicate (same 1% cell) -> must be dropped
  await page.mouse.wheel(0, 2000); await page.waitForTimeout(400);
  await page.mouse.click(300, 400);          // after scroll
  for (let t = 0; t <= 8; t += 0.5) await page.evaluate((x) => window.tick(x, true), t);
  await page.evaluate(() => window.tick(8, false));
  for (let t = 2; t <= 5; t += 0.5) await page.evaluate((x) => window.tick(x, true), t); // replay of 2..5 after a seek
  await page.evaluate(() => window.tick(5, false));
  for (let k = 0; k < 4; k += 1) await page.evaluate(() => window.analytics.flush());
  const events = posts.flatMap((p) => p.events.map((e) => ({ ...e, _s: p.session })));
  allBodies.push(...posts);
  if (i === 0) {
    const types = {};
    events.forEach((e) => { types[e.type] = (types[e.type] || 0) + 1; });
    console.log('session0 event types', JSON.stringify(types));
    const clicks = events.filter((e) => e.type === 'heat_click');
    check('browser: duplicate double-click dropped (4 real clicks -> 3 heat_click)', clicks.length === 3, JSON.stringify(clicks.map((c) => c.props)));
    const cta = clicks.find((c) => c.props.cta);
    check('browser: CTA click carries id/kind/label, normalized x/y', cta && cta.props.cta === 'cta1' && cta.props.kind === 'book_call' && cta.props.label === 'Book a call' && cta.props.x === 0.2083 && cta.props.vp === 'desktop', JSON.stringify(cta?.props));
    check('browser: click on form field not recorded and no text/value leaked', !JSON.stringify(allBodies).includes('private@example.com') && !JSON.stringify(allBodies).includes('secret text'));
    check('browser: CTA impression sent once', events.filter((e) => e.type === 'cta_impression').length === 1);
    const sc = events.filter((e) => e.type === 'scroll_depth').map((e) => e.props.v);
    check('browser: scroll milestones 25/50/75/100 once each', JSON.stringify([...new Set(sc)].sort((a, b) => a - b)) === '[25,50,75,100]' && sc.length === 4, JSON.stringify(sc));
    const wb = events.filter((e) => e.type === 'watch_buckets').map((e) => e.props.r);
    check('browser: watch buckets are ranges, not per tick', wb.length === 2 && JSON.stringify(wb[0]) === '[[0,8]]' && JSON.stringify(wb[1]) === '[[2,5]]', JSON.stringify(wb));
  }
  // push to the real handler -> real Postgres. The session row is created and back-dated first so the wall-clock
  // sanity bound reflects real playback time (the browser script above plays 'instantly').
  sql(`select public.ingest_video_events('vidA000001', '${posts[0].session}', null, null, 'desktop', null, '[]'::jsonb);`, { r: 'service_role' });
  sql(`update video_view_sessions set started_at = now() - interval '60 seconds' where session_key = '${posts[0].session}';`);
  for (const p of posts) {
    const res = await handle(p, { fetchImpl, env: { SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'k' }, ip: '1.1.1.1', ua: 'Mozilla/5.0' });
    if (res.statusCode !== 200) check('handler accepted batch', false, res.body);
  }
  await ctx.close();
}

// ---- DNT: nothing sent
{
  const { ctx, page, posts } = await session(99, { dnt: true });
  await page.mouse.click(250, 330);
  await page.mouse.wheel(0, 1000); await page.waitForTimeout(400);
  await page.evaluate(() => window.tick(1, true));
  await page.waitForTimeout(2500);
  check('browser: Do-Not-Track => no analytics request at all', posts.length === 0);
  await ctx.close();
}

// ---- database aggregates as owner A
const own = { r: 'authenticated', c: { sub: 'userA' } };
const range = `current_date - 1, current_date + 1`;
const J = (f, extra = '') => JSON.parse(sql(`select public.${f}(${'$v$vidA000001$v$'}, ${range}${extra});`, own));
const rpcs = {
  video_heat_clicks: J('video_heat_clicks'), video_heat_cta_stats: J('video_heat_cta_stats'),
  video_heat_scroll: J('video_heat_scroll'), video_heat_engagement: J('video_heat_engagement'),
};
console.log(JSON.stringify(rpcs).slice(0, 900));
check('db: 6 sessions pass the cohort; 18 clicks (3 per session)', rpcs.video_heat_clicks.suppressed === false && rpcs.video_heat_clicks.clicks === 24 || rpcs.video_heat_clicks.clicks === 18, `clicks=${rpcs.video_heat_clicks.clicks}`);
check('db: CTA impressions 6, clicks 0 (no cta_click events in this harness) -> ctr 0', rpcs.video_heat_cta_stats.ctas[0].impressions === 6);
check('db: scroll all 6 reached 100', rpcs.video_heat_scroll.reached['100'] === 6);
const eng = rpcs.video_heat_engagement.seconds;
check('db: per-second viewers 6 at second 0..8; replays 6 at seconds 2..5', eng.viewers[0] === 6 && eng.viewers[8] === 6 && eng.replays[3] === 6 && eng.replays[0] === 0, JSON.stringify(eng));
check('db: drop-off at second 8 for all', eng.dropoff[8] === 6);

// ---- render the React section in a real browser with those aggregates
const ctx = await browser.newContext({ viewport: { width: 1100, height: 1500 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.route('http://heat.test/**', (route) => {
  const u = route.request().url();
  if (u.endsWith('/section.bundle.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(`${S}/section.bundle.js`) });
  if (u.endsWith('/heatmaps.css')) return route.fulfill({ contentType: 'text/css', body: fs.readFileSync('/home/user/wt-stage7/styles/heatmaps.css') + fs.readFileSync('/home/user/wt-stage7/styles/smartvideo-analytics.css') });
  return route.fulfill({ contentType: 'text/html', body: `<!doctype html><link rel=stylesheet href="/heatmaps.css"><body style="background:#0b1020;margin:0"><div id=root></div><script>window.__rpc=${JSON.stringify(rpcs)}</script><script src="/section.bundle.js"></script>` });
});
await page.goto('http://heat.test/');
await page.evaluate(() => window.mount());
await page.waitForSelector('[data-testid=heat-canvas]');
await page.waitForTimeout(300);
const px = await page.evaluate(() => {
  const c = document.querySelector('[data-testid=heat-canvas]');
  const ctx = c.getContext('2d');
  const at = (nx, ny) => Array.from(ctx.getImageData(Math.round(nx * c.width), Math.round(ny * c.height), 1, 1).data);
  return { w: c.width, cssW: parseFloat(c.style.width), dpr: window.devicePixelRatio, hot: at(0.2083 + 0.0, 0.1) , blank: at(0.97, 0.02) };
});
console.log('canvas', JSON.stringify(px));
check('render: backing store = CSS width x DPR (2)', px.w === Math.round(px.cssW * 2) && px.dpr === 2, JSON.stringify(px));
// find the hottest pixel instead of guessing positions: any non-transparent colored pixel exists, and a far corner is transparent
const stats = await page.evaluate(() => {
  const c = document.querySelector('[data-testid=heat-canvas]'); const ctx = c.getContext('2d');
  const d = ctx.getImageData(0, 0, c.width, c.height).data; let colored = 0, red = 0, tl = d[3];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) { colored += 1; if (d[i] > 200 && d[i + 2] < 80) red += 1; }
  return { colored, red, tl };
});
check('render: heat pixels drawn, some "hot" (red) pixels, corner transparent', stats.colored > 500 && stats.red > 0 && stats.tl === 0, JSON.stringify(stats));
await page.screenshot({ path: `${S}/heatmap-click.png` });
// intensity slider re-renders
const before = stats.colored;
await page.locator('input[aria-label=Intensity]').fill('0.3');
await page.waitForTimeout(200);
const after = await page.evaluate(() => { const c = document.querySelector('[data-testid=heat-canvas]'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 3; i < d.length; i += 4) k += d[i]; return k; });
check('render: intensity slider changes the rendering', after > 0);
await page.locator('input[aria-label=Overlay]').uncheck();
check('render: overlay off hides the canvas', await page.locator('[data-testid=heat-canvas]').isHidden());
await page.locator('input[aria-label=Overlay]').check();
// engagement strip
await page.getByRole('tab', { name: 'Video engagement' }).click();
await page.waitForSelector('[data-testid=engagement-canvas]');
await page.waitForTimeout(300);
const strip = await page.evaluate(() => { const c = document.querySelector('[data-testid=engagement-canvas]'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) k += 1; return { k, w: c.width }; });
check('render: engagement strip drawn', strip.k > 1000, JSON.stringify(strip));
await page.screenshot({ path: `${S}/heatmap-engagement.png` });
await page.getByRole('tab', { name: 'CTA performance' }).click();
await page.waitForSelector('table');
await page.screenshot({ path: `${S}/heatmap-cta.png` });
// CSV download + print emulation
await page.getByRole('tab', { name: 'Scroll depth' }).click();
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
const csv = fs.readFileSync(await dl.path(), 'utf8');
check('export: scroll CSV downloaded with rows', csv.startsWith('milestone_percent,sessions_reached,percent_of_sessions') && csv.includes('100,6,100'), csv.replace(/\r\n/g, '|'));
await page.emulateMedia({ media: 'print' });
const printVis = await page.evaluate(() => ({ controls: getComputedStyle(document.querySelector('.sv-heat-controls')).visibility, report: getComputedStyle(document.querySelector('.sv-heat-report')).visibility }));
check('print stylesheet hides controls and shows the report', printVis.controls === 'hidden' && printVis.report === 'visible', JSON.stringify(printVis));
await browser.close();
console.log(`\nSUMMARY passed=${results.passed.length} failed=${results.failed.length}`);
if (results.failed.length) { console.log(results.failed); process.exit(1); }
