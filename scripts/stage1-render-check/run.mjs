// Usage: node scripts/stage1-render-check/run.mjs [outDir]
// Needs: `npm install` done, and a Chromium. Set CHROMIUM_PATH (default /opt/pw-browsers/chromium, else Playwright's own).
// Starts a throwaway Vite dev server (configFile:false, so the app's vite.config.js is not used), renders each case with the
// real Remotion web renderer in headless Chromium, then asserts on the PIXELS. Exits non-zero on any failed assertion.
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from 'playwright'
import { inflateSync } from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../..')
const outDir = path.resolve(process.argv[2] || path.join(here, 'out'))
fs.mkdirSync(outDir, { recursive: true })

const server = await createServer({
  configFile: false, root: here, logLevel: 'error', plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom', 'remotion'], alias: { '@ohb': path.join(repo, 'src/features/personalization'), '@': repo } },
  server: { port: 5199, fs: { strict: false } },
  optimizeDeps: { force: true, include: ['react', 'react-dom', 'react-dom/client'], exclude: ['remotion', '@remotion/web-renderer', '@remotion/media'] },
})
await server.listen()

const chromiumPath = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
const browser = await chromium.launch({ executablePath: chromiumPath, args: ['--no-sandbox'] })
const page = await browser.newPage()
const logs = []
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await page.goto('http://localhost:5199/')
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 })

const cases = {
  base: {},
  rotated: { layer: { rotation: 30 } },
  fields: { settings: { customFields: { city: 'Austin' } } },
  zoomed: { settings: { sourceTransform: { x: 0.25, y: 0.25, zoom: 2 } }, layer: { visible: false } },
  plain: { layer: { visible: false } },
}
const png = {}
for (const [name, patch] of Object.entries(cases)) {
  const b64 = await page.evaluate((p) => window.renderCase(p), patch)
  png[name] = Buffer.from(b64, 'base64')
  fs.writeFileSync(path.join(outDir, `${name}.png`), png[name])
}
console.log('SequenceManager at runtime:', JSON.stringify(await page.evaluate(() => window.internalsInfo())))
await browser.close()
await server.close()

// ── tiny PNG decoder (8-bit RGB/RGBA, non-interlaced) so the pixel assertions need no extra dependency ──
function decode(buf) {
  let pos = 8; let w = 0; let h = 0; let ct = 0; const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9] }
    if (type === 'IDAT') idat.push(data)
    pos += 12 + len
  }
  const bpp = ct === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(idat)); const stride = w * bpp
  const px = Buffer.alloc(h * stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0; const b = y > 0 ? px[(y - 1) * stride + x] : 0; const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0
      const pr = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : (() => { const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c })()
      px[y * stride + x] = (row[x] + pr) & 255
    }
  }
  return { w, h, at: (x, y) => [px[y * stride + x * bpp], px[y * stride + x * bpp + 1], px[y * stride + x * bpp + 2]] }
}
const img = Object.fromEntries(Object.entries(png).map(([k, v]) => [k, decode(v)]))
const near = (c, [r, g, b], t = 6) => Math.abs(c[0] - r) <= t && Math.abs(c[1] - g) <= t && Math.abs(c[2] - b) <= t
const RED = [192, 57, 43]; const GREEN = [39, 174, 96]; const BLUE = [41, 128, 185]
const checks = []
const check = (name, ok) => { checks.push([name, ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`) }
// brightest-white pixel bounding box = the drawn text
function whiteBox(i) {
  let x0 = 1e9; let y0 = 1e9; let x1 = -1; let y1 = -1
  for (let y = 0; y < i.h; y += 2) for (let x = 0; x < i.w; x += 2) { const c = i.at(x, y); if (c[0] > 245 && c[1] > 245 && c[2] > 245) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) } }
  return x1 < 0 ? null : { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 }
}
const b0 = whiteBox(img.base); const b1 = whiteBox(img.rotated)
check('base: text drawn and centred on the frame', !!b0 && Math.abs(b0.cx - 960) < 40)
check('rotated: text is taller than the unrotated text (it is on a slant)', !!b1 && !!b0 && b1.h > b0.h * 2)
check('rotated: text pivots about its OWN centre (centre stays within 25px of the unrotated centre)', !!b1 && !!b0 && Math.abs(b1.cx - b0.cx) < 25 && Math.abs(b1.cy - b0.cy) < 25)
check('fields: {{city}} rendered as "Austin" (output differs from the unreplaced render)', Buffer.compare(png.fields, png.base) !== 0)
check('plain: unzoomed quadrant boundary at x=960', near(img.plain.at(950, 200), RED) && near(img.plain.at(970, 200), GREEN))
check('zoomed: x boundary moved to 960 -> 1440', near(img.zoomed.at(1430, 400), RED) && near(img.zoomed.at(1450, 400), GREEN))
check('zoomed: y boundary moved to 540 -> 810', near(img.zoomed.at(700, 800), RED) && near(img.zoomed.at(700, 820), BLUE))
check('no page errors', logs.length === 0)
if (logs.length) console.log(logs.join('\n'))
console.log(`PNGs written to ${outDir}`)
process.exit(checks.every(([, ok]) => ok) ? 0 : 1)
