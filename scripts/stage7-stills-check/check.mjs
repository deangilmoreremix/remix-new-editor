// Stage 7 acceptance check. Usage: node scripts/stage7-stills-check/check.mjs  (needs ffmpeg)
// Real headless Chromium: thumbnails and GIFs are made from the REAL composition through Remotion's web renderer, then decoded with ffmpeg
// (an independent GIF/JPEG decoder) and compared with the source video's own frames. Exits non-zero on any failed check.
import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startPresenterServer } from '../stage3-presenter-check/presenter-server.mjs'

const here = path.dirname(fileURLToPath(import.meta.url)); const out = path.join(here, 'out'); fs.mkdirSync(out, { recursive: true })
const PORT = 5215; const BASE = `http://localhost:${PORT}`; const U = (n) => `${BASE}/out/${n}`
let passed = 0; const failed = []
const check = (name, ok, detail = '') => { if (ok) passed += 1; else failed.push(`${name} ${detail}`); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }
const note = (s) => console.log(`NOTE  ${s}`)
const sh = (cmd, args, o = {}) => { const r = spawnSync(cmd, args, { maxBuffer: 1 << 28, ...o }); if (r.status !== 0) throw new Error(`${cmd}: ${String(r.stderr)}`); return r }
const mk = (args) => sh('ffmpeg', ['-v', 'error', '-y', ...args])

