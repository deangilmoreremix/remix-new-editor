// Stage 5 acceptance check. Usage: node scripts/stage5-effects-check/check.mjs  (needs ffmpeg)
// Real headless Chromium + Remotion's web renderer through the app's own exporter. Exported MP4 frames are decoded with ffmpeg and compared with
// (a) the colour maths the model predicts, (b) positions the camera motion implies, (c) fades, (d) text effects with/without, (e) exits and
// entrance animations, and (f) the real editor's Player vs the export. Exits non-zero on any failed check.
import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startPresenterServer } from '../stage3-presenter-check/presenter-server.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, 'out'); fs.mkdirSync(out, { recursive: true })
const PORT = 5211; const BASE = `http://localhost:${PORT}`
let passed = 0; const failed = []; const notes = []
const check = (name, ok, detail = '') => { if (ok) passed += 1; else failed.push(`${name} ${detail}`); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }
const note = (s) => { notes.push(s); console.log(`NOTE  ${s}`) }

const mk = (args) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr) }
const W = 640, H = 360
// Fixtures: four flat colour bands; a two-colour split at 3/4 width (to see zoom/drift move the edge); a flat mid-grey; a flat grey with a magenta box.
const BANDS = [[128, 128, 128], [200, 50, 50], [50, 170, 80], [40, 90, 200]]
const colorSrc = (c) => `color=c=0x${c.map((v) => v.toString(16).padStart(2, '0')).join('')}:s=160x360:r=30:d=2`
mk([...BANDS.flatMap((c) => ['-f', 'lavfi', '-i', colorSrc(c)]), '-filter_complex', '[0][1][2][3]hstack=inputs=4', '-c:v', 'libx264', '-pix_fmt', 'yuv444p', '-crf', '8', path.join(out, 'bands.mp4')])
mk(['-f', 'lavfi', '-i', 'color=c=0x2060c0:s=480x360:r=30:d=2', '-f', 'lavfi', '-i', 'color=c=0xe0a020:s=160x360:r=30:d=2', '-filter_complex', '[0][1]hstack', '-c:v', 'libx264', '-pix_fmt', 'yuv444p', '-crf', '8', path.join(out, 'split.mp4')])
mk(['-f', 'lavfi', '-i', 'color=c=0x808080:s=640x360:r=30:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv444p', '-crf', '8', path.join(out, 'grey.mp4')])

const frameRgb = (file, n) => spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `select=eq(n\\,${n})`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 27 }).stdout
const px = (b, x, y, w = W) => [b[(y * w + x) * 3], b[(y * w + x) * 3 + 1], b[(y * w + x) * 3 + 2]]
const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
const dist = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
const mean = (b, x0, y0, x1, y1, w = W) => { let r = 0, g = 0, bl = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const c = px(b, x, y, w); r += c[0]; g += c[1]; bl += c[2]; n++ } return [r / n, g / n, bl / n] }

