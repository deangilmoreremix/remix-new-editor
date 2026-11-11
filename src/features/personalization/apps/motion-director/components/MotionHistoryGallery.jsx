'use client';

import { useCallback, useState } from 'react';
import { Copy, Download, Play, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { getPosterFrameUrl, formatTime } from '../lib/thumbnailUtils';
import MotionFullscreenPlayer from './MotionFullscreenPlayer';

const ACTIONS = [
  { icon: Copy, label: 'Copy' },
  { icon: RefreshCw, label: 'Remix' },
  { icon: Download, label: 'Download' },
  { icon: Trash2, label: 'Delete' },
];

const modeTag = (session) => (session.sourceSessionId ? 'Remix' : 'Generated');

export default function MotionHistoryGallery({
  sessions = [],
  onSelect,
  onRemix,
  onDownload,
  onDelete,
  generating = false,
  entryCount = 0,
}) {
  const [hoveredId, setHoveredId] = useState(null);
  const [fullscreenIdx, setFullscreenIdx] = useState(null);

  const handleCopy = useCallback((url) => {
    navigator.clipboard?.writeText(url);
  }, []);

  const handleDownload = useCallback((url, name) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${String(name).replace(/\s+/g, '_')}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const handleAction = useCallback(
    (action, session, poster) => {
      if (action === 'Copy') {
        handleCopy(poster);
      } else if (action === 'Remix') {
        onRemix?.(session);
      } else if (action === 'Download') {
        handleDownload(poster, session.name);
      } else if (action === 'Delete') {
        onDelete?.(session.id);
      }
    },
    [onRemix, onDownload, onDelete, handleCopy, handleDownload],
  );

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div
          className="relative w-24 h-24 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4 shadow-xl"
          style={animationStyle(0)}
        >
          <Play className="w-12 h-12 text-white/30" />
        </div>
        <div className="relative w-24 h-16 rounded-xl bg-white/[0.03] border border-white/[0.04] mb-6 flex items-center justify-center" style={animationStyle(1)}>
          <Play className="w-8 h-8 text-white/20" />
        </div>
        <div className="relative w-32 h-20 rounded-lg bg-white/[0.03] border border-white/[0.04] flex items-center justify-center" style={animationStyle(2)}>
          <Play className="w-7 h-7 text-white/20" />
        </div>
        <h2 className="text-xl font-semibold text-white">No history yet</h2>
        <p className="mt-2 text-sm text-white/40 max-w-xs">
          Generate your first motion video to see it appear here with a
          poster-frame thumbnail.
        </p>
        <p className="mt-1 text-xs text-white/30">{entryCount} entries</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {generating && (
        <div className="col-span-3 flex flex-col items-center justify-center pt-8 pb-4">
          <Loader2 className="w-7 h-7 text-[#22d3ee] animate-spin" />
          <span className="mt-2 text-sm text-white/60">Generating video…</span>
        </div>
      )}
      {sessions.map((session, index) => {
        const poster = getPosterFrameUrl(session);
        const duration = formatTime(session.duration ?? 0);
        const isHovered = hoveredId === session.id;
        return (
          <div
            key={session.id}
            className="relative flex flex-col"
            onMouseEnter={() => setHoveredId(session.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div
              className="relative aspect-video rounded-xl overflow-hidden border border-white/[0.08] bg-[#0a0a0a] cursor-pointer group"
              onClick={() => onSelect?.(session)}
              onDoubleClick={() => setFullscreenIdx(index)}
            >
              <video
                className="w-full h-full object-cover"
                src={poster}
                poster={poster}
                muted
                loop
                playsInline
                onLoadedMetadata={(e) => {
                  const video = e.target;
                  if (video.duration) video.currentTime = video.duration * 0.45;
                }}
              />
              <span
                className="absolute top-2 left-2 z-20 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm border border-white/10 text-[10px] font-semibold text-white"
              >
                {modeTag(session)}
              </span>
              {isHovered ? (
                <div className="absolute top-2 right-2 z-30 flex flex-col gap-1">
                  {ACTIONS.map(({ icon: Icon, label }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(label, session, poster);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-md bg-black/80 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-colors"
                      aria-label={label}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="absolute bottom-2 left-2 right-2 z-20 flex items-end justify-between px-3 pb-2 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                  <div className="flex items-center gap-1.5 text-xs text-white">
                    <Play className="w-3 h-3 text-[#22d3ee]" />
                    <span className="truncate max-w-[140px]">{session.name}</span>
                  </div>
                  <span className="text-xs text-white/50">{duration}</span>
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-white truncate" title={session.name}>
                {session.name}
              </h3>
              {session.prompt ? (
                <p className="text-[11px] text-white/40 line-clamp-2">{session.prompt}</p>
              ) : null}
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-white/40">
                <span>{session.aspectRatio ?? '16:9'}</span>
                <span className="mx-0.5">·</span>
                <span>{duration}</span>
              </div>
            </div>
          </div>
        );
      })}
      {fullscreenIdx !== null && (
        <MotionFullscreenPlayer
          url={getPosterFrameUrl(sessions[fullscreenIdx])}
          mediaType="video"
          onClose={() => setFullscreenIdx(null)}
          onPrev={() => setFullscreenIdx((i) => (i > 0 ? i - 1 : i))}
          onNext={() => setFullscreenIdx((i) => (i < sessions.length - 1 ? i + 1 : i))}
        />
      )}
    </div>
  );
}

const animationStyle = (index) => {
  const delay = index * 0.25;
  const name = [`float${index}`, `float${index}`];
  return {
    animation: `float${index} 7s ease-in-out infinite`,
    animationDelay: `${delay}s`,
  };
};
