// Run: vite dev server on :3100, put cuts.mp4 (see stage4-lib-browser.cjs) in SMOKE_DIR, then `node stage4-ui-smoke.cjs`.
// Drives the real CineGen page (#/timeline): imports the clip, scene browser, audio tab (master volume, EQ, meters), media health tab.
const { open, SP } = require('../../stage-1/smoke/lib.cjs');
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => {
  const { b, pg } = await open();
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText === 'EDIT').click());
  await pg.waitForTimeout(3000);
  await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Add\s*video/i.test(x.innerText)).click());
  await pg.waitForSelector('[data-testid=add-video-file]', { state: 'attached', timeout: 8000 });
  await pg.setInputFiles('[data-testid=add-video-file]', SP + 'cuts.mp4');
  await pg.waitForTimeout(5000);
  await pg.keyboard.press('Escape');
  await pg.evaluate(() => [...document.querySelectorAll('.element-modal__backdrop button')].find((x) => /×|close/i.test(x.innerText + x.getAttribute('aria-label')))?.click());
  await pg.waitForTimeout(500);

  await pg.locator('[data-testid=s4-open]').click({ force: true });
  // ---- scenes
  await pg.locator('[data-testid=s4-tab-scenes]').click();
  await pg.waitForTimeout(500);
  const opts = await pg.locator('[data-testid=scene-asset] option').allInnerTexts();
  console.log('assets in scene picker:', opts);
  assert(opts.some((o) => /cuts\.mp4/.test(o)), 'imported clip is in the scene browser asset list');
  await pg.locator('[data-testid=scene-detect]').click();
  await pg.waitForTimeout(8000); console.log('scene msg early:', await pg.locator('[data-testid=scene-msg]').innerText().catch(() => '(none)'));
  await pg.waitForSelector('[data-testid=scene-card]', { timeout: 60000 });
  await pg.waitForFunction(() => /scenes? found/.test(document.querySelector('[data-testid=scene-msg]')?.textContent || ''), null, { timeout: 60000 });
  const cards = await pg.locator('[data-testid=scene-card]').count();
  console.log('scene msg:', await pg.locator('[data-testid=scene-msg]').innerText());
  assert(cards === 4, 'scene browser lists 4 scenes for the 3-cut clip (got ' + cards + ')');
  const imgs = await pg.locator('[data-testid=scene-card] img').count();
  assert(imgs === 4, 'every scene card has a thumbnail');
  // tag scene 2 and search
  await pg.locator('[data-testid=scene-card]').nth(1).locator('input[aria-label="Scene tags"]').fill('sunset, wide');
  await pg.locator('[data-testid=scene-search]').fill('tag:sunset');
  assert((await pg.locator('[data-testid=scene-card]').count()) === 1, 'search tag:sunset finds the tagged scene only');
  await pg.locator('[data-testid=scene-search]').fill('0:03');
  assert((await pg.locator('[data-testid=scene-card]').count()) === 1, 'search by time 0:03 finds the scene that contains it');
  await pg.locator('[data-testid=scene-search]').fill('');
  // frame inspector
  await pg.locator('[data-testid=scene-card] [role=button]').nth(1).click();
  await pg.waitForSelector('[data-testid=frame-inspector]');
  const t0 = await pg.locator('[data-testid=frame-time]').innerText();
  await pg.locator('button[aria-label="Next frame"]').click(); await pg.locator('button[aria-label="Next frame"]').click();
  const t1 = await pg.locator('[data-testid=frame-time]').innerText();
  await pg.locator('button[aria-label="Previous frame"]').click();
  const t2 = await pg.locator('[data-testid=frame-time]').innerText();
  console.log('frame stepping:', t0, '->', t1, '->', t2, '(clip is 25 fps)');
  const fr = (s) => Number(/frame (\d+)/.exec(s)[1]);
  assert(/frame 50\b/.test(t0) && /frame 52\b/.test(t1), 'frame numbers use the clip\'s real frame rate (25 fps, not the 30 the import assumes)');
  assert(fr(t1) === fr(t0) + 2 && fr(t2) === fr(t0) + 1, 'frame inspector steps exactly one frame per click');
  // add scene 2 to the timeline
  const before = await pg.locator('.clip-card').count();
  await pg.locator('[data-testid=scene-card]').nth(1).locator('button', { hasText: 'Add to timeline' }).click();
  await pg.waitForTimeout(800);
  const after = await pg.locator('.clip-card').count();
  console.log('clip cards', before, '->', after);
  assert(after > before, 'Add to timeline placed the scene (video + linked audio)');
  if (process.env.SMOKE_SHOTS) await pg.screenshot({ path: SP + 's4-scenes.png' });

  // ---- audio
  await pg.locator('[data-testid=s4-tab-audio]').click();
  await pg.locator('.clip-card').first().click();
  await pg.waitForTimeout(400);
  assert(await pg.locator('[data-testid=eq-enabled]').count() === 1, 'audio tab shows the EQ for the selected clip');
  await pg.locator('[data-testid=eq-preset]').selectOption('voice-clarity');
  await pg.waitForTimeout(300);
  assert(await pg.locator('[data-testid=eq-curve] polyline').count() === 1, 'EQ response curve drawn after choosing a preset');
  const g3 = await pg.locator('[data-testid=eq-gain-3]').inputValue();
  console.log('band 4 gain after Voice clarity preset:', g3);
  assert(Number(g3) === 3.5, 'Voice clarity preset sets band 4 to +3.5 dB');
  await pg.locator('[data-testid=master-volume]').fill('50');
  await pg.waitForTimeout(300);
  assert(/50%/.test(await pg.locator('[data-testid=audio-panel]').innerText()), 'master volume shows 50%');
  // play and read the meters
  await pg.evaluate(() => document.activeElement && document.activeElement.blur());
  await pg.keyboard.press('Space');
  await pg.waitForTimeout(1500);
  console.log('media elements:', JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll('video,audio')].map((v) => [v.tagName, v.paused, +v.currentTime.toFixed(2), v.muted, v.volume]))));
  const dbL = Number(await pg.locator('[data-testid=meter-L]').getAttribute('data-db'));
  const dbR = Number(await pg.locator('[data-testid=meter-R]').getAttribute('data-db'));
  console.log('meters during playback (dBFS):', dbL, dbR);
  assert(dbL > -60 && dbR > -60, 'stereo meters move while the timeline plays (the clip has a 440 Hz tone)');
  await pg.keyboard.press('Space');
  if (process.env.SMOKE_SHOTS) await pg.screenshot({ path: SP + 's4-audio.png' });

  // ---- media health
  await pg.locator('[data-testid=s4-tab-health]').click();
  await pg.waitForTimeout(1500);
  const capRows = await pg.locator('[data-testid^=cap-]').count();
  console.log('capability rows:', capRows, await pg.locator('[data-testid=capabilities]').innerText());
  assert(capRows >= 10, 'capabilities listed in one place');
  await pg.locator('[data-testid=check-media]').click();
  await pg.waitForFunction(() => /sources are missing/.test(document.querySelector('[data-testid=health-msg]')?.textContent || ''), null, { timeout: 15000 });
  console.log(await pg.locator('[data-testid=health-msg]').innerText());
  assert(/^0 of/.test(await pg.locator('[data-testid=health-msg]').innerText()), 'Check media reports no missing sources for a fresh import');
  // proxy: start, cancel at once (must end without a proxy), then start again and let it finish
  const row = () => pg.evaluate(() => document.querySelector('[data-testid=media-row]')?.textContent || '');
  // the clip is tiny and the proxy finishes in well under a second: a poller in the page cancels the job the moment it is registered,
  // through the same registry the "Cancel proxy" / "Cancel" buttons use
  await pg.evaluate(async () => {
    const { jobs } = await import('/src/cinegen/lib/perf/jobs.ts');
    window.__cancelled = new Promise((res) => { const t0 = Date.now(); const iv = setInterval(() => { const j = jobs.list().find((x) => x.key.startsWith('proxy:')); if (j) { clearInterval(iv); res(jobs.cancel(j.key)); } else if (Date.now() - t0 > 8000) { clearInterval(iv); res('no job seen'); } }, 1); });
  });
  await pg.locator('[data-testid=media-row] button', { hasText: /Make proxy/ }).first().click();
  console.log('cancelled via registry:', await pg.evaluate(() => window.__cancelled));
  await pg.waitForTimeout(3000);
  const afterCancel = await row();
  console.log('row after cancel:', afterCancel);
  assert(/Make proxy/.test(afterCancel) && !/Has proxy/.test(afterCancel), 'cancelling a running proxy leaves the asset without a proxy');
  await pg.locator('[data-testid=media-row] button', { hasText: /Make proxy/ }).first().click();
  await pg.waitForFunction(() => /Has proxy/.test(document.querySelector('[data-testid=media-row]')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
  assert(/Has proxy/.test(await row()), 'a proxy generated through the app path is attached to the asset (Has proxy)');
  console.log('media rows:', JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll('[data-testid=media-row]')].map((r) => r.textContent))), 'jobs:', JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll('[data-testid=job-row]')].map((r) => r.textContent))));
  if (process.env.SMOKE_SHOTS) await pg.screenshot({ path: SP + 's4-health.png' });
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
