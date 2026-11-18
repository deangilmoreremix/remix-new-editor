// Stage 11 (Fix O): campaign filter in REAL Chromium + REAL Postgres 16. The React Heatmaps section's rpc() is bridged to the
// owner RPCs (as owner A) of a local database. Phase 1: no linkage column => the Campaign control is hidden, results unchanged.
// Phase 2: TEST-ONLY shim column video_view_sessions.campaign_id => control appears, filtering and cohort suppression work.
// Run: node build.cjs && node campaign-e2e.mjs   (env: DB default heatO, HEAT_S default /tmp/heat-e2e, HEAT_Q default /tmp/heatq, CHROME)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execSync } from 'node:child_process';
import fs from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(`${ROOT}/package.json`);
const { chromium } = require('playwright');
const S = process.env.HEAT_S || '/tmp/heat-e2e';
const QD = process.env.HEAT_Q || '/tmp/heatq';
const DB = process.env.DB || 'heatO';
fs.mkdirSync(QD, { recursive: true }); fs.chmodSync(QD, 0o755);
let n = 0;
const sql = (q, role) => {
  const f = `${QD}/c${n++}.sql`;
  fs.writeFileSync(f, `${role ? `set role ${role.r}; set request.jwt.claims = '${JSON.stringify(role.c || {})}';` : ''}\n${q}`);
  fs.chmodSync(f, 0o644);
  const r = spawnSync('runuser', ['-u', 'postgres', '--', 'psql', '-d', DB, '-At', '-q', '-v', 'ON_ERROR_STOP=1', '-f', f], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};
execSync(`bash ${ROOT}/tests/browser-harness/heatmaps/mkdb.sh ${DB}`, { stdio: 'ignore' });
execSync(`runuser -u postgres -- psql -d ${DB} -q -v ON_ERROR_STOP=1 -f ${ROOT}/supabase/migrations/20261117100000_heatmap_campaign_filter.sql`, { stdio: 'ignore', env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' } });
execSync(`runuser -u postgres -- psql -d ${DB} -q -v ON_ERROR_STOP=1 -f ${ROOT}/supabase/migrations/20261117100000_heatmap_campaign_filter.sql`, { stdio: 'ignore', env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' } });
const AA = '00000000-0000-0000-0000-0000000000aa', BB = '00000000-0000-0000-0000-0000000000bb';
sql(`insert into published_videos(id,title,project,clerk_user_id) values ('vidO000001','Promo','{"timelineSeconds":12,"tracks":[]}','userA'),('vidO000002','Small rest','{"timelineSeconds":12,"tracks":[]}','userA');
create schema if not exists t; create table t.grp(sk text, grp text);
create or replace function t.seed(v text, g text, k int, x numeric, y numeric) returns void language plpgsql as $$ declare i int; sk text; begin
  for i in 1..k loop sk := 'sess_'||v||'_'||g||'_'||lpad(i::text,3,'0');
    perform public.ingest_video_events(v, sk, null, null, 'desktop', null, '[{"type":"page_open","seq":0}]');
    perform public.ingest_video_heat_events(v, sk, jsonb_build_array(jsonb_build_object('type','heat_click','seq',2,'props',jsonb_build_object('vp','desktop','x',x,'y',y,'pb',3))));
    insert into t.grp values (sk, g); end loop; end $$;
grant usage on schema t to service_role; grant all on t.grp to service_role; grant execute on function t.seed(text,text,int,numeric,numeric) to service_role;`);
sql(`select t.seed('vidO000001','X',6,0.5,0.25); select t.seed('vidO000001','Y',5,0.1,0.9); select t.seed('vidO000001','N',6,0.8,0.8);
select t.seed('vidO000002','X',6,0.5,0.25); select t.seed('vidO000002','N',3,0.2,0.2);`, { r: 'service_role' });

const own = { r: 'authenticated', c: { sub: 'userA' } };
const lit = (v) => (v == null ? 'null' : typeof v === 'number' ? String(v) : `$v$${v}$v$`);
const bridge = async (name, a) => {
  const known = { video_heat_clicks: ['p_video_id', 'p_from', 'p_to', 'p_viewport', 'p_cta', 'p_page_bucket', 'p_campaign'], video_heat_cta_stats: ['p_video_id', 'p_from', 'p_to', 'p_viewport', 'p_campaign'],
    video_heat_scroll: ['p_video_id', 'p_from', 'p_to', 'p_viewport', 'p_campaign'], video_heat_engagement: ['p_video_id', 'p_from', 'p_to', 'p_viewport', 'p_campaign'], video_heat_campaign_options: ['p_video_id'] };
  // named-argument call like PostgREST: only the arguments the client sent
  const args = Object.entries(a).filter(([k, v]) => known[name].includes(k)).map(([k, v]) => `${k} => ${k.endsWith('p_from') || k === 'p_from' || k === 'p_to' ? `${lit(v)}::date` : k === 'p_campaign' ? `${lit(v)}::uuid` : k === 'p_page_bucket' ? (v == null ? 'null::integer' : v) : lit(v)}`).join(', ');
  try { return { data: JSON.parse(sql(`select public.${name}(${args});`, own)), error: null }; }
  catch (e) { return { data: null, error: { message: String(e.message).split('\n')[0] } }; }
};

const results = { passed: [], failed: [] };
const check = (label, cond, extra = '') => { (cond ? results.passed : results.failed).push(label); console.log(cond ? 'PASS' : 'FAIL', label, extra); };
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] });
const open = async (video) => {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1400 } });
  const page = await ctx.newPage();
  await page.exposeFunction('pgRpc', bridge);
  await page.route('http://heat.test/**', (route) => {
    const u = route.request().url();
    if (u.endsWith('/campaign.bundle.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(`${S}/campaign.bundle.js`) });
    if (u.endsWith('/heatmaps.css')) return route.fulfill({ contentType: 'text/css', body: fs.readFileSync(`${ROOT}/styles/heatmaps.css`) + fs.readFileSync(`${ROOT}/styles/smartvideo-analytics.css`) });
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><link rel=stylesheet href="/heatmaps.css"><body style="background:#0b1020;margin:0"><div id=root></div><script src="/campaign.bundle.js"></script>' });
  });
  await page.goto('http://heat.test/');
  await page.evaluate((v) => window.mount(v), video);
  return { ctx, page };
};

// ---- phase 1: database WITHOUT the linkage column
{
  const { ctx, page } = await open('vidO000001');
  await page.waitForSelector('[data-testid=heat-stage]');
  await page.waitForFunction(() => window.__calls.some(([n]) => n === 'video_heat_campaign_options'));
  check('phase 1 (no linkage): Campaign control is hidden', (await page.getByLabel('Campaign').count()) === 0);
  check('phase 1: no error banner, click heatmap shows all 17 sessions', (await page.getByRole('alert').count()) === 0 && (await page.getByText(/clicks shown from 17 sessions/).count()) === 1);
  const calls = await page.evaluate(() => window.__calls.filter(([n]) => n === 'video_heat_clicks'));
  check('phase 1: client never sends p_campaign', calls.length > 0 && calls.every(([, a]) => !('p_campaign' in a)));
  await page.screenshot({ path: `${S}/campaign-phase1.png` });
  await ctx.close();
}

// ---- phase 2: TEST-ONLY shim linkage
sql(`alter table public.video_view_sessions add column campaign_id uuid;
create table public.video_campaigns(id uuid primary key, clerk_user_id text not null, name text not null);
insert into public.video_campaigns values ('${AA}','userA','Spring outreach'),('${BB}','userA','Webinar');
update public.video_view_sessions s set campaign_id='${AA}' from t.grp g where g.sk=s.session_key and g.grp='X';
update public.video_view_sessions s set campaign_id='${BB}' from t.grp g where g.sk=s.session_key and g.grp='Y';`);
{
  const { ctx, page } = await open('vidO000001');
  const sel = page.getByLabel('Campaign');
  await sel.waitFor();
  const opts = await sel.locator('option').allTextContents();
  check('phase 2 (linkage): Campaign control appears with named campaigns', JSON.stringify(opts) === JSON.stringify(['All traffic', 'Spring outreach', 'Webinar']), JSON.stringify(opts));
  check('phase 2: unfiltered view unchanged (17 sessions)', (await page.getByText(/clicks shown from 17 sessions/).count()) === 1);
  await sel.selectOption(AA);
  await page.getByText(/6 clicks shown from 6 sessions/).waitFor();
  check('phase 2: selecting campaign X narrows to its 6 sessions (real SQL)', true);
  check('phase 2: summary names the campaign', (await page.getByTestId('heat-summary').textContent()).includes('Campaign: Spring outreach'));
  const st = await page.evaluate(() => { const c = document.querySelector('[data-testid=heat-canvas]'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) k += 1; return k; });
  check('phase 2: heat layer drawn for the campaign', st > 100, String(st));
  await page.screenshot({ path: `${S}/campaign-phase2-X.png` });
  await sel.selectOption(BB);
  await page.getByText(/5 clicks shown from 5 sessions/).waitFor();
  check('phase 2: campaign Y (exactly K=5 sessions, remainder 6) is shown', true);
  await page.getByRole('tab', { name: 'Scroll depth' }).click();
  await page.waitForSelector('[data-testid=heat-suppressed], [data-testid=scroll-bars]');
  check('phase 2: filter persists on another view (scroll depth asks with p_campaign)', await page.evaluate((b) => window.__calls.filter(([n]) => n === 'video_heat_scroll').some(([, a]) => a.p_campaign === b), BB));
  await ctx.close();
}
{
  // vidO000002: campaign X has 6 sessions but only 3 unattributed remain: the gate must withhold X (9 - 6 would reveal 3)
  const { ctx, page } = await open('vidO000002');
  await page.getByLabel('Campaign').waitFor();
  await page.getByText(/clicks shown from 9 sessions/).waitFor();
  await page.getByLabel('Campaign').selectOption(AA);
  await page.getByTestId('heat-suppressed').waitFor();
  const txt = await page.getByTestId('heat-suppressed').textContent();
  check('phase 2: small remainder => campaign view withheld ("Not enough data", 0 sessions disclosed)', /Not enough data yet/.test(txt) && /\(0 so far/.test(txt), txt);
  check('phase 2: no heat canvas drawn for the withheld campaign view', (await page.locator('[data-testid=heat-canvas]').count()) === 0);
  await page.screenshot({ path: `${S}/campaign-phase2-withheld.png` });
  await ctx.close();
}
await browser.close();
console.log(`\nSUMMARY passed=${results.passed.length} failed=${results.failed.length}`);
if (results.failed.length) { console.log(results.failed); process.exit(1); }
