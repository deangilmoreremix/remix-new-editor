// Stage 3 acceptance check. Usage: node scripts/stage3-presenter-check/check.mjs
// Everything runs in real headless Chromium against the REAL code: the MediaPipe (and MODNet) segmenters through the app's bake
// pipeline, the real IndexedDB store, the real editor panel + stage box, the real preview Player and the app's own exporter. The exported
// MP4s are decoded with ffmpeg and measured against the SOURCE video's own frames and the baked matte's alpha. Exits non-zero on any failure.
import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startPresenterServer } from './presenter-server.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../..')
const out = path.join(here, 'out')
fs.mkdirSync(out, { recursive: true })
const PORT = 5203
const BASE = `http://localhost:${PORT}`
const ORIGINAL = path.join(repo, 'public/media/recast-example/source-performance.mp4')
// The sample clip has no soundtrack, so the audio checks need one: mux in a synthetic broadband signal with a changing envelope
// (noise bursts), which has a sharp cross-correlation peak. The picture is byte-for-byte the original's.
const VIDEO_PATH = path.join(out, 'presenter-av.mp4')
const VIDEO = `${BASE}/out/presenter-av.mp4`

let passed = 0; const failed = []; const skipped = []; const notes = []
const check = (name, ok, detail = '') => { if (ok) passed += 1; else failed.push(`${name} ${detail}`); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }
const skip = (name, why) => { skipped.push(`${name}: ${why}`); console.log(`SKIP  ${name}  — ${why}`) }
const note = (s) => { notes.push(s); console.log(`NOTE  ${s}`) }

