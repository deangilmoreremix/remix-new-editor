// Stage 6 acceptance check. Usage: node scripts/stage6-captions-check/check.mjs  (needs ffmpeg, espeak-ng, internet for the Whisper model)
// Real headless Chromium + the app's exporter: captions are measured IN THE EXPORTED PIXELS; the Whisper transcription runs on REAL synthesized
// speech and is compared with what was said and with the audio's own activity; scene detection and codec probing run on real files with
// known cuts. Exits non-zero on any failed check.
import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startPresenterServer } from '../stage3-presenter-check/presenter-server.mjs'

const here = path.dirname(fileURLToPath(import.meta.url)); const out = path.join(here, 'out'); fs.mkdirSync(out, { recursive: true })
const PORT = 5213; const BASE = `http://localhost:${PORT}`; const U = (n) => `${BASE}/out/${n}`
let passed = 0; const failed = []; const skipped = []
const check = (name, ok, detail = '') => { if (ok) passed += 1; else failed.push(`${name} ${detail}`); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }
const note = (s) => console.log(`NOTE  ${s}`)
const skip = (n, why) => { skipped.push(`${n}: ${why}`); console.log(`SKIP  ${n} — ${why}`) }
const sh = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); if (r.status !== 0) throw new Error(`${cmd}: ${r.stderr}`); return r }
const mk = (args) => sh('ffmpeg', ['-v', 'error', '-y', ...args])

