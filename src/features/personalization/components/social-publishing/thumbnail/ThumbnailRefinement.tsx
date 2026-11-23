'use client';

import React, { useState, useCallback } from 'react';
import { RefreshCw, Wand2, Loader2 } from 'lucide-react';
import { refineThumbnail, type ThumbnailRefineResult } from '@ohb/shared/api/thumbnailService';

const QUICK_CHIPS = [
  { id: 'dramatic', label: 'More dramatic' },
  { id: 'cleaner', label: 'Cleaner' },
  { id: 'brighter', label: 'Brighter' },
  { id: 'face-larger', label: 'Face larger' },
  { id: 'contrast', label: 'More contrast' },
  { id: 'diff-bg', label: 'Different background' },
  { id: 'professional', label: 'More professional' },
  { id: 'negative-space', label: 'More negative space' },
  { id: 'similar', label: 'Generate similar' },
] as const;

const CHIP_PROMPTS: Record<string, string> = {
  'dramatic': 'Make this more dramatic with stronger lighting, higher contrast, and more impactful composition.',
  'cleaner': 'Clean up the composition, remove clutter, use simpler background, more minimalist design.',
  'brighter': 'Increase overall brightness, use lighter color palette, airy and luminous feel.',
  'face-larger': 'Make the face/central figure larger and more prominent in the frame, closer crop.',
  'contrast': 'Increase contrast significantly, deeper blacks, more saturated colors, punchier look.',
  'diff-bg': 'Change the background to something completely different while keeping the main subject.',
  'professional': 'Make this look more professional and polished, corporate-grade quality, refined aesthetic.',
  'negative-space': 'Add much more negative space, minimalist layout, subject smaller and off-center.',
  'similar': 'Generate a variation similar to this image, keeping the same style and composition.',
}

export interface ThumbnailRefinementProps {
  sourceImageUrl: string | null
  aspectRatio?: string
  disabled?: boolean
  onResults: (results: ThumbnailRefineResult[]) => void
  onError?: (error: string) => void
  muapiKey?: string
}

export default function ThumbnailRefinement({
  sourceImageUrl,
  aspectRatio = '16:9',
  disabled = false,
  onResults,
  onError,
}: ThumbnailRefinementProps) {
  const [refinementPrompt, setRefinementPrompt] = useState('')
  const [selectedChip, setSelectedChip] = useState<string | null>(null)
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)

  const handleChipClick = useCallback((chipId: string) => {
    setSelectedChip(prev => prev === chipId ? null : chipId)
    if (chipId !== selectedChip) {
      setRefinementPrompt(CHIP_PROMPTS[chipId] || '')
    }
  }, [selectedChip])

  const handleRefine = useCallback(async () => {
    if (!sourceImageUrl || !refinementPrompt.trim() || refining) return

    setRefining(true)
    setRefineError(null)

    try {
      const results = await refineThumbnail({
        imageUrl: sourceImageUrl,
        prompt: refinementPrompt.trim(),
        aspectRatio,
        n: 1,
        strength: selectedChip === 'similar' ? 0.3 : 0.5,
      })
      onResults(results)
      setSelectedChip(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Refinement failed'
      setRefineError(message)
      onError?.(message)
    } finally {
      setRefining(false)
    }
  }, [sourceImageUrl, refinementPrompt, aspectRatio, refining, selectedChip, onResults, onError])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleRefine()
    }
  }

  if (!sourceImageUrl) {
    return (
      <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01] text-white/20 text-xs text-center">
        <Wand2 size={16} className="mx-auto mb-2 opacity-50" />
        Generate a thumbnail first to enable refinement.
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4 rounded-xl border border-white/8 bg-white/[0.02]" aria-live="polite">
      <div className="flex items-center gap-2">
        <RefreshCw size={13} className="text-[#d9ff00]" />
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">
          Refine thumbnail
        </p>
      </div>

      {/* Quick chips */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick refinement options">
        {QUICK_CHIPS.map(chip => {
          const isActive = selectedChip === chip.id
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => handleChipClick(chip.id)}
              disabled={disabled || refining}
              aria-pressed={isActive}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all disabled:opacity-40"
              style={{
                background: isActive ? 'rgba(217,255,0,0.15)' : 'rgba(255,255,255,0.05)',
                color: isActive ? '#d9ff00' : 'rgba(255,255,255,0.5)',
                border: `1px solid ${isActive ? 'rgba(217,255,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {/* Freeform refinement input */}
      <div className="relative">
        <textarea
          value={refinementPrompt}
          onChange={(e) => setRefinementPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what to change… e.g. 'swap the background for a city skyline at sunset'"
          rows={2}
          disabled={disabled || refining}
          className="w-full resize-none text-xs outline-none rounded-lg p-3 pr-10 transition-colors disabled:opacity-50"
          style={{ background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
          aria-label="Refinement prompt"
        />
        <button
          type="button"
          onClick={handleRefine}
          disabled={disabled || refining || !refinementPrompt.trim() || !sourceImageUrl}
          className="absolute bottom-2 right-2 p-1.5 rounded-lg transition-all disabled:opacity-30"
          style={{ background: 'rgba(217,255,0,0.15)' }}
          aria-label="Apply refinement"
          title="Apply refinement"
        >
          {refining
            ? <Loader2 size={13} className="animate-spin text-[#d9ff00]" />
            : <Wand2 size={13} className="text-[#d9ff00]" />
          }
        </button>
      </div>

      {refineError && (
        <div className="p-2 rounded-lg text-[11px] text-red-400" style={{ background: 'rgba(239,68,68,0.1)' }} role="alert">
          {refineError}
        </div>
      )}

      <p className="text-[10px] text-white/25">
        Uses image-to-image generation. Results replace the current selection.
      </p>
    </div>
  )
}
