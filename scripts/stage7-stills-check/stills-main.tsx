// Browser side of the Stage 7 checks: the REAL web-renderer frame source, the REAL thumbnail/GIF pipeline, and the legacy data-URL encoder.
import { createDefaultPreviewSettings, normalizePreviewSettings } from '@ohb/shared/personalization/preview/presets'
import { createWebStillDeps, makeGif, makeThumbnail } from '@ohb/shared/personalization/guided/renderStills'
import { encodeGif as legacyEncodeGif } from '../../src/lib/gifEncoder.js'

const b64 = async (blob: Blob) => { const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s) }
const W = window as any
const build = (cfg: any) => {
  const base = createDefaultPreviewSettings()
  const settings = normalizePreviewSettings({ ...base, width: 640, height: 360, fps: 30, durationInFrames: cfg.frames ?? 180, showEndCard: false, brandColors: { ...base.brandColors, backgroundDim: 0 },
    layers: cfg.layers ?? [{ id: 'headline', kind: 'headline', visible: true, x: 0.5, y: 0.2, scale: 0.12, animation: 'none', animationDelay: 0, startFrame: 0, opacity: 1, text: cfg.headline ?? 'Hi Acme', color: '#ffffff' }],
    ...(cfg.thumbnail ? { thumbnail: cfg.thumbnail } : {}), ...(cfg.gif ? { gif: cfg.gif } : {}), ...(cfg.footageEffects ? { footageEffects: cfg.footageEffects } : {}) } as any)
  return { videoUrl: cfg.videoUrl, posterUrl: null, isImageSource: false, audioUrl: null, settings, brand: { businessName: 'Acme', headline: 'H', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null } } as any
}
W.gif = async (cfg: any) => { const p = build(cfg); const deps = await createWebStillDeps(p); const t0 = performance.now(); try { const r = await makeGif(p, deps); return { ok: true, ms: Math.round(performance.now() - t0), bytes: r.bytes, plan: r.plan, stats: r.stats, w: r.width, h: r.height, b64: await b64(r.blob) } } catch (e: any) { return { ok: false, error: String(e?.message || e), code: e?.code } } }
W.thumb = async (cfg: any, format: 'jpeg' | 'png' = 'jpeg') => { const p = build(cfg); const deps = await createWebStillDeps(p); const t0 = performance.now(); try { const r = await makeThumbnail(p, deps, { format }); return { ok: true, ms: Math.round(performance.now() - t0), frame: r.frame, auto: r.auto, w: r.width, h: r.height, bytes: r.bytes, scores: r.scores.map((s) => ({ frame: s.frame, score: s.score.score, reasons: s.score.reasons })), b64: await b64(r.blob), type: r.blob.type } } catch (e: any) { return { ok: false, error: String(e?.message || e), code: e?.code } } }
W.legacy = async (colors: Array<[number, number, number]>, w: number, h: number) => {
  const urls = colors.map((c) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d')!; g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(2, 2, 6, 6); return cv.toDataURL('image/png') })
  const out = await legacyEncodeGif(urls, w, h, 300); return { ok: out.startsWith('data:image/gif;base64,'), b64: out.split(',')[1] ?? '' }
}
W.imgDecode = (b: string) => new Promise((res) => { const i = new Image(); i.onload = () => res({ ok: true, w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res({ ok: false }); i.src = `data:image/gif;base64,${b}` })
W.ready = true
