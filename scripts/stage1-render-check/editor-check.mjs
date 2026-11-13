// Real-browser check of the Stage 1 editor. Usage: node scripts/stage1-render-check/editor-check.mjs [outDir]
// Mounts the REAL DemoPersonalizeProvider + OverlayEditor (editor.html) in headless Chromium and drives them with REAL mouse
// input: panel rotate, the Konva rotate handle, duplicate, group, drag with snap guides, undo/redo, saved layouts, the
// image crop dialog, and the save payload -> restore round trip. Exits non-zero if any assertion fails. Needs a Chromium
// (CHROMIUM_PATH, default /opt/pw-browsers/chromium). Network calls to /api and /.netlify are stubbed; nothing leaves the machine.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startEditorServer } from './editor-server.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(process.argv[2] || path.join(here, 'out'))
fs.mkdirSync(outDir, { recursive: true })
const PORT = 5197
const server = await startEditorServer(PORT)
const chromiumPath = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
const browser = await chromium.launch({ executablePath: chromiumPath, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 2300 } })
const problems = []
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message.slice(0, 300)}`))
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`[console.error] ${m.text().slice(0, 300)}`)
  if (m.type() === 'warning' || process.env.VERBOSE) console.log(`  [browser ${m.type()}] ${m.text().slice(0, 300)}`)
})
await page.route((u) => u.origin === `http://localhost:${PORT}` && (u.pathname.startsWith('/api/') || u.pathname.startsWith('/.netlify/')), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
await page.goto(`http://localhost:${PORT}/editor.html`)
await page.waitForFunction(() => window.ready === true && window.__ctx?.previewSettings?.layers?.length > 0, null, { timeout: 120000 })

const results = []
const check = (name, ok, detail = '') => { results.push([name, !!ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }
const shot = (n) => page.screenshot({ path: path.join(outDir, `editor-${n}.png`), clip: { x: 0, y: 0, width: 1200, height: 1700 } })
const layer = (id) => page.evaluate((i) => (window.__ctx.previewSettings.layers.find((l) => l.id === i) ?? null), id)
const settings = () => page.evaluate(() => window.__ctx.previewSettings)

// ── Seed visible content through the real provider API ───────────────────────────────────────────────────────────────
await page.evaluate(() => {
  const c = window.__ctx
  const logo = window.__helpers.logoDataUrl()
  c.updatePreviewLayer('headline', { text: 'Grow with Acme', x: 0.3, y: 0.32 })
  c.updatePreviewLayer('businessName', { text: 'Acme Roofing', x: 0.7, y: 0.62 })
  c.updatePreviewLayer('logo', { imageUrl: logo, x: 0.82, y: 0.2, scale: 0.18 })
})
await page.waitForTimeout(600)
const stage = page.locator('[aria-label="Video overlay stage"]')
const box = async (name) => {
  const b = await page.getByRole('button', { name }).first().evaluate((el) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el)
    return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: el.offsetWidth, h: el.offsetHeight, transform: el.style.transform || cs.transform }
  })
  return b
}
await shot('01-seeded')

// ── 1. Select + rotate from the panel ───────────────────────────────────────────────────────────────────────────────
await page.getByRole('button', { name: 'Select Headline' }).first().click()
await page.getByLabel('Rotation degrees').fill('30')
await page.waitForTimeout(200)
check('panel rotate writes layer.rotation', (await layer('headline')).rotation === 30)
check('stage box is drawn rotated', /rotate\(30deg\)|matrix/.test((await box('Move Headline')).transform))
await shot('02-panel-rotated')

