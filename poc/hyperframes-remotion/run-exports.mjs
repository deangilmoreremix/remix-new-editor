// Real MP4 exports through renderMediaOnWeb in headless Chromium, probed with ffprobe.
// Usage: node run-exports.mjs   -> out/exports/*.mp4 + out/exports/results.json
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
mkdirSync('out/exports', { recursive: true });
const SPECS = JSON.parse(process.env.SPECS || '[]');
const browser = await chromium.launch(); const results = [];
for (const sp of SPECS) {
  const page = await browser.newPage(); const label = sp.label;
  try {
    await page.goto('http://127.0.0.1:3199/', { waitUntil: 'load' });
    const r = await Promise.race([page.evaluate((x) => window.__poc.exportSpec(x), sp), new Promise((_, rej) => setTimeout(() => rej(new Error('export timeout')), +(process.env.TIMEOUT_MS || 240000)))]);
    const file = `out/exports/${label}.${sp.container || 'mp4'}`; writeFileSync(file, Buffer.from(r.b64, 'base64'));
    const probe = JSON.parse(execSync(`ffprobe -v error -show_entries stream=codec_name,codec_type,width,height,nb_frames,r_frame_rate,pix_fmt,duration,sample_rate -of json ${file}`).toString());
    const v = probe.streams.find((s) => s.codec_type === 'video'), a = probe.streams.find((s) => s.codec_type === 'audio');
    results.push({ label, ok: true, ms: r.ms, bytes: r.bytes, video: v && { codec: v.codec_name, w: v.width, h: v.height, frames: +v.nb_frames, fps: v.r_frame_rate, pix: v.pix_fmt, dur: +v.duration }, audio: a ? { codec: a.codec_name, rate: a.sample_rate, dur: +a.duration } : null, errors: r.errors });
    console.log('OK  ', label, r.ms + 'ms', v?.width + 'x' + v?.height, v?.codec_name, v?.nb_frames + 'f', a ? 'audio:' + a.codec_name : 'no-audio');
  } catch (e) { results.push({ label, ok: false, error: String(e.message || e).slice(0, 200) }); console.log('FAIL', label, String(e.message || e).slice(0, 160)); }
  await page.close().catch(() => {});
}
writeFileSync(`out/exports/results${process.env.TAG || ''}.json`, JSON.stringify(results, null, 1));
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]); process.exit(0);
