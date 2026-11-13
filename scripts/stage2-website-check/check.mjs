// Stage 2 acceptance check. Usage: node scripts/stage2-website-check/check.mjs  (after capture.mjs has produced out/capture.json)
// Drives the REAL editor (provider + OverlayEditor + Website background panel) in headless Chromium: capture through the real client
// (job polling included), tune the motion with the panel's controls, check the REAL preview Player, then run the app's own exporter and
// verify the MP4 with ffprobe and with frames compared against the ACTUAL captured screenshot. Exits non-zero on any failed check.
import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decode } from '../stage1-render-check/png.mjs'
import { startEditorServer } from '../stage1-render-check/editor-server.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, 'out')
const PORT = 5195
if (!fs.existsSync(path.join(out, 'capture.json'))) { console.error('Run capture.mjs first (npx tsx scripts/stage2-website-check/capture.mjs).'); process.exit(2) }
const captureJson = JSON.parse(fs.readFileSync(path.join(out, 'capture.json'), 'utf8'))
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' })

// A stand-in for the presenter: a solid magenta video, so "the website handed over to the presenter" is unambiguous in pixels.
run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0xff00ff:s=1280x720:r=30:d=8', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, 'presenter.mp4')])

const server = await startEditorServer(PORT, here)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 3400 } })
const problems = []
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message.slice(0, 300)}`))
page.on('console', (m) => { if (m.type() === 'error') problems.push(`[console.error] ${m.text().slice(0, 300)}`) })

let postCalls = 0
let statusCalls = 0
await page.route((u) => u.origin === `http://localhost:${PORT}` && u.pathname === '/api/motion-studio/capture', async (r) => {
  postCalls += 1
  // Like production: the host answers 202 with a job id, and the client polls the status route.
  await r.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ jobId: '11111111-1111-4111-8111-111111111111', state: 'running' }) })
})
await page.route((u) => u.origin === `http://localhost:${PORT}` && u.pathname === '/api/motion-studio/capture/status', async (r) => {
  statusCalls += 1
  await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(statusCalls < 2 ? { state: 'running' } : { state: 'done', capture: captureJson }) })
})
await page.route((u) => u.origin === `http://localhost:${PORT}` && (u.pathname.startsWith('/api/') || u.pathname.startsWith('/.netlify/')) && !u.pathname.startsWith('/api/motion-studio/capture'), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))

await page.goto(`http://localhost:${PORT}/website.html`)
await page.waitForFunction(() => window.ready === true && window.__ctx?.previewSettings?.layers?.length > 0, null, { timeout: 120000 })

