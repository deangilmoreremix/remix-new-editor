'use client'

import React, { useCallback, useState } from 'react'
import { Loader2, Download, Sparkles, LayoutGrid } from 'lucide-react'
import { THUMBNAIL_ASPECTS, type ThumbnailAspect } from '@ohb/shared/api/socialPayloads'
import { fitToShape, expandWithAi, type FitMode } from '@ohb/shared/api/thumbnailVariants'

const SHAPE_NOTES: Record<ThumbnailAspect, string> = {
  '16:9': 'YouTube',
  '1:1': 'Square (download)',
  '4:5': 'Instagram feed cover',
  '9:16': 'Instagram Reels and Stories cover',
}

export interface ThumbnailVersionsProps {
  /** The main thumbnail picture. */
  sourceUrl: string | null
  /** The shape the main thumbnail already has. */
  sourceAspect: string
  variants: Record<string, string> | undefined
  onChange: (variants: Record<string, string>) => void
  disabled?: boolean
}

/**
 * One thumbnail, every shape. The free "Make versions" button works in the browser and needs nothing;
 * "Expand with AI" per shape is an optional extra. Publishing works without any of this.
 */
export default function ThumbnailVersions({ sourceUrl, sourceAspect, variants, onChange, disabled }: ThumbnailVersionsProps) {
  const [fit, setFit] = useState<FitMode>('blur')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const current = variants ?? {}

  const makeAll = useCallback(async () => {
    if (!sourceUrl) return
    setError(null)
    setBusy('all')
    try {
      const next: Record<string, string> = { ...current }
      for (const aspect of THUMBNAIL_ASPECTS) {
        if (aspect === sourceAspect) continue
        next[aspect] = await fitToShape(sourceUrl, aspect, { mode: fit })
      }
      onChange(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not make the versions.')
    } finally {
      setBusy(null)
    }
  }, [sourceUrl, sourceAspect, fit, current, onChange])

  const aiOne = useCallback(
    async (aspect: ThumbnailAspect) => {
      if (!sourceUrl) return
      setError(null)
      setBusy(aspect)
      try {
        onChange({ ...current, [aspect]: await expandWithAi(sourceUrl, aspect) })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'The AI version failed. The free fit still works.')
      } finally {
        setBusy(null)
      }
    },
    [sourceUrl, current, onChange],
  )

  const download = (url: string, aspect: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = `thumbnail-${aspect.replace(':', 'x')}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (!sourceUrl) return null
  return (
    <div className="space-y-2 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }} data-testid="thumbnail-versions">
      <div className="flex flex-wrap items-center gap-2">
        <LayoutGrid size={13} className="text-white/50" aria-hidden="true" />
        <p className="text-[11px] font-semibold text-white/80">Versions for each network</p>
        <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ background: 'rgba(217,255,0,0.12)', color: '#d9ff00' }}>Free</span>
        <select aria-label="How to fit the picture" value={fit} onChange={(e) => setFit(e.target.value as FitMode)} disabled={disabled || !!busy} className="ml-auto rounded-lg bg-black/30 px-2 py-1 text-[11px] text-white border border-white/10">
          <option value="blur">Whole picture, blurred edges</option>
          <option value="fill">Crop to fill</option>
          <option value="solid">Whole picture, black bars</option>
        </select>
        <button type="button" onClick={makeAll} disabled={disabled || !!busy} className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold" style={{ border: '1px solid #d9ff00', color: '#d9ff00', background: 'transparent' }}>
          {busy === 'all' ? <Loader2 size={12} className="animate-spin" /> : null}Make versions
        </button>
      </div>
      <p className="text-[10px] text-white/40">Each network gets a picture in its own shape. This is optional: your main thumbnail is used wherever you skip it.</p>
      <div className="grid grid-cols-4 gap-2">
        {THUMBNAIL_ASPECTS.map((aspect) => {
          const isSource = aspect === sourceAspect
          const url = isSource ? sourceUrl : current[aspect]
          return (
            <div key={aspect} className="space-y-1">
              <div className="flex items-center justify-center overflow-hidden rounded-lg bg-black/40" style={{ aspectRatio: aspect.replace(':', ' / '), border: '1px solid rgba(255,255,255,0.08)' }}>
                {url ? <img src={url} alt={`${aspect} version`} className="h-full w-full object-cover" /> : <span className="text-[10px] text-white/30">Not made yet</span>}
              </div>
              <p className="text-[10px] font-semibold text-white/70">{aspect}{isSource ? ' · original' : ''}</p>
              <p className="text-[9px] leading-tight text-white/35">{SHAPE_NOTES[aspect]}</p>
              {!isSource && (
                <div className="flex gap-1">
                  <button type="button" onClick={() => aiOne(aspect)} disabled={disabled || !!busy} title="Optional: OpenAI extends the scene to fit. Uses your OpenAI key." className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] text-white/60 border border-white/10 hover:text-white">
                    {busy === aspect ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}AI
                  </button>
                  {url && (
                    <button type="button" onClick={() => download(url, aspect)} aria-label={`Download ${aspect} version`} className="rounded-md px-1.5 py-1 text-white/60 border border-white/10 hover:text-white"><Download size={10} /></button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {error && <p role="alert" className="text-[11px] text-red-400">{error}</p>}
    </div>
  )
}
