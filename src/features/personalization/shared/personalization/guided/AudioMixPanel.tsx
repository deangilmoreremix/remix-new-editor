'use client'

/**
 * "Audio mix" tools for the overlay editor (Stage 4): voice level, EQ and loudness, music level, fades, ducking under the
 * voice, final loudness and peak ceiling, with measurements of the actual sources (loudness, quiet gaps, tempo).
 *
 * Pressing "Apply audio mix" renders the mix once into a stereo mixdown that the preview and the export both play. If a
 * setting changes afterwards the panel says the mix is out of date; an export re-renders it automatically first.
 */
import { useEffect, useRef, useState } from 'react'
import type { PersonalizationPreviewSettings } from '../preview/types'
import { EQ_PRESETS, audioPlan, defaultAudioMix, normalizeAudioMix, type AudioMix } from '../preview/audioMix'
import { nearestBeat } from '../preview/audioDsp'
import { resolveMatteUrl } from '../preview/presenterMatteRegistry'
import { MixError, bakeAudioMix, type MixBakeResult } from './audioMixdown'
import { analyzeAudioSources, type AudioAnalysis } from './audioAnalysis'
import { ensureMatteUrl } from './presenterMatteStore'
import { C, chipStyle, hintStyle, inputStyle, labelStyle, softPanelStyle } from './tokens'

export type MixBakeFn = (voiceUrl: string | null, musicUrl: string | null, mix: AudioMix, durationSec: number, hooks: { signal?: AbortSignal }) => Promise<MixBakeResult>
export type AnalyzeFn = (voiceUrl: string | null, musicUrl: string | null, signal?: AbortSignal) => Promise<AudioAnalysis>

export interface AudioMixPanelProps {
  settings: PersonalizationPreviewSettings
  edit: (fn: (prev: PersonalizationPreviewSettings) => PersonalizationPreviewSettings) => void
  /** The source video (its audio is the voice). */
  videoUrl: string | null | undefined
  isImageSource?: boolean
  /** The selected music track. */
  musicUrl: string | null | undefined
  /** Test seams; default to the real baker and analysers. */
  bakeFn?: MixBakeFn
  analyzeFn?: AnalyzeFn
}

const small = { ...chipStyle(false), minHeight: 28, fontSize: 10 } as const
const row = { display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }
const fmt = (v: number | null | undefined, unit = '') => (v == null ? '—' : `${v}${unit}`)

type Patch = (mix: AudioMix) => AudioMix

export function describeMixError(error: unknown): string {
  if (error instanceof MixError) return error.code === 'ABORTED' ? 'Cancelled.' : error.message
  return String((error as Error)?.message ?? error ?? 'The audio mix failed.')
}

