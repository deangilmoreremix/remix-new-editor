'use client'

/**
 * "Captions" tools for the overlay editor (Stage 6): import SRT/VTT, transcribe the video's speech in the browser (Whisper),
 * edit the cues, check them for problems, style them (word highlight, position, size, colours), export SRT/VTT, check the
 * source video's codec, and find scene cuts with a filmstrip. Everything is written to `settings.captions` through `edit`
 * and drawn by the shared composition, so the Player and the export show the same captions.
 */
import { useRef, useState } from 'react'
import type { PersonalizationPreviewSettings } from '../preview/types'
import {
  CAPTION_PRESETS, DEFAULT_SCENE_PARAMS, addCue, captionProblems, cuesToSrt, cuesToVtt, deleteCue, mergeCues, shiftCues, splitCue, updateCue, type CaptionCue,
} from '../preview/captions'
import { applyCaptionPreset, clearCaptions, importCaptionFile, patchCaptionStyle, setCaptionsEnabled, setCues } from './captionsEdit'
import { probeVideo, scanScenes, type SceneScan, type VideoFacts, type TranscribeResult } from './videoProbe'
import { C, chipStyle, hintStyle, inputStyle, labelStyle, softPanelStyle } from './tokens'

export interface CaptionsPanelProps {
  settings: PersonalizationPreviewSettings
  edit: (fn: (prev: PersonalizationPreviewSettings) => PersonalizationPreviewSettings) => void
  videoUrl: string | null | undefined
  /** Test seams; default to the real Whisper worker, mediabunny probe/scan and a browser download. */
  transcribeFn?: (url: string, hooks: { onProgress?: (p: { stage: string; progress: number }) => void; signal?: AbortSignal }) => Promise<TranscribeResult>
  probeFn?: (url: string) => Promise<VideoFacts>
  scanFn?: (url: string) => Promise<SceneScan>
  downloadFn?: (fileName: string, text: string, mime: string) => void
}

const small = { ...chipStyle(false), minHeight: 28, fontSize: 10 } as const
const row = { display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }
const MAX_ROWS = 200

