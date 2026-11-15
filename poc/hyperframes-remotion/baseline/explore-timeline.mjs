// Capture-only: dismiss first-run modal, screenshot, dump visible controls. No project data is written.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const out = 'out/baseline'; mkdirSync(out, { recursive: true });
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
await p.goto('http://127.0.0.1:3100/#/timeline', { waitUntil: 'load' });
await p.waitForTimeout(12000);
await p.screenshot({ path: `${out}/timeline-desktop-modal.png` });
let closed = false;
for (const how of ['click', 'escape']) {
  if (how === 'click') await p.mouse.click(883, 75); else await p.keyboard.press('Escape');
  await p.waitForTimeout(1200);
  closed = !(await p.evaluate(() => document.body.innerText.includes('set up your API keys')));
  if (closed) { console.log('modal dismissed via', how); break; }
}
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/timeline-desktop.png` });
const dump = await p.evaluate(() => ({
  modalClosed: !document.body.innerText.includes('set up your API keys'),
  buttons: [...document.querySelectorAll('button')].filter((e) => e.offsetParent).map((e) => (e.getAttribute('aria-label') || e.title || e.textContent).trim().replace(/\s+/g, ' ').slice(0, 40)).filter(Boolean),
  headings: [...document.querySelectorAll('h1,h2,h3')].map((e) => e.textContent.trim().slice(0, 50)),
}));
writeFileSync(`${out}/controls.json`, JSON.stringify({ closedModalClicked: closed, ...dump }, null, 1));
console.log('closed', closed, 'modalClosed', dump.modalClosed, 'buttons', dump.buttons.length, dump.buttons.slice(0, 40).join(' | '));
await b.close();
