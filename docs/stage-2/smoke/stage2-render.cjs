// Renders a real export of an animated clip through the Export tab (Remotion web renderer) and saves it as OUT (default SMOKE_DIR/s2-export.mp4).
// Run: start 'npx vite --port 3127', put a small clipA.mp4 (6 s) in SMOKE_DIR (default: this folder), then
//   SMOKE_PORT=3127 SMOKE_DIR=/path CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux/chrome node stage2-smoke.cjs
const { open, SP } = require('./lib.cjs');
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => {
  const { b, pg } = await open();
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText === 'EDIT').click());
  await pg.waitForTimeout(3000);
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Add\s*video/i.test(x.innerText)).click());
  await pg.waitForSelector('[data-testid=add-video-file]', { state: 'attached', timeout: 8000 });
  await pg.setInputFiles('[data-testid=add-video-file]', SP + 'clipA.mp4');
  await pg.waitForTimeout(5000);
  await pg.keyboard.press('Escape');
  await pg.evaluate(() => [...document.querySelectorAll('.element-modal__backdrop button')].find((x) => /×|×|close/i.test(x.innerText + x.getAttribute('aria-label')))?.click());
  await pg.waitForTimeout(500);
  await pg.locator('[title="clipA.mp4"]').first().dblclick();
  await pg.waitForTimeout(1500);
  await pg.locator('[data-testid=insert-edit]').click();
  await pg.waitForTimeout(1000);
  await pg.locator('.clip-card').first().click();
  await pg.waitForTimeout(400);
  const toggle = pg.locator('[title="Show inspector"]');
  if (await toggle.count()) await toggle.first().click();
  await pg.waitForSelector('[data-testid=clip-animation]', { timeout: 8000 });
  assert(true, 'Animation section is in the clip inspector');
  // animate: x key -30% at 0.2 s and +30% at 3 s (linear), nothing else
  await pg.locator('[data-testid=auto-key]').click();
  const seek = async (sec) => { await pg.mouse.click(499 + sec * 49.8, 517); await pg.waitForTimeout(500); };
  await seek(0.2);
  await pg.locator('[data-testid=anim-x]').fill('-30');
  await pg.waitForTimeout(300);
  await seek(3);
  await pg.locator('[data-testid=anim-x]').fill('30');
  await pg.waitForTimeout(500);
  console.log('keys set; going to EXPORT');
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText === 'EXPORT').click());
  await pg.waitForTimeout(2000);
  const qa = pg.locator('[data-testid=export-auto-qa]'); if (await qa.count() && await qa.isChecked()) await qa.uncheck();
  const dl = pg.waitForEvent('download', { timeout: 100000 }).catch((e) => ({ err: String(e) }));
  await pg.locator('.export-settings__render-btn').click();
  let last = '';
  for (let i = 0; i < 45; i++) {
    await pg.waitForTimeout(2000);
    const txt = await pg.evaluate(() => (document.querySelector('.render-progress') || document.querySelector('.export-tab'))?.innerText?.replace(/\s+/g, ' ').slice(0, 200) || '');
    if (txt !== last) { console.log('progress:', txt); last = txt; }
    if (/complete|failed|error|Download/i.test(txt) && !/Rendering|Encoding|%/.test(txt)) break;
    if ((await Promise.race([dl, new Promise((r) => setTimeout(() => r(null), 10))])) ) break;
  }
  const d = await dl;
  if (d && d.saveAs) { const out = process.env.OUT || (SP + 's2-export.mp4'); await d.saveAs(out); console.log('SAVED', out); } else console.log('NO DOWNLOAD', JSON.stringify(d));
  await b.close();
})().catch((e) => { console.log('ERR', e); process.exit(1); });
