'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AUDIO_PRESETS, DEFAULT_AUDIO, buildAudioChain, clampSettings, decodeFileAudio, renderAudio, peaks, peakDb, rmsDb, levelAdvice, audioBufferToWav, isUnchanged, type AudioSettings,
} from '@ohb/shared/social/audioTools'
import { processVideo } from '@ohb/shared/social/mediaProcessing'
import { exportFilename, downloadBlob } from '@ohb/shared/social/exportNames'
import { detectCapabilities } from '@ohb/shared/social/capabilities'
import { btn, btnPrimary, field, h4 } from './useStudio'

export interface AudioDeps {
  decode: (file: Blob) => Promise<AudioBuffer>
  render: (buf: AudioBuffer, s: AudioSettings) => Promise<AudioBuffer>
  applyToVideo: (o: { file: Blob; audioBuffer: AudioBuffer; onProgress: (f: number) => void; signal: AbortSignal }) => Promise<{ blob: Blob }>
}
const defaultDeps: AudioDeps = {
  decode: (f) => decodeFileAudio(f),
  render: (b, s) => renderAudio(b, s),
  applyToVideo: (o) => processVideo({ file: o.file, audioBuffer: o.audioBuffer, preset: 'high', onProgress: o.onProgress, signal: o.signal }),
}

interface Props {
  title: string
  getSource: () => Promise<Blob>
  onOutput: (o: { label: string; kind: 'video' | 'image'; blob: Blob }) => void
  deps?: AudioDeps
}

