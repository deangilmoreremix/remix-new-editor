'use client'

/**
 * On-canvas rotate / resize handles for the selected layer, drawn by react-konva.
 *
 * - Konva is imported lazily; if it fails to load (or the host has no canvas, e.g. jsdom) the
 *   overlay renders nothing and the existing panel controls and corner handle keep working.
 * - The Konva canvas covers only a circle around the selected layer, and takes pointer events
 *   ONLY while the pointer is over one of its handles. Everywhere else the pointer falls through
 *   to the editor's own layers, so dragging, group-moves and snapping are untouched.
 * - It never renders pictures: it reports a rotation and a size multiplier, which the parent
 *   writes through the same pure ops (and so the same undo history) as every other edit.
 */
import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

const Impl = lazy(() => import('./KonvaTransformOverlayImpl'))

/** Konva needs a real canvas: not available under jsdom (unit tests) or when `window` is missing. */
export function konvaSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return !/jsdom/i.test(navigator.userAgent)
}

class QuietBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    // Handles are an enhancement; say why they are missing, but never break the editor.
    console.warn('[personalization] on-canvas transform handles unavailable:', error)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export interface KonvaTransformOverlayProps {
  /** Selected layer's box in the editor stage's pixel space (unrotated; centre is the pivot). */
  box: { left: number; top: number; width: number; height: number }
  rotation: number
  onRotate: (degrees: number) => void
  onResize: (multiplier: number) => void
  allowResize?: boolean
}

const HANDLE_MARGIN = 56

export function KonvaTransformOverlay({ box, rotation, onRotate, onResize, allowResize = true }: KonvaTransformOverlayProps) {
  const [interactive, setInteractive] = useState(false)
  const holdingRef = useRef(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const hitTestRef = useRef<((x: number, y: number) => boolean) | null>(null)

  const cx = box.left + box.width / 2
  const cy = box.top + box.height / 2
  const radius = Math.hypot(box.width, box.height) / 2 + HANDLE_MARGIN

  const registerHitTest = useCallback((fn: ((x: number, y: number) => boolean) | null) => {
    hitTestRef.current = fn
  }, [])

  useEffect(() => {
    const onMove = (event: PointerEvent | MouseEvent) => {
      if (holdingRef.current) return // mid-gesture: keep the canvas live
      const el = wrapRef.current
      const test = hitTestRef.current
      if (!el || !test) return
      const r = el.getBoundingClientRect()
      const x = event.clientX - r.left
      const y = event.clientY - r.top
      const inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height
      setInteractive(inside && test(x, y))
    }
    const release = () => { holdingRef.current = false }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('pointerup', release)
    window.addEventListener('mouseup', release)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('mouseup', release)
    }
  }, [])

  if (!konvaSupported()) return null
  return (
    <QuietBoundary>
      <div
        ref={wrapRef}
        data-testid="konva-transform-overlay"
        onPointerDownCapture={() => { if (interactive) holdingRef.current = true }}
        onMouseDownCapture={() => { if (interactive) holdingRef.current = true }}
        style={{
          position: 'absolute',
          left: cx - radius,
          top: cy - radius,
          width: radius * 2,
          height: radius * 2,
          pointerEvents: interactive ? 'auto' : 'none',
          zIndex: 60,
        }}
      >
        <Suspense fallback={null}>
          <Impl
            width={radius * 2}
            height={radius * 2}
            box={{ x: radius, y: radius, width: box.width, height: box.height }}
            rotation={rotation}
            onRotate={onRotate}
            onResize={onResize}
            registerHitTest={registerHitTest}
            allowResize={allowResize}
          />
        </Suspense>
      </div>
    </QuietBoundary>
  )
}
