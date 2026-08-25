const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const captured = [];
  await page.evaluateOnNewDocument(() => {
    window.__errs = [];
    window.addEventListener('error', (e) => {
      window.__errs.push('ERROR: ' + (e.message||'') + ' @ ' + (e.filename||'') + ':' + (e.lineno||''));
    });
    window.addEventListener('unhandledrejection', (e) => {
      const r = e.reason || {};
      window.__errs.push('REJECT: ' + (r.message||String(e.reason)) + (r.stack?(' | '+r.stack.split('\n').slice(0,3).join(' ')):''));
    });
    const origErr = console.error.bind(console);
    console.error = (...a) => { window.__errs.push('CONSOLE.ERROR: ' + a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ').slice(0,500)); origErr(...a); };
  });
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r=>setTimeout(r,1000));
  const res = await page.evaluate(async () => {
    try { await import('/lib/popcorn/plugins/text/popcorn.text.js'); return 'ok'; }
    catch(e){ return 'fail: '+(e&&e.message?e.message:String(e)); }
  });
  await new Promise(r=>setTimeout(r,500));
  const errs = await page.evaluate(() => window.__errs || []);
  console.log('IMPORT RESULT:', res);
  console.log('CAPTURED ERRORS ('+errs.length+'):');
  console.log(errs.join('\n'));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
