/* Stage 8 combined end-to-end smoke: real #/timeline, real imports, Stage 1-6 features together, save, reload, real export, ffmpeg checks.
 * Run: start `npx vite --port 3100`, then
 *   SMOKE_DIR=<dir>/ CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node docs/stage-8/smoke/combined-smoke.cjs
 * SMOKE_DIR must contain clipA.mp4 (testsrc2 640x360 25fps 6 s, 440 Hz sine) and clipB.mp4 (smptebars, 880 Hz sine); see docs/stage-8/STAGE_8_REPORT.md.
 * Writes baseline.<ext> (no features), final.<ext> (everything on) and combined-results.json into SMOKE_DIR. SKIP_BASELINE=1 reuses an existing baseline. */
const fs = require('fs');
const L = require('./combined-lib.cjs');
const SP = L.SP;
const results = []; let failed = 0;
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); results.push({ ok: !!c, m }); if (!c) failed++; };
const info = (m) => console.log('INFO', m);

async function runExport(pg, base) {
  await L.clickBtn(pg, '^EXPORT$'); await pg.waitForTimeout(2000);
  const qa = pg.locator('[data-testid=export-auto-qa]'); if (await qa.count() && await qa.isChecked()) await qa.uncheck();
  const dl = pg.waitForEvent('download', { timeout: 280000 }).catch((e) => ({ err: String(e) }));
  await pg.locator('.export-settings__render-btn').click();
  const d = await dl;
  if (!d || !d.saveAs) { info('NO DOWNLOAD ' + JSON.stringify(d)); return null; }
  const ext = (/\.(\w+)$/.exec(d.suggestedFilename()) || [, 'mp4'])[1];
  const out = SP + base + '.' + ext; await d.saveAs(out); info('SAVED ' + out); return out;
}
async function selectVideoCard(pg, name) {
  const c = pg.locator('.clip-card').filter({ hasText: name }).filter({ hasNotText: '(audio)' }).first();
  await c.click(); await pg.waitForTimeout(500);
}
const seekT = async (pg, sec) => { await pg.mouse.click(500 + sec * 50, 517); await pg.waitForTimeout(500); };
async function openInspector(pg) { const t = pg.locator('[title="Show inspector"]'); if (await t.count()) await t.first().click(); await pg.waitForTimeout(500); }
const rowOf = (pg, label) => pg.locator('.clip-properties-panel__row').filter({ hasText: label }).first();
const timelineRow = (store) => { const k = Object.keys(store).find((x) => /project\.json$/.test(x)); const p = JSON.parse(store[k]); return p.timelines.find((t) => t.id === p.activeTimelineId) || p.timelines[0]; };

