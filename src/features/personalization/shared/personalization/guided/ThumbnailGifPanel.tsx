'use client'

/**
 * "Thumbnail and GIF" tools for the overlay editor (Stage 7). Both are drawn from the SAME composition as the video, so they carry
 * the recipient's name, the website, the presenter, the captions and the effects. The thumbnail is chosen automatically (the
 * best-looking frame) or by hand; the GIF is rendered frame by frame and encoded in this browser, with its size shown against
 * what email can reasonably carry. Nothing is uploaded.
 */
import { useEffect, useRef, useState } from 'react'
import type { PreviewInputProps } from '../preview/types'
import { DEFAULT_GIF, DEFAULT_THUMBNAIL, GIF_MAX_FPS, GIF_MAX_SECONDS, GIF_MAX_W, GIF_MIN_FPS, GIF_MIN_W, THUMB_MAX_W, THUMB_MIN_W, fitWidth, gifPlan, gifSizeAdvice } from '../preview/stills'
import { StillError, createWebStillDeps, makeGif, makeThumbnail, type GifResult, type StillDeps, type ThumbnailResult } from './renderStills'
import { patchGif, patchThumbnail } from './stillsEdit'
import { C, chipStyle, hintStyle, labelStyle, softPanelStyle } from './tokens'

export interface ThumbnailGifPanelProps {
  inputProps: PreviewInputProps
  edit: (fn: (prev: PreviewInputProps['settings']) => PreviewInputProps['settings']) => void
  /** Test seams. */
  depsFn?: (inputProps: PreviewInputProps) => Promise<StillDeps>
  downloadFn?: (fileName: string, blob: Blob) => void
}

const small = { ...chipStyle(false), minHeight: 28, fontSize: 10 } as const
const row = { display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }

export function browserDownloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = fileName; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function describeStillError(e: unknown): string {
  if (e instanceof StillError) return e.code === 'ABORTED' ? 'Cancelled.' : e.message
  return String((e as Error)?.message ?? e ?? 'Something went wrong.')
}

