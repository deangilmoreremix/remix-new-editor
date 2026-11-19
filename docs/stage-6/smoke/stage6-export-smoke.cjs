/* global window, btoa, process, console, URL, Buffer */
// Stage 6 real-export smoke: feeds the REAL export model (built by src/cinegen/__tests__/editor/stage6-export-model.smoke.test.ts) to the
// REAL export runner (src/export-runner/main.jsx -> Remotion renderMediaOnWeb, WebCodecs) in headless Chromium, then decodes mid-transition
// frames from the rendered file with ffmpeg and checks the pixels. No experimental browser flags.
//
// Run (from the repo root):
//   ffmpeg ... make media/A.webm (red/orange) and media/B.webm (blue/teal), 640x360, 4 s, VP9   (see STAGE_6_REPORT.md)
//   npx vite --port 3106 --strictPort &
//   S6_MODEL_OUT=$DIR/models S6_MEDIA_BASE=http://127.0.0.1:3106/__s6 npx vitest run src/cinegen/__tests__/editor/stage6-export-model.smoke.test.ts
//   S6_DIR=$DIR node docs/stage-6/smoke/stage6-export-smoke.cjs      (expects $DIR/models/*.json and $DIR/media/{A,B}.webm)
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const DIR = process.env.S6_DIR; const PORT = process.env.S6_PORT || '3106';
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
let failed = 0; const assert = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) failed++; };

function avg(file, t, x0, y0, x1, y1) { // mean RGB of a region (fractions) of the frame at time t
  const out = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', `crop=iw*${x1 - x0}:ih*${y1 - y0}:iw*${x0}:ih*${y0},scale=1:1`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  return [out[0], out[1], out[2]];
}
const reddish = (c) => c[0] > c[2] + 40; const bluish = (c) => c[2] > c[0] + 40;

async function render(page, model) {
  return page.evaluate((m) => new Promise((resolve, reject) => {
    const id = 'r' + Math.random();
    const onMsg = async (e) => {
      const d = e.data || {};
      if (d.id !== id) return;
      if (d.type === 'error') { window.removeEventListener('message', onMsg); reject(new Error(d.message)); }
      if (d.type === 'done') {
        window.removeEventListener('message', onMsg);
        const buf = new Uint8Array(await d.blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        resolve({ b64: btoa(s), mime: d.mimeType });
      }
    };
    window.addEventListener('message', onMsg);
    window.postMessage({ type: 'render', id, model: m, options: { container: 'webm', videoCodec: 'vp9', quality: '720p' } }, '*');
  }), model);
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const results = {};
  for (const name of ['wipe-right', 'wipe-up']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') console.log('CON', m.text().slice(0, 200)); });
    await page.route(`**/__s6/*.webm`, async (route) => {
      const file = path.join(DIR, 'media', path.basename(new URL(route.request().url()).pathname)); const buf = fs.readFileSync(file);
      const range = route.request().headers()['range']; const h = { 'content-type': 'video/webm', 'accept-ranges': 'bytes', 'access-control-allow-origin': '*' };
      if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const s = +m[1]; const e = m[2] ? +m[2] : buf.length - 1; return route.fulfill({ status: 206, headers: { ...h, 'content-range': `bytes ${s}-${e}/${buf.length}` }, body: buf.subarray(s, e + 1) }); }
      return route.fulfill({ status: 200, headers: h, body: buf });
    });
    await page.goto(`http://127.0.0.1:${PORT}/export-runner.html`);
    await page.waitForFunction(() => typeof window.VideoEncoder === 'function', null, { timeout: 30000 });
    const model = JSON.parse(fs.readFileSync(path.join(DIR, 'models', `${name}.json`), 'utf8'));
    model.durationInFrames = 150; // 5 s is enough: A 0-3 s, B 2-5 s, transition 2-3 s
    const t0 = Date.now();
    const r = await render(page, model);
    const out = path.join(DIR, `export-${name}.webm`); fs.writeFileSync(out, Buffer.from(r.b64, 'base64'));
    console.log(`${name}: rendered ${(fs.statSync(out).size / 1024).toFixed(0)} KiB (${r.mime}) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    results[name] = out; await page.close();
  }
  await browser.close();
  for (const [name, f] of Object.entries(results)) {
    const pre = avg(f, 1.0, 0.1, 0.1, 0.9, 0.9); const post = avg(f, 4.2, 0.1, 0.1, 0.9, 0.9);
    assert(reddish(pre), `${name}: t=1.0s (before the cut) is clip A (red/orange): ${pre}`);
    assert(bluish(post), `${name}: t=4.2s (after the cut) is clip B (blue/teal): ${post}`);
    const q = (x, y) => avg(f, 2.5, x, y, x + 0.15, y + 0.15); // corner quadrants of the mid-transition frame (t=2.5 s, progress ~0.5)
    const TL = q(0.05, 0.05); const TR = q(0.8, 0.05); const BL = q(0.05, 0.8); const BR = q(0.8, 0.8);
    console.log(`${name} mid-transition (t=2.5 s): TL=${TL} TR=${TR} BL=${BL} BR=${BR}`);
    if (name === 'wipe-right') assert(bluish(TL) && bluish(BL) && reddish(TR) && reddish(BR), `${name}: left column already shows B, right column still A (hard vertical edge, not a cross-fade)`);
    else assert(reddish(TL) && reddish(TR) && bluish(BL) && bluish(BR), `${name}: bottom row shows B, top row still A (direction param [0,1] reached the export)`);
  }
  process.exit(failed ? 1 : 0);
})();