// ── ffmpeg helpers ──────────────────────────────────────────────────────────────────────────────────────────────
const ff = (args, opts = {}) => { const r = spawnSync('ffmpeg', ['-v', 'error', ...args], { maxBuffer: 1 << 28, ...opts }); if (r.status !== 0) throw new Error('ffmpeg: ' + String(r.stderr)); return r.stdout }
const rgbAt = (file, t, w, h, pre = []) => ff([...pre, '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', `scale=${w}:${h}:flags=bilinear`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
const alphaAt = (webm, t, w, h) => ff(['-c:v', 'libvpx-vp9', '-ss', String(t), '-i', webm, '-frames:v', '1', '-vf', `alphaextract,scale=${w}:${h}:flags=bilinear,format=gray`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'])
const probe = (file, entries) => { const r = spawnSync('ffprobe', ['-v', 'error', ...entries, '-of', 'json', file], { encoding: 'utf8' }); return JSON.parse(r.stdout || '{}') }
const audioPcm = (file, secs = 2) => { const b = ff(['-i', file, '-t', String(secs), '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], {}); return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.byteLength / 4)) }
const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / Math.max(1, a.length))
function bestLag(a, b, maxLag) { // lag (samples) where b best matches a
  let best = 0; let bestV = -Infinity; const n = Math.min(a.length, b.length) - maxLag - 1
  for (let lag = -maxLag; lag <= maxLag; lag += 8) { let s = 0; for (let i = maxLag; i < n; i += 4) s += a[i] * b[i + lag]; if (s > bestV) { bestV = s; best = lag } }
  for (let lag = best - 8; lag <= best + 8; lag += 1) { let s = 0; for (let i = maxLag; i < n; i += 2) s += a[i] * b[i + lag]; if (s > bestV) { bestV = s; best = lag } }
  return best
}
const px = (buf, w, x, y) => [buf[(y * w + x) * 3], buf[(y * w + x) * 3 + 1], buf[(y * w + x) * 3 + 2]]
const near = (c, t, tol) => Math.abs(c[0] - t[0]) <= tol && Math.abs(c[1] - t[1]) <= tol && Math.abs(c[2] - t[2]) <= tol
function erode(mask, w, h, r) { const o = new Uint8Array(w * h); for (let y = r; y < h - r; y++) for (let x = r; x < w - r; x++) { let ok = 1; for (let dy = -r; dy <= r && ok; dy++) for (let dx = -r; dx <= r; dx++) if (!mask[(y + dy) * w + x + dx]) { ok = 0; break } o[y * w + x] = ok } return o }
const maskOf = (g, pred) => { const m = new Uint8Array(g.length); for (let i = 0; i < g.length; i++) m[i] = pred(g[i], i) ? 1 : 0; return m }
function iou(a, b) { let i = 0; let u = 0; for (let k = 0; k < a.length; k++) { if (a[k] && b[k]) i++; if (a[k] || b[k]) u++ } return u ? i / u : 0 }
function meanAbs(a, b, w, h, mask) { let s = 0; let n = 0; for (let i = 0; i < w * h; i++) if (!mask || mask[i]) { s += Math.abs(a[i * 3] - b[i * 3]) + Math.abs(a[i * 3 + 1] - b[i * 3 + 1]) + Math.abs(a[i * 3 + 2] - b[i * 3 + 2]); n += 3 } return n ? s / n : NaN }
function sharp(a, w, h, mask) { let s = 0; let n = 0; const L = (x, y) => (a[(y * w + x) * 3] + a[(y * w + x) * 3 + 1] + a[(y * w + x) * 3 + 2]) / 3; for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (mask[y * w + x]) { s += Math.abs(4 * L(x, y) - L(x - 1, y) - L(x + 1, y) - L(x, y - 1) - L(x, y + 1)); n++ } return n ? s / n : NaN }
const meanLuma = (a, w, h, mask) => { let s = 0; let n = 0; for (let i = 0; i < w * h; i++) if (mask[i]) { s += (a[i * 3] + a[i * 3 + 1] + a[i * 3 + 2]) / 3; n++ } return n ? s / n : NaN }

// ── fixtures ────────────────────────────────────────────────────────────────────────────────────────────────────
const mk = (args) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr) }
mk(['-i', ORIGINAL, '-f', 'lavfi', '-i', 'anoisesrc=d=5.1:c=pink:r=44100:a=0.5,tremolo=f=3:d=0.9', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-shortest', VIDEO_PATH])
// a short head-and-shoulders crop (MODNet's intended input) and a short full-body cut, for the engine comparison
mk(['-i', VIDEO_PATH, '-t', '1.5', '-vf', 'crop=240:240:60:20,scale=360:360', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', path.join(out, 'presenter-crop.mp4')])
mk(['-i', VIDEO_PATH, '-t', '1.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', path.join(out, 'presenter-short.mp4')])
const srcInfo = probe(VIDEO_PATH, ['-show_entries', 'stream=codec_type,codec_name,width,height,duration'])
const srcHasAudio = srcInfo.streams.some((s) => s.codec_type === 'audio')
const [SW, SH] = [srcInfo.streams.find((s) => s.codec_type === 'video').width, srcInfo.streams.find((s) => s.codec_type === 'video').height]
spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x00cc66:s=720x1280', '-frames:v', '1', path.join(out, 'page.png')])
check('fixture: source clip is a portrait video with an audio track', SW === 360 && SH === 640 && srcHasAudio, `${SW}x${SH} audio=${srcHasAudio}`)

const server = await startPresenterServer(PORT)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox'] })
const problems = []
const watch = (page) => {
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message.slice(0, 300)}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/GL Driver|INFO:|Failed to load resource/.test(m.text())) problems.push(`[console.error] ${m.text().slice(0, 300)}`) })
}

// ═══ Part A — library level: bake, reuse, restore, exports measured against the source and the matte ═════════════
const pa = await browser.newPage(); watch(pa)
await pa.goto(`${BASE}/presenter.html`)
await pa.waitForFunction('window.ready === true', null, { timeout: 120000 })

const bake1 = await pa.evaluate(([u]) => window.bake(u, { engine: 'mediapipe' }, true), [VIDEO])
check('MediaPipe bake succeeds on the real clip', bake1.ok, JSON.stringify(bake1).slice(0, 240))
const matteFile = path.join(out, 'matte-mediapipe.webm')
fs.writeFileSync(matteFile, Buffer.from(await pa.evaluate(() => window.matteBytes()), 'base64'))
const mInfo = probe(matteFile, ['-show_entries', 'stream=codec_type,codec_name,width,height:stream_tags=alpha_mode:format=duration'])
check('baked footage is VP9 WebM with an alpha channel and an audio track', mInfo.streams.some((s) => s.codec_name === 'vp9' && s.tags?.alpha_mode === '1') && mInfo.streams.some((s) => s.codec_type === 'audio'), JSON.stringify(mInfo.streams.map((s) => [s.codec_type, s.codec_name, s.tags?.alpha_mode])))
check('baked frame count matches the clip (~24 fps x 5.08 s)', bake1.frames >= 118 && bake1.frames <= 126, `${bake1.frames} frames in ${bake1.ms} ms`)
check('person coverage is plausible (15–35% of the frame)', bake1.meanCoverage > 0.15 && bake1.meanCoverage < 0.35, bake1.meanCoverage?.toFixed(3))
const rec = await pa.evaluate(() => ({ b: window.__matte.r.matte.bounds, a: window.__matte.r.matte.videoAspect }))
check('person bounds measured (head near the top, feet near the bottom, centred)', rec.b && rec.b.y0 < 0.2 && rec.b.y1 > 0.8 && Math.abs((rec.b.x0 + rec.b.x1) / 2 - 0.5) < 0.12 && Math.abs(rec.a - 0.5625) < 0.01, JSON.stringify(rec))
const bake2 = await pa.evaluate(([u]) => window.bake(u, { engine: 'mediapipe' }), [VIDEO])
check('second bake REUSES the cached footage (no segmentation)', bake2.ok && bake2.reused === true && bake2.key === bake1.key && bake2.ms < 1500, `reused=${bake2.reused} ${bake2.ms} ms vs ${bake1.ms} ms`)
await pa.evaluate(() => window.dropRegistry())
check('after the in-page registry is wiped (like a reload) the footage is restored from IndexedDB', await pa.evaluate(() => window.restore()))
check('findExisting sees it; a different video does not', (await pa.evaluate(([u]) => window.findExisting(u, { engine: 'mediapipe' }), [VIDEO])) === true && (await pa.evaluate(([u]) => window.findExisting(u, { engine: 'mediapipe' }), [VIDEO + '?other=1'])) === false)

const matte = { key: bake1.key, engine: 'mediapipe', sourceUrl: VIDEO, createdAt: 'x' }
const BG = [0x22, 0x55, 0xcc]
const W = 360; const H = 640
const full = (mode, extra = {}) => ({ enabled: true, layout: 'full', shape: 'rect', box: { x: .5, y: .5, size: 1 }, aspect: 0.5625, focus: { x: .5, y: .5, zoom: 1 }, borderWidth: 0, shadow: false, videoAspect: 0.5625, background: { mode, blur: 14, color: '#2255cc', imageUrl: '' }, matte, ...extra })
const exportCase = async (name, cfg) => {
  const r = await pa.evaluate((c) => window.runExport(c), { videoUrl: VIDEO, w: W, h: H, frames: 60, ...cfg })
  if (!r.ok) { check(`export ${name}`, false, `${r.error} ${r.reason ?? ''}`); return null }
  const f = path.join(out, `${name}.mp4`); fs.writeFileSync(f, Buffer.from(r.b64, 'base64'))
  const info = probe(f, ['-show_entries', 'stream=codec_type,codec_name,width,height,nb_frames,duration'])
  const v = info.streams.find((s) => s.codec_type === 'video')
  check(`export ${name}: H.264 ${W}x${H}, 60 frames, audio present`, v.codec_name === 'h264' && v.width === W && v.height === H && Number(v.nb_frames) === 60 && info.streams.some((s) => s.codec_type === 'audio'), `${r.bytes} B in ${r.ms} ms ${r.warning ?? ''}`)
  return f
}

// colour fill: measured against the matte's alpha and the source frame at the same instants
const colorMp4 = await exportCase('color', { presenter: full('color') })
if (colorMp4) {
  for (const t of [0.5, 1.0, 1.5]) {
    const ex = rgbAt(colorMp4, t, W, H); const src = rgbAt(VIDEO_PATH, t, W, H); const al = alphaAt(matteFile, t, W, H)
    const matteMask = maskOf(al, (a) => a > 128)
    const exMask = maskOf(Array.from({ length: W * H }), (_, i) => { const c = [ex[i * 3], ex[i * 3 + 1], ex[i * 3 + 2]]; return !near(c, BG, 40) })
    const j = iou(matteMask, exMask)
    check(`colour @${t}s: exported silhouette matches the baked matte (IoU)`, j > 0.88, j.toFixed(3))
    const inner = erode(maskOf(al, (a) => a > 250), W, H, 3)
    const d = meanAbs(ex, src, W, H, inner)
    check(`colour @${t}s: person pixels match the source frame (mean abs diff, 0–255)`, d < 20, d.toFixed(1))
    const bgMask = erode(maskOf(al, (a) => a === 0), W, H, 6)
    let ok = 0; let n = 0; for (let i = 0; i < W * H; i += 3) if (bgMask[i]) { n++; if (near([ex[i * 3], ex[i * 3 + 1], ex[i * 3 + 2]], BG, 14)) ok++ }
    check(`colour @${t}s: background is the chosen colour (>=98% of pixels within ±14)`, n > 1000 && ok / n >= 0.98, `${(100 * ok / n).toFixed(2)}% of ${n}`)
  }
  // time alignment of the processed layer with the video timeline
  const t1 = 1.0; const ex = rgbAt(colorMp4, t1, W, H); const src = rgbAt(VIDEO_PATH, t1, W, H); const srcLater = rgbAt(VIDEO_PATH, t1 + 0.5, W, H)
  const motion = meanAbs(src, srcLater, W, H, erode(maskOf(alphaAt(matteFile, t1, W, H), (a) => a > 250), W, H, 3))
  if (motion > 3) {
    const al1 = alphaAt(matteFile, t1, W, H); const al2 = alphaAt(matteFile, t1 + 0.5, W, H)
    const exMask = maskOf(Array.from({ length: W * H }), (_, i) => !near([ex[i * 3], ex[i * 3 + 1], ex[i * 3 + 2]], BG, 40))
    const right = iou(maskOf(al1, (a) => a > 128), exMask); const wrong = iou(maskOf(al2, (a) => a > 128), exMask)
    check('processed layer is in sync with the timeline (matches matte at the same time better than 0.5 s later)', right > wrong, `${right.toFixed(3)} vs ${wrong.toFixed(3)} (clip motion ${motion.toFixed(1)})`)
  } else note(`the sample clip is nearly static (motion ${motion.toFixed(1)}); matte-to-timeline sync is therefore checked by frame count and audio alignment only`)
}

// remove over a solid website: the page colour must show through everywhere the person is not
const webBg = { enabled: true, source: { url: `${BASE}/`, title: 'Solid green test page', capturedAt: '2026-11-13T00:00:00Z' }, page: { url: `${BASE}/out/page.png`, width: 720, height: 1280 }, sections: [], startFrame: 0, endFrame: 60, transition: 'cut', transitionFrames: 0, scroll: { from: 0, to: 0 }, ease: 'linear', zoom: { from: 1, to: 1 }, focus: { x: .5, y: .5 }, cursor: { enabled: false, style: 'arrow', path: [], clicks: [], clickEffect: 'ripple' } }
const removeMp4 = await exportCase('remove-over-website', { presenter: full('remove'), websiteBackground: webBg })
if (removeMp4) {
  const t = 1.0; const ex = rgbAt(removeMp4, t, W, H); const src = rgbAt(VIDEO_PATH, t, W, H); const al = alphaAt(matteFile, t, W, H)
  const bgMask = erode(maskOf(al, (a) => a === 0), W, H, 6); const GREEN = [0, 0xcc, 0x66]
  let ok = 0; let n = 0; for (let i = 0; i < W * H; i += 2) if (bgMask[i]) { n++; if (near([ex[i * 3], ex[i * 3 + 1], ex[i * 3 + 2]], GREEN, 16)) ok++ }
  check('remove: the WEBSITE shows through everywhere the person is not (>=98%)', n > 1000 && ok / n >= 0.98, `${(100 * ok / n).toFixed(2)}% of ${n}`)
  const inner = erode(maskOf(al, (a) => a > 250), W, H, 3); const d = meanAbs(ex, src, W, H, inner)
  check('remove: the person is drawn over the website, untouched', d < 20, d.toFixed(1))
}

// blur: sharp person, softened room, no dark bleed at the edges
const blurMp4 = await exportCase('blur', { presenter: full('blur') })
if (blurMp4) {
  const t = 1.0; const ex = rgbAt(blurMp4, t, W, H); const src = rgbAt(VIDEO_PATH, t, W, H); const al = alphaAt(matteFile, t, W, H)
  const inner = erode(maskOf(al, (a) => a > 250), W, H, 3); const bgMask = erode(maskOf(al, (a) => a === 0), W, H, 8)
  const dPerson = meanAbs(ex, src, W, H, inner)
  check('blur: the person stays sharp (matches the source)', dPerson < 20, dPerson.toFixed(1))
  const sEx = sharp(ex, W, H, bgMask); const sSrc = sharp(src, W, H, bgMask)
  check('blur: the room is clearly softer than the source (edge energy <50%)', sEx < 0.5 * sSrc, `${sEx.toFixed(2)} vs ${sSrc.toFixed(2)}`)
  const lEx = meanLuma(ex, W, H, bgMask); const lSrc = meanLuma(src, W, H, bgMask)
  check('blur: brightness of the room is preserved (no dark edge bleed)', Math.abs(lEx - lSrc) / lSrc < 0.15, `${lEx.toFixed(1)} vs ${lSrc.toFixed(1)}`)
}

// camera bubble (landscape frame, black backdrop so the box is measurable)
const BW = 640; const BH = 360
const bubble = { enabled: true, layout: 'bubble', shape: 'circle', box: { x: 0.8, y: 0.62, size: 0.34 }, aspect: 1, radius: 0.18, focus: { x: 0.5, y: 0.5, zoom: 1.2 }, mirror: false, borderWidth: 0.02, borderColor: '#ffffff', shadow: true, videoAspect: 0.5625, background: { mode: 'keep', blur: 10, color: '#0f172a', imageUrl: '' } }
const bubbleMp4 = await (async () => {
  const r = await pa.evaluate((c) => window.runExport(c), { videoUrl: VIDEO, w: BW, h: BH, frames: 45, presenter: bubble, brandColors: { primary: '#000000' } })
  if (!r.ok) { check('export bubble', false, r.error); return null }
  const f = path.join(out, 'bubble.mp4'); fs.writeFileSync(f, Buffer.from(r.b64, 'base64')); check('export bubble: ok', true, `${r.bytes} B in ${r.ms} ms`); return f
})()
if (bubbleMp4) {
  const ex = rgbAt(bubbleMp4, 0.7, BW, BH)
  const size = 0.34 * BW; const left = Math.round(0.8 * BW - size / 2); const top = Math.round(0.62 * BH - size / 2); const cx = left + size / 2; const cy = top + size / 2
  const inside = (x, y) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= size / 2 - 3
  const outside = (x, y) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) >= size / 2 + 5
  // the backdrop is a smooth gradient, the video is detailed: measure local variance
  let vIn = 0; let nIn = 0; let vOut = 0; let nOut = 0
  const L = (x, y) => (ex[(y * BW + x) * 3] + ex[(y * BW + x) * 3 + 1] + ex[(y * BW + x) * 3 + 2]) / 3
  for (let y = 1; y < BH - 1; y++) for (let x = 1; x < BW - 1; x++) { const e = Math.abs(4 * L(x, y) - L(x - 1, y) - L(x + 1, y) - L(x, y - 1) - L(x, y + 1)); if (inside(x, y)) { vIn += e; nIn++ } else if (outside(x, y) && x < left - 20) { vOut += e; nOut++ } }
  check('bubble: video detail only inside the circle (edge energy inside >> backdrop outside)', vIn / nIn > 6 * (vOut / nOut + 0.05), `${(vIn / nIn).toFixed(2)} vs ${(vOut / nOut).toFixed(2)}`)
  const corners = [[left + 3, top + 3], [left + size - 4, top + 3], [left + 3, top + size - 4], [left + size - 4, top + size - 4]].map(([x, y]) => px(ex, BW, Math.round(x), Math.round(y)))
  const ringPx = px(ex, BW, Math.round(cx + size / 2 - size * 0.01), Math.round(cy))
  check('bubble: the corners of its square are NOT video (circle clipping)', corners.every((c) => Math.abs(c[0] - c[1]) < 70 && Math.max(...c) < 200), JSON.stringify(corners))
  check('bubble: the white border ring is drawn at the circle edge', ringPx.every((v) => v > 215), JSON.stringify(ringPx))
  const colsBright = []; for (let x = 0; x < BW; x++) { let hit = 0; for (let y = top + 10; y < top + size - 10; y++) if (L(x, y) > 215) hit++; if (hit > 3) colsBright.push(x) }
  note(`bubble ring columns ${colsBright[0]}..${colsBright[colsBright.length - 1]} vs expected ${Math.round(left)}..${Math.round(left + size)}`)
  check('bubble: positioned where presenterRect says (ring spans the expected columns ±3 px)', colsBright.length > 0 && Math.abs(colsBright[0] - left) <= 3 && Math.abs(colsBright[colsBright.length - 1] - (left + size)) <= 4)
}

// audio: exactly one audible layer, in sync with the source, not doubled. The exporter applies its own overall gain (measured below from the
// pre-existing no-presenter path), so "not doubled / not dropped" is judged RELATIVE to that baseline, and absolute drift is reported.
const baseMp4 = await exportCase('baseline-no-presenter', {})
if (srcHasAudio && colorMp4 && blurMp4 && removeMp4 && baseMp4) {
  const srcA = audioPcm(VIDEO_PATH); const baseRms = rms(audioPcm(baseMp4))
  note(`exporter loudness vs the source file on the pre-existing no-presenter path: x${(baseRms / rms(srcA)).toFixed(2)} (not introduced by this stage)`)
  for (const [name, f] of [['colour (matte carries audio)', colorMp4], ['blur (original carries audio, matte muted)', blurMp4], ['remove (matte carries audio)', removeMp4]]) {
    const a = audioPcm(f); const rel = rms(a) / baseRms; const lag = bestLag(srcA, a, 1600)
    check(`audio ${name}: same level as the no-presenter export (not doubled, not dropped)`, rel > 0.9 && rel < 1.1, `x${rel.toFixed(3)} (a doubled track would be ~x2)`)
    check(`audio ${name}: aligned with the source within 30 ms`, Math.abs(lag) <= 480, `lag ${(lag / 16).toFixed(1)} ms`)
  }
}

// Engines. MODNet (the larger model, downloaded from huggingface.co at run time) is a PORTRAIT matting model: compare it with MediaPipe on its
// intended input (a head-and-shoulders crop) and, for the record, on the full-body cut.
const CROP = `${BASE}/out/presenter-crop.mp4`; const SHORT = `${BASE}/out/presenter-short.mp4`
const engineIoU = async (url, file, t, w, h) => {
  const mp = await pa.evaluate(([u]) => window.bake(u, { engine: 'mediapipe' }, true), [url])
  const mpFile = path.join(out, `${file}-mediapipe.webm`); fs.writeFileSync(mpFile, Buffer.from(await pa.evaluate(() => window.matteBytes()), 'base64'))
  const md = await pa.evaluate(([u]) => window.bake(u, { engine: 'modnet', maxSize: 512 }, true), [url])
  if (!md.ok) return { mp, md }
  const mdFile = path.join(out, `${file}-modnet.webm`); fs.writeFileSync(mdFile, Buffer.from(await pa.evaluate(() => window.matteBytes()), 'base64'))
  return { mp, md, iou: iou(maskOf(alphaAt(mpFile, t, w, h), (a) => a > 128), maskOf(alphaAt(mdFile, t, w, h), (a) => a > 128)) }
}
const crop = await engineIoU(CROP, 'crop', 0.7, 360, 360)
if (!crop.md.ok) skip('MODNet bake', crop.md.error)
else {
  check('MODNet bake succeeds on a head-and-shoulders clip', true, `${crop.md.frames} frames in ${(crop.md.ms / 1000).toFixed(1)} s (CPU/WASM), coverage ${crop.md.meanCoverage.toFixed(3)}`)
  check('on its intended input the two engines agree on who the person is (IoU > 0.8)', crop.iou > 0.8, crop.iou.toFixed(3))
  const full = await engineIoU(SHORT, 'short', 0.7, 360, 640)
  if (full.md.ok) note(`full-body footage: MODNet vs MediaPipe IoU ${full.iou.toFixed(3)}, coverage ${full.md.meanCoverage.toFixed(3)} vs ${full.mp.meanCoverage.toFixed(3)} (MODNet is a portrait model: not recommended for full-body clips)`)
}
await pa.close()

// ═══ Part B — the real editor: panel, processing, stage box, preview Player and export from the same settings ═════
const pb = await browser.newPage({ viewport: { width: 1200, height: 3600 } }); watch(pb)
await pb.goto(`${BASE}/editor.html`)
await pb.waitForFunction(() => window.ready === true, null, { timeout: 120000 })
await pb.evaluate((u) => window.__setVideo(u), VIDEO)
await pb.waitForSelector('[data-testid="presenter-panel"]', { timeout: 60000 })
await pb.evaluate(() => window.__ctx.editPreviewSettings((p) => ({ ...p, durationInFrames: 60, showEndCard: false, layers: [] })))
const settings = () => pb.evaluate(() => JSON.parse(JSON.stringify(window.__ctx.previewSettings)))
await pb.getByLabel('Presenter preset').selectOption('bubble-cutout')
let s = await settings()
check('editor: preset creates the presenter', s.presenter?.layout === 'bubble' && s.presenter?.background.mode === 'remove', JSON.stringify(s.presenter?.box))
check('editor: before processing, the panel says processed footage is needed', (await pb.getByTestId('presenter-degraded').textContent()).includes('needs processed footage'))
await pb.waitForTimeout(1500)
const layerAttr = (a) => pb.evaluate((n) => document.querySelector('[data-presenter-layer]')?.getAttribute(n), a)
check('editor: and the PREVIEW honestly shows the untouched video (mode keep, degraded no-matte)', (await layerAttr('data-presenter-mode')) === 'keep' && (await layerAttr('data-presenter-degraded')) === 'no-matte')
await pb.getByRole('button', { name: 'Process footage' }).click()
await pb.getByTestId('presenter-matte-ready').waitFor({ timeout: 180000 })
s = await settings()
check('editor: processing stores the footage reference with measured bounds', Boolean(s.presenter.matte?.key && s.presenter.matte.bounds), s.presenter.matte?.key)
check('editor: the warning is gone and the preview now draws the removed-background layer', (await pb.getByTestId('presenter-degraded').count()) === 0 && (await layerAttr('data-presenter-mode')) === 'remove')
const before = s.presenter.focus
await pb.getByRole('button', { name: 'Frame head and shoulders' }).click()
s = await settings()
check('editor: "Frame head and shoulders" reframes using the measured person', s.presenter.focus.zoom !== before.zoom || s.presenter.focus.y !== before.y, JSON.stringify(s.presenter.focus))

// drag the box on the stage with a real mouse
const box = await pb.getByTestId('stage-presenter').boundingBox(); const stage = await pb.getByLabel('Video overlay stage').boundingBox()
const x0 = s.presenter.box.x
await pb.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await pb.mouse.down(); await pb.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 - 40, { steps: 6 }); await pb.mouse.up()
s = await settings()
const moved = await pb.getByTestId('stage-presenter').boundingBox()
check('editor: dragging the stage box moves the presenter (one drag)', s.presenter.box.x < x0 - 0.05, `${x0} -> ${s.presenter.box.x}`)
check('editor: the box stays inside the stage', moved.x >= stage.x - 1 && moved.y >= stage.y - 1 && moved.x + moved.width <= stage.x + stage.width + 1 && moved.y + moved.height <= stage.y + stage.height + 1)

// preview Player vs exported MP4 for the SAME settings and the SAME frame
await pb.evaluate(() => { const p = window.__player.current; p.pause(); p.seekTo(30) })
await pb.waitForTimeout(2500)
const wrap = pb.getByTestId('preview-wrap'); const shot = path.join(out, 'preview-frame30.png'); await wrap.screenshot({ path: shot })
const exr = await pb.evaluate(() => window.__export())
check('editor: export of the same settings succeeds', exr.ok, `${exr.error ?? ''} ${exr.bytes ?? ''} B in ${exr.ms} ms`)
if (exr.ok) {
  const ef = path.join(out, 'editor-export.mp4'); fs.writeFileSync(ef, Buffer.from(exr.b64, 'base64'))
  const dims = probe(ef, ['-show_entries', 'stream=width,height'])
  const [EW, EH] = [dims.streams[0].width, dims.streams[0].height]
  const exFrame = rgbAt(ef, 30 / 30, EW, EH)
  const pv = ff(['-i', shot, '-vf', `scale=${EW}:${EH}:flags=bilinear`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
  const d = meanAbs(exFrame, pv, EW, EH)
  check('preview parity: the Player frame and the exported frame agree (mean abs diff < 12 of 255)', d < 12, d.toFixed(2))
  const bxs = (b) => { const n = []; for (let i = 0; i < EW * EH; i++) { const v = (b[i * 3] + b[i * 3 + 1] + b[i * 3 + 2]) / 3; n.push(v) } return n }
  // person position: centroid of pixels that differ from the backdrop corner colour, in both
  const centroid = (b) => { let sx = 0; let sy = 0; let n = 0; const bgc = px(b, EW, 5, 5); for (let y = 0; y < EH; y += 2) for (let x = 0; x < EW; x += 2) { const c = px(b, EW, x, y); if (Math.abs(c[0] - bgc[0]) + Math.abs(c[1] - bgc[1]) + Math.abs(c[2] - bgc[2]) > 90 && x > EW * 0.4) { sx += x; sy += y; n++ } } return n ? [sx / n, sy / n, n] : null }
  void bxs
  const ce = centroid(exFrame); const cp = centroid(pv)
  check('preview parity: the presenter sits at the same place in both (centroid within 6 px)', ce && cp && Math.hypot(ce[0] - cp[0], ce[1] - cp[1]) < 6, JSON.stringify([ce, cp]))
}
check('no page errors or console errors in the browser', problems.length === 0, problems.slice(0, 5).join(' | '))

await browser.close(); await server.close()
console.log(`\n${passed} passed, ${failed.length} failed, ${skipped.length} skipped`)
for (const f of failed) console.log('  FAILED:', f)
for (const s2 of skipped) console.log('  SKIPPED:', s2)
process.exit(failed.length ? 1 : 0)
