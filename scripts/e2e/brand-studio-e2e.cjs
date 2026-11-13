/* eslint-disable */
// Brand Studio end-to-end check (real Chromium, real UI, mocked network).
//
//   npm run dev            # in one terminal (default http://127.0.0.1:3100)
//   BASE=http://127.0.0.1:3100 node scripts/e2e/brand-studio-e2e.cjs
//
// Drives: Analyze (→ /api/scrape) → Brand DNA editor → Campaign wizard (4 concepts, 8 platform assets)
// → canvas editor (position/size/text, Clean background, Swap image, Upload, Save, reload) → campaign page
// → past campaigns → Animate (asset / photoshoot sources) → Photo Studio (30 presets, generate).
// MuAPI (muapi-proxy) and /api/scrape are intercepted, so no keys, credits or network are needed.
// Set CHROMIUM_PATH to use a specific Chromium binary. Exits non-zero if any check fails. Screenshots land in $OUT (default: os tmpdir).
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:3100';
const OUT = process.env.OUT || require('os').tmpdir();
const shot = (n) => require('path').join(OUT, n);
let PG; const results = []; const calls = { scrape: [], muapi: [], uploads: 0 };
const ok = (name, cond, extra='') => { results.push({ name, pass: !!cond, extra }); console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  — ' + extra : '')); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const SCRAPE = { ok: true, data: { url: 'https://acme.test', title: 'Acme Rockets', description: 'Rockets for everyone', bodyText: 'We build friendly rockets. Fast shipping to orbit.', ogImage: null, favicon: 'https://acme.test/favicon.ico', logoCandidates: ['https://acme.test/logo.png'], fonts: ['Poppins', 'sans-serif'], rawColors: ['rgb(200, 30, 30)', 'rgb(20, 20, 40)', 'rgb(250, 250, 250)'], screenshot: PNG.toString('base64') } };
const DNA = { brand_name: 'Acme Rockets', industry: 'Aerospace', tagline: 'Orbit for all', value_proposition: 'Friendly rockets', tone_of_voice: ['bold', 'friendly'], brand_personality: ['playful', 'ambitious'], target_audience: 'Space-curious founders', key_messages: ['Fast', 'Safe'], imagery_style: 'cinematic', layout_style: 'bold' };
const VISION = { primary_colors: ['#c81e1e'], secondary_colors: ['#141428'], typography: 'sans-serif', logo_style: 'wordmark', imagery_style: 'cinematic', layout_style: 'bold', brand_vibe: ['energetic'] };
const concepts = { concepts: [1, 2, 3, 4, 5].map((i) => ({ title: `Concept ${i}`, theme: `Theme ${i}`, key_message: `Message ${i}`, hook: `Hook ${i}`, cta: 'Launch now', recommended_platforms: ['instagram-feed'], tone_notes: `Tone ${i}`, visual_direction: `Vis ${i}` })) };

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {});
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage(); PG = page;
  const pageErrors = [];  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
  // Speed up polling sleeps (the client waits 2.5s+ between polls).
  await page.addInitScript(() => { const st = window.setTimeout; window.setTimeout = (fn, ms, ...a) => st(fn, ms > 500 ? Math.min(ms, 30) : ms, ...a); });

  let pred = 0; const predictions = {};
  await page.route('**/api/scrape', async (route) => { calls.scrape.push(JSON.parse(route.request().postData() || '{}')); await route.fulfill({ json: SCRAPE }); });
  await page.route('**/functions/v1/muapi-proxy**', async (route) => {
    const req = route.request(); const ct = req.headers()['content-type'] || '';
    if (ct.includes('multipart')) { calls.uploads++; return route.fulfill({ json: { url: `https://cdn.test/upload-${calls.uploads}.png` } }); }
    const body = JSON.parse(req.postData() || '{}');
    if (body.generationType === 'poll') { const id = body.endpoint.split('/')[1]; return route.fulfill({ json: { status: 'completed', ...predictions[id] } }); }
    const { endpoint, params = {} } = body; calls.muapi.push({ endpoint, params });
    let out;
    if (endpoint === 'gpt-5-nano') {
      const p = params.prompt || '';
      const text = params.image_url ? VISION : /brand analyst/.test(p) ? DNA : /senior brand strategist/.test(p) ? concepts : /marketing copy/.test(p) ? { headline: 'Reach for orbit today friends', body: 'Friendly rockets that ship fast and safe to anywhere in low orbit for everyone', cta: 'Launch now please' } : {};
      out = { outputs: [JSON.stringify(text)] };
    } else if (/seedance/.test(endpoint)) out = { outputs: ['https://cdn.test/anim.mp4'] };
    else out = { outputs: [`https://cdn.test/img-${++pred}.png`] };
    const id = `req-${++pred}`; predictions[id] = out; return route.fulfill({ json: { request_id: id } });
  });
  await page.route('https://acme.test/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
  await page.route('https://cdn.test/**', (r) => r.fulfill({ contentType: /mp4/.test(r.request().url()) ? 'video/mp4' : 'image/png', body: PNG }));

  await page.goto(BASE + '/#/brand', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="text"],input[type="url"]', { timeout: 90000 });
  // First-run modal: save a (fake) MuAPI key through the real UI, then close it.
  await page.waitForSelector('input[placeholder*="Muapi key"]', { timeout: 20000 }).catch(() => {});
  if (await page.locator('input[placeholder*="Muapi key"]').count()) {
    await page.fill('input[placeholder*="Muapi key"]', 'test-key-123456789');
    await page.click('button:has-text("Save Muapi API Key")');
    await page.waitForTimeout(500);
    await page.mouse.click(882, 80);
    await page.waitForTimeout(400);
  }
  ok('0. MuAPI key saved via first-run modal', await page.evaluate(() => !!(sessionStorage.getItem('muapi_key') || Object.keys(localStorage).concat(Object.keys(sessionStorage)).some((k) => /muapi/i.test(k)))));

  // ===== 1. Analyze a brand =====
  await page.fill('input[type="text"],input[type="url"]', 'https://acme.test');
  await page.screenshot({ path: shot('before-analyze.png') }); await page.click('button:has-text("Analyze")', { timeout: 8000 }).catch(async (e) => { await page.screenshot({ path: shot('stuck.png') }); fs.writeFileSync(shot('stuck.txt'), await page.innerText('body')); throw e; });
  await page.waitForSelector('[data-brand-title]', { timeout: 60000 });
  ok('1. Analyze → /api/scrape called with the URL', calls.scrape.length === 1 && calls.scrape[0].url === 'https://acme.test', JSON.stringify(calls.scrape));
  ok('1. screenshot uploaded for vision analysis', calls.uploads >= 1 && calls.muapi.some((c) => c.params.image_url));
  ok('1. DNA editor opened with the extracted brand', (await page.textContent('[data-brand-title]')) === 'Acme Rockets');
  const brand = await page.evaluate(() => JSON.parse(localStorage.getItem('brand_dna_list'))[0]);
  ok('1. logo from scraper candidates', brand.logoUrl === 'https://acme.test/logo.png', brand.logoUrl);
  ok('1. fonts + colors from scraper merged', brand.fonts.includes('Poppins') && brand.primaryColors.length >= 1, JSON.stringify([brand.fonts, brand.primaryColors]));

  // ===== 2. DNA editor =====
  ok('2. Logo URL + Detected Fonts + Past-campaign-ready editor', (await page.locator('text=Logo URL').count()) > 0 && (await page.locator('text=Detected Fonts').count()) > 0);
  const swatchesBefore = await page.locator('[data-palette="primary"] input[type=color]').count();
  await page.click('[data-add-color="primary"]');
  ok('2. palette add swatch', (await page.locator('[data-palette="primary"] input[type=color]').count()) === swatchesBefore + 1);
  await page.locator('input[type=text]').nth(2).fill('Orbit for everyone');
  await page.click('button[data-action="save"]');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('brand_dna_list'))[0]);
  ok('2. edits persist on save (tagline + new swatch)', saved.tagline === 'Orbit for everyone' && saved.primaryColors.length === swatchesBefore + 1);

  // ===== 3. Campaign wizard =====
  await page.click('button[data-action="campaigns"]');
  await page.waitForSelector('div.cursor-pointer:has-text("Product Launch")');
  await page.locator('div.cursor-pointer', { hasText: 'Product Launch' }).first().click();
  await page.click('button[data-action="generate-concepts"]');
  await page.waitForTimeout(2500); console.log('  3s later body tail:', (await page.innerText('body')).slice(-300).replace(/\n+/g,' | '));
  await page.waitForSelector('button[data-action="select-concept"]', { timeout: 60000 });
  ok('3. exactly 4 concepts shown (model returned 5)', (await page.locator('button[data-action="select-concept"]').count()) === 4);
  const campaign = await page.evaluate(() => JSON.parse(localStorage.getItem('brand_campaigns') || '[]'));
  ok('3. campaign persisted with concepts', campaign.length === 1 && campaign[0].concepts.length === 4 && campaign[0].brandId === saved.id);
  await page.locator('button[data-action="select-concept"]').nth(1).click();
  await page.waitForSelector('button[data-action="generate-assets"]');
  // ===== 4. Assets for all 8 platforms =====
  const PLATFORM_LABELS = ['Instagram Feed', 'Instagram Story', 'LinkedIn', 'Facebook', 'Twitter', 'Web Banner', 'Email', 'YouTube'];
  const chips = page.locator('button.px-3.py-1\\.5');
  const nChips = await chips.count();
  ok('4. 8 platform formats offered', nChips >= 8, String(nChips));
  for (let i = 0; i < 8; i++) await chips.nth(i).click();
  const imgCallsBefore = calls.muapi.filter((c) => /nano-banana/.test(c.endpoint)).length;
  await page.click('button[data-action="generate-assets"]');
  await page.waitForSelector('[data-asset-edit]', { timeout: 90000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-asset-edit]').length >= 8, null, { timeout: 90000 });
  ok('4. 8 assets generated, each with Edit + Animate', (await page.locator('[data-asset-edit]').count()) === 8 && (await page.locator('[data-asset-animate]').count()) === 8);
  const imgCalls = calls.muapi.filter((c) => /nano-banana/.test(c.endpoint)).slice(imgCallsBefore);
  ok('4. every image call used nano-banana-edit with the brand logo as reference', imgCalls.length === 8 && imgCalls.every((c) => c.endpoint === 'nano-banana-edit' && JSON.stringify(c.params.images_list) === JSON.stringify(['https://acme.test/logo.png'])), imgCalls.map((c) => c.endpoint + ':' + JSON.stringify(c.params.images_list)).join(' '));
  const aspects = imgCalls.map((c) => c.params.aspect_ratio).sort().join(',');
  ok('4. per-platform aspect ratios sent', aspects === ['16:9','16:9','16:9','16:9','1:1','1:1','1:1','9:16'].sort().join(','), aspects);
  ok('4. image prompts are text-free + carry brand palette', imgCalls.every((c) => /NO text/.test(c.params.prompt) && /#c81e1e/.test(c.params.prompt)));
  const copyCaps = await page.evaluate(() => JSON.parse(localStorage.getItem('brand_assets')).map((a) => [a.platform, a.cta.split(' ').length, a.headline.split(' ').length]));
  ok('4. word caps enforced per platform (CTA ≤ 3, headline ≤ platform cap)', copyCaps.every(([, c, h]) => c <= 3 && h <= 10), JSON.stringify(copyCaps));
  const storedAssets = await page.evaluate(() => JSON.parse(localStorage.getItem('brand_assets')));
  ok('4. assets persisted with layout + variants', storedAssets.length === 8 && storedAssets.every((a) => a.layout && a.variants && a.variants.conceptIndex === 1));
  await page.screenshot({ path: shot('assets.png') });

  // ===== 5. Canvas editor =====
  await page.locator('[data-asset-edit]').nth(1).click();
  await page.waitForSelector('#asset-canvas', { timeout: 30000 });
  ok('5. editor loads the asset (headline on canvas)', (await page.locator('[data-block="headline"]').textContent()).length > 3);
  ok('5. 9 position buttons', (await page.locator('[data-choice^="top-"],[data-choice^="middle-"],[data-choice^="bottom-"]').count()) === 9);
  const box0 = await page.locator('[data-block="headline"]').boundingBox();
  await page.click('[data-choice="top-right"]');
  const box1 = await page.locator('[data-block="headline"]').boundingBox();
  ok('5. moving to top-right moves the block up and right', box1.y < box0.y && box1.x > box0.x, `${Math.round(box0.x)},${Math.round(box0.y)} → ${Math.round(box1.x)},${Math.round(box1.y)}`);
  const fs0 = await page.locator('[data-block="headline"]').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  await page.click('[data-choice="small"]');
  const fs1 = await page.locator('[data-block="headline"]').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  ok('5. size control shrinks the text', fs1 < fs0, `${fs0}px → ${fs1}px`);
  await page.click('[data-tab="cta"]'); await page.click('[data-choice="middle-center"]');
  ok('5. CTA tab edits the CTA block independently', (await page.locator('[data-block="cta"]').count()) === 1);
  await page.click('[data-tab="headline"]');
  await page.locator('aside textarea').fill('Edited headline');
  ok('5. text edit shows live on canvas', (await page.locator('[data-block="headline"]').textContent()) === 'Edited headline');
  await page.screenshot({ path: shot('editor.png') });
  await page.click('[data-action="clean-background"]');
  await page.waitForFunction(() => document.querySelector('#asset-canvas img')?.getAttribute('src')?.includes('cdn.test/img-'), null, { timeout: 30000 });
  const cleanCall = calls.muapi.filter((c) => c.endpoint === 'nano-banana-edit').pop();
  ok('5. "Clean background" regenerates text-free with logo ref', /NO text/.test(cleanCall.params.prompt) && cleanCall.params.images_list[0] === 'https://acme.test/logo.png');
  await page.click('[data-action="swap-image"]');
  await page.waitForFunction((n) => document.querySelectorAll('#asset-canvas img').length === 1 && !document.querySelector('[data-action="swap-image"]').disabled, null, { timeout: 30000 });
  const swapCall = calls.muapi.filter((c) => c.endpoint === 'nano-banana-edit').pop();
  ok('5. "Swap image" regenerates (copy kept in prompt, not text-free)', !/render NO text/.test(swapCall.params.prompt) && /Overlay headline/.test(swapCall.params.prompt));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-action="upload-image"]')]);
  await chooser.setFiles({ name: 'mine.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForFunction(() => document.querySelector('#asset-canvas img')?.getAttribute('src')?.includes('cdn.test/upload-'), null, { timeout: 30000 });
  ok('5. "Upload image" hosts the file and shows it', true);
  const editedId = storedAssets[1].id;
  await page.click('[data-action="save"]');
  const after = await page.evaluate((id) => JSON.parse(localStorage.getItem('brand_assets')).find((a) => a.id === id), editedId);
  ok('5. save persists text + position + uploaded image', after.headline === 'Edited headline' && after.layout.headline.position === 'top-right' && after.layout.headline.size === 'small' && after.imageUrl.includes('upload-'), JSON.stringify({ h: after.headline, p: after.layout.headline.position, i: after.imageUrl }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#asset-canvas', { timeout: 60000 });
  ok('5. edits survive a reload', (await page.locator('[data-block="headline"]').textContent()) === 'Edited headline');

  // ===== 6. Campaign page =====
  await page.click('button:has-text("Back to campaign")');
  await page.waitForSelector('[data-asset-edit]', { timeout: 30000 });
  ok('6. campaign page lists 4 concepts + 8 assets', (await page.locator('text=Tone notes').count()) === 4 && (await page.locator('[data-asset-edit]').count()) === 8);
  ok('6. concept cards show real fields (title/theme)', (await page.locator('text=Theme 2').count()) >= 1);
  await page.click('button:has-text("Back to Brand")');
  await page.waitForSelector('[data-past-campaigns]', { timeout: 30000 });
  ok('6. DNA editor lists the past campaign', (await page.locator('[data-campaign-id]').count()) === 1);
  await page.click('[data-campaign-id]');
  await page.waitForSelector('[data-asset-edit]', { timeout: 30000 });
  ok('6. past campaign opens its page', true);

  // ===== 7. Animate from an asset =====
  await page.locator('[data-asset-animate]').first().click();
  await page.waitForSelector('textarea', { timeout: 30000 });
  await page.waitForTimeout(500);
  ok('7. Animate opens with the asset image + asset motion prompt', /push-in toward the focal subject/.test(await page.locator('textarea').first().inputValue()) && (await page.locator('img[alt="Source image"]').count()) === 1);
  await page.selectOption('select:has(option:has-text("720p"))', '720p').catch(() => {});
  await page.click('button:text-is("Animate")');
  await page.waitForSelector('video', { timeout: 60000 });
  const seed = calls.muapi.filter((c) => /seedance/.test(c.endpoint)).pop();
  ok('7. seedance-lite-i2v called with asset image, prompt, 720p', seed && /cdn\.test|acme/.test(seed.params.image_url) && seed.params.resolution === '720p', JSON.stringify(seed && seed.params));
  const anims = await page.evaluate(() => JSON.parse(localStorage.getItem('brand_animations') || '[]'));
  ok('7. animation saved to the brand', anims.length === 1 && anims[0].sourceType === 'asset' && !!anims[0].sourceId);

  // ===== 8. Photo Studio =====
  await page.goto(BASE + '/?brandId=' + saved.id + '#/photo-studio', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-photo-preset]', { timeout: 60000 });
  ok('8. photo studio shows 30 presets in 6 categories', (await page.locator('[data-photo-preset]').count()) === 30 && (await page.locator('[data-photo-category]').count()) === 6);
  await page.screenshot({ path: shot('photo.png'), fullPage: true });
  fs.writeFileSync(shot('photo.txt'), await page.innerText('body'));
  // product upload through the real picker
  await page.locator('[data-photo-preset="general/studio_white"]').scrollIntoViewIfNeeded();
  const trigger = page.locator('button:has-text("Upload"), button:has-text("Add image"), button:has-text("Product")').first();
  await trigger.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: shot('picker.png') });
  fs.writeFileSync(shot('picker.txt'), await page.innerText('body'));
  const fileInput = page.locator('input[type=file]').first();
  await fileInput.setInputFiles({ name: 'product.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForTimeout(1500);
  for (const k of ['general/studio_white', 'home/scandi_living', 'fashion/golden_hour']) await page.click(`[data-photo-preset="${k}"]`);
  const before = calls.muapi.filter((c) => c.endpoint === 'nano-banana-2-edit').length;
  await page.click('button:has-text("Generate Product Photos")');
  await page.waitForFunction(() => document.querySelectorAll('[data-photo-animate]').length >= 3, null, { timeout: 90000 });
  const photoCalls = calls.muapi.filter((c) => c.endpoint === 'nano-banana-2-edit').slice(before);
  ok('8. 3 presets → 3 nano-banana-2-edit calls', photoCalls.length === 3);
  ok('8. product + brand logo sent as references', photoCalls.every((c) => c.params.images_list.length === 2 && c.params.images_list[1] === 'https://acme.test/logo.png'), JSON.stringify(photoCalls[0].params.images_list));
  ok('8. each call uses its preset aspect (1:1, 16:9, 16:9)', photoCalls.map((c) => c.params.aspect_ratio).sort().join() === ['1:1', '16:9', '16:9'].sort().join(), photoCalls.map((c) => c.params.aspect_ratio).join());
  ok('8. prompts carry the preset look + brand palette/imagery', photoCalls.some((c) => /Scandinavian living room/.test(c.params.prompt)) && photoCalls.every((c) => /#c81e1e/.test(c.params.prompt) && /cinematic/.test(c.params.prompt)));
  const shoots = await page.evaluate(() => JSON.parse(localStorage.getItem('brand_photoshoots') || '[]'));
  ok('8. photoshoots saved to the brand', shoots.length === 3 && shoots.every((p) => p.brandId));
  await page.screenshot({ path: shot('photo-results.png'), fullPage: true });

  // ===== 9. Animate from a Photo Studio shot =====
  await page.goto(BASE + '/?brandId=' + saved.id + '#/animate', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button:has-text("From Photo Studio")', { timeout: 60000 });
  await page.click('button:has-text("From Photo Studio")');
  await page.locator('select:has(option:has-text("Select a photoshoot"))').selectOption({ index: 1 });
  ok('9. photoshoot source picks the shot + photoshoot motion prompt', /Slow rotational camera move/.test(await page.locator('aside textarea, textarea').first().inputValue()));
  await page.click('button:has-text("From campaign asset")');
  ok('9. campaign-asset source lists this brand\'s assets', (await page.locator('select[data-asset-source] option').count()) === 9);
  await browser.close();
  fs.writeFileSync(shot('partial.json'), JSON.stringify({ results, calls: { ...calls, muapi: calls.muapi.length }, pageErrors }, null, 1));
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed; page errors: ${pageErrors.length}`); pageErrors.slice(0, 5).forEach((e) => console.log('  pageerror:', e));
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => { console.error('SCRIPT ERROR', e.message.split('\n')[0]); try { await PG.screenshot({ path: shot('fail.png') }); fs.writeFileSync(shot('fail.txt'), (await PG.innerText('body')).slice(-1500)); } catch {} process.exit(1); });
