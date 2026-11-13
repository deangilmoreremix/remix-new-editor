'use client'

/**
 * "Crop & zoom" dialog for an image layer: drag the picture to pan it and use the slider
 * (or wheel / pinch) to zoom. Built on react-easy-crop, loaded lazily.
 *
 * What it writes is NOT a pixel crop: it converts the visible region the customer framed into
 * the layer's existing `cropX / cropY / zoom` (see `cropMapping.ts`), which the shared Remotion
 * composition renders with `object-position` + `scale`. So the preview, the editor stage and the
 * exported video all show exactly what was framed here, and the original file is never modified.
 */
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { clampImageZoom } from '../preview/layerTransform'
import {
  areaToStyleCrop,
  focusToArea,
  fractionToPercent,
  percentToFraction,
  type VisibleArea,
} from './cropMapping'
import { C, hintStyle, secondaryButtonStyle } from './tokens'

const Cropper = lazy(() => import('react-easy-crop'))

export interface ImageCropResult {
  cropX: number
  cropY: number
  zoom: number
  fit: 'cover'
}

export interface ImageCropDialogProps {
  src: string
  /** The crop currently applied to the layer. */
  initial: { cropX: number; cropY: number; zoom?: number }
  /** Frame aspect (width / height). Image layers are square boxes, so this is 1 unless a caller says otherwise. */
  frameAspect?: number
  onApply: (result: ImageCropResult) => void
  onCancel: () => void
}

export function ImageCropDialog({ src, initial, frameAspect = 1, onApply, onCancel }: ImageCropDialogProps) {
  const [imageAspect, setImageAspect] = useState<number | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(clampImageZoom(initial.zoom ?? 1))
  const areaRef = useRef<VisibleArea | null>(null)

  // The mapping needs the picture's real aspect; measure it before showing the cropper.
  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (!cancelled) setImageAspect(img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1)
    }
    img.onerror = () => { if (!cancelled) setLoadError(true) }
    img.src = src
    return () => { cancelled = true }
  }, [src])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const initialArea = useMemo(
    () => (imageAspect == null ? null : fractionToPercent(focusToArea({ cropX: initial.cropX, cropY: initial.cropY }, initial.zoom ?? 1, imageAspect, frameAspect))),
    [imageAspect, initial.cropX, initial.cropY, initial.zoom, frameAspect],
  )

  const apply = () => {
    const area = areaRef.current
      ?? (imageAspect == null ? null : focusToArea({ cropX: initial.cropX, cropY: initial.cropY }, initial.zoom ?? 1, imageAspect, frameAspect))
    if (!area) return
    onApply(areaToStyleCrop(area, zoom))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crop and zoom picture"
      data-testid="image-crop-dialog"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(event) => { if (event.target === event.currentTarget) onCancel() }}
    >
      <div style={{ width: 'min(92vw, 420px)', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ color: C.text, fontSize: 13, fontWeight: 800 }}>Crop &amp; zoom</div>
        <div style={{ position: 'relative', width: '100%', height: 320, background: '#05070a', borderRadius: 10, overflow: 'hidden' }}>
          {loadError ? (
            <div role="alert" style={{ ...hintStyle, padding: 16 }}>This picture could not be loaded for cropping.</div>
          ) : imageAspect == null || !initialArea ? (
            <div style={{ ...hintStyle, padding: 16 }}>Loading picture…</div>
          ) : (
            <Suspense fallback={<div style={{ ...hintStyle, padding: 16 }}>Loading cropper…</div>}>
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                minZoom={1}
                maxZoom={4}
                aspect={frameAspect}
                showGrid
                initialCroppedAreaPercentages={initialArea}
                onCropChange={setCrop}
                onZoomChange={(z: number) => setZoom(clampImageZoom(z))}
                onCropAreaChange={(percent: { x: number; y: number; width: number; height: number }) => {
                  areaRef.current = percentToFraction(percent)
                }}
              />
            </Suspense>
          )}
        </div>
        <label style={{ color: C.muted, fontSize: 11 }} htmlFor="crop-zoom">Zoom {zoom.toFixed(2)}×</label>
        <input id="crop-zoom" type="range" aria-label="Crop zoom" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(clampImageZoom(Number(e.target.value)))} style={{ width: '100%', accentColor: C.cyan }} />
        <p style={hintStyle}>Drag to move the picture inside its frame. The original file is never changed.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" aria-label="Cancel crop" onClick={onCancel} style={{ ...secondaryButtonStyle, minHeight: 32, padding: '0 14px' }}>Cancel</button>
          <button type="button" aria-label="Apply crop" disabled={imageAspect == null} onClick={apply} style={{ ...secondaryButtonStyle, minHeight: 32, padding: '0 14px', background: C.cyan, color: '#000' }}>Apply</button>
        </div>
      </div>
    </div>
  )
}
