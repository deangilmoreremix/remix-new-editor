'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleHelp, Loader2, Share2, XCircle } from 'lucide-react'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { buildPreviewInput } from './buildPreviewInput'
import { suggestCopy } from '../copy/copyVariants'
import { analyzePixels, buildAssetReport, type AssetReport } from '../intelligence/imageIntel'
import { loadPixels } from '../intelligence/pixelLoader'
import { analyzeAudioSamples, decodeMediaAudio, recommendGain } from '../intelligence/audioIntel'
import { detectSceneCuts, recommendOverlayWindow, scenesFromCuts } from '../intelligence/sceneDetect'
import { probeVideo, sampleVideo } from '../intelligence/videoIntel'
import { setVideoAnalysis, useLastAnalysis, useVideoAnalysis, type VideoAnalysis } from '../intelligence/analysisStore'
import { ASPECTS, planCrops, zoneCenter, type CropAspect } from '../intelligence/smartCrop'
import { checkTextFit, findUnresolvedTokens, isPromotionalClaim, tightenOffer } from '../intelligence/textIntel'
import { extractKeywords } from '../intelligence/transcriptIntel'
import { buildScript, ctaIdeas, describeVideo, type Facts, type Tone } from '../intelligence/scriptIntel'
import { checkLocalAvailability, translateOnDevice } from '../intelligence/localAvailability'
import { buildPreflight, type CheckStatus } from '../intelligence/preflight'
import { PLATFORM_ZONES, platformsOverlapping } from '../intelligence/safeZones'
import { shareOrCopy } from '../intelligence/share'
import { productCropFromDetections, type PixelRect } from '../intelligence/productCrop'
import { improveLook, canApplyImprove } from '../intelligence/grade'
import { classifyOcrLines, ocrImage, type OcrLine } from '../intelligence/ocrIntel'
import { suggestThumbnails, composeThumbnail } from '../intelligence/thumbnailCompose'
import type { ThumbPick } from '../intelligence/thumbnailIntel'
import { searchTranscript, suggestChapters, suggestHighlights, extractKeywords as kw, type Cue } from '../intelligence/transcriptIntel'
import { detectObjects, grabFramePixels } from '../localAI/engine'
import { useLocalAI } from '../localAI/useLocalAI'
import { LocalAINotice } from './LocalAINotice'
import { loadImageBlob } from '../backgroundRemoval/loadImageBlob'
import { blobToFile, fileToFileList } from '../preview/imageUpscale'
import { seekPreviewTo } from '../preview/PreviewControls'
import { SocialPublishContext } from '../../../components/SocialPublishProvider'
import { useContext } from 'react'
import { VOICE_CLARITY, clampVoiceParams, encodeWav, renderVoiceClarity, MAX_PROCESS_SECONDS, type VoiceParams } from '../intelligence/audioProcess'
import { builtInAIStatus, generateCopyOnDevice, type BuiltInStatus, type CopyKind } from '../intelligence/builtInAI'
import { coverMapBox, detectFaceBoxes, nativeFaceDetectorAvailable, unionFaceZone, type Box } from '../intelligence/faceZones'
import { MAX_AUDIO_TRACKS, newAudioTrack } from '../preview/audioMix'
import { AUTO_SUBJECT_ZONE_ID } from '../preview/placement/subjectDetect'
import type { PreviewInputProps } from '../preview/types'
import type { LayoutQualityState } from './useLayoutQuality'
import { C, badgeStyle, hintStyle, inputStyle, panelStyle, primaryButtonStyle, secondaryButtonStyle } from './tokens'

const small = { ...secondaryButtonStyle, minHeight: 30, fontSize: 11, padding: '0 12px' } as const
const h3 = { margin: '0 0 6px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text } as const
const isAbort = (e: unknown) => (e as { name?: string })?.name === 'AbortError'

/** One cancellable job at a time with progress; a result that arrives after Cancel or unmount is dropped. */
function useJob() {
  const [state, setState] = useState<{ busy: boolean; message: string; progress: number | null; error: string | null }>({ busy: false, message: '', progress: null, error: null })
  const ac = useRef<AbortController | null>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; ac.current?.abort() } }, [])
  const run = useCallback(async <T,>(fn: (signal: AbortSignal, progress: (done: number, total: number, msg?: string) => void) => Promise<T>): Promise<T | undefined> => {
    ac.current?.abort()
    const ctl = new AbortController(); ac.current = ctl
    const set = (p: Partial<typeof state>) => { if (alive.current && ac.current === ctl) setState((s) => ({ ...s, ...p })) }
    set({ busy: true, error: null, message: 'Starting…', progress: null })
    try {
      const out = await fn(ctl.signal, (d, t, m) => set({ progress: t ? d / t : null, message: m ?? `Step ${d} of ${t}` }))
      set({ busy: false, progress: null })
      return ctl.signal.aborted ? undefined : out
    } catch (e) {
      set({ busy: false, progress: null, error: isAbort(e) ? null : (e instanceof Error && e.message) || 'This could not be done on this device.' })
      return undefined
    }
  }, [])
  const cancel = useCallback(() => { ac.current?.abort(); setState((s) => ({ ...s, busy: false, progress: null, message: '' })) }, [])
  return { ...state, run, cancel }
}

function JobStatus({ job }: { job: ReturnType<typeof useJob> }): React.JSX.Element | null {
  if (!job.busy && !job.error) return null
  return (
    <div role="status" data-testid="smart-job-status" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
      {job.busy && <><Loader2 size={13} className="animate-spin" color={C.cyan} /><span style={{ fontSize: 11, color: C.text }}>{job.message}{typeof job.progress === 'number' ? ` ${Math.round(job.progress * 100)}%` : ''}</span>
        <button type="button" data-testid="smart-job-cancel" onClick={job.cancel} style={{ ...small, minHeight: 26, fontSize: 10 }}>Cancel</button></>}
      {job.error && <span data-testid="smart-job-error" style={{ fontSize: 11, color: C.danger }}>{job.error}</span>}
    </div>
  )
}

const STATUS_ICON: Record<CheckStatus, React.JSX.Element> = {
  pass: <CheckCircle2 size={14} color={C.green} />, warn: <AlertTriangle size={14} color="#fcd34d" />,
  fail: <XCircle size={14} color={C.danger} />, unchecked: <CircleHelp size={14} color={C.muted} />,
}

// ───────────────────────── Step 1 — Optimize discovered assets ─────────────────────────