const results = []
const check = (name, ok, detail = '') => { results.push([name, !!ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }
const settings = () => page.evaluate(() => window.__ctx.previewSettings)
const bgOf = async () => (await settings()).websiteBackground

// ── Seed a 640x360, 6 s project with a presenter video and a small caption ───────────────────────────────────────────
await page.evaluate(() => {
  window.__setVideo('/out/presenter.mp4')
  window.__ctx.editPreviewSettings((p) => ({ ...p, width: 640, height: 360, fps: 30, durationInFrames: 180, aspectRatio: '16:9', showEndCard: false, brandColors: { ...p.brandColors, backgroundDim: 0 } }))
  window.__ctx.updatePreviewLayer('headline', { text: 'Hello Acme', x: 0.5, y: 0.9, scale: 0.05 })
  for (const id of ['logo', 'businessName']) window.__ctx.updatePreviewLayer(id, { visible: false })
})
await page.waitForTimeout(800)

// ── 1. Capture through the real client + panel ───────────────────────────────────────────────────────────────────────
await page.getByLabel('Website address').fill('https://smartvid.app/')
await page.getByLabel('Capture website').click()
await page.getByText(/Capturing the website/).waitFor({ timeout: 10000 })
check('shows capture progress while the job runs', true)
try { await page.getByLabel('Use page home').waitFor({ timeout: 40000 }) } catch (e) { console.log('PANEL TEXT:', (await page.getByTestId('website-background-panel').innerText()).slice(0, 600)); console.log('PROBLEMS:', problems.join(' | ')); console.log(`POST=${postCalls} status=${statusCalls}`); throw e }
check('real client posted once and polled the job until done', postCalls === 1 && statusCalls >= 2, `POST=${postCalls}, status polls=${statusCalls}`)
await page.getByLabel('Use page home').click()
await page.waitForTimeout(500)
let bg = await bgOf()
check('choosing the page makes it the website background', !!bg && bg.page.url.endsWith('/page.jpg') && bg.page.width === 3840 && bg.page.height === 3492, bg ? `${bg.page.width}x${bg.page.height}` : 'none')
check('source attribution is recorded', bg?.source.url === 'https://smartvid.app/' && /SmartVideo/.test(bg.source.title) && !!bg.source.capturedAt)
check('attribution and permission notice are shown to the user', /Captured from smartvid\.app on \d{4}-\d{2}-\d{2}.*permission/.test(await page.getByTestId('website-attribution').textContent()))
check('the page thumbnail loads in the panel', await page.locator('[data-testid="website-background-panel"] img').first().evaluate((i) => i.complete && i.naturalWidth > 0))
check('the editor stage shows the website, not the "Your video" placeholder', await page.getByTestId('stage-website-background').evaluate((i) => i.complete && i.naturalWidth > 0))
await page.screenshot({ path: path.join(out, 'stage2-01-captured.png'), clip: { x: 0, y: 0, width: 1200, height: 3400 } })

// ── 2. Tune the motion with the panel controls ───────────────────────────────────────────────────────────────────────
await page.getByLabel('Website ends at (seconds)').fill('4')
await page.getByLabel('Website transition').selectOption('fade')
await page.getByLabel('Scroll easing').selectOption('linear')
await page.getByLabel('Scroll end').fill('0.5')
await page.getByLabel('Website zoom end').fill('1.3')
await page.getByLabel('Zoom centre top-bottom').fill('0.35')
await page.getByLabel('Cursor movement').selectOption('cta-corner')
await page.waitForTimeout(400)
bg = await bgOf()
check('the controls wrote the motion (4 s window, fade, scroll 0->0.5, zoom 1->1.3, cursor + click)', bg.endFrame === 120 && bg.transition === 'fade' && bg.scroll.to === 0.5 && Math.abs(bg.zoom.to - 1.3) < 1e-6 && bg.cursor.enabled && bg.cursor.clicks.length === 1, JSON.stringify({ end: bg.endFrame, t: bg.transition, s: bg.scroll, z: bg.zoom, c: bg.cursor.clicks }))

// ── 3. The REAL preview Player ───────────────────────────────────────────────────────────────────────────────────────
const wrap = page.getByTestId('preview-wrap')
async function previewFrame(f) {
  await page.evaluate((n) => window.__player.current.seekTo(n), f)
  await page.waitForTimeout(900)
  const file = path.join(out, `preview-f${f}.png`)
  await wrap.screenshot({ path: file })
  return { file, img: decode(fs.readFileSync(file)) }
}
const px = (img, x, y) => img.at(Math.min(img.w - 1, Math.max(0, Math.round(x))), Math.min(img.h - 1, Math.max(0, Math.round(y))))
const isMagenta = (c) => c[0] > 200 && c[2] > 200 && c[1] < 90
const countNear = (img, cx, cy, r, pred) => { cx = Math.round(cx); cy = Math.round(cy); let n = 0; for (let y = Math.max(0, cy - r); y <= Math.min(img.h - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(img.w - 1, cx + r); x++) if (pred(img.at(x, y))) n++; return n }
const pf0 = await previewFrame(0)
const pf30 = await previewFrame(30)
const pf72 = await previewFrame(72)
const pf96 = await previewFrame(96)
const pf150 = await previewFrame(150)
check('preview f0: the website has not faded in yet, so the presenter shows', isMagenta(px(pf0.img, 320, 180)))
check('preview f30: the website is on screen (not the presenter)', !isMagenta(px(pf30.img, 320, 180)) && !isMagenta(px(pf30.img, 100, 100)))
check('preview f150: after the window the presenter video is back', isMagenta(px(pf150.img, 320, 180)))
check('preview: the website scrolled between f30 and f72', countNear(pf30.img, 320, 180, 150, () => true) > 0 && JSON.stringify(pf30.img.at(320, 120)) !== JSON.stringify(pf72.img.at(320, 120)) || JSON.stringify(pf30.img.at(100, 200)) !== JSON.stringify(pf72.img.at(100, 200)))
// cursor_corner preset: at window progress 0.6 (f72) the arrow is at ~(0.82, 0.12) of the frame
const whiteAtCursor = countNear(pf72.img, 0.82 * 640, 0.12 * 360, 22, (c) => c[0] > 235 && c[1] > 235 && c[2] > 235)
check('preview f72: the cursor is drawn at the top-right button position', whiteAtCursor > 12, `${whiteAtCursor} white pixels near (525,43)`)
// The ripple fades as it grows, so it blends with the page: detect "clearly green" (the accent hue) rather than the exact colour.
const accent = (c) => c[1] > c[0] + 25 && c[1] > c[2] + 15
const ring96 = countNear(pf96.img, 0.82 * 640, 0.12 * 360, 40, accent)
const ring72 = countNear(pf72.img, 0.82 * 640, 0.12 * 360, 40, accent)
check('preview f96: the click ripple is visible; before the click it is not', ring96 > 40 && ring72 < 5, `ripple px ${ring96} vs ${ring72} before`)

// ── 4. Real export of the full-effect project ────────────────────────────────────────────────────────────────────────
async function exportNow(label) {
  const r = await page.evaluate(() => window.__export())
  if (!r.ok) { check(`${label}: export succeeded`, false, `${r.reason}: ${r.error}`); return null }
  const file = path.join(out, `stage2-${label}.${r.ext}`)
  fs.writeFileSync(file, Buffer.from(r.b64, 'base64'))
  const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file]).stdout || '{}')
  const v = (probe.streams || []).find((s) => s.codec_type === 'video')
  check(`${label}: the app's exporter produced a valid video`, !!v && r.bytes > 5000, v ? `${v.codec_name} ${v.width}x${v.height}, ${v.nb_read_frames} frames, ${Number(probe.format?.duration).toFixed(2)}s, ${r.bytes} bytes, ${r.ms} ms, warning=${r.warning ?? 'none'}` : r.error)
  return { file, v, probe }
}
function frameOf(file, n, name) {
  const png = path.join(out, `${name}.png`)
  run('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vf', `select=eq(n\\,${n})`, '-frames:v', '1', '-vsync', '0', png])
  return { png, img: fs.existsSync(png) ? decode(fs.readFileSync(png)) : null }
}
const E = await exportNow('full-effect')
if (E?.v) {
  check('full-effect: 640x360, 6 s (180 frames)', E.v.width === 640 && E.v.height === 360 && Math.abs(Number(E.v.nb_read_frames) - 180) <= 2 && Math.abs(Number(E.probe.format.duration) - 6) < 0.2)
  const ef0 = frameOf(E.file, 0, 'e-f0'); const ef30 = frameOf(E.file, 30, 'e-f30'); const ef72 = frameOf(E.file, 72, 'e-f72'); const ef96 = frameOf(E.file, 96, 'e-f96'); const ef150 = frameOf(E.file, 150, 'e-f150')
  check('export f0: presenter before the fade-in', !!ef0.img && isMagenta(px(ef0.img, 320, 180)))
  check('export f30: the website is on screen', !!ef30.img && !isMagenta(px(ef30.img, 320, 180)))
  check('export f150: handed back to the presenter after the window', !!ef150.img && isMagenta(px(ef150.img, 320, 180)))
  const w = ef72.img ? countNear(ef72.img, 0.82 * 640, 0.12 * 360, 22, (c) => c[0] > 235 && c[1] > 235 && c[2] > 235) : 0
  check('export f72: the cursor is drawn at the same place as in the preview', w > 12, `${w} white pixels`)
  globalThis.__ef96 = ef96
  // preview == export (same composition): compare the frames numerically
  const psnr = (a, b) => { const r = run('ffmpeg', ['-v', 'info', '-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-']); const m = /average:([0-9.]+|inf)/.exec(r.stderr); return m ? (m[1] === 'inf' ? 99 : Number(m[1])) : NaN }
  const p72 = psnr(pf72.file, ef72.png)
  const p30 = psnr(pf30.file, ef30.png)
  check('preview and export agree (PSNR >= 18 dB at f30 and f72)', p72 >= 18 && p30 >= 18, `f30 ${p30.toFixed(1)} dB, f72 ${p72.toFixed(1)} dB`)
}

