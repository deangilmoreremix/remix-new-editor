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

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const out = await page.evaluate(async () => {
    const mod = await import('/src/lib/__probe.js');
    return await mod.probe();
  });

  console.log('=== PROBE RESULT ===');
  console.log(out.join('\n'));
  console.log('=== pageerrors ===');
  console.log(logs.filter(l => l.startsWith('[pageerror]')).join('\n').slice(0, 2000));

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
