'use client'
import React, { useState } from 'react'
import { PLATFORM_PRESETS, aspectWarning, ASPECTS, type PlatformId } from '@ohb/shared/social/platformConfig'
import { PLATFORM_SPECS } from '@ohb/shared/api/socialPayloads'
import type { Asset } from '../types'
import type { MediaMeta } from './useStudio'

interface Props {
  asset: Asset
  platforms: PlatformId[]
  textFor: (p: PlatformId) => string
  titleFor: (p: PlatformId) => string
  thumbnailUrl?: string
  meta: MediaMeta
}

type Layout = 'feed' | 'vertical' | 'video'
const LAYOUT: Record<PlatformId, Layout> = { youtube: 'video', instagram: 'feed', tiktok: 'vertical', facebook: 'feed', linkedin: 'feed', pinterest: 'feed', threads: 'feed', x: 'feed' }
const ACCENT: Record<PlatformId, string> = { youtube: '#FF0000', instagram: '#E4405F', tiktok: '#25F4EE', facebook: '#1877F2', linkedin: '#0A66C2', pinterest: '#E60023', threads: '#ffffff', x: '#ffffff' }

function Media({ asset, thumbnailUrl, ratio, cover, safe, platform }: { asset: Asset; thumbnailUrl?: string; ratio: number; cover: boolean; safe: boolean; platform: PlatformId }) {
  const fit = cover ? 'object-cover' : 'object-contain'
  const sa = PLATFORM_PRESETS[platform].safeArea
  return (
    <div className="relative w-full bg-black overflow-hidden" style={{ aspectRatio: String(ratio) }}>
      {asset.type === 'image'
        ? <img src={asset.url} alt="" className={`w-full h-full ${fit}`} />
        : <video src={asset.url} poster={thumbnailUrl} muted playsInline preload="metadata" className={`w-full h-full ${fit}`} />}
      {safe && (
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute border border-dashed border-[#d9ff00]/70" style={{ top: `${sa.top * 100}%`, right: `${sa.right * 100}%`, bottom: `${sa.bottom * 100}%`, left: `${sa.left * 100}%` }} />
          <div className="absolute inset-x-0 top-0 bg-red-500/15" style={{ height: `${sa.top * 100}%` }} />
          <div className="absolute inset-x-0 bottom-0 bg-red-500/15" style={{ height: `${sa.bottom * 100}%` }} />
        </div>
      )}
    </div>
  )
}

export function PlatformPreviews({ asset, platforms, textFor, titleFor, thumbnailUrl, meta }: Props) {
  const [safe, setSafe] = useState(false)
  const [mobile, setMobile] = useState(true)
  const [cover, setCover] = useState(true)
  if (platforms.length === 0) return <p className="text-xs text-white/50">Select destinations in the Destinations step to preview them here. These are visual approximations; publishing still goes through MuAPI.</p>
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-[11px] text-white/70">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} /> Safe-area guides</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={mobile} onChange={(e) => setMobile(e.target.checked)} /> Mobile width</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={cover} onChange={(e) => setCover(e.target.checked)} /> Show cropping (fill)</label>
      </div>
      {platforms.map((p) => {
        const preset = PLATFORM_PRESETS[p]
        const warn = aspectWarning(p, meta.width, meta.height)
        const a = ASPECTS[preset.aspects[0]]
        const ratio = LAYOUT[p] === 'video' ? 16 / 9 : LAYOUT[p] === 'vertical' ? 9 / 16 : (a.w / a.h)
        const text = textFor(p)
        const title = titleFor(p)
        const over = text.length > preset.captionSoftMax
        return (
          <div key={p} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: ACCENT[p] }}>{PLATFORM_SPECS[p].label}</span>
              <span className={`text-[10px] ${over ? 'text-red-300' : 'text-white/40'}`}>{text.length}/{preset.hardCaptionMax ?? preset.captionSoftMax}</span>
            </div>
            {warn && <p role="note" className="mb-2 rounded bg-amber-500/10 border border-amber-500/20 px-2 py-1 text-[11px] text-amber-200">{warn}</p>}
            <div className={`mx-auto rounded-lg bg-[#111] border border-white/10 overflow-hidden ${mobile ? 'max-w-[300px]' : 'max-w-full'}`}>
              {LAYOUT[p] === 'feed' && (
                <>
                  <div className="flex items-center gap-2 p-2"><div className="w-6 h-6 rounded-full bg-white/20" /><span className="text-[11px] text-white/80">Your account</span></div>
                  <Media asset={asset} thumbnailUrl={thumbnailUrl} ratio={ratio} cover={cover} safe={safe} platform={p} />
                  <p className="p-2 text-[11px] text-white/80 whitespace-pre-wrap break-words line-clamp-6">{text || 'Your caption appears here…'}</p>
                </>
              )}
              {LAYOUT[p] === 'vertical' && (
                <div className="relative">
                  <Media asset={asset} thumbnailUrl={thumbnailUrl} ratio={ratio} cover={cover} safe={safe} platform={p} />
                  <div className="absolute left-2 right-12 bottom-3 text-[11px] text-white drop-shadow whitespace-pre-wrap break-words line-clamp-4">
                    <b>@youraccount</b><br />{title || text || 'Your caption appears here…'}
                  </div>
                </div>
              )}
              {LAYOUT[p] === 'video' && (
                <>
                  <Media asset={asset} thumbnailUrl={thumbnailUrl} ratio={ratio} cover={cover} safe={safe} platform={p} />
                  <div className="p-2"><p className="text-[12px] font-semibold text-white line-clamp-2">{title || 'Your title'}</p><p className="mt-1 text-[11px] text-white/60 line-clamp-3 whitespace-pre-wrap">{text || 'Description…'}</p></div>
                </>
              )}
            </div>
            <p className="mt-1.5 text-[10px] text-white/40">Recommended: {preset.aspects.join(' · ')}</p>
          </div>
        )
      })}
    </div>
  )
}