// ── 4b. A/B: the same project with the click removed. Frame 96 may differ only around the click point ────────────────
await page.evaluate(() => window.__ctx.editPreviewSettings((p) => ({ ...p, websiteBackground: { ...p.websiteBackground, cursor: { ...p.websiteBackground.cursor, clicks: [] } } })))
await page.waitForTimeout(500)
const N = await exportNow('no-click')
if (N?.v && globalThis.__ef96?.img) {
  const nf96 = frameOf(N.file, 96, 'n-f96'); const nf72 = frameOf(N.file, 72, 'n-f72')
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  // Counts pixels whose luminance differs by more than 8, split into "within r of the click" and "elsewhere".
  const diffSplit = (a, b, cx, cy, r) => { let inn = 0, out = 0, innArea = 0, outArea = 0; for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) { const near = Math.hypot(x - cx, y - cy) <= r; near ? innArea++ : outArea++; if (Math.abs(lum(a.at(x, y)) - lum(b.at(x, y))) > 8) near ? inn++ : out++ } return { inn, out, innDensity: inn / innArea, outDensity: out / outArea } }
  const cx = Math.round(0.82 * 640), cy = Math.round(0.12 * 360)
  const d96 = diffSplit(globalThis.__ef96.img, nf96.img, cx, cy, 30)
  const d72 = diffSplit(frameOf(E.file, 72, 'e-f72b').img, nf72.img, cx, cy, 30)
  // The two videos are bit-identical until the click frame; afterwards H.264 inter-frame prediction spreads a little noise over the
  // whole picture, so the signal is the DENSITY of differences: much higher around the click than elsewhere.
  check('export f96: the click ripple is in the exported video (A/B against the same video without the click)', d96.inn >= 100 && d96.innDensity >= 2.5 * d96.outDensity, `around the click ${(d96.innDensity * 100).toFixed(1)}% of pixels differ (${d96.inn}px) vs ${(d96.outDensity * 100).toFixed(1)}% elsewhere`)
  check('export f72: before the click the two videos are identical around the click point', d72.inn === 0, `${d72.inn} differ`)
}

