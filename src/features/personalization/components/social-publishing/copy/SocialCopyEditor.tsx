'use client';

import React from 'react';
import { Loader2, Hash } from 'lucide-react';

export interface SocialCopyEditorProps {
  text: string
  onChange: (text: string) => void
  counts: { chars: number; words: number; hashCount: number }
  warnings: string[]
  loading: boolean
}

export function SocialCopyEditor({
  text,
  onChange,
  counts,
  warnings,
  loading,
}: SocialCopyEditorProps) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <label className="block text-[11px] font-bold uppercase tracking-wide text-white/40">
          Social copy
        </label>
        <div className="flex items-center gap-3 text-[11px] text-white/40">
          <span>{counts.chars} chars</span>
          <span>{counts.words} words</span>
          <span className="flex items-center gap-1">
            <Hash size={11} />
            {counts.hashCount}
          </span>
        </div>
      </div>

      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write or generate your post copy here…"
          rows={8}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#d9ff00]/50 resize-none"
          aria-label="Social copy"
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30 backdrop-blur-[1px]">
            <Loader2 size={18} className="animate-spin text-[#d9ff00]" />
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <div
          aria-live="polite"
          className="mt-2 flex flex-wrap gap-2"
        >
          {warnings.map((w, idx) => (
            <span
              key={idx}
              className="text-[11px] px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300"
            >
              {w}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
