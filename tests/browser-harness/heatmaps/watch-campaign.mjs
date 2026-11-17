// Stage 11 (Fix P) end-to-end check of the campaign write path on the REAL watch page in real Chromium.
// Network mocking as in watch-real.mjs: Supabase get_published_video -> fixture, /api/video-events -> recorded. The recorded batches are then
// pushed through the REAL netlify/functions/video-events.js handler into local Postgres 16 (mkdb-campaign.sh), including the
// attribute_video_session_campaign RPC. Four viewers: valid recipient link, a link carrying ANOTHER owner's recipient token, garbage, no token.
// Local only, not CI. Needs the vite dev server (VITE_SUPABASE_URL=https://supa.test VITE_SUPABASE_ANON_KEY=x npx vite --port $VITE_PORT --strictPort),
// Chromium ($CHROME), ffmpeg-made $MEDIA/clip.webm (see README), a running Postgres cluster (root can `su postgres`). Env: CAMPAIGNS_MIGRATION=<file> uses the real campaigns schema.
//   node watch-campaign.mjs
import { createRequire } from 'node:module';
import { spawnSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(`${ROOT}/package.json`);
const { chromium } = require('playwright');
const PORT = process.env.VITE_PORT || '3141';
const APP = `http://127.0.0.1:${PORT}`;
const SUPA = 'https://supa.test';
const MEDIA = process.env.MEDIA || '/tmp/watchreal';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const DB = process.env.DB || 'campreal';
const OUT = process.env.OUT || '/tmp/campreal';
const CAMP = process.env.CAMPAIGNS_MIGRATION || '';
const MEDIA_BUF = fs.readFileSync(`${MEDIA}/clip.webm`);
const { handle } = await import(`${ROOT}/netlify/functions/video-events.js`);

const results = { passed: [], failed: [] };
const check = (label, cond, extra = '') => { (cond ? results.passed : results.failed).push(label); console.log(cond ? 'PASS' : 'FAIL', label, extra); };

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
execSync(`bash ${ROOT}/tests/browser-harness/heatmaps/mkdb-campaign.sh ${DB} ${CAMP}`, { stdio: 'ignore' });

const T = 10;
const project = { version: 1, title: 'Promo', timelineSeconds: T, tracks: [{ id: 'v', type: 'video', items: [{ left: 0, width: 100, id: 'vid', type: 'video', src: 'https://media.test/clip.webm' }] }], listBuilder: null };
const VA = 'vidA000001'; const VB = 'vidB000001';
const TOK_A = 'tokA1_aaaaaaaaaaaaaaaaaaaaaa'; const TOK_B = 'tokB1_bbbbbbbbbbbbbbbbbbbbbb'; const TOK_BAD = 'not-a-real-token-at-all-123';
const CA = '00000000-0000-0000-0000-0000000000a1'; const CB = '00000000-0000-0000-0000-0000000000b1';
const hasCampaignTables = sql(`select to_regclass('public.video_campaigns') is not null;`) === 't';
sql(`insert into published_videos(id,title,project,clerk_user_id) values ('${VA}','A','${JSON.stringify(project)}','userA'),('${VB}','B','${JSON.stringify(project)}','userB');`);
sql(`${hasCampaignTables ? '' : `create table public.video_campaigns (id uuid primary key default gen_random_uuid(), clerk_user_id text not null, name text not null default 'c');
create table public.campaign_recipients (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.video_campaigns(id) on delete cascade, clerk_user_id text not null, public_token text not null unique, status text not null default 'pending');`}
insert into public.video_campaigns(id, clerk_user_id, name) values ('${CA}','userA','A one'),('${CB}','userB','B one');
insert into public.campaign_recipients(campaign_id, clerk_user_id, public_token, status) values ('${CA}','userA','${TOK_A}','ready'),('${CB}','userB','${TOK_B}','ready');`);
console.log(hasCampaignTables ? 'using the REAL campaigns schema' : 'using the minimal stand-in campaign tables (campaigns migration not applied)');

const lit = (v) => (v == null ? 'null' : `$v$${v}$v$`);
const jlit = (v) => `$j$${JSON.stringify(v)}$j$::jsonb`;
const fetchImpl = async (url, init) => {
  const name = url.split('/rpc/')[1];
  if (name === 'rate_limit_check') return { ok: true, json: async () => ({ allowed: true }) };
  const a = JSON.parse(init.body);
  const q = name === 'ingest_video_events'
    ? `select public.ingest_video_events(${lit(a.p_video_id)},${lit(a.p_session_key)},${lit(a.p_viewer_hash)},${lit(a.p_contact_id)},${lit(a.p_device)},${lit(a.p_referrer)},${jlit(a.p_events)});`
    : name === 'attribute_video_session_campaign'
      ? `select public.attribute_video_session_campaign(${lit(a.p_video_id)},${lit(a.p_session_key)},${lit(a.p_token)});`
      : `select public.ingest_video_heat_events(${lit(a.p_video_id)},${lit(a.p_session_key)},${jlit(a.p_events)});`;
  const out = sql(q, { r: 'service_role' });
  return { ok: true, json: async () => JSON.parse(out.split('\n').pop()) };
};

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
async function viewer(videoId, query) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 500 } });
  const page = await ctx.newPage();
  const posts = [];
  const fixture = { id: videoId, title: 'Promo', privacy: 'public', project };
  await page.route(`${SUPA}/**`, async (route) => {
    const hdr = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: hdr });
    if (route.request().url().includes('/rpc/get_published_video')) return route.fulfill({ status: 200, headers: hdr, contentType: 'application/json', body: JSON.stringify(fixture) });
    return route.fulfill({ status: 200, headers: hdr, contentType: 'application/json', body: '[]' });
  });
  await page.route('https://media.test/**', (route) => {
    const base = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': '*', 'accept-ranges': 'bytes' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: base });
    return route.fulfill({ status: 200, headers: { ...base, 'content-length': String(MEDIA_BUF.length) }, contentType: 'video/webm', body: MEDIA_BUF });
  });
  await ctx.route(`${APP}/api/video-events`, async (route) => { posts.push(JSON.parse(route.request().postData())); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  await page.goto(`${APP}/watch/${videoId}${query}`);
  await page.waitForSelector('[data-bigplay]', { timeout: 30000 });
  // page_open is flushed by the analytics client (timer, or on hide); hide the page the way a backgrounded tab does
  await page.waitForTimeout(500);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  for (let i = 0; i < 150 && !posts.length; i += 1) await page.waitForTimeout(100);
  await ctx.close();
  return posts;
}

const cases = [
  ['valid recipient link on the owner\'s video', VA, `?cr=${TOK_A}`, CA, TOK_A],
  ['another owner\'s recipient token on this video (spoof)', VA, `?cr=${TOK_B}`, null, TOK_B],
  ['garbage token of valid shape', VA, `?cr=${TOK_BAD}`, null, TOK_BAD],
  ['malformed token (never leaves the browser)', VA, '?cr=short', null, undefined],
  ['no token (plain link)', VA, '', null, undefined],
  ['owner A\'s token on owner B\'s video (spoof)', VB, `?cr=${TOK_A}`, null, TOK_A],
  ['owner B\'s own token on B\'s video', VB, `?cr=${TOK_B}`, CB, TOK_B],
];
await viewer(VA, ''); // warm-up (first vite load is slow); its session is not asserted
const bodies = [];
for (const [label, vid, query, expected, sent] of cases) {
  const posts = await viewer(vid, query);
  check(`${label}: a batch was sent`, posts.length >= 1);
  const post = posts[0] || {};
  check(`${label}: payload recipient field is ${sent === undefined ? 'absent' : 'the url token'}`, sent === undefined ? !('recipient' in post) : post.recipient === sent);
  const sess = post.session;
  const res = await handle(post, { fetchImpl, env: { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'k' }, ip: '203.0.113.5', ua: 'Mozilla/5.0 (X11; Linux x86_64)' });
  bodies.push(res.body);
  check(`${label}: handler answered 200`, res.statusCode === 200, res.body);
  const got = sql(`select coalesce(campaign_id::text,'NULL') from public.video_view_sessions where video_id='${vid}' and session_key='${sess}';`);
  check(`${label}: stored campaign_id = ${expected || 'NULL'}`, got === (expected || 'NULL'), got);
}
check('the handler response is identical for every case (no oracle)', new Set(bodies).size === 1, [...new Set(bodies)].join(' | '));
check('no token value is stored anywhere in the sessions table', sql(`select count(*) from public.video_view_sessions s where s::text like '%tokA1_%' or s::text like '%tokB1_%';`) === '0');
await browser.close();
console.log(`\n${results.passed.length} passed, ${results.failed.length} failed`);
process.exit(results.failed.length ? 1 : 0);