const Slider = ({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) => (
  <label className="text-[11px] text-white/60">{label}: <b className="text-white/80">{value}{unit}</b>
    <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full" />
  </label>
)

export function AudioTools({ title, getSource, onOutput, deps = defaultDeps }: Props) {
  const caps = detectCapabilities()
  const [s, setS] = useState<AudioSettings>(DEFAULT_AUDIO)
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)
  const [wave, setWave] = useState<number[]>([])
  const [levels, setLevels] = useState<{ peak: number; rms: number } | null>(null)
  const [live, setLive] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [busy, setBusy] = useState<null | { what: string; progress: number | null }>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const set = (patch: Partial<AudioSettings>) => setS((x) => ({ ...x, ...patch }))

  useEffect(() => () => { abortRef.current?.abort(); stopRef.current?.() }, [])
  useEffect(() => {
    const c = canvasRef.current
    const g = c?.getContext?.('2d')
    if (!c || !g || !wave.length) return
    g.clearRect(0, 0, c.width, c.height)
    g.fillStyle = '#d9ff00'
    const w = c.width / wave.length
    wave.forEach((p, i) => { const h = Math.max(1, p * c.height); g.fillRect(i * w, (c.height - h) / 2, Math.max(1, w - 1), h) })
  }, [wave])

  const run = useCallback(async (what: string, fn: (signal: AbortSignal, progress: (f: number | null) => void) => Promise<string>) => {
    abortRef.current?.abort()
    const ac = new AbortController(); abortRef.current = ac
    setMsg(null); setBusy({ what, progress: null })
    try { setMsg({ kind: 'ok', text: await fn(ac.signal, (f) => setBusy({ what, progress: f })) }) }
    catch (e: any) { setMsg({ kind: 'err', text: e?.name === 'MediaCancelledError' || e?.name === 'AbortError' ? 'Cancelled. Nothing was changed.' : `${what} failed: ${e?.message ?? e}. Your video is unchanged.` }) }
    finally { setBusy(null) }
  }, [])

  const analyse = () => run('Reading audio', async () => {
    const buf = await deps.decode(await getSource())
    setBuffer(buf)
    const ch = buf.getChannelData(0)
    setWave(peaks(ch, 160))
    const lv = { peak: peakDb(ch), rms: rmsDb(ch) }
    setLevels(lv)
    return levelAdvice(lv.peak, lv.rms)
  })

  const preview = () => {
    if (!buffer) return
    stopRef.current?.()
    const Ctx: any = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext
    if (!Ctx) { setMsg({ kind: 'err', text: 'This browser cannot play processed audio (Web Audio is missing).' }); return }
    const ctx = new Ctx()
    const src = ctx.createBufferSource(); src.buffer = buffer
    const analyser = ctx.createAnalyser(); analyser.fftSize = 1024
    const { output } = buildAudioChain(ctx, src, s, Infinity) // fades are applied in the render, not the live preview
    output.connect(analyser); analyser.connect(ctx.destination)
    const data = new Float32Array(analyser.fftSize)
    let raf = 0, stopped = false
    const tick = () => { if (stopped) return; analyser.getFloatTimeDomainData(data); setLive(peakDb(data)); raf = requestAnimationFrame(tick) }
    const stop = () => { if (stopped) return; stopped = true; cancelAnimationFrame(raf); try { src.stop() } catch { /* not started */ } void ctx.close?.(); setPlaying(false); setLive(null); stopRef.current = null }
    src.onended = stop
    stopRef.current = stop
    src.start(); setPlaying(true); tick()
  }

  const settings = clampSettings(s, buffer?.duration ?? Infinity)
  const changed = !isUnchanged(settings)

  const downloadWav = () => run('Rendering audio', async () => {
    if (!buffer) throw new Error('Read the audio first')
    downloadBlob(audioBufferToWav(await deps.render(buffer, settings)), exportFilename('audio', title, 'wav'))
    return 'Downloaded.'
  })

  const applyToVideo = () => run('Applying audio to video', async (signal, progress) => {
    if (!buffer) throw new Error('Read the audio first')
    const rendered = await deps.render(buffer, settings)
    const out = await deps.applyToVideo({ file: await getSource(), audioBuffer: rendered, onProgress: (f) => progress(f), signal })
    onOutput({ label: 'Audio adjusted', kind: 'video', blob: out.blob })
    return 'Done. Find the new video under Prepared files. (Apply audio changes after trimming, not together with it.)'
  })

  return (
    <section aria-label="Audio" className="space-y-2">
      <h4 className={h4}>Audio</h4>
      <p className="text-[10px] text-white/40">Volume, fades, equalizer, compressor and a basic high-pass filter, all on your device. The filter reduces rumble; it is not AI noise removal.</p>
      {!caps.webAudio && <p role="alert" className="text-[11px] text-amber-200">This browser has no Web Audio, so audio can't be adjusted here. Adjust it in another tool and drop the result in the library.</p>}
      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" className={btnPrimary} disabled={!!busy || !caps.webAudio} onClick={analyse}>{buffer ? 'Read again' : 'Read audio'}</button>
        {buffer && <select aria-label="Audio preset" className={`${field} !w-auto`} defaultValue="" onChange={(e) => e.target.value && setS({ ...DEFAULT_AUDIO, ...AUDIO_PRESETS[e.target.value].settings })}>
          <option value="">Preset…</option>{Object.entries(AUDIO_PRESETS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
        </select>}
      </div>
      {buffer && (
        <>
          <canvas ref={canvasRef} width={320} height={48} aria-label="Waveform" className="w-full h-12 rounded bg-black/30" />
          {levels && <p className="text-[11px] text-white/60">Peak {levels.peak.toFixed(1)} dB · average {levels.rms.toFixed(1)} dB{live !== null && <> · now <b className="text-white/80">{live.toFixed(1)} dB</b></>}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Slider label="Volume" value={s.gainDb} min={-30} max={18} unit=" dB" onChange={(v) => set({ gainDb: v })} />
            <Slider label="Low" value={s.lowDb} min={-12} max={12} unit=" dB" onChange={(v) => set({ lowDb: v })} />
            <Slider label="Mid" value={s.midDb} min={-12} max={12} unit=" dB" onChange={(v) => set({ midDb: v })} />
            <Slider label="High" value={s.highDb} min={-12} max={12} unit=" dB" onChange={(v) => set({ highDb: v })} />
            <Slider label="Fade in" value={s.fadeInSec} min={0} max={5} step={0.1} unit=" s" onChange={(v) => set({ fadeInSec: v })} />
            <Slider label="Fade out" value={s.fadeOutSec} min={0} max={5} step={0.1} unit=" s" onChange={(v) => set({ fadeOutSec: v })} />
          </div>
          <div className="flex flex-wrap gap-3 items-center text-[11px] text-white/60">
            <label>High-pass <select aria-label="High-pass filter" className={`${field} !w-auto inline-block`} value={s.highpassHz} onChange={(e) => set({ highpassHz: +e.target.value })}><option value={0}>Off</option><option value={80}>80 Hz</option><option value={120}>120 Hz</option><option value={200}>200 Hz</option></select></label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={s.compressor} onChange={(e) => set({ compressor: e.target.checked })} /> Compressor</label>
            {s.compressor && <Slider label="Threshold" value={s.thresholdDb} min={-60} max={0} unit=" dB" onChange={(v) => set({ thresholdDb: v })} />}
          </div>
          <div className="flex flex-wrap gap-2">
            {playing ? <button type="button" className={btn} onClick={() => stopRef.current?.()}>Stop preview</button> : <button type="button" className={btn} onClick={preview}>Play preview</button>}
            <button type="button" className={btn} disabled={!!busy || !changed} onClick={downloadWav}>Download audio (WAV)</button>
            <button type="button" className={btnPrimary} disabled={!!busy || !changed || !caps.webCodecs} onClick={applyToVideo}>Apply to video</button>
          </div>
          {!caps.webCodecs && <p className="text-[10px] text-amber-200">Applying to the video needs WebCodecs. You can still download the processed audio.</p>}
          <p className="text-[10px] text-white/40">The live preview doesn't include fades; they are applied when you download or apply.</p>
        </>
      )}
      {busy && (
        <div role="status" className="text-[11px]">
          <div className="flex justify-between"><span>{busy.what}…{busy.progress !== null && ` ${Math.round(busy.progress * 100)}%`}</span><button type="button" className="underline" onClick={() => abortRef.current?.abort()}>Cancel</button></div>
          <div className="mt-1 h-1.5 rounded bg-white/10"><div className="h-full rounded bg-[#d9ff00]" style={{ width: `${Math.round((busy.progress ?? 0.05) * 100)}%` }} /></div>
        </div>
      )}
      {msg && <p role={msg.kind === 'err' ? 'alert' : 'status'} className={`text-[11px] ${msg.kind === 'err' ? 'text-red-300' : 'text-emerald-300'}`}>{msg.text}</p>}
    </section>
  )
}
