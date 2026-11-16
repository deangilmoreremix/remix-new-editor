'use client'

import React from 'react'
import { Sparkles, Loader2 } from 'lucide-react'

export interface CopyVariantCardsProps {
  variants: Array<{ id: string; label: string; text: string }>
  selectedId?: string
  onSelect: (id: string) => void
  onGenerate: () => void
  loading: boolean
}

export function CopyVariantCards({
  variants,
  selectedId,
  onSelect,
  onGenerate,
  loading,
}: CopyVariantCardsProps) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <label className="block text-[11px] font-bold uppercase tracking-wide text-white/40">
          Copy variants
        </label>
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#d9ff00]/10 text-[#d9ff00] text-xs font-medium hover:bg-[#d9ff00]/20 transition-all disabled:opacity-40"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          Generate
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {variants.map((variant) => {
          const isActive = selectedId === variant.id
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(variant.id)}
              className={`text-left p-3 rounded-lg border transition-all ${
                isActive
                  ? 'border-[#d9ff00]/60 bg-[#d9ff00]/10'
                  : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              <p className="text-[11px] font-semibold text-white/60 mb-1.5">{variant.label}</p>
              <p className="text-xs text-white/80 line-clamp-4 whitespace-pre-wrap">
                {variant.text || (
                  <span className="text-white/30 italic">No copy yet</span>
                )}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