// ── fixtures ────────────────────────────────────────────────────────────────────────────────────────────────────
const PHRASE = 'Welcome to Acme Roofing. We fix leaks fast. Call us today for a free quote.'
sh('espeak-ng', ['-v', 'en-us', '-s', '150', '-w', path.join(out, 'speech.wav'), PHRASE])
mk(['-f', 'lavfi', '-i', 'color=c=0x808080:s=640x360:r=30:d=6.2', '-i', path.join(out, 'speech.wav'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(out, 'speech.mp4')])
mk(['-f', 'lavfi', '-i', 'color=c=0x808080:s=640x360:r=30:d=6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(out, 'grey.mp4')])
const seg = (src, d) => ['-f', 'lavfi', '-t', String(d), '-i', `${src}${src.includes('=') ? ':' : '='}s=640x360:r=30`]
mk([...seg('color=c=0x2060c0', 2), ...seg('smptehdbars', 2), ...seg('color=c=0xc03020', 2), '-filter_complex', '[0][1][2]concat=n=3:v=1[v]', '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(out, 'scenes.mp4')])
mk(['-f', 'lavfi', '-i', 'color=c=0x2060c0:s=640x360:r=30:d=6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(out, 'static.mp4')])
mk([...seg('color=c=0x2060c0', 6), ...seg('color=c=0xc03020', 6), '-filter_complex', '[0][1]xfade=transition=fade:duration=4:offset=1[v]', '-map', '[v]', '-t', '6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(out, 'fade.mp4')])
mk(['-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=30:d=6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(out, 'drift.mp4')])
mk(['-f', 'lavfi', '-i', 'color=c=0x2060c0:s=640x360:r=30:d=2', '-c:v', 'libx265', '-pix_fmt', 'yuv420p', '-tag:v', 'hvc1', path.join(out, 'hevc.mp4')])
mk(['-f', 'lavfi', '-i', 'color=c=0x2060c0:s=640x360:r=30:d=2', '-c:v', 'libvpx-vp9', path.join(out, 'vp9.webm')])
const frameRgb = (f, n, w = 640) => spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', `select=eq(n\\,${n})`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 27 }).stdout
const luma = (b, i) => 0.2126 * b[i * 3] + 0.7152 * b[i * 3 + 1] + 0.0722 * b[i * 3 + 2]
// caption pixels: white text, or the yellow highlight, or (for boxed styles) anything far from the flat grey background
function textBox(b, w, h, mode = 'text') {
  let x0 = w, x1 = -1, y0 = h, y1 = -1, n = 0, yx = 0, yn = 0
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; const r = b[i * 3], g = b[i * 3 + 1], bl = b[i * 3 + 2]
    const white = luma(b, i) > 225 && Math.abs(r - bl) < 30; const yellow = r > 215 && g > 185 && bl < 140
    const hit = mode === 'dark' ? luma(b, i) < 70 : white || yellow
    if (hit) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
    if (yellow) { yx += x; yn++ } }
  return { n, x0, x1, y0, y1, w: x1 - x0, h: y1 - y0, cy: (y0 + y1) / 2, yellowX: yn ? yx / yn : null, yellowN: yn }
}

const server = await startPresenterServer(PORT, here)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox'] })
const problems = []
const watch = (page) => { page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message.slice(0, 300)}`)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|GL Driver|INFO:/.test(m.text())) problems.push(`[console.error] ${m.text().slice(0, 300)}`) }) }
const sturdy = (page, readyFn) => { const orig = page.evaluate.bind(page); page.evaluate = async (...a) => { for (let i = 0; ; i++) { try { return await orig(...a) } catch (e) { if (i < 4 && /context was destroyed|navigation/i.test(String(e))) { await page.waitForFunction(readyFn, null, { timeout: 120000 }); continue } throw e } } } }
const pa = await browser.newPage(); watch(pa); sturdy(pa, 'window.ready === true')
await pa.goto(`${BASE}/cap.html`); await pa.waitForFunction('window.ready === true', null, { timeout: 120000 }); await pa.waitForTimeout(2500); await pa.waitForFunction('window.ready === true', null, { timeout: 120000 })

// ═══ 1. Import / export of subtitle files ═══════════════════════════════════════════════════════════════════════
const SRT = '1\n00:00:00,500 --> 00:00:02,000\nWelcome to Acme Roofing\n\n2\n00:00:03,000 --> 00:00:04,500\nWe fix leaks fast\n'
const parsed = await pa.evaluate(([t]) => window.parse(t, 'a.srt'), [SRT])
check('SRT import: two cues with exact times', parsed.ok && parsed.cues.length === 2 && parsed.cues[0].startMs === 500 && parsed.cues[1].endMs === 4500, JSON.stringify(parsed.cues))
const reSrt = await pa.evaluate(([c]) => window.toSrt(c), [parsed.cues]); const reVtt = await pa.evaluate(([c]) => window.toVtt(c), [parsed.cues])
const again = await pa.evaluate(([t]) => window.parse(t, 'x.srt'), [reSrt]); const againV = await pa.evaluate(([t]) => window.parse(t, 'x.vtt'), [reVtt])
check('SRT and VTT export → import round trip is lossless', JSON.stringify(again.cues) === JSON.stringify(parsed.cues) && JSON.stringify(againV.cues) === JSON.stringify(parsed.cues))
for (const [name, text] of [['empty', ''], ['plain text', 'hello there'], ['binary-ish', '\u0000\u0001\u0002�'.repeat(50)], ['6 MB', 'x'.repeat(6_000_000)]]) { const r = await pa.evaluate(([t]) => window.parse(t, 'x.srt'), [text]); check(`bad subtitle file (${name}) is refused with a message`, !r.ok && r.error.length > 10, r.error) }

// ═══ 2. Captions in the EXPORTED pixels ═══════════════════════════════════════════════════════════════════════
const sentence = parsed.cues
const exp = async (name, cfg) => { const r = await pa.evaluate((c) => window.runExport(c), cfg); if (!r.ok) { check(`export ${name}`, false, r.error); return null } const f = path.join(out, `${name}.mp4`); fs.writeFileSync(f, Buffer.from(r.b64, 'base64')); return { file: f, pages: r.pages, ms: r.ms } }
const cap = await exp('cap-tiktok', { videoUrl: U('grey.mp4'), captions: { cues: sentence, style: { preset: 'tiktok' } }, frames: 180 })
if (cap) {
  // visibility vs the page timeline
  let agree = 0, total = 0, bad = []
  for (let t = 0; t < 6; t += 0.1) { const n = Math.round(t * 30); const near = cap.pages.some((p) => [p.startMs / 1000, (p.startMs + p.durationMs) / 1000 + 0.4].some((e) => Math.abs(t - e) < 0.12)); if (near) continue
    const vis = cap.pages.some((p) => t * 1000 >= p.startMs && t * 1000 < p.startMs + p.durationMs + 400); const seen = textBox(frameRgb(cap.file, n), 640, 360).n > 150; total++; if (vis === seen) agree++; else bad.push(t.toFixed(1)) }
  check('captions are in the video exactly while their page is up (and absent in the pauses)', agree === total, `${agree}/${total} sampled times agree${bad.length ? '; wrong at ' + bad : ''}`)
  const b1 = textBox(frameRgb(cap.file, 22), 640, 360), b2 = textBox(frameRgb(cap.file, 52), 640, 360) // t=0.73s (Welcome) and t=1.73s (Roofing)
  check('word highlight: yellow is drawn on the word being spoken', b1.yellowN > 80 && b2.yellowN > 80, `${b1.yellowN} / ${b2.yellowN} yellow px`)
  check('word highlight moves left → right through the sentence', b2.yellowX - b1.yellowX > 120, `x ${b1.yellowX?.toFixed(0)} → ${b2.yellowX?.toFixed(0)}`)
  check('bottom caption sits in the lower third and is horizontally centred', b1.cy > 360 * 0.7 && Math.abs((b1.x0 + b1.x1) / 2 - 320) < 25, `centre y ${b1.cy}, x ${(b1.x0 + b1.x1) / 2}`)
  check('uppercase text is drawn (the tiktok preset): a sentence of 22 letters spans a wide band', b1.w > 300, `${b1.w}px wide`)
}
const ys = {}
for (const position of ['top', 'middle', 'bottom']) { const e = await exp(`cap-pos-${position}`, { videoUrl: U('grey.mp4'), captions: { cues: sentence, style: { preset: 'minimal', position } }, frames: 60 }); if (e) ys[position] = textBox(frameRgb(e.file, 30), 640, 360).cy }
check('top / middle / bottom positions land in their own thirds', ys.top < 120 && ys.middle > 140 && ys.middle < 220 && ys.bottom > 240, JSON.stringify(ys))
{
  const s = await exp('cap-size-small', { videoUrl: U('grey.mp4'), captions: { cues: sentence, style: { preset: 'minimal', fontSize: 5 } }, frames: 60 })
  const big = await pa.evaluate(() => window.runExport({ videoUrl: `${location.origin}/out/grey.mp4`, captions: { cues: [{ text: 'Welcome to Acme Roofing', startMs: 500, endMs: 2000 }], style: { preset: 'minimal', fontSize: 5 } }, w: 1280, h: 720, frames: 60 }))
  if (s && big.ok) { fs.writeFileSync(path.join(out, 'cap-size-big.mp4'), Buffer.from(big.b64, 'base64')); const a = textBox(frameRgb(s.file, 30), 640, 360), b = textBox(frameRgb(path.join(out, 'cap-size-big.mp4'), 30, 1280), 1280, 720)
    check('the same caption at 1280×720 is twice as big as at 640×360 (size follows the frame height)', Math.abs(b.w / a.w - 2) < 0.2, `width ${a.w} → ${b.w}`) }
  const box = await exp('cap-box', { videoUrl: U('grey.mp4'), captions: { cues: sentence, style: { preset: 'classic' } }, frames: 60 })
  if (box) { const d = textBox(frameRgb(box.file, 30), 640, 360, 'dark'); check('the "Classic subtitles" preset draws a dark box behind the text', d.n > 3000, `${d.n} dark px`) }
  const hostile = await exp('cap-hostile', { videoUrl: U('grey.mp4'), captions: { cues: [{ text: '<script>alert(1)</script> & "quotes" <b>bold</b>', startMs: 0, endMs: 3000 }], style: { preset: 'minimal', uppercase: false } }, frames: 60 })
  if (hostile) check('markup inside a subtitle is drawn as plain text (export succeeds, text is on screen)', textBox(frameRgb(hostile.file, 30), 640, 360).n > 300)
  const off = await exp('cap-off', { videoUrl: U('grey.mp4'), captions: { enabled: false, cues: sentence }, frames: 60 })
  if (off) check('captions switched off: nothing is drawn', textBox(frameRgb(off.file, 30), 640, 360).n === 0)
}

// ═══ 3. Real transcription of real synthesized speech ═══════════════════════════════════════════════════════════
const tr = await pa.evaluate(([u]) => window.transcribe(u, 'onnx-community/whisper-base_timestamped'), [U('speech.mp4')])
if (!tr.ok) skip('Whisper transcription', tr.error)
else {
  const norm = (s) => s.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean)
  const ref = norm(PHRASE), hyp = norm(tr.text)
  const d = Array.from({ length: ref.length + 1 }, (_, i) => Array.from({ length: hyp.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= ref.length; i++) for (let j = 1; j <= hyp.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1))
  const wer = d[ref.length][hyp.length] / ref.length
  note(`transcript: "${tr.text.trim()}" (${tr.ms} ms for ${tr.cues.length} words, model whisper-base, the app's default)`)
  check('transcription: word error rate against what the synthesizer said is under 35%', wer < 0.35, `WER ${(wer * 100).toFixed(0)}%`)
  const wav = spawnSync('ffmpeg', ['-v', 'error', '-i', path.join(out, 'speech.wav'), '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 1 << 26 }).stdout; const pcm = new Float32Array(wav.buffer, wav.byteOffset, Math.floor(wav.byteLength / 4))
  const active = (t) => { const a = Math.max(0, Math.round((t - 0.05) * 16000)), b = Math.min(pcm.length, Math.round((t + 0.05) * 16000)); let s = 0; for (let i = a; i < b; i++) s += pcm[i] * pcm[i]; return Math.sqrt(s / Math.max(1, b - a)) > 0.01 }
  let ok = 0; for (const c of tr.cues) { let n = 0, m = 0; for (let t = c.startMs / 1000; t < c.endMs / 1000; t += 0.05) { m++; if (active(t)) n++ } if (m && n / m >= 0.6) ok++ }
  check('transcription: each word\'s time span covers real speech in the audio (≥ 60% voiced) for at least 80% of words', ok / tr.cues.length >= 0.8, `${ok}/${tr.cues.length} words`)
  const onset = (() => { for (let t = 0; t < 6; t += 0.02) if (active(t)) return t; return 0 })()
  check('transcription: the first word starts within 0.6 s of the first sound', Math.abs(tr.cues[0].startMs / 1000 - onset) < 0.6, `word at ${(tr.cues[0].startMs / 1000).toFixed(2)} s, sound at ${onset.toFixed(2)} s`)
  const e = await exp('cap-transcribed', { videoUrl: U('speech.mp4'), captions: { cues: tr.cues, style: { preset: 'tiktok' }, source: 'transcribed' }, frames: 186 })
  if (e) { let agree = 0, total = 0; for (let t = 0.2; t < 6; t += 0.2) { const near = active(t) || active(t - 0.4) || active(t + 0.4); const quiet = !active(t - 0.5) && !active(t - 0.25) && !active(t) && !active(t + 0.25) && !active(t + 0.5); if (!near && !quiet) continue; const seen = textBox(frameRgb(e.file, Math.round(t * 30)), 640, 360).n > 150; total++; if ((near && !quiet) === seen || (quiet && !seen)) agree++ }
    check('transcribed captions in the export line up with the speech: shown while it is spoken, gone in clear silence (≥ 80%)', total > 8 && agree / total >= 0.8, `${agree}/${total}`) }
}

// ═══ 4. Scene detection and video checks on real files ═══════════════════════════════════════════════════════════
const sc = await pa.evaluate(([u]) => window.scan(u), [U('scenes.mp4')])
check('scene detection: finds the two hard cuts at 2 s and 4 s (±0.3 s) and nothing else', sc.cuts.length === 2 && Math.abs(sc.cuts[0] - 2) <= 0.3 && Math.abs(sc.cuts[1] - 4) <= 0.3, `${JSON.stringify(sc.cuts)} in ${sc.ms} ms, ${sc.frames} frames sampled`)
check('scene detection: a thumbnail (JPEG) is made for every scene', sc.scenes === 3 && sc.thumbs === 3, `${sc.thumbs}/${sc.scenes}`)
for (const [name, file] of [['a static clip', 'static.mp4'], ['a slow 4-second cross-fade', 'fade.mp4'], ['continuous on-screen motion (testsrc2)', 'drift.mp4']]) { const r = await pa.evaluate(([u]) => window.scan(u), [U(file)]); check(`scene detection: ${name} has no false cuts`, r.cuts.length === 0, JSON.stringify(r.cuts)) }
const h264 = await pa.evaluate(([u]) => window.probe(u), [U('grey.mp4')])
check('video format check: H.264 MP4 is recognised, decodable, with its real size and duration', h264.ok && h264.canDecode && h264.advice.family === 'H.264' && h264.advice.level === 'ok' && h264.width === 640 && h264.height === 360 && Math.abs(h264.durationSec - 6) < 0.3, JSON.stringify(h264).slice(0, 200))
const vp9 = await pa.evaluate(([u]) => window.probe(u), [U('vp9.webm')]); check('video format check: VP9 WebM is recognised', vp9.ok && vp9.advice.family === 'VP9', JSON.stringify(vp9).slice(0, 160))
const hevc = await pa.evaluate(([u]) => window.probe(u), [U('hevc.mp4')]); note(`HEVC in this Chromium: ${JSON.stringify({ ok: hevc.ok, codec: hevc.codec, canDecode: hevc.canDecode, level: hevc.advice?.level })}`)
check('video format check: HEVC is flagged (warn or bad), never "ok"', hevc.ok && hevc.advice.level !== 'ok', hevc.advice?.message)
const nope = await pa.evaluate(([u]) => window.probe(u), [`${BASE}/out/missing.mp4`]); check('video format check: a missing file is an error message', !nope.ok && /HTTP 404|could not/i.test(nope.error), nope.error)
await pa.close()

// ═══ 5. The real editor: import → edit → Player → export → download ═════════════════════════════════════════════
const pb = await browser.newPage({ viewport: { width: 1200, height: 6000 } }); watch(pb); sturdy(pb, () => window.ready === true)
await pb.goto(`${BASE}/editor.html`); await pb.waitForFunction(() => window.ready === true, null, { timeout: 120000 }); await pb.waitForTimeout(2500); await pb.waitForFunction(() => window.ready === true, null, { timeout: 120000 })
await pb.evaluate((u) => window.__setVideo(u), U('grey.mp4')); await pb.waitForSelector('[data-testid="captions-panel"]', { timeout: 60000 })
await pb.evaluate(() => window.__ctx.editPreviewSettings((p) => ({ ...p, durationInFrames: 180, fps: 30, showEndCard: false, layers: [] })))
const srtPath = path.join(out, 'in.srt'); fs.writeFileSync(srtPath, SRT)
await pb.getByLabel('Import subtitle file').setInputFiles(srtPath)
await pb.getByTestId('captions-message').waitFor({ timeout: 30000 })
const settings = () => pb.evaluate(() => JSON.parse(JSON.stringify(window.__ctx.previewSettings)))
let s = await settings(); check('editor: importing a file puts two cues in the project', s.captions?.cues?.length === 2 && s.captions.source === 'srt', await pb.getByTestId('captions-message').textContent())
await pb.getByLabel('Cue 1 text').fill('Hello from Acme'); s = await settings(); check('editor: editing a cue changes the project', s.captions.cues[0].text === 'Hello from Acme')
await pb.getByLabel('Caption style preset').selectOption('tiktok'); await pb.waitForTimeout(500)
await pb.evaluate(() => { const p = window.__player.current; p.pause(); p.seekTo(30) }); await pb.waitForTimeout(2500)
const inPlayer = await pb.evaluate(() => document.querySelector('[data-captions]')?.textContent)
check('editor: the Player shows the edited caption at 1.0 s', inPlayer === 'HELLO FROM ACME', String(inPlayer))
const shot = path.join(out, 'preview-frame30.png'); await pb.getByTestId('preview-wrap').screenshot({ path: shot })
const ex = await pb.evaluate(() => window.__export()); check('editor: the export of the same project succeeds', ex.ok, ex.error ?? '')
if (ex.ok) { const f = path.join(out, 'editor-export.mp4'); fs.writeFileSync(f, Buffer.from(ex.b64, 'base64'))
  const dims = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height', '-of', 'json', f], { encoding: 'utf8' }).stdout).streams[0]
  const exF = frameRgb(f, 30, dims.width); const pv = spawnSync('ffmpeg', ['-v', 'error', '-i', shot, '-vf', `scale=${dims.width}:${dims.height}:flags=bilinear`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 27 }).stdout
  let sum = 0; for (let i = 0; i < exF.length; i++) sum += Math.abs(exF[i] - pv[i]); const bx = textBox(exF, dims.width, dims.height), bp = textBox(pv, dims.width, dims.height)
  check('preview parity: the Player frame and the exported frame agree (mean abs diff < 10) and the caption is at the same place (±8 px)', sum / exF.length < 10 && Math.abs(bx.cy - bp.cy) <= 8 && Math.abs((bx.x0 + bx.x1) / 2 - (bp.x0 + bp.x1) / 2) <= 8, `${(sum / exF.length).toFixed(2)}, centre y ${bx.cy.toFixed(0)} vs ${bp.cy.toFixed(0)}`) }
const [dl] = await Promise.all([pb.waitForEvent('download'), pb.getByRole('button', { name: 'Download SRT' }).click()])
const dlText = fs.readFileSync(await dl.path(), 'utf8'); const back = await (await browser.newPage()).evaluate(() => 1).then(() => null).catch(() => null); void back
check('editor: "Download SRT" gives a file with the edited text and exact times', dl.suggestedFilename() === 'captions.srt' && dlText.includes('Hello from Acme') && dlText.includes('00:00:00,500 --> 00:00:02,000') && dlText.includes('00:00:03,000 --> 00:00:04,500'), dlText.replace(/\n/g, '⏎').slice(0, 120))
check('no page errors or console errors in the browser', problems.length === 0, problems.slice(0, 5).join(' | '))
await browser.close(); await server.close()
console.log(`\n${passed} passed, ${failed.length} failed, ${skipped.length} skipped`)
for (const f of failed) console.log('  FAILED:', f); for (const k of skipped) console.log('  SKIPPED:', k)
process.exit(failed.length ? 1 : 0)
