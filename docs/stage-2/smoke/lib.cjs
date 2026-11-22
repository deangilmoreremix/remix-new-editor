const { chromium } = require('playwright');
exports.SP = (process.env.SMOKE_DIR || __dirname) + '/';
exports.open = async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const pg = await b.newPage({ viewport: { width: 1600, height: 950 } });
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CON', m.text().slice(0, 200)); });
  pg.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 300)));
  await pg.addInitScript(() => { try { sessionStorage.setItem('setup_popup_shown', '1'); } catch {} });
  await pg.goto('http://127.0.0.1:' + (process.env.SMOKE_PORT || 3100) + '/#/timeline', { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.pm-window', { timeout: 90000 });
  await pg.waitForTimeout(2500);
  await pg.evaluate(() => [...document.querySelectorAll('.pm-bottombar__btn')].find((x) => x.innerText === 'New Project').click());
  await pg.waitForTimeout(800);
  await pg.fill('input[placeholder="Project name..."]', 'smoke');
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText === 'Create').click());
  await pg.waitForTimeout(6000);
  return { b, pg };
};
