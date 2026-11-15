/* Fix C UI + persistence + real export smoke: real #/timeline, a real imported mp4, Chromium (SwiftShader WebGL2).
 * Run: start `npx vite --port 3131 --host 127.0.0.1`, put clipA.mp4 (testsrc2 640x360 25 fps 6 s, with audio) in SMOKE_DIR, then
 *   SMOKE_PORT=3131 SMOKE_DIR=<dir>/ CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node docs/stage-9/smoke/fixc-ui-smoke.cjs
 * Phase 1 drives the inspector + preview handles (pen mask, corner pin, curves editor, colour pickers) and reads pixels of the preview.
 * Phase 2 saves, reads the stored project, exports through the Export tab (saves fixc-export.mp4 in SMOKE_DIR) and writes fixc-ui-results.json.
 * The exported frames are analysed by docs/stage-9/smoke/fixc-export-analyze.py (ffmpeg + numpy). Set ONLY=ui to skip the export. */
const fs = require('fs');
const sharp = require('sharp');
const L = require('../../stage-8/smoke/combined-lib.cjs');
const SP = L.SP;
const results = []; let failed = 0;
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); results.push({ ok: !!c, m }); if (!c) failed++; };
const info = (m) => console.log('INFO', m);
const seekT = async (pg, sec) => { await pg.mouse.click(500 + sec * 50, 517); await pg.waitForTimeout(700); };
const timelineRow = (store) => { const k = Object.keys(store).find((x) => /project\.json$/.test(x)); const p = JSON.parse(store[k]); return p.timelines.find((t) => t.id === p.activeTimelineId) || p.timelines[0]; };