/** B1/B2/B5/B6: one-click report on the discovered pictures. Nothing is changed until the customer clicks an action. */
export function AssetIntelligencePanel({ advanced = false }: { advanced?: boolean }): React.JSX.Element | null {
  const { discoveredAssets = [], setDiscoveredAssets, previewSettings, updatePreviewBrandColors, updatePreviewLayer, assets, addLogoUrl, addProductFiles, addProductUrl } = useDemoPersonalize()
  const job = useJob()
  const [report, setReport] = useState<AssetReport | null>(null)
  const [unreadable, setUnreadable] = useState(0)
  const [confirmColors, setConfirmColors] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const detr = useLocalAI('detr')
  const [crops, setCrops] = useState<Record<string, { rect: PixelRect; w: number; h: number } | null>>({})
  const [ocrAsk, setOcrAsk] = useState<string | null>(null)
  const [ocr, setOcr] = useState<{ id: string; lines: OcrLine[]; none: boolean } | null>(null)
  const [ocrOk, setOcrOk] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const candidates = discoveredAssets.filter((a) => !a.rejected)
  if (candidates.length === 0 && !report) return null

  const detectProduct = async (id: string, url: string) => {
    const out = await detr.request(async ({ signal }) => {
      const frame = await grabFramePixels(url, 0, { image: true, maxSize: 640, signal })
      return { dets: await detectObjects(frame, { signal }), w: frame.width, h: frame.height }
    })
    if (!out) return
    const rect = productCropFromDetections(out.dets, out.w, out.h)
    setCrops((c) => ({ ...c, [id]: rect ? { rect, w: out.w, h: out.h } : null }))
    setNote(rect ? null : 'No clear product was found in that picture, or it already fills the frame.')
  }
  const cropToProduct = async (id: string, url: string) => {
    const c = crops[id]; if (!c) return
    try {
      const bmp = await createImageBitmap(await loadImageBlob(url))
      const sx = bmp.width / c.w, sy = bmp.height / c.h
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(c.rect.w * sx); canvas.height = Math.round(c.rect.h * sy)
      canvas.getContext('2d')!.drawImage(bmp, c.rect.x * sx, c.rect.y * sy, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
      bmp.close?.()
      const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('crop failed'))), 'image/png'))
      const list = fileToFileList(blobToFile(blob, `product-crop-${id}.png`))
      if (list) addProductFiles(list); else addProductUrl(URL.createObjectURL(blob))
      setNote('Added a cropped copy to your product pictures. The original is unchanged.')
      setCrops((x) => ({ ...x, [id]: null }))
    } catch { setNote('This picture could not be cropped in your browser.') }
  }
  const readText = (id: string, url: string) => {
    setOcrAsk(null); setOcr(null)
    void job.run(async (signal, progress) => {
      progress(0, 1, 'Reading the text (first use downloads the reader)…')
      const r = await ocrImage(url, { signal, onProgress: (p) => progress(p, 1, 'Reading the text…') })
      if (!signal.aborted) setOcr({ id, lines: r.lines, none: r.lines.length === 0 })
    })
  }
  const copyLine = async (l: OcrLine) => {
    try { await navigator.clipboard.writeText(l.text); setCopied(l.text) } catch { setCopied(null); setNote('Copying is not available here. Select the text and copy it.') }
  }

  const optimize = () => job.run(async (signal, progress) => {
    setNote(null); setConfirmColors(false)
    const list = candidates.slice(0, 40)
    const inputs = []
    let bad = 0
    for (let i = 0; i < list.length; i++) {
      if (signal.aborted) return
      const a = list[i]!
      const url = a.editedDataUrl || a.previewUrl
      const px = await loadPixels(url, 256, signal)
      if (px) inputs.push({ id: a.id, url, width: px.naturalWidth, height: px.naturalHeight, category: a.category, metrics: analyzePixels(px) })
      else bad++
      progress(i + 1, list.length, `Checking picture ${i + 1} of ${list.length}…`)
    }
    if (signal.aborted) return
    setUnreadable(bad); setReport(buildAssetReport(inputs))
  })

  const hideDuplicates = () => {
    if (!report) return
    const dupes = new Set(report.items.filter((i) => i.duplicateOf).map((i) => i.id))
    setDiscoveredAssets(discoveredAssets.map((a) => (dupes.has(a.id) ? { ...a, rejected: true } : a)))
    setNote(`Hid ${dupes.size} near-duplicate${dupes.size === 1 ? '' : 's'}. Nothing was deleted: use “Restore all” to bring them back.`)
  }
  // Fills only EMPTY slots with the best picture for the role. A picture the customer already chose, or a locked layer, is left alone.
  const assignBest = () => {
    if (!report) return
    const done: string[] = [], kept: string[] = []
    const urlOf = (id?: string) => report.items.find((i) => i.id === id)?.url
    const product = urlOf(report.bestByRole.product)
    const productLayer = (previewSettings?.layers ?? []).find((l) => l.kind === 'productImage')
    if (product && productLayer) {
      if (productLayer.imageUrl || productLayer.locked) kept.push('product image (already set)')
      else { updatePreviewLayer(productLayer.id, { imageUrl: product, visible: true, imageStyle: undefined }); done.push('product image') }
    }
    const logo = urlOf(report.bestByRole.logo)
    if (logo) {
      if ((assets?.logos ?? []).length > 0) kept.push('logo (already set)')
      else { addLogoUrl(logo); done.push('logo') }
    }
    setNote(done.length || kept.length ? `${done.length ? `Assigned: ${done.join(', ')}. ` : ''}${kept.length ? `Left as you had them: ${kept.join(', ')}.` : ''}` : 'No clear logo or product picture was found to assign.')
  }
  const applyColors = () => {
    const p = report?.suggestedPalette
    if (!p?.primary) return
    updatePreviewBrandColors({ primary: p.primary, accent: p.accent ?? p.secondary ?? p.primary })
    setConfirmColors(false); setNote('Brand colours applied to the overlay. You can change them in the editor.')
  }
  const pal = report?.suggestedPalette
  const cur = previewSettings?.brandColors ?? { primary: '', accent: '' }
  return (
    <div data-testid="asset-intelligence" style={{ ...panelStyle, marginTop: 12 }}>
      <h3 style={h3}>Optimize assets</h3>
      <p style={{ ...hintStyle, margin: '0 0 8px' }}>Checks your pictures on this device: finds duplicates, blurry or small images, likely logos and products, and your brand colours. Free; nothing is uploaded or changed until you choose.</p>
      <button type="button" data-testid="optimize-assets" disabled={job.busy || candidates.length === 0} onClick={() => void optimize()} style={{ ...primaryButtonStyle, minHeight: 34, fontSize: 12 }}>
        {report ? 'Check again' : 'Optimize discovered assets'}
      </button>
      <JobStatus job={job} />
      {report && (
        <div data-testid="asset-report" style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, color: C.text }} data-testid="asset-report-summary">
            Checked {report.summary.analyzed} picture{report.summary.analyzed === 1 ? '' : 's'}: {report.summary.duplicates} near-duplicate{report.summary.duplicates === 1 ? '' : 's'}, {report.summary.blurry} blurry, {report.summary.lowRes} small.
            {unreadable > 0 && <span style={{ color: C.muted }}> {unreadable} could not be read in this browser.</span>}
          </div>
          {report.items.slice(0, advanced ? 40 : 6).map((it) => (
            <div key={it.id} data-testid="asset-report-row" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: C.text }}>
              <img src={it.url} alt="" width={34} height={34} style={{ objectFit: 'cover', borderRadius: 6, background: '#000' }} />
              <span style={badgeStyle(it.role === 'unknown' ? 'muted' : 'cyan')}>{it.role === 'unknown' ? 'unsure' : `likely ${it.role}`}</span>
              <span>score {it.score}</span>
              <span style={{ color: C.muted, flex: 1 }}>{it.flags.map((f) => f.message).join(' ') || (advanced ? `${it.width}×${it.height}px` : '')}</span>
              {it.role !== 'logo' && <button type="button" data-testid="detect-product" disabled={detr.phase !== 'idle'} onClick={() => void detectProduct(it.id, it.url)} style={{ ...small, minHeight: 24, fontSize: 10 }}>Detect product</button>}
              {crops[it.id] && <><button type="button" data-testid="crop-product" onClick={() => void cropToProduct(it.id, it.url)} style={{ ...small, minHeight: 24, fontSize: 10 }}>Crop to product</button>
                <button type="button" data-testid="reset-product-crop" onClick={() => setCrops((x) => ({ ...x, [it.id]: null }))} style={{ ...small, minHeight: 24, fontSize: 10 }}>Reset crop</button></>}
              <button type="button" data-testid="read-text" disabled={job.busy} onClick={() => setOcrAsk(it.id)} style={{ ...small, minHeight: 24, fontSize: 10 }}>Read text</button>
            </div>
          ))}
          <LocalAINotice ai={detr} doing="finds the product in a picture so it can be cropped" />
          {ocrAsk && (
            <div data-testid="ocr-consent" style={{ ...hintStyle, color: C.text }}>
              Reading text uses a free on-device reader (Tesseract, Apache-2.0). The first use downloads roughly 15 MB (the reader and English language data) from a public CDN, then your browser keeps it. The picture itself is not uploaded.{' '}
              <button type="button" data-testid="ocr-go" onClick={() => readText(ocrAsk, report.items.find((i) => i.id === ocrAsk)!.url)} style={{ ...small, minHeight: 26 }}>Download and read</button>{' '}
              <button type="button" onClick={() => setOcrAsk(null)} style={{ ...small, minHeight: 26 }}>Not now</button>
            </div>
          )}
          {ocr && (
            <div data-testid="ocr-result" style={{ display: 'grid', gap: 4 }}>
              <div style={{ ...hintStyle, color: C.text, margin: 0 }}>{ocr.none ? 'No readable text was found.' : 'Text found. This is machine reading and may contain mistakes: check it before using it. Prices and offers need your confirmation.'}</div>
              {ocr.lines.map((l, n) => (
                <div key={`${l.text}-${n}`} data-testid="ocr-line" data-kind={l.kind} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: C.text }}>
                  <span style={badgeStyle(l.needsConfirm ? 'muted' : 'cyan')}>{l.kind}</span>
                  <span style={{ flex: 1 }}>{l.text}</span>
                  {l.needsConfirm && <label style={{ ...hintStyle, margin: 0 }}><input type="checkbox" data-testid="ocr-confirm" checked={!!ocrOk[l.text]} onChange={(e) => setOcrOk((o) => ({ ...o, [l.text]: e.target.checked }))} /> accurate</label>}
                  <button type="button" data-testid="ocr-copy" disabled={l.needsConfirm && !ocrOk[l.text]} onClick={() => void copyLine(l)} style={{ ...small, minHeight: 24, fontSize: 10 }}>{copied === l.text ? 'Copied' : 'Copy'}</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(report.bestByRole.logo || report.bestByRole.product) && <button type="button" data-testid="assign-best" onClick={assignBest} style={small}>Assign best pictures to the video</button>}
            {report.summary.duplicates > 0 && <button type="button" data-testid="hide-duplicates" onClick={hideDuplicates} style={small}>Hide {report.summary.duplicates} duplicate{report.summary.duplicates === 1 ? '' : 's'}</button>}
            {pal?.primary && (
              <>
                {[pal.primary, pal.secondary, pal.accent].filter((c): c is string => !!c).map((c) => <span key={c} title={c} data-testid="palette-swatch" style={{ width: 22, height: 22, borderRadius: 6, background: c, border: `1px solid ${C.border}` }} />)}
                {!confirmColors && <button type="button" data-testid="use-palette" onClick={() => setConfirmColors(true)} style={small}>Use these brand colours</button>}
              </>
            )}
          </div>
          {confirmColors && (
            <div data-testid="palette-confirm" style={{ ...hintStyle, color: C.text }}>
              This replaces the colours now on the overlay ({cur.primary}, {cur.accent}). Replace them?{' '}
              <button type="button" data-testid="palette-confirm-yes" onClick={applyColors} style={{ ...small, minHeight: 26 }}>Replace</button>{' '}
              <button type="button" onClick={() => setConfirmColors(false)} style={{ ...small, minHeight: 26 }}>Keep mine</button>
            </div>
          )}
          {note && <p data-testid="asset-note" style={{ ...hintStyle, margin: 0, color: C.text }}>{note}</p>}
          <p style={{ ...hintStyle, margin: 0 }}>Roles and scores are estimates from pixels, not a judgement of authenticity.</p>
        </div>
      )}
    </div>
  )
}

