import React, { useMemo } from 'react'
import { captionLayout, captionPages, pageAt, wordColor, type CaptionTrack } from './captions'
import { fontStackById } from './presets'

/**
 * Draws the caption page that is showing at `frame` (Stage 6). A pure function of the track and the frame, so the Player,
 * the stage and the export show the same words at the same moments, in the same colours.
 */
export const CaptionsLayer: React.FC<{ track: CaptionTrack; frame: number; fps: number; compW: number; compH: number }> = ({ track, frame, fps, compW, compH }) => {
  const { style } = track
  const pages = useMemo(() => captionPages(track.cues, style), [track.cues, style])
  const ms = (frame / Math.max(1, fps)) * 1000
  const page = pageAt(pages, ms)
  if (!page) return null
  const layout = captionLayout(style, compW, compH)
  // The outline is a ring of text-shadows, NOT -webkit-text-stroke: a stroke is centred on the glyph edge and eats half of a thin
  // white fill, which made small captions read as dark text (found in the Stage 6 export check).
  const r = Math.max(1, Math.round(layout.fontPx * 0.045 * 10) / 10)
  const ring = style.stroke ? [[-r, 0], [r, 0], [0, -r], [0, r], [-r, -r], [r, -r], [-r, r], [r, r]].map(([x, y]) => `${x}px ${y}px 0 #000`) : []
  const soft = `0 ${Math.round(layout.fontPx * 0.06)}px ${Math.round(layout.fontPx * 0.18)}px rgba(0,0,0,${style.background ? 0 : 0.7})`
  const textShadow = [...ring, ...(style.background ? [] : [soft])].join(', ') || undefined
  const place: React.CSSProperties = layout.centered
    ? { top: '50%', transform: 'translateY(-50%)' }
    : layout.topPx !== null ? { top: layout.topPx } : { bottom: layout.bottomPx ?? 0 }
  return (
    <div data-captions="" data-caption-position={style.position} style={{ position: 'absolute', left: 0, right: 0, zIndex: 9000, pointerEvents: 'none', display: 'flex', justifyContent: 'center', ...place }}>
      <div
        style={{
          maxWidth: layout.maxWidthPx, textAlign: 'center', fontFamily: fontStackById(), fontSize: layout.fontPx, lineHeight: 1.25, fontWeight: style.bold ? 800 : 600,
          whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
          ...(style.background ? { background: style.backgroundColor, padding: `${Math.round(layout.fontPx * 0.25)}px ${Math.round(layout.fontPx * 0.5)}px`, borderRadius: Math.round(layout.fontPx * 0.3) } : {}),
          textShadow,
        }}
      >
        {page.tokens.map((t, i) => (
          <span key={`${i}-${t.fromMs}`} data-caption-word="" style={{ color: wordColor(style, t, ms) }}>
            {style.uppercase ? t.text.toUpperCase() : t.text}
          </span>
        ))}
      </div>
    </div>
  )
}
