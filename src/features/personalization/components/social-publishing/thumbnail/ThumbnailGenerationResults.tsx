'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Loader2, Download, RefreshCw, Check, Maximize2 } from 'lucide-react';
import type { ThumbnailState } from '../types';

export interface ThumbnailGenerationResultsProps {
  results: { url: string; responseId?: string; revisedPrompt?: string }[]
  selectedIndex: number | null
  onSelect: (index: number) => void
  generating: boolean
  error: string | null
  generatingCount?: number
  /** The newest partial picture while one image is still being drawn (live preview). */
  partialUrl?: string | null
  onRetry?: () => void
  onDownload?: (url: string, index: number) => void
  thumbnail?: ThumbnailState
  onUpdateThumbnail?: (t: Partial<ThumbnailState>) => void
}

const ASPECT_LABELS: Record<string, string> = {
  '16:9': 'YouTube',
  '1:1': 'Instagram',
  '4:5': 'Instagram 4:5',
  '9:16': 'Reels/TikTok',
};

export default function ThumbnailGenerationResults({
  results,
  selectedIndex,
  onSelect,
  generating,
  error,
  generatingCount = 0,
  partialUrl = null,
  onRetry,
  onDownload,
  thumbnail,
  onUpdateThumbnail,
}: ThumbnailGenerationResultsProps) {
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);

  const handleDownload = useCallback((url: string, index: number) => {
    if (onDownload) {
      onDownload(url, index);
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `thumbnail-${Date.now()}-${index + 1}.png`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [onDownload]);

  const handleSelectWithUpdate = useCallback((index: number) => {
    onSelect(index);
    if (onUpdateThumbnail && results[index]) {
      onUpdateThumbnail({
        imageUrl: results[index].url,
        responseId: results[index].responseId,
      });
    }
  }, [onSelect, onUpdateThumbnail, results]);

  return (
    <div className="space-y-3" aria-live="polite" aria-atomic="true">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">
          {generating ? `Generating${generatingCount > 1 ? ` ${generatingCount} variations` : ''}…` : 'Generation Results'}
        </p>
        {generating && (
          <span className="text-[10px] text-[#d9ff00] flex items-center gap-1.5">
            <Loader2 size={10} className="animate-spin" />
            {generatingCount > 1 ? `${generatingCount} images` : 'Processing'}
          </span>
        )}
      </div>

      {generating && partialUrl && (
        <div className="overflow-hidden rounded-xl border border-white/10" data-testid="thumbnail-live-preview">
          <img src={partialUrl} alt="Live preview while the thumbnail is drawn" className="w-full object-cover" style={{ filter: 'blur(2px)' }} />
          <p className="bg-black/50 px-2 py-1 text-[10px] text-white/60">Live preview, still drawing…</p>
        </div>
      )}

      {error && (
        <div
          className="p-3 rounded-xl text-xs"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
          role="alert"
        >
          {error}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="ml-3 text-[#d9ff00] hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Fullscreen overlay */}
      {fullscreenUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setFullscreenUrl(null)}
          role="dialog"
          aria-label="Thumbnail preview"
        >
          <img
            src={fullscreenUrl}
            alt="Full size thumbnail"
            className="max-w-full max-h-[90vh] rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setFullscreenUrl(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            aria-label="Close fullscreen"
          >
            ✕
          </button>
        </div>
      )}

      {/* Results grid */}
      {results.length > 0 && (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: results.length === 1
              ? '1fr'
              : results.length === 2
                ? 'repeat(2, 1fr)'
                : 'repeat(auto-fill, minmax(180px, 1fr))',
          }}
          role="radiogroup"
          aria-label="Generated thumbnails"
        >
          {results.map((result, index) => {
            const isSelected = selectedIndex === index;
            return (
              <div
                key={`${result.url}-${index}`}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectWithUpdate(index); } }}
                onClick={() => handleSelectWithUpdate(index)}
                className={`
                  group relative rounded-xl overflow-hidden cursor-pointer transition-all
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9ff00]/60
                `}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: `2px solid ${isSelected ? 'rgba(217,255,0,0.6)' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: isSelected ? '0 0 20px rgba(217,255,0,0.15)' : 'none',
                }}
              >
                <img
                  src={result.url}
                  alt={`Generated thumbnail ${index + 1}`}
                  className="w-full aspect-video object-cover"
                  loading="lazy"
                />

                {/* Selected checkmark */}
                {isSelected && (
                  <div className="absolute top-2 left-2 w-5 h-5 bg-[#d9ff00] rounded-full flex items-center justify-center">
                    <Check size={12} className="text-black" strokeWidth={3} />
                  </div>
                )}

                {/* Index badge */}
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 text-[9px] font-bold text-white/70">
                  {index + 1}
                </div>

                {/* Aspect ratio label */}
                {thumbnail?.aspectRatio && (
                  <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 text-[9px] font-medium text-white/50">
                    {ASPECT_LABELS[thumbnail.aspectRatio] || thumbnail.aspectRatio}
                  </div>
                )}

                {/* Hover actions */}
                <div className="absolute inset-x-0 bottom-0 p-2 flex justify-center gap-1.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity bg-gradient-to-t from-black/80 to-transparent pt-6">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFullscreenUrl(result.url); }}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                    aria-label="Preview full size"
                    title="Preview"
                  >
                    <Maximize2 size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDownload(result.url, index); }}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                    aria-label="Download thumbnail"
                    title="Download"
                  >
                    <Download size={12} />
                  </button>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onRetry(); }}
                      className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                      aria-label="Regenerate"
                      title="Regenerate"
                    >
                      <RefreshCw size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!generating && results.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-white/20">
          <div className="w-12 h-12 rounded-xl border border-white/10 flex items-center justify-center">
            <span className="text-2xl">🖼️</span>
          </div>
          <p className="text-xs">Generated thumbnails will appear here</p>
        </div>
      )}
    </div>
  );
}
