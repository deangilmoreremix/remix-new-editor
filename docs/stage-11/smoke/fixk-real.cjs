/* Fix K real-browser checks: (1) caption picker (Spoken language / Speech model selects) wired into Generate captions with a real Whisper model;
 * (2) scene-search vectors persisted in IndexedDB and reused after a reload (CLIP).
 * Models are downloaded from huggingface.co through the Local AI consent UI. Run: SMOKE_PORT=3190 SMOKE_DIR=<dir with scenes.mp4 (speech audio)>/ CHROMIUM_PATH=... node fixk-real.cjs
 * STAGES=captions,persist selects the parts. */
const L = require('../../stage-8/smoke/combined-lib.cjs');
const SP = L.SP; const stages = (process.env.STAGES || 'captions,persist').split(',');
let failed = 0; const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) failed++; };
const dom = (pg, sel) => pg.evaluate((q) => document.querySelector(q).click(), sel);
const statusOf = (pg, id) => pg.locator(`[data-testid="ai-status-${id}"]`).innerText();
async function install(pg, id) {
  const isInst = (t) => /installed/.test(t) && !/not installed/.test(t);
  if (isInst(await statusOf(pg, id))) return;
  await dom(pg, `[data-testid="ai-download-${id}"]`); await dom(pg, `[data-testid="ai-accept-${id}"]`);
  await pg.waitForFunction(([i]) => (/installed/.test(document.querySelector(`[data-testid="ai-status-${i}"]`)?.textContent || '') && !/not installed/.test(document.querySelector(`[data-testid="ai-status-${i}"]`)?.textContent || '')), [id], { timeout: 600000 });
}
const openDock = async (pg, tab) => {
  if (!(await pg.locator(`[data-testid=${tab}]`).count())) { await dom(pg, '[data-testid=s4-open]'); await pg.waitForSelector(`[data-testid=${tab}]`, { timeout: 20000 }); }
  await dom(pg, `[data-testid=${tab}]`);
};
const detect = async (pg) => { await dom(pg, '[data-testid=scene-detect]'); await pg.waitForFunction(() => /scenes? found/.test(document.querySelector('[data-testid=scene-msg]')?.textContent || ''), null, { timeout: 120000 }); };
(async () => {
  const { b, pg, cons } = await L.launch();
  await pg.addInitScript(() => { window.__embedMsgs = 0; const o = Worker.prototype.postMessage; Worker.prototype.postMessage = function (m, ...r) { try { if (m && m.type === 'embed-images') window.__embedMsgs += 1; } catch {} return o.call(this, m, ...r); }; });
  await L.goTimeline(pg); await L.newProject(pg, 'fixk-' + Date.now().toString(36));
  await L.addVideo(pg, SP + 'scenes.mp4');
  if (stages.includes('captions')) {
    await openDock(pg, 's4-tab-ai'); await pg.waitForSelector('[data-testid=local-ai-panel]');
    await install(pg, 'whisper-tiny-en'); await install(pg, 'whisper-tiny');
    await openDock(pg, 's4-tab-scenes'); await detect(pg);
    await pg.locator('[data-testid=scene-card]').first().locator('button', { hasText: 'Add to timeline' }).evaluate((el) => el.click()); await pg.waitForTimeout(1500);
    await dom(pg, '[data-testid=s4-open]'); await pg.keyboard.press('Escape'); await pg.evaluate(() => document.querySelector('.element-modal__backdrop')?.click()); await pg.waitForTimeout(600);
    const card = pg.locator('.clip-card').filter({ hasNotText: '(audio)' }).first();
    await card.click({ position: { x: 25, y: 20 } }); await pg.waitForTimeout(800);
    const ins = pg.locator('[title="Show inspector"]'); if (await ins.count()) await ins.first().evaluate((el) => el.click());
    await pg.waitForSelector('[data-testid=clip-captions]', { timeout: 20000 });
    const lang = pg.locator('[data-testid=caption-spoken-language]'); const model = pg.locator('[data-testid=caption-speech-model]');
    assert(await lang.count() === 1 && await model.count() === 1, 'Spoken language and Speech model selects are shown before captions exist');
    const langs = await lang.evaluate((e) => [...e.options].map((o) => o.value)); const models = await model.evaluate((e) => [...e.options].map((o) => o.text));
    console.log('languages', langs.join(','), '| models', JSON.stringify(models));
    assert(langs[0] === 'auto' && langs.includes('es') && langs.includes('en'), 'language list has auto + languages');
    assert(models.length === 3 && /best installed/i.test(models[0]), 'model list = best installed + the 2 installed Whisper models (' + models.length + ')');
    const gen = () => pg.locator('[data-testid=clip-captions] button', { hasText: 'Generate captions' }).evaluate((el) => el.click());
    const result = () => pg.waitForFunction(() => /words captioned|No speech|Open Media tools|English only|failed|cannot/i.test(document.querySelector('[data-testid=clip-captions]')?.textContent || ''), null, { timeout: 180000 }).then(() => pg.locator('[data-testid=clip-captions]').innerText());
    // wired language: English-only model + Spanish -> the pipeline's own "English only" error (proves both selects reach the transcriber)
    await model.selectOption({ label: models.find((m) => /\.en|English/i.test(m)) || models[1] }); await lang.selectOption('es'); await gen();
    const t1 = (await result()).replace(/\s+/g, ' '); console.log('en-only + es ->', t1.slice(0, 160));
    assert(/English only/i.test(t1), 'English-only model + Spanish is refused with the English-only message (language + model reach the transcriber)');
    // multilingual model + auto: succeeds
    await pg.waitForTimeout(500);
    await model.selectOption({ label: models.find((m) => /tiny/i.test(m) && !/\.en|English/i.test(m)) || models[2] }); await lang.selectOption('auto'); await gen();
    const t2 = (await result()).replace(/\s+/g, ' '); console.log('multilingual + auto ->', t2.slice(0, 160));
    assert(/\d+ words captioned/.test(t2), 'multilingual model + auto-detect produced captions');
  }
  if (stages.includes('persist')) {
    await openDock(pg, 's4-tab-ai'); await install(pg, 'clip-vit-b32');
    await openDock(pg, 's4-tab-scenes'); await detect(pg);
    await dom(pg, '[data-testid=scene-index]'); await pg.waitForFunction(() => /Visual search ready/.test(document.querySelector('[data-testid=scene-msg]')?.textContent || ''), null, { timeout: 240000 });
    const first = await pg.evaluate(() => window.__embedMsgs); assert(first >= 1, 'first indexing embeds the thumbnails (' + first + ' embed requests)');
    await pg.waitForTimeout(1500);
    const rows = await pg.evaluate(() => new Promise((res) => { const r = indexedDB.open('cinegen-scene-vectors'); r.onerror = () => res(-1); r.onsuccess = () => { try { const q = r.result.transaction('vectors').objectStore('vectors').count(); q.onsuccess = () => res(q.result); } catch { res(-2); } }; }));
    assert(rows >= 4, 'vectors are stored in IndexedDB (' + rows + ' rows)');
    await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(8000);
    await pg.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'EDIT')?.click()); await pg.waitForTimeout(2500);
    await openDock(pg, 's4-tab-scenes'); await detect(pg);
    const before = await pg.evaluate(() => window.__embedMsgs); assert(before === 0, 'new page session starts with 0 embed requests (' + before + ')');
    await dom(pg, '[data-testid=scene-index]'); await pg.waitForFunction(() => /Visual search ready/.test(document.querySelector('[data-testid=scene-msg]')?.textContent || ''), null, { timeout: 240000 });
    const after = await pg.evaluate(() => window.__embedMsgs);
    console.log('index msg after reload:', await pg.locator('[data-testid=scene-msg]').innerText());
    assert(after === 0, 'after a reload, indexing reuses the saved vectors: 0 embed requests (' + after + ')');
    await pg.locator('[data-testid=scene-search]').fill('a red screen'); await pg.waitForTimeout(3500);
    assert((await pg.locator('[data-testid=scene-card]').count()) >= 1, 'search with the reloaded vectors returns scenes');
  }
  console.log('console errors', JSON.stringify(cons.filter((c) => !/Supabase|ERR_TUNNEL/.test(c)).slice(0, 5)));
  await b.close(); console.log(failed ? 'FAILED ' + failed : 'ALL PASS'); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('SMOKE CRASH', e); process.exit(2); });
