// Editor publish flow in a real browser against the real database: publish from the Share panel, readable link,
// slug change + redirect, unpublish, republish (revision), privacy, and the owner's interest map reaching viewers.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const B = process.env.HARNESS_DIR || __dirname;
const tokens = JSON.parse(fs.readFileSync(`${B}/tokens.json`, 'utf8'));
const sql = (q) => execFileSync('psql', ['-h', '127.0.0.1', '-U', 'postgres', '-d', 'svbrowser', '-At', '-c', q], { env: { ...process.env, PGPASSWORD: 'browsertest' } }).toString().trim();
const results = []; const check = (n, ok, d = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };
const ADAPTER = 'http://127.0.0.1:8890/';

(async () => {
  sql("delete from timeline_projects where name = 'Publish Flow Project'");
  sql("delete from published_videos where title like 'Publish Flow%'");
  const DUR = 30;
  const clip = (id, type, s, e, extra) => ({ id, type, left: s / DUR * 100, width: (e - s) / DUR * 100, ...extra });
  const tracks = [
    { id: 'v1', type: 'video', name: 'Video', items: [clip('pA', 'video', 0, 15, { name: 'Intro', src: 'http://127.0.0.1:8099/kitchen.mp4', trimIn: 0 }), clip('pB', 'video', 15, 30, { name: 'Offer', src: 'http://127.0.0.1:8099/kitchen.mp4', trimIn: 15 })] },
    { id: 't1', type: 'text', name: 'Interactive', items: [clip('pcta', 'click-to-call', 16, 28, { buttonText: 'Get a quote', linkUrl: 'https://example.com/q', style: {} })] },
  ];
  tracks.forEach((t) => { t.clips = t.items; });   // the editor keeps both names for a track's clips
  const state = { timelineSeconds: DUR, projectTitle: 'Publish Flow Project', tracks };
  const interestMap = [{ id: 'pB', title: 'Offer', start: 15, end: 30, interest: { type: 'offer', label: 'Spring offer' }, clipIds: ['pcta'] }];
  const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
  const pid = sql(`set role authenticated; select set_config('request.jwt.claims', '{"sub":"userA"}', false) >= '' as x; insert into timeline_projects(name, data, settings, duration_s, aspect_ratio) values ('Publish Flow Project', ${q(JSON.stringify(state))}::jsonb, ${q(JSON.stringify({ interestMap }))}::jsonb, 30, '16:9') returning id`).split('\n').find((l) => /^[0-9a-f-]{36}$/.test(l));
  check('test project created for owner A', !!pid, pid);

  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, bypassCSP: true });
  await ctx.addInitScript(([s, st]) => { sessionStorage.setItem('setup_popup_shown', '1'); if (!localStorage.getItem('timeline-editor-project')) localStorage.setItem('timeline-editor-project', JSON.stringify(st)); window.Clerk = { loaded: true, user: { id: s }, session: { getToken: async () => 'x' }, addListener() { return () => {}; }, load: async () => {} }; }, ['userA', { ...state, projectId: pid }]);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => { console.log('   FRAMES:', page.frames().map((f)=>f.url().slice(0,80)+'|'+f.name()).join(' ; ')); errors.push(String(e.message).slice(0, 160)); console.log('   PAGEERROR STACK:', String(e.stack).split('\n').slice(0, 5).map((l) => l.trim().replace(/http:\/\/127.0.0.1:3100/, '').slice(0, 130)).join(' | ')); });
  await page.route('**/.netlify/functions/supabase-token', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: tokens.userA, expires_in: 3600 }) }));
  await page.goto('http://127.0.0.1:3100/#/timeline-classic', { waitUntil: 'domcontentloaded' });
  await page.locator('.floating-rail').waitFor({ timeout: 30000 });
  await page.locator('.floating-rail').getByRole('button', { name: /Share/ }).first().evaluate((b) => b.click());
  await page.locator('#sharePanel').waitFor({ state: 'visible' });
  await page.addStyleTag({ content: '#floatingRail{display:none!important}' }); await page.locator('[data-share-publish]').waitFor({ timeout: 15000 });
  await page.waitForTimeout(2500);   // the panel redraws once after loading the video info; type after that
  const title = page.locator('[data-share-title]'); await title.fill('Publish Flow Video');
  await page.locator('[data-share-publish]').click();
  await page.locator('[data-share-link]').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);

  // ---------------------------------------------------- publish
  let row = sql("select id || '|' || coalesce(slug,'') || '|' || revision || '|' || published || '|' || coalesce(project_id::text,'') || '|' || privacy from published_videos where title = 'Publish Flow Video'").split('|');
  const [vid, slug1, rev1, pub1, proj1, privacy1] = row;
  check('Publish from the Share panel creates the video linked to its editable source project', pub1 === 'true' && proj1 === pid, `id=${vid} project=${proj1 === pid}`);
  check('a readable slug was assigned automatically (business name already chosen)', slug1 === 'publish-flow-video', slug1);
  check('first publication is revision 1 and public by default', rev1 === '1' && privacy1 === 'public', `rev=${rev1} privacy=${privacy1}`);
  const shown = await page.locator('[data-share-link]').inputValue();
  check('the panel shows the canonical readable link', /\/v\/example\/publish-flow-video$/.test(shown), shown);
  const snap = JSON.parse(sql(`select project::text from published_videos where id='${vid}'`));
  check('the owner\'s interest map saved in Retarget was carried into the published snapshot', Array.isArray(snap.interestMap) && snap.interestMap[0]?.interest?.label === 'Spring offer', JSON.stringify(snap.interestMap?.[0]?.interest));
  check('the editable project is untouched by publishing (still editable, same row)', sql(`select count(*) from timeline_projects where id='${pid}' and deleted_at is null`) === '1');

  // ---------------------------------------------------- the public page
  const pub = await ctx.newPage();
  const open = async (url) => { await pub.goto(url, { waitUntil: 'domcontentloaded' }); await pub.waitForTimeout(2500); return { url: pub.url(), text: await pub.locator('body').innerText(), robots: await pub.locator('meta[name="robots"]').count() }; };
  await pub.route('**/api/video-events', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  let r1 = await open('http://127.0.0.1:3100/v/example/publish-flow-video');
  check('the readable link plays the published video', /Publish Flow Video/.test(r1.text), r1.text.slice(0, 40).replace(/\n/g, ' '));
  check('/watch/<id> still works as an alias and shows the same canonical address', (await open(`http://127.0.0.1:3100/watch/${vid}`)).url.endsWith('/v/example/publish-flow-video'));

  // ---------------------------------------------------- slug change + redirect
  await page.locator('[data-share-slug]').fill('publish-flow-v2');
  await page.locator('[data-share-savelink]').click(); await page.waitForTimeout(1500);
  check('changing the slug updates the live link', sql(`select slug from published_videos where id='${vid}'`) === 'publish-flow-v2' && /publish-flow-v2$/.test(await page.locator('[data-share-link]').inputValue()));
  let r2 = await open('http://127.0.0.1:3100/v/example/publish-flow-video');
  check('the OLD link still works and lands on the new address (redirect)', /publish-flow-v2$/.test(new URL(r2.url).pathname) && /Publish Flow Video/.test(r2.text), new URL(r2.url).pathname);
  await page.locator('[data-share-slug]').fill('admin'); await page.locator('[data-share-savelink]').click(); await page.waitForTimeout(500);
  check('reserved names are refused with a clear message', /reserved/i.test(await page.locator('[data-share-linkmsg]').textContent()) && sql(`select slug from published_videos where id='${vid}'`) === 'publish-flow-v2');
  sql("set role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"userB\"}', false) >= '' as x;");
  const stolen = (() => { try { return sql("set role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"userB\"}', false) >= '' as x; select claim_business_slug('example')"); } catch (e) { return 'ERROR ' + String(e.stderr || e).split('\n').find((l) => /slug_taken/.test(l)); } })();
  check('another user cannot claim this business namespace', /slug_taken/.test(stolen), String(stolen).slice(0, 60));

  // ---------------------------------------------------- privacy
  await page.locator('[data-share-privacy]').selectOption('unlisted'); await page.waitForTimeout(1200);
  const r3 = await open('http://127.0.0.1:3100/v/example/publish-flow-v2');
  check('unlisted videos are marked noindex for search engines', sql(`select privacy from published_videos where id='${vid}'`) === 'unlisted' && r3.robots === 1);

  // ---------------------------------------------------- unpublish / republish
  await page.locator('[data-share-unpublish]').click(); await page.waitForTimeout(1500);
  const r4 = await open('http://127.0.0.1:3100/v/example/publish-flow-v2');
  check('unpublished: the public link now shows "not found"', /not found|no longer shared/i.test(r4.text), r4.text.slice(0, 50).replace(/\n/g, ' '));
  const rest = await fetch('http://127.0.0.1:54321/rest/v1/published_videos?select=id', { headers: { apikey: 'x', authorization: 'Bearer anon-test-key' } }).then((r) => r.json());
  check('the public API cannot list videos at all (no enumeration)', Array.isArray(rest) && rest.length === 0);
  const [s404] = await fetch(ADAPTER, { method: 'POST', body: JSON.stringify({ video: vid, session: 'unpub-chain-session-0001', events: [{ type: 'page_open', seq: 0 }] }) }).then(async (r) => [r.status]);
  check('an unpublished video cannot be tracked', s404 === 404);
  await page.locator('[data-share-title]').fill('Publish Flow Video v2');
  await page.locator('[data-share-publish]').click(); await page.waitForTimeout(2500);
  row = sql(`select revision || '|' || published || '|' || slug from published_videos where id='${vid}'`).split('|');
  check('republishing makes it live again, bumps the revision and keeps the link', row[1] === 'true' && Number(row[0]) >= 2 && row[2] === 'publish-flow-v2', row.join(' | '));
  check('every published revision is kept (immutable history)', Number(sql(`select count(*) from published_video_revisions where video_id='${vid}'`)) >= 2);
  await page.locator('[data-share-revisions] summary').click(); await page.waitForTimeout(1000);
  check('the revision list is shown to the owner', (await page.locator('[data-share-revisions] li').count()) >= 2);

  // ---------------------------------------------------- the interest map drives scores
  const sk = 'interest-map-session-0001';
  const post = (b) => fetch(ADAPTER, { method: 'POST', body: JSON.stringify(b) }).then((r) => r.json());
  await post({ video: vid, session: sk, viewer: 'viewer-for-interest-map-001', events: [{ type: 'page_open', seq: 0 }, { type: 'play', seq: 1 }] });
  sql(`update video_view_sessions set started_at = now() - interval '5 minutes' where session_key='${sk}'`);
  await post({ video: vid, session: sk, events: [{ type: 'watch', seq: 2, t0: 15, t1: 29 }, { type: 'cta_click', seq: 3, clip: 'pcta', props: { label: 'Get a quote' } }] });
  const sc = sql(`select string_agg(interest_key || '=' || score || '/' || interest_type, ', ') from viewer_interests i join video_view_sessions s on s.id=i.session_id where s.session_key='${sk}'`);
  check('watching + clicking inside the mapped section yields a server-calculated interest score', /Spring offer=\d+\/offer/.test(sc) && /Pricing=/.test(sc), sc);
  check('no browser-supplied score exists anywhere in the stored interest', sql(`select count(*) from viewer_interests i join video_view_sessions s on s.id=i.session_id where s.session_key='${sk}' and score > 100`) === '0');
  check('no page errors in the editor', errors.length === 0, errors.join(' | '));

  const pass = results.filter(Boolean).length;
  console.log(`\n${pass}/${results.length} publish-flow checks passed`);
  await browser.close(); process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
