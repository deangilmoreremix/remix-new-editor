'use client'

/**
 * The presenter's box on the editor stage (Stage 3): an outline you can drag to reposition the camera bubble / PiP.
 * The drag is local until you let go, so one drag is one undo step; the position is clamped so the box stays in frame.
 * Keyboard: arrow keys nudge by 1% (10% with Shift).
 */
import { useRef, useState } from 'react'
import type { PersonalizationPreviewSettings } from '../preview/types'
import { boxCentreFor, presenterRect } from '../preview/presenter'
import { patchPresenter } from './presenterEdit'
import { C } from './tokens'

export function PresenterStageBox({ settings, edit, factor, compW, compH }: {
  settings: PersonalizationPreviewSettings
  edit: (fn: (prev: PersonalizationPreviewSettings) => PersonalizationPreviewSettings) => void
  /** Stage pixels per composition pixel. */
  factor: number
  compW: number
  compH: number
}) {
  const p = settings.presenter
  const [drag, setDrag] = useState<null | { dx: number; dy: number }>(null)
  const start = useRef<null | { x: number; y: number }>(null)
  if (!p || !p.enabled || p.layout === 'full') return null
  const rect = presenterRect(p, compW, compH)
  const commit = (left: number, top: number) => {
    const c = boxCentreFor(p, compW, compH, left, top)
    edit((prev) => patchPresenter(prev, { box: { x: c.x, y: c.y } }))
  }
  const dx = drag?.dx ?? 0
  const dy = drag?.dy ?? 0
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Presenter position. Drag, or use the arrow keys, to move."
      data-testid="stage-presenter"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId)
        start.current = { x: e.clientX, y: e.clientY }
        setDrag({ dx: 0, dy: 0 })
      }}
      onPointerMove={(e) => {
        if (!start.current) return
        setDrag({ dx: (e.clientX - start.current.x) / factor, dy: (e.clientY - start.current.y) / factor })
      }}
      onPointerUp={(e) => {
        if (!start.current) return
        const moved = { dx: (e.clientX - start.current.x) / factor, dy: (e.clientY - start.current.y) / factor }
        start.current = null
        setDrag(null)
        if (Math.abs(moved.dx) + Math.abs(moved.dy) > 0.5) commit(rect.left + moved.dx, rect.top + moved.dy)
      }}
      onPointerCancel={() => { start.current = null; setDrag(null) }}
      onKeyDown={(e) => {
        const step = (e.shiftKey ? 0.1 : 0.01)
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key as 'ArrowLeft']
        if (!d) return
        e.preventDefault()
        commit(rect.left + d[0] * compW, rect.top + d[1] * compH)
      }}
      style={{
        position: 'absolute',
        left: (rect.left + dx) * factor,
        top: (rect.top + dy) * factor,
        width: rect.width * factor,
        height: rect.height * factor,
        borderRadius: rect.radiusPx * factor,
        border: `2px dashed ${C.cyan}`,
        background: 'rgba(34,211,238,.10)',
        cursor: drag ? 'grabbing' : 'grab',
        touchAction: 'none',
        zIndex: 3,
      }}
    />
  )
}
