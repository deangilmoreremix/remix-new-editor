const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push('PAGEERROR: ' + err.message));

  await page.goto('http://localhost:5174/#/timeline', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);

  const info = await page.evaluate(() => {
    const app = document.querySelector('#app') || document.body;
    return {
      bodyChildCount: document.body.children.length,
      appHtmlLen: (document.querySelector('#app')?.innerHTML || '').length,
      hasTrackRow: !!document.querySelector('.track-row'),
      hasTimelineShell: !!document.querySelector('.timeline-shell'),
      headingText: (document.querySelector('h1')?.textContent || '') + ' | ' + (document.querySelector('h2')?.textContent || ''),
      bodyTextSnippet: document.body.innerText.slice(0, 400),
      contentAreaHtml: (document.querySelector('#contentArea, [data-content], .content-area')?.innerHTML || 'NO CONTENT AREA').slice(0, 200)
    };
  });

  console.log('=== PAGE INFO ===');
  console.log(JSON.stringify(info, null, 2));
  console.log('=== CONSOLE LOGS (last 40) ===');
  console.log(logs.slice(-40).join('\n'));
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
