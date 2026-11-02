'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Eye, EyeOff, Move, RotateCcw } from 'lucide-react'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import {
  PREVIEW_ANIMATIONS,
  PREVIEW_FONTS,
  PREVIEW_POSITIONS,
  fontStackById,
  isImageLayerKind,
} from '../preview/presets'
import { getRemotionDesignTemplate } from '../templates'
import type {
  RemotionDesignTextSlot,
} from '../templates/types'
import type {
  PersonalizationPreviewSettings,
  PreviewInputProps,
  PreviewLayer,
  PreviewLayerKind,
} from '../preview/types'
import {
  MAX_LAYER_SCALE,
  MIN_LAYER_SCALE,
  SAFE_AREA_MARGIN,
  clampLayerToBounds,
  imageAssetDefaultLabel,
  imageAssetOptions,
  nudgeDeltaForKey,
  offsetLayer,
  resolveCompositionSize,
  scaleLayerTo,
  stageScaleFactor,
  toStageBox,
} from './overlayGeometry'
import { C, chipStyle, hintStyle, inputStyle, labelStyle, panelStyle, secondaryButtonStyle, softPanelStyle } from './tokens'

const LAYER_LABELS: Record<PreviewLayerKind, string> = {
  logo: 'Logo',
  businessName: 'Business name',
  headline: 'Headline',
  offer: 'Offer',
  cta: 'Call to action',
  productImage: 'Product image',
  serviceImage: 'Service image',
  tagline: 'Tagline',
  endCard: 'End card',
  design: 'Design',
}

const TEXT_KINDS: PreviewLayerKind[] = [
  'businessName',
  'headline',
  'offer',
  'cta',
  'tagline',
  'design',
]

/** Corner-handle keyboard step: 2% of the frame per press, 10% with Shift. */
const RESIZE_KEYBOARD_STEP = 0.02
const RESIZE_KEYBOARD_STEP_LARGE = 0.1

function layerText(layer: PreviewLayer, brand: PreviewInputProps['brand']): string {
  if (typeof layer.text === 'string' && layer.text.trim()) return layer.text
  if (layer.kind === 'businessName') return brand.businessName
  if (layer.kind === 'headline') return brand.headline
  if (layer.kind === 'offer') return brand.offer
  if (layer.kind === 'cta') return brand.cta
  if (layer.kind === 'tagline') return brand.headline
  // A design's primary slot is fed by the headline unless the customer
  // typed something on the layer.
  if (layer.kind === 'design') return brand.headline
  return ''
}

/* ── Design text slots ─────────────────────────────────────────────────────── */

/**
 * The design-slot resolver lives in the `core` lane
 * (`../preview/designSlots.ts`), because BOTH the inspector and the render
 * path need it and the composition must not import from `guided/` (that would
 * create the require cycle
 * Composition -> OverlayEditor -> Provider -> Modal -> OverlayEditor).
 *
 * The helpers are re-exported here so every existing consumer of
 * `guided/OverlayEditor` keeps working.
 */
export {
  DESIGN_SLOT_OVERRIDES_FIELD,
  brandSlotValue,
  designSlotLabel,
  designSlotOverrides,
  isPrimaryDesignSlot,
  resolveDesignSlotValues,
} from '../preview/designSlots'

import {
  designSlotLabel,
  designSlotOverrides,
  isPrimaryDesignSlot,
  resolveDesignSlotValues,
} from '../preview/designSlots'

/** The patch the inspector writes when a secondary slot changes. */
function slotOverridesPatch(next: Record<string, string>): Partial<PreviewLayer> {
  // `textSlotOverrides` is a field of `PreviewLayer`; the cast keeps the
  // patch type-safe against the rest of the layer shape.
  return { textSlotOverrides: next }
}

/** The optional character limit an adapter may put on a slot. */
function slotMaxLength(slot: RemotionDesignTextSlot): number | undefined {
  const raw = (slot as RemotionDesignTextSlot & { maxLength?: unknown }).maxLength
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return undefined
  return Math.floor(raw)
}

/**
 * Image fallback chain — mirrors the composition's own resolution order so the
 * stage never shows an empty box the render would fill (and vice versa).
 */
function layerImageUrl(layer: PreviewLayer, brand: PreviewInputProps['brand']): string {
  if (layer.imageUrl) return layer.imageUrl
  if (layer.kind === 'logo') return brand.logoUrl || ''
  if (layer.kind === 'productImage') return brand.productUrl || brand.serviceUrl || ''
  if (layer.kind === 'serviceImage') return brand.serviceUrl || brand.productUrl || ''
  return ''
}

