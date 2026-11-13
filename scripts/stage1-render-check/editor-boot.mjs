import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url)); const repo = path.resolve(here, '../..')
import { startEditorServer } from './editor-server.mjs'
const server = await startEditorServer(5198)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
const logs = []
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`) })
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 400)}`))
await page.route((u) => u.origin === 'http://localhost:5198' && (u.pathname.startsWith('/api/') || u.pathname.startsWith('/.netlify/')), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
await page.goto('http://localhost:5198/editor.html')
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 }).catch(() => {})
await page.waitForTimeout(3000)
fs.mkdirSync(path.join(here, 'out'), { recursive: true })
await page.screenshot({ path: path.join(here, 'out/editor-boot.png') })
console.log('layers:', await page.evaluate(() => (window.__ctx?.previewSettings?.layers || []).map((l) => l.id).join(',')))
console.log('stage present:', await page.locator('[aria-label="Video overlay stage"]').count())
console.log(logs.slice(0, 20).join('\n'))
await browser.close(); await server.close()
