import { chromium } from 'playwright'
import fs from 'node:fs'
import { startPresenterServer } from './presenter-server.mjs'
const out = new URL('./out/', import.meta.url).pathname
fs.mkdirSync(out, { recursive: true })
const server = await startPresenterServer(5203)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const page = await browser.newPage()
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log('[browser]', m.type(), m.text().slice(0, 300)) })
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 400)))
await page.goto('http://localhost:5203/presenter.html')
await page.waitForFunction('window.ready === true', null, { timeout: 120000 })
const video = '/media/recast-example/source-performance.mp4'
const abs = 'http://localhost:5203' + video
const r = await page.evaluate(([u]) => window.bake(u, { engine: 'mediapipe' }, true), [abs])
console.log('bake', JSON.stringify(r))
if (r.ok) fs.writeFileSync(out + 'matte-mediapipe.webm', Buffer.from(await page.evaluate(() => window.matteBytes()), 'base64'))
await browser.close(); await server.close()
