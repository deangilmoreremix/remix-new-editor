// Real video export check. Usage: node scripts/stage1-render-check/export-check.mjs [outDir]
// Runs the app's own exportPersonalizedVideo in headless Chromium for (a) rotation + custom field + footage zoom and (b) a no-rotation
// control, saves the produced files, and verifies them with ffprobe (container/codec/size/duration/frames) and with frames
// decoded by ffmpeg (pixel assertions). Exits non-zero on any failed check. Needs ffmpeg/ffprobe on PATH and a Chromium.
import { chromium } from 'playwright'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decode } from './png.mjs'
import { startEditorServer } from './editor-server.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(process.argv[2] || path.join(here, 'out'))
fs.mkdirSync(outDir, { recursive: true })
const PORT = 5196
const server = await startEditorServer(PORT)
const chromiumPath = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
const browser = await chromium.launch({ executablePath: chromiumPath, args: ['--no-sandbox'] })
const page = await browser.newPage()
const problems = []
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message.slice(0, 300)}`))
await page.goto(`http://localhost:${PORT}/export.html`)
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 })

const results = []
const check = (name, ok, detail = '') => { results.push([name, !!ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }
console.log('encoder support in this Chromium:', JSON.stringify(await page.evaluate(() => window.codecs())))

const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' })
async function exportAndAnalyse(label, opts) {
  const r = await page.evaluate((o) => window.runExport(o), opts)
  if (!r.ok) { check(`${label}: export succeeded`, false, `${r.reason}: ${r.error}`); return null }
  const file = path.join(outDir, `export-${label}.${r.ext}`)
  fs.writeFileSync(file, Buffer.from(r.b64, 'base64'))
  check(`${label}: the app's exporter produced a file`, r.bytes > 2000, `${r.mime}, ${r.bytes} bytes in ${r.ms} ms, progress reports=${r.progressSeen}, warning=${r.warning ?? 'none'}`)
  const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file]).stdout || '{}')
  const v = (probe.streams || []).find((s) => s.codec_type === 'video')
  check(`${label}: ffprobe sees a valid video stream`, !!v, v ? `${v.codec_name} ${v.width}x${v.height} @ ${v.r_frame_rate}, ${v.nb_read_frames} frames, ${Number(probe.format?.duration).toFixed(2)}s, container ${probe.format?.format_name}` : 'no video stream')
  if (v) {
    check(`${label}: size is the composition's 640x360`, v.width === 640 && v.height === 360)
    check(`${label}: duration is ~2 s (60 frames at 30 fps)`, Math.abs(Number(probe.format.duration) - 2) < 0.2, `${Number(probe.format.duration).toFixed(3)}s`)
    check(`${label}: frame count is ~60`, Math.abs(Number(v.nb_read_frames) - 60) <= 2, `${v.nb_read_frames}`)
  }
  const frames = {}
  for (const t of [0.5, 1.5]) {
    const f = path.join(outDir, `export-${label}-t${t}.png`)
    run('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', file, '-frames:v', '1', f])
    frames[t] = fs.existsSync(f) ? decode(fs.readFileSync(f)) : null
  }
  return { r, file, frames }
}
const near = (c, [r, g, b], t = 40) => Math.abs(c[0] - r) <= t && Math.abs(c[1] - g) <= t && Math.abs(c[2] - b) <= t
const RED = [192, 57, 43]; const GREEN = [39, 174, 96]; const BLUE = [41, 128, 185]
function whiteBox(i) {
  let x0 = 1e9; let y0 = 1e9; let x1 = -1; let y1 = -1
  for (let y = 0; y < i.h; y++) for (let x = 0; x < i.w; x++) { const c = i.at(x, y); if (c[0] > 235 && c[1] > 235 && c[2] > 235) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) } }
  return x1 < 0 ? null : { w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }
}

const A = await exportAndAnalyse('rotated-zoomed', { rotation: 30, zoom: true })
const B = await exportAndAnalyse('control', { rotation: 0, zoom: false })
const C = await exportAndAnalyse('no-custom-field', { rotation: 0, zoom: false, fields: false })
if (A && B) {
  for (const t of [0.5, 1.5]) {
    const fa = A.frames[t]; const fb = B.frames[t]
    check(`frames decode at t=${t}s`, !!fa && !!fb)
    if (!fa || !fb) continue
    const ba = whiteBox(fa); const bb = whiteBox(fb)
    check(`t=${t}s control: the headline is drawn as wide, level text`, !!bb && bb.w > bb.h * 3, bb ? `${bb.w}x${bb.h}` : 'no text')
    check(`t=${t}s rotated: the headline is slanted (taller relative to width than the control)`, !!ba && !!bb && ba.h / ba.w > (bb.h / bb.w) * 2.5, ba ? `${ba.w}x${ba.h} vs control ${bb?.w}x${bb?.h}` : 'no text')
    check(`t=${t}s rotated: text pivots about its own centre (stays within 20px of the control's centre)`, !!ba && !!bb && Math.hypot(ba.cx - bb.cx, ba.cy - bb.cy) < 20, ba && bb ? `Δ=${Math.hypot(ba.cx - bb.cx, ba.cy - bb.cy).toFixed(1)}px` : '')
    check(`t=${t}s control: unzoomed quadrant boundary at x=320`, near(fb.at(300, 40), RED) && near(fb.at(340, 40), GREEN))
    check(`t=${t}s zoomed: boundary moved x 320 -> 480 (2x about 25%,25%)`, near(fa.at(460, 40), RED) && near(fa.at(500, 40), GREEN), `left=${fa.at(460, 40)} right=${fa.at(500, 40)}`)
    check(`t=${t}s zoomed: boundary moved y 180 -> 270`, near(fa.at(40, 255), RED) && near(fa.at(40, 290), BLUE), `above=${fa.at(40, 255)} below=${fa.at(40, 290)}`)
  }
}
if (B && C) {
  const wb = whiteBox(B.frames[0.5]); const wc = whiteBox(C.frames[0.5])
  check('custom field: {{city}} is replaced in the exported video ("Hello Austin" is narrower than "Hello {{city}}")', !!wb && !!wc && wc.w > wb.w * 1.05, wb && wc ? `with field ${wb.w}px, without ${wc.w}px` : '')
}
check('no page errors', problems.length === 0, problems.slice(0, 2).join(' | '))
await browser.close(); await server.close()
const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Files: ${outDir}`)
process.exit(failed.length ? 1 : 0)
