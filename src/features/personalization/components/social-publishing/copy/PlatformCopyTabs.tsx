'use client'

import React from 'react'

export interface PlatformCopyTabsProps {
  platforms: Array<{ id: string; label: string }>
  active: string
  onChange: (id: string) => void
}

export function PlatformCopyTabs({ platforms, active, onChange }: PlatformCopyTabsProps) {
  return (
    <div
      className="flex items-center gap-1 rounded-xl border p-1 overflow-x-auto"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      role="tablist"
      aria-label="Platform copy tabs"
    >
      {platforms.map((platform) => {
        const isActive = active === platform.id
        return (
          <button
            key={platform.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(platform.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              isActive
                ? 'bg-[#d9ff00]/15 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            {platform.label}
          </button>
        )
      })}
    </div>
  )
}
