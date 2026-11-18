'use client'

import React from 'react'
import {
  Sparkles,
  Wand2,
  MessageSquare,
  AlignLeft,
  Target,
  Hash,
  Type,
  ChevronDown,
  Loader2,
} from 'lucide-react'

type Action = 'write' | 'improve' | 'hook' | 'cta' | 'hashtags' | 'tone' | 'length' | 'platformize' | 'refine'
type Tone = 'professional' | 'conversational' | 'persuasive'
type Length = 'short' | 'medium' | 'long'

export interface AiWritingToolbarProps {
  onAction: (action: Action, tone?: Tone, length?: Length) => void
  loading: boolean
  disabled?: boolean
}

export function AiWritingToolbar({ onAction, loading, disabled }: AiWritingToolbarProps) {
  const [toneOpen, setToneOpen] = React.useState(false)
  const [lengthOpen, setLengthOpen] = React.useState(false)
  const [platformOpen, setPlatformOpen] = React.useState(false)

  const toneOptions: { value: Tone; label: string }[] = [
    { value: 'professional', label: 'Professional' },
    { value: 'conversational', label: 'Conversational' },
    { value: 'persuasive', label: 'Persuasive' },
  ]

  const lengthOptions: { value: Length; label: string }[] = [
    { value: 'short', label: 'Short' },
    { value: 'medium', label: 'Medium' },
    { value: 'long', label: 'Long' },
  ]

  const platformOptions = [
    { value: 'youtube', label: 'YouTube' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'facebook', label: 'Facebook' },
  ]

  const [selectedPlatform, setSelectedPlatform] = React.useState('youtube')

  function handleToneSelect(tone: Tone) {
    setToneOpen(false)
    onAction('tone', tone)
  }

  function handleLengthSelect(length: Length) {
    setLengthOpen(false)
    onAction('length', undefined, length)
  }

  function handlePlatformSelect(platform: string) {
    setSelectedPlatform(platform)
    setPlatformOpen(false)
    onAction('platformize', undefined, undefined)
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <button
        type="button"
        onClick={() => onAction('write')}
        disabled={loading || disabled}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#d9ff00] text-black hover:bg-[#d9ff00]/90 transition-all disabled:opacity-40"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        Write Post
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setToneOpen((v) => !v)}
          disabled={loading || disabled}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-white/80 hover:bg-white/10 border border-white/10 transition-all disabled:opacity-40"
        >
          <Wand2 size={14} />
          Improve
          <ChevronDown size={12} />
        </button>
        {toneOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setToneOpen(false)} />
            <div className="absolute z-20 mt-1 w-40 rounded-lg border border-white/10 bg-[#111] py-1 shadow-xl">
              {toneOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onAction('improve')}
                  className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/10 hover:text-white"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setToneOpen((v) => !v)}
          disabled={loading || disabled}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-white/80 hover:bg-white/10 border border-white/10 transition-all disabled:opacity-40"
        >
          <MessageSquare size={14} />
          Tone
          <ChevronDown size={12} />
        </button>
        {toneOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setToneOpen(false)} />
            <div className="absolute z-20 mt-1 w-40 rounded-lg border border-white/10 bg-[#111] py-1 shadow-xl">
              {toneOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleToneSelect(opt.value)}
                  className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/10 hover:text-white"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setLengthOpen((v) => !v)}
          disabled={loading || disabled}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-white/80 hover:bg-white/10 border border-white/10 transition-all disabled:opacity-40"
        >
          <AlignLeft size={14} />
          Length
          <ChevronDown size={12} />
        </button>
        {lengthOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setLengthOpen(false)} />
            <div className="absolute z-20 mt-1 w-40 rounded-lg border border-white/10 bg-[#111] py-1 shadow-xl">
              {lengthOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleLengthSelect(opt.value)}
                  className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/10 hover:text-white"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setPlatformOpen((v) => !v)}
          disabled={loading || disabled}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-white/80 hover:bg-white/10 border border-white/10 transition-all disabled:opacity-40"
        >
          <Target size={14} />
          Platform Optimize
          <ChevronDown size={12} />
        </button>
        {platformOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setPlatformOpen(false)} />
            <div className="absolute z-20 mt-1 w-40 rounded-lg border border-white/10 bg-[#111] py-1 shadow-xl">
              {platformOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handlePlatformSelect(opt.value)}
                  className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/10 hover:text-white"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