/** Measures the stage element so layer boxes can mirror composition geometry. */
function useStageWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setWidth(element.clientWidth || 0)
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}

interface DragState {
  layerId: string
  pointerId: number | null
  startX: number
  startY: number
  /** Safe-area-clamped snapshot taken when the drag started (no jump). */
  origin: PreviewLayer
  mode: 'move' | 'resize'
}

export interface OverlayEditorProps {
  inputProps: PreviewInputProps
}

/**
 * Direct-on-video overlay editor.
 *
 * Renders the selected video's poster as a stage and draws every preview layer
 * on top of it at the same normalized coordinates the Remotion composition
 * uses, so dragging here is exactly what the preview renders. Used both in
 * Simple Mode step 4 and in the modal's Advanced Editing section.
 *
 * All layer state lives in the provider: this component never keeps a second
 * copy of it — it reads `previewSettings` from context and writes through
 * `updatePreviewLayer`. Only `selectedId` is local (which layer is selected),
 * so switching between Simple Mode and Advanced Editing keeps every edit.
 *
 * Geometry (cross-aspect mapping, safe-area clamping, keyboard nudges and the
 * image-asset option mapping) lives in `./overlayGeometry`.
 */
export function OverlayEditor({ inputProps }: OverlayEditorProps): React.JSX.Element {
  const ctx = useDemoPersonalize()
  const {
    previewSettings,
    updatePreviewLayer,
    updatePreviewComposition,
    resetPreviewLayout,
    assets,
  } = ctx
  const settings: PersonalizationPreviewSettings = previewSettings
  const fieldPrefix = useId()
  const stageRef = useRef<HTMLDivElement>(null)
  const stageWidth = useStageWidth(stageRef)
  const [selectedId, setSelectedId] = useState<string>(() => settings.layers[0]?.id || '')
  const dragRef = useRef<DragState | null>(null)

  const brand = inputProps.brand
  const { width: compW, height: compH } = resolveCompositionSize(settings.width, settings.height)
  // One factor for both axes: stagePx = compositionPx * (stageWidth / compW).
  const factor = stageScaleFactor(stageWidth, compW)

  const editableLayers = settings.layers.filter((layer) => layer.kind !== 'endCard')
  const selected = settings.layers.find((layer) => layer.id === selectedId) || settings.layers[0] || null
  const selectedDesign =
    selected?.kind === 'design' && selected.designId
      ? getRemotionDesignTemplate(selected.designId)
      : undefined
  // A design labels its primary text slot; the plain layers just say "Text".
  const selectedTextLabel =
    selectedDesign?.textSlots?.find((slot) => slot && slot.primary)?.label ?? 'Text'
  // Every slot the selected design declares, with the value each one shows.
  const selectedSlots: RemotionDesignTextSlot[] =
    selectedDesign && Array.isArray(selectedDesign.textSlots) ? selectedDesign.textSlots : []
  const selectedSlotValues: Record<string, string | undefined> =
    selectedDesign && selected ? resolveDesignSlotValues(selectedDesign, selected, brand) : {}

  const controlId = (name: string) => `${fieldPrefix}-${name}`
  const round = (value: number) => Number(value.toFixed(4))

  /**
   * Writes one slot's new value.
   *
   * The primary slot keeps writing `layer.text` (the field the inspector has
   * always written); every other slot writes its entry in the layer's
   * per-slot override map. Clearing a secondary field drops the override so
   * the slot falls back to its brand value again.
   */
  const onDesignSlotChange = (slot: RemotionDesignTextSlot, next: string) => {
    if (!selected) return
    if (isPrimaryDesignSlot(slot)) {
      updatePreviewLayer(selected.id, { text: next })
      return
    }
    const overrides = designSlotOverrides(selected)
    if (next.trim()) overrides[slot.key] = next
    else delete overrides[slot.key]
    updatePreviewLayer(selected.id, slotOverridesPatch(overrides))
  }

  const commitPosition = useCallback(
    (layerId: string, next: PreviewLayer) => {
      updatePreviewLayer(layerId, { x: round(next.x), y: round(next.y) })
    },
    [updatePreviewLayer],
  )

  const commitScale = useCallback(
    (layerId: string, next: PreviewLayer) => {
      // A resize can also pull a layer back inside the safe area.
      updatePreviewLayer(layerId, { x: round(next.x), y: round(next.y), scale: round(next.scale) })
    },
    [updatePreviewLayer],
  )

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || !stageRef.current) return
      if (drag.pointerId !== null && event.pointerId !== drag.pointerId) return
      const rect = stageRef.current.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const dx = (event.clientX - drag.startX) / rect.width
      const dy = (event.clientY - drag.startY) / rect.height
      if (drag.mode === 'move') {
        commitPosition(drag.layerId, offsetLayer(drag.origin, dx, dy, compW, compH))
      } else {
        const nextScale = drag.origin.scale * (1 + dx * 2)
        commitScale(drag.layerId, scaleLayerTo(drag.origin, nextScale, compW, compH))
      }
    },
    [commitPosition, commitScale, compW, compH],
  )

  const endDrag = useCallback(() => {
    dragRef.current = null
  }, [])

  // Window-level listeners: a drag that leaves the stage (or the window)
  // keeps tracking until the pointer is released, and touch never scrolls
  // because the stage sets `touch-action: none`.
  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
    }
  }, [onPointerMove, endDrag])

  // A layout switch can remove the selected layer: fall back to the first
  // layer instead of leaving a stale id behind.
  useEffect(() => {
    if (selectedId && settings.layers.some((layer) => layer.id === selectedId)) return
    setSelectedId(settings.layers[0]?.id || '')
  }, [selectedId, settings.layers])

  const startDrag = (event: React.PointerEvent, layer: PreviewLayer, mode: 'move' | 'resize') => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedId(layer.id)
    dragRef.current = {
      layerId: layer.id,
      pointerId: typeof event.pointerId === 'number' ? event.pointerId : null,
      startX: event.clientX,
      startY: event.clientY,
      // Snapshot the bounded geometry so the layer follows the pointer from
      // exactly where the customer sees it, even if the saved values were
      // out of the safe area.
      origin: clampLayerToBounds(layer, compW, compH),
      mode,
    }
    if (mode === 'move') {
      // Keep focus on the dragged box so arrow keys nudge straight after a drag.
      const target = event.currentTarget as HTMLElement | null
      target?.focus?.({ preventScroll: true })
    }
  }

  /** Arrow keys nudge (1% / Shift 5%), Delete/Backspace hides the layer. */
  const onLayerKeyDown = (event: React.KeyboardEvent, layer: PreviewLayer) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSelectedId(layer.id)
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      updatePreviewLayer(layer.id, { visible: false })
      return
    }
    const delta = nudgeDeltaForKey(event.key, event.shiftKey)
    if (!delta) return
    event.preventDefault()
    setSelectedId(layer.id)
    commitPosition(layer.id, offsetLayer(layer, delta.dx, delta.dy, compW, compH))
  }

  /** Arrow keys on the corner handle resize by 2% (Shift 10%). */
  const onHandleKeyDown = (event: React.KeyboardEvent, layer: PreviewLayer) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      return
    }
    const delta = nudgeDeltaForKey(event.key, event.shiftKey)
    if (!delta) return
    event.preventDefault()
    const grows = delta.dx > 0 || delta.dy > 0
    const factor = event.shiftKey ? 1 + RESIZE_KEYBOARD_STEP_LARGE : 1 + RESIZE_KEYBOARD_STEP
    commitScale(layer.id, scaleLayerTo(layer, grows ? layer.scale * factor : layer.scale / factor, compW, compH))
  }

  const imageOptions = (layer: PreviewLayer) => imageAssetOptions(layer, assets)

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <Move size={15} color={C.cyan} />
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
          Edit on the video
        </h3>
        <button
          type="button"
          onClick={() => resetPreviewLayout()}
          aria-label="Restore default layout"
          style={{ ...secondaryButtonStyle, minHeight: 30, marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <RotateCcw size={11} /> Restore default layout
        </button>
      </div>
      <p style={hintStyle}>
        Drag any layer on the video to move it, or use its corner handle to resize. Arrow keys nudge the
        selected layer by 1% (Shift for 5%), Delete hides it. Layers stay inside the 2% safe area of the
        frame, and positions are saved with your project.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 14, marginTop: 12 }} className="guided-overlay-grid">
        {/* ── Stage ─────────────────────────────────────────────────────── */}
        <div
          ref={stageRef}
          role="group"
          aria-label="Video overlay stage"
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: `${compW} / ${compH}`,
            borderRadius: 12,
            overflow: 'hidden',
            border: `1px solid ${C.border}`,
            background: '#05070a',
            touchAction: 'none',
          }}
        >
          {inputProps.posterUrl ? (
            <img
              src={inputProps.posterUrl}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 12 }}>
              Your video
            </div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: settings.brandColors.backgroundDim, pointerEvents: 'none' }} />
          {/* Safe-area guide: the same 2% inset the clamp enforces. */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: `${SAFE_AREA_MARGIN * 100}%`,
              border: '1px dashed rgba(255,255,255,.22)',
              borderRadius: 8,
              pointerEvents: 'none',
            }}
          />

          {factor > 0 &&
            editableLayers.filter((layer) => layer.visible).map((layer) => {
              const box = toStageBox(layer, compW, compH, stageWidth)
              const isDesign = layer.kind === 'design'
              const text = layerText(layer, brand)
              const imageUrl = layerImageUrl(layer, brand)
              if (!isDesign && !isImageLayerKind(layer.kind) && !text.trim()) return null
              if (isImageLayerKind(layer.kind) && !imageUrl) return null
              const isSelected = selected?.id === layer.id
              const color = layer.color ?? (layer.kind === 'cta' ? settings.brandColors.accent : settings.brandColors.text)
              const design = isDesign && layer.designId ? getRemotionDesignTemplate(layer.designId) : undefined

              return (
                <div
                  key={layer.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Move ${LAYER_LABELS[layer.kind]}`}
                  aria-pressed={isSelected}
                  onPointerDown={(event) => startDrag(event, layer, 'move')}
                  onKeyDown={(event) => onLayerKeyDown(event, layer)}
                  style={{
                    position: 'absolute',
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                    cursor: 'move',
                    outline: isSelected ? `2px dashed ${C.cyan}` : 'none',
                    outlineOffset: 2,
                    opacity: layer.opacity,
                    userSelect: 'none',
                  }}
                >
                  {isImageLayerKind(layer.kind) ? (
                    <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                  ) : isDesign ? (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        color: settings.brandColors.text,
                        fontSize: Math.max(10, Math.round(compH * 0.024)),
                        fontWeight: 700,
                        border: `1px dashed ${C.cyanBorder}`,
                        borderRadius: 10,
                        pointerEvents: 'none',
                      }}
                    >
                      {design ? design.name : 'Design'}
                    </div>
                  ) : layer.kind === 'cta' ? (
                    <div style={{ width: '100%', textAlign: 'center' }}>
                      <span
                        style={{
                          background: settings.brandColors.accent,
                          color: '#041014',
                          padding: '0.4em 1.1em',
                          borderRadius: 999,
                          display: 'inline-block',
                          fontFamily: fontStackById(layer.fontFamily),
                          fontSize: box.fontSize,
                          fontWeight: 800,
                          pointerEvents: 'none',
                        }}
                      >
                        {text}
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        fontFamily: fontStackById(layer.fontFamily),
                        color,
                        fontSize: box.fontSize,
                        fontWeight: layer.kind === 'businessName' ? 800 : 600,
                        lineHeight: 1.15,
                        textAlign: 'center',
                        width: '100%',
                        wordBreak: 'break-word',
                        pointerEvents: 'none',
                      }}
                    >
                      {text}
                    </div>
                  )}
                  {isSelected && (
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`Resize ${LAYER_LABELS[layer.kind]}`}
                      onPointerDown={(event) => startDrag(event, layer, 'resize')}
                      onKeyDown={(event) => onHandleKeyDown(event, layer)}
                      style={{
                        position: 'absolute',
                        right: -7,
                        bottom: -7,
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        background: C.cyan,
                        border: '2px solid #041014',
                        cursor: 'nwse-resize',
                      }}
                    />
                  )}
                </div>
              )
            })}
        </div>

        {/* ── Layer list + controls ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={labelStyle}>Layers</div>
          {settings.layers.map((layer) => {
            const layerDesign =
              layer.kind === 'design' && layer.designId
                ? getRemotionDesignTemplate(layer.designId)
                : undefined
            return (
              <div
                key={layer.id}
                role="button"
                tabIndex={0}
                aria-label={`Select ${LAYER_LABELS[layer.kind]}`}
                aria-pressed={selected?.id === layer.id}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedId(layer.id)
                  }
                }}
                onClick={() => setSelectedId(layer.id)}
                style={{
                  ...softPanelStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: `1px solid ${selected?.id === layer.id ? C.cyanBorder : C.border}`,
                  cursor: 'pointer',
                }}
              >
                <span style={{ color: C.text, fontSize: 12, fontWeight: 700, flex: 1 }}>{LAYER_LABELS[layer.kind]}</span>
                {layerDesign ? (
                  <span style={{ color: C.muted, fontSize: 10 }}>{layerDesign.name}</span>
                ) : null}
                {layer.kind === 'endCard' ? (
                  <span style={{ color: C.muted, fontSize: 10 }}>{settings.showEndCard ? 'On' : 'Off'}</span>
                ) : (
                  <button
                    type="button"
                    aria-label={`${layer.visible ? 'Hide' : 'Show'} ${LAYER_LABELS[layer.kind]}`}
                    aria-pressed={layer.visible}
                    onClick={(event) => {
                      event.stopPropagation()
                      updatePreviewLayer(layer.id, { visible: !layer.visible })
                    }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: layer.visible ? C.cyan : C.muted2, padding: 2 }}
                  >
                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                )}
              </div>
            )
          })}

          {selected && selected.kind !== 'endCard' && (
            <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <div style={{ color: C.text, fontSize: 12, fontWeight: 800 }}>{LAYER_LABELS[selected.kind]}</div>

              {selected.kind === 'design' && (
                <div style={{ color: C.muted, fontSize: 10 }}>
                  {selectedDesign
                    ? `${selectedDesign.name} — ${selectedDesign.description}`
                    : 'This design is not registered, so it will not render.'}
                </div>
              )}

              {TEXT_KINDS.includes(selected.kind) && (
                <>
                  {selected.kind === 'design' && selectedDesign ? (
                    selectedSlots.length > 0 ? (
                      /* One editable field per slot the design declares. */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {selectedSlots.map((slot) => {
                          const label = designSlotLabel(slot)
                          const slotId = controlId(`slot-${slot.key}`)
                          return (
                            <div key={slot.key}>
                              <label style={labelStyle} htmlFor={slotId}>{label}</label>
                              <textarea
                                id={slotId}
                                aria-label={label}
                                value={selectedSlotValues[slot.key] ?? ''}
                                onChange={(event) => onDesignSlotChange(slot, event.target.value)}
                                rows={2}
                                maxLength={slotMaxLength(slot)}
                                style={{ ...inputStyle, padding: '8px 11px', resize: 'vertical' }}
                              />
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div style={{ color: C.muted, fontSize: 10 }}>This design has no editable text.</div>
                    )
                  ) : (
                    <div>
                      <label style={labelStyle} htmlFor={controlId('text')}>{selectedTextLabel}</label>
                      <textarea
                        id={controlId('text')}
                        aria-label="Layer text"
                        value={selected.text ?? ''}
                        onChange={(event) => updatePreviewLayer(selected.id, { text: event.target.value })}
                        rows={2}
                        style={{ ...inputStyle, padding: '8px 11px', resize: 'vertical' }}
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2" style={{ gap: 8 }}>
                    <div>
                      <label style={labelStyle} htmlFor={controlId('color')}>Color</label>
                      <input
                        id={controlId('color')}
                        type="color"
                        aria-label="Text color"
                        value={selected.color || settings.brandColors.text}
                        onChange={(event) => updatePreviewLayer(selected.id, { color: event.target.value })}
                        style={{ width: '100%', height: 34, borderRadius: 8, border: `1px solid ${C.border}`, background: C.field }}
                      />
                    </div>
                    <div>
                      <label style={labelStyle} htmlFor={controlId('font')}>Font</label>
                      <select
                        id={controlId('font')}
                        aria-label="Font"
                        value={selected.fontFamily || ''}
                        onChange={(event) => updatePreviewLayer(selected.id, { fontFamily: event.target.value || undefined })}
                        style={{ ...inputStyle, minHeight: 34 }}
                      >
                        <option value="">Match brand</option>
                        {/* Phase 3 decision D3: only the bundled face is
                            selectable. The historical per-OS entries stay
                            listed — as DISABLED options with their
                            "(unavailable)" labels — so a customer is never
                            silently offered a font that would break export
                            fidelity, and an old saved layer still shows which
                            (now unavailable) choice it carries. */}
                        {PREVIEW_FONTS.map((font) => (
                          <option
                            key={font.id}
                            value={font.stack}
                            disabled={!font.available}
                          >
                            {font.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {isImageLayerKind(selected.kind) && (
                <div>
                  <label style={labelStyle} htmlFor={controlId('image')}>Image</label>
                  <select
                    id={controlId('image')}
                    aria-label="Layer image"
                    value={selected.imageUrl || ''}
                    onChange={(event) => updatePreviewLayer(selected.id, { imageUrl: event.target.value || undefined })}
                    style={inputStyle}
                  >
                    <option value="">{imageAssetDefaultLabel(selected.kind)}</option>
                    {imageOptions(selected).map((option, index) => (
                      <option key={`${index}-${option.value}`} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={labelStyle} htmlFor={controlId('scale')}>Size</label>
                <input
                  id={controlId('scale')}
                  type="range"
                  aria-label="Layer size"
                  min={MIN_LAYER_SCALE}
                  max={MAX_LAYER_SCALE}
                  step={0.01}
                  value={selected.scale}
                  onChange={(event) => {
                    const next = scaleLayerTo(selected, Number(event.target.value), compW, compH)
                    commitScale(selected.id, next)
                  }}
                  style={{ width: '100%', accentColor: C.cyan }}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor={controlId('opacity')}>Opacity</label>
                <input
                  id={controlId('opacity')}
                  type="range"
                  aria-label="Layer opacity"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={selected.opacity}
                  onChange={(event) => updatePreviewLayer(selected.id, { opacity: Number(event.target.value) })}
                  style={{ width: '100%', accentColor: C.cyan }}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor={controlId('animation')}>Animation</label>
                <select
                  id={controlId('animation')}
                  aria-label="Layer animation"
                  value={selected.animation}
                  onChange={(event) =>
                    updatePreviewLayer(selected.id, { animation: event.target.value as PreviewLayer['animation'] })
                  }
                  style={inputStyle}
                >
                  {PREVIEW_ANIMATIONS.map((animation) => (
                    <option key={animation.id} value={animation.id}>{animation.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2" style={{ gap: 8 }}>
                <div>
                  <label style={labelStyle} htmlFor={controlId('delay')}>Appear after (frames)</label>
                  <input
                    id={controlId('delay')}
                    type="number"
                    aria-label="Appear after frames"
                    min={0}
                    max={Math.max(0, settings.durationInFrames)}
                    value={selected.animationDelay}
                    onChange={(event) => updatePreviewLayer(selected.id, { animationDelay: Math.max(0, Number(event.target.value) || 0) })}
                    style={{ ...inputStyle, minHeight: 34 }}
                  />
                </div>
                <div>
                  <label style={labelStyle} htmlFor={controlId('start')}>Show from (frames)</label>
                  <input
                    id={controlId('start')}
                    type="number"
                    aria-label="Show from frames"
                    min={0}
                    max={Math.max(0, settings.durationInFrames)}
                    value={selected.startFrame}
                    onChange={(event) => updatePreviewLayer(selected.id, { startFrame: Math.max(0, Number(event.target.value) || 0) })}
                    style={{ ...inputStyle, minHeight: 34 }}
                  />
                </div>
              </div>

              <div>
                <div style={labelStyle}>Position presets</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {PREVIEW_POSITIONS.map((position) => (
                    <button
                      key={position.id}
                      type="button"
                      aria-label={`Move layer to ${position.label}`}
                      onClick={() => {
                        const next = clampLayerToBounds({ ...selected, x: position.x, y: position.y }, compW, compH)
                        commitPosition(selected.id, next)
                      }}
                      style={{ ...chipStyle(false), minHeight: 28, fontSize: 10 }}
                    >
                      {position.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ color: C.muted, fontSize: 10 }}>
                Position {Math.round(selected.x * 100)}% / {Math.round(selected.y * 100)}% · Size{' '}
                {Math.round(selected.scale * 100)}% · kept inside the {Math.round(SAFE_AREA_MARGIN * 100)}% safe area
              </div>
            </div>
          )}

          {selected?.kind === 'endCard' && (
            <div style={{ ...softPanelStyle, marginTop: 4 }}>
              <div style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>Branded end card</div>
              <p style={hintStyle}>Shows your logo, contact details and final call to action at the end of the video.</p>
              <button
                type="button"
                aria-label={settings.showEndCard ? 'Turn off end card' : 'Turn on end card'}
                onClick={() => updatePreviewComposition({ showEndCard: !settings.showEndCard })}
                style={{ ...secondaryButtonStyle, minHeight: 30, marginTop: 8 }}
              >
                {settings.showEndCard ? 'Turn off end card' : 'Turn on end card'}
              </button>
            </div>
          )}
        </div>
      </div>

      <style>
        {`@media (max-width: 720px) { .guided-overlay-grid { grid-template-columns: minmax(0, 1fr); } }`}
      </style>
    </div>
  )
}