// ── 2. Konva rotate handle with real mouse ──────────────────────────────────────────────────────────────────────────
const overlay = page.getByTestId('konva-transform-overlay')
await overlay.waitFor({ timeout: 8000 }).catch(() => {})
check('Konva overlay is mounted for the selected layer', (await overlay.count()) === 1)
const hb = await box('Move Headline')
const rot = (30 * Math.PI) / 180
const handleDist = hb.h / 2 + 28 // Transformer rotater sits 28px above the box, rotated with it
const hx = hb.cx + Math.sin(rot) * handleDist
const hy = hb.cy - Math.cos(rot) * handleDist
await page.mouse.move(hx, hy)
await page.waitForTimeout(250)
const interactive = await overlay.evaluate((el) => el.style.pointerEvents)
check('overlay takes the pointer only while over a handle', interactive === 'auto', `pointer-events=${interactive}`)
await page.mouse.down()
// Drag the handle round to straight right of the centre = 90 degrees clockwise from "up".
const R = handleDist
for (let i = 1; i <= 8; i++) {
  const a = rot + ((Math.PI / 2 - rot) * i) / 8
  await page.mouse.move(hb.cx + Math.sin(a) * R, hb.cy - Math.cos(a) * R)
}
await shot('03-konva-dragging')
await page.mouse.up()
await page.waitForTimeout(300)
const afterKonva = (await layer('headline')).rotation
check('dragging the Konva rotate handle rotates the layer (~90°)', Math.abs((afterKonva ?? 0) - 90) <= 6, `rotation=${afterKonva}`)
await page.mouse.move(5, 5)
await page.waitForTimeout(150)
check('overlay releases the pointer away from handles', (await overlay.evaluate((el) => el.style.pointerEvents)) === 'none')

// ── 3. Undo / redo (real provider history) ───────────────────────────────────────────────────────────────────────────
await page.waitForTimeout(700) // history coalesces edits inside 600 ms
await page.getByLabel('Rotation degrees').fill('10')
await page.waitForTimeout(700)
await page.getByTestId('editor-undo').click()
await page.waitForTimeout(150)
check('Undo reverts the last rotation', (await layer('headline')).rotation === afterKonva, `rotation=${(await layer('headline')).rotation}`)
await page.getByTestId('editor-redo').click()
await page.waitForTimeout(150)
check('Redo re-applies it', (await layer('headline')).rotation === 10)

// ── 4. Duplicate, multi-select, group, drag the group ────────────────────────────────────────────────────────────────
await page.getByLabel('Rotation degrees').fill('0')
await page.getByLabel('Duplicate layer').click()
await page.waitForTimeout(200)
check('Duplicate adds a layer and selects the copy', (await settings()).layers.some((l) => l.id === 'headline-2'))
await page.getByRole('button', { name: 'Select Headline' }).first().click()
await page.getByRole('button', { name: 'Select Business name' }).click({ modifiers: ['Shift'] })
await page.getByLabel('Group selected layers').click()
await page.waitForTimeout(200)
let s = await settings()
check('Group links the selected layers', s.layers.filter((l) => l.groupId).length === 2)
const gBefore = { h: (await layer('headline')).x, b: (await layer('businessName')).x }
const gm = await box('Move Business name')
await page.mouse.move(gm.cx, gm.cy)
await page.mouse.down()
await page.mouse.move(gm.cx - 120, gm.cy - 10, { steps: 6 }) // Alt not held, so snapping is on
await shot('04-group-drag-snap')
const guidesDuringDrag = await page.getByTestId('snap-guide').count()
await page.mouse.up()
await page.waitForTimeout(200)
const gAfter = { h: (await layer('headline')).x, b: (await layer('businessName')).x }
const dh = gAfter.h - gBefore.h; const db = gAfter.b - gBefore.b
check('dragging one grouped layer moves both by the same amount', Math.abs(dh - db) < 0.002 && Math.abs(db) > 0.05, `dh=${dh.toFixed(4)} db=${db.toFixed(4)}`)
check('snap guides were drawn while dragging', guidesDuringDrag > 0, `${guidesDuringDrag} guide(s)`)
check('guides are cleared after release', (await page.getByTestId('snap-guide').count()) === 0)

