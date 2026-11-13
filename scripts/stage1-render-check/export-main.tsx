// Browser side of the Stage 1 REAL VIDEO EXPORT check: calls the app's own exportPersonalizedVideo (the same function the
// Personalization modal's "Create final video" uses), which drives Remotion's web renderer + WebCodecs.
import { exportPersonalizedVideo } from '@ohb/shared/personalization/webExport'
import { createDefaultPreviewSettings } from '@ohb/shared/personalization/preview/presets'

function poster(): string {
  const c = document.createElement('canvas'); c.width = 1280; c.height = 720
  const g = c.getContext('2d')!
  const q = [['#c0392b', '#27ae60'], ['#2980b9', '#f1c40f']]
  for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) { g.fillStyle = q[r][k]; g.fillRect(k * 640, r * 360, 640, 360) }
  return c.toDataURL('image/png')
}

;(window as any).runExport = async (opts: { rotation?: number; zoom?: boolean; fields?: boolean }) => {
  const base = createDefaultPreviewSettings()
  const settings: any = {
    ...base, width: 640, height: 360, fps: 30, durationInFrames: 60, showEndCard: false,
    brandColors: { ...base.brandColors, backgroundDim: 0 },
    layers: [{
      id: 'headline', kind: 'headline', visible: true, x: 0.5, y: 0.5, scale: 0.12, animation: 'none', animationDelay: 0, startFrame: 0,
      opacity: 1, text: 'Hello {{city}}', color: '#ffffff', ...(opts.rotation ? { rotation: opts.rotation } : {}),
    }],
    ...(opts.fields === false ? {} : { customFields: { city: 'Austin' } }),
    ...(opts.zoom ? { sourceTransform: { x: 0.25, y: 0.25, zoom: 2 } } : {}),
  }
  const inputProps: any = {
    videoUrl: null, posterUrl: poster(), isImageSource: true, audioUrl: null, settings,
    brand: { businessName: 'Acme', headline: 'H', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null },
  }
  const progress: number[] = []
  const t0 = performance.now()
  const result: any = await exportPersonalizedVideo({ inputProps, onProgress: (p: number) => progress.push(Math.round(p * 100)) })
  const ms = Math.round(performance.now() - t0)
  if (!result.ok) return { ok: false, error: result.error, reason: result.reason, ms }
  const buf = new Uint8Array(await result.blob.arrayBuffer())
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return { ok: true, mime: result.mimeType, ext: result.extension, warning: result.warning, bytes: buf.length, ms, progressSeen: progress.length, lastProgress: progress[progress.length - 1], b64: btoa(s) }
}
;(window as any).codecs = async () => {
  const out: Record<string, boolean> = {}
  for (const c of ['avc1.42E01E', 'vp8', 'vp09.00.10.08', 'av01.0.04M.08']) {
    try { out[c] = !!(await (window as any).VideoEncoder?.isConfigSupported({ codec: c, width: 640, height: 360, bitrate: 1_000_000, framerate: 30 }))?.supported } catch { out[c] = false }
  }
  return out
}
;(window as any).ready = true
