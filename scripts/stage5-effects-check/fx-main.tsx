// Browser side of the Stage 5 checks: the app's own exporter, with footage effects / text effects / presenter in the settings, plus the pure
// colour predictor so the Node side can compare exported pixels with the numbers the model predicts.
import { exportPersonalizedVideo } from '@ohb/shared/personalization/webExport'
import { createDefaultPreviewSettings, normalizePreviewSettings } from '@ohb/shared/personalization/preview/presets'
import { predictLookRgb, LOOK_PRESETS } from '@ohb/shared/personalization/preview/videoEffects'

const b64 = async (blob: Blob) => { const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s) }
const W = window as any
W.predict = (rgb: [number, number, number], look: any, edge: number) => predictLookRgb(rgb, look, edge)
W.lookPresets = () => LOOK_PRESETS
W.runExport = async (cfg: { videoUrl: string; footageEffects?: any; layers?: any[]; presenter?: any; w?: number; h?: number; frames?: number; showEndCard?: boolean }) => {
  const base = createDefaultPreviewSettings()
  const raw: any = { ...base, width: cfg.w ?? 640, height: cfg.h ?? 360, fps: 30, durationInFrames: cfg.frames ?? 30, showEndCard: false, brandColors: { ...base.brandColors, backgroundDim: 0 }, layers: cfg.layers ?? [],
    ...(cfg.footageEffects ? { footageEffects: cfg.footageEffects } : {}), ...(cfg.presenter ? { presenter: cfg.presenter } : {}) }
  const settings = normalizePreviewSettings(raw) // the same validation a saved project goes through
  const inputProps: any = { videoUrl: cfg.videoUrl, posterUrl: null, isImageSource: false, audioUrl: null, settings,
    brand: { businessName: 'Acme', headline: 'H', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null } }
  const t0 = performance.now()
  const result: any = await exportPersonalizedVideo({ inputProps, onProgress: () => {} })
  const ms = Math.round(performance.now() - t0)
  if (!result.ok) return { ok: false, error: result.error, reason: result.reason, ms }
  return { ok: true, bytes: result.blob.size, ms, b64: await b64(result.blob), normalized: { fx: settings.footageEffects ?? null, layers: settings.layers } }
}
W.ready = true