(async () => {
  const { b, pg, cons } = await L.launch();
  await L.goTimeline(pg); await L.newProject(pg, 'combined');
  await L.clickBtn(pg, '^EDIT$'); await pg.waitForTimeout(3000);
  await L.addVideo(pg, SP + 'clipA.mp4'); await L.addVideo(pg, SP + 'clipB.mp4');
  const scrub = async (f) => { const sc = await pg.locator('.viewer-scrubber').first().boundingBox(); await pg.mouse.click(sc.x + sc.width * f, sc.y + sc.height / 2); await pg.waitForTimeout(500); };
  await pg.locator('[title="clipA.mp4"]').first().dblclick(); await pg.waitForTimeout(1500);
  await scrub(0); await pg.keyboard.press('i'); await scrub(0.5); await pg.keyboard.press('o');
  await pg.locator('[data-testid=insert-edit]').click(); await pg.waitForTimeout(1000);
  await pg.locator('[title="clipB.mp4"]').first().dblclick(); await pg.waitForTimeout(1500);
  await scrub(1 / 6); await pg.keyboard.press('i'); await scrub(4 / 6); await pg.keyboard.press('o');
  await seekT(pg, 3); await pg.locator('[data-testid=insert-edit]').click(); await pg.waitForTimeout(1500);
  assert((await pg.locator('.clip-card').count()) === 4, 'two imported clips placed with linked audio (4 clip cards)');
  let tl = timelineRow(await L.readStore(pg));
  const vclips = () => tl.clips.filter((c) => /^clip[AB]\.mp4$/.test(c.name)).sort((x, y) => x.start_time - y.start_time);
  info('clips ' + JSON.stringify(vclips().map((c) => [c.name, c.start_time, c.trim_start, c.trim_end])));

  // ---------- baseline export (no features) ----------
  let baseline = null;
  if (process.env.SKIP_BASELINE && fs.existsSync(SP + 'baseline.mp4')) baseline = SP + 'baseline.mp4';
  else baseline = await runExport(pg, 'baseline');
  assert(!!baseline, 'baseline export (no features) produced a file: ' + baseline);
  await L.clickBtn(pg, '^EDIT$'); await pg.waitForTimeout(2500);

  // ---------- Stage 3/5: effects on clip B (one with param keyframes) ----------
  await selectVideoCard(pg, 'clipB.mp4'); await openInspector(pg);
  const addFx = async (id) => {
    await pg.locator('[data-testid=clip-effects]').getByText('Browse library…').click();
    await pg.locator(`[data-testid="library-card-${id}"]`).click(); await pg.waitForTimeout(700);
  };
  await addFx('builtin:fx-exposure');
  await seekT(pg, 3.5);
  await pg.locator('[data-testid=fx-key-exposure]').click(); await pg.waitForTimeout(300);
  await rowOf(pg, 'Exposure (stops)').locator('input[type=range]').fill('-2'); await pg.waitForTimeout(300);
  await seekT(pg, 5.5);
  await rowOf(pg, 'Exposure (stops)').locator('input[type=range]').fill('1.5'); await pg.waitForTimeout(300);
  await addFx('builtin:fx-glass');
  await addFx('builtin:fx-scanlines');
  tl = timelineRow(await L.readStore(pg));
  const bClip = () => vclips().find((c) => c.name === 'clipB.mp4');
  const fxOf = (c) => { try { const v = c.fx ?? c.fx_json; return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; } };
  info('B row keys with values: ' + JSON.stringify(Object.keys(bClip()).filter((k) => bClip()[k] != null && bClip()[k] !== 0)));
  const bfx = fxOf(bClip()) || [];
  assert(bfx.length === 3 && bfx.map((f) => f.id).join() === 'builtin:fx-exposure,builtin:fx-glass,builtin:fx-scanlines', 'three new GL effects saved on clip B: ' + bfx.map((f) => f.id));
  assert(bfx[0] && bfx[0].keys && bfx[0].keys.exposure && bfx[0].keys.exposure.length >= 2, 'effect param keyframes (exposure) saved: ' + JSON.stringify(bfx[0] && bfx[0].keys));

  // ---------- Stage 2: motion modifier on B ----------
  await pg.locator('[data-testid=modifier-add]').selectOption({ index: 1 }); await pg.waitForTimeout(500);
  const modName = await pg.locator('[data-testid^=modifier-]').filter({ hasNotText: 'zzz' }).first().getAttribute('data-testid');
  info('modifier added: ' + modName);

  // ---------- Stage 1 nest + expand on B (effects/modifier must survive) ----------
  await L.clickBtn(pg, '^Nest$'); await pg.waitForTimeout(800);
  const nestedCards = await pg.locator('.clip-card').count();
  await L.clickBtn(pg, '^Expand$'); await pg.waitForTimeout(800);
  tl = timelineRow(await L.readStore(pg));
  const afterExpand = bClip();
  const fxAfter = (fxOf(afterExpand) || []).map((f) => f.id).join();
  info('cards while nested: ' + nestedCards);
  assert(fxAfter === 'builtin:fx-exposure,builtin:fx-glass,builtin:fx-scanlines', 'effects survive nest -> expand: ' + fxAfter);
  assert(JSON.stringify(afterExpand).includes('modifiers') || JSON.stringify(afterExpand).includes('modifier'), 'motion modifier survives nest -> expand');

  // ---------- Stage 1 group + Stage 2 keyframes on A ----------
  await selectVideoCard(pg, 'clipA.mp4'); await pg.waitForTimeout(300);
  await pg.keyboard.press('Control+g'); await pg.waitForTimeout(600);
  await pg.locator('[data-testid=auto-key]').click();
  await seekT(pg, 0.2); await pg.locator('[data-testid=anim-x]').fill('-30'); await pg.waitForTimeout(300);
  await seekT(pg, 1.2); await pg.locator('[data-testid=anim-x]').fill('30'); await pg.waitForTimeout(500);
  await pg.locator('[data-testid=auto-key]').click();
  tl = timelineRow(await L.readStore(pg));
  const aClip = () => vclips().find((c) => c.name === 'clipA.mp4');
  info('A row non-null: ' + JSON.stringify(Object.fromEntries(Object.entries(aClip()).filter(([k, v]) => v != null && v !== 0 && !/id$/.test(k)))).slice(0, 700));

  // ---------- Stage 6: vendored GL transition with params between A and B ----------
  await selectVideoCard(pg, 'clipA.mp4');
  const trs = pg.locator('[data-testid=clip-transition]');
  await trs.scrollIntoViewIfNeeded();
  await trs.locator('input[type=search]').fill('directional'); await pg.waitForTimeout(400);
  await pg.locator('[data-testid="tr-pick-glt-directional-wipe"]').click(); await pg.waitForTimeout(400);
  await trs.locator('select[aria-label=Direction]').selectOption('right'); await pg.waitForTimeout(200);
  const sm = trs.locator('input[aria-label=smoothness]'); if (await sm.count()) await sm.fill('0');
  await trs.getByText('Add transition').click(); await pg.waitForTimeout(1000);
  tl = timelineRow(await L.readStore(pg));
  const tr0 = (tl.transitions || [])[0];
  info('transition row: ' + JSON.stringify(tr0));
  assert(!!tr0 && /glt-directional-wipe/.test(JSON.stringify(tr0)), 'vendored GL transition (directional wipe, params) stored between the two clips');
  { const bv = tl.clips.find((c) => c.name === 'clipB.mp4'); const ba = tl.clips.find((c) => c.name === 'clipB.mp4 (audio)');
    assert(Math.abs(bv.start_time - ba.start_time) < 0.002, 'adding the transition keeps clip B picture and its audio in sync: ' + bv.start_time + ' vs ' + ba.start_time); }

  // ---------- Stage 4: master volume + clip EQ ----------
  await pg.locator('[data-testid=s4-open]').click({ force: true });
  await pg.locator('[data-testid=s4-tab-audio]').click(); await pg.waitForTimeout(500);
  await pg.locator('[data-testid=master-volume]').fill('50'); await pg.waitForTimeout(400);
  await selectVideoCard(pg, 'clipA.mp4'); await pg.waitForTimeout(400);
  await pg.locator('[data-testid=eq-preset]').selectOption({ index: 1 }); await pg.waitForTimeout(600);
  await pg.locator('[data-testid=eq-freq-1]').fill('440'); await pg.locator('[data-testid=eq-gain-1]').fill('-12'); await pg.waitForTimeout(600); // notch the 440 Hz tone so the export check can see the EQ
  tl = timelineRow(await L.readStore(pg));
  assert(Math.abs((tl.master_volume ?? 1) - 0.5) < 0.01, 'master volume 50% saved: ' + tl.master_volume);
  const aAud = tl.clips.find((c) => c.name === 'clipA.mp4 (audio)');
  assert(!!aAud && JSON.stringify(aAud).includes('"eq') , 'clip EQ saved on A audio');
  await pg.screenshot({ path: SP + 'combined-edit.png' });

  // ---------- save + reload + persistence ----------
  await pg.keyboard.press('Control+s'); await pg.waitForTimeout(1500);
  const before = timelineRow(await L.readStore(pg));
  fs.writeFileSync(SP + 'saved-project.json', JSON.stringify(before, null, 1));
  const keyOf = (c) => JSON.stringify(Object.fromEntries(Object.entries(c).filter(([k]) => !/^(id|timeline_id)$/.test(k))));

  // ---------- real export with everything ----------
  const final = await runExport(pg, 'final');
  assert(!!final, 'final export produced a file: ' + final);
  if (baseline && final) {
    const r = require('child_process').spawnSync('python3', ['-I', __dirname + '/combined-analyze.py', SP], { encoding: 'utf8', maxBuffer: 1 << 24 });
    if (r.status !== 0) { assert(false, 'export analysis ran: ' + (r.stderr || '').slice(0, 300)); } else {
      const an = JSON.parse(r.stdout); fs.writeFileSync(SP + 'combined-export-analysis.json', JSON.stringify(an, null, 1));
      an.checks.forEach((c) => assert(c.ok, 'EXPORT: ' + c.msg)); info('numbers ' + JSON.stringify(an.numbers));
    }
  }

  // ---------- reload and re-open ----------
  await L.goTimeline(pg);
  await pg.reload(); await pg.waitForSelector('.pm-window', { timeout: 90000 }); await pg.waitForTimeout(3000);
  const stored = timelineRow(await L.readStore(pg));
  assert(keyOf(stored.clips.find((c) => c.name === 'clipA.mp4')) === keyOf(before.clips.find((c) => c.name === 'clipA.mp4')), 'clip A row identical after reload');
  assert(JSON.stringify(stored.transitions) === JSON.stringify(before.transitions) && stored.master_volume === before.master_volume, 'transition + master volume identical after reload');
  // open the project through the real UI and check the editor shows 4 clips, the transition and the effects
  await pg.evaluate(() => [...document.querySelectorAll('.pm-card, [class*=pm-project], [class*=project-card]')][0]?.click());
  await pg.waitForTimeout(500);
  await L.clickBtn(pg, '^Open$'); await pg.waitForTimeout(5000);
  await L.clickBtn(pg, '^EDIT$'); await pg.waitForTimeout(3500);
  const reCards = await pg.locator('.clip-card').count();
  assert(reCards === 4, 'reloaded project opens with 4 clip cards (got ' + reCards + ')');
  await selectVideoCard(pg, 'clipB.mp4'); await openInspector(pg);
  assert((await pg.locator('[data-testid=clip-effects]').getByText('Exposure').count()) > 0 && (await pg.locator('[data-testid=clip-effects]').getByText('Frosted Glass').count()) > 0, 'reloaded editor shows the saved effects on clip B');
  await selectVideoCard(pg, 'clipA.mp4');
  assert((await pg.locator('[data-testid=clip-transition]').getByText('Remove transition').count()) > 0, 'reloaded editor shows the saved transition');

  // ---------- old-format project still loads: strip every field the new stages added, reload, open ----------
  await pg.evaluate(() => new Promise((res, rej) => {
    const r = indexedDB.open('remix-cinegen-web', 1);
    r.onsuccess = () => { const db = r.result; const tx = db.transaction('kv', 'readwrite'); const st = tx.objectStore('kv'); const ks = st.getAllKeys();
      ks.onsuccess = () => { const k = ks.result.find((x) => /project\.json$/.test(x)); const g = st.get(k); g.onsuccess = () => {
        const p = JSON.parse(g.result); const t = p.timelines[0];
        for (const c of t.clips) for (const f of ['anim_json', 'anim', 'stage1_json', 'stage4_json', 'gl_params_json', 'eq', 'eq_json', 'fx', 'fx_json']) delete c[f];
        for (const f of ['master_volume', 'masterVolume']) delete t[f];
        for (const tr of t.transitions || []) { delete tr.gl_params_json; delete tr.gl_type; delete tr.glParams; delete tr.glType; }
        st.put(JSON.stringify(p), k); }; };
      tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error); };
  }));
  const pre = cons.length;
  await pg.reload(); await pg.waitForTimeout(6000);
  if (await pg.locator('.pm-window').count()) { await pg.evaluate(() => [...document.querySelectorAll('.pm-card, [class*=pm-project], [class*=project-card]')][0]?.click()); await L.clickBtn(pg, '^Open$'); await pg.waitForTimeout(5000); }
  await L.clickBtn(pg, '^EDIT$'); await pg.waitForTimeout(3500);
  assert((await pg.locator('.clip-card').count()) === 4, 'old-format project (new fields stripped) still loads with 4 clips');
  const newErrs = cons.slice(pre).filter((m) => !/Supabase|Clerk|MUAPI|favicon|Failed to load resource|net::ERR|blob:|Retrying failed fetch/i.test(m));
  assert(newErrs.length === 0, 'no new page errors while loading the old-format project ' + JSON.stringify(newErrs.slice(0, 3)));

  fs.writeFileSync(SP + 'combined-results.json', JSON.stringify({ results, failed, baseline, final, console: cons.filter((m) => !/Supabase|Clerk|MUAPI/i.test(m)).slice(0, 40) }, null, 1));
  await b.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('ERR', e); process.exit(2); });
