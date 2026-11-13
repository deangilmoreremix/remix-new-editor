// Browser side of the Stage 3 checks. Uses the app's REAL bake pipeline (MediaPipe / MODNet + mediabunny), the REAL
// IndexedDB store, and the app's own exportPersonalizedVideo (Remotion web renderer + WebCodecs).
import { exportPersonalizedVideo } from '@ohb/shared/personalization/webExport'
import { createDefaultPreviewSettings } from '@ohb/shared/personalization/preview/presets'
import { bakePresenterMatte, findExistingMatte } from '@ohb/shared/personalization/guided/presenterBake'
import { ensureMatteUrl, createIdbBlobStore } from '@ohb/shared/personalization/guided/presenterMatteStore'
import { clearMatteRegistry } from '@ohb/shared/personalization/preview/presenterMatteRegistry'

const store = createIdbBlobStore('stage3-check')
const b64 = async (blob: Blob) => {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}
const W = window as any

W.bake = async (sourceUrl: string, opts: any, force = false) => {
  const t0 = performance.now()
  const progress: string[] = []
  try {
    const r = await bakePresenterMatte(sourceUrl, opts, { force, onProgress: (p) => { if (p.stage !== 'process' || (p.frame ?? 0) % 30 === 0) progress.push(`${p.stage}:${Math.round(p.progress * 100)}`) } }, store)
    const blob = await (await fetch(r.url)).blob()
    W.__matte = { r, blob }
    return { ok: true, key: r.matte.key, reused: r.reused, meanCoverage: r.meanCoverage, frames: r.frames, ms: Math.round(performance.now() - t0), bytes: blob.size, type: blob.type, progress: progress.slice(0, 6) }
  } catch (e: any) { return { ok: false, error: String(e?.message || e), code: e?.code, ms: Math.round(performance.now() - t0) } }
}
W.matteBytes = async () => b64(W.__matte.blob)
W.findExisting = async (sourceUrl: string, opts: any) => !!(await findExistingMatte(sourceUrl, opts, store))
W.dropRegistry = () => clearMatteRegistry()
W.restore = async () => !!(await ensureMatteUrl(W.__matte.r.matte, store))

W.runExport = async (cfg: { brandColors?: any; videoUrl: string; presenter?: any; websiteBackground?: any; w?: number; h?: number; frames?: number; layers?: any[] }) => {
  const base = createDefaultPreviewSettings()
  const settings: any = {
    ...base, width: cfg.w ?? 640, height: cfg.h ?? 360, fps: 30, durationInFrames: cfg.frames ?? 60, showEndCard: false,
    brandColors: { ...base.brandColors, backgroundDim: 0, ...(cfg.brandColors ?? {}) }, layers: cfg.layers ?? [],
    ...(cfg.presenter ? { presenter: cfg.presenter } : {}),
    ...(cfg.websiteBackground ? { websiteBackground: cfg.websiteBackground } : {}),
  }
  const inputProps: any = {
    videoUrl: cfg.videoUrl, posterUrl: null, isImageSource: false, audioUrl: null, settings,
    brand: { businessName: 'Acme', headline: 'H', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null },
  }
  const t0 = performance.now()
  const result: any = await exportPersonalizedVideo({ inputProps, onProgress: () => {} })
  const ms = Math.round(performance.now() - t0)
  if (!result.ok) return { ok: false, error: result.error, reason: result.reason, ms }
  return { ok: true, mime: result.mimeType, ext: result.extension, warning: result.warning, bytes: result.blob.size, ms, b64: await b64(result.blob) }
}
W.ready = true