// Fixtures. "ramp": every frame a different, smoothly changing flat colour (so a wrong frame or a wrong palette is visible); "intro": 1 s black
// then 5 s of detailed moving pattern (the automatic thumbnail must not pick the black part).
// Tagged BT.709 end to end (converted with the 709 matrix), so ffmpeg and Chromium agree on what colour the pixels are.
mk(['-f', 'lavfi', '-i', "nullsrc=s=640x360:r=30:d=6,format=gbrp,geq=r='128+127*sin(T*5)':g='128+127*sin(T*5+2.1)':b='128+127*sin(T*5+4.2)'", '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv444p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:v', 'libx264', '-crf', '8', path.join(out, 'ramp.mp4')])
mk(['-f', 'lavfi', '-i', 'color=c=black:s=640x360:r=30:d=1', '-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=30:d=5', '-filter_complex', '[0][1]concat=n=2:v=1[v]', '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(out, 'intro.mp4')])
const rawFrame = (f, n, w = 640, h = 360, extra = []) => sh('ffmpeg', ['-v', 'error', '-i', f, ...extra, '-vf', `select=eq(n\\,${n})`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']).stdout
const gifFrames = (f) => { const r = sh('ffmpeg', ['-v', 'error', '-i', f, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']).stdout; return r }
const probe = (f, e) => JSON.parse(sh('ffprobe', ['-v', 'error', '-count_frames', ...e, '-of', 'json', f], { encoding: 'utf8' }).stdout)
const mean = (b, w, x0, y0, x1, y1, off = 0) => { let r = 0, g = 0, bl = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = off + (y * w + x) * 3; r += b[i]; g += b[i + 1]; bl += b[i + 2]; n++ } return [r / n, g / n, bl / n] }
const dist = (a, c) => Math.max(Math.abs(a[0] - c[0]), Math.abs(a[1] - c[1]), Math.abs(a[2] - c[2]))

const server = await startPresenterServer(PORT, here)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox'] })
const problems = []
const watch = (page) => { page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message.slice(0, 300)}`)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|GL Driver|INFO:/.test(m.text())) problems.push(`[console.error] ${m.text().slice(0, 300)}`) }) }
const sturdy = (page, readyFn) => { const orig = page.evaluate.bind(page); page.evaluate = async (...a) => { for (let i = 0; ; i++) { try { return await orig(...a) } catch (e) { if (i < 4 && /context was destroyed|navigation/i.test(String(e))) { await page.waitForFunction(readyFn, null, { timeout: 120000 }); continue } throw e } } } }
const pa = await browser.newPage(); watch(pa); sturdy(pa, 'window.ready === true')
await pa.goto(`${BASE}/stills.html`); await pa.waitForFunction('window.ready === true', null, { timeout: 120000 }); await pa.waitForTimeout(2500); await pa.waitForFunction('window.ready === true', null, { timeout: 120000 })

// ═══ 1. GIF from the real composition ═══════════════════════════════════════════════════════════════════════════
const gcfg = { videoUrl: U('ramp.mp4'), frames: 180, gif: { startSec: 1, durationSec: 3, fps: 8, width: 320, dither: false, loop: true }, headline: 'Hi Acme' }
const g = await pa.evaluate((c) => window.gif(c), gcfg)
check('GIF is created from the real composition', g.ok, g.error ?? '')
const gifFile = path.join(out, 'ramp.gif'); if (g.ok) fs.writeFileSync(gifFile, Buffer.from(g.b64, 'base64'))
if (g.ok) {
  note(`GIF: ${g.plan.frames.length} frames, ${g.w}×${g.h}, ${(g.bytes / 1024).toFixed(0)} KB, ${g.stats.colors} colours, made in ${g.ms} ms`)
  check('the file starts with the GIF89a signature and ends with the trailer', fs.readFileSync(gifFile).subarray(0, 6).toString() === 'GIF89a' && fs.readFileSync(gifFile)[g.bytes - 1] === 0x3b)
  const info = probe(gifFile, ['-show_entries', 'stream=codec_name,width,height,nb_read_frames,avg_frame_rate'])
  const st = info.streams[0]
  check('ffmpeg (independent decoder) reads it: GIF, 320×180, one frame per planned frame', st.codec_name === 'gif' && st.width === 320 && st.height === 180 && Number(st.nb_read_frames) === g.plan.frames.length, JSON.stringify(st))
  const dec = await pa.evaluate(([b]) => window.imgDecode(b), [g.b64]); check('Chromium decodes it as an image of the right size', dec.ok && dec.w === 320 && dec.h === 180)
  // every frame must show the colour the SOURCE video has at that moment (the old encoder got frames 2+ wrong)
  const all = gifFrames(gifFile); const frameBytes = 320 * 180 * 3; let worst = 0, worstAt = -1
  g.plan.frames.forEach((f, i) => { const gifC = mean(all, 320, 20, 100, 120, 170, i * frameBytes); const src = rawFrame(path.join(out, 'ramp.mp4'), f); const srcC = mean(src, 640, 40, 200, 240, 340); const d = dist(gifC, srcC); if (d > worst) { worst = d; worstAt = i } })
  check('EVERY GIF frame shows the colour of the source video at its moment (worst difference ≤ 14/255)', worst <= 14, `worst ${worst.toFixed(1)} at GIF frame ${worstAt}`)
  // the personalization is in every frame: white headline pixels near the top
  let textFrames = 0; for (let i = 0; i < g.plan.frames.length; i++) { let n = 0; for (let y = 10; y < 80; y++) for (let x = 40; x < 280; x++) { const o = i * frameBytes + (y * 320 + x) * 3; if (all[o] > 235 && all[o + 1] > 235 && all[o + 2] > 235) n++ } if (n > 80) textFrames++ }
  check('the personalized headline is drawn in every GIF frame', textFrames === g.plan.frames.length, `${textFrames}/${g.plan.frames.length}`)
  check('the frames are spaced as planned (delay 130 ms ≈ 7.7 fps)', g.plan.delayMs === 130, `${g.plan.delayMs} ms`)
  check('the GIF is light enough for email (< 1 MB)', g.bytes < 1_048_576, `${(g.bytes / 1024).toFixed(0)} KB`)
}
// different recipient → different GIF; same recipient → identical frames
const g2 = await pa.evaluate((c) => window.gif(c), { ...gcfg, headline: 'Hi Brightside Plumbing' })
if (g.ok && g2.ok) { fs.writeFileSync(path.join(out, 'ramp2.gif'), Buffer.from(g2.b64, 'base64')); const a = gifFrames(gifFile), b = gifFrames(path.join(out, 'ramp2.gif')); let diff = 0; for (let y = 10; y < 80; y++) for (let x = 40; x < 280; x++) { const o = (y * 320 + x) * 3; if (Math.abs(a[o] - b[o]) > 60) diff++ }
  check('a different recipient name makes a different GIF (text region differs, background does not)', diff > 150 && dist(mean(a, 320, 20, 120, 120, 170), mean(b, 320, 20, 120, 120, 170)) <= 6, `${diff} differing text pixels`) }
const g3 = await pa.evaluate((c) => window.gif(c), gcfg); check('the same inputs give byte-identical GIFs (deterministic)', g.ok && g3.ok && g.b64 === g3.b64)
const gdith = await pa.evaluate((c) => window.gif({ ...c, gif: { ...c.gif, dither: true } }), gcfg); check('dithering still produces a valid GIF', gdith.ok && gdith.bytes > 1000)
const gnoloop = await pa.evaluate((c) => window.gif({ ...c, gif: { ...c.gif, loop: false } }), gcfg)
if (gnoloop.ok) { const bytes = Buffer.from(gnoloop.b64, 'base64'); check('loop off: no loop extension is written', !bytes.includes(Buffer.from('NETSCAPE2.0'))); check('loop on: the extension is written', Buffer.from(g.b64, 'base64').includes(Buffer.from('NETSCAPE2.0'))) }
const gend = await pa.evaluate((c) => window.gif({ ...c, gif: { ...c.gif, startSec: 5, durationSec: 4 } }), gcfg); check('a window that runs past the end of the video is clipped, not an error', gend.ok && gend.plan.truncated === true && gend.plan.frames.length <= 9, `${gend.plan?.frames?.length} frames`)

// ═══ 2. Thumbnails ═══════════════════════════════════════════════════════════════════════════════════════════════
const tcfg = { videoUrl: U('intro.mp4'), frames: 180, thumbnail: { frame: null, playButton: false, width: 640 } }
const t = await pa.evaluate((c) => window.thumb(c), tcfg)
check('automatic thumbnail succeeds', t.ok, t.error ?? '')
if (t.ok) {
  fs.writeFileSync(path.join(out, 'thumb-auto.jpg'), Buffer.from(t.b64, 'base64'))
  check('the automatic choice avoids the black first second (frame ≥ 30)', t.frame >= 30, `chose frame ${t.frame}; ${t.scores.slice(0, 3).map((s) => `${s.frame}:${s.score}`).join(' ')}…`)
  const early = t.scores.filter((s) => s.frame < 30); check('black candidates scored as dark (reason given)', early.length === 0 || early.every((s) => s.reasons.includes('too dark')), JSON.stringify(early))
  const pr = probe(path.join(out, 'thumb-auto.jpg'), ['-show_entries', 'stream=codec_name,width,height']).streams[0]
  check('the file is a real JPEG of the requested size (ffprobe)', pr.codec_name === 'mjpeg' && pr.width === 640 && pr.height === 360, JSON.stringify(pr))
  const px = rawFrame(path.join(out, 'thumb-auto.jpg'), 0); let lum = 0; for (let i = 0; i < px.length; i += 3) lum += px[i]; check('the thumbnail is not a black frame', lum / (px.length / 3) > 40, `mean red ${(lum / (px.length / 3)).toFixed(0)}`)
}
const tm = await pa.evaluate((c) => window.thumb({ ...c, thumbnail: { frame: 90, playButton: false, width: 640 } }), tcfg)
const tp = await pa.evaluate((c) => window.thumb({ ...c, thumbnail: { frame: 90, playButton: true, width: 640 } }), tcfg)
if (tm.ok && tp.ok) {
  check('a manual frame is used exactly (frame 90, no scoring)', tm.frame === 90 && tm.auto === false && tm.scores.length === 0)
  fs.writeFileSync(path.join(out, 'thumb-plain.jpg'), Buffer.from(tm.b64, 'base64')); fs.writeFileSync(path.join(out, 'thumb-play.jpg'), Buffer.from(tp.b64, 'base64'))
  const a = rawFrame(path.join(out, 'thumb-plain.jpg'), 0), b = rawFrame(path.join(out, 'thumb-play.jpg'), 0)
  const corner = dist(mean(a, 640, 0, 0, 60, 60), mean(b, 640, 0, 0, 60, 60))
  let white = 0; for (let y = 150; y < 210; y++) for (let x = 305; x < 345; x++) { const i = (y * 640 + x) * 3; if (b[i] > 235 && b[i + 1] > 235 && b[i + 2] > 235) white++ }
  const disc = dist(mean(a, 640, 288, 172, 300, 188), mean(b, 640, 288, 172, 300, 188))
  check('the play button is drawn in the middle (darkened disc, white triangle) and nowhere else', disc > 20 && corner <= 4 && white > 150, `disc Δ${disc.toFixed(0)}, corner Δ${corner.toFixed(0)}, ${white} white px`)
  const src = rawFrame(path.join(out, 'intro.mp4'), 90); const thumbC = mean(a, 640, 20, 20, 140, 100), srcC = mean(src, 640, 20, 20, 140, 100); check('the thumbnail shows the video\'s own picture at that frame (±12)', dist(thumbC, srcC) <= 12, `${thumbC.map(Math.round)} vs ${srcC.map(Math.round)}`)
}
const tpng = await pa.evaluate((c) => window.thumb({ ...c, thumbnail: { frame: 90, playButton: false, width: 320 } }, 'png'), tcfg); check('PNG output works', tpng.ok && tpng.type === 'image/png' && Buffer.from(tpng.b64, 'base64').subarray(1, 4).toString() === 'PNG')

// ═══ 3. The legacy thumbnail-studio encoder (src/lib/gifEncoder.js) ══════════════════════════════════════════════
const leg = await pa.evaluate(() => window.legacy([[255, 0, 0], [0, 200, 0], [0, 0, 255]], 64, 48))
if (leg.ok) { const f = path.join(out, 'legacy.gif'); fs.writeFileSync(f, Buffer.from(leg.b64, 'base64')); const all = gifFrames(f); const fb = 64 * 48 * 3; const cols = [0, 1, 2].map((i) => mean(all, 64, 20, 20, 60, 44, i * fb))
  check('the legacy encoder now produces three CORRECT frames (red, green, blue), where the old one drew blank/wrong frames', dist(cols[0], [255, 0, 0]) <= 6 && dist(cols[1], [0, 200, 0]) <= 6 && dist(cols[2], [0, 0, 255]) <= 6, JSON.stringify(cols.map((c) => c.map(Math.round)))) }
else check('legacy encoder returns a GIF data URL', false)
await pa.close()

// ═══ 4. The real editor ═════════════════════════════════════════════════════════════════════════════════════════
const pb = await browser.newPage({ viewport: { width: 1200, height: 6800 }, acceptDownloads: true }); watch(pb); sturdy(pb, () => window.ready === true)
await pb.goto(`${BASE}/editor.html`); await pb.waitForFunction(() => window.ready === true, null, { timeout: 120000 }); await pb.waitForTimeout(2500); await pb.waitForFunction(() => window.ready === true, null, { timeout: 120000 })
await pb.evaluate((u) => window.__setVideo(u), U('ramp.mp4')); await pb.waitForSelector('[data-testid="thumbnail-gif-panel"]', { timeout: 60000 })
await pb.evaluate(() => window.__ctx.editPreviewSettings((p) => ({ ...p, durationInFrames: 120, fps: 30, showEndCard: false, width: 640, height: 360, layers: [{ id: 'headline', kind: 'headline', visible: true, x: 0.5, y: 0.2, scale: 0.12, animation: 'none', animationDelay: 0, startFrame: 0, opacity: 1, text: 'Editor GIF', color: '#ffffff' }] })))
await pb.getByLabel('GIF width').fill('240'); await pb.getByLabel('Length').fill('1.5'); await pb.getByLabel('Frames per second').fill('6')
await pb.getByRole('button', { name: 'Create GIF' }).click(); await pb.getByTestId('gif-result').waitFor({ timeout: 120000 })
check('editor: the GIF result shows its size and the email advice', /240×135/.test(await pb.getByTestId('gif-result').textContent()) && /light enough for email/.test(await pb.getByTestId('gif-advice').textContent()), await pb.getByTestId('gif-result').textContent())
const [dl] = await Promise.all([pb.waitForEvent('download'), pb.getByRole('button', { name: 'Download GIF' }).click()]); const gp = await dl.path()
check('editor: "Download GIF" gives a valid GIF that ffmpeg can read', dl.suggestedFilename() === 'video.gif' && fs.readFileSync(gp).subarray(0, 6).toString() === 'GIF89a' && probe(gp, ['-show_entries', 'stream=codec_name,width,height']).streams[0].width === 240)
await pb.getByRole('button', { name: 'Create thumbnail' }).click(); await pb.getByTestId('thumb-result').waitFor({ timeout: 120000 })
const [dl2] = await Promise.all([pb.waitForEvent('download'), pb.getByRole('button', { name: 'Download JPG' }).click()]); const jp = await dl2.path()
check('editor: "Download JPG" gives a JPEG', dl2.suggestedFilename() === 'thumbnail.jpg' && probe(jp, ['-show_entries', 'stream=codec_name']).streams[0].codec_name === 'mjpeg')
check('editor: the thumbnail message says which frame was chosen', /Chose frame \d+/.test(await pb.getByTestId('stills-message').textContent()), await pb.getByTestId('stills-message').textContent())
check('no page errors or console errors in the browser', problems.length === 0, problems.slice(0, 5).join(' | '))
await browser.close(); await server.close()
console.log(`\n${passed} passed, ${failed.length} failed`)
for (const f of failed) console.log('  FAILED:', f)
process.exit(failed.length ? 1 : 0)
