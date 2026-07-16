const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`[pageerror] ${err.stack || err.message}`));
  page.on('requestfailed', (req) => logs.push(`[requestfailed] ${req.url()} :: ${req.failure() && req.failure().errorText}`));

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 4000));

  const diag = await page.evaluate(() => ({
    popcornType: typeof window.Popcorn,
    jQuery: typeof window.jQuery,
    appHtmlLen: (document.getElementById('app')?.innerHTML || '').length,
  }));

  console.log('=== DIAG ===');
  console.log(JSON.stringify(diag, null, 2));
  console.log('=== ALL CONSOLE LOGS (' + logs.length + ') ===');
  console.log(logs.join('\n'));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