// ── 5. Saved layout (geometry only) ─────────────────────────────────────────────────────────────────────────────────
await page.getByLabel('Layout name').fill('Corner test')
await page.getByLabel('Save layout').click()
const stored = await page.evaluate(() => localStorage.getItem('smartvideo.personalization.savedLayouts.v1') || '')
check('saved layout is stored without any text or picture', stored.includes('Corner test') && !stored.includes('Grow with Acme') && !stored.includes('data:image'))

// ── 6. Crop & zoom dialog on the logo (drag to pan, slider to zoom) ──────────────────────────────────────────────────
await page.getByRole('button', { name: 'Select Logo' }).first().click()
await page.waitForTimeout(300)
await page.getByLabel('Crop and zoom picture').scrollIntoViewIfNeeded()
await page.getByLabel('Crop and zoom picture').click()
const dialog = page.getByTestId('image-crop-dialog')
await dialog.waitFor({ timeout: 20000 })
await page.waitForTimeout(1200) // react-easy-crop lays out after the lazy chunk and the image load
await shot('05-crop-dialog-open')
await page.getByLabel('Crop zoom').fill('2')
const cropArea = page.locator('[data-testid="image-crop-dialog"] [data-testid="container"], [data-testid="image-crop-dialog"] .reactEasyCrop_Container').first()
const cb = await cropArea.boundingBox()
if (cb) {
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2)
  await page.mouse.down()
  await page.mouse.move(cb.x + cb.width / 2 - 70, cb.y + cb.height / 2 - 30, { steps: 8 })
  await page.mouse.up()
}
await shot('06-crop-dialog-dragged')
await page.getByLabel('Apply crop').click()
await page.waitForTimeout(400)
const logoStyle = (await layer('logo')).imageStyle
check('crop dialog Apply writes cover + zoom + focus to the layer', logoStyle && logoStyle.fit === 'cover' && Math.abs(logoStyle.zoom - 2) < 0.02, JSON.stringify({ fit: logoStyle?.fit, zoom: logoStyle?.zoom, cropX: logoStyle?.cropX, cropY: logoStyle?.cropY }))
check('dragging the picture moved the focus (not left at centre)', logoStyle && (Math.abs(logoStyle.cropX - 0.5) > 0.01 || Math.abs(logoStyle.cropY - 0.5) > 0.01))
await shot('07-after-crop')

// ── 7. Save payload -> JSON -> restore keeps every Stage 1 field ─────────────────────────────────────────────────────
await page.evaluate(() => window.__ctx.editPreviewSettings((p) => ({ ...p, sourceTransform: { x: 0.3, y: 0.6, zoom: 1.5 }, customFields: { city: 'Austin' } })))
const roundTrip = await page.evaluate(() => {
  const live = window.__ctx.previewSettings
  const saved = window.__helpers.stripSessionScopedUrls({ previewSettings: live }).previewSettings
  const restored = window.__helpers.normalizePreviewSettings(JSON.parse(JSON.stringify(saved)))
  const pick = (st) => ({
    layers: st.layers.map((l) => ({ id: l.id, x: l.x, y: l.y, scale: l.scale, rotation: l.rotation ?? null, groupId: l.groupId ?? null, zoom: l.imageStyle?.zoom ?? null, cropX: l.imageStyle?.cropX ?? null })),
    sourceTransform: st.sourceTransform ?? null, customFields: st.customFields ?? null,
  })
  return { live: pick(live), restored: pick(restored) }
})
check('save -> JSON -> restore reproduces layout, grouping, crop, footage transform and custom fields', JSON.stringify(roundTrip.live) === JSON.stringify(roundTrip.restored))
check('restored data really contains the Stage 1 fields', roundTrip.restored.layers.some((l) => l.groupId) && roundTrip.restored.layers.some((l) => l.zoom) && !!roundTrip.restored.sourceTransform && !!roundTrip.restored.customFields)

check('no page errors or console errors during the whole run', problems.length === 0, problems.slice(0, 3).join(' | '))
await browser.close()
await server.close()
const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${outDir}`)
process.exit(failed.length ? 1 : 0)
