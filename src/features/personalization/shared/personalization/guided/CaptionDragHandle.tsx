'use client'

import { useRef } from 'react'
import { GripVertical } from 'lucide-react'
import { gripY, offsetFromDrag, offsetFromKey, type DragPosition } from '../captions/captionDrag'
import { MAX_CAPTION_OFFSET } from '../captions/captionCustom'

/**
 * A grip at the left edge of the live preview, level with the captions: drag it up or down to move them (or use the arrow keys, Home to put them back).
 * Small on purpose, so it never covers a layer's own handles. Must be a child of the stage (its parent is measured). Identical in both repos.
 */
export function CaptionDragHandle({ position, offsetY, onChange, onRelease }: {
  position: DragPosition
  offsetY: number | undefined
  onChange: (offsetY: number | undefined) => void
  /** Called when a drag ends (not for a click or a key press): the place to keep the captions clear of other text. */
  onRelease?: () => void
}): React.JSX.Element {
  const drag = useRef<{ startY: number; startOffset: number | undefined; stageH: number } | null>(null)
  const set = (v: number | undefined) => onChange(v === undefined || Math.abs(v) < 0.005 ? undefined : v)
  const pct = Math.round((offsetY ?? 0) * 100)
  return (
    <div
      data-testid="caption-drag-handle"
      role="slider"
      tabIndex={0}
      aria-label="Move the captions up or down"
      aria-orientation="vertical"
      aria-valuemin={-Math.round(MAX_CAPTION_OFFSET * 100)}
      aria-valuemax={Math.round(MAX_CAPTION_OFFSET * 100)}
      aria-valuenow={pct}
      aria-valuetext={pct === 0 ? 'In its place' : `${Math.abs(pct)} percent ${pct > 0 ? 'up' : 'down'}`}
      title="Drag to move the captions. Arrow keys nudge, Home puts them back."
      style={{ position: 'absolute', left: 6, top: `${Math.round(gripY(position, offsetY) * 1000) / 10}%`, transform: 'translateY(-50%)', zIndex: 950, width: 26, height: 34, display: 'grid', placeItems: 'center', borderRadius: 8, background: 'rgba(5,7,10,.62)', border: '1px solid rgba(255,255,255,.35)', color: '#fff', cursor: 'ns-resize', touchAction: 'none', userSelect: 'none' }}
      onPointerDown={(e) => {
        e.stopPropagation()
        const stage = e.currentTarget.parentElement
        drag.current = { startY: e.clientY, startOffset: offsetY, stageH: stage ? stage.getBoundingClientRect().height : 0 }
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not capturable: moves still arrive while the pointer stays over the grip */ }
      }}
      onPointerMove={(e) => { const d = drag.current; if (d) set(offsetFromDrag(d.startOffset, e.clientY - d.startY, d.stageH)) }}
      onPointerUp={(e) => { const was = drag.current !== null; drag.current = null; try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* nothing held */ } if (was) onRelease?.() }}
      onPointerCancel={() => { drag.current = null }}
      onDoubleClick={() => onChange(undefined)}
      onKeyDown={(e) => {
        if (e.key === 'Home') { e.preventDefault(); onChange(undefined); return }
        const next = offsetFromKey(offsetY, e.key, e.shiftKey)
        if (next !== undefined) { e.preventDefault(); set(next) }
      }}
    >
      <GripVertical size={14} aria-hidden />
    </div>
  )
}
