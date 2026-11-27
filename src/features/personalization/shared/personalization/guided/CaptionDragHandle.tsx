'use client'

import { useRef } from 'react'
import { GripVertical } from 'lucide-react'
import { MAX_Y, MIN_Y, yFromDrag, yFromKey } from '../captions/captionDrag'

/**
 * A grip at the left edge of the live preview, level with the captions: drag it up or down to move them (or use the arrow keys, Home to put them
 * back in their place). Small on purpose, so it never covers a layer's own handles. Must be a child of the stage (its parent is measured).
 * `y` is the middle of the captions as a fraction of the frame height from the top. Identical in both repos.
 */
export function CaptionDragHandle({ y, onChange, onRelease }: {
  y: number
  onChange: (y: number | undefined) => void
  /** Called when a drag that moved the captions ends (not for a click, a press that never moved, or a key press). */
  onRelease?: () => void
}): React.JSX.Element {
  const drag = useRef<{ startY: number; startHeight: number; stageH: number; moved: boolean } | null>(null)
  const at = Math.min(MAX_Y, Math.max(MIN_Y, y))
  const pct = Math.round(at * 100)
  return (
    <div
      data-testid="caption-drag-handle"
      role="slider"
      tabIndex={0}
      aria-label="Move the captions up or down"
      aria-orientation="vertical"
      aria-valuemin={Math.round(MIN_Y * 100)}
      aria-valuemax={Math.round(MAX_Y * 100)}
      aria-valuenow={pct}
      aria-valuetext={`${pct} percent from the top`}
      title="Drag to move the captions. Arrow keys nudge, Home puts them back."
      style={{ position: 'absolute', left: 6, top: `${Math.round(at * 1000) / 10}%`, transform: 'translateY(-50%)', zIndex: 950, width: 26, height: 34, display: 'grid', placeItems: 'center', borderRadius: 8, background: 'rgba(5,7,10,.62)', border: '1px solid rgba(255,255,255,.35)', color: '#fff', cursor: 'ns-resize', touchAction: 'none', userSelect: 'none' }}
      onPointerDown={(e) => {
        e.stopPropagation()
        const stage = e.currentTarget.parentElement
        drag.current = { startY: e.clientY, startHeight: at, stageH: stage ? stage.getBoundingClientRect().height : 0, moved: false }
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not capturable: moves still arrive while the pointer stays over the grip */ }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        const next = yFromDrag(d.startHeight, e.clientY - d.startY, d.stageH)
        if (next !== d.startHeight) d.moved = true
        onChange(next)
      }}
      onPointerUp={(e) => {
        const d = drag.current
        drag.current = null
        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* nothing held */ }
        if (d?.moved) onRelease?.()
      }}
      onPointerCancel={() => { drag.current = null }}
      onDoubleClick={() => onChange(undefined)}
      onKeyDown={(e) => {
        if (e.key === 'Home') { e.preventDefault(); onChange(undefined); return }
        const next = yFromKey(at, e.key, e.shiftKey)
        if (next !== undefined) { e.preventDefault(); onChange(next) }
      }}
    >
      <GripVertical size={14} aria-hidden />
    </div>
  )
}