// ───────────────────────── Step 2 — Check my video ─────────────────────────

const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : 0)
const clock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`

/** A2/A4/D1/D2/D3/D6/D7: analyse the footage locally, summarise, and offer only safe, reversible fixes. */
export function VideoCheckPanel({ advanced = false }: { advanced?: boolean }): React.JSX.Element | null {
  const ctx = useDemoPersonalize()
  const { previewSettings, updatePreviewComposition } = ctx
  // A missing or partial project must never crash the editor: without a readable video the panel just stays hidden.
  let input: PreviewInputProps | null = null
  try { input = buildPreviewInput(ctx) } catch { input = null }
  const url = input?.videoUrl && !input.isImageSource ? input.videoUrl : null
  const analysis = useVideoAnalysis(url)
  const job = useJob()
  const [note, setNote] = useState<string | null>(null)
  const [prevLook, setPrevLook] = useState<{ look: typeof previewSettings.look } | null>(null)
  if (!url) return null

  const analyze = () => job.run(async (signal, progress) => {
    setNote(null)
    const probe = await probeVideo(url)
    if (!probe) throw new Error('This browser cannot read this video, so it could not be checked. It may use a codec your browser does not support.')
    const sample = await sampleVideo(url, probe.duration, { signal, count: 24, onProgress: (d, t) => progress(d, t, `Looking at frame ${d} of ${t}…`) })
    if (sample.lumaFrames.length < 3) throw new Error('Too few frames could be read from this video to check it.')
    progress(1, 2, 'Listening to the sound…')
    const dec = await decodeMediaAudio(url, { signal, maxSeconds: 300 })
    if (signal.aborted) return
    const cuts = detectSceneCuts(sample.lumaFrames)
    const result: VideoAnalysis = {
      url, width: probe.width, height: probe.height, duration: probe.duration,
      scenes: scenesFromCuts(cuts, probe.duration), sharpness: median(sample.sharpness), brightness: sample.meanBrightness,
      audio: dec ? analyzeAudioSamples(dec.samples, dec.sampleRate) : null, framesSampled: sample.lumaFrames.length,
    }
    setVideoAnalysis(result)
  })

  const a = analysis
  const gain = a?.audio ? recommendGain(a.audio) : null
  const fixAudio = () => {
    if (!gain) return
    const cur = previewSettings.videoVolume ?? 1
    if (gain.gain >= 0.99) { setNote(a?.audio?.silent ? 'No sound to adjust.' : 'The volume mix can lower a video’s sound but not raise it above the original, so a quiet clip needs a louder source or a music/voice track.'); return }
    updatePreviewComposition({ videoVolume: Math.round(cur * gain.gain * 100) / 100 })
    setNote(`Video sound lowered by ${Math.abs(gain.gainDb)} dB to avoid distortion. Change it any time in Audio.`)
  }
  const improve = () => {
    if (!a) return
    if (!canApplyImprove(previewSettings.look)) { setNote('You already have a look applied, so it was left alone. Reset it in Look first if you want the automatic one.'); return }
    setPrevLook({ look: previewSettings.look })
    const look = improveLook(a.brightness)
    updatePreviewComposition({ look })
    setNote(`Applied a gentle improvement (brightness ${look.exposure >= 0 ? '+' : ''}${look.exposure} stops, a little contrast and colour). Undo it below.`)
  }
  const undoImprove = () => { if (prevLook) { updatePreviewComposition({ look: prevLook.look }); setPrevLook(null); setNote('Look restored.') } }
  const subjectZone = (previewSettings.protectedZones ?? []).find((z) => z.id === AUTO_SUBJECT_ZONE_ID || z.id === 'customer-subject')
  const focus = previewSettings.videoFocus
  const followSubject = () => {
    if (!subjectZone) { setNote('Mark or find the subject first (Layout check → “Find the subject for me”), then the crop can follow it.'); return }
    const c = zoneCenter(subjectZone)
    updatePreviewComposition({ videoFocus: { x: Math.min(1, Math.max(0, c.x)), y: Math.min(1, Math.max(0, c.y)) } })
    setNote('Crop now follows the subject for narrower shapes (9:16, 1:1, 4:5). It is the same in the preview and the export.')
  }
  const crops = a && subjectZone ? planCrops(a.width, a.height, [{ t: 0, ...(focus ?? zoneCenter(subjectZone)) }], ['9:16', '1:1', '4:5', '16:9'] as CropAspect[], { x: subjectZone.x, y: subjectZone.y, w: subjectZone.w, h: subjectZone.h }) : []
  const overlayWindow = a ? recommendOverlayWindow(a.scenes) : null
  const lowRes = a ? Math.min(a.width, a.height) < 720 : false
  const soft = a ? a.sharpness < 25 : false

  return (
    <div data-testid="video-check" style={{ ...panelStyle, marginTop: 12 }}>
      <h3 style={h3}>Check my video</h3>
      <p style={{ ...hintStyle, margin: '0 0 8px' }}>Looks at sampled frames and the sound on this device: scene changes, sharpness, brightness, loudness, clipping and silence. Free; the video never leaves your browser.</p>
      <button type="button" data-testid="analyze-video" disabled={job.busy} onClick={() => void analyze()} style={{ ...primaryButtonStyle, minHeight: 34, fontSize: 12 }}>{a ? 'Check again' : 'Analyze video'}</button>
      <JobStatus job={job} />
      {a && (
        <div data-testid="video-report" style={{ marginTop: 10, display: 'grid', gap: 6, fontSize: 12, color: C.text }}>
          <div data-testid="video-summary">{a.width}×{a.height}, {a.duration.toFixed(1)}s · {a.scenes.length} scene{a.scenes.length === 1 ? '' : 's'} · from {a.framesSampled} sampled frames</div>
          {lowRes && <div style={{ color: '#fcd34d' }}>Low resolution for a full-screen video.</div>}
          {soft && <div style={{ color: '#fcd34d' }}>Looks soft or blurry. Sharpening cannot add detail that is not in the footage.</div>}
          {a.brightness < 55 && <div style={{ color: '#fcd34d' }}>Quite dark: text may be hard to read. Try the brightness controls in Look.</div>}
          {a.audio ? (
            <div data-testid="audio-summary" style={{ color: a.audio.clipped ? C.danger : C.text }}>
              {a.audio.silent ? 'No sound detected.' : `${a.audio.clipped ? 'Audio clips (distorts) at its loudest points. ' : 'No clipping. '}${a.audio.lufs != null ? `Loudness ≈ ${a.audio.lufs.toFixed(1)} LUFS. ` : ''}${a.audio.silences.length ? `${a.audio.silences.length} long pause${a.audio.silences.length === 1 ? '' : 's'} (suggested cuts, nothing removed).` : ''}`}
            </div>
          ) : <div style={{ color: C.muted }}>Sound could not be read, so audio was not checked.</div>}
          {overlayWindow && <div style={{ color: C.muted }}>Longest steady scene: {clock(overlayWindow.start)}–{clock(overlayWindow.end)}, a good time for your logo and call to action.</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {a.audio && !a.audio.silent && <button type="button" data-testid="fix-audio" onClick={fixAudio} style={small}>Fix audio</button>}
            <button type="button" data-testid="improve-video" onClick={improve} style={small}>Improve video</button>
            {prevLook && <button type="button" data-testid="undo-improve" onClick={undoImprove} style={small}>Undo</button>}
            <button type="button" data-testid="follow-subject" onClick={followSubject} style={small}>Smart crop: follow subject</button>
            {focus && <button type="button" data-testid="reset-crop" onClick={() => updatePreviewComposition({ videoFocus: undefined })} style={small}>Reset crop</button>}
          </div>
          {crops.length > 0 && (
            <div data-testid="crop-fit" style={{ ...hintStyle, margin: 0 }}>
              Subject fit (estimate): {crops.map((c) => `${c.aspect} ${c.subjectInside ? '✓' : 'cut off'}`).join(' · ')}
            </div>
          )}
          {advanced && (
            <div data-testid="crop-advanced" style={{ display: 'grid', gap: 6 }}>
              {(['x', 'y'] as const).map((axis) => (
                <label key={axis} style={{ ...hintStyle, display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>
                  Crop {axis === 'x' ? 'horizontal' : 'vertical'} position
                  <input type="range" min={0} max={1} step={0.01} aria-label={`Crop ${axis}`} data-testid={`crop-${axis}`} value={(focus ?? { x: 0.5, y: 0.5 })[axis]}
                    onChange={(e) => updatePreviewComposition({ videoFocus: { ...(focus ?? { x: 0.5, y: 0.5 }), [axis]: Number(e.target.value) } })} style={{ flex: 1, accentColor: C.cyan }} />
                </label>
              ))}
              <div style={{ ...hintStyle, margin: 0 }}>Scene starts: {a.scenes.map((s) => clock(s.start)).join(', ')}{a.audio?.silences.length ? ` · Pauses: ${a.audio.silences.map((s) => `${clock(s.startMs / 1000)}–${clock(s.endMs / 1000)}`).join(', ')}` : ''}</div>
            </div>
          )}
          <VoiceClarityControls url={url} advanced={advanced} />
          <FaceZoneControl url={url} />
          {note && <p data-testid="video-note" style={{ ...hintStyle, margin: 0, color: C.text }}>{note}</p>}
        </div>
      )}
    </div>
  )
}

// ───────────────────────── Step 3 — Free content ─────────────────────────

type Field = 'ctaHeadline' | 'brandDescription' | 'callToAction' | 'offer'
type Layer = 'headline' | 'tagline' | 'cta' | 'offer'

/** C2–C11 (template-based): wording from the customer’s own facts. No model is downloaded and no paid service is called. */
export function FreeContentPanel({ onPick }: { onPick: (field: Field, value: string, layer: Layer) => void }): React.JSX.Element {
  const ctx = useDemoPersonalize()
  const { clientForm = {}, previewSettings } = ctx
  const [open, setOpen] = useState(false)
  const [tone, setTone] = useState<Tone>('friendly')
  const [seconds, setSeconds] = useState(15)
  const [lang, setLang] = useState('es')
  const [translated, setTranslated] = useState<string | null>(null)
  const [translateNote, setTranslateNote] = useState<string | null>(null)
  const [shareNote, setShareNote] = useState<string | null>(null)
  const [confirmClaim, setConfirmClaim] = useState<string | null>(null)
  const avail = useMemo(() => checkLocalAvailability(), [])
  const facts = useMemo(() => ({
    businessName: clientForm.businessName || clientForm.name, industry: clientForm.industry, location: clientForm.location,
    phone: clientForm.phone, website: clientForm.website, offer: clientForm.offer, cta: clientForm.callToAction,
  }), [clientForm.businessName, clientForm.name, clientForm.industry, clientForm.location, clientForm.phone, clientForm.website, clientForm.offer, clientForm.callToAction])
  const copy = useMemo(() => suggestCopy({ businessName: facts.businessName, industry: facts.industry, location: facts.location, phone: facts.phone, website: facts.website }), [facts])
  const script = useMemo(() => buildScript(facts, { purpose: facts.offer ? 'promo' : 'intro', tone, seconds }), [facts, tone, seconds])
  const [scriptText, setScriptText] = useState<string | null>(null)
  const description = useMemo(() => describeVideo(facts), [facts])
  const ctas = useMemo(() => ctaIdeas(facts), [facts])
  const keywords = useMemo(() => extractKeywords([clientForm.brandDescription, clientForm.industry, clientForm.offer].filter(Boolean).join('. '), 6), [clientForm.brandDescription, clientForm.industry, clientForm.offer])
  const tight = facts.offer ? tightenOffer(facts.offer, 60) : null
  const visibleText = (previewSettings?.layers ?? []).filter((l) => l.visible && l.text)
  const fitWarnings = visibleText.flatMap((l) => {
    const sec = ((l.endFrame ?? previewSettings.durationInFrames) - l.startFrame) / previewSettings.fps
    const r = checkTextFit(l.text!, { boxWidthPx: previewSettings.width * 0.8, boxHeightPx: previewSettings.height * 0.2, fontPx: previewSettings.height * 0.04 * (l.scale ?? 1), seconds: sec })
    return r.warnings.map((w) => `${l.kind}: ${w}`)
  })
  const tokens = [...new Set(visibleText.flatMap((l) => findUnresolvedTokens(l.text)))]

  const pick = (field: Field, value: string, layer: Layer) => {
    if ((field === 'offer') && isPromotionalClaim(value) && confirmClaim !== value) { setConfirmClaim(value); return }
    setConfirmClaim(null); onPick(field, value, layer)
  }
  const translate = async () => {
    setTranslateNote(null)
    const out = await translateOnDevice(description.text, 'en', lang)
    if (out) setTranslated(out); else setTranslateNote('This browser could not translate on-device. Nothing was sent anywhere.')
  }
  const share = async () => {
    const r = await shareOrCopy({ title: facts.businessName, text: translated ?? description.text, url: facts.website })
    setShareNote(r === 'shared' ? 'Shared.' : r === 'copied' ? 'Copied to the clipboard.' : r === 'cancelled' ? null : 'Sharing is not available here. Select the text above and copy it.')
  }

  return (
    <div data-testid="free-content" style={{ marginTop: 10 }}>
      <button type="button" data-testid="free-content-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={small}>{open ? 'Hide free content' : 'Generate free content'}</button>
      {open && (
        <div style={{ marginTop: 8, display: 'grid', gap: 10 }}>
          <p style={{ ...hintStyle, margin: 0 }}>Built from your own details with templates, on this device, at no cost. No AI model is downloaded and no paid service is called. {avail.note}</p>
          <div>
            <div style={{ ...hintStyle, marginBottom: 4 }}>Headlines</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {copy.headlines.map((t) => <button key={t} type="button" data-testid="fc-headline" onClick={() => pick('ctaHeadline', t, 'headline')} style={small}>{t}</button>)}
              {copy.headlines.length === 0 && <span style={hintStyle}>Add the business name and kind of business to get headlines.</span>}
            </div>
          </div>
          {ctas.length > 0 && (
            <div>
              <div style={{ ...hintStyle, marginBottom: 4 }}>Calls to action that match your details</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{ctas.map((t) => <button key={t} type="button" data-testid="fc-cta" onClick={() => pick('callToAction', t, 'cta')} style={small}>{t}</button>)}</div>
            </div>
          )}
          {tight?.changed && facts.offer && (
            <div data-testid="fc-offer">
              <div style={{ ...hintStyle, marginBottom: 4 }}>Shorter version of your offer (same numbers, nothing added)</div>
              <button type="button" onClick={() => pick('offer', tight.text, 'offer')} style={small}>{tight.text}</button>
              {confirmClaim === tight.text && <div data-testid="fc-claim-confirm" style={{ ...hintStyle, color: C.text, marginTop: 4 }}>This states a price or promotion. Only use it if it is accurate and currently valid. <button type="button" data-testid="fc-claim-yes" onClick={() => pick('offer', tight.text, 'offer')} style={{ ...small, minHeight: 24 }}>It’s accurate — use it</button></div>}
            </div>
          )}
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
              <span style={hintStyle}>Video script</span>
              <select aria-label="Tone" value={tone} onChange={(e) => { setTone(e.target.value as Tone); setScriptText(null) }} style={{ ...inputStyle, width: 'auto', minHeight: 28, fontSize: 11 }}>
                <option value="friendly">Friendly</option><option value="professional">Professional</option><option value="energetic">Energetic</option>
              </select>
              <select aria-label="Length" value={seconds} onChange={(e) => { setSeconds(Number(e.target.value)); setScriptText(null) }} style={{ ...inputStyle, width: 'auto', minHeight: 28, fontSize: 11 }}>
                {[10, 15, 30, 45].map((s) => <option key={s} value={s}>{s} seconds</option>)}
              </select>
            </div>
            <textarea data-testid="fc-script" aria-label="Video script" value={scriptText ?? script.text} onChange={(e) => setScriptText(e.target.value)} rows={3} style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
            <div style={hintStyle}>{(scriptText ?? script.text).split(/\s+/).filter(Boolean).length} words ≈ {Math.round((scriptText ?? script.text).split(/\s+/).filter(Boolean).length / 2.5)}s spoken. Edit freely.</div>
          </div>
          <div>
            <div style={{ ...hintStyle, marginBottom: 4 }}>Description for posts and your landing page</div>
            <textarea data-testid="fc-description" aria-label="Video description" defaultValue={description.text} key={description.text} rows={2} style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
              <select aria-label="Translate to" value={lang} onChange={(e) => setLang(e.target.value)} style={{ ...inputStyle, width: 'auto', minHeight: 28, fontSize: 11 }}>
                {[['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['it', 'Italian']].map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
              <button type="button" data-testid="fc-translate" disabled={!avail.translator} title={avail.translator ? '' : 'This browser has no built-in translator'} onClick={() => void translate()} style={{ ...small, opacity: avail.translator ? 1 : 0.5 }}>Translate on this device</button>
              <button type="button" data-testid="fc-share" onClick={() => void share()} style={{ ...small, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Share2 size={12} /> Share or copy</button>
            </div>
            {!avail.translator && <div style={hintStyle}>Translation needs a browser with a built-in translator (recent Chrome). Not available here; nothing is sent to a translation service.</div>}
            {translated && <textarea data-testid="fc-translated" aria-label="Translation (review before use)" defaultValue={translated} rows={2} style={{ ...inputStyle, width: '100%', marginTop: 6 }} />}
            {translateNote && <div style={{ ...hintStyle, color: C.danger }}>{translateNote}</div>}
            {shareNote && <div data-testid="fc-share-note" style={hintStyle}>{shareNote}</div>}
          </div>
          <OnDeviceAI facts={facts} onPick={pick} />
          {keywords.length > 0 && <div data-testid="fc-keywords" style={hintStyle}>Keywords from your details: {keywords.join(', ')}</div>}
          {(fitWarnings.length > 0 || tokens.length > 0) && (
            <ul data-testid="fc-warnings" style={{ margin: 0, paddingLeft: 16, ...hintStyle, color: '#fcd34d' }}>
              {tokens.length > 0 && <li>Unfilled placeholder in the video: {tokens.join(', ')}</li>}
              {fitWarnings.slice(0, 5).map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ───────────────────────── Step 4 — Final checks ─────────────────────────

/** F3/F4/F6/G2/G5: the preflight list (verified vs not checked), social safe zones, and a share handoff. */
export function FinalChecksPanel({ inputProps, quality, advanced = false, mediaUrl, description }: { inputProps: PreviewInputProps; quality: LayoutQualityState; advanced?: boolean; /** The finished video, once it exists. */ mediaUrl?: string | null; description?: string }): React.JSX.Element {
  const { previewSettings, assets, discoveredAssets = [] } = useDemoPersonalize()
  const analysis = useVideoAnalysis(inputProps?.videoUrl && !inputProps.isImageSource ? inputProps.videoUrl : null)
  const [shareNote, setShareNote] = useState<string | null>(null)
  const publish = useContext(SocialPublishContext)
  const brand = inputProps?.brand ?? { businessName: '', headline: '', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null }
  const layers = (previewSettings?.layers ?? []).filter((l) => l.visible)
  const texts = [...layers.map((l) => l.text ?? ''), brand.businessName, brand.headline, brand.offer, brand.cta].filter(Boolean)
  const usedUrls = new Set(layers.map((l) => l.imageUrl).filter(Boolean))
  const selected = discoveredAssets.filter((a) => a.selected && !a.rejected)
  const unused = selected.filter((a) => ![a.previewUrl, a.editedDataUrl].some((u) => u && (usedUrls.has(u) || [brand.logoUrl, brand.productUrl, brand.serviceUrl].includes(u)))).length
  const imageLayers = layers.filter((l) => l.kind === 'logo' || l.kind === 'productImage' || l.kind === 'serviceImage').map((l) => ({ label: l.kind === 'logo' ? 'Logo' : l.kind === 'productImage' ? 'Product image' : 'Service image', url: l.imageUrl || (l.kind === 'logo' ? brand.logoUrl : l.kind === 'productImage' ? brand.productUrl : brand.serviceUrl) }))
  const cuesCount = previewSettings?.captions?.enabled ? previewSettings.captions.cues?.length ?? 0 : 0
  const issues = quality?.report?.issues ?? []
  const readIssues = issues.filter((i) => /contrast|reading|readab/i.test(`${i.code} ${i.message}`))
  const result = buildPreflight({
    hasVideo: Boolean(inputProps?.videoUrl || inputProps?.posterUrl),
    texts, imageLayers, unusedSelectedAssets: unused,
    captions: { present: cuesCount > 0, count: cuesCount },
    audio: analysis?.audio ? { clipped: analysis.audio.clipped, silent: analysis.audio.silent, lufs: analysis.audio.lufs } : null,
    layout: quality?.report ? { adjust: issues.filter((i) => i.severity !== 'review').length, blocksExport: Boolean(quality.report.blocksExport) } : null,
    readability: !quality?.report ? null : readIssues.length ? { warnings: readIssues.length } : (quality.sampling === 'done' ? { warnings: 0 } : null),
    formats: { prepared: [], total: 4 },
  })
  const aspect = previewSettings?.aspectRatio ?? '9:16'
  const overlaps = layers.filter((l) => l.kind !== 'design').flatMap((l) => platformsOverlapping({ x: l.x, y: l.y, w: 0.3, h: 0.08 }, aspect).map((z) => `${l.kind} → ${z.label}`))
  const zones = PLATFORM_ZONES.filter((z) => z.aspect === aspect)
  const share = async () => {
    const r = await shareOrCopy({ title: brand.businessName, text: [brand.headline, brand.cta].filter(Boolean).join(' — '), url: brand.website || undefined })
    setShareNote(r === 'shared' ? 'Shared.' : r === 'copied' ? 'Copied to the clipboard.' : r === 'cancelled' ? null : 'Sharing is not available here. Copy the link from your browser.')
  }
  void assets
  return (
    <div data-testid="final-checks" style={{ ...panelStyle, marginTop: 12 }}>
      <h3 style={h3}>Final checks</h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {result.items.filter((i) => advanced || i.status !== 'unchecked' || ['audio', 'layout'].includes(i.id)).map((i) => (
          <li key={i.id} data-testid="preflight-item" data-check={i.id} data-status={i.status} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: C.text }}>
            {STATUS_ICON[i.status]}<span><strong>{i.label}</strong>{advanced || i.status !== 'pass' ? <span style={{ color: C.muted }}> — {i.detail}</span> : null}</span>
          </li>
        ))}
      </ul>
      <p data-testid="preflight-summary" style={{ ...hintStyle, margin: '8px 0 0' }}>
        {result.verified} verified, {result.unchecked} not checked.{result.ready ? ' Nothing blocks approval.' : ` Fix first: ${result.blocking.map((b) => b.label).join(', ')}.`}
      </p>
      <div data-testid="safe-zones" style={{ ...hintStyle, margin: '8px 0 0' }}>
        Social safe zones for {aspect} (estimates; platforms change them): {zones.length ? zones.map((z) => z.label).join(', ') : 'none apply to this shape'}.
        {overlaps.length > 0 ? ` Text near the edge may be covered: ${[...new Set(overlaps)].slice(0, 4).join('; ')}.` : zones.length ? ' Your text sits clear of them.' : ''}
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" data-testid="final-share" onClick={() => void share()} style={{ ...small, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Share2 size={12} /> Share or copy link</button>
        {shareNote && <span data-testid="final-share-note" style={hintStyle}>{shareNote}</span>}
        <button type="button" data-testid="final-publish" disabled={!mediaUrl || !publish || !result.ready}
          title={!mediaUrl ? 'Create the video first' : !publish ? 'Social publishing is not available here' : !result.ready ? 'Fix the items above first' : ''}
          onClick={() => publish?.openPublish({ mediaUrl: mediaUrl!, mediaType: 'video', title: brand.businessName || undefined, caption: description || [brand.headline, brand.cta].filter(Boolean).join(' — ') || undefined })}
          style={{ ...small, opacity: !mediaUrl || !publish || !result.ready ? 0.5 : 1 }}>Send to social publishing</button>
      </div>
      <ThumbnailPanel inputProps={inputProps} />
    </div>
  )
}

export { ASPECTS }


// ───────────────────────── Thumbnails (A5, G3) ─────────────────────────

/** Suggests strong frames from the footage and composes an editable 1280×720 thumbnail. No image generation service. */
export function ThumbnailPanel({ inputProps }: { inputProps: PreviewInputProps }): React.JSX.Element | null {
  const { previewSettings } = useDemoPersonalize()
  const job = useJob()
  const url = inputProps?.videoUrl && !inputProps.isImageSource ? inputProps.videoUrl : null
  const [picks, setPicks] = useState<(ThumbPick & { preview: string })[]>([])
  const [chosen, setChosen] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [made, setMade] = useState<{ href: string } | null>(null)
  useEffect(() => () => { if (made) URL.revokeObjectURL(made.href) }, [made])
  if (!url) return null
  const brand = inputProps.brand
  const colors = previewSettings?.brandColors
  const suggest = () => job.run(async (signal, progress) => {
    const probe = await probeVideo(url)
    if (!probe) throw new Error('This browser cannot read this video, so thumbnails cannot be suggested.')
    const out = await suggestThumbnails(url, probe.duration, { signal, onProgress: (d, t) => progress(d, t, `Looking at frame ${d} of ${t}…`) })
    if (signal.aborted) return
    if (!out.length) throw new Error('No usable frames could be read from this video.')
    setPicks(out); setChosen(0); setMade(null)
  })
  const make = () => job.run(async (signal) => {
    if (chosen == null) return
    const blob = await composeThumbnail({ videoUrl: url, atSeconds: picks[chosen]!.t, title: title || brand.businessName || 'My business', subtitle: brand.headline || undefined, primary: colors?.primary || '#d9ff00', text: '#ffffff', logoUrl: brand.logoUrl }, signal)
    if (signal.aborted) return
    setMade({ href: URL.createObjectURL(blob) })
  })
  return (
    <div data-testid="thumbnail-panel" style={{ marginTop: 10 }}>
      <div style={{ ...hintStyle, marginBottom: 6 }}>Thumbnail: picks sharp, well-lit frames from your video (it does not detect faces) and adds your name, logo and colours. Free; made on this device.</div>
      <button type="button" data-testid="suggest-thumbnails" disabled={job.busy} onClick={() => void suggest()} style={small}>{picks.length ? 'Suggest again' : 'Suggest thumbnails'}</button>
      <JobStatus job={job} />
      {picks.length > 0 && (
        <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {picks.map((p, i) => (
              <button key={p.t} type="button" data-testid="thumb-pick" aria-pressed={chosen === i} onClick={() => { setChosen(i); setMade(null) }} style={{ padding: 0, border: `2px solid ${chosen === i ? C.cyan : C.border}`, borderRadius: 8, background: 'none', cursor: 'pointer' }}>
                <img src={p.preview} alt={`Frame at ${p.t.toFixed(1)} seconds`} width={150} style={{ display: 'block', borderRadius: 6 }} />
              </button>
            ))}
          </div>
          <input aria-label="Thumbnail title" data-testid="thumb-title" placeholder={brand.businessName || 'Title'} value={title} onChange={(e) => { setTitle(e.target.value); setMade(null) }} style={{ ...inputStyle, maxWidth: 360 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" data-testid="make-thumbnail" disabled={job.busy} onClick={() => void make()} style={small}>Make thumbnail</button>
            {made && <a data-testid="thumb-download" href={made.href} download="thumbnail.png" style={{ ...small, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Download PNG</a>}
          </div>
          {made && <img src={made.href} alt="Thumbnail preview" style={{ maxWidth: 360, borderRadius: 8 }} />}
        </div>
      )}
    </div>
  )
}


// ───────────────────────── Transcript tools (A6, E4, E5) ─────────────────────────

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** Find words in the captions and jump there; suggested chapters and highlights. Suggestions only; chapters are copied after you confirm. */
export function TranscriptToolsPanel(): React.JSX.Element | null {
  const { previewSettings } = useDemoPersonalize()
  const analysis = useLastAnalysis()
  const [q, setQ] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const caps = previewSettings?.captions
  const cues: Cue[] = useMemo(() => (caps?.enabled ? caps.cues ?? [] : []).map((c) => ({ text: c.text, startMs: c.start * 1000, endMs: c.end * 1000 })), [caps])
  const fps = previewSettings?.fps ?? 30
  const chapters = useMemo(() => suggestChapters(cues), [cues])
  const highlights = useMemo(() => suggestHighlights(cues, { keywords: kw(cues.map((c) => c.text).join('. '), 5), cutTimesSec: analysis?.scenes.slice(1).map((s) => s.start) }), [cues, analysis])
  const hits = searchTranscript(cues, q)
  if (!cues.length) return null
  const go = (ms: number) => seekPreviewTo(Math.round((ms / 1000) * fps))
  const copyChapters = async () => {
    const text = chapters.map((c) => `${mmss(c.startMs / 1000)} ${c.title}`).join('\n')
    try { await navigator.clipboard.writeText(text); setNote('Chapters copied. Paste them into your video description.') } catch { setNote('Copying is not available here.') }
    setConfirm(false)
  }
  return (
    <div data-testid="transcript-tools" style={{ ...panelStyle, marginTop: 12 }}>
      <h3 style={h3}>Find in transcript</h3>
      <input aria-label="Search the transcript" data-testid="transcript-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a word…" style={{ ...inputStyle, maxWidth: 320 }} />
      {q.trim() && <div data-testid="transcript-hits" style={{ marginTop: 6, display: 'grid', gap: 4 }}>
        {hits.length === 0 && <span style={hintStyle}>No match.</span>}
        {hits.slice(0, 8).map((h) => <button key={h.startMs} type="button" data-testid="transcript-hit" onClick={() => go(h.startMs)} style={{ ...small, justifyContent: 'flex-start', textAlign: 'left' }}>{mmss(h.startMs / 1000)} · {h.text}</button>)}
      </div>}
      {highlights.length > 0 && <div data-testid="highlights" style={{ marginTop: 8 }}>
        <div style={hintStyle}>Moments worth a look (a guess from speech and scene changes, not a prediction of what performs well):</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>{highlights.map((h) => <button key={h.startMs} type="button" data-testid="highlight" onClick={() => go(h.startMs)} style={small} title={h.reason}>{mmss(h.startMs / 1000)}</button>)}</div>
      </div>}
      {chapters.length > 1 && <div data-testid="chapters" style={{ marginTop: 8 }}>
        <div style={hintStyle}>Suggested chapters (check the titles before you publish):</div>
        <ul style={{ margin: '4px 0', paddingLeft: 16, fontSize: 12, color: C.text }}>{chapters.map((c) => <li key={c.startMs}>{mmss(c.startMs / 1000)} {c.title}</li>)}</ul>
        {!confirm ? <button type="button" data-testid="copy-chapters" onClick={() => setConfirm(true)} style={small}>Copy chapters</button>
          : <span style={{ ...hintStyle, color: C.text }}>These titles are automatic. Copy them anyway? <button type="button" data-testid="copy-chapters-yes" onClick={() => void copyChapters()} style={{ ...small, minHeight: 26 }}>Yes, copy</button></span>}
      </div>}
      {note && <p style={{ ...hintStyle, margin: '6px 0 0', color: C.text }}>{note}</p>}
    </div>
  )
}


// ───────────────────────── Voice clarity (D5) ─────────────────────────

const sliderRow = (label: string, id: string, value: number, min: number, max: number, step: number, on: (v: number) => void, unit = '') => (
  <label key={id} style={{ ...hintStyle, display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>
    <span style={{ minWidth: 118 }}>{label}</span>
    <input type="range" aria-label={label} data-testid={id} min={min} max={max} step={step} value={value} onChange={(e) => on(Number(e.target.value))} style={{ flex: 1, accentColor: C.cyan }} />
    <span style={{ minWidth: 48 }}>{value}{unit}</span>
  </label>
)

/** Speech-focused EQ, compression and level matching, rendered on this device into a new audio track. Not AI noise removal. */
export function VoiceClarityControls({ url, advanced }: { url: string; advanced: boolean }): React.JSX.Element {
  const { previewSettings, updatePreviewComposition } = useDemoPersonalize()
  const settingsRef = useRef(previewSettings); settingsRef.current = previewSettings
  const job = useJob()
  const [params, setParams] = useState<VoiceParams>(VOICE_CLARITY)
  const [applied, setApplied] = useState<{ trackId: string; wasMuted: boolean; href: string } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const set = (patch: Partial<VoiceParams>) => setParams((p) => ({ ...p, ...patch }))
  const apply = () => job.run(async (signal, progress) => {
    setNote(null)
    if ((settingsRef.current.audioTracks ?? []).length >= MAX_AUDIO_TRACKS) throw new Error('The audio mix is full. Remove a track first.')
    progress(0, 2, 'Reading the sound…')
    const dec = await decodeMediaAudio(url, { signal, maxSeconds: MAX_PROCESS_SECONDS + 1 })
    if (!dec) throw new Error('The sound in this video could not be read, so it cannot be improved.')
    progress(1, 2, 'Improving the voice…')
    const r = await renderVoiceClarity(dec, clampVoiceParams(params), signal)
    if (signal.aborted) return
    const href = URL.createObjectURL(encodeWav(r.samples, r.sampleRate))
    const track = newAudioTrack({ url: href, name: 'Clearer voice', kind: 'voiceover', volume: 1 })
    const cur = settingsRef.current
    updatePreviewComposition({ audioTracks: [...(cur.audioTracks ?? []), track], videoMuted: true })
    setApplied({ trackId: track.id, wasMuted: cur.videoMuted === true, href })
    setNote(`Added a “Clearer voice” track (${r.gainDb >= 0 ? '+' : ''}${r.gainDb} dB level match) and muted the original sound in the mix. The original is untouched; Undo restores it.`)
  })
  const undo = () => {
    if (!applied) return
    const cur = settingsRef.current
    updatePreviewComposition({ audioTracks: (cur.audioTracks ?? []).filter((t) => t.id !== applied.trackId), videoMuted: applied.wasMuted || undefined })
    URL.revokeObjectURL(applied.href); setApplied(null); setNote('Original sound restored.')
  }
  return (
    <div data-testid="voice-clarity" style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" data-testid="voice-apply" disabled={job.busy || !!applied} onClick={() => void apply()} style={small}>Voice clarity</button>
        {applied && <button type="button" data-testid="voice-undo" onClick={undo} style={small}>Undo</button>}
        <span style={{ ...hintStyle, margin: 0 }}>Cleaner speech: low-rumble cut, presence boost, even levels. Not AI noise removal.</span>
      </div>
      {advanced && (
        <div data-testid="voice-advanced" style={{ display: 'grid', gap: 4 }}>
          {sliderRow('Low cut', 'voice-highpass', params.highpassHz, 20, 300, 5, (v) => set({ highpassHz: v }), ' Hz')}
          {sliderRow('Presence', 'voice-presence', params.presenceDb, -6, 8, 0.5, (v) => set({ presenceDb: v }), ' dB')}
          {sliderRow('Presence centre', 'voice-presence-hz', params.presenceHz, 1000, 6000, 100, (v) => set({ presenceHz: v }), ' Hz')}
          {sliderRow('Compressor threshold', 'voice-threshold', params.thresholdDb, -50, 0, 1, (v) => set({ thresholdDb: v }), ' dB')}
          {sliderRow('Compressor ratio', 'voice-ratio', params.ratio, 1, 12, 0.5, (v) => set({ ratio: v }), ':1')}
          {sliderRow('Target loudness', 'voice-lufs', params.targetLufs, -24, -10, 1, (v) => set({ targetLufs: v }), ' LUFS')}
        </div>
      )}
      <JobStatus job={job} />
      {note && <p data-testid="voice-note" style={{ ...hintStyle, margin: 0, color: C.text }}>{note}</p>}
    </div>
  )
}

// ───────────────────────── Face-aware zone (A1) ─────────────────────────

/** Protects faces where the browser has a native face detector. Positions only: nobody is identified. */
export function FaceZoneControl({ url }: { url: string }): React.JSX.Element {
  const { previewSettings, setPreviewProtectedZones } = useDemoPersonalize()
  const job = useJob()
  const [note, setNote] = useState<string | null>(null)
  const supported = nativeFaceDetectorAvailable()
  const zones = previewSettings?.protectedZones ?? []
  const find = () => job.run(async (signal, progress) => {
    setNote(null)
    const probe = await probeVideo(url)
    if (!probe) throw new Error('This browser cannot read this video.')
    const boxes: Box[] = []
    const N = 6
    for (let i = 0; i < N; i++) {
      if (signal.aborted) return
      const f = await grabFramePixels(url, (probe.duration * (i + 0.5)) / N, { maxSize: 480, signal })
      const c = document.createElement('canvas'); c.width = f.width; c.height = f.height
      c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(f.data), f.width, f.height), 0, 0)
      for (const b of await detectFaceBoxes(c, f.width, f.height)) boxes.push(coverMapBox(b, f.width, f.height, previewSettings.width, previewSettings.height))
      progress(i + 1, N, `Looking at frame ${i + 1} of ${N}…`)
    }
    const zone = unionFaceZone(boxes)
    const others = (previewSettings.protectedZones ?? []).filter((z) => z.id !== 'auto-faces')
    if (!zone) { setPreviewProtectedZones(others); setNote('No faces were found in the sampled frames, so nothing is protected. You can mark the subject by hand instead.'); return }
    setPreviewProtectedZones([...others, { id: 'auto-faces', label: 'Faces found (estimate)', source: 'user', ...zone }])
    setNote(`Protected the area where faces appear (${boxes.length} found across ${N} frames). Overlays now keep clear of it. Check the layout preview: it is an estimate from sampled frames.`)
  })
  return (
    <div data-testid="face-zone" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <button type="button" data-testid="find-faces" disabled={!supported || job.busy} title={supported ? '' : 'This browser has no built-in face detector'} onClick={() => void find()} style={{ ...small, opacity: supported ? 1 : 0.5 }}>Keep faces clear</button>
      {zones.some((z) => z.id === 'auto-faces') && <button type="button" data-testid="clear-faces" onClick={() => setPreviewProtectedZones(zones.filter((z) => z.id !== 'auto-faces'))} style={small}>Clear faces</button>}
      {!supported && <span style={{ ...hintStyle, margin: 0 }}>Needs a browser with a built-in face detector. Here, use “Find the subject for me” in the layout check (finds people, not faces).</span>}
      <JobStatus job={job} />
      {note && <span data-testid="face-note" style={{ ...hintStyle, margin: 0, color: C.text }}>{note}</span>}
    </div>
  )
}

// ───────────────────────── Protected zones editor (A3) ─────────────────────────

/** Advanced: adjust or add the zones overlays must keep clear of. Locked or hand-placed layers are never moved by it. */
export function ProtectedZonesEditor(): React.JSX.Element {
  const { previewSettings, setPreviewProtectedZones } = useDemoPersonalize()
  const zones = previewSettings?.protectedZones ?? []
  const upd = (id: string, patch: Partial<Box>) => setPreviewProtectedZones(zones.map((z) => (z.id === id ? { ...z, ...patch } : z)))
  const add = () => setPreviewProtectedZones([...zones, { id: `manual-${Date.now().toString(36)}`, label: 'Keep clear', source: 'user', x: 0.35, y: 0.35, w: 0.3, h: 0.3 }])
  return (
    <div data-testid="zones-editor" style={{ ...panelStyle, marginTop: 12 }}>
      <h3 style={h3}>Protected zones</h3>
      <p style={{ ...hintStyle, margin: '0 0 6px' }}>Areas that logos, text and captions keep clear of. Moving a zone re-runs the layout check; layers you placed by hand or locked stay where they are.</p>
      {zones.length === 0 && <p data-testid="zones-empty" style={hintStyle}>No zones yet.</p>}
      {zones.map((z) => (
        <div key={z.id} data-testid="zone-row" style={{ display: 'grid', gap: 3, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <strong style={{ fontSize: 11, color: C.text, flex: 1 }}>{z.label}</strong>
            <button type="button" data-testid="zone-remove" onClick={() => setPreviewProtectedZones(zones.filter((x) => x.id !== z.id))} style={{ ...small, minHeight: 24, fontSize: 10 }}>Remove</button>
          </div>
          {(['x', 'y', 'w', 'h'] as const).map((k) => sliderRow({ x: 'Left', y: 'Top', w: 'Width', h: 'Height' }[k], `zone-${k}`, Math.round(z[k] * 100) / 100, 0, 1, 0.01, (v) => upd(z.id, { [k]: v })))}
        </div>
      ))}
      <button type="button" data-testid="zone-add" onClick={add} style={small}>Add a zone to keep clear</button>
    </div>
  )
}

// ───────────────────────── Built-in browser AI (C1) ─────────────────────────

/** Uses the browser's own on-device language model when it has one. Asks before any download; checks output against your facts. */
export function OnDeviceAI({ facts, onPick }: { facts: Facts; onPick: (field: Field, value: string, layer: Layer) => void }): React.JSX.Element {
  const [status, setStatus] = useState<BuiltInStatus | null>(null)
  const [ask, setAsk] = useState<CopyKind | null>(null)
  const [out, setOut] = useState<{ kind: CopyKind; lines: string[]; rejected: number } | null>(null)
  const job = useJob()
  useEffect(() => { let live = true; void builtInAIStatus().then((s) => { if (live) setStatus(s) }); return () => { live = false } }, [])
  const run = (kind: CopyKind) => {
    setAsk(null); setOut(null)
    void job.run(async (signal, progress) => {
      progress(0, 1, status === 'available' ? 'Writing…' : 'Your browser is preparing its model…')
      const r = await generateCopyOnDevice(kind, facts, { signal, onProgress: (p) => progress(p, 1, 'Your browser is downloading its model…') })
      if (!signal.aborted) { setOut({ kind, ...r }); setStatus('available') }
    })
  }
  const start = (kind: CopyKind) => (status === 'available' ? run(kind) : setAsk(kind))
  if (status === null) return <></>
  if (status === 'unsupported' || status === 'unavailable') return <div data-testid="ondevice-ai" style={hintStyle}>This browser has no built-in on-device AI, so the template suggestions above are used. Nothing is sent to a paid AI service.</div>
  const map: Record<CopyKind, [Field, Layer]> = { headline: ['ctaHeadline', 'headline'], tagline: ['brandDescription', 'tagline'], cta: ['callToAction', 'cta'] }
  return (
    <div data-testid="ondevice-ai" style={{ display: 'grid', gap: 6 }}>
      <div style={{ ...hintStyle, margin: 0 }}>Built-in browser AI (runs on this device):</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['headline', 'tagline', 'cta'] as CopyKind[]).map((k) => <button key={k} type="button" data-testid={`ai-${k}`} disabled={job.busy} onClick={() => start(k)} style={small}>Write {k === 'cta' ? 'calls to action' : `${k}s`}</button>)}
      </div>
      {ask && <div data-testid="ai-consent" style={{ ...hintStyle, color: C.text }}>Your browser may need to download its own language model first (a large one-time download, often 2 GB or more, handled and stored by the browser). Nothing leaves this device. Continue?{' '}
        <button type="button" data-testid="ai-consent-yes" onClick={() => run(ask)} style={{ ...small, minHeight: 26 }}>Continue</button>{' '}<button type="button" onClick={() => setAsk(null)} style={{ ...small, minHeight: 26 }}>Not now</button></div>}
      <JobStatus job={job} />
      {out && <div data-testid="ai-results" style={{ display: 'grid', gap: 4 }}>
        {out.lines.length === 0 && <span style={hintStyle}>Nothing usable came back: every line added a number or claim that is not in your details.</span>}
        {out.lines.map((l) => <button key={l} type="button" data-testid="ai-line" onClick={() => onPick(map[out.kind][0], l, map[out.kind][1])} style={{ ...small, textAlign: 'left', justifyContent: 'flex-start' }}>{l}</button>)}
        {out.rejected > 0 && <span style={hintStyle}>{out.rejected} suggestion{out.rejected === 1 ? ' was' : 's were'} dropped for adding figures or claims that are not in your details.</span>}
        <span style={hintStyle}>Review before using. Written by the browser's AI; nothing is applied until you click.</span>
      </div>}
    </div>
  )
}
