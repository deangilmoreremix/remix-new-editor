'use client'
import React, { useEffect, useRef, useState } from 'react'
import { TEXT_PRESETS, defaultOverlay, textFrame, toKeyframes, type TextOverlay } from '@ohb/shared/social/animatedText'
import { processVideo } from '@ohb/shared/social/mediaProcessing'
import { detectCapabilities } from '@ohb/shared/social/capabilities'
import { btn, btnPrimary, field, h4 } from './useStudio'

interface Props {
  duration: number
  getSource: () => Promise<Blob>
  onOutput: (o: { label: string; kind: 'video' | 'image'; blob: Blob }) => void
  apply?: (o: { file: Blob; overlays: TextOverlay[]; onProgress: (f: number) => void; signal: AbortSignal }) => Promise<{ blob: Blob }>
}
const defaultApply: NonNullable<Props['apply']> = (o) => processVideo({ file: o.file, overlays: o.overlays, preset: 'high', onProgress: o.onProgress, signal: o.signal })

export function TextOverlayTools({ duration, getSource, onOutput, apply = defaultApply }: Props) {
  const caps = detectCapabilities()
  const [draft, setDraft] = useState<TextOverlay>(() => defaultOverlay())
  const [list, setList] = useState<TextOverlay[]>([])
  const [busy, setBusy] = useState<number | null | false>(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [typed, setTyped] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const raf = useRef(0)
  const d = (patch: Partial<TextOverlay>) => setDraft((x) => ({ ...x, ...patch }))
  const len = Math.max(0.5, draft.end - draft.start)

  useEffect(() => () => { abortRef.current?.abort(); cancelAnimationFrame(raf.current) }, [])

  /** Plays the preview with the Web Animations API, from the same curves the export draws with. Typewriter steps the characters instead. */
  const replay = () => {
    cancelAnimationFrame(raf.current); setTyped(null)
    const el = previewRef.current
    if (!el) return
    if (draft.preset === 'typewriter') {
      const t0 = performance.now()
      const step = (now: number) => {
        const t = (now - t0) / 1000
        const f = textFrame('typewriter', t, len, { length: draft.text.length })
        setTyped(draft.text.slice(0, Math.ceil(draft.text.length * f.chars)))
        if (t < len) raf.current = requestAnimationFrame(step); else setTyped(null)
      }
      raf.current = requestAnimationFrame(step)
      return
    }
    if (typeof el.animate !== 'function') return
    el.animate(toKeyframes(draft.preset, len, { length: draft.text.length }), { duration: len * 1000, fill: 'both', easing: 'linear' })
  }

  const burn = async () => {
    abortRef.current?.abort()
    const ac = new AbortController(); abortRef.current = ac
    setMsg(null); setBusy(null)
    try {
      const out = await apply({ file: await getSource(), overlays: list, onProgress: (f) => setBusy(f), signal: ac.signal })
      onOutput({ label: `Animated text (${list.length})`, kind: 'video', blob: out.blob })
      setMsg({ kind: 'ok', text: 'Done. Find the new video under Prepared files.' })
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.name === 'MediaCancelledError' || e?.name === 'AbortError' ? 'Cancelled. Nothing was changed.' : `Adding text failed: ${e?.message ?? e}. Your video is unchanged.` })
    } finally { setBusy(false) }
  }

  const bad = !draft.text.trim() ? 'Type some text.' : duration && draft.start >= duration ? `The video is only ${duration.toFixed(1)} s long.` : draft.end <= draft.start ? 'The end must be after the start.' : ''

  return (
    <section aria-label="Animated text" className="space-y-2">
      <h4 className={h4}>Animated text</h4>
      <div className="grid grid-cols-2 gap-2 text-[11px] text-white/60">
        <label className="col-span-2">Text<input className={field} aria-label="Overlay text" value={draft.text} onChange={(e) => d({ text: e.target.value })} /></label>
        <label>Animation<select className={field} aria-label="Animation" value={draft.preset} onChange={(e) => d({ preset: e.target.value as TextOverlay['preset'] })}>{TEXT_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label>Position<select className={field} aria-label="Text position" value={draft.position} onChange={(e) => d({ position: e.target.value as TextOverlay['position'] })}><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select></label>
        <label>Start (s)<input type="number" min={0} step={0.1} className={field} aria-label="Text start" value={draft.start} onChange={(e) => d({ start: +e.target.value })} /></label>
        <label>End (s)<input type="number" min={0} step={0.1} className={field} aria-label="Text end" value={draft.end} onChange={(e) => d({ end: +e.target.value })} /></label>
        <label>Colour<input type="color" aria-label="Text colour" value={draft.color} onChange={(e) => d({ color: e.target.value })} /></label>
        <label>Size<input type="range" aria-label="Text size" min={0.04} max={0.16} step={0.01} value={draft.size} onChange={(e) => d({ size: +e.target.value })} className="w-full" /></label>
      </div>
      <div className="rounded-lg bg-black/40 h-20 grid place-items-center overflow-hidden">
        <div ref={previewRef} data-testid="text-preview" style={{ color: draft.color, fontWeight: 700, fontSize: `${Math.round(draft.size * 260)}px`, textShadow: '0 0 4px #000' }}>{typed ?? draft.text}</div>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" className={btn} onClick={replay}>Replay preview</button>
        <button type="button" className={btn} disabled={!!bad} onClick={() => setList((l) => [...l, draft])}>Add to video</button>
        {bad && <span className="text-[10px] text-amber-200">{bad}</span>}
      </div>
      {list.length > 0 && (
        <ul className="space-y-1">
          {list.map((o, i) => (
            <li key={i} className="flex items-center gap-2 text-[11px] rounded border border-white/10 px-2 py-1">
              <span className="flex-1 truncate">{o.text} · {TEXT_PRESETS.find((p) => p.id === o.preset)?.label} · {o.start}–{o.end}s</span>
              <button type="button" aria-label={`Remove text ${i + 1}`} className="text-white/40 hover:text-red-300" onClick={() => setList((l) => l.filter((_, j) => j !== i))}>×</button>
            </li>
          ))}
        </ul>
      )}
      {list.length > 0 && <button type="button" className={btnPrimary} disabled={busy !== false || !caps.webCodecs} onClick={burn}>Burn text into video</button>}
      {list.length > 0 && !caps.webCodecs && <p className="text-[10px] text-amber-200">Rendering needs WebCodecs, which this browser lacks. The preview above still works.</p>}
      {busy !== false && (
        <div role="status" className="text-[11px]">
          <div className="flex justify-between"><span>Adding text…{busy !== null && ` ${Math.round(busy * 100)}%`}</span><button type="button" className="underline" onClick={() => abortRef.current?.abort()}>Cancel</button></div>
          <div className="mt-1 h-1.5 rounded bg-white/10"><div className="h-full rounded bg-[#d9ff00]" style={{ width: `${Math.round((busy ?? 0.05) * 100)}%` }} /></div>
        </div>
      )}
      {msg && <p role={msg.kind === 'err' ? 'alert' : 'status'} className={`text-[11px] ${msg.kind === 'err' ? 'text-red-300' : 'text-emerald-300'}`}>{msg.text}</p>}
    </section>
  )
}
