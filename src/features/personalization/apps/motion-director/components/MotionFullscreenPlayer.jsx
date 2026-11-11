'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

/**
 * @param {Object} props
 * @param {string} props.url
 * @param {'video'|'image'} [props.mediaType]
 * @param {() => void} [props.onClose]
 * @param {() => void} [props.onPrev]
 * @param {() => void} [props.onNext]
 */
export default function MotionFullscreenPlayer({ url, mediaType = 'video', onClose, onPrev, onNext }) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') return onClose?.();
      if (e.key === 'ArrowLeft') return onPrev?.();
      if (e.key === 'ArrowRight') return onNext?.();
    },
    [onClose, onPrev, onNext],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  const isImage = mediaType === 'image';

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-[201] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>
      {onPrev && (
        <button
          type="button"
          onClick={onPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-[201] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-[201] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
      {isImage && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[201] flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-xl px-2 py-1.5">
          <button
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
            className="p-1 text-white hover:text-[#22d3ee] transition-colors"
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-white w-12 text-center">{zoom}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(300, z + 10))}
            className="p-1 text-white hover:text-[#22d3ee] transition-colors"
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="w-px h-5 bg-white/20" />
          <button
            onClick={() => setRotation((r) => r - 90)}
            className="p-1 text-white hover:text-[#22d3ee] transition-colors"
            aria-label="Rotate left"
            title="Rotate left"
          >
            <RotateCw className="w-4 h-4 -scale-x-1" />
          </button>
          <button
            onClick={() => setRotation((r) => r + 90)}
            className="p-1 text-white hover:text-[#22d3ee] transition-colors"
            aria-label="Rotate right"
            title="Rotate right"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      )}
      {isImage ? (
        <img
          src={url}
          alt="fullscreen"
          className="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-2xl object-contain"
          style={{ transform: `rotate(${rotation}deg) scale(${zoom / 100})` }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <video
          src={url}
          autoPlay
          loop
          controls
          className="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}