export function AudioMixPanel({ settings, edit, videoUrl, isImageSource, musicUrl, bakeFn, analyzeFn }: AudioMixPanelProps) {
  const mix = settings.audioMix
  const voiceUrl = isImageSource ? null : videoUrl ?? null
  const music = musicUrl ?? null
  const fps = Math.max(1, settings.fps)
  const durationSec = Math.max(1, settings.durationInFrames) / fps
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [, bump] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  // After a reload the mixdown's URL is gone; restore it from the local store.
  useEffect(() => {
    const key = mix?.mixdown?.key
    if (!key || resolveMatteUrl({ key })) return
    let live = true
    void ensureMatteUrl({ key }).then(() => { if (live) bump((n) => n + 1) })
    return () => { live = false }
  }, [mix?.mixdown?.key])

  const patch = (fn: Patch) => edit((prev) => {
    const base = prev.audioMix ?? defaultAudioMix()
    const next = normalizeAudioMix(fn(JSON.parse(JSON.stringify(base)) as AudioMix))
    return next ? { ...prev, audioMix: next } : prev
  })

  const plan = audioPlan(mix, voiceUrl, music, durationSec, mix?.mixdown ? resolveMatteUrl({ key: mix.mixdown.key }) : null)

  const apply = async () => {
    if (!mix) return
    const ac = new AbortController()
    abortRef.current = ac
    setState('working'); setMessage('')
    try {
      const run = bakeFn ?? ((v, m, mm, d, h) => bakeAudioMix(v, m, mm, d, h))
      const r = await run(voiceUrl, music, mix, durationSec, { signal: ac.signal })
      edit((prev) => (prev.audioMix ? { ...prev, audioMix: { ...prev.audioMix, mixdown: r.mixdown } } : prev))
      setState('idle'); setMessage(r.reused ? 'The mix was already rendered for these settings.' : 'Audio mix applied.')
    } catch (error) {
      const cancelled = error instanceof MixError && error.code === 'ABORTED'
      setState(cancelled ? 'idle' : 'error'); setMessage(describeMixError(error))
    } finally { abortRef.current = null }
  }

  const analyse = async () => {
    setAnalysing(true); setMessage('')
    try { setAnalysis(await (analyzeFn ?? analyzeAudioSources)(voiceUrl, music, undefined)) }
    catch (error) { setMessage(`Could not measure the audio: ${describeMixError(error)}`) }
    finally { setAnalysing(false) }
  }

  if (!voiceUrl && !music) {
    return (
      <div style={softPanelStyle} data-testid="audio-mix-panel">
        <div style={labelStyle}>Audio mix</div>
        <p style={hintStyle}>Choose a video or a music track first. The mix balances the video's own audio and your music.</p>
      </div>
    )
  }

  const slider = (id: string, label: string, value: number, min: number, max: number, step: number, set: (v: number) => void, suffix = '') => (
    <div>
      <label style={labelStyle} htmlFor={id}>{label} {value}{suffix}</label>
      <input id={id} type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} style={{ width: '100%', accentColor: C.cyan }} />
    </div>
  )

  return (
    <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="audio-mix-panel">
      <div style={labelStyle}>Audio mix</div>
      {!mix ? (
        <>
          <p style={hintStyle}>The video and your music play as they are. Turn the mix on to balance them, fix the voice, duck the music under it and set the final loudness.</p>
          <button type="button" style={small} onClick={() => patch((m) => m)}>Turn on audio mix</button>
        </>
      ) : (
        <>
          <div style={row}>
            <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12, color: C.text }}>
              <input type="checkbox" aria-label="Use audio mix" checked={mix.enabled} onChange={(e) => patch((m) => ({ ...m, enabled: e.target.checked }))} /> Use audio mix
            </label>
            <button type="button" style={small} onClick={() => edit((prev) => { const { audioMix: _d, ...rest } = prev; void _d; return rest as PersonalizationPreviewSettings })}>Remove mix</button>
          </div>

          {voiceUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={labelStyle}>Voice (the video's audio)</div>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.text }}>
                <input type="checkbox" aria-label="Mute voice" checked={mix.voice.muted} onChange={(e) => patch((m) => { m.voice.muted = e.target.checked; return m })} /> Mute
              </label>
              {slider('am-vgain', 'Voice level', mix.voice.gainDb, -30, 12, 0.5, (v) => patch((m) => { m.voice.gainDb = v; return m }), ' dB')}
              <div style={row}>
                <label style={hintStyle} htmlFor="am-eq">Tone</label>
                <select id="am-eq" aria-label="Voice tone preset" value="" onChange={(e) => { const p = EQ_PRESETS.find((x) => x.id === e.target.value); if (p) patch((m) => { m.voice.eq = { ...p.eq }; return m }) }} style={{ ...inputStyle, minHeight: 28, padding: '0 6px' }}>
                  <option value="">Preset…</option>
                  {EQ_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              {slider('am-hp', 'Rumble filter (high-pass; 0 = off)', mix.voice.eq.highpassHz, 0, 300, 5, (v) => patch((m) => { m.voice.eq.highpassHz = v; return m }), ' Hz')}
              {slider('am-low', 'Bass', mix.voice.eq.lowDb, -12, 12, 0.5, (v) => patch((m) => { m.voice.eq.lowDb = v; return m }), ' dB')}
              {slider('am-mid', 'Presence', mix.voice.eq.midDb, -12, 12, 0.5, (v) => patch((m) => { m.voice.eq.midDb = v; return m }), ' dB')}
              {slider('am-high', 'Treble', mix.voice.eq.highDb, -12, 12, 0.5, (v) => patch((m) => { m.voice.eq.highDb = v; return m }), ' dB')}
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.text }}>
                <input type="checkbox" aria-label="Even out the voice level" checked={mix.voice.normalize.enabled} onChange={(e) => patch((m) => { m.voice.normalize.enabled = e.target.checked; return m })} /> Set the voice to {mix.voice.normalize.targetLufs} LUFS first
              </label>
            </div>
          ) : null}

          {music ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={labelStyle}>Music</div>
              {slider('am-mgain', 'Music level', mix.music.gainDb, -30, 12, 0.5, (v) => patch((m) => { m.music.gainDb = v; return m }), ' dB')}
              {slider('am-fin', 'Fade in', mix.music.fadeInSec, 0, 10, 0.1, (v) => patch((m) => { m.music.fadeInSec = v; return m }), ' s')}
              {slider('am-fout', 'Fade out', mix.music.fadeOutSec, 0, 10, 0.1, (v) => patch((m) => { m.music.fadeOutSec = v; return m }), ' s')}
              {analysis?.music?.beats.length ? (
                <button type="button" style={small} onClick={() => { const end = mix.music.startSec + durationSec - mix.music.fadeOutSec; const b = nearestBeat(end, analysis.music!.beats); patch((m) => { m.music.fadeOutSec = Math.max(0, Math.min(10, Math.round((mix.music.startSec + durationSec - b) * 10) / 10)); return m }) }}>Start the fade-out on a beat</button>
              ) : null}
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.text }}>
                <input type="checkbox" aria-label="Loop music" checked={mix.music.loop} onChange={(e) => patch((m) => { m.music.loop = e.target.checked; return m })} /> Loop the music if it is shorter than the video
              </label>
              {slider('am-start', 'Start the music from', mix.music.startSec, 0, 300, 0.5, (v) => patch((m) => { m.music.startSec = v; return m }), ' s')}
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.text }}>
                <input type="checkbox" aria-label="Duck music under the voice" checked={mix.music.duck.enabled} onChange={(e) => patch((m) => { m.music.duck.enabled = e.target.checked; return m })} /> Lower the music while the voice speaks
              </label>
              {mix.music.duck.enabled ? (
                <>
                  {slider('am-duck', 'Ducking depth', mix.music.duck.amountDb, 0, 30, 1, (v) => patch((m) => { m.music.duck.amountDb = v; return m }), ' dB')}
                  {slider('am-rel', 'Recovery time', mix.music.duck.releaseMs, 50, 2000, 50, (v) => patch((m) => { m.music.duck.releaseMs = v; return m }), ' ms')}
                </>
              ) : null}
            </div>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={labelStyle}>Final mix</div>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.text }}>
              <input type="checkbox" aria-label="Set final loudness" checked={mix.master.targetLufs !== null} onChange={(e) => patch((m) => { m.master.targetLufs = e.target.checked ? -16 : null; return m })} /> Set the final loudness
            </label>
            {mix.master.targetLufs !== null ? slider('am-target', 'Target loudness', mix.master.targetLufs, -30, -9, 0.5, (v) => patch((m) => { m.master.targetLufs = v; return m }), ' LUFS') : null}
            {slider('am-ceil', 'Peak ceiling', mix.master.ceilingDb, -6, 0, 0.5, (v) => patch((m) => { m.master.ceilingDb = v; return m }), ' dB')}
            <p style={hintStyle}>-16 LUFS suits social video; -14 is louder, -23 is broadcast. The ceiling limits the mix's sample peaks; the exported AAC file can come out 1–3 dB higher on a very loud mix, so keep -1 dB or lower for headroom.</p>
          </div>

          <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={row}>
              <button type="button" style={small} disabled={state === 'working' || !mix.enabled} onClick={apply}>{mix.mixdown ? 'Apply again' : 'Apply audio mix'}</button>
              {state === 'working' ? <button type="button" style={small} onClick={() => abortRef.current?.abort()}>Cancel</button> : null}
              <button type="button" style={small} disabled={analysing} onClick={analyse}>{analysing ? 'Measuring…' : 'Measure my audio'}</button>
            </div>
            {mix.enabled && plan.pending === 'not-applied' ? <p role="status" data-testid="audio-mix-pending" style={hintStyle}>Not applied yet: the preview plays the video and music as they are. Press “Apply audio mix” (an export applies it automatically).</p> : null}
            {mix.enabled && plan.pending === 'stale' ? <p role="status" data-testid="audio-mix-stale" style={hintStyle}>The mix is out of date (something changed since it was applied). Press “Apply again”; an export re-applies it automatically.</p> : null}
            {mix.enabled && plan.useMixdown ? <p data-testid="audio-mix-active" style={hintStyle}>Applied: the preview and the export play this mix.</p> : null}
            {mix.mixdown ? (
              <div data-testid="audio-mix-report" style={hintStyle}>
                Voice {fmt(mix.mixdown.report.voiceLufs, ' LUFS')} · music {fmt(mix.mixdown.report.musicLufs, ' LUFS')} → final {fmt(mix.mixdown.report.finalLufs, ' LUFS')}, peak {fmt(mix.mixdown.report.peakDb, ' dB')}{mix.mixdown.report.duckMaxDb ? `, music lowered by up to ${mix.mixdown.report.duckMaxDb} dB` : ''}.
                {mix.mixdown.report.notes.map((n, i) => <div key={i}>{n}</div>)}
              </div>
            ) : null}
            {analysis ? (
              <div data-testid="audio-analysis" style={hintStyle}>
                {analysis.voice ? <div>Voice: {fmt(analysis.voice.lufs, ' LUFS')}, {analysis.voice.quietGaps.length} quiet gap{analysis.voice.quietGaps.length === 1 ? '' : 's'} ({analysis.voice.quietGaps.reduce((a, g) => a + g.endSec - g.startSec, 0).toFixed(1)} s)</div> : voiceUrl ? <div>Voice: no audio the browser can read.</div> : null}
                {analysis.music ? <div>Music: {fmt(analysis.music.lufs, ' LUFS')}, {analysis.music.bpm ? `${analysis.music.bpm} BPM` : 'no steady beat found'}</div> : music ? <div>Music: could not be read.</div> : null}
              </div>
            ) : null}
            {message ? <div role={state === 'error' ? 'alert' : 'status'} data-testid="audio-mix-message" style={hintStyle}>{message}</div> : null}
          </div>
        </>
      )}
    </div>
  )
}
