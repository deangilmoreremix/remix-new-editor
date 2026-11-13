// Browser side of the Stage 4 checks: the REAL mixdown baker (Web Audio decode), the REAL IndexedDB store and the app's own exporter.
import { exportPersonalizedVideo } from '@ohb/shared/personalization/webExport'
import { createDefaultPreviewSettings } from '@ohb/shared/personalization/preview/presets'
import { bakeAudioMix } from '@ohb/shared/personalization/guided/audioMixdown'
import { analyzeAudioSources } from '@ohb/shared/personalization/guided/audioAnalysis'
import { normalizeAudioMix } from '@ohb/shared/personalization/preview/audioMix'
import { resolveMatteUrl } from '@ohb/shared/personalization/preview/presenterMatteRegistry'

const b64 = async (blob: Blob) => { const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s) }
const W = window as any

W.bakeMix = async (voice: string | null, music: string | null, mix: any, dur: number, force = false) => {
  const t0 = performance.now()
  try {
    const r = await bakeAudioMix(voice, music, normalizeAudioMix(mix)!, dur, { force })
    return { ok: true, reused: r.reused, key: r.mixdown.key, report: r.mixdown.report, ms: Math.round(performance.now() - t0) }
  } catch (e: any) { return { ok: false, error: String(e?.message || e), code: e?.code } }
}
W.mixdownWav = async (key: string) => { const u = resolveMatteUrl({ key }); return u ? b64(await (await fetch(u)).blob()) : null }
W.analyse = (v: string | null, m: string | null) => analyzeAudioSources(v, m)

W.runExport = async (cfg: { videoUrl: string; musicUrl?: string | null; audioMix?: any; presenter?: any; w?: number; h?: number; frames?: number }) => {
  const base = createDefaultPreviewSettings()
  const settings: any = {
    ...base, width: cfg.w ?? 360, height: cfg.h ?? 640, fps: 30, durationInFrames: cfg.frames ?? 150, showEndCard: false,
    brandColors: { ...base.brandColors, backgroundDim: 0 }, layers: [],
    audio: cfg.musicUrl ? { url: cfg.musicUrl, name: 'music' } : null,
    ...(cfg.audioMix ? { audioMix: normalizeAudioMix(cfg.audioMix) } : {}),
    ...(cfg.presenter ? { presenter: cfg.presenter } : {}),
  }
  const inputProps: any = { videoUrl: cfg.videoUrl, posterUrl: null, isImageSource: false, audioUrl: cfg.musicUrl ?? null, settings,
    brand: { businessName: 'Acme', headline: 'H', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null } }
  const t0 = performance.now()
  const result: any = await exportPersonalizedVideo({ inputProps, onProgress: () => {} })
  const ms = Math.round(performance.now() - t0)
  if (!result.ok) return { ok: false, error: result.error, reason: result.reason, ms }
  return { ok: true, bytes: result.blob.size, ms, warning: result.warning, b64: await b64(result.blob) }
}
W.ready = true
