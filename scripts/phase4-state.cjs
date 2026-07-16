const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5174/#/timeline', { waitUntil: 'domcontentloaded' });
  try { await page.waitForSelector('.track-type-dot', { timeout: 15000 }); } catch {}
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const ts = window.timelineState;
    if (!ts) return { err: 'no timelineState' };
    const tracks = ts.tracks || (ts.project && ts.project.tracks);
    return {
      hasTracks: !!tracks,
      trackSummary: (tracks||[]).map(t => ({ id: t.id, name: t.name, type: t.type, clip0Type: t.clips && t.clips[0] && t.clips[0].type }))
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch(e=>{console.error('ERR',e);process.exit(1);});
