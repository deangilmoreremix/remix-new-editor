'use client'

import React from 'react'
import { Settings2 } from 'lucide-react'
import type { Destination } from '../types'

const PLATFORMS: Record<string, { name: string; accent: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  youtube: { name: 'YouTube', accent: '#ff0033', icon: ({ size = 14, style }) => <svg width={size} height={size} viewBox="0 0 24 24" fill={style?.color || '#ff0033'} style={style}><path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 31.6 31.6 0 000 12a31.6 31.6 0 00.5 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1A31.6 31.6 0 0024 12a31.6 31.6 0 00-.5-5.8zM9.8 15.5V8.5L15.5 12l-5.7 3.5z"/></svg> },
  instagram: { name: 'Instagram', accent: '#e1306c', icon: ({ size = 14, style }) => <svg width={size} height={size} viewBox="0 0 24 24" fill={style?.color || '#e1306c'} style={style}><path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.69 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.23-.15-4.77-1.69-4.92-4.92-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.15-3.23 1.69-4.77 4.92-4.92C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07c-4.35.2-6.78 2.62-7 7C0 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 7 7C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 7-7C23.99 15.67 24 15.26 24 12s-.01-3.67-.07-4.95c-.2-4.35-2.62-6.78-7-7C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1012 18.16 6.16 6.16 0 0012 5.84zM12 16a4 4 0 110-8 4 4 0 010 8zm6.4-11.85a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z"/></svg> },
  tiktok: { name: 'TikTok', accent: '#d9ff00', icon: ({ size = 14, style }) => <svg width={size} height={size} viewBox="0 0 24 24" fill={style?.color || '#d9ff00'} style={style}><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13a8.28 8.28 0 005.58 2.15V11.7a4.85 4.85 0 01-3.77-1.36V6.69h3.77z"/></svg> },
  facebook: { name: 'Facebook', accent: '#1877f2', icon: ({ size = 14, style }) => <svg width={size} height={size} viewBox="0 0 24 24" fill={style?.color || '#1877f2'} style={style}><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.88v2.24h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg> },
  linkedin: { name: 'LinkedIn', accent: '#0a66c2', icon: ({ size = 14, style }) => <svg width={size} height={size} viewBox="0 0 24 24" fill={style?.color || '#0a66c2'} style={style}><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.41v1.56h.05a3.75 3.75 0 013.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 110-4.14 2.07 2.07 0 010 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.78C.8 0 0 .77 0 1.72v20.56C0 23.23.8 24 1.78 24h20.44c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/></svg> },
  pinterest: { name: 'Pinterest', accent: '#e60023', icon: ({ size = 14, style }) => <svg width={size} height={size} viewBox="0 0 24 24" fill={style?.color || '#e60023'} style={style}><path d="M12 0C5.37 0 0 5.37 0 12c0 5.08 3.15 9.43 7.6 11.18-.11-.94-.2-2.4.04-3.43.22-.94 1.4-5.94 1.4-5.94s-.36-.72-.36-1.78c0-1.67.97-2.91 2.17-2.91 1.02 0 1.52.77 1.52 1.68 0 1.02-.65 2.56-.99 3.98-.28 1.19.6 2.16 1.77 2.16 2.13 0 3.77-2.24 3.77-5.47 0-2.86-2.06-4.86-5-4.86-3.42 0-5.43 2.56-5.43 5.22 0 1.03.4 2.14.9 2.74.1.12.11.22.08.34-.09.38-.3 1.19-.34 1.36-.05.22-.18.27-.42.16-1.56-.73-2.53-3.03-2.53-4.87 0-3.97 2.89-7.6 8.33-7.6 4.37 0 7.77 3.12 7.77 7.29 0 4.36-2.75 7.86-6.56 7.86-1.28 0-2.49-.67-2.9-1.46l-.79 3.01c-.29 1.12-1.07 2.52-1.6 3.38 1.2.37 2.47.57 3.8.57 6.63 0 12-5.37 12-12S18.63 0 12 0z"/></svg> },
  threads: { name: 'Threads', accent: '#fff', icon: ({ size = 14, style }) => <svg width={size} height={size} viewBox="0 0 24 24" fill={style?.color || '#fff'} style={style}><path d="M12.6 1.15h.03c1.66 0 2.94.03 4.4.38 2.37.6 3.96 2.3 4.18 4.74.08.87.1 1.74.1 3.18 0 3.56-.07 5.76-.94 7.52-1.3 2.63-3.87 4.2-7.2 4.4-1.36.1-2.72.1-4.47.1H8.2c-3.56 0-5.5-.1-6.92-1.55C.1 18.55-.13 16.4.02 13.1c.1-2.04.6-3.9 2.32-5.32C4.3 6.4 6.4 5.94 9.3 5.8c.9-.05 1.74-.08 2.56-.1V1.15zm5.7 5.22c-.26 0-.5.03-.74.08-1.38.3-2.3 1.32-2.56 2.8-.03.2-.05.43-.05.7v.84c.68-.1 1.4-.15 2.1-.17 2.25-.06 3.3.68 3.62 2.38.1.52.13 1.06.13 1.7v.4c0 .4-.03.8-.1 1.2-.28 1.7-1.4 2.7-3.2 2.9-.38.04-.78.06-1.2.06v.04h.06c1.7 0 3.2-.3 4.3-1.2 1.4-1.1 2-2.7 2-4.7 0-1.2-.2-2.3-.7-3.2-.3-.6-.7-1.1-1.2-1.5-.3-.2-.5-.3-.9-.3zm-8.6 3.5c-.9 0-1.7.1-2.4.3-1.2.3-2 .9-2.4 1.8-.3.6-.4 1.2-.4 2v.1c0 .3 0 .6.02.9.2 2.2 1.4 3.6 3.5 3.9.3.04.6.06.92.06.7 0 1.3-.1 1.8-.3.9-.3 1.4-.9 1.6-1.7.05-.2.08-.42.08-.67v-.86c-.68.1-1.4.15-2.1.17-1.5.04-2.3-.3-2.7-1.3-.1-.3-.14-.6-.14-.9v-.1c0-.2.02-.4.05-.6.2-.8.7-1.2 1.5-1.3.3-.02.6-.03.9-.03h.03zm8.6-3.5z"/></svg> },
  x: { name: 'X', accent: '#fff', icon: ({ size = 14, style }) => <svg width={size} height={size} viewBox="0 0 24 24" fill={style?.color || '#fff'} style={style}><path d="M18.24 2.25h3.3l-7.23 8.26 8.5 11.24H16.17l-5.53-7.32L4.99 21.75H1.68l7.73-8.84L1.29 2.25H8.08l4.7 6.22 5.46-6.22zm-1.16 17.52h1.83L7.08 4.13H5.17z"/></svg> },
}

function PlatformIcon({ platform, size = 14 }: { platform: string; size?: number }) {
  const meta = PLATFORMS[platform]
  if (!meta) return null
  const Icon = meta.icon
  return <Icon size={size} style={{ color: meta.accent }} />
}

export interface DestinationsSummaryCardProps {
  destinations: Destination[]
}

export default function DestinationsSummaryCard({ destinations }: DestinationsSummaryCardProps) {
  const enabled = destinations.filter((d) => d.enabled)
  const disabled = destinations.filter((d) => !d.enabled)

  if (destinations.length === 0) {
    return (
      <div
        className="rounded-xl border p-4"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-white/40 mb-2">Destinations</h3>
        <p className="text-xs text-white/30">No destinations selected</p>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-white/40">Destinations</h3>
        <span className="text-[10px] text-white/30">{enabled.length} enabled</span>
      </div>

      <div className="space-y-2">
        {destinations.map((d) => {
          const meta = PLATFORMS[d.platform] || { name: d.platform, accent: '#d9ff00' }
          const hasSettings = d.settings && Object.keys(d.settings).length > 0
          return (
            <div
              key={d.platform}
              className="flex items-center justify-between gap-2 p-2 rounded-lg"
              style={{
                background: d.enabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                border: `1px solid ${d.enabled ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <PlatformIcon platform={d.platform} />
                <div className="min-w-0">
                  <p className={`text-xs font-medium truncate ${d.enabled ? 'text-white' : 'text-white/30'}`}>
                    {meta.name}
                  </p>
                  {d.accountName && (
                    <p className="text-[10px] text-white/40 truncate">{d.accountName}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {hasSettings && (
                  <span className="p-1 rounded-md bg-white/5 border border-white/10 text-white/40" title="Has custom settings">
                    <Settings2 size={10} />
                  </span>
                )}
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border"
                  style={{
                    color: d.enabled ? '#d9ff00' : 'rgba(255,255,255,0.2)',
                    borderColor: d.enabled ? 'rgba(217,255,0,0.3)' : 'rgba(255,255,255,0.08)',
                    background: d.enabled ? 'rgba(217,255,0,0.1)' : 'rgba(255,255,255,0.02)',
                  }}
                >
                  {d.enabled ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {disabled.length > 0 && (
        <p className="mt-2 text-[10px] text-white/20">
          {disabled.length} destination{disabled.length > 1 ? 's' : ''} disabled
        </p>
      )}
    </div>
  )
}