export function browserDownload(fileName: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a'); a.href = url; a.download = fileName; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

async function defaultTranscribe(url: string, hooks: { onProgress?: (p: { stage: string; progress: number }) => void; signal?: AbortSignal }): Promise<TranscribeResult> {
  const mod = await import('../../../../../lib/editor/remotion/transcribe.js')
  const run = mod.transcribeInBrowser as unknown as (u: string, o: Record<string, unknown>) => Promise<{ captions: unknown; text: string }>
  const r = await run(url, { onProgress: hooks.onProgress, signal: hooks.signal })
  const cues = (r.captions as Array<{ text: string; startMs: number; endMs: number }>).map((c) => ({ text: c.text.trim(), startMs: c.startMs, endMs: c.endMs })).filter((c) => c.text)
  return { cues, text: r.text }
}

export function describeTranscribeError(e: unknown): string {
  const m = String((e as Error)?.message ?? e ?? '')
  if (/no audio track/i.test(m) || /no audio to transcribe/i.test(m)) return 'This video has no audio the browser can read, so there is nothing to transcribe.'
  if (/HTTP \d+/.test(m)) return `The video could not be loaded (${m.match(/HTTP \d+/)?.[0]}).`
  if (/cancel/i.test(m)) return 'Cancelled.'
  return m || 'Transcription failed.'
}

export function CaptionsPanel({ settings, edit, videoUrl, transcribeFn, probeFn, scanFn, downloadFn }: CaptionsPanelProps) {
  const track = settings.captions
  const fps = Math.max(1, settings.fps)
  const videoMs = (Math.max(1, settings.durationInFrames) / fps) * 1000
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle')
  const [progress, setProgress] = useState('')
  const [message, setMessage] = useState('')
  const [facts, setFacts] = useState<VideoFacts | null>(null)
  const [scan, setScan] = useState<SceneScan | null>(null)
  const [scanning, setScanning] = useState(false)
  const [shiftSec, setShiftSec] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const sec = (ms: number) => Math.round(ms) / 1000
  const cues = track?.cues ?? []
  const problems = captionProblems(cues, videoMs)
  const problemAt = (i: number) => problems.filter((p) => p.index === i)

  const transcribe = async () => {
    if (!videoUrl) return
    const ac = new AbortController(); abortRef.current = ac
    setState('working'); setMessage(''); setProgress('Starting…')
    try {
      const r = await (transcribeFn ?? defaultTranscribe)(videoUrl, { onProgress: (p) => setProgress(`${p.stage === 'download' ? 'Downloading the speech model' : p.stage === 'decode' ? 'Reading the audio' : 'Listening'}… ${Math.round((p.progress ?? 0) * 100)}%`), signal: ac.signal })
      if (!r.cues.length) { setState('error'); setMessage('No speech was found, so no captions were made.'); return }
      edit((prev) => setCues(prev, r.cues, 'transcribed'))
      setState('idle'); setMessage(`Transcribed ${r.cues.length} words. Check them below: speech recognition can be wrong.`)
    } catch (e) {
      const cancelled = /cancel/i.test(String((e as Error)?.message)) || (e as Error)?.name === 'AbortError'
      setState(cancelled ? 'idle' : 'error'); setMessage(describeTranscribeError(e))
    } finally { abortRef.current = null; setProgress('') }
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const text = typeof file.text === 'function' ? await file.text() : await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result ?? '')); r.onerror = () => rej(r.error); r.readAsText(file) })
    const r = importCaptionFile(settings, text, file.name)
    if (!r.ok) { setState('error'); setMessage(r.error); return }
    edit((prev) => { const x = importCaptionFile(prev, text, file.name); return x.ok ? x.settings : prev })
    setState('idle'); setMessage(`Imported ${r.count} subtitles from the ${r.format.toUpperCase()} file.`)
  }

  const check = async () => {
    if (!videoUrl) return
    setMessage('')
    try { setFacts(await (probeFn ?? probeVideo)(videoUrl)) } catch (e) { setState('error'); setMessage(String((e as Error)?.message ?? e)) }
  }
  const findScenes = async () => {
    if (!videoUrl) return
    setScanning(true); setMessage('')
    try { setScan(await (scanFn ?? ((u: string) => scanScenes(u, { params: DEFAULT_SCENE_PARAMS })))(videoUrl)) } catch (e) { setState('error'); setMessage(String((e as Error)?.message ?? e)) } finally { setScanning(false) }
  }

  const exportFile = (kind: 'srt' | 'vtt') => {
    if (!track || !cues.length) return
    const text = kind === 'srt' ? cuesToSrt(cues, track.style) : cuesToVtt(cues, track.style)
    ;(downloadFn ?? browserDownload)(`captions.${kind}`, text, kind === 'srt' ? 'application/x-subrip' : 'text/vtt')
  }

  const slider = (id: string, label: string, value: number, min: number, max: number, step: number, set: (v: number) => void, suffix = '') => (
    <div>
      <label style={labelStyle} htmlFor={id}>{label} {value}{suffix}</label>
      <input id={id} type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} style={{ width: '100%', accentColor: C.cyan }} />
    </div>
  )
  const setStyle = (p: Parameters<typeof patchCaptionStyle>[1]) => edit((prev) => patchCaptionStyle(prev, p))
  const setCueList = (fn: (c: CaptionCue[]) => CaptionCue[]) => edit((prev) => setCues(prev, fn(prev.captions?.cues ?? [])))

  return (
    <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="captions-panel">
      <div style={labelStyle}>Captions</div>

      <div style={row}>
        <label style={{ ...small, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
          Import SRT / VTT
          <input type="file" aria-label="Import subtitle file" accept=".srt,.vtt,text/vtt,application/x-subrip" style={{ display: 'none' }} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        {state === 'working' ? <button type="button" style={small} onClick={() => abortRef.current?.abort()}>Cancel</button> : <button type="button" style={small} disabled={!videoUrl} onClick={transcribe}>Transcribe the speech</button>}
        <button type="button" style={small} onClick={() => edit((prev) => setCues(prev, addCue(prev.captions?.cues ?? [], 0), 'typed'))}>Add a caption</button>
        {track ? <button type="button" style={small} onClick={() => edit(clearCaptions)}>Remove captions</button> : null}
      </div>
      {progress ? <div role="progressbar" style={hintStyle}>{progress}</div> : null}
      {message ? <div role={state === 'error' ? 'alert' : 'status'} data-testid="captions-message" style={hintStyle}>{message}</div> : null}
      {!track ? <p style={hintStyle}>No captions yet. Import a subtitle file, transcribe the video's speech in this browser (the model downloads once, about 40–80 MB), or add captions by hand.</p> : null}

      {track ? (
        <>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.text }}>
            <input type="checkbox" aria-label="Show captions" checked={track.enabled} onChange={(e) => edit((prev) => setCaptionsEnabled(prev, e.target.checked))} /> Show captions in the video
          </label>

          <div>
            <div style={labelStyle}>Look</div>
            <div style={row}>
              <select aria-label="Caption style preset" value={track.style.preset} onChange={(e) => edit((prev) => applyCaptionPreset(prev, e.target.value))} style={{ ...inputStyle, minHeight: 28, padding: '0 6px' }}>
                {Object.entries(CAPTION_PRESETS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
              </select>
              <select aria-label="Caption position" value={track.style.position} onChange={(e) => setStyle({ position: e.target.value as 'top' | 'middle' | 'bottom' })} style={{ ...inputStyle, minHeight: 28, padding: '0 6px' }}>
                <option value="bottom">Bottom</option><option value="middle">Middle</option><option value="top">Top</option>
              </select>
              <select aria-label="Word highlight" value={track.style.highlight} onChange={(e) => setStyle({ highlight: e.target.value as 'none' | 'active' | 'karaoke' })} style={{ ...inputStyle, minHeight: 28, padding: '0 6px' }}>
                <option value="none">No highlight</option><option value="active">Highlight the spoken word</option><option value="karaoke">Fill as spoken</option>
              </select>
            </div>
            {slider('cp-size', 'Text size', track.style.fontSize, 2, 14, 0.2, (v) => setStyle({ fontSize: v }), '%')}
            {slider('cp-group', 'Words shown together (time window)', track.style.combineMs, 200, 4000, 100, (v) => setStyle({ combineMs: v }), ' ms')}
            <div style={row}>
              <label style={hintStyle}>Text <input type="color" aria-label="Caption colour" value={/^#[0-9a-f]{6}$/i.test(track.style.color) ? track.style.color : '#ffffff'} onChange={(e) => setStyle({ color: e.target.value })} /></label>
              <label style={hintStyle}>Highlight <input type="color" aria-label="Caption highlight colour" value={/^#[0-9a-f]{6}$/i.test(track.style.highlightColor) ? track.style.highlightColor : '#ffe14d'} onChange={(e) => setStyle({ highlightColor: e.target.value })} /></label>
              <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12, color: C.text }}><input type="checkbox" aria-label="Capital letters" checked={track.style.uppercase} onChange={(e) => setStyle({ uppercase: e.target.checked })} /> CAPS</label>
              <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12, color: C.text }}><input type="checkbox" aria-label="Caption outline" checked={track.style.stroke} onChange={(e) => setStyle({ stroke: e.target.checked })} /> Outline</label>
              <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12, color: C.text }}><input type="checkbox" aria-label="Caption box" checked={track.style.background} onChange={(e) => setStyle({ background: e.target.checked })} /> Box</label>
            </div>
          </div>

          <div>
            <div style={labelStyle}>Cues ({cues.length}){problems.length ? ` · ${problems.length} to check` : ''}</div>
            <div style={row}>
              <label style={hintStyle} htmlFor="cp-shift">Move all by</label>
              <input id="cp-shift" type="number" aria-label="Shift all captions (seconds)" step={0.1} value={shiftSec} onChange={(e) => setShiftSec(Number(e.target.value))} style={{ ...inputStyle, width: 70, minHeight: 28, padding: '0 6px' }} />
              <button type="button" style={small} onClick={() => { setCueList((c) => shiftCues(c, Math.round(shiftSec * 1000))); setShiftSec(0) }}>Shift</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflow: 'auto', marginTop: 6 }}>
              {cues.slice(0, MAX_ROWS).map((c, i) => (
                <div key={i} data-testid="caption-row" style={{ display: 'flex', flexDirection: 'column', gap: 2, borderBottom: `1px solid ${C.border}`, paddingBottom: 4 }}>
                  <div style={row}>
                    <input type="number" aria-label={`Cue ${i + 1} start (s)`} step={0.1} min={0} value={sec(c.startMs)} onChange={(e) => setCueList((l) => updateCue(l, i, { startMs: Math.round(Number(e.target.value) * 1000) }))} style={{ ...inputStyle, width: 64, minHeight: 26, padding: '0 4px' }} />
                    <input type="number" aria-label={`Cue ${i + 1} end (s)`} step={0.1} min={0} value={sec(c.endMs)} onChange={(e) => setCueList((l) => updateCue(l, i, { endMs: Math.round(Number(e.target.value) * 1000) }))} style={{ ...inputStyle, width: 64, minHeight: 26, padding: '0 4px' }} />
                    <button type="button" aria-label={`Split cue ${i + 1}`} style={small} onClick={() => setCueList((l) => splitCue(l, i))}>Split</button>
                    <button type="button" aria-label={`Merge cue ${i + 1} with the next`} style={small} onClick={() => setCueList((l) => mergeCues(l, i))}>Merge</button>
                    <button type="button" aria-label={`Delete cue ${i + 1}`} style={small} onClick={() => setCueList((l) => deleteCue(l, i))}>Delete</button>
                  </div>
                  <input type="text" aria-label={`Cue ${i + 1} text`} value={c.text} onChange={(e) => setCueList((l) => updateCue(l, i, { text: e.target.value }))} style={{ ...inputStyle, minHeight: 26, padding: '0 6px', width: '100%' }} />
                  {problemAt(i).map((p) => <div key={p.kind} role="note" data-testid="caption-problem" style={{ ...hintStyle, color: C.text }}>⚠ {p.message}</div>)}
                </div>
              ))}
              {cues.length > MAX_ROWS ? <p style={hintStyle}>Showing the first {MAX_ROWS} of {cues.length} cues.</p> : null}
            </div>
          </div>

          <div style={row}>
            <button type="button" style={small} disabled={!cues.length} onClick={() => exportFile('srt')}>Download SRT</button>
            <button type="button" style={small} disabled={!cues.length} onClick={() => exportFile('vtt')}>Download VTT</button>
          </div>
        </>
      ) : null}

      <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={labelStyle}>Video checks</div>
        <div style={row}>
          <button type="button" style={small} disabled={!videoUrl} onClick={check}>Check the video format</button>
          <button type="button" style={small} disabled={!videoUrl || scanning} onClick={findScenes}>{scanning ? 'Finding scenes…' : 'Find scene changes'}</button>
        </div>
        {facts ? <div role={facts.advice.level === 'ok' ? 'status' : 'alert'} data-testid="video-facts" style={hintStyle}>{facts.width}×{facts.height}, {facts.durationSec.toFixed(1)} s, {facts.advice.family}. {facts.advice.message}</div> : null}
        {scan ? (
          <div data-testid="scene-strip">
            <div style={hintStyle}>{scan.scenes.length} scene{scan.scenes.length === 1 ? '' : 's'} found. Click one to start a caption there.</div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {scan.scenes.map((s, i) => (
                <button key={i} type="button" aria-label={`Scene ${i + 1} at ${s.startSec.toFixed(1)} seconds`} data-testid="scene-thumb" onClick={() => edit((prev) => setCues(prev, addCue(prev.captions?.cues ?? [], Math.round(s.startSec * 1000), Math.min(2500, Math.max(500, Math.round((s.endSec - s.startSec) * 1000)))), 'typed'))} style={{ ...small, flex: '0 0 auto', padding: 2, minHeight: 0 }}>
                  {s.thumb ? <img src={s.thumb} alt="" style={{ display: 'block', width: 96, height: 54, objectFit: 'cover', borderRadius: 4 }} /> : <span style={{ display: 'block', width: 96, height: 54 }} />}
                  <span style={{ ...hintStyle, display: 'block' }}>{s.startSec.toFixed(1)}s</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
