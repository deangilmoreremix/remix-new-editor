/* Fix G UI + persistence + real export smoke for Pixel Sort: real #/timeline, a real imported mp4, Chromium (SwiftShader WebGL2).
 * Run: start `npx vite --port 3141 --host 127.0.0.1`, put clipA.mp4 (2.5 s, 640x360, 25 fps) in SMOKE_DIR, then
 *   SMOKE_PORT=3141 SMOKE_DIR=<dir>/ CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node docs/stage-10/smoke/fixg-ui-smoke.cjs
 * Exports through the Export tab (Draft = 720p) to SMOKE_DIR/fixg-export.mp4 and runs docs/stage-10/smoke/fixg-export-analyze.py on it. */
const fs = require('fs');
const sharp = require('sharp');
const L = require('../../stage-8/smoke/combined-lib.cjs');
const SP = L.SP;
const results = []; let failed = 0;
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); results.push({ ok: !!c, m }); if (!c) failed++; };
const LEN = String(process.env.LEN || 24); // sort length used for the preview checks and the export (SwiftShader previews with 64 passes flicker: the video seeks starve)
const info = (m) => console.log('INFO', m);
const seekT = async (pg, sec) => { await pg.mouse.click(500 + sec * 50, 517); await pg.waitForTimeout(700); };
const timelineRow = (store) => { const k = Object.keys(store).find((x) => /project\.json$/.test(x)); const p = JSON.parse(store[k]); return p.timelines.find((t) => t.id === p.activeTimelineId) || p.timelines[0]; };