export function ThumbnailGifPanel({ inputProps, edit, depsFn, downloadFn }: ThumbnailGifPanelProps) {
  const s = inputProps.settings
  const thumb = s.thumbnail ?? DEFAULT_THUMBNAIL
  const gif = s.gif ?? DEFAULT_GIF
  const totalFrames = Math.max(1, Math.round(s.durationInFrames))
  const fps = Math.max(1, s.fps)
  const plan = gifPlan(gif, fps, totalFrames)
  const gifSize = fitWidth(s.width, s.height, gif.width)
  const [busy, setBusy] = useState<null | 'thumb' | 'gif'>(null)
  const [progress, setProgress] = useState<{ p: number; label: string } | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [tResult, setTResult] = useState<(ThumbnailResult & { url: string }) | null>(null)
  const [gResult, setGResult] = useState<(GifResult & { url: string }) | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const urls = useRef<string[]>([])
  useEffect(() => () => { for (const u of urls.current) { try { URL.revokeObjectURL(u) } catch { /* ignore */ } } }, [])
  const keep = (blob: Blob) => { const u = URL.createObjectURL(blob); urls.current.push(u); return u }
  const dl = downloadFn ?? browserDownloadBlob

  const run = async (kind: 'thumb' | 'gif') => {
    const ac = new AbortController(); abortRef.current = ac
    setBusy(kind); setMessage(''); setError(false); setProgress({ p: 0, label: 'Starting' })
    try {
      const deps = await (depsFn ?? createWebStillDeps)(inputProps)
      const onProgress = (p: number, label: string) => setProgress({ p, label })
      if (kind === 'thumb') { const r = await makeThumbnail(inputProps, deps, { signal: ac.signal, onProgress }); setTResult({ ...r, url: keep(r.blob) }); setMessage(r.auto ? `Chose frame ${r.frame} (${(r.frame / fps).toFixed(1)} s) as the best-looking one.` : `Used frame ${r.frame} (${(r.frame / fps).toFixed(1)} s).`) }
      else { const r = await makeGif(inputProps, deps, { signal: ac.signal, onProgress }); setGResult({ ...r, url: keep(r.blob) }); setMessage('') }
    } catch (e) {
      const cancelled = e instanceof StillError && e.code === 'ABORTED'
      setError(!cancelled); setMessage(describeStillError(e))
    } finally { abortRef.current = null; setBusy(null); setProgress(null) }
  }

  const slider = (id: string, label: string, value: number, min: number, max: number, step: number, set: (v: number) => void, suffix = '') => (
    <div>
      <label style={labelStyle} htmlFor={id}>{label} {value}{suffix}</label>
      <input id={id} type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} style={{ width: '100%', accentColor: C.cyan }} />
    </div>
  )
  const advice = gResult ? gifSizeAdvice(gResult.bytes) : null

  return (
    <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="thumbnail-gif-panel">
      <div style={labelStyle}>Thumbnail and GIF</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={labelStyle}>Thumbnail</div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.text }}>
          <input type="checkbox" aria-label="Choose the thumbnail frame automatically" checked={thumb.frame === null} onChange={(e) => edit((p) => patchThumbnail(p, { frame: e.target.checked ? null : Math.min(totalFrames - 1, Math.round(totalFrames / 3)) }))} /> Pick the best-looking frame for me
        </label>
        {thumb.frame !== null ? slider('th-frame', 'Frame at', Math.round((thumb.frame / fps) * 10) / 10, 0, Math.max(0.1, Math.round(((totalFrames - 1) / fps) * 10) / 10), 0.1, (v) => edit((p) => patchThumbnail(p, { frame: Math.round(v * fps) })), ' s') : null}
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.text }}>
          <input type="checkbox" aria-label="Draw a play button on the thumbnail" checked={thumb.playButton} onChange={(e) => edit((p) => patchThumbnail(p, { playButton: e.target.checked }))} /> Play button
        </label>
        {slider('th-width', 'Thumbnail width', thumb.width, THUMB_MIN_W, THUMB_MAX_W, 10, (v) => edit((p) => patchThumbnail(p, { width: v })), ' px')}
        <div style={row}>
          {busy === 'thumb' ? <button type="button" style={small} onClick={() => abortRef.current?.abort()}>Cancel</button> : <button type="button" style={small} disabled={busy !== null} onClick={() => run('thumb')}>Create thumbnail</button>}
          {tResult ? <><button type="button" style={small} onClick={() => dl('thumbnail.jpg', tResult.blob)}>Download JPG</button></> : null}
        </div>
        {tResult ? <div data-testid="thumb-result"><img alt="Thumbnail preview" src={tResult.url} style={{ maxWidth: '100%', borderRadius: 6, border: `1px solid ${C.border}` }} /><div style={hintStyle}>{tResult.width}×{tResult.height}, {(tResult.bytes / 1024).toFixed(0)} KB{tResult.auto ? `, frame ${tResult.frame} chosen from ${tResult.scores.length} candidates` : ''}</div></div> : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={labelStyle}>Animated GIF</div>
        {slider('gif-start', 'Start at', gif.startSec, 0, Math.max(0, Math.round((totalFrames / fps) * 10) / 10 - 0.5), 0.1, (v) => edit((p) => patchGif(p, { startSec: v })), ' s')}
        {slider('gif-dur', 'Length', gif.durationSec, 0.5, GIF_MAX_SECONDS, 0.5, (v) => edit((p) => patchGif(p, { durationSec: v })), ' s')}
        {slider('gif-fps', 'Frames per second', gif.fps, GIF_MIN_FPS, GIF_MAX_FPS, 1, (v) => edit((p) => patchGif(p, { fps: v })))}
        {slider('gif-width', 'GIF width', gif.width, GIF_MIN_W, GIF_MAX_W, 10, (v) => edit((p) => patchGif(p, { width: v })), ' px')}
        <div style={row}>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12, color: C.text }}><input type="checkbox" aria-label="Smooth colour gradients (dither)" checked={gif.dither} onChange={(e) => edit((p) => patchGif(p, { dither: e.target.checked }))} /> Smooth gradients</label>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12, color: C.text }}><input type="checkbox" aria-label="Loop the GIF" checked={gif.loop} onChange={(e) => edit((p) => patchGif(p, { loop: e.target.checked }))} /> Loop</label>
        </div>
        <p data-testid="gif-plan" style={hintStyle}>{plan.frames.length} frames at {plan.actualFps} per second, {gifSize.w}×{gifSize.h}{plan.truncated ? ' (the video ends before the length you chose)' : ''}.</p>
        <div style={row}>
          {busy === 'gif' ? <button type="button" style={small} onClick={() => abortRef.current?.abort()}>Cancel</button> : <button type="button" style={small} disabled={busy !== null} onClick={() => run('gif')}>Create GIF</button>}
          {gResult ? <button type="button" style={small} onClick={() => dl('video.gif', gResult.blob)}>Download GIF</button> : null}
        </div>
        {gResult ? (
          <div data-testid="gif-result">
            <img alt="GIF preview" src={gResult.url} style={{ maxWidth: '100%', borderRadius: 6, border: `1px solid ${C.border}` }} />
            <div style={hintStyle}>{gResult.width}×{gResult.height}, {gResult.stats.frames} frames{gResult.stats.mergedFrames ? ` (${gResult.stats.mergedFrames} identical merged)` : ''}, {gResult.stats.colors} colours{gResult.stats.exactColors ? ' (exact)' : ''}</div>
            {advice ? <div role={advice.level === 'ok' ? 'status' : 'alert'} data-testid="gif-advice" style={hintStyle}>{advice.message}</div> : null}
            <p style={hintStyle}>Some email apps (for example Outlook on Windows) show only the first frame of a GIF, so the first frame is the one that has to work on its own.</p>
          </div>
        ) : null}
      </div>

      {progress ? <div role="progressbar" aria-valuenow={Math.round(progress.p * 100)} style={hintStyle}>{progress.label}… {Math.round(progress.p * 100)}%</div> : null}
      {message ? <div role={error ? 'alert' : 'status'} data-testid="stills-message" style={hintStyle}>{message}</div> : null}
    </div>
  )
}
