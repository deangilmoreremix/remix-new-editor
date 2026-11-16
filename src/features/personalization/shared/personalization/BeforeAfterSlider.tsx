'use client'

/**
 * Before / After comparison: the original image on the left of the divider,
 * the transparent cutout (on a checkerboard) on the right. Drag anywhere, or
 * use the keyboard on the range input.
 */

import { useRef, useState, type PointerEvent } from 'react'
import { C } from './guided/tokens'

export const CHECKERBOARD = 'repeating-conic-gradient(#3a3a40 0% 25%, #232327 0% 50%) 50% / 16px 16px'

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  alt = 'Asset',
}: {
  beforeUrl: string
  afterUrl: string
  alt?: string
}) {
  const [pos, setPos] = useState(50)
  const box = useRef<HTMLDivElement>(null)

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const rect = box.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    setPos(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)))
  }

  return (
    <div
      ref={box}
      data-testid="before-after-slider"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId)
        move(e)
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) move(e)
      }}
      style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', maxHeight: '100%', touchAction: 'none', cursor: 'ew-resize', userSelect: 'none', borderRadius: 8, overflow: 'hidden', background: CHECKERBOARD }}
    >
      {/* After: sizes the box. */}
      <img
        src={afterUrl}
        alt={`${alt} with background removed`}
        draggable={false}
        style={{ display: 'block', maxWidth: '100%', maxHeight: 'calc(100vh - 220px)', objectFit: 'contain' }}
      />
      {/* Before: clipped to the left of the divider. */}
      <img
        src={beforeUrl}
        alt={`${alt} original`}
        draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      <div
        aria-hidden="true"
        style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos}%`, width: 2, marginLeft: -1, background: C.cyan, pointerEvents: 'none' }}
      />
      <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', background: 'rgba(0,0,0,.65)', color: 'white', borderRadius: 6, padding: '2px 6px', pointerEvents: 'none' }}>
        Original
      </span>
      <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', background: 'rgba(0,0,0,.65)', color: 'white', borderRadius: 6, padding: '2px 6px', pointerEvents: 'none' }}>
        Cutout
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(pos)}
        onChange={(e) => setPos(Number(e.target.value))}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Before and after position"
        style={{ position: 'absolute', left: 8, right: 8, bottom: 6, width: 'calc(100% - 16px)', opacity: 0.85, accentColor: C.cyan }}
      />
    </div>
  )
}
