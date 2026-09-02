const puppeteer = require('puppeteer');

(async () => {
  const consoleErrors = [];
  const pageErrors = [];
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    try {
      await page.goto('http://localhost:5191/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      console.log('NAV-WARN:', e.message);
    }

    await new Promise((r) => setTimeout(r, 4000));

    // Scroll fully to trigger lazy IntersectionObserver sections
    try {
      await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        for (let i = 0; i < 25; i++) {
          window.scrollBy(0, window.innerHeight);
          await sleep(150);
        }
        window.scrollTo(0, document.body.scrollHeight);
      });
    } catch (e) {
      console.log('SCROLL-WARN:', e.message);
    }

    await new Promise((r) => setTimeout(r, 4000));

    const result = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('.app-card-thumb img'));
      return {
        hasGrid: !!document.querySelector('#apps-grid'),
        cardCount: document.querySelectorAll('[data-testid="app-card"]').length,
        imgTotal: imgs.length,
        imgLoaded: imgs.filter((i) => i.naturalWidth > 0).length,
        imgBroken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
        sampleSrc: imgs.slice(0, 5).map((i) => i.getAttribute('src')),
      };
    });

    console.log('RESULT:', JSON.stringify(result, null, 2));
    console.log('CONSOLE-ERRORS:', JSON.stringify(consoleErrors, null, 2));
    console.log('PAGE-ERRORS:', JSON.stringify(pageErrors, null, 2));

    try {
      await page.screenshot({ path: '/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor/.kilo/worktrees/coral-cemetery/landing_verify.png', fullPage: false });
      console.log('SCREENSHOT: saved');
    } catch (e) {
      console.log('SCREENSHOT-WARN:', e.message);
    }
  } catch (e) {
    console.log('FATAL:', e.message);
  } finally {
    if (browser) await browser.close();
  }
})();
