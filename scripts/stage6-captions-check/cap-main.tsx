// Browser side of the Stage 6 checks: the app's own exporter with captions, the REAL Whisper transcription worker, the REAL scene scan and
// video probe (mediabunny), and the SRT/VTT parser/serializer.
import { exportPersonalizedVideo } from '@ohb/shared/personalization/webExport'
import { createDefaultPreviewSettings, normalizePreviewSettings } from '@ohb/shared/personalization/preview/presets'
import { parseCaptionFile, cuesToSrt, cuesToVtt, chunksToCues, captionPages, pageAt } from '@ohb/shared/personalization/preview/captions'
import { scanScenes, probeVideo } from '@ohb/shared/personalization/guided/videoProbe'
import { transcribeInBrowser } from '../../src/lib/editor/remotion/transcribe.js'

const b64 = async (blob: Blob) => { const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s) }
const W = window as any
W.runExport = async (cfg: { videoUrl: string; captions?: any; w?: number; h?: number; frames?: number }) => {
  const base = createDefaultPreviewSettings()
  const settings = normalizePreviewSettings({ ...base, width: cfg.w ?? 640, height: cfg.h ?? 360, fps: 30, durationInFrames: cfg.frames ?? 180, showEndCard: false, brandColors: { ...base.brandColors, backgroundDim: 0 }, layers: [{ id: 'headline', kind: 'headline', visible: false, x: 0.5, y: 0.5, scale: 0.06, animation: 'none', animationDelay: 0, startFrame: 0, opacity: 1, text: 'x' }], ...(cfg.captions ? { captions: cfg.captions } : {}) } as any)
  const inputProps: any = { videoUrl: cfg.videoUrl, posterUrl: null, isImageSource: false, audioUrl: null, settings, brand: { businessName: 'Acme', headline: 'H', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null } }
  const t0 = performance.now(); const r: any = await exportPersonalizedVideo({ inputProps, onProgress: () => {} }); const ms = Math.round(performance.now() - t0)
  if (!r.ok) return { ok: false, error: r.error, ms }
  return { ok: true, ms, bytes: r.blob.size, b64: await b64(r.blob), pages: captionPages(settings.captions?.cues ?? [], settings.captions?.style ?? { combineMs: 900 }).map((p) => ({ text: p.text, startMs: p.startMs, durationMs: p.durationMs })) }
}
W.parse = (text: string, name: string) => { try { return { ok: true, ...parseCaptionFile(text, name) } } catch (e: any) { return { ok: false, error: e.message } } }
W.toSrt = (cues: any, combine = 0) => cuesToSrt(cues, { combineMs: combine }); W.toVtt = (cues: any, combine = 0) => cuesToVtt(cues, { combineMs: combine })
W.scan = async (u: string) => { const t0 = performance.now(); const r = await scanScenes(u, { fps: 5 }); return { cuts: r.cuts, scenes: r.scenes.length, thumbs: r.scenes.filter((s) => s.thumb && s.thumb.startsWith('data:image/jpeg')).length, frames: r.sampledFrames, dur: r.durationSec, ms: Math.round(performance.now() - t0) } }
W.probe = async (u: string) => { try { const f = await probeVideo(u); return { ok: true, ...f } } catch (e: any) { return { ok: false, error: String(e?.message || e) } } }
W.transcribe = async (u: string, model: string) => {
  const t0 = performance.now()
  try { const r: any = await (transcribeInBrowser as any)(u, { model }); return { ok: true, text: r.text, cues: chunksToCues(r.captions.map((c: any) => ({ text: c.text, timestamp: [c.startMs / 1000, c.endMs / 1000] }))), ms: Math.round(performance.now() - t0) } }
  catch (e: any) { return { ok: false, error: String(e?.message || e), ms: Math.round(performance.now() - t0) } }
}
W.pageAtMs = (cues: any, style: any, ms: number) => { const p = pageAt(captionPages(cues, style), ms); return p ? p.text : null }
W.decodeStats = async (u: string) => { const m: any = await import('../../src/lib/editor/remotion/transcribe.js'); const a: Float32Array = await m.decodeAudio(u); let s = 0, pk = 0; for (const v of a) { s += v * v; pk = Math.max(pk, Math.abs(v)) } return { n: a.length, rms: Math.sqrt(s / a.length), peak: pk, seconds: a.length / 16000 } }
W.ready = true
