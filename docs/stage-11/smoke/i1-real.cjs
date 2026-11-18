// Port I1 real-browser smoke (headless Chromium, vite dev server). Run: SMOKE_PORT=3130 SMOKE_DIR=<dir with scenes.mp4 + jfk16.wav> CHROMIUM_PATH=... node i1-real.cjs
// Downloads REAL models from huggingface.co through the Local AI panel (consent flow), transcribes a real public-domain speech clip (JFK, 11 s) and runs
// CLIP scene search + SmolVLM captions on a 4-scene clip built from sample photos. STAGES=asr,cancel,clip,caption selects which parts run.
const fs = require('fs');
const L = require('../../stage-8/smoke/combined-lib.cjs');
const SP = L.SP;
const stages = (process.env.STAGES || 'asr,cancel,clip,caption').split(',');
const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const dom = (pg, sel) => pg.evaluate((q) => document.querySelector(q).click(), sel);
const statusOf = (pg, id) => pg.locator(`[data-testid="ai-status-${id}"]`).innerText();
const waitStatus = (pg, id, re, ms) => pg.waitForFunction(([i, r]) => new RegExp(r).test(document.querySelector(`[data-testid="ai-status-${i}"]`)?.textContent || ''), [id, re], { timeout: ms });
async function install(pg, id, ms = 600000) {
  await dom(pg, `[data-testid="ai-download-${id}"]`);
  const consent = await pg.locator(`[data-testid="ai-consent-${id}"]`).innerText();
  console.log(`consent text for ${id}:`, consent.replace(/\s+/g, ' ').slice(0, 240));
  assert(/licensed/.test(consent) && /huggingface\.co/.test(consent) && /MB/.test(consent), `${id}: consent prompt shows size, source URL and licence`);
  await dom(pg, `[data-testid="ai-accept-${id}"]`);
  const t0 = Date.now(); let sawProgress = false;
  while (Date.now() - t0 < ms) {
    const s = await statusOf(pg, id);
    if (/downloading/.test(s)) sawProgress = true;
    if (/installed/.test(s)) break;
    const er = await pg.locator(`[data-testid="ai-error-${id}"]`).innerText().catch(() => '');
    if (er) throw new Error(`${id} failed: ${er}`);
    await pg.waitForTimeout(500);
  }
  console.log(`${id} status:`, await statusOf(pg, id), `(${Math.round((Date.now() - t0) / 1000)} s)`);
  assert(/installed/.test(await statusOf(pg, id)), `${id} installed after consent`);
  const files = await pg.evaluate(() => new Promise((res) => { const r = indexedDB.open('cinegen-local-ai'); r.onsuccess = () => { const q = r.result.transaction('meta').objectStore('meta').getAll(); q.onsuccess = () => res(q.result.map((m) => [m.repo, m.key.split('/resolve/main/')[1], m.size])); }; }));
  const mine = files.filter((f) => f[2] > 0).sort((a, b) => b[2] - a[2]);
  console.log(`MEASURED ${id}: ${Math.round(mine.reduce((a, f) => a + f[2], 0) / 1048576)} MB in ${mine.length} files; largest:`, mine.slice(0, 5).map((f) => `${f[1]}=${Math.round(f[2] / 1048576)}MB`).join(', '));
  return sawProgress;
}
(async () => {
  const { b, pg, cons } = await L.launch();
  pg.on('response', (x) => { if (x.status() >= 400 && !/supabase|favicon/.test(x.url())) console.log('HTTP', x.status(), x.url().slice(0, 150)); });
  pg.on('requestfailed', (x) => { if (!/supabase|gstatic|google/.test(x.url())) console.log('REQFAIL', x.url().slice(0, 150), x.failure()?.errorText); });
  await L.goTimeline(pg); await L.newProject(pg, 'i1-real');
  await L.addVideo(pg, SP + 'scenes.mp4');
  await pg.evaluate(() => document.querySelector('[data-testid=s4-open]').click());
  await dom(pg, '[data-testid=s4-tab-ai]');
  await pg.waitForSelector('[data-testid=local-ai-panel]');
  const caps = await pg.locator('[data-testid=local-ai-caps]').innerText();
  console.log('capabilities:', caps.replace(/\n/g, ' | '));
  assert(/WebGPU/.test(caps) && /WASM threads/.test(caps), 'capability panel shown');
  const cards = await pg.locator('[data-testid^=ai-model-]').count();
  assert(cards === 7, 'all 7 catalogue entries listed (got ' + cards + ')');
  assert(/not offered/.test(await statusOf(pg, 'lfm2.5-vl-450m')) && (await pg.locator('[data-testid="ai-download-lfm2.5-vl-450m"]').count()) === 0, 'restricted-licence model has no download button');
  assert((await pg.locator('[data-testid="ai-download-whisper-tiny-en"]').count()) === 1, 'verified model has a Download button, nothing downloaded yet');
  const idb0 = await pg.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  console.log('IndexedDB databases before any consent:', idb0.join(','));

  if (stages.includes('cancel')) {
    // cancel a real download mid-way (smolvlm-256m is ~260 MB, big enough to catch in flight)
    const id = 'smolvlm-256m';
    await dom(pg, `[data-testid="ai-download-${id}"]`);
    await dom(pg, `[data-testid="ai-accept-${id}"]`);
    let seen = '';
    for (let i = 0; i < 600; i++) { const st = await statusOf(pg, id); if (/downloading [1-9]/.test(st)) { seen = st; break; } if (/installed/.test(st)) break; await pg.waitForTimeout(50); }
    console.log(id, 'status when cancelling:', seen || await statusOf(pg, id));
    assert(!!seen, 'a real download shows progress');
    await dom(pg, `[data-testid="ai-cancel-${id}"]`);
    await pg.waitForTimeout(2000);
    const s2 = await statusOf(pg, id);
    const used = await pg.evaluate(() => new Promise((res) => { const r = indexedDB.open('cinegen-local-ai'); r.onsuccess = () => { const q = r.result.transaction('meta').objectStore('meta').getAll(); q.onsuccess = () => res(q.result.length); }; }));
    assert(/not installed/.test(s2), 'cancelled real download -> not installed (' + s2 + ')');
    assert(used === 0, 'cancel left no partial model files in IndexedDB (' + used + ' files)');
  }

  if (stages.includes('asr')) {
    await install(pg, 'whisper-tiny-en');
    const bytes = await pg.evaluate(() => new Promise((res) => { const r = indexedDB.open('cinegen-local-ai'); r.onsuccess = () => { const q = r.result.transaction('meta').objectStore('meta').getAll(); q.onsuccess = () => res(q.result.reduce((a, m) => a + m.size, 0)); }; }));
    console.log('cached bytes in IndexedDB:', bytes);
    assert(bytes > 20e6, 'model files cached in IndexedDB (' + Math.round(bytes / 1e6) + ' MB)');
    const wav = fs.readFileSync(SP + 'jfk16.wav').toString('base64');
    const out = await pg.evaluate(async (b64) => {
      const { transcribeAsset } = await import('/src/cinegen/lib/local-ai/clip-transcribe.ts');
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bin], { type: 'audio/wav' }));
      const prog = []; const t0 = performance.now();
      const r = await transcribeAsset(url, { onProgress: (p) => prog.push(p.stage + ':' + p.progress.toFixed(2)) });
      const ms = Math.round(performance.now() - t0);
      // cancellation of a second run
      const ac = new AbortController(); const p2 = transcribeAsset(url, { signal: ac.signal }); setTimeout(() => ac.abort(), 300);
      let cancelled = null; try { await p2; } catch (e) { cancelled = e.name; }
      return { text: r.text, words: r.words, captions: r.captions.slice(0, 3), n: r.captions.length, backend: r.backend, modelId: r.modelId, language: r.language, segs: r.segments.map((s) => s.text), prog, ms, cancelled };
    }, wav);
    console.log('transcript:', JSON.stringify(out.text), '| backend', out.backend, '| ms', out.ms, '| progress', out.prog.join(','));
    console.log('first words:', JSON.stringify(out.words.slice(0, 4)));
    const norm = out.text.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ');
    assert(/ask not what your country can do for you/.test(norm), 'REAL transcript contains the JFK line "ask not what your country can do for you"');
    assert(/ask what you can do for your country/.test(norm), 'REAL transcript contains "ask what you can do for your country"');
    const w = out.words; let mono = true; for (let i = 1; i < w.length; i++) if (w[i].start < w[i - 1].start - 1e-6) mono = false;
    assert(w.length >= 15 && mono && w[0].start >= 0 && w[w.length - 1].end <= 11.5, `word timestamps present and monotonic (${w.length} words, ${w[0].start.toFixed(2)}s to ${w[w.length - 1].end.toFixed(2)}s)`);
    assert(out.captions[0].startMs >= 0 && out.captions[1].text.startsWith(' '), 'Remotion caption shape (ms, leading spaces)');
    assert(out.cancelled === 'AbortError', 'a second run aborted mid-flight rejects with AbortError (' + out.cancelled + ')');
  }

  if (stages.includes('clip')) {
    await install(pg, 'clip-vit-b32');
    await dom(pg, '[data-testid=s4-tab-scenes]');
    await dom(pg, '[data-testid=scene-detect]');
    await pg.waitForFunction(() => /scenes? found/.test(document.querySelector('[data-testid=scene-msg]')?.textContent || ''), null, { timeout: 90000 });
    const n = await pg.locator('[data-testid=scene-card]').count();
    assert(n === 4, 'scene detection found 4 scenes (got ' + n + ')');
    const t0 = Date.now();
    await dom(pg, '[data-testid=scene-index]');
    await pg.waitForFunction(() => /Visual search ready/.test(document.querySelector('[data-testid=scene-msg]')?.textContent || ''), null, { timeout: 180000 });
    console.log('index msg:', await pg.locator('[data-testid=scene-msg]').innerText(), `(${Math.round((Date.now() - t0) / 1000)} s)`);
    const ask = async (q) => { await pg.locator('[data-testid=scene-search]').fill(q); await pg.waitForTimeout(3500); return pg.locator('[data-testid=scene-card] div[role=button]').first().getAttribute('aria-label'); };
    for (const [q, want] of [['a tiger', 'scene 1'], ['a beach by the sea', 'scene 2'], ['a city street with buildings', 'scene 3'], ['a football match', 'scene 4']]) {
      const first = await ask(q);
      const order = await pg.locator('[data-testid=scene-card] div[role=button]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').replace(/.*scene /, 's')));
      const pct = await pg.locator('[data-testid=scene-card]').evaluateAll((els) => els.map((e) => (e.textContent.match(/match \d+%/) || [''])[0]));
      console.log(`query "${q}" -> first result: ${first}; order ${order.join(',')}; ${pct.join(' ')}`);
      assert(new RegExp(want).test(first || ''), `semantic search "${q}" ranks ${want} first`);
      assert(order.slice(0, 2).includes('s' + want.slice(-1)), `  ... and ${want} is in the top 2`);
    }
    await pg.locator('[data-testid=scene-search]').fill('tag:zzz'); await pg.waitForTimeout(500);
    assert((await pg.locator('[data-testid=scene-card]').count()) === 0, 'structured tag: search still works (metadata only)');
    await pg.locator('[data-testid=scene-search]').fill('');
    if (process.env.SMOKE_SHOTS) await pg.screenshot({ path: SP + 'i1-scenes.png' });
  }

  if (stages.includes('caption')) {
    await dom(pg, '[data-testid=s4-tab-ai]');
    await install(pg, 'smolvlm-256m');
    await dom(pg, '[data-testid=s4-tab-scenes]');
    if (!(await pg.locator('[data-testid=scene-card]').count())) { await dom(pg, '[data-testid=scene-detect]'); await pg.waitForFunction(() => /scenes? found/.test(document.querySelector('[data-testid=scene-msg]')?.textContent || ''), null, { timeout: 90000 }); }
    await pg.waitForSelector('[data-testid=scene-caption]');
    const t0 = Date.now();
    await dom(pg, '[data-testid=scene-caption]');
    await pg.waitForFunction(() => /Scene captions written|Captioning failed/.test(document.querySelector('[data-testid=scene-msg]')?.textContent || ''), null, { timeout: 900000 });
    console.log('caption msg:', await pg.locator('[data-testid=scene-msg]').innerText(), `(${Math.round((Date.now() - t0) / 1000)} s)`);
    const caps = await pg.locator('[data-testid=scene-caption-text]').allInnerTexts();
    console.log('captions:', JSON.stringify(caps));
    assert(caps.length === 4 && caps.every((c) => c.length > 5), 'every scene got a non-empty caption');
  }

  if (stages.includes('uicap')) {
    // the real inspector path: Add to timeline, select the clip, Captions > Generate captions (uses the installed local model, no implicit download)
    await dom(pg, '[data-testid=s4-tab-ai]');
    await install(pg, 'whisper-tiny-en');
    await dom(pg, '[data-testid=s4-tab-scenes]');
    await dom(pg, '[data-testid=scene-detect]');
    await pg.waitForFunction(() => /scenes? found/.test(document.querySelector('[data-testid=scene-msg]')?.textContent || ''), null, { timeout: 90000 });
    await pg.locator('[data-testid=scene-card]').first().locator('button', { hasText: 'Add to timeline' }).evaluate((el) => el.click());
    await pg.waitForTimeout(1500);
    await dom(pg, '[data-testid=s4-open]'); // close the dock
    await pg.keyboard.press('Escape'); await pg.evaluate(() => [...document.querySelectorAll('.element-modal__backdrop button')].find((x) => /×|close/i.test(x.innerText + x.getAttribute('aria-label')))?.click()); await pg.evaluate(() => document.querySelector('.element-modal__backdrop')?.click()); await pg.waitForTimeout(600);
    const card = pg.locator('.clip-card').filter({ hasNotText: '(audio)' }).first();
    await card.click({ position: { x: 25, y: 20 } }); await pg.waitForTimeout(800);
    const ins = pg.locator('[title="Show inspector"]'); if (await ins.count()) await ins.first().evaluate((el) => el.click());
    await pg.waitForSelector('[data-testid=clip-captions]', { timeout: 20000 }).catch(async (e) => {
      console.log('cards:', JSON.stringify(await pg.locator('.clip-card').allInnerTexts()), 'inspector toggles:', await pg.locator('[title="Show inspector"]').count(), 'panel text:', (await pg.locator('.clip-properties-panel').first().innerText().catch(() => 'none')).slice(0, 200));
      await pg.screenshot({ path: SP + 'i1-debug.png' }); throw e; });
    // without a model the same button must NOT download anything: covered by unit tests; here the model is installed
    await pg.locator('[data-testid=clip-captions] button', { hasText: 'Generate captions' }).evaluate((el) => el.click());
    await pg.waitForFunction(() => /words captioned|No speech|Open Media tools|failed|cannot/i.test(document.querySelector('[data-testid=clip-captions]')?.textContent || ''), null, { timeout: 120000 });
    const txt = await pg.locator('[data-testid=clip-captions]').innerText();
    console.log('inspector captions section:', txt.replace(/\s+/g, ' ').slice(0, 200));
    assert(/\d+ words captioned/.test(txt), 'inspector "Generate captions" produced captions from the local model');
    const n = Number((/(\d+) words captioned/.exec(txt) || [])[1]);
    assert(n >= 3, `${n} words captioned for the 2 s scene (words from the real speech)`);
    // existing caption styles and the Stage 2 text-motion presets apply on the generated captions
    const style = pg.locator('[data-testid=clip-captions] select[aria-label="Caption style"]');
    const before = await style.inputValue();
    await style.selectOption({ index: 6 }); await pg.waitForTimeout(500);
    const after = await style.inputValue();
    console.log('caption style', before, '->', after);
    assert(before !== after, 'caption style can be changed on the generated captions');
    const sels = await pg.locator('[data-testid=clip-captions] select').evaluateAll((els) => els.map((e) => [e.getAttribute('aria-label'), e.value, [...e.options].map((o) => o.text).join('|').slice(0, 120)]));
    console.log('caption selects:', JSON.stringify(sels));
    const mot = sels.findIndex((x) => /motion|animation/i.test(x[0] || ''));
    if (mot >= 0) { const sm = pg.locator('[data-testid=clip-captions] select').nth(mot); const m0 = await sm.inputValue(); await sm.selectOption({ index: 5 }, { force: true, timeout: 5000 }); await pg.waitForTimeout(400); const m1 = await sm.inputValue(); console.log('motion', m0, '->', m1); assert(m0 !== m1, 'Stage 2 motion preset can be changed on the generated captions'); }
    const lines = await pg.locator('[data-testid=clip-captions]').innerText();
    assert(/fellow|And so|my/i.test(lines), 'the caption editor shows the transcribed words');
    if (process.env.SMOKE_SHOTS) await pg.screenshot({ path: SP + 'i1-captions.png' });
  }

  if (stages.includes('delete')) {
    await dom(pg, '[data-testid=s4-tab-ai]');
    await dom(pg, '[data-testid="ai-delete-whisper-tiny-en"]'); await pg.waitForTimeout(1000);
    assert(/not installed/.test(await statusOf(pg, 'whisper-tiny-en')), 'delete model -> not installed');
  }
  console.log('console errors:', JSON.stringify(cons.slice(0, 8)));
  await b.close();
})().catch((e) => { console.log('FAIL fatal', e.message); process.exitCode = 1; });
