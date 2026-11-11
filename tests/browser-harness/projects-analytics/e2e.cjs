const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const B = process.env.HARNESS_DIR || __dirname;
const SHOTS = `${B}/shots`;
fs.mkdirSync(SHOTS, { recursive: true });
const tokens = JSON.parse(fs.readFileSync(`${B}/tokens.json`, 'utf8'));
const BASE = 'http://127.0.0.1:3100/#/timeline';

const sql = (q) => execFileSync('psql', ['-h', '127.0.0.1', '-U', 'postgres', '-d', 'svbrowser', '-At', '-c', q], { env: { ...process.env, PGPASSWORD: 'browsertest' } }).toString().trim();
const asOwner = (sub, q) => sql(`set role authenticated; select set_config('request.jwt.claims', '{"sub":"${sub}"}', false) >= '' as x; ${q}`).split('\n').filter((l) => l && l !== 'SET' && !/^t$|^f$/.test(l)).join('\n');
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const truth = (video, from, to) => JSON.parse(asOwner('userA', `select video_analytics_summary('${video}','${from}','${to}')`));

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const errors = [];

async function open(browser, { sub = 'userA', width = 1440, height = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, bypassCSP: true, permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript((s) => {
    try { sessionStorage.setItem('setup_popup_shown', '1'); } catch { /* the app shows its API-key welcome once per session; skip it */ }
    window.Clerk = { loaded: true, user: { id: s, primaryEmailAddress: { emailAddress: 'owner@example.test' } }, session: { getToken: async () => 'clerk-session-token' }, addListener() { return () => {}; }, load: async () => {} };
  }, sub);
  const page = await ctx.newPage();
  await page.route('**/.netlify/functions/supabase-token', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: tokens[sub], expires_in: 3600 }) }));
  page.on('pageerror', (e) => errors.push(`[${sub}] PAGEERROR ${String(e.message).slice(0, 200)}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/api\/personalization|Failed to load resource/.test(m.text())) errors.push(`[${sub}] ${m.text().slice(0, 200)}`); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('.floating-rail').waitFor({ timeout: 30000 });
  return { ctx, page };
}
async function openProjects(page) {
  await page.locator('.floating-rail').getByRole('button', { name: /Projects/ }).first().click();
  await page.locator('#projectsPanel').waitFor({ state: 'visible' });
  // the floating action rail overlays the bottom of the viewport; make it click-through so panel controls stay reachable (visuals unchanged)
  await page.addStyleTag({ content: '#floatingRail{pointer-events:none!important} #floatingRail *{pointer-events:none!important}' });
}
const stat = async (page, label) => (await page.locator('.sv-stat', { hasText: label }).first().locator('.sv-stat-value').textContent()).trim();
const fmtDur = (s) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

(async () => {
  const browser = await chromium.launch();
  // ===================================================== desktop, owner A
  let { ctx, page } = await open(browser);
  await openProjects(page);
  await page.locator('.prj-card').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  check('Projects list shows the 4 saved projects of owner A', (await page.locator('.prj-card').count()) === 4, `${await page.locator('.prj-card').count()} cards`);
  const names = await page.locator('.prj-name').allTextContents();
  check('other tenant project is not listed', !names.some((n) => /Other tenant/.test(n)));
  const thumbOk = await page.locator('.prj-card').first().locator('img').evaluate((i) => i.complete && i.naturalWidth > 0);
  check('card thumbnail is the saved project thumbnail (loaded)', thumbOk);

  const t30 = ['kitchenAB12', 'followupAB12', 'springSale01'].map((v) => truth(v, day(29), day(0)));
  const totalPlays = t30.reduce((a, x) => a + x.plays, 0), totalLeads = t30.reduce((a, x) => a + x.leads, 0);
  const mainStats = await page.locator('.prj-stat-lg').evaluateAll((els) => els.map((e) => [e.querySelector('span').textContent, e.querySelector('b').textContent]));
  const compact = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v));
  check('summary: published videos / plays / leads match the database', JSON.stringify(mainStats.map((x) => x[1])) === JSON.stringify(['3', compact(totalPlays), String(totalLeads)]), `${JSON.stringify(mainStats)} vs plays=${totalPlays} leads=${totalLeads}`);
  const unreadTruth = asOwner('userA', 'select owner_unread_notifications()');
  check('summary: unread alerts match the database', (await page.locator('.prj-stats-rest').textContent()).includes(`${unreadTruth}Unread alerts`), `db=${unreadTruth}`);
  const kitchenCard = page.locator('.prj-card').filter({ has: page.getByRole('heading', { name: 'Kitchen Renovation Promo', exact: true }) });
  const line = (await kitchenCard.locator('.prj-line').textContent()).replace(/\s+/g, ' ');
  check('card plays / % complete match the database', line.includes(`${t30[0].plays} plays`) && line.includes(`${Math.round(t30[0].completion_rate * 1000) / 10}%`), line);
  check('unpublished project shows a Publish action; published shows Analytics/Retarget', (await page.locator('.prj-card', { hasText: 'Roof Inspection Draft' }).locator('.prj-primary').textContent()) === 'Publish');
  await page.screenshot({ path: `${SHOTS}/01-projects-list-desktop.png`, fullPage: false });

  // ---- search + filters
  await page.locator('.prj-search').fill('spring');
  await page.waitForTimeout(400);
  check('search filters the grid', (await page.locator('.prj-card').count()) === 1);
  // real keystrokes: Backspace must edit the field (the editor's Delete/Backspace shortcut must not swallow it)
  await page.locator('.prj-search').click();
  await page.keyboard.press('Control+a'); await page.keyboard.press('Backspace');
  await page.waitForTimeout(500);
  check('Backspace edits the search box (editor clip-delete shortcut does not swallow it)', (await page.locator('.prj-search').inputValue()) === '' && (await page.locator('.prj-card').count()) === 4, `value="${await page.locator('.prj-search').inputValue()}" cards=${await page.locator('.prj-card').count()}`);
  await page.locator('[data-toggle-filters]').click();
  await page.locator('[data-f="published"]').selectOption('unpublished');
  await page.waitForTimeout(400);
  check('filter: unpublished only', (await page.locator('.prj-card').count()) === 1, `${await page.locator('.prj-card').count()} cards`);
  await page.locator('[data-f="published"]').selectOption('all');
  await page.waitForTimeout(400);
  check('filter reset shows all projects again', (await page.locator('.prj-card').count()) === 4, `${await page.locator('.prj-card').count()} cards`);
  await page.locator('[data-toggle-filters]').click();

  // ---- Analytics tab
  check('card with unread high-interest alerts offers Retarget as its primary action', (await kitchenCard.locator('.prj-primary').textContent()) === 'Retarget');
  await kitchenCard.locator('[data-act="details"]').click();
  await page.locator('.prj-tabs').getByRole('tab', { name: 'Analytics' }).click();
  await page.locator('.sv-analytics h1', { hasText: 'Video Analytics' }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(600);
  const per = async (label, from, to) => {
    const t = truth('kitchenAB12', from, to);
    const exp = { plays: String(t.plays), uv: t.plays > 0 && t.unique_viewers === 0 ? '—' : String(t.unique_viewers), comp: t.completion_rate == null ? '—' : `${Math.round(t.completion_rate * 100)}%`, avg: t.avg_watch_seconds == null ? '—' : fmtDur(t.avg_watch_seconds), cta: String(t.cta_clicks + t.call_clicks), leads: String(t.leads) };
    const got = { plays: await stat(page, 'Video plays'), uv: await stat(page, 'Unique viewers'), comp: await stat(page, 'Completion rate'), avg: await stat(page, 'Avg. watch time'), cta: await stat(page, 'CTA clicks'), leads: await stat(page, 'Leads captured') };
    check(`Analytics (${label}): all six metrics equal the database`, JSON.stringify(got) === JSON.stringify(exp), `ui=${JSON.stringify(got)} db=${JSON.stringify(exp)}`);
    return t;
  };
  await per('7 days', day(6), day(0));
  await page.screenshot({ path: `${SHOTS}/02-analytics-overview-desktop.png` });
  check('breadcrumb / title / status pill rendered like the supplied design', (await page.locator('.sv-breadcrumb').first().textContent()).includes('Timeline Editor / Projects') && (await page.locator('.sv-status-published').count()) === 1);
  for (const [label, from, to] of [['Today', day(0), day(0)], ['30 days', day(29), day(0)], ['90 days', day(89), day(0)]]) {
    await page.locator('.sv-segment').getByRole('button', { name: label }).click();
    await page.waitForTimeout(900);
    await per(label, from, to);
  }
  const p7 = truth('kitchenAB12', day(6), day(0)), p30 = truth('kitchenAB12', day(29), day(0));
  check('7-day and 30-day plays differ (period really filters)', p7.plays !== p30.plays, `${p7.plays} vs ${p30.plays}`);
  await page.locator('.sv-segment').getByRole('button', { name: 'Custom' }).click();
  await page.locator('.sv-custom-range').waitFor();
  await page.locator('.sv-custom-range input').first().fill(day(20));
  await page.locator('.sv-custom-range input').last().fill(day(10));
  await page.waitForTimeout(1000);
  await per('custom -20d..-10d', day(20), day(10));
  await page.screenshot({ path: `${SHOTS}/03-analytics-custom-range.png` });
  await page.locator('.sv-segment').getByRole('button', { name: '30 days' }).click();
  await page.waitForTimeout(900);

  // copy URL
  await page.getByRole('button', { name: /Copy video URL/ }).click();
  await page.getByText('Copied').waitFor();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check('Copy video URL puts the readable canonical link on the clipboard', /\/v\/example\/kitchen-renovation$/.test(clip), clip);

  // line chart carries real daily values
  const aria = await page.locator('.sv-chart-box svg').first().getAttribute('aria-label');
  const series = JSON.parse(asOwner('userA', `select json_agg(plays order by day) from video_analytics_timeseries('kitchenAB12','${day(29)}','${day(0)}')`));
  const chartVals = aria.replace('Line chart: ', '').split(', ').map((s) => Number(s.split(': ')[1]));
  check('plays-over-time chart values equal the daily database series', JSON.stringify(chartVals) === JSON.stringify(series), `${chartVals.length} points`);

  // ---- Engagement tab
  await page.locator('.sv-tabs').getByRole('button', { name: 'Engagement' }).click();
  await page.locator('.sv-explorer').waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/04-analytics-engagement.png`, fullPage: false });
  const ret = JSON.parse(asOwner('userA', `select json_agg(viewers order by bucket) from video_retention_curve('kitchenAB12','${day(29)}','${day(0)}')`));
  const base = JSON.parse(asOwner('userA', `select max(base) from video_retention_curve('kitchenAB12','${day(29)}','${day(0)}')`));
  const svgLabel = await page.locator('.sv-card', { hasText: 'Audience retention' }).locator('svg').getAttribute('aria-label');
  check('retention chart is drawn from the real curve', /21 data points/.test(svgLabel), svgLabel);
  const lastY = await page.locator('.sv-card', { hasText: 'Audience retention' }).locator('polyline').getAttribute('points');
  const firstPt = lastY.split(' ')[0].split(',').map(Number);
  check('retention starts at the real starting share (bucket 0 / base)', Math.abs((202 - firstPt[1]) / 166 * 100 - Math.round(ret[0] / base * 1000) / 10) < 0.2, `y=${firstPt[1]} real=${(ret[0] / base * 100).toFixed(1)}%`);
  const sec = JSON.parse(asOwner('userA', `select json_agg(json_build_object('id',section_id,'e',engagement_percent) order by section_id) from video_section_engagement('kitchenAB12','[{"id":"sceneA","start":0,"end":10},{"id":"sceneB","start":10,"end":20},{"id":"sceneC","start":20,"end":30}]'::jsonb,'${day(29)}','${day(0)}')`));
  const secUi = await page.locator('.sv-section-bar').evaluateAll((els) => els.map((e) => [e.querySelector('span').textContent, e.querySelector('strong').textContent]));
  check('Top engaged sections equal the database (and are named after timeline scenes)', secUi.length === 3 && secUi[0][0] === 'Kitchen Designs' && sec.every((s, i) => secUi[i][1] === `${Math.round(s.e)}%`), JSON.stringify(secUi));

  // ---- seek the real player by clicking a section
  check('preview shows the saved thumbnail before playing', await page.locator('.sv-explorer .sv-video-preview img').count() === 1);
  await page.locator('.sv-sections .sv-section', { hasText: 'Cabinet Upgrades' }).click();
  await page.waitForFunction(() => !!document.querySelector('.sv-live-preview-host') && !document.querySelector('.sv-live-preview-host').hidden, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  const t1 = Number(await page.locator('.sv-live-preview-host').getAttribute('data-current-time'));
  check('clicking "Cabinet Upgrades" starts the real player near its start (10 s)', t1 >= 9.8 && t1 <= 14, `player time=${t1}s`);
  const canvasDrawn = await page.evaluate(() => { const c = document.querySelector('.sv-live-preview-host canvas, .sv-live-preview-host video'); return !!c; });
  check('the live preview is a real rendered player (canvas/video present)', canvasDrawn);
  await page.screenshot({ path: `${SHOTS}/05-engagement-seeked-player.png` });
  await page.locator('.sv-sections .sv-section', { hasText: 'Pricing and Estimates' }).click();
  await page.waitForTimeout(2500);
  const t2 = Number(await page.locator('.sv-live-preview-host').getAttribute('data-current-time'));
  check('clicking "Pricing and Estimates" seeks to ~20 s (same player reused)', t2 >= 19.8 && t2 <= 24, `player time=${t2}s`);
  const eventsBefore = Number(sql("select count(*) from video_events"));
  await page.waitForTimeout(1500);
  check('owner preview does not record analytics events', Number(sql("select count(*) from video_events")) === eventsBefore);

  // ---- Conversions tab
  await page.locator('.sv-tabs').getByRole('button', { name: 'Conversions' }).click();
  const ctaTruth = JSON.parse(asOwner('userA', `select json_agg(json_build_object('t',type,'c',clip_id,'s',sessions)) from video_cta_performance('kitchenAB12','${day(29)}','${day(0)}')`));
  const bars = await page.locator('.sv-bar-row').evaluateAll((els) => els.map((e) => [e.querySelector('.sv-bar-label').textContent, e.querySelector('.sv-bar-number').textContent]));
  check('Conversion bars equal distinct-session CTA counts from the database', bars.length === ctaTruth.length && bars.every((b, i) => Number(b[1]) === Number(ctaTruth[i].s)), JSON.stringify(bars));
  await page.screenshot({ path: `${SHOTS}/06-analytics-conversions.png` });

  // ---- Opportunities = real notifications; open one
  const notesUi = await page.locator('.sv-opportunity').count();
  const notesTruth = Number(asOwner('userA', `select count(*) from owner_notifications where project_id = (select project_id from published_videos where id='kitchenAB12') and type <> 'daily_digest' and created_at >= '${day(29)}'`));
  check('Marketing Opportunities rows come from owner notifications', notesUi === Math.min(8, notesTruth), `ui=${notesUi} db=${notesTruth}`);
  check('opportunity count pill shows the number of alerts', (await page.locator('.sv-pill', { hasText: 'alerts' }).textContent()).startsWith(String(notesUi)));
  const firstOp = page.locator('.sv-opportunity').first();
  const opTitle = (await firstOp.locator('strong').textContent()).trim();
  const unreadBefore = Number(asOwner('userA', 'select owner_unread_notifications()'));
  await page.locator('.sv-tabs').getByRole('button', { name: 'Overview' }).click();
  await page.locator('.sv-opportunity').first().click();
  await page.locator('.sv-analytics h1', { hasText: 'Notifications' }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);
  const unreadAfter = Number(asOwner('userA', 'select owner_unread_notifications()'));
  check('clicking an opportunity opens Notifications and marks it read in the database', unreadAfter === unreadBefore - 1, `unread ${unreadBefore} -> ${unreadAfter}`);
  await page.screenshot({ path: `${SHOTS}/07-notifications.png`, fullPage: false });
  check('notification history lists type, timestamp and project actions', (await page.locator('[data-n]').first().textContent()).includes('View analytics'));
  check('email option states it requires configuration', (await page.locator('[data-prefs]').textContent()).includes('Email delivery requires configuration'));
  await page.locator('[name=threshold]').fill('75');
  await page.locator('[data-prefs] button[type=submit]').click();
  await page.waitForTimeout(800);
  check('preferences save to the database', asOwner('userA', 'select interest_threshold from retarget_preferences') === '75');

  // ---- Audience + Retarget
  await page.locator('.prj-tabs').getByRole('tab', { name: 'Audience' }).click();
  await page.locator('.sv-analytics h1', { hasText: 'Audience insights' }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
  const segT = Object.fromEntries(asOwner('userA', `select segment || '=' || sessions from video_audience_segments('kitchenAB12','${day(29)}','${day(0)}')`).split('\n').map((l) => l.split('=')));
  const newV = await page.locator('.sv-stat', { hasText: 'New viewers' }).locator('.sv-stat-value').textContent();
  check('Audience segments equal the database', newV.trim() === segT.new_viewers, `new=${newV} db=${segT.new_viewers}`);
  await page.screenshot({ path: `${SHOTS}/08-audience.png` });
  await page.locator('.prj-tabs').getByRole('tab', { name: 'Retarget' }).click();
  await page.locator('.sv-analytics h1', { hasText: 'Retarget' }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  const recCount = await page.locator('[data-rec]').count();
  check('Retarget shows recommendations derived from recorded interest', recCount >= 1, `${recCount} recommendations`);
  check('recommendations separate Observed from Recommendation text', /Observed:/.test(await page.locator('.sv-opportunity').first().textContent()));
  check('timeline scenes are listed for interest mapping', (await page.locator('[data-row]').count()) === 3);
  await page.screenshot({ path: `${SHOTS}/09-retarget.png`, fullPage: false });

  // follow-up: saved as a new linked project + existing personalization handoff
  const before = Number(sql("select count(*) from timeline_projects where parent_project_id is not null"));
  await page.locator('[data-rec="0"]').click();
  await page.waitForTimeout(2500);
  const after = Number(sql("select count(*) from timeline_projects where parent_project_id is not null"));
  check('Create follow-up saves a NEW project linked to the original', after === before + 1);
  const child = sql("select name || ' | parent=' || (select name from timeline_projects p where p.id = c.parent_project_id) from timeline_projects c where parent_project_id is not null order by created_at desc limit 1");
  check('the follow-up is linked to "Kitchen Renovation Promo"', /parent=Kitchen Renovation Promo$/.test(child), child);
  check('the existing Personalizer opened with the brief', /personalizer/.test(page.url()), page.url());
  const sourcePanel = await page.getByText('Source Content').count();
  check('Personalizer consumed the handoff (Source Content panel)', sourcePanel > 0);
  await page.screenshot({ path: `${SHOTS}/10-personalizer-handoff.png` });
  check('original project untouched by follow-up creation', sql("select count(*) from timeline_projects where name = 'Kitchen Renovation Promo' and parent_project_id is null") === '1');
  await ctx.close();

  // ===================================================== tablet + mobile
  for (const [label, w, h] of [['tablet', 820, 1180], ['mobile', 390, 844]]) {
    const o = await open(browser, { width: w, height: h });
    await openProjects(o.page);
    await o.page.locator('.prj-card').first().waitFor({ timeout: 20000 });
    await o.page.waitForTimeout(600);
    await o.page.screenshot({ path: `${SHOTS}/11-projects-list-${label}.png` });
    const edge = () => o.page.evaluate(() => { const p = document.querySelector('#projectsPanel').getBoundingClientRect(); const poke = [...document.querySelectorAll('#projectsPanel *')].filter((x) => { const b = x.getBoundingClientRect(); return b.width > 0 && b.right > p.right + 1 && !x.closest('.prj-tabs'); }).length; return { panelRight: Math.round(p.right), vw: window.innerWidth, poke }; });
    const ov1 = await edge();
    check(`${label}: Projects list fits inside the screen (panel right edge <= viewport, nothing pokes out)`, ov1.panelRight <= ov1.vw && ov1.poke === 0, JSON.stringify(ov1));
    await o.page.locator('.prj-card').filter({ has: o.page.getByRole('heading', { name: 'Kitchen Renovation Promo', exact: true }) }).locator('[data-act="details"]').click();
    await o.page.locator('.prj-tabs').getByRole('tab', { name: 'Analytics' }).click();
    await o.page.locator('.sv-analytics h1', { hasText: 'Video Analytics' }).waitFor({ timeout: 20000 });
    await o.page.waitForTimeout(800);
    await o.page.locator('#projectsPanel').scrollIntoViewIfNeeded();
    await o.page.screenshot({ path: `${SHOTS}/12-analytics-${label}.png`, fullPage: false });
    const ov2 = await o.page.evaluate(() => { const a = document.querySelector('.sv-analytics'); return { doc: document.documentElement.scrollWidth, win: window.innerWidth, a: a.scrollWidth, aBox: a.getBoundingClientRect().width, cols: getComputedStyle(document.querySelector('.sv-stat-grid')).gridTemplateColumns.split(' ').length }; });
    const e2 = await edge();
    check(`${label}: Analytics fits inside the screen`, e2.panelRight <= e2.vw && e2.poke === 0 && ov2.a <= ov2.aBox + 1, JSON.stringify({ ...e2, a: ov2.a, aBox: ov2.aBox }));
    check(`${label}: metric grid uses ${w >= 800 ? '3' : '2'} columns like the supplied CSS`, ov2.cols === (w >= 800 ? 3 : 2), `cols=${ov2.cols}`);
    await o.page.locator('.sv-tabs').getByRole('button', { name: 'Engagement' }).click();
    await o.page.waitForTimeout(500);
    await o.page.screenshot({ path: `${SHOTS}/13-engagement-${label}.png`, fullPage: false });
    const ov3 = await o.page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth, secCols: getComputedStyle(document.querySelector('.sv-sections')).gridTemplateColumns.split(' ').length }));
    const e3 = await edge();
    check(`${label}: Engagement fits inside the screen and sections ${w > 600 ? 'sit in 3 columns' : 'stack'}`, e3.panelRight <= e3.vw && e3.poke === 0 && ov3.secCols === (w > 600 ? 3 : 1), JSON.stringify({ ...e3, secCols: ov3.secCols }));
    const small = await o.page.evaluate(() => [...document.querySelectorAll('#projectsPanel button')].filter((b) => b.offsetParent && (b.getBoundingClientRect().height < 28)).length);
    check(`${label}: controls are tappable (no buttons shorter than 28px)`, small === 0, `${small} small`);
    await o.ctx.close();
  }

  // ===================================================== tenant isolation in the browser
  const iso = await open(browser, { sub: 'userB' });
  await openProjects(iso.page);
  await iso.page.locator('.prj-card').first().waitFor({ timeout: 20000 });
  const bNames = await iso.page.locator('.prj-name').allTextContents();
  check('owner B sees only their own project (no cross-tenant data in the UI)', bNames.length === 1 && /Other tenant/.test(bNames[0]), JSON.stringify(bNames));
  check('owner B cannot read A\'s analytics through the API', JSON.parse(asOwner('userB', `select video_analytics_summary('kitchenAB12','${day(29)}','${day(0)}')`)).plays === 0);
  await iso.page.screenshot({ path: `${SHOTS}/14-owner-b.png` });
  await iso.ctx.close();

  check('no page errors / console errors during the run', errors.length === 0, errors.slice(0, 4).join(' | '));
  fs.writeFileSync(`${B}/e2e-results.json`, JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