(async () => {
  const { b, pg, cons } = await L.launch();
  await L.goTimeline(pg); await L.newProject(pg, 'fixc');
  await L.clickBtn(pg, '^EDIT$'); await pg.waitForTimeout(3000);
  await L.addVideo(pg, SP + 'clipA.mp4');
  await pg.locator('[title="clipA.mp4"]').first().dblclick(); await pg.waitForTimeout(1500);
  await pg.locator('[data-testid=insert-edit]').click(); await pg.waitForTimeout(1000);
  await pg.locator('.clip-card').first().click(); await pg.waitForTimeout(500);
  const t = pg.locator('[title="Show inspector"]'); if (await t.count()) await t.first().click();
  await pg.waitForSelector('[data-testid=clip-effects]', { timeout: 8000 });
  await seekT(pg, 1);

  const stageBox = async () => pg.locator('[data-testid=viewer-stage]').boundingBox();
  // pixels of the preview stage: screenshot -> raw RGB; fx(u, v) = pixel at fraction (u, v) of the stage
  const shot = async () => { await pg.waitForTimeout(350); const bb = await stageBox(); const buf = await pg.screenshot({ clip: bb }); const { data, info: i } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: i.width, h: i.height, bb }; };
  const at = (s, u, v) => { const x = Math.min(s.w - 1, Math.max(0, Math.round(u * s.w))), y = Math.min(s.h - 1, Math.max(0, Math.round(v * s.h))); const i = (y * s.w + x) * 3; return [s.data[i], s.data[i + 1], s.data[i + 2]]; };
  const lum = (p) => p[0] + p[1] + p[2];
  const meanOf = (s) => { let r = 0, g = 0, bl = 0; const n = s.w * s.h; for (let i = 0; i < s.data.length; i += 3) { r += s.data[i]; g += s.data[i + 1]; bl += s.data[i + 2]; } return [r / n, g / n, bl / n]; };
  const addFx = async (label) => { await pg.locator('select[aria-label="Add effect"]').selectOption({ label }); await pg.waitForTimeout(700); await pg.waitForFunction(() => document.querySelector('[data-testid=gl-clip-layer]')?.style.visibility === 'visible', null, { timeout: 15000 }).catch(() => info('GL layer not visible after adding ' + label)); };
  const fxRow = () => pg.locator('[data-testid=clip-effects]');
  const anchors = () => pg.locator('[data-testid^=anchor-]');
  const center = async (loc) => { const bb = await loc.boundingBox(); return [bb.x + bb.width / 2, bb.y + bb.height / 2]; };
  const drag = async (from, to, steps = 8) => { await pg.mouse.move(from[0], from[1]); await pg.waitForTimeout(80); await pg.mouse.down(); for (let i = 1; i <= steps; i++) { await pg.mouse.move(from[0] + ((to[0] - from[0]) * i) / steps, from[1] + ((to[1] - from[1]) * i) / steps); await pg.waitForTimeout(40); } await pg.mouse.up(); await pg.waitForTimeout(500); };

  // the machine may be loaded (SwiftShader): re-take the screenshot a few times before judging a pixel condition
  const sa = async (msg, cond, tries = 16) => { let last = null; for (let i = 0; i < tries; i++) { last = await shot(); if (cond(last)) { assert(true, msg); return last; } await pg.waitForTimeout(700); } assert(false, msg); return last; };
  const base = await shot();
  assert(lum(at(base, 0.5, 0.5)) > 60 && lum(at(base, 0.05, 0.05)) > 60, 'baseline: the preview shows the clip (centre and corner are not black)');

  const rm = async (n) => { const l = pg.locator(`[aria-label="Remove ${n}"]`); if (await l.count()) { await l.first().click(); await pg.waitForTimeout(400); } };
  const part = (n) => !process.env.PART || process.env.PART.split(',').includes(n);
  // ===================== 1. PEN-PATH MASK =====================
  if (part('mask')) {
  await addFx('Path Mask');
  assert((await pg.locator('[data-testid=fx-edit-toggle]').count()) === 1, 'Path Mask opens with an "Edit path on preview" control');
  await sa('default ellipse mask: centre visible, corners masked out in the preview', (s) => lum(at(s, 0.5, 0.5)) > 60 && lum(at(s, 0.04, 0.04)) < 20 && lum(at(s, 0.96, 0.96)) < 20);
  await pg.locator('[data-testid=fx-edit-toggle]').click(); await pg.waitForTimeout(500);
  assert((await pg.locator('[data-testid=fx-edit-overlay][data-kind=mask]').count()) === 1 && (await anchors().count()) === 4, 'preview overlay shows 4 anchor handles of the default path');
  // drag the right anchor outwards: the visible region grows to the right
  const a1 = await center(anchors().nth(1));
  const beforeEdge = at(await shot(), 0.84, 0.5);
  await drag(a1, [a1[0] + (await stageBox()).width * 0.12, a1[1]]);
  await sa('dragging an anchor on the preview widens the mask (pixel right of the old edge becomes visible)', (s) => lum(beforeEdge) < 25 && lum(at(s, 0.84, 0.5)) > 60);
  // pen: clear, draw a pentagon by clicking, check the result
  await pg.locator('[data-testid=mask-clear]').click(); await pg.waitForTimeout(400);
  assert((await anchors().count()) === 0, 'Clear removes all points (mask off with < 3 points: picture is full again)');
  await sa('with fewer than 3 points the picture is not masked', (s) => lum(at(s, 0.05, 0.05)) > 60);
  assert((await pg.locator('[data-testid=mask-pen]').getAttribute('aria-pressed')) === 'true', 'Clear while editing switches the pen tool on');
  const bb = await stageBox();
  const P = (u, v) => [bb.x + u * bb.width, bb.y + v * bb.height];
  const pent = [[0.5, 0.15], [0.8, 0.4], [0.7, 0.8], [0.3, 0.8], [0.2, 0.4]];
  for (const [u, v] of pent) { const p = P(u, v); await pg.mouse.click(p[0], p[1]); await pg.waitForTimeout(250); }
  assert((await anchors().count()) === 5, 'pen tool: five clicks on the preview create five anchors (got ' + (await anchors().count()) + ')');
  await sa('pentagon mask: inside visible, outside black', (s) => lum(at(s, 0.5, 0.55)) > 60 && lum(at(s, 0.08, 0.1)) < 20 && lum(at(s, 0.92, 0.9)) < 20 && lum(at(s, 0.5, 0.05)) < 20);
  // pen drag pulls bezier handles: add a 6th point with a drag
  const p6 = P(0.5, 0.95); await pg.mouse.move(p6[0], p6[1]); await pg.mouse.down(); await pg.mouse.move(p6[0] + 60, p6[1] - 5, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(400);
  assert((await anchors().count()) === 6, 'pen: a click-drag adds a 6th point (with bezier handles)');
  await pg.locator('[data-testid=mask-pen]').click();
  // handles of the selected anchor are shown and draggable
  assert((await pg.locator('[data-handle]').count()) === 2, 'the selected (new) anchor shows its in / out handles');
  // select + delete
  await anchors().nth(5).click({ force: true }); await pg.locator('[data-testid=mask-delete-point]').click(); await pg.waitForTimeout(300);
  assert((await anchors().count()) === 5, 'Delete point removes the selected anchor');
  // invert + opacity + feather via the sliders
  const slider = (label) => fxRow().locator('.clip-properties-panel__row').filter({ has: pg.locator('.clip-properties-panel__label', { hasText: new RegExp('^' + label + '$') }) }).locator('input[type=range]').first();
  await slider('Invert').fill('1'); await pg.waitForTimeout(800);
  if (process.env.DBG) { await pg.screenshot({ path: SP + 'dbg-invert.png' }); info('rows ' + (await fxRow().locator('.clip-properties-panel__row').allInnerTexts()).join(' | ').replace(/\n/g, ' ').slice(0, 600)); }
  await sa('Invert flips the mask (inside is now only the overlay tint, outside shows the picture)', (s) => lum(at(s, 0.5, 0.55)) < 90 && lum(at(s, 0.08, 0.1)) > 200);
  await slider('Invert').fill('0');
  // animated points: key all points at 1 s, move one anchor at 4 s, the shape differs between the two times
  await pg.locator('[data-testid=mask-key-points]').click(); await pg.waitForTimeout(400);
  const keyedBefore = await shot();
  await seekT(pg, 4);
  const a0 = await center(anchors().nth(0));
  await drag(a0, [a0[0] + bb.width * 0.18, a0[1] + bb.height * 0.30]);
  await sa('animated mask point: at 4 s the top tip has moved away (pixel above the old tip is masked)', (s) => lum(at(s, 0.5, 0.2)) < 20);
  await seekT(pg, 1);
  await sa('animated mask point: at 1 s the top tip is back (pixel above it is visible)', (s) => lum(at(s, 0.5, 0.2)) > 60);
  assert((await pg.locator('[data-testid=mask-clear-keys]').count()) === 1, 'inspector offers "Clear point keys" while points are animated');
  let tl = timelineRow(await L.readStore(pg)); void tl;

  await rm('Path Mask');
  }
  // ===================== 2. CORNER PIN =====================
  if (part('pin')) {
  await addFx('Corner Pin');
  await pg.locator('[data-testid=fx-edit-toggle]').click(); await pg.waitForTimeout(500);
  assert((await pg.locator('[data-testid^=corner-]').count()) === 4, 'corner pin: four draggable corner handles on the preview');
  await sa('identity pin leaves the picture as it was', (s) => lum(at(s, 0.5, 0.5)) > 60 && lum(at(s, 0.03, 0.03)) > 60);
  const c0 = await center(pg.locator('[data-testid=corner-0]'));
  await drag(c0, [bb.x + bb.width * 0.30, bb.y + bb.height * 0.35]);
  await sa('dragging the top-left corner inwards cuts the corner (black), the rest stays', (s) => lum(at(s, 0.04, 0.04)) < 20 && lum(at(s, 0.5, 0.5)) > 60 && lum(at(s, 0.96, 0.96)) > 60);
  const c2 = await center(pg.locator('[data-testid=corner-2]')); c2[0] -= 4; c2[1] -= 4; // the handle sits on the stage edge; grab its inner half
  await drag(c2, [bb.x + bb.width * 0.75, bb.y + bb.height * 0.70]);
  await sa('dragging the bottom-right corner cuts that corner too', (s) => lum(at(s, 0.96, 0.96)) < 20 && lum(at(s, 0.5, 0.5)) > 60);
  // keyed corners
  await pg.locator('[data-testid=cornerpin-key]').click(); await pg.waitForTimeout(300);
  await seekT(pg, 4);
  const c1 = await center(pg.locator('[data-testid=corner-1]'));
  await drag(c1, [bb.x + bb.width * 0.60, bb.y + bb.height * 0.10]);
  await sa('corner pin corners are keyframeable: at 4 s the top-right corner has moved in (pixel near the old corner is black)', (s) => lum(at(s, 0.9, 0.1)) < 20);
  await seekT(pg, 1);
  await sa('corner pin corners are keyframeable: at 1 s the corner is back (pixel near it is visible)', (s) => lum(at(s, 0.9, 0.1)) > 60);
  await pg.locator('[data-testid=cornerpin-reset]').click(); await pg.waitForTimeout(300);

  await rm('Corner Pin');
  }
  // ===================== 3. CURVES EDITOR =====================
  if (part('curves')) {
  const plain = meanOf(await sa('picture without effects before the curves test', (s) => lum(at(s, 0.03, 0.03)) > 60));
  await addFx('Curves');
  assert((await pg.locator('[data-testid=fx-curves-editor]').count()) === 1, 'Curves shows the draggable curve editor');
  assert((await fxRow().locator('.clip-properties-panel__row').filter({ hasText: /Black point|Red mid bend|Highlights$/ }).count()) === 0, 'the five old sliders are no longer listed');
  const plot = pg.locator('[data-testid=fx-curves-editor] svg');
  await plot.scrollIntoViewIfNeeded(); await pg.waitForTimeout(300);
  const pb = await plot.boundingBox();
  const PP = (x, y) => [pb.x + pb.width * ((x * 200 + 6) / 212), pb.y + pb.height * (((1 - y) * 200 + 6) / 212)];
  const identity = meanOf(await sa('default curve = identity (mean colour unchanged)', (s) => { const m = meanOf(s); return Math.abs(m[0] - plain[0]) < 2 && Math.abs(m[1] - plain[1]) < 2; }));
  const click1 = PP(0.5, 0.5); info('plot box ' + JSON.stringify(pb) + ' click ' + click1 + ' hit ' + (await pg.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + ':' + (e.getAttribute('data-testid') || e.getAttribute('aria-label') || '') : null; }, click1)));
  await pg.mouse.click(click1[0], click1[1]); await pg.waitForTimeout(300); info('curve points now ' + (await pg.locator('[data-testid^=curve-pt-]').count()));
  assert((await pg.locator('[data-testid^=curve-pt-]').count()) === 3, 'clicking the plot adds a point');
  // the test clip is made of saturated primaries (0 / 255), so a mid-tone lift is invisible: raise the BLACK point instead (0 -> 0.4)
  await drag(PP(0, 0), PP(0, 0.4));
  const bright = meanOf(await sa('raising the black point lifts the blacks (preview gets brighter)', (s) => meanOf(s)[1] > identity[1] + 15));
  assert(bright[1] > identity[1] + 15, 'master curve: black point 0 -> 0.4 brightens the preview (green mean ' + identity[1].toFixed(1) + ' -> ' + bright[1].toFixed(1) + ')');
  await pg.locator('[data-testid=curves-ch-r]').click();
  await drag(PP(1, 1), PP(1, 0.0)); // red end point down: all full-red pixels lose their red
  if (process.env.DBG) { await pg.keyboard.press('Control+s'); await pg.waitForTimeout(1200); const t0 = timelineRow(await L.readStore(pg)); info('fx_json ' + t0.clips.map((c) => c.fx_json).join('|')); await pg.waitForTimeout(2500); await pg.screenshot({ path: SP + 'dbg-curves2.png' }); info('canvas ' + (await pg.evaluate(() => { const c = document.querySelector('[data-testid=gl-clip-layer]'); return c ? c.style.visibility + ' ' + c.width + 'x' + c.height + ' op=' + c.style.opacity : 'none'; }))); }
  const redDown = meanOf(await sa('red curve lowered', (s) => meanOf(s)[0] < bright[0] - 15));
  assert(redDown[0] < bright[0] - 15 && Math.abs(redDown[1] - bright[1]) < 3, 'the red channel curve lowers only red (R ' + bright[0].toFixed(1) + ' -> ' + redDown[0].toFixed(1) + ', G ' + bright[1].toFixed(1) + ' -> ' + redDown[1].toFixed(1) + ')');
  // delete a point by double click
  await pg.locator('[data-testid=curves-ch-m]').click();
  await pg.mouse.click(PP(0.5, 0.7)[0], PP(0.5, 0.7)[1]); await pg.waitForTimeout(300);
  const nPts = await pg.locator('[data-testid^=curve-pt-]').count();
  await pg.locator('[data-testid=curve-pt-1]').dblclick({ force: true }); await pg.waitForTimeout(300);
  assert((await pg.locator('[data-testid^=curve-pt-]').count()) === nPts - 1, 'double-clicking a point removes it');
  await pg.locator('[data-testid=curves-ch-m]').click(); await pg.locator('[data-testid=curves-reset]').click(); await pg.waitForTimeout(300);

  }
  // ===================== 4. COLOUR PICKERS =====================
  if (part('colour')) {
  await addFx('Night Vision');
  const colourIn = pg.locator('[data-testid=fx-colour-tint]');
  assert((await colourIn.count()) === 1, 'Night Vision lists a colour picker for its phosphor tint');
  const nvG = meanOf(await sa('night vision is green by default', (s) => { const m = meanOf(s); return m[1] > m[0] * 2; }));
  await colourIn.fill('#ff2020'); await pg.waitForTimeout(500);
  const nvR = meanOf(await sa('night vision tint recoloured', (s) => { const m = meanOf(s); return m[0] > m[1] * 2; }));
  assert(nvG[1] > nvG[0] * 2 && nvR[0] > nvR[1] * 2, 'changing the tint colour recolours the preview (default green dominant, #ff2020 red dominant)');
  await addFx('Gradient Map');
  assert((await pg.locator('[data-testid^=fx-colour-]').count()) >= 3, 'Gradient Map offers colour swatches for its three stops');
  const hueBefore = await slider('Mid hue').inputValue();
  await pg.locator('[data-testid=fx-colour-midHue]').fill('#00c040'); await pg.waitForTimeout(400);
  const hueAfter = await slider('Mid hue').inputValue();
  assert(Math.abs(parseFloat(hueAfter) - parseFloat(hueBefore)) > 20 && Math.abs(parseFloat(hueAfter) - 138) < 6, 'picking a stop colour writes the HSV sliders (mid hue ' + hueBefore + ' -> ' + hueAfter + ', expected ~138)');
  await rm('Gradient Map');
  await rm('Night Vision');
  await rm('Curves');
  }


  // ===================== 5. SAVE + REAL EXPORT + RELOAD =====================
  if (part('export') && !process.env.ONLY_UI) {
    const bb2 = await stageBox();
    await addFx('Path Mask');
    await pg.locator('[data-testid=mask-new-rect]').click(); await pg.waitForTimeout(400);
    await pg.locator('[data-testid=fx-edit-toggle]').click(); await pg.waitForTimeout(500);
    await seekT(pg, 1);
    await pg.locator('[data-testid=mask-key-points]').click(); await pg.waitForTimeout(400);
    await seekT(pg, 4);
    for (const i of [1, 2]) { const a = await center(anchors().nth(i)); await drag(a, [a[0] - bb2.width * 0.18, a[1]]); }
    await pg.locator('[data-testid=fx-edit-toggle]').click(); await pg.waitForTimeout(300);
    await addFx('Corner Pin');
    await pg.locator('[data-testid=fx-edit-toggle]').click(); await pg.waitForTimeout(500);
    const target = [[0.2, 0.2], [0.8, 0.18], [0.82, 0.8], [0.18, 0.78]];
    const inner = [[5, 5], [-5, 5], [-5, -5], [5, -5]];
    for (let i = 0; i < 4; i++) { const c = await center(pg.locator(`[data-testid=corner-${i}]`)); await drag([c[0] + inner[i][0], c[1] + inner[i][1]], [bb2.x + bb2.width * target[i][0], bb2.y + bb2.height * target[i][1]]); }
    await pg.locator('[data-testid=fx-edit-toggle]').click(); await pg.waitForTimeout(300);
    await addFx('Curves');
    const plot2 = pg.locator('[data-testid=fx-curves-editor] svg'); await plot2.scrollIntoViewIfNeeded(); await pg.waitForTimeout(300);
    const pb2 = await plot2.boundingBox();
    const PP2 = (x, y) => [pb2.x + pb2.width * ((x * 200 + 6) / 212), pb2.y + pb2.height * (((1 - y) * 200 + 6) / 212)];
    await pg.locator('[data-testid=curves-ch-r]').click();
    await drag(PP2(1, 1), PP2(1, 0));
    await seekT(pg, 1);
    await pg.keyboard.press('Control+s'); await pg.waitForTimeout(1500);
    const store1 = await L.readStore(pg); const tl1 = timelineRow(store1);
    const vrow = tl1.clips.find((c) => /^clipA\.mp4$/.test(c.name));
    fs.writeFileSync(SP + 'fixc-saved.json', JSON.stringify({ clip: vrow }, null, 1));
    const fxs = JSON.parse(vrow.fx_json);
    assert(fxs.map((f) => f.id).join() === 'builtin:fx-path-mask,builtin:fx-corner-pin,builtin:fx-curves', 'saved project: the three effects are in Clip.fx in order');
    assert(Array.isArray(fxs[0].props.path) && fxs[0].props.path.length === 24 && Array.isArray(fxs[2].props.curve_r) && fxs[2].props.curve_r.join() === '0,0,1,0' && typeof fxs[1].props.tlx === 'number', 'saved project: mask path (4 vertices), corner values and curve_r arrays are stored in the clip');
    assert(/"fx:0:v1x"/.test(vrow.stage1_json || ''), 'saved project: animated mask anchors are stored in Clip.anim (stage1_json)');
    // real export through the Export tab
    await L.clickBtn(pg, '^EXPORT$'); await pg.waitForTimeout(2000);
    const qa = pg.locator('[data-testid=export-auto-qa]'); if (await qa.count() && await qa.isChecked()) await qa.uncheck();
    const dl = pg.waitForEvent('download', { timeout: 420000 }).catch((e) => ({ err: String(e) }));
    await pg.locator('.export-settings__render-btn').click();
    const d = await dl;
    if (!d || !d.saveAs) { assert(false, 'export produced a download: ' + JSON.stringify(d)); } else {
      await d.saveAs(SP + 'fixc-export.mp4'); info('SAVED ' + SP + 'fixc-export.mp4');
      const r = require('child_process').spawnSync('python3', ['-I', __dirname + '/fixc-export-analyze.py', SP], { encoding: 'utf8', maxBuffer: 1 << 24 });
      if (r.status !== 0) assert(false, 'export analysis ran: ' + (r.stderr || r.stdout || '').slice(0, 400));
      else { const js = r.stdout.slice(r.stdout.indexOf('{\n')); const an = JSON.parse(js); fs.writeFileSync(SP + 'fixc-export-analysis.json', JSON.stringify(an, null, 1)); an.checks.forEach((c) => assert(c.ok, 'EXPORT: ' + c.msg)); info('numbers ' + JSON.stringify(an.numbers)); }
    }
    // reload and reopen: everything is still there and editable
    await L.goTimeline(pg);
    await pg.reload(); await pg.waitForSelector('.pm-window', { timeout: 90000 }); await pg.waitForTimeout(3000);
    const tl2 = timelineRow(await L.readStore(pg)); const row2 = tl2.clips.find((c) => /^clipA\.mp4$/.test(c.name));
    assert(row2 && row2.fx_json === vrow.fx_json && row2.stage1_json === vrow.stage1_json, 'after reload the stored clip row (fx_json + stage1_json) is byte-identical');
    await pg.evaluate(() => [...document.querySelectorAll('.pm-card, [class*=pm-project], [class*=project-card]')][0]?.click()); await pg.waitForTimeout(500);
    await L.clickBtn(pg, '^Open$'); await pg.waitForTimeout(5000); await L.clickBtn(pg, '^EDIT$'); await pg.waitForTimeout(3500);
    await pg.locator('.clip-card').filter({ hasNotText: '(audio)' }).first().click(); await pg.waitForTimeout(600);
    const ti = pg.locator('[title="Show inspector"]'); if (await ti.count()) await ti.first().click();
    await pg.waitForSelector('[data-testid=clip-effects]', { timeout: 10000 });
    await seekT(pg, 1);
    await pg.locator('[data-testid=clip-effects]').getByRole('button', { name: 'Path Mask', exact: true }).click(); await pg.waitForTimeout(400);
    await pg.locator('[data-testid=fx-edit-toggle]').click(); await pg.waitForTimeout(800);
    assert((await anchors().count()) === 4 && (await pg.locator('[data-testid=mask-clear-keys]').count()) === 1, 'reloaded project: the path mask opens with its 4 anchors and its animated points');
  }

  const pageErrors = cons.filter((c) => /PAGEERR|Uncaught|TypeError|ReferenceError/.test(c));
  assert(pageErrors.length === 0, 'no page errors during the UI run ' + JSON.stringify(pageErrors.slice(0, 3)));
  fs.writeFileSync(SP + 'fixc-ui-results.json', JSON.stringify({ results, failed }, null, 1));
  console.log(failed ? 'FAILED ' + failed : 'ALL UI PASS');
  await b.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('ERR', e); process.exit(2); });
