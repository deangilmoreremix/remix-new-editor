/**
 * Timeline Editor regression smoke test.
 *
 * Guards against the production "Cannot access 'TLEditor' before initialization"
 * TDZ crash (and the missing-CSS 404) silently returning. Run after a build:
 *
 *   node scripts/timeline-smoke.cjs
 *
 * Requires `dist/` to be built and a preview server reachable at BASE_URL.
 * Set BASE_URL to point at a running `npm run preview` (default :3000).
 */
const puppeteer = require('puppeteer');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ROUTE = `${BASE_URL}/#/timeline`;

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Ignore expected offline/network noise (placeholder images, no backend).
    if (/ERR_CONNECTION_CLOSED|net::ERR|500|placeholder\.com/i.test(text)) return;
    errors.push(text);
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (/placeholder\.com|localhost:3001|localhost:8000|localhost:8888/.test(url)) return;
    failedRequests.push(`${req.failure()?.errorText} ${url}`);
  });
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + (err.stack || err.message)));

  await page.goto(ROUTE, { waitUntil: 'domcontentloaded', timeout: 45000 });
  // Give the dynamic import + mount time to settle.
  await new Promise((r) => setTimeout(r, 6000));

  const dom = await page.evaluate(() => {
    const c = document.querySelector('#content-area');
    return {
      text: c ? c.innerText : '',
      hasEditor: !!(c && /AI Video Editor/.test(c.innerText)),
    };
  });

  await browser.close();

  const fatal = errors.filter((e) =>
    /TLEditor|before initialization|Failed to load timeline|timeline-editor-page\.css/i.test(e)
  );

  console.log('--- Timeline smoke test ---');
  console.log('editor mounted :', dom.hasEditor);
  console.log('console errors :', errors.length, errors.slice(0, 5));
  console.log('failed reqs    :', failedRequests.length, failedRequests.slice(0, 5));

  if (!dom.hasEditor) {
    console.error('FAIL: timeline editor did not mount (no "AI Video Editor").');
    process.exit(1);
  }
  if (fatal.length) {
    console.error('FAIL: fatal timeline error(s):\n' + fatal.join('\n'));
    process.exit(1);
  }
  console.log('PASS: timeline editor mounts cleanly.');
  process.exit(0);
}

main().catch((e) => {
  console.error('SMOKE TEST ERROR:', e);
  process.exit(1);
});
