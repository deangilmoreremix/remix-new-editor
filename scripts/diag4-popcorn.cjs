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

  await page.goto('http://localhost:3000/popcorndebug.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3000));

  const result = await page.evaluate(() => window.__popcornResult || { status: 'none' });
  console.log('=== POPCORN DEBUG RESULT ===');
  console.log(JSON.stringify(result, null, 2));
  console.log('=== CONSOLE LOGS ===');
  console.log(logs.join('\n').slice(0, 4000));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
