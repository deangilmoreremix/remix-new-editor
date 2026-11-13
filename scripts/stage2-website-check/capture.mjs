// Runs the REAL capture engine (netlify/functions/_personalization/src/server/browserDiscovery.ts) against a real website, then
// the REAL storage + response builders (motionCapture.ts), with only the Supabase bucket replaced by a local folder. The output
// (out/capture.json + out/capture/**) is exactly what POST /api/motion-studio/capture returns, with image URLs pointing at the
// local dev server. Usage:  npx tsx scripts/stage2-website-check/capture.mjs [url] [baseUrl]
// Only capture sites you own or have permission to use (the default is the project's own production site).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const url = process.argv[2] || 'https://smartvid.app/'
const base = (process.argv[3] || 'http://localhost:5195').replace(/\/+$/, '')
const out = path.join(here, 'out')
if (process.env.USE_SANDBOX_EGRESS === '1') {
  process.env.CAPTURE_TARGET_HOSTS = process.env.CAPTURE_TARGET_HOSTS || new URL(url).hostname
  await import('./sandbox-egress.mjs')
}
const engine = path.resolve(here, '../../netlify/functions/_personalization/src/server')
const { capturePageScreenshots } = await import(path.join(engine, 'browserDiscovery.ts'))
const { captureImages, storeCaptureImages, buildCaptureResponse } = await import(path.join(engine, 'motionCapture.ts'))

fs.rmSync(path.join(out, 'capture'), { recursive: true, force: true })
const storage = {
  async upload(p, body) {
    const file = path.join(out, 'capture', p)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, body)
    return { error: null }
  },
  getPublicUrl: (p) => ({ data: { publicUrl: `${base}/out/capture/${p}` } }),
  download: async () => ({ data: null, error: { message: 'not used' } }),
}
const t0 = Date.now()
const capture = await capturePageScreenshots(url, { maxRoutes: 1, maxCrops: 4, navigationMs: 60000, hardMs: 170000, budgetMs: 170000, firstShotMs: 100000 })
const urls = await storeCaptureImages(storage, 'harness-user', captureImages(capture))
const response = buildCaptureResponse(capture, urls)
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'capture.json'), JSON.stringify(response, null, 2))
console.log(JSON.stringify({ url: response.url, title: response.title, ms: Date.now() - t0, pages: response.pages.map((p) => `${p.name} ${p.width}x${p.height} sections=${p.layout?.sections?.length ?? 0}`), crops: response.crops.length, images: response.images.length, logo: !!response.logo, assets: response.assets.length }))
process.exit(0)
