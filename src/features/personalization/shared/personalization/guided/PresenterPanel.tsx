'use client'

/**
 * "Presenter" tools for the overlay editor (Stage 3): show the person in the source video full-frame, in a camera
 * bubble or picture-in-picture, and keep, blur, replace or remove the background behind them.
 *
 * Background changes use PROCESSED footage: the clip is segmented once in this browser (MediaPipe, or MODNet for
 * softer edges), cached, and reused by the preview and the export. Everything is written to `settings.presenter`
 * through `edit` (one undo step, autosaved, rendered by the same composition as the preview and the export).
 */
import { useEffect, useRef, useState } from 'react'
import type { PersonalizationPreviewSettings } from '../preview/types'
import {
  PRESENTER_PRESETS,
  defaultPresenter,
  presenterRenderPlan,
  type BakeOptions,
  type PresenterBackgroundMode,
  type PresenterEngine,
} from '../preview/presenter'
import { resolveMatteUrl } from '../preview/presenterMatteRegistry'
import { applyAutoFraming, applyPresenterPreset, modeNeedsMatte, patchPresenter, removePresenter, setMatte, setVideoAspect } from './presenterEdit'
import { probeVideoAspect } from './probeVideoAspect'
import { BakeError, bakePresenterMatte, findExistingMatte, type BakeProgress, type BakeResult } from './presenterBake'
import { ensureMatteUrl } from './presenterMatteStore'
import { C, chipStyle, hintStyle, inputStyle, labelStyle, softPanelStyle } from './tokens'

export type BakeFn = (sourceUrl: string, options: Partial<BakeOptions>, hooks: { onProgress?: (p: BakeProgress) => void; signal?: AbortSignal }) => Promise<BakeResult>

export interface PresenterPanelProps {
  settings: PersonalizationPreviewSettings
  edit: (fn: (prev: PersonalizationPreviewSettings) => PersonalizationPreviewSettings) => void
  /** The source video the presenter plays. Without one there is nothing to frame. */
  videoUrl: string | null | undefined
  /** Test seam; defaults to the real bake (MediaPipe / MODNet in this browser). */
  bakeFn?: BakeFn
  /** Test seam; defaults to reading the video's metadata in this browser. */
  probeAspect?: (url: string) => Promise<number | undefined>
}

const small = { ...chipStyle(false), minHeight: 28, fontSize: 10 } as const
const row = { display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }

const MODE_LABEL: Record<PresenterBackgroundMode, string> = {
  keep: 'Keep',
  blur: 'Blur',
  color: 'Colour',
  image: 'Picture',
  remove: 'Remove',
}

const DEGRADED_TEXT: Record<string, string> = {
  'no-matte': 'This background needs processed footage. Press “Process footage” below; until then the original background is shown.',
  'stale-matte': 'The processed footage was made from a different video. Process this video again; until then the original background is shown.',
  'matte-unavailable': 'The processed footage is not stored in this browser (cleared or made on another device). Process the video again; until then the original background is shown.',
}

export function describeBakeError(error: unknown): string {
  if (error instanceof BakeError) {
    if (error.code === 'ABORTED') return 'Cancelled.'
    return error.message
  }
  const text = String((error as Error)?.message ?? error ?? '')
  if (/encode|VideoEncoder/i.test(text)) return 'This browser cannot encode video. Use a current Chrome or Edge.'
  if (/HTTP \d+/.test(text)) return `The video could not be loaded (${text.match(/HTTP \d+/)?.[0]}).`
  return text || 'Processing failed.'
}