// ── 5. Scroll accuracy against the ACTUAL captured screenshot ────────────────────────────────────────────────────────
await page.evaluate(() => {
  window.__ctx.updatePreviewLayer('headline', { visible: false })
  window.__ctx.editPreviewSettings((p) => ({ ...p, durationInFrames: 90, websiteBackground: { ...p.websiteBackground, startFrame: 0, endFrame: 90, transition: 'cut', ease: 'linear', scroll: { from: 0, to: 1 }, zoom: { from: 1, to: 1 }, cursor: { ...p.websiteBackground.cursor, enabled: false } } }))
})
await page.waitForTimeout(600)
const A = await exportNow('scroll-accuracy')
if (A?.v) {
  const pageJpg = path.join(out, 'capture', 'harness-user')
  const found = run('bash', ['-lc', `find ${path.join(out, 'capture')} -name page.jpg | head -1`]).stdout.trim()
  const maxScroll = 3492 * (640 / 3840) - 360 // 222
  const psnr = (a, b) => { const r = run('ffmpeg', ['-v', 'info', '-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-']); const m = /average:([0-9.]+|inf)/.exec(r.stderr); return m ? (m[1] === 'inf' ? 99 : Number(m[1])) : NaN }
  for (const f of [15, 45, 75]) {
    const got = frameOf(A.file, f, `a-f${f}`)
    const expectAt = (y, tag) => { const png = path.join(out, `a-expected-${tag}.png`); run('ffmpeg', ['-v', 'error', '-y', '-i', found, '-vf', `scale=640:-1,crop=640:360:0:${Math.max(0, Math.round(y))}`, '-frames:v', '1', png]); return png }
    const rightY = maxScroll * (f / 90)
    const good = psnr(got.png, expectAt(rightY, `f${f}-right`))
    const bad = psnr(got.png, expectAt(0, `f${f}-top`))
    check(`scroll accuracy f${f}: the exported frame matches the captured page scrolled to y=${Math.round(rightY)}px (and not the top)`, good >= 20 && good > bad + 3, `matches expected ${good.toFixed(1)} dB vs wrong-offset ${bad.toFixed(1)} dB`)
  }
}

check('no page errors or console errors', problems.length === 0, problems.slice(0, 2).join(' | '))
await browser.close(); await server.close()
const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Output: ${out}`)
process.exit(failed.length ? 1 : 0)
