/* Fix Q: on-device Whisper (Media tools > Local AI) on the WebGPU backend, and the worker's WebGPU -> WASM fallback.
 * Needs SMOKE_DIR/speech.mp4 (a clip with English speech, e.g. ffmpeg -i clip.mp4 -i narration.wav -map 0:v -map 1:a -shortest speech.mp4).
 * Run: [FAIL_WEBGPU=1] SMOKE_PORT=5191 SMOKE_DIR=<dir>/ CHROMIUM_PATH=<chrome> node docs/stage-11/smoke/whisper-webgpu-smoke.cjs
 * The browser is started with --enable-unsafe-webgpu (headless Chromium then offers a SwiftShader fallback adapter). The model is downloaded from huggingface.co
 * through the Local AI consent UI; the backend the worker really used is read from the worker's own 'asr' reply.
 * FAIL_WEBGPU=1 makes GPUAdapter.requestDevice() reject inside the worker (script prefixed through page.route), so the worker must fall back to WASM. */
const { chromium } = require('playwright'); const path = require('path');
const L = require('../../stage-8/smoke/combined-lib.cjs');
const SP = L.SP; let failed = 0; const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) failed++; };
const dom = (pg, sel) => pg.evaluate((q) => document.querySelector(q).click(), sel);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 950 }, acceptDownloads: true, bypassCSP: true });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 200)));
  await pg.addInitScript(() => {
    try { sessionStorage.setItem('setup_popup_shown', '1'); } catch {}
    window.__asr = []; const O = window.Worker;
    window.Worker = function (...a) { const w = new O(...a); w.addEventListener('message', (e) => { const d = e.data; if (d && d.backend) window.__asr.push(d.backend); }); return w; }; window.Worker.prototype = O.prototype;
  });
  if (process.env.FAIL_WEBGPU) await pg.route(/local-ai\.worker\.js/, async (r) => {
    const res = await r.fetch(); const body = await res.text();
    await r.fulfill({ response: res, body: "if (self.GPUAdapter) GPUAdapter.prototype.requestDevice = () => Promise.reject(new Error('simulated WebGPU device loss'));\n" + body });
  });
  await L.goTimeline(pg); await L.newProject(pg, 'whisper-webgpu');
  await L.addVideo(pg, SP + 'speech.mp4');
  await pg.locator('[title="speech.mp4"]').first().dblclick(); await pg.waitForTimeout(1500);
  await pg.locator('[data-testid=insert-edit]').click(); await pg.waitForTimeout(1500);
  for (let i = 0; i < 8 && !(await pg.locator('[data-testid=s4-tab-ai]').count()); i++) { await dom(pg, '[data-testid=s4-open]'); await pg.waitForTimeout(2500); }
  await dom(pg, '[data-testid=s4-tab-ai]'); await pg.waitForSelector('[data-testid=local-ai-panel]');
  const panel = await pg.locator('[data-testid=local-ai-panel]').innerText();
  console.log('INFO panel:', (/Backend:\s*\w+/.exec(panel) || [])[0], '|', (/Detected:[^\n]*/.exec(panel) || [])[0]);
  assert(/Backend:\s*webgpu/.test(panel), 'Local AI panel detects a WebGPU backend');
  console.log('INFO whisper-tiny-en card:', (await pg.locator('[data-testid="ai-status-whisper-tiny-en"]').innerText()).replace(/\n/g, ' '));
  const t0 = Date.now();
  await dom(pg, '[data-testid="ai-download-whisper-tiny-en"]'); await dom(pg, '[data-testid="ai-accept-whisper-tiny-en"]');
  await pg.waitForFunction(() => { const t = document.querySelector('[data-testid="ai-status-whisper-tiny-en"]')?.textContent || ''; return /installed/.test(t) && !/not installed/.test(t); }, null, { timeout: 600000 });
  console.log('INFO download ms', Date.now() - t0, '| status:', (await pg.locator('[data-testid="ai-status-whisper-tiny-en"]').innerText()).replace(/\n/g, ' ').slice(0, 200));
  await pg.keyboard.press('Escape'); await pg.evaluate(() => document.querySelector('.element-modal__backdrop')?.click());
  await pg.locator('.clip-card').filter({ hasText: 'speech.mp4' }).filter({ hasNotText: '(audio)' }).first().click({ position: { x: 25, y: 20 } }); await pg.waitForTimeout(800);
  const ins = pg.locator('[title="Show inspector"]'); if (await ins.count()) await ins.first().evaluate((el) => el.click());
  await pg.waitForSelector('[data-testid=clip-captions]', { timeout: 20000 });
  const t1 = Date.now();
  await pg.locator('[data-testid=clip-captions] button', { hasText: 'Generate captions' }).evaluate((el) => el.click());
  await pg.waitForFunction(() => /words captioned|No speech|failed|cannot/i.test(document.querySelector('[data-testid=clip-captions]')?.textContent || ''), null, { timeout: 300000 });
  const txt = (await pg.locator('[data-testid=clip-captions]').innerText()).replace(/\s+/g, ' ');
  console.log('INFO transcribe ms', Date.now() - t1, '|', txt.slice(0, 260));
  assert(/\d+ words captioned/.test(txt), 'captions generated');
  const used = await pg.evaluate(() => window.__asr); console.log('INFO backend(s) reported by the worker:', JSON.stringify(used));
  assert(used.length > 0 && used.every((x) => x === (process.env.FAIL_WEBGPU ? 'wasm' : 'webgpu')), 'worker ran on ' + (process.env.FAIL_WEBGPU ? 'wasm (after the simulated WebGPU failure)' : 'webgpu'));
  await b.close(); console.log(failed ? 'FAILED ' + failed : 'ALL PASS'); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('SMOKE CRASH', e); process.exit(2); });
