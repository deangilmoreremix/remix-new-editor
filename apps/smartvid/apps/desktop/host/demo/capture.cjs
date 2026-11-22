// Demo capture (host tool): screenshots of the feature screens shown in upstream's marketing images, taken from this app.
// usage: node capture.cjs <app url ending in /smartvid/> <out dir>
const { chromium } = require('playwright');
const APP = process.argv[2];
const OUT = process.argv[3];
const ipc = (ctx, channel, args = []) => ctx.request.post(new URL('ipc/invoke', APP).href, { data: { channel, args } }).then((r) => r.json());

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
  if (process.env.SESSION) await ctx.request.post(process.env.SESSION, { headers: { 'x-dev-bypass': 'local-dev-only' } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));

  // 1) Downloads — wait until the live download is at ~67% (real progress, speed and ETA from yt-dlp)
  await page.goto(APP, { waitUntil: 'networkidle' });
  // a live, throttled download (615 MiB at 8.4 MiB/s) so progress, speed and ETA are real yt-dlp output
  await ipc(ctx, 'download.startDownload', [`download_demo_design_${Date.now()}`, { url: `http://localhost:8113/design-${Date.now()}.mp4`, type: 'video', format: 'best', title: 'Design Review: Spring Product Launch' }]);
  const started = Date.now();
  for (;;) {
    const labels = await page.getByText(/^\d+(?:\.\d)?%$/).allInnerTexts().catch(() => []);
    const hit = labels.map((t) => parseFloat(t)).find((n) => n >= 66 && n <= 69);
    if (hit !== undefined) break;
    if (Date.now() - started > 150000) { console.log('progress window missed, capturing anyway'); break; }
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: `${OUT}/ours-downloads.png` });
  console.log('downloads captured');

  // 2) Transcript with four speakers
  await page.goto(`${APP}#/downloads/download_demo_interview/transcript`, { waitUntil: 'networkidle' });
  await page.getByText('Maya Chen').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/ours-transcript.png` });
  // 3) search pane
  const search = page.getByPlaceholder(/Search transcript/i);
  await search.screenshot({ path: `${OUT}/ours-search-field.png` }).catch(() => {});
  await page.screenshot({ path: `${OUT}/ours-search.png`, clip: { x: 720, y: 0, width: 720, height: 900 } });
  // 4) AI summary (Bullet Points)
  await page.getByText('Bullet Points', { exact: true }).first().click();
  await page.getByText('Research review bottlenecks').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/ours-ai-summary.png` });
  // 5) RSS subscriptions
  await page.goto(`${APP}#/subscriptions`, { waitUntil: 'networkidle' });
  await page.getByText('How We Cut Onboarding Time by 40%').first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/ours-rss.png` });
  console.log('errors:', errors.length ? errors.join(' | ') : 'none');
  await b.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 300)); process.exit(1); });
