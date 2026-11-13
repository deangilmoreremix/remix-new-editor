'use client'

/**
 * The react-konva half of the on-canvas transform handles. Loaded lazily (see
 * `KonvaTransformOverlay.tsx`) so Konva never lands in the main bundle.
 *
 * It draws ONE invisible proxy rectangle for the selected layer and attaches a
 * Konva `Transformer` to it: a rotate handle (Shift snaps to 15°) and four corner
 * handles for uniform resize. The proxy is never the picture — Remotion stays the
 * only renderer — it only reports the new rotation / size multiplier, which the
 * parent writes through the same pure ops and undo history as every other edit.
 */
import { useEffect, useMemo, useRef } from 'react'
import { Layer, Rect, Stage, Transformer } from 'react-konva'
import type Konva from 'konva'

export interface KonvaOverlayBox {
  /** Layer box in the overlay's own pixel space (centre-anchored rotation). */
  x: number
  y: number
  width: number
  height: number
}

export interface KonvaTransformOverlayImplProps {
  width: number
  height: number
  box: KonvaOverlayBox
  /** Current rotation in degrees. */
  rotation: number
  /** Live rotation while dragging the rotate handle. */
  onRotate: (degrees: number) => void
  /** Resize finished: the new box width divided by the old one. */
  onResize: (multiplier: number) => void
  /** Called with true while the pointer is over a handle (so the wrapper can accept pointer events). */
  onHandleHover?: (over: boolean) => void
  /** Lets the wrapper hit-test a point against the handles. */
  registerHitTest?: (test: ((x: number, y: number) => boolean) | null) => void
  allowResize?: boolean
}

const SNAPS = Array.from({ length: 24 }, (_, i) => i * 15)

export default function KonvaTransformOverlayImpl({
  width, height, box, rotation, onRotate, onResize, registerHitTest, allowResize = true,
}: KonvaTransformOverlayImplProps) {
  const stageRef = useRef<Konva.Stage>(null)
  const rectRef = useRef<Konva.Rect>(null)
  const trRef = useRef<Konva.Transformer>(null)

  // Attach the transformer to the proxy whenever the proxy changes.
  useEffect(() => {
    const tr = trRef.current
    const rect = rectRef.current
    if (!tr || !rect) return
    tr.nodes([rect])
    tr.getLayer()?.batchDraw()
  }, [box.width, box.height, box.x, box.y, rotation])

  // Hit-test used by the wrapper to decide when the canvas should receive the pointer.
  useEffect(() => {
    registerHitTest?.((x: number, y: number) => {
      const hit = stageRef.current?.getIntersection({ x, y })
      return !!hit && hit !== rectRef.current
    })
    return () => registerHitTest?.(null)
  }, [registerHitTest])

  const anchors = useMemo(
    () => (allowResize ? ['top-left', 'top-right', 'bottom-left', 'bottom-right'] : []),
    [allowResize],
  )

  return (
    <Stage ref={stageRef} width={width} height={height}>
      <Layer>
        <Rect
          ref={rectRef}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          offsetX={box.width / 2}
          offsetY={box.height / 2}
          rotation={rotation}
          fill="rgba(0,0,0,0)"
          listening={false}
        />
        <Transformer
          ref={trRef}
          rotateEnabled
          rotationSnaps={SNAPS}
          rotationSnapTolerance={15}
          enabledAnchors={anchors}
          keepRatio
          flipEnabled={false}
          ignoreStroke
          borderStroke="#d9ff00"
          borderDash={[4, 3]}
          anchorStroke="#d9ff00"
          anchorFill="#050505"
          anchorSize={10}
          rotateAnchorOffset={28}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 16 || newBox.height < 16 ? oldBox : newBox)}
          onTransform={() => {
            const node = rectRef.current
            if (node) onRotate(node.rotation())
          }}
          onTransformEnd={() => {
            const node = rectRef.current
            if (!node) return
            const multiplier = node.scaleX()
            onRotate(node.rotation())
            // Konva expresses a resize as a scale on the node; hand it over and reset it, since the
            // real size lives in the layer's `scale` (the proxy is re-measured from it).
            node.scaleX(1)
            node.scaleY(1)
            if (Math.abs(multiplier - 1) > 0.005) onResize(multiplier)
          }}
        />
      </Layer>
    </Stage>
  )
}
