'use client'

import React from 'react'
import { Play, Image as ImageIcon } from 'lucide-react'
import type { Asset } from '../types'

const PLATFORM_STUDIOS: Record<string, { label: string; accent: string }> = {
  'Runway': { label: 'Runway', accent: '#00d4aa' },
  'Pika': { label: 'Pika', accent: '#c4e600' },
  'Kling': { label: 'Kling', accent: '#d9ff00' },
  'Midjourney': { label: 'Midjourney', accent: '#fff' },
  'DALL-E': { label: 'DALL-E', accent: '#10a37f' },
  'Flux': { label: 'Flux', accent: '#f97316' },
  'default': { label: 'AI Studio', accent: '#d9ff00' },
}

function getStudioMeta(studio?: string) {
  if (!studio) return PLATFORM_STUDIOS['default']
  const key = Object.keys(PLATFORM_STUDIOS).find((k) => studio.toLowerCase().includes(k.toLowerCase()))
  return key ? PLATFORM_STUDIOS[key] : { label: studio, accent: '#d9ff00' }
}

export interface AssetPreviewCardProps {
  asset: Asset
}

export default function AssetPreviewCard({ asset }: AssetPreviewCardProps) {
  const studioMeta = getStudioMeta(asset.studio)
  const isVideo = asset.type === 'video'
  const previewUrl = asset.thumbnailUrl || asset.url

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
    >
      <div className="relative aspect-video bg-black/40">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={asset.title || 'Asset preview'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-white/20">
            {isVideo ? <Play size={32} /> : <ImageIcon size={32} />}
          </div>
        )}
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
              <Play size={16} className="text-white ml-0.5" />
            </div>
          </div>
        )}
      </div>
      <div className="p-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-white truncate">{asset.title || 'Untitled asset'}</p>
          {asset.description && (
            <p className="text-[11px] text-white/40 mt-0.5 line-clamp-1">{asset.description}</p>
          )}
        </div>
        {asset.studio && (
          <span
            className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
            style={{
              color: studioMeta.accent,
              borderColor: `${studioMeta.accent}40`,
              background: `${studioMeta.accent}15`,
            }}
          >
            {studioMeta.label}
          </span>
        )}
      </div>
    </div>
  )
}
