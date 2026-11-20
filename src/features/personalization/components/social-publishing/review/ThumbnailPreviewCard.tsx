'use client';

import React from 'react';
import { ImageIcon, Type } from 'lucide-react';
import type { ThumbnailState } from '../types';

const ASPECT_COLORS: Record<string, string> = {
  '16:9': '#d9ff00',
  '1:1': '#c4e600',
  '4:5': '#f97316',
  '9:16': '#ff0033',
};

export interface ThumbnailPreviewCardProps {
  thumbnail: ThumbnailState
}

export default function ThumbnailPreviewCard({ thumbnail }: ThumbnailPreviewCardProps) {
  const aspectColor = ASPECT_COLORS[thumbnail.aspectRatio || ''] || '#d9ff00';
  const hasOverlay = !!(thumbnail.templateId || thumbnail.values);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
    >
      <div className="relative aspect-video bg-black/40">
        {thumbnail.imageUrl ? (
          <img
            src={thumbnail.imageUrl}
            alt="Thumbnail preview"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <ImageIcon size={28} className="text-white/20 mx-auto mb-1" />
              <p className="text-[10px] text-white/20">No thumbnail generated</p>
            </div>
          </div>
        )}

        {hasOverlay && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center px-4 max-w-[80%]">
              {thumbnail.values?.headline && (
                <p className="text-sm font-bold text-white drop-shadow-lg leading-tight" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                  {thumbnail.values.headline}
                </p>
              )}
              {thumbnail.values?.subheadline && (
                <p className="text-[10px] text-white/90 mt-1 drop-shadow-md" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                  {thumbnail.values.subheadline}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {thumbnail.templateId && (
            <span className="text-[10px] font-medium text-white/60 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 truncate">
              {thumbnail.templateId}
            </span>
          )}
          {hasOverlay && (
            <span className="flex items-center gap-1 text-[10px] text-white/40">
              <Type size={10} />
              Text overlay
            </span>
          )}
        </div>
        {thumbnail.aspectRatio && (
          <span
            className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border"
            style={{
              color: aspectColor,
              borderColor: `${aspectColor}40`,
              background: `${aspectColor}15`,
            }}
          >
            {thumbnail.aspectRatio}
          </span>
        )}
      </div>
    </div>
  );
}
