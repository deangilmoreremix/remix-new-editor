'use client'
import React, { useEffect, useRef, useState } from 'react'
import { captionsToCues, cuesToCaptions } from '@ohb/shared/social/captionBridge'
import type { Cue } from '@ohb/shared/social/subtitles'
import { detectCapabilities } from '@ohb/shared/social/capabilities'
import { btn, btnPrimary, field, h4 } from './useStudio'

/** The app's one shared Caption Studio engine: on-device Whisper transcription and burned-in rendering (WebCodecs, recorder fallback). */
const loadTranscribe = () => import('../../../../../lib/captionStudio/transcribeClient.js')
const loadBurn = () => import('../../../../../lib/captionStudio/burn.js')
const loadModel = () => import('../../../../../lib/captionStudio/model.js')

interface Props {
  cues: Cue[]
  setCues: (c: Cue[]) => void
  getSource: () => Promise<Blob>
  onOutput: (o: { label: string; kind: 'video' | 'image'; blob: Blob }) => void
  position: 'top' | 'middle' | 'bottom'
}

const LANGS: Array<[string, string]> = [['auto', 'Detect language'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['it', 'Italian'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese'], ['hi', 'Hindi'], ['ar', 'Arabic']]

export function CaptionTools({ cues, setCues, getSource, onOutput, position }: Props) {
  const caps = detectCapabilities()
  const [models, setModels] = useState<Array<[string, string]>>([])
  const [presets, setPresets] = useState<Array<[string, string]>>([])
  const [model, setModel] = useState('')
  const [lang, setLang] = useState('auto')
  const [preset, setPreset] = useState('tiktok')
  const [busy, setBusy] = useState<null | { what: string; progress: number | null }>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let alive = true
    void loadTranscribe().then((m: any) => { if (alive) { setModels(m.WHISPER_MODELS); setModel(m.WHISPER_MODELS[0]?.[0] ?? '') } }).catch(() => {})
    void loadModel().then((m: any) => { if (alive) setPresets(Object.entries(m.CAPTION_PRESETS).map(([id, p]: [string, any]) => [id, p.label as string])) }).catch(() => {})
    return () => { alive = false; abortRef.current?.abort() }
  }, [])

  const run = async (what: string, fn: (signal: AbortSignal, progress: (f: number | null) => void) => Promise<string>) => {
    abortRef.current?.abort()
    const ac = new AbortController(); abortRef.current = ac
    setMsg(null); setBusy({ what, progress: null })
    try { const ok = await fn(ac.signal, (f) => setBusy({ what, progress: f })); setMsg({ kind: 'ok', text: ok }) }
    catch (e: any) {
      if (e?.name === 'AbortError') setMsg({ kind: 'err', text: /declin/i.test(e.message) ? 'No model was downloaded. Captions need the speech model, so nothing was changed.' : 'Cancelled. Nothing was changed.' })
      else setMsg({ kind: 'err', text: `${what} failed: ${e?.message ?? e}. Your video is unchanged.` })
    } finally { setBusy(null) }
  }

  const transcribe = () => run('Transcription', async (signal, progress) => {
    const src = await getSource()
    const url = URL.createObjectURL(src)
    try {
      const { transcribeInBrowser } = (await loadTranscribe()) as any
      const out = await transcribeInBrowser(url, { model, language: lang === 'auto' ? undefined : lang, signal, onProgress: (p: any) => progress(typeof p?.progress === 'number' ? p.progress : null) })
      const next = captionsToCues(out.captions)
      if (!next.length) throw new Error('No speech was found in this video')
      setCues(next)
      return `${next.length} caption lines created. Check and correct them in the editor above before using them.`
    } finally { URL.revokeObjectURL(url) }
  })

  const burn = () => run('Burning captions', async (signal, progress) => {
    const captions = cuesToCaptions(cues)
    if (!captions.length) throw new Error('Add or generate captions first')
    const src = await getSource()
    const { burnCaptions } = (await loadBurn()) as any
    const { defaultCaptionStyle } = (await loadModel()) as any
    const style = { ...defaultCaptionStyle(preset), position }
    const out = await burnCaptions({ src, captions, style, signal, onProgress: (p: any) => progress(typeof p?.progress === 'number' ? p.progress : null) })
    if (out.url) URL.revokeObjectURL(out.url) // we hand the blob on; the prepared-files list makes its own URL
    onOutput({ label: `Captions burned in (${out.engine === 'recorder' ? 'recorded in real time' : 'rendered'}, ${out.ext?.toUpperCase?.() ?? 'video'})`, kind: 'video', blob: out.blob })
    return 'Done. Find the new video under Prepared files.'
  })

  return (
    <section aria-label="Caption generation and burn-in" className="space-y-2">
      <h4 className={h4}>Captions: generate &amp; burn in</h4>
      <p className="text-[10px] text-white/40">Runs on your device. The speech model is downloaded once, only after you agree. {caps.webGpu ? 'WebGPU is available, so it is faster.' : 'Without WebGPU it runs on the CPU and is slower.'}</p>
      <div className="flex flex-wrap gap-2 items-center">
        <select aria-label="Speech model" className={`${field} !w-auto`} value={model} onChange={(e) => setModel(e.target.value)}>{models.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <select aria-label="Spoken language" className={`${field} !w-auto`} value={lang} onChange={(e) => setLang(e.target.value)}>{LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
        <button type="button" className={btnPrimary} disabled={!!busy || !model} onClick={transcribe}>Generate captions</button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <select aria-label="Caption style" className={`${field} !w-auto`} value={preset} onChange={(e) => setPreset(e.target.value)}>{presets.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <button type="button" className={btn} disabled={!!busy || cues.length === 0} onClick={burn}>Burn captions into video</button>
        {cues.length === 0 && <span className="text-[10px] text-white/40">Needs captions first.</span>}
      </div>
      {!caps.webCodecs && <p className="text-[10px] text-amber-200">Fast rendering needs WebCodecs. This browser will fall back to recording the video in real time, which takes as long as the video itself.</p>}
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