export function PresenterPanel({ settings, edit, videoUrl, bakeFn, probeAspect }: PresenterPanelProps) {
  const p = settings.presenter
  const [engine, setEngine] = useState<PresenterEngine>(p?.matte?.engine ?? 'mediapipe')
  const [state, setState] = useState<'idle' | 'working' | 'error' | 'done'>('idle')
  const [progress, setProgress] = useState<BakeProgress | null>(null)
  const [message, setMessage] = useState('')
  const [, bump] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  // After a reload the processed footage's URL is gone; restore it from this browser's cache.
  useEffect(() => {
    if (!p?.matte || resolveMatteUrl(p.matte)) return
    let live = true
    void ensureMatteUrl(p.matte).then(() => { if (live) bump((n) => n + 1) })
    return () => { live = false }
  }, [p?.matte?.key])

  // Framing needs the video's real shape (to pan inside the box); read it once from the file's metadata.
  const needsAspect = Boolean(p && videoUrl && !p.videoAspect && !p.matte?.videoAspect)
  useEffect(() => {
    if (!needsAspect || !videoUrl) return
    let live = true
    void (probeAspect ?? probeVideoAspect)(videoUrl).then((a) => { if (live && a) edit((prev) => setVideoAspect(prev, Math.round(a * 10000) / 10000)) })
    return () => { live = false }
  }, [needsAspect, videoUrl])

  const patch = (x: Parameters<typeof patchPresenter>[1]) => edit((prev) => patchPresenter(prev, x))
  const plan = p ? presenterRenderPlan(p, { url: resolveMatteUrl(p.matte), sourceUrl: videoUrl ?? null }) : null
  const matteReady = Boolean(p?.matte && resolveMatteUrl(p.matte) && p.matte.sourceUrl === videoUrl)

  const process = async () => {
    if (!videoUrl) return
    const ac = new AbortController()
    abortRef.current = ac
    setState('working'); setMessage(''); setProgress({ stage: 'prepare', progress: 0 })
    try {
      const run = bakeFn ?? ((u, o, h) => bakePresenterMatte(u, o, h))
      const result = await run(videoUrl, { engine }, { onProgress: setProgress, signal: ac.signal })
      edit((prev) => setMatte(prev, result.matte))
      setState('done')
      setMessage(result.reused ? 'Reused the processed footage already made for this video.' : `Processed ${result.frames} frames.`)
    } catch (error) {
      const cancelled = error instanceof BakeError && error.code === 'ABORTED'
      setState(cancelled ? 'idle' : 'error')
      setMessage(describeBakeError(error))
    } finally {
      abortRef.current = null
    }
  }

  const checkExisting = async () => {
    if (!videoUrl) return
    const found = await findExistingMatte(videoUrl, { engine })
    if (found) { await ensureMatteUrl(found); edit((prev) => setMatte(prev, found)); setMessage('Found processed footage for this video in this browser.') }
    else setMessage('No processed footage for this video yet.')
  }

  if (!videoUrl) {
    return (
      <div style={softPanelStyle} data-testid="presenter-panel">
        <div style={labelStyle}>Presenter</div>
        <p style={hintStyle}>Choose a video first. The presenter tools frame the person in your video.</p>
      </div>
    )
  }

  const pct = progress ? Math.round(progress.progress * 100) : 0

  return (
    <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="presenter-panel">
      <div style={labelStyle}>Presenter</div>

      <div style={row}>
        <select aria-label="Presenter preset" value="" onChange={(e) => { if (e.target.value) edit((prev) => applyPresenterPreset(prev, e.target.value)) }} style={{ ...inputStyle, minHeight: 28, padding: '0 6px' }}>
          <option value="">Preset…</option>
          {PRESENTER_PRESETS.map((pr) => <option key={pr.id} value={pr.id}>{pr.label}{pr.needsMatte ? ' (needs processing)' : ''}</option>)}
        </select>
        {p ? <button type="button" style={small} onClick={() => edit(removePresenter)}>Reset to full video</button> : null}
      </div>

      {!p ? <p style={hintStyle}>The video fills the frame. Pick a preset to place the presenter in a bubble or box, or to change their background.</p> : null}

      {p ? (
        <>
          <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12, color: C.text }}>
            <input type="checkbox" aria-label="Show presenter effects" checked={p.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
            Use presenter effects
          </label>

          <div style={row}>
            <label style={labelStyle} htmlFor="pr-layout">Layout</label>
            <select id="pr-layout" aria-label="Presenter layout" value={p.layout} onChange={(e) => {
              const layout = e.target.value as 'full' | 'bubble' | 'pip'
              const d = defaultPresenter(layout)
              patch({ layout, shape: d.shape, box: d.box, aspect: d.aspect, focus: d.focus, borderWidth: d.borderWidth, shadow: d.shadow })
            }} style={{ ...inputStyle, minHeight: 28, padding: '0 6px' }}>
              <option value="full">Full frame</option>
              <option value="bubble">Camera bubble</option>
              <option value="pip">Picture-in-picture</option>
            </select>
            {p.layout !== 'full' ? (
              <>
                <label style={labelStyle} htmlFor="pr-shape">Shape</label>
                <select id="pr-shape" aria-label="Presenter shape" value={p.shape} onChange={(e) => patch({ shape: e.target.value as 'circle' | 'rounded' | 'rect' })} style={{ ...inputStyle, minHeight: 28, padding: '0 6px' }}>
                  <option value="circle">Circle</option>
                  <option value="rounded">Rounded</option>
                  <option value="rect">Rectangle</option>
                </select>
              </>
            ) : null}
          </div>

          {p.layout !== 'full' ? (
            <div>
              <label style={labelStyle} htmlFor="pr-size">Size {Math.round(p.box.size * 100)}%</label>
              <input id="pr-size" type="range" aria-label="Presenter size" min={10} max={100} step={1} value={Math.round(p.box.size * 100)} onChange={(e) => patch({ box: { size: Number(e.target.value) / 100 } })} style={{ width: '100%', accentColor: C.cyan }} />
              <div style={row}>
                <label style={hintStyle} htmlFor="pr-x">Position</label>
                <input id="pr-x" type="range" aria-label="Presenter left-right" min={0} max={100} step={1} value={Math.round(p.box.x * 100)} onChange={(e) => patch({ box: { x: Number(e.target.value) / 100 } })} style={{ flex: 1, minWidth: 70, accentColor: C.cyan }} />
                <input type="range" aria-label="Presenter top-bottom" min={0} max={100} step={1} value={Math.round(p.box.y * 100)} onChange={(e) => patch({ box: { y: Number(e.target.value) / 100 } })} style={{ flex: 1, minWidth: 70, accentColor: C.cyan }} />
              </div>
              {p.shape !== 'circle' ? (
                <>
                  <label style={labelStyle} htmlFor="pr-aspect">Shape ratio {p.aspect.toFixed(2)}</label>
                  <input id="pr-aspect" type="range" aria-label="Presenter box ratio" min={50} max={250} step={5} value={Math.round(p.aspect * 100)} onChange={(e) => patch({ aspect: Number(e.target.value) / 100 })} style={{ width: '100%', accentColor: C.cyan }} />
                </>
              ) : null}
              {p.shape === 'rounded' ? (
                <>
                  <label style={labelStyle} htmlFor="pr-radius">Corner roundness {Math.round(p.radius * 100)}%</label>
                  <input id="pr-radius" type="range" aria-label="Presenter corner roundness" min={0} max={50} step={1} value={Math.round(p.radius * 100)} onChange={(e) => patch({ radius: Number(e.target.value) / 100 })} style={{ width: '100%', accentColor: C.cyan }} />
                </>
              ) : null}
              <div style={row}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.text }}>
                  <input type="checkbox" aria-label="Presenter border" checked={p.borderWidth > 0} onChange={(e) => patch({ borderWidth: e.target.checked ? 0.012 : 0 })} /> Border
                </label>
                {p.borderWidth > 0 ? <input type="color" aria-label="Presenter border colour" value={p.borderColor.length === 7 ? p.borderColor : '#ffffff'} onChange={(e) => patch({ borderColor: e.target.value })} /> : null}
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.text }}>
                  <input type="checkbox" aria-label="Presenter shadow" checked={p.shadow} onChange={(e) => patch({ shadow: e.target.checked })} /> Shadow
                </label>
              </div>
            </div>
          ) : null}

          <div>
            <label style={labelStyle} htmlFor="pr-zoom">Zoom {p.focus.zoom.toFixed(2)}×</label>
            <input id="pr-zoom" type="range" aria-label="Presenter zoom" min={100} max={400} step={5} value={Math.round(p.focus.zoom * 100)} onChange={(e) => patch({ focus: { zoom: Number(e.target.value) / 100 } })} style={{ width: '100%', accentColor: C.cyan }} />
            <div style={row}>
              <label style={hintStyle} htmlFor="pr-fx">Zoom centre</label>
              <input id="pr-fx" type="range" aria-label="Presenter zoom centre left-right" min={0} max={100} step={1} value={Math.round(p.focus.x * 100)} onChange={(e) => patch({ focus: { x: Number(e.target.value) / 100 } })} style={{ flex: 1, minWidth: 70, accentColor: C.cyan }} />
              <input type="range" aria-label="Presenter zoom centre top-bottom" min={0} max={100} step={1} value={Math.round(p.focus.y * 100)} onChange={(e) => patch({ focus: { y: Number(e.target.value) / 100 } })} style={{ flex: 1, minWidth: 70, accentColor: C.cyan }} />
            </div>
            <div style={row}>
              <button type="button" style={small} disabled={!p.matte?.bounds} title={p.matte?.bounds ? '' : 'Process the footage first: framing uses where the person is'} onClick={() => edit(applyAutoFraming)}>Frame head and shoulders</button>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.text }}>
                <input type="checkbox" aria-label="Mirror presenter" checked={p.mirror} onChange={(e) => patch({ mirror: e.target.checked })} /> Mirror
              </label>
            </div>
          </div>

          <div>
            <div style={labelStyle}>Background behind the person</div>
            <div style={row} role="radiogroup" aria-label="Presenter background">
              {(Object.keys(MODE_LABEL) as PresenterBackgroundMode[]).map((mode) => (
                <button key={mode} type="button" role="radio" aria-checked={p.background.mode === mode} aria-label={`Background: ${MODE_LABEL[mode]}`} style={{ ...small, ...(p.background.mode === mode ? { borderColor: C.cyanBorder } : {}) }} onClick={() => patch({ background: { mode } })}>
                  {MODE_LABEL[mode]}
                </button>
              ))}
            </div>
            {p.background.mode === 'blur' ? (
              <>
                <label style={labelStyle} htmlFor="pr-blur">Blur {Math.round(p.background.blur)}</label>
                <input id="pr-blur" type="range" aria-label="Background blur" min={0} max={40} step={1} value={p.background.blur} onChange={(e) => patch({ background: { blur: Number(e.target.value) } })} style={{ width: '100%', accentColor: C.cyan }} />
              </>
            ) : null}
            {p.background.mode === 'color' ? <input type="color" aria-label="Background colour" value={p.background.color.length === 7 ? p.background.color : '#0f172a'} onChange={(e) => patch({ background: { color: e.target.value } })} /> : null}
            {p.background.mode === 'image' ? (
              <input type="url" aria-label="Background picture address" placeholder="https://…/picture.jpg" defaultValue={p.background.imageUrl} onBlur={(e) => patch({ background: { imageUrl: e.target.value.trim() } })} style={{ ...inputStyle, minHeight: 28, padding: '0 6px', width: '100%' }} />
            ) : null}
            {p.background.mode === 'remove' ? <p style={hintStyle}>The person is shown on a transparent background: whatever is behind them (the website or backdrop) shows through.</p> : null}
          </div>

          {plan?.degradedReason && modeNeedsMatte(p.background.mode) ? (
            <p role="status" data-testid="presenter-degraded" style={{ ...hintStyle, color: C.text }}>{DEGRADED_TEXT[plan.degradedReason]}</p>
          ) : null}

          <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={labelStyle}>Processed footage</div>
            <div style={row}>
              <label style={hintStyle} htmlFor="pr-engine">Method</label>
              <select id="pr-engine" aria-label="Processing method" value={engine} onChange={(e) => setEngine(e.target.value as PresenterEngine)} disabled={state === 'working'} style={{ ...inputStyle, minHeight: 28, padding: '0 6px' }}>
                <option value="mediapipe">Fast (MediaPipe)</option>
                <option value="modnet">Close-up portrait (MODNet: slower, larger download, head-and-shoulders only)</option>
              </select>
            </div>
            <div style={row}>
              {state === 'working' ? (
                <button type="button" style={small} onClick={() => abortRef.current?.abort()}>Cancel</button>
              ) : (
                <button type="button" style={small} onClick={process}>{matteReady ? 'Process again' : 'Process footage'}</button>
              )}
              {!matteReady && state !== 'working' ? <button type="button" style={small} onClick={checkExisting}>Use existing</button> : null}
            </div>
            {state === 'working' ? <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={hintStyle}>{progress?.stage === 'prepare' ? 'Starting' : 'Processing'}… {pct}%{progress?.etaSec ? ` (about ${Math.ceil(progress.etaSec)}s left)` : ''}</div> : null}
            {matteReady && state !== 'working' ? <div data-testid="presenter-matte-ready" style={hintStyle}>Processed with {p.matte?.engine === 'modnet' ? 'MODNet' : 'MediaPipe'}. Stored in this browser only; it is reused for the preview and the export.</div> : null}
            {message ? <div role={state === 'error' ? 'alert' : 'status'} data-testid="presenter-message" style={hintStyle}>{message}</div> : null}
            <p style={hintStyle}>Works best on a person facing the camera. Moving hands near the edge of the frame or busy backgrounds can leave soft or rough edges; check the preview before exporting.</p>
          </div>
        </>
      ) : null}
    </div>
  )
}
