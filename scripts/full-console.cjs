const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const all = [];
  page.on('console', (m) => all.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => all.push(`[PAGEERROR] ${e.stack || e.message}`));

  let ok = false;
  for (let i = 0; i < 12; i++) {
    try {
      const r = await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (r && r.status() < 500) { ok = true; break; }
    } catch (e) { /* retry */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!ok) { console.log('COULD NOT REACH SERVER'); await browser.close(); return; }
  await new Promise((r) => setTimeout(r, 4000));

  const body = await page.evaluate(() => document.body.innerHTML.slice(0, 1200));
  console.log('===== FULL CONSOLE (' + all.length + ') =====');
  console.log(all.join('\n'));
  console.log('\n===== BODY HTML (first 1200 chars) =====');
  console.log(body);

  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
