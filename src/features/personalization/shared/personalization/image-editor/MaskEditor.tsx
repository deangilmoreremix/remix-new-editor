'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Brush, Circle, Eraser, PenTool, RotateCcw, Square, Wand2 } from 'lucide-react'

type Tool = 'brush' | 'eraser' | 'rectangle' | 'ellipse' | 'lasso'
type Point = { x: number; y: number }

type Props = {
  imageUrl: string
  active: boolean
  onMaskChange: (mask: Blob | null) => void
}

const C = {
  border: 'rgba(255,255,255,.12)',
  muted: 'rgba(255,255,255,.58)',
  cyan: '#29d3f2',
  cyanSoft: 'rgba(41,211,242,.12)',
  panel: '#12171c',
}

export default function MaskEditor({ imageUrl, active, onMaskChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const lassoPointsRef = useRef<Point[]>([])
  const [tool, setTool] = useState<Tool>('brush')
  const [brushSize, setBrushSize] = useState(64)
  const [drawing, setDrawing] = useState(false)
  const [shapeStart, setShapeStart] = useState<Point | null>(null)
  const [hasMask, setHasMask] = useState(false)

  const initialize = useCallback(() => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return
    canvas.width = image.naturalWidth || image.width
    canvas.height = image.naturalHeight || image.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasMask(false)
    lassoPointsRef.current = []
    onMaskChange(null)
  }, [onMaskChange])

  useEffect(() => {
    if (!active) {
      setDrawing(false)
      setShapeStart(null)
      lassoPointsRef.current = []
    }
  }, [active])

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  // The editor canvas stores the USER'S SELECTED region as opaque white for
  // easy visualization. OpenAI image-edit masks use the inverse alpha
  // convention: transparent pixels are the editable region, opaque pixels are
  // protected. Export an API mask without changing the visible selection.
  const exportMask = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const selectionCtx = canvas.getContext('2d')
    if (!selectionCtx) return

    const selection = selectionCtx.getImageData(0, 0, canvas.width, canvas.height)
    const apiCanvas = document.createElement('canvas')
    apiCanvas.width = canvas.width
    apiCanvas.height = canvas.height
    const apiCtx = apiCanvas.getContext('2d')
    if (!apiCtx) return

    const apiMask = apiCtx.createImageData(canvas.width, canvas.height)
    let selectedPixels = 0
    for (let i = 0; i < selection.data.length; i += 4) {
      const selected = selection.data[i + 3] > 0
      if (selected) selectedPixels += 1
      apiMask.data[i] = 255
      apiMask.data[i + 1] = 255
      apiMask.data[i + 2] = 255
      apiMask.data[i + 3] = selected ? 0 : 255
    }

    if (selectedPixels === 0) {
      setHasMask(false)
      onMaskChange(null)
      return
    }

    apiCtx.putImageData(apiMask, 0, 0)
    apiCanvas.toBlob((blob) => {
      if (!blob) return
      onMaskChange(blob)
      setHasMask(true)
    }, 'image/png')
  }, [onMaskChange])

  const paintCircle = (point: Point, erase = false) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.save()
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over'
    ctx.fillStyle = 'rgba(41,211,242,1)'
    ctx.beginPath()
    ctx.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointFromEvent(event)
    setDrawing(true)

    if (tool === 'rectangle' || tool === 'ellipse') {
      setShapeStart(point)
      return
    }

    if (tool === 'lasso') {
      lassoPointsRef.current = [point]
      return
    }

    paintCircle(point, tool === 'eraser')
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return
    const point = pointFromEvent(event)

    if (tool === 'brush' || tool === 'eraser') {
      paintCircle(point, tool === 'eraser')
      return
    }

    if (tool === 'lasso') {
      const points = lassoPointsRef.current
      const previous = points[points.length - 1]
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 3) {
        points.push(point)
      }
    }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const end = pointFromEvent(event)

    if (canvas && ctx && shapeStart && tool === 'rectangle') {
      ctx.save()
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = 'rgba(41,211,242,1)'
      ctx.fillRect(shapeStart.x, shapeStart.y, end.x - shapeStart.x, end.y - shapeStart.y)
      ctx.restore()
    }

    if (canvas && ctx && shapeStart && tool === 'ellipse') {
      const centerX = (shapeStart.x + end.x) / 2
      const centerY = (shapeStart.y + end.y) / 2
      const radiusX = Math.abs(end.x - shapeStart.x) / 2
      const radiusY = Math.abs(end.y - shapeStart.y) / 2
      if (radiusX > 0 && radiusY > 0) {
        ctx.save()
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = 'rgba(41,211,242,1)'
        ctx.beginPath()
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    if (canvas && ctx && tool === 'lasso') {
      const points = [...lassoPointsRef.current, end]
      if (points.length >= 3) {
        ctx.save()
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = 'rgba(41,211,242,1)'
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }
    }

    setDrawing(false)
    setShapeStart(null)
    lassoPointsRef.current = []
    exportMask()
  }

  const clearMask = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasMask(false)
    lassoPointsRef.current = []
    onMaskChange(null)
  }

  const invertMask = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const selection = ctx.getImageData(0, 0, canvas.width, canvas.height)
    for (let i = 0; i < selection.data.length; i += 4) {
      const alpha = selection.data[i + 3]
      selection.data[i] = 41
      selection.data[i + 1] = 211
      selection.data[i + 2] = 242
      selection.data[i + 3] = 255 - alpha
    }
    ctx.putImageData(selection, 0, 0)
    exportMask()
  }

  if (!active) return null

  const toolButton = (id: Tool, label: string, icon: ReactNode) => (
    <button
      type="button"
      onClick={() => setTool(id)}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-semibold"
      style={{ background: tool === id ? C.cyanSoft : 'transparent', color: tool === id ? C.cyan : C.muted }}
    >
      {icon} {label}
    </button>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl p-2" style={{ background: C.panel, border: '1px solid ' + C.border }}>
        {toolButton('brush', 'Brush', <Brush size={13} />)}
        {toolButton('eraser', 'Erase', <Eraser size={13} />)}
        {toolButton('rectangle', 'Box', <Square size={13} />)}
        {toolButton('ellipse', 'Ellipse', <Circle size={13} />)}
        {toolButton('lasso', 'Lasso', <PenTool size={13} />)}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px]" style={{ color: C.muted }}>Brush</span>
          <input type="range" min={8} max={240} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-24 accent-cyan-400" />
        </div>

        <button type="button" onClick={invertMask} disabled={!hasMask} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-semibold disabled:opacity-40" style={{ color: C.muted, border: '1px solid ' + C.border }}>
          <Wand2 size={13} /> Invert
        </button>
        <button type="button" onClick={clearMask} disabled={!hasMask} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-semibold disabled:opacity-40" style={{ color: C.muted, border: '1px solid ' + C.border }}>
          <RotateCcw size={13} /> Clear
        </button>
      </div>

      <div className="relative overflow-hidden rounded-xl bg-black">
        <img ref={imageRef} src={imageUrl} alt="Mask target" className="block max-h-[60vh] w-full object-contain" onLoad={initialize} />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
          style={{ opacity: 0.48, filter: 'drop-shadow(0 0 4px rgba(41,211,242,.8))' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>

      <p className="text-[10px] leading-4" style={{ color: C.muted }}>
        Select the region you want SmartVideo GO AI to change. Brush, box, ellipse and lasso selections are converted into the transparent-alpha edit mask expected by the image-edit API; Erase removes areas from the selection.
      </p>
    </div>
  )
}