(async () => {
  const { b, pg, cons } = await L.launch();
  await L.goTimeline(pg); await L.newProject(pg, 'fixg');
  await L.clickBtn(pg, '^EDIT$'); await pg.waitForTimeout(3000);
  await L.addVideo(pg, SP + 'clipA.mp4');
  await pg.locator('[title="clipA.mp4"]').first().dblclick(); await pg.waitForTimeout(1500);
  await pg.locator('[data-testid=insert-edit]').click(); await pg.waitForTimeout(1000);
  await pg.locator('.clip-card').first().click(); await pg.waitForTimeout(500);
  const t = pg.locator('[title="Show inspector"]'); if (await t.count()) await t.first().click();
  await pg.waitForSelector('[data-testid=clip-effects]', { timeout: 8000 });
  await seekT(pg, 1);
  const shot = async () => { await pg.waitForTimeout(350); const bb = await pg.locator('[data-testid=viewer-stage]').boundingBox(); const buf = await pg.screenshot({ clip: bb }); const { data, info: i } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: i.width, h: i.height }; };
  const mad = (a, c) => { let s = 0; for (let i = 0; i < a.data.length; i++) s += Math.abs(a.data[i] - c.data[i]); return s / a.data.length; };
  // fraction of horizontally adjacent pixel pairs whose luma does not decrease (sorted ascending rows push this up)
  const mono = (s) => { let ok = 0, n = 0; for (let y = 0; y < s.h; y++) for (let x = 0; x + 1 < s.w; x++) { const i = (y * s.w + x) * 3; const j = i + 3; const l0 = s.data[i] * 0.2126 + s.data[i + 1] * 0.7152 + s.data[i + 2] * 0.0722; const l1 = s.data[j] * 0.2126 + s.data[j + 1] * 0.7152 + s.data[j + 2] * 0.0722; n++; if (l1 >= l0 - 1) ok++; } return ok / n; };
  const fxRow = () => pg.locator('[data-testid=clip-effects]');
  const slider = (label) => fxRow().locator('.clip-properties-panel__row').filter({ has: pg.locator('.clip-properties-panel__label', { hasText: new RegExp('^' + label.replace(/[()]/g, '\\$&') + '$') }) }).locator('input[type=range]').first();
  const sa = async (msg, cond, tries = 16) => { let last = null; for (let i = 0; i < tries; i++) { last = await shot(); if (cond(last)) { assert(true, msg); return last; } await pg.waitForTimeout(900); } assert(false, msg); return last; };

  const base = await shot(); const baseMono = mono(base);
  await seekT(pg, 2); const base2 = await shot(); await seekT(pg, 1); // the clip moves, so the 2 s reference is its own picture
  await pg.locator('select[aria-label="Add effect"]').selectOption({ label: 'Pixel Sort' }); await pg.waitForTimeout(1000);
  await pg.waitForFunction(() => document.querySelector('[data-testid=gl-clip-layer]')?.style.visibility !== 'hidden', null, { timeout: 20000 }).catch(() => {});
  const labels = await fxRow().locator('.clip-properties-panel__label').allInnerTexts();
  const want = ['Threshold low', 'Threshold high', 'Sort key (0 luma / 1 hue / 2 saturation / 3 brightness)', 'Axis (0 horizontal / 1 vertical)', 'Ascending (1) / descending (0)', 'Length (passes, max 64)', 'Strength', 'Invert mask'];
  assert(want.every((w) => labels.includes(w)), 'inspector lists all eight Pixel Sort parameters ' + JSON.stringify(labels.filter((l) => !want.includes(l)).length ? labels : 'ok'));
  const def = await sa('default Pixel Sort changes the preview', (s) => mad(s, base) > 1.0);
  info('default: mean abs diff vs no effect ' + mad(def, base).toFixed(2) + ', monotone pair fraction ' + baseMono.toFixed(3) + ' -> ' + mono(def).toFixed(3));
  // identity: length 0
  await slider('Length (passes, max 64)').fill('0'); await pg.waitForTimeout(600);
  const id0 = await sa('length 0: preview equals the picture without the effect (mean abs diff < 3 levels)', (s) => mad(s, base) < 3);
  info('length 0 diff ' + mad(id0, base).toFixed(3));
  await slider('Length (passes, max 64)').fill(LEN);
  await slider('Threshold low').fill('1'); await slider('Threshold high').fill('0'); await pg.waitForTimeout(600);
  const idm = await sa('threshold window excluding everything: preview equals the original', (s) => mad(s, base) < 3);
  info('empty window diff ' + mad(idm, base).toFixed(3));
  // real settings used for export: whole window, luma ascending, 64 passes, horizontal
  await slider('Threshold low').fill('0.05'); await slider('Threshold high').fill('0.95'); await slider('Length (passes, max 64)').fill(LEN); await pg.waitForTimeout(800);
  const sorted = await sa('window 0.05..0.95, length ' + LEN + ': the picture changes', (s) => mad(s, base) > 4);
  info('length ' + LEN + ': diff ' + mad(sorted, base).toFixed(2) + ' monotone ' + mono(sorted).toFixed(3) + ' (baseline ' + baseMono.toFixed(3) + ')');
  // keyframe Length: diamond at 1 s with 64, at 2 s with 0
  await pg.locator('[data-testid=fx-key-length]').click(); await pg.waitForTimeout(400);
  await seekT(pg, 2); await slider('Length (passes, max 64)').fill('0'); await pg.waitForTimeout(300);
  await pg.locator('[data-testid=fx-key-length]').click(); await pg.waitForTimeout(600);
  await sa('keyframed length: at 2 s (length 0) the picture is the original again', (s) => mad(s, base2) < 3);
  await seekT(pg, 1);
  const back = await sa('keyframed length: back at 1 s the sorted look returns', (s) => mad(s, base) > 4);
  void back;
  await pg.keyboard.press('Control+s'); await pg.waitForTimeout(1500);
  const store1 = await L.readStore(pg); const tl1 = timelineRow(store1);
  const vrow = tl1.clips.find((c) => /^clipA\.mp4$/.test(c.name));
  fs.writeFileSync(SP + 'fixg-saved.json', JSON.stringify({ clip: vrow }, null, 1));
  const fxs = JSON.parse(vrow.fx_json);
  assert(fxs.length === 1 && fxs[0].id === 'builtin:fx-pixel-sort', 'saved project: Clip.fx holds the Pixel Sort effect');
  info('saved props ' + JSON.stringify(fxs[0].props) + ' anim ' + (vrow.stage1_json || '').slice(0, 200));
  assert(Math.abs(fxs[0].props.low - 0.05) < 1e-6 && Math.abs(fxs[0].props.high - 0.95) < 1e-6, 'saved project: threshold values persisted');
  assert(/fx:0:length/.test(vrow.stage1_json || '') || !!fxs[0].keys?.length, 'saved project: the Length keyframes are stored (Clip.anim fx:0:length)');
  // export through the real Export tab, Draft (720p): once with Pixel Sort, once with the effect disabled (control, same codec path)
  const doExport = async (file) => {
    await L.clickBtn(pg, '^EXPORT$'); await pg.waitForTimeout(2000);
    await pg.evaluate(() => [...document.querySelectorAll('button, label, [role=radio]')].find((x) => /^\s*Draft/i.test(x.innerText))?.click()); await pg.waitForTimeout(500);
    const qa = pg.locator('[data-testid=export-auto-qa]'); if (await qa.count() && await qa.isChecked()) await qa.uncheck();
    const dl = pg.waitForEvent('download', { timeout: 900000 }).catch((e) => ({ err: String(e) }));
    const t0 = Date.now();
    await pg.locator('.export-settings__render-btn').click();
    let lastTxt = ''; let done = false; dl.then(() => { done = true; });
    for (let i = 0; i < 170 && !done; i++) { await pg.waitForTimeout(5000); const txt = await pg.evaluate(() => (document.querySelector('.render-progress') || document.querySelector('.export-tab'))?.innerText?.replace(/\s+/g, ' ').slice(0, 160) || '').catch(() => ''); if (txt !== lastTxt) { info('export: ' + txt); lastTxt = txt; } }
    const d = await dl;
    if (!d || !d.saveAs) { assert(false, 'export ' + file + ' produced a download: ' + JSON.stringify(d)); return false; }
    await d.saveAs(SP + file); info('SAVED ' + SP + file + ' after ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s'); assert(true, 'export ' + file + ' produced a download');
    return true;
  };
  const ok1 = await doExport('fixg-export.mp4');
  if (ok1) {
    await L.clickBtn(pg, '^EDIT$'); await pg.waitForTimeout(2500);
    await pg.locator('.clip-card').filter({ hasNotText: '(audio)' }).first().click(); await pg.waitForTimeout(600);
    const ti = pg.locator('[title="Show inspector"]'); if (await ti.count()) await ti.first().click();
    await pg.waitForSelector('[data-testid=clip-effects]', { timeout: 10000 });
    await pg.locator('[aria-label="Disable Pixel Sort"]').click(); await pg.waitForTimeout(800);
    if (await doExport('fixg-export-control.mp4')) {
      const r = require('child_process').spawnSync('python3', ['-I', __dirname + '/fixg-export-analyze.py', SP], { encoding: 'utf8', maxBuffer: 1 << 24 });
      if (r.status !== 0) assert(false, 'export analysis ran: ' + (r.stderr || r.stdout || '').slice(0, 600));
      else { const an = JSON.parse(r.stdout.slice(r.stdout.indexOf('{\n'))); fs.writeFileSync(SP + 'fixg-export-analysis.json', JSON.stringify(an, null, 1)); an.checks.forEach((c) => assert(c.ok, 'EXPORT: ' + c.msg)); info('numbers ' + JSON.stringify(an.numbers)); }
    }
  }
  const pageErrors = cons.filter((c) => /PAGEERR|Uncaught|TypeError|ReferenceError/.test(c) && !/Retrying failed fetch/.test(c));
  assert(pageErrors.length === 0, 'no page errors during the UI run ' + JSON.stringify(pageErrors.slice(0, 3)));
  fs.writeFileSync(SP + 'fixg-ui-results.json', JSON.stringify({ results, failed }, null, 1));
  console.log(failed ? 'FAILED ' + failed : 'ALL UI PASS');
  await b.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('ERR', e); process.exit(2); });
