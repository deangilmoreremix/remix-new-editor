const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push('PAGEERROR: ' + err.message + ' | ' + (err.stack||'').split('\n')[1]));

  await page.goto('http://127.0.0.1:5174/#/timeline', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  const dom = await page.evaluate(() => {
    const app = document.querySelector('#app');
    return {
      appLen: app ? app.innerHTML.length : 0,
      classes: app ? app.className : '',
      childTags: app ? Array.from(app.children).map(c => c.tagName + '.' + c.className).slice(0,8) : [],
      hasTrackRow: !!document.querySelector('.track-row'),
      hasTrackRows: !!document.querySelector('#trackRows'),
      timelineText: (document.querySelector('#contentArea, [class*="content"], .content-area')?.innerText || '').slice(0,300),
      allButtons: document.querySelectorAll('button').length,
      bodyText: document.body.innerText.slice(0, 200)
    };
  });

  console.log('DOM:', JSON.stringify(dom, null, 2));
  console.log('=== LOGS ===');
  console.log(logs.slice(-25).join('\n'));
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
