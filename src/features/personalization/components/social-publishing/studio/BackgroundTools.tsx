'use client'
import React, { useEffect, useRef, useState } from 'react'
import { compositeOnBackground, hasBackgroundModelConsent, rememberBackgroundModelConsent } from '@ohb/shared/social/backgroundTools'
import { btn, btnPrimary, h4 } from './useStudio'

/** The app's existing on-device background removal (BG0). Loaded lazily so it never lands in the main bundle. */
const loadBg = () => import('@ohb/shared/personalization/backgroundRemoval/backgroundRemovalClient')

interface Props {
  mediaType: 'video' | 'image'
  getSource: () => Promise<Blob>
  onOutput: (o: { label: string; kind: 'video' | 'image'; blob: Blob }) => void
  /** Injectable for tests. */
  confirmDownload?: (message: string) => boolean
}

export function BackgroundTools({ mediaType, getSource, onOutput, confirmDownload = (m) => (typeof window !== 'undefined' ? window.confirm(m) : false) }: Props) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [cutout, setCutout] = useState<Blob | null>(null)
  const [color, setColor] = useState('#ffffff')
  const [busy, setBusy] = useState<null | { what: string; progress: number | null }>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let alive = true
    if (mediaType === 'image') void loadBg().then((m: any) => m.canRemoveBackgrounds()).then((ok: boolean) => alive && setSupported(ok)).catch(() => alive && setSupported(false))
    return () => { alive = false; abortRef.current?.abort() }
  }, [mediaType])

  if (mediaType === 'video') {
    return (
      <section aria-label="Background removal" className="space-y-1">
        <h4 className={h4}>Background removal</h4>
        <p className="text-[11px] text-white/50">Removing the background from a video isn't available in this panel. Cut out a still frame here, or use the Timeline editor's background removal for video.</p>
      </section>
    )
  }

  const run = async (what: string, fn: (signal: AbortSignal, progress: (f: number | null) => void) => Promise<string>) => {
    abortRef.current?.abort()
    const ac = new AbortController(); abortRef.current = ac
    setMsg(null); setBusy({ what, progress: null })
    try { setMsg({ kind: 'ok', text: await fn(ac.signal, (f) => setBusy({ what, progress: f })) }) }
    catch (e: any) { setMsg({ kind: 'err', text: e?.code === 'cancelled' || e?.name === 'AbortError' ? 'Cancelled. Nothing was changed.' : `${what} failed: ${e?.message ?? e}. Your image is unchanged.` }) }
    finally { setBusy(null) }
  }

  const remove = () => run('Background removal', async (signal, progress) => {
    const m: any = await loadBg()
    if (!hasBackgroundModelConsent()) {
      if (!confirmDownload(`Removing the background runs on this device and downloads an image model once (about ${m.BACKGROUND_REMOVAL_MODEL_MB} MB). Download it now?`)) throw Object.assign(new Error('declined'), { name: 'AbortError' })
      rememberBackgroundModelConsent()
    }
    const out = await m.removeAssetBackground(await getSource(), { signal, onProgress: (p: any) => progress(typeof p?.progress === 'number' ? p.progress : null) })
    setCutout(out.blob)
    onOutput({ label: 'Background removed (transparent PNG)', kind: 'image', blob: out.blob })
    return `Done (${out.provider === 'webgpu' ? 'GPU' : 'CPU'}, ${Math.round(out.durationMs / 100) / 10}s). Most platforms flatten transparency, so put it on a colour or picture below before posting.`
  })

  const replace = (bg: { color?: string; image?: Blob }, label: string) => run('Background replacement', async () => {
    if (!cutout) throw new Error('Remove the background first')
    onOutput({ label, kind: 'image', blob: await compositeOnBackground(cutout, bg) })
    return 'Done. Find it under Prepared files.'
  })

  return (
    <section aria-label="Background removal" className="space-y-2">
      <h4 className={h4}>Background removal</h4>
      {supported === false ? (
        <p role="alert" className="text-[11px] text-amber-200">This browser can't run on-device background removal (it needs WebGPU or WebAssembly). Try a current Chrome, Edge, Firefox or Safari, or remove the background in another tool and drop the result in here.</p>
      ) : (
        <>
          <p className="text-[10px] text-white/40">Runs on your device; nothing is uploaded. The model downloads once, only after you agree.</p>
          <button type="button" className={btnPrimary} disabled={!!busy || supported === null} onClick={remove}>Remove background</button>
          {cutout && (
            <div className="flex flex-wrap gap-2 items-center text-[11px] text-white/70">
              <label className="flex items-center gap-1.5">Colour <input type="color" aria-label="Background colour" value={color} onChange={(e) => setColor(e.target.value)} /></label>
              <button type="button" className={btn} disabled={!!busy} onClick={() => replace({ color }, `On ${color}`)}>Put on colour</button>
              <label className={`${btn} cursor-pointer`}>Put on picture…<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void replace({ image: f }, `On picture (${f.name})`); e.target.value = '' }} /></label>
            </div>
          )}
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