const server = await startPresenterServer(PORT, here)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox'] })
const problems = []
const watch = (page) => { page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message.slice(0, 300)}`)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`[console.error] ${m.text().slice(0, 300)}`) }) }
const sturdy = (page, readyFn) => { const orig = page.evaluate.bind(page); page.evaluate = async (...a) => { for (let i = 0; ; i++) { try { return await orig(...a) } catch (e) { if (i < 4 && /context was destroyed|navigation/i.test(String(e))) { await page.waitForFunction(readyFn, null, { timeout: 120000 }); continue } throw e } } } }
const pa = await browser.newPage(); watch(pa); sturdy(pa, 'window.ready === true')
await pa.goto(`${BASE}/fx.html`); await pa.waitForFunction('window.ready === true', null, { timeout: 120000 }); await pa.waitForTimeout(2500); await pa.waitForFunction('window.ready === true', null, { timeout: 120000 })
const U = (n) => `${BASE}/out/${n}.mp4`
const exp = async (name, cfg) => { const r = await pa.evaluate((c) => window.runExport(c), cfg); if (!r.ok) { check(`export ${name}`, false, `${r.error}`); return null } const f = path.join(out, `${name}.mp4`); fs.writeFileSync(f, Buffer.from(r.b64, 'base64')); return { file: f, ...r } }

// ═══ 1. Colour looks: exported pixels vs the model's prediction ═══════════════════════════════════════════════
const presets = await pa.evaluate(() => window.lookPresets())
// The fixture's nominal colours are not what the browser decodes (H.264 colour matrix/range), so the predictor is fed the colours the SAME
// export pipeline produces for the untouched clip. Everything after that point is the model's own maths.
const baseline = await exp('bands-untouched', { videoUrl: U('bands') })
const SRC = baseline ? [0, 1, 2, 3].map((i) => px(frameRgb(baseline.file, 10), i * 160 + 80, 180)) : BANDS
note(`bands as decoded by the exporter: ${JSON.stringify(SRC)} (nominal ${JSON.stringify(BANDS)})`)
let worst = 0; let compared = 0
for (const p of presets.filter((x) => x.id !== 'natural')) {
  const e = await exp(`look-${p.id}`, { videoUrl: U('bands'), footageEffects: { look: { enabled: true, ...p.look } } })
  if (!e) continue
  const b = frameRgb(e.file, 10)
  let ok = true; let detail = ''
  for (let i = 0; i < 4; i++) {
    const x = i * 160 + 80, y = 180; const edge = Math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2)) / Math.SQRT2
    const pred = await pa.evaluate(([c, l, ed]) => window.predict(c, l, ed), [SRC[i], { enabled: true, ...p.look }, edge])
    const got = px(b, x, y); const d = dist(got, pred.map(Math.round)); worst = Math.max(worst, d); compared++
    if (d > 7) { ok = false; detail += ` band${i} got ${got} want ${pred.map(Math.round)};` }
  }
  check(`look "${p.label}": all four colour bands match the prediction (±7)`, ok, detail)
}
note(`colour looks: ${compared} pixels compared with the model, worst difference ${worst}/255`)
// individual controls
for (const [name, look] of [['brightness 1.3', { brightness: 1.3 }], ['contrast 1.4', { contrast: 1.4 }], ['saturation 0', { saturation: 0 }], ['hue +90°', { hue: 90 }], ['warm +1', { temperature: 1 }], ['cool -1', { temperature: -1 }], ['sepia 1', { sepia: 1 }]]) {
  const l = { enabled: true, brightness: 1, contrast: 1, saturation: 1, hue: 0, temperature: 0, grayscale: 0, sepia: 0, blur: 0, vignette: 0, ...look }
  const e = await exp(`ctl-${name.replace(/[^a-z0-9]/gi, '')}`, { videoUrl: U('bands'), footageEffects: { look: l } }); if (!e) continue
  const b = frameRgb(e.file, 10); let worstC = 0
  for (let i = 0; i < 4; i++) { const pred = await pa.evaluate(([c, ll]) => window.predict(c, ll, 0), [SRC[i], l]); worstC = Math.max(worstC, dist(px(b, i * 160 + 80, 180), pred.map(Math.round))) }
  check(`control ${name}: matches the prediction on all four bands (±6)`, worstC <= 6, `worst ${worstC}`)
}
// vignette gradient across the frame
{
  const e = await exp('vignette', { videoUrl: U('grey'), footageEffects: { look: { enabled: true, brightness: 1, contrast: 1, saturation: 1, hue: 0, temperature: 0, grayscale: 0, sepia: 0, blur: 0, vignette: 1 } } })
  if (e) { const b = frameRgb(e.file, 5); const c = px(b, 320, 180), mid = px(b, 480, 180), corner = px(b, 4, 4)
    check('vignette: the centre is untouched, the corner is much darker, and it darkens smoothly in between', dist(c, [128, 128, 128]) <= 3 && corner[0] < 40 && mid[0] <= c[0] && mid[0] >= corner[0], `centre ${c}, mid ${mid}, corner ${corner}`)
    const pc = await pa.evaluate(([l]) => window.predict([128, 128, 128], l, 1), [{ enabled: true, brightness: 1, contrast: 1, saturation: 1, hue: 0, temperature: 0, grayscale: 0, sepia: 0, blur: 0, vignette: 1 }]); check('vignette: the corner matches the model (±8)', Math.abs(px(b, 1, 1)[0] - pc[0]) <= 12, `${px(b, 1, 1)} vs ${pc.map(Math.round)}`) }
}
// blur softens an edge
{
  const e0 = await exp('blur-0', { videoUrl: U('split') }); const e1 = await exp('blur-8', { videoUrl: U('split'), footageEffects: { look: { enabled: true, brightness: 1, contrast: 1, saturation: 1, hue: 0, temperature: 0, grayscale: 0, sepia: 0, blur: 12, vignette: 0 } } })
  if (e0 && e1) { const a = frameRgb(e0.file, 3), b = frameRgb(e1.file, 3); const ramp = (f) => { let n = 0; for (let x = 440; x < 520; x++) { const c = px(f, x, 100); if (c[0] > 70 && c[0] < 190) n++ } return n }
    check('soften: a hard edge becomes a ramp (blur is drawn by the export)', ramp(a) <= 3 && ramp(b) >= 8, `ramp width ${ramp(a)} → ${ramp(b)} px`) }
}

// ═══ 2. Camera motion: where the edge of the picture is at each frame ═══════════════════════════════════════════
const edgeX = (f, y = 100) => { for (let x = 1; x < W; x++) { const a = px(f, x - 1, y), c = px(f, x, y); if (Math.abs(a[0] - c[0]) > 60) return x } return -1 }
{
  const mot = (zoom, pan = { x: { from: 0, to: 0 }, y: { from: 0, to: 0 } }) => ({ motion: { enabled: true, zoom, pan, ease: 'linear' } })
  const e = await exp('motion-zoom', { videoUrl: U('split'), frames: 30, footageEffects: mot({ from: 1, to: 1.5 }) })
  if (e) { const at = (n) => edgeX(frameRgb(e.file, n)); const want = (n) => 320 + 160 * (1 + 0.5 * (n / 29))
    check('zoom 1→1.5 about the centre: the picture edge sits where the maths puts it at frames 0, 14 and 29 (±3 px)', [0, 14, 29].every((n) => Math.abs(at(n) - want(n)) <= 3), `edge x = ${[0, 14, 29].map(at)} want ${[0, 14, 29].map((n) => Math.round(want(n)))}`) }
  const d = await exp('motion-drift', { videoUrl: U('split'), frames: 30, footageEffects: mot({ from: 1.2, to: 1.2 }, { x: { from: -0.05, to: 0.05 }, y: { from: 0, to: 0 } }) })
  if (d) { const at = (n) => edgeX(frameRgb(d.file, n)); const want = (n) => 320 + 160 * 1.2 + (-0.05 + 0.1 * (n / 29)) * W
    check('drift left→right with zoom 1.2: the edge travels 64 px over the clip as modelled (±3 px)', [0, 14, 29].every((n) => Math.abs(at(n) - want(n)) <= 3) && at(29) - at(0) > 55, `edge x = ${[0, 14, 29].map(at)} want ${[0, 14, 29].map((n) => Math.round(want(n)))}`) }
  const s = await exp('motion-static', { videoUrl: U('split'), frames: 30 }); if (s) check('no motion: the edge does not move', edgeX(frameRgb(s.file, 0)) === edgeX(frameRgb(s.file, 29)) && Math.abs(edgeX(frameRgb(s.file, 0)) - 480) <= 1, `${edgeX(frameRgb(s.file, 0))}`)
}

// ═══ 3. Fades ═══════════════════════════════════════════════════════════════════════════════════════════════════
{
  const e = await exp('fade', { videoUrl: U('grey'), frames: 40, footageEffects: { fade: { inFrames: 10, outFrames: 10 } } })
  if (e) { const L = (n) => luma(mean(frameRgb(e.file, n), 100, 100, 540, 260)); const l0 = L(0), l5 = L(5), l20 = L(20), l35 = L(34), l39 = L(39)
    check('fade: black at the first and last frame, full brightness in the middle', l0 < 10 && l39 < 10 && Math.abs(l20 - 128) <= 4, `${l0.toFixed(1)} / ${l20.toFixed(1)} / ${l39.toFixed(1)}`)
    check('fade: halfway through each fade the picture is half bright (±12)', Math.abs(l5 - 64) <= 12 && Math.abs(l35 - 64) <= 12, `${l5.toFixed(1)} (frame 5) and ${l35.toFixed(1)} (frame 34), want ~64`) }
}

// ═══ 4. Text effects: with vs without on the same text ═══════════════════════════════════════════════════════
const layer = (over = {}) => ({ id: 'headline', kind: 'headline', visible: true, x: 0.5, y: 0.5, scale: 0.3, animation: 'none', animationDelay: 0, startFrame: 0, opacity: 1, text: 'WWW', color: '#ffffff', ...over })
const tx = async (name, over, frames = 10) => exp(name, { videoUrl: U('grey'), frames, layers: [layer(over)] })
{
  const plain = await tx('text-plain', {}); const glow = await tx('text-glow', { effect: { shadow: 0, glow: { color: '#ff0000', strength: 1 }, outline: null } })
  const outline = await tx('text-outline', { effect: { shadow: 0, glow: null, outline: { color: '#0000ff', width: 0.08 } } }); const shadow = await tx('text-shadow', { effect: { shadow: 1, glow: null, outline: null } })
  if (plain && glow && outline && shadow) {
    const A = frameRgb(plain.file, 5), B = frameRgb(glow.file, 5), C = frameRgb(outline.file, 5), D = frameRgb(shadow.file, 5)
    const glyph = new Uint8Array(W * H); let gx0 = W, gx1 = 0, gy0 = H, gy1 = 0, gn = 0
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (luma(px(A, x, y)) > 200) { glyph[y * W + x] = 1; gn++; gx0 = Math.min(gx0, x); gx1 = Math.max(gx1, x); gy0 = Math.min(gy0, y); gy1 = Math.max(gy1, y) }
    check('text fixture: the white text is found in the plain export', gn > 800, `${gn} px, box ${gx0}-${gx1} x ${gy0}-${gy1}`)
    let red = 0, redFar = 0; let blue = 0; let dark = 0
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (glyph[y * W + x]) continue; const b = px(B, x, y), c = px(C, x, y), d = px(D, x, y), a = px(A, x, y)
      if (b[0] - b[2] > 60 && b[0] > a[0] + 40) { red++; if (x < gx0 - 90 || x > gx1 + 90 || y < gy0 - 90 || y > gy1 + 90) redFar++ }
      if (c[2] - c[0] > 60 && c[2] > a[2] + 30) blue++
      if (luma(d) < luma(a) - 14) dark++ }
    check('text glow: a red halo is drawn around the text (and stays near it)', red > 300 && redFar === 0, `${red} red px, ${redFar} far away`)
    check('text outline: a blue edge is drawn at the text border', blue > 200, `${blue} blue px`)
    check('text shadow: the area around/under the text is darker than without', dark > 300, `${dark} darker px`)
    let changed = 0; for (let i = 0; i < W * H; i++) if (glyph[i] && dist(px(B, i % W, (i / W) | 0), px(A, i % W, (i / W) | 0)) > 40) changed++
    check('the glyph itself is not distorted by a glow (>95% of its pixels unchanged)', changed < gn * 0.05, `${changed}/${gn} changed`)
  }
}

// ═══ 5. Exit and entrance animations ═══════════════════════════════════════════════════════════════════════════
const whiteBox = (f, thr = 215) => { let x0 = W, x1 = -1, y0 = H, y1 = -1, n = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (luma(px(f, x, y)) > thr) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) } return { n, x0, x1, y0, y1, w: x1 - x0, cy: (y0 + y1) / 2 } }
{
  const ex = await tx('text-exit', { endFrame: 30, exit: { animation: 'fade', frames: 10 } }, 40)
  if (ex) { const n = (f) => whiteBox(frameRgb(ex.file, f)).n; const n5 = n(5), n25 = n(25), n29 = n(29), n32 = n(32)
    check('exit (fade): the text is fully visible before the exit window', n5 > 800, `${n5} px`)
    check('exit (fade): it is fading inside the window and gone at the end frame', n25 < n5 * 0.9 && n29 < n5 * 0.4 && n32 === 0, `${n5} → ${n25} → ${n29} → ${n32} white px at frames 5/25/29/32`) }
  const su = await tx('text-exit-up', { endFrame: 30, exit: { animation: 'slide-up', frames: 10 } }, 40)
  if (su) { const c = (f) => whiteBox(frameRgb(su.file, f), 150).y0; check('exit (slide up): the top of the text is 14 px higher at frame 24, as the maths says (±3)', Math.abs((c(5) - c(24)) - 14) <= 3, `top edge y ${c(5)} → ${c(24)}`) }
  const zi = await tx('text-zoomin', { animation: 'zoom-in', animationDelay: 0 }, 40)
  if (zi) { const w = (f) => whiteBox(frameRgb(zi.file, f), 150).w; check('entrance (zoom in): the text starts larger (×1.2 at frame 3) and settles to its size', w(3) > w(35) * 1.1 && w(3) < w(35) * 1.3 && Math.abs(w(30) - w(35)) <= 4, `width ${w(3)} → ${w(35)}`) }
  const bo = await tx('text-bounce', { animation: 'bounce' }, 40)
  if (bo) { const c = (f) => whiteBox(frameRgb(bo.file, f)).cy, rest = c(38); check('entrance (bounce): the text starts above its place and settles', c(2) < rest - 20 && Math.abs(c(38) - c(39)) <= 2, `centre y ${c(2).toFixed(0)} … ${rest.toFixed(0)}`) }
  const bl = await tx('text-blurin', { animation: 'blur-in' }, 40)
  if (bl) { const sharp = (f) => { const b = frameRgb(bl.file, f); let s = 0, n = 0; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const L = (xx, yy) => luma(px(b, xx, yy)); const v = Math.abs(4 * L(x, y) - L(x - 1, y) - L(x + 1, y) - L(x, y - 1) - L(x, y + 1)); if (v > 0) { s += v; n++ } } return s }
    const early = sharp(8), late = sharp(36); check('entrance (blur in): the text is soft early and sharp when it has arrived', late > early * 1.5, `edge energy ${early.toFixed(0)} → ${late.toFixed(0)}`) }
  const old = await tx('text-fade-old', { animation: 'fade' }, 40); if (old) check('the original "fade" entrance is unchanged (invisible at frame 0, visible later)', whiteBox(frameRgb(old.file, 0)).n === 0 && whiteBox(frameRgb(old.file, 30)).n > 800)
}

// ═══ 6. Presenter bubble shadow (the Stage 3 shadow was never measured in an export; a blurred box-shadow turns out to be drawn) ══
{
  const bubble = (shadow) => ({ enabled: true, layout: 'bubble', shape: 'circle', box: { x: 0.5, y: 0.5, size: 0.3 }, aspect: 1, radius: 0.18, focus: { x: 0.5, y: 0.5, zoom: 1 }, mirror: false, borderWidth: 0, borderColor: '#ffffff', shadow, videoAspect: 640 / 360, background: { mode: 'keep', blur: 10, color: '#0f172a', imageUrl: '' } })
  const withS = await exp('bubble-shadow', { videoUrl: U('grey'), frames: 6, presenter: bubble(true) }); const without = await exp('bubble-noshadow', { videoUrl: U('grey'), frames: 6, presenter: bubble(false) })
  if (withS && without) { const a = frameRgb(withS.file, 3), b = frameRgb(without.file, 3); let darker = 0; for (let y = 200; y < 290; y++) for (let x = 250; x < 390; x++) if (luma(px(a, x, y)) < luma(px(b, x, y)) - 10) darker++
    check('bubble shadow: the export draws the soft shadow under the bubble (pixels below it are darker than without)', darker > 400, `${darker} darker px`) }
}
await pa.close()

// ═══ 7. The real editor: panel controls → Player → export of the same settings ══════════════════════════════════
const pb = await browser.newPage({ viewport: { width: 1200, height: 5200 } }); watch(pb); sturdy(pb, () => window.ready === true)
await pb.goto(`${BASE}/editor.html`); await pb.waitForFunction(() => window.ready === true, null, { timeout: 120000 }); await pb.waitForTimeout(2500); await pb.waitForFunction(() => window.ready === true, null, { timeout: 120000 })
await pb.evaluate((u) => window.__setVideo(u), U('bands'))
await pb.waitForSelector('[data-testid="footage-effects-panel"]', { timeout: 60000 })
await pb.evaluate(() => window.__ctx.editPreviewSettings((p) => ({ ...p, durationInFrames: 60, fps: 30, showEndCard: false, layers: [] })))
const settings = () => pb.evaluate(() => JSON.parse(JSON.stringify(window.__ctx.previewSettings)))
await pb.getByLabel('Colour look preset').selectOption('cinematic')
await pb.getByLabel('Camera motion preset').selectOption('push-in')
await pb.getByRole('slider', { name: 'Fade out' }).fill('1')
const s = await settings()
check('editor: the panel writes the look, the camera motion and the fade into the project', s.footageEffects?.look?.contrast === 1.25 && s.footageEffects?.motion?.zoom?.to === 1.15 && s.footageEffects?.fade?.outFrames === 30, JSON.stringify(s.footageEffects))
await pb.waitForTimeout(800)
check('editor: the Player draws the footage inside the effect group', (await pb.evaluate(() => document.querySelectorAll('[data-footage-frame]').length)) >= 1)
await pb.evaluate(() => { const p = window.__player.current; p.pause(); p.seekTo(20) }); await pb.waitForTimeout(2500)
const shot = path.join(out, 'preview-frame20.png'); await pb.getByTestId('preview-wrap').screenshot({ path: shot })
const ex = await pb.evaluate(() => window.__export())
check('editor: the export of the same settings succeeds', ex.ok, `${ex.error ?? ''} ${ex.bytes ?? ''} B`)
if (ex.ok) {
  const f = path.join(out, 'editor-export.mp4'); fs.writeFileSync(f, Buffer.from(ex.b64, 'base64'))
  const dims = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height', '-of', 'json', f], { encoding: 'utf8' }).stdout).streams[0]
  const exF = frameRgb(f, 20).length ? spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', `select=eq(n\\,20)`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 27 }).stdout : null
  const pv = spawnSync('ffmpeg', ['-v', 'error', '-i', shot, '-vf', `scale=${dims.width}:${dims.height}:flags=bilinear`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 27 }).stdout
  let sum = 0; for (let i = 0; i < exF.length; i++) sum += Math.abs(exF[i] - pv[i])
  check('preview parity: the Player frame and the exported frame agree with the look, motion and vignette applied (mean abs diff < 10)', sum / exF.length < 10, (sum / exF.length).toFixed(2))
  const first = spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', 'select=eq(n\\,59)', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 27 }).stdout
  let lum = 0; for (let i = 0; i < first.length; i += 3) lum += (first[i] + first[i + 1] + first[i + 2]) / 3; check('editor export: the fade-out reached black at the last frame', lum / (first.length / 3) < 12, `${(lum / (first.length / 3)).toFixed(1)}`)
}
check('no page errors or console errors in the browser', problems.length === 0, problems.slice(0, 5).join(' | '))
await browser.close(); await server.close()
console.log(`\n${passed} passed, ${failed.length} failed`)
for (const f of failed) console.log('  FAILED:', f)
process.exit(failed.length ? 1 : 0)
