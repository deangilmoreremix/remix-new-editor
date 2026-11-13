import { chromium } from 'playwright'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { startPresenterServer } from './presenter-server.mjs'
const out = new URL('./out/', import.meta.url).pathname
fs.mkdirSync(out, { recursive: true })
const server = await startPresenterServer(5203)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 400)))
page.on('console', (m) => { if (m.type() === 'error' && !/GL Driver|INFO:/.test(m.text())) console.log('[browser]', m.text().slice(0, 300)) })
page.on('response', (r) => { if (r.status() >= 400) console.log('[http]', r.status(), r.url()) })
await page.goto('http://localhost:5203/presenter.html')
await page.waitForFunction('window.ready === true', null, { timeout: 120000 })
const abs = 'http://localhost:5203/media/recast-example/source-performance.mp4'
const r = await page.evaluate(([u]) => window.bake(u, { engine: 'mediapipe' }), [abs])
console.log('bake', r.ok, r.reused, r.key)
const base = { enabled: true, layout: 'full', shape: 'rect', box: { x: .5, y: .5, size: 1 }, aspect: 16 / 9, focus: { x: .5, y: .5, zoom: 1 }, borderWidth: 0, shadow: false, background: { mode: 'remove', blur: 14, color: '#2255cc', imageUrl: '' } }
const matte = { key: r.key, engine: 'mediapipe', sourceUrl: abs, createdAt: 'x' }
const cases = {
  remove: { ...base, matte },
  color: { ...base, background: { ...base.background, mode: 'color' }, matte },
  blur: { ...base, background: { ...base.background, mode: 'blur' }, matte },
  bubble: { ...base, layout: 'bubble', shape: 'circle', aspect: 1, box: { x: .8, y: .7, size: .35 }, background: { ...base.background, mode: 'keep' }, borderWidth: .02, shadow: true },
}
for (const [name, presenter] of Object.entries(cases)) {
  const res = await page.evaluate(([u, p]) => window.runExport({ videoUrl: u, presenter: p, w: 640, h: 360, frames: 45 }), [abs, presenter])
  if (!res.ok) { console.log(name, 'FAILED', res.error, res.reason); continue }
  fs.writeFileSync(`${out}${name}.mp4`, Buffer.from(res.b64, 'base64'))
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', `${out}${name}.mp4`, '-ss', '0.7', '-frames:v', '1', `${out}${name}.png`])
  console.log(name, 'ok', res.bytes, res.ms + 'ms', res.warning || '')
}
await browser.close(); await server.close()
