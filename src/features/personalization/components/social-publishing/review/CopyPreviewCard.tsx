'use client';

import React, { useMemo } from 'react';
import { Copy } from 'lucide-react';
import type { CopyState } from '../types';
import { PlatformCopyTabs } from '../copy/PlatformCopyTabs';

const PLATFORMS = [
  { id: 'master', label: 'Master' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'pinterest', label: 'Pinterest' },
  { id: 'threads', label: 'Threads' },
  { id: 'x', label: 'X' },
];

export interface CopyPreviewCardProps {
  copy: CopyState
}

export default function CopyPreviewCard({ copy }: CopyPreviewCardProps) {
  const [active, setActive] = React.useState('master');

  const currentText = useMemo(() => {
    if (active === 'master') return copy.master;
    const pc = copy.platforms[active];
    if (!pc) return '';
    return pc.caption || pc.title || pc.description || '';
  }, [active, copy]);

  const charCount = currentText.length;

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-white/40">Copy</h3>
        <span className="text-[10px] text-white/30">{charCount} chars</span>
      </div>

      <PlatformCopyTabs
        platforms={PLATFORMS}
        active={active}
        onChange={setActive}
      />

      <div className="mt-3 relative rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs text-white/80 whitespace-pre-wrap leading-relaxed">
          {currentText || <span className="text-white/20 italic">No copy yet</span>}
        </p>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(currentText)}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
          aria-label="Copy text"
        >
          <Copy size={12} />
        </button>
      </div>

      {copy.variants?.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] text-white/30">Variants:</span>
          <div className="flex gap-1">
            {copy.variants.map((v) => (
              <span
                key={v.id}
                className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  v.id === copy.selectedVariantId
                    ? 'border-[#d9ff00]/40 bg-[#d9ff00]/10 text-[#d9ff00]'
                    : 'border-white/10 bg-white/[0.03] text-white/50'
                }`}
              >
                {v.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
