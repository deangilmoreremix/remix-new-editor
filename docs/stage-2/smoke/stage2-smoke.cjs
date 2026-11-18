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
  const shot = async (n) => { if (process.env.SMOKE_SHOTS) await pg.screenshot({ path: SP + n + '.png' }); };

  // --- auto-key on: edit position X at t=0 and at t~50% -> two keys in the dopesheet
  await pg.locator('[data-testid=auto-key]').click();
  assert((await pg.locator('[data-testid=auto-key]').innerText()).includes('on'), 'auto-key toggle turns on');
  // timeline playhead: click on the ruler (about 50 px per second at this zoom); the clip is 6 s long
  // the ruler is at y~517; tick 0 is at x~499 and 5 s at x~748 for the 1600x950 viewport
  const seek = async (sec) => { await pg.mouse.click(499 + sec * 49.8, 517); await pg.waitForTimeout(500); };
  await seek(0.2);
  await pg.locator('[data-testid=anim-x]').fill('-30');
  await pg.waitForTimeout(300);
  await seek(3);
  await pg.locator('[data-testid=anim-x]').fill('30');
  await pg.waitForTimeout(300);
  await pg.locator('[data-testid=anim-scale]').fill('1.5');
  await pg.waitForTimeout(300);
  await pg.locator('[data-testid=dopesheet-toggle]').click();
  const kx = await pg.locator('[data-testid^=dopesheet-key-x-]').count();
  const ks = await pg.locator('[data-testid^=dopesheet-key-scale-]').count();
  console.log('dopesheet keys x:', kx, 'scale:', ks);
  assert(kx === 2 && ks === 1, 'auto-key created 2 keys on X and 1 on scale (multi-property)');
  await shot('s20a');

  // --- preview applies the keys: the viewer video transform differs at the two key times and matches the model
  const tf = async () => pg.evaluate(() => { const v = [...document.querySelectorAll('video')].find((e) => e.style.transform); return v ? v.style.transform : null; });
  const tMid = await tf();
  await seek(0.2);
  const t0 = await tf();
  console.log('transform at start:', t0, '| at middle:', tMid);
  assert(t0 && tMid && t0 !== tMid && /translate\(-?\d/.test(t0) && parseFloat((/translate\((-?[\d.]+)%/.exec(t0) || [])[1]) < 0 && parseFloat((/translate\((-?[\d.]+)%/.exec(tMid) || [])[1]) > 25, 'preview transform follows the keys (x about -30% near the start, about 30% at 3 s)');
  // a point between the keys is eased between (not equal to either end)
  await seek(1.6);
  const tq = await tf();
  const xq = parseFloat((/translate\((-?[\d.]+)%/.exec(tq || '') || [])[1]);
  console.log('transform at quarter:', tq);
  assert(xq > -30 && xq < 30, 'between the keys the value is interpolated (x=' + xq + ')');

  // --- curve editor: select key 1 of X, open Curve, switch to bezier, drag a handle
  await pg.locator('[data-testid=dopesheet-key-x-0]').click({ force: true });
  await pg.waitForTimeout(200);
  await pg.locator('[data-testid=curve-open]').click();
  await pg.waitForSelector('[data-testid=curve-editor]');
  await pg.locator('[data-testid=curve-mode-bezier]').click();
  await pg.waitForTimeout(200);
  const pathBefore = await pg.locator('[data-testid=curve-path]').getAttribute('points');
  const numBefore = await pg.locator('[data-testid=curve-num-0]').inputValue();
  const h = await pg.locator('[data-testid=curve-handle-1]').boundingBox();
  console.log('handle box', JSON.stringify(h), await pg.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + ':' + (e.getAttribute('data-testid') || '') : null; }, [h.x + h.width / 2, h.y + h.height / 2]));
  await pg.evaluate(() => { window.__ev = []; ['pointerdown', 'pointermove', 'pointerup'].forEach((n) => window.addEventListener(n, (e) => window.__ev.push(n), true)); });
  await pg.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await pg.mouse.down(); await pg.mouse.move(h.x + h.width / 2 + 40, h.y + h.height / 2 - 60, { steps: 6 }); await pg.mouse.up();
  await pg.waitForTimeout(300);
  console.log('events', JSON.stringify(await pg.evaluate(() => window.__ev.slice(0, 12))));
  const pathAfter = await pg.locator('[data-testid=curve-path]').getAttribute('points');
  const num = await pg.locator('[data-testid=curve-num-0]').inputValue();
  console.log('bezier x1 before/after drag:', numBefore, num);
  assert(pathBefore !== pathAfter && num !== numBefore, 'dragging a bezier handle changes the curve and its control point');
  await shot('s20b');
  await pg.locator('[data-testid=curve-mode-spring]').click();
  await pg.locator('[data-testid=curve-spring-tension]').fill('300');
  await pg.locator('[data-testid=curve-spring-friction]').fill('20');
  await pg.waitForTimeout(300);
  const ptsSpring = (await pg.locator('[data-testid=curve-path]').getAttribute('points')).split(' ').map((p) => parseFloat(p.split(',')[1]));
  assert(Math.min(...ptsSpring) < ptsSpring[ptsSpring.length - 1] - 3, 'spring curve overshoots (drawn above the end value)');
  // the preview now uses the spring easing: value at the quarter is not the bezier one
  await seek(1.6);
  const tq2 = await tf();
  console.log('quarter after spring:', tq2);
  assert(tq2 !== tq, 'changing the easing changes the preview');
  await pg.locator('[data-testid=curve-close]').click();

  // --- motion modifier: sway is applied, deterministic (same time -> same transform), and removable
  await pg.locator('[data-testid=modifier-add]').selectOption('sway');
  await pg.waitForTimeout(400);
  assert(await pg.locator('[data-testid=modifier-sway]').count() === 1, 'a sway modifier was added');
  await seek(1.0);
  const a1 = await tf();
  await seek(4.0);
  await seek(1.0);
  const a2 = await tf();
  console.log('sway at 30%:', a1, '|', a2);
  assert(a1 === a2 && /rotate\((?!0deg)/.test(a1), 'modifier is deterministic and rotates the clip');
  await pg.locator('[aria-label="Remove Sway"]').click();
  await pg.waitForTimeout(400);
  assert(await pg.locator('[data-testid=modifier-sway]').count() === 0, 'modifier removed (non-destructive)');
  await shot('s20c');

  // --- the Transform section slider edits the same unified keys
  await pg.locator('[data-testid=transform-x]').fill('10');
  await pg.waitForTimeout(300);
  console.log('after transform slider (auto-key on):', await tf());
  await pg.locator('[data-testid=auto-key]').click();
  console.log('DONE');
  await b.close();
})().catch((e) => { console.log('ERR', e); process.exit(1); });
