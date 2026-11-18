'use client'

import { Fragment, useCallback, useEffect, useId, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, Move, Pause, Play, RotateCcw, Unlock } from 'lucide-react'
import { ImageCollage, SplitPanel, StyledBusinessImage } from '../preview/StyledBusinessImage'
import type { ImageStyle } from '../preview/imageStyle'
import { imageRoleForLayerKind, presetStyle, resolveImageLook } from '../preview/imagePresets'
import { MEDIA_ROLE_CONTRACTS, roleForLayer } from '../preview/mediaRoles'
import { ImageStyleControls } from './ImageStyleControls'
import { ColorField } from './editor/ColorField'
import { SortableRow } from './editor/SortableRow'
import { Tip } from './editor/Tip'
import { PLAYBACK_RATES } from '../preview/playbackRate'
import { CaptionDragHandle } from './CaptionDragHandle'
import { captionAvoid, clearOf } from './captionAvoid'
import { liveBridge } from '../preview/liveBridge'
import { PersonalizationPlayer } from '../preview/PersonalizationPlayer'
import type { PlayerRef } from '@remotion/player'
import { Timeline } from './editor/Timeline'
import { EditorTour } from './editor/EditorTour'
import { KeyframePanel } from './editor/KeyframePanel'
import { moveKeyframe } from '../preview/keyframes'
import { NEUTRAL_KEYFRAME_STATE, keyframeStateFor, keyframeTransformParts } from '../preview/keyframes'
import { lookFilter, lookOverlays, vignetteStops } from '../preview/effects'
import { LookPanel } from './LookPanel'
import { LayerEffectsControls } from './editor/LayerEffectsControls'
import { CutoutPanel } from './CutoutPanel'
import { HANDLES, cursorForHandle, resizeFromHandle, rotationFromPointer, type HandleId, type TransformBox } from './editor/transform'
import { isRotated, normalizeAngle, rotateCss, rotatedExtent } from '../preview/rotation'
import type { EditorTipId } from './editor/editorTips'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { canMoveLayer, moveLayer, type LayerMove } from '../preview/layerOrder'
import { layerSnapBox, snapMove, snapTargets } from './editor/snap'
import { BrandAndTemplates } from './editor/BrandAndTemplates'
import { DesignLayerPlayer } from './DesignLayerPlayer'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import {
  PREVIEW_ANIMATIONS,
  PREVIEW_FONTS,
  PREVIEW_POSITIONS,
  isImageLayerKind,
} from '../preview/presets'
import { accentRuleStyle, ctaPillStyle, isSingleLineBox, isTextStyleKind, layerTextStyle, textAlignFor } from '../preview/textStyle'
import { hasTextScrim, scrimForBox, scrimStyle } from '../preview/scrim'
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
  layerBoxMetrics,
  nudgeDeltaForKey,
  offsetLayer,
  resolveCompositionSize,
  scaleLayerTo,
  stageScaleFactor,
  toStageBox,
} from './overlayGeometry'
import { AddDesignsPanel } from './AddDesignsPanel'
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

/** Fonts the video renderer can actually draw. */
const SELECTABLE_FONT_COUNT = PREVIEW_FONTS.filter((font) => font.available).length

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

/**
 * True for a headline/tagline without its own text whose fallback is just
 * the business name while a business-name layer is showing it (the video
 * doesn't draw it twice; see PersonalizationComposition).
 */
function isRepeatedBusinessName(layer: PreviewLayer, brand: PreviewInputProps['brand'], layers: PreviewLayer[]): boolean {
  if (layer.kind !== 'headline' && layer.kind !== 'tagline') return false
  if (typeof layer.text === 'string' && layer.text.trim()) return false
  const text = layerText(layer, brand).trim().toLowerCase()
  if (!text) return false
  const name = brand.businessName.trim().toLowerCase()
  // Same rules as the video: a visible name layer showing the brand name
  // itself, or an EARLIER visible headline/tagline/name layer drawing the very
  // same fallback text, on screen during (some of) the same frames.
  const index = layers.indexOf(layer)
  return layers.some((other, i) =>
    other !== layer &&
    other.visible &&
    framesOverlap(layer, other) &&
    ((other.kind === 'businessName' && !!name && text === name && layerText(other, brand).trim().toLowerCase() === name) ||
      ((other.kind === 'headline' || other.kind === 'tagline' || other.kind === 'businessName') &&
        layerText(other, brand).trim().toLowerCase() === text &&
        // an earlier layer drawing the same text, or any layer with explicit own text
        (i < index || (typeof other.text === 'string' && other.text.trim() !== '')))),
  )
}

function framesOverlap(a: PreviewLayer, b: PreviewLayer): boolean {
  return Math.max(a.startFrame, b.startFrame) <= Math.min(a.endFrame ?? Infinity, b.endFrame ?? Infinity)
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
  mode: 'move' | 'resize' | 'rotate'
  /** For resize: which of the eight handles is being dragged. */
  handle?: HandleId
  /** The drawn box (composition pixels) when the drag started: resize and rotate are measured against it. */
  box0?: TransformBox
}

export interface OverlayEditorProps {
  inputProps: PreviewInputProps
  /** Rendered directly under the video stage (sticky with it), e.g. the layout quality bar. */
  belowStage?: React.ReactNode
  /**
   * Edit on the real animated video: the Remotion Player draws the composition and the layer boxes become a
   * transparent interaction layer above it. Off by default; the stage then shows the poster image.
   */
  liveStage?: boolean
  /** Shows an "Add a design" button that opens the full template library (all layouts and designs) above the stage. */
  addDesigns?: boolean
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
/** Timing is edited in SECONDS (what the customer sees on the clock) and stored in frames, so it survives a frame-rate change. */
export const framesToSeconds = (frames: number, fps: number) => Math.round((frames / Math.max(1, fps)) * 100) / 100
export const secondsToFrames = (seconds: number, fps: number) => Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) * Math.max(1, fps)))

type InspectorTab = 'content' | 'layout' | 'timing'
const INSPECTOR_TABS: { id: InspectorTab; label: string }[] = [
  { id: 'content', label: 'Content' },
  { id: 'layout', label: 'Layout' },
  { id: 'timing', label: 'Timing' },
]

export function OverlayEditor({ inputProps, belowStage, liveStage = false, addDesigns = false }: OverlayEditorProps): React.JSX.Element {
  const ctx = useDemoPersonalize()
  const {
    previewSettings,
    updatePreviewLayer,
    reorderPreviewLayers,
    setPreviewLayerLocked,
    removePreviewDesignLayer,
    undoPreview,
    redoPreview,
    canUndoPreview,
    canRedoPreview,
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
  const [confirmRemoveDesign, setConfirmRemoveDesign] = useState(false)
  const [addDesignsOpen, setAddDesignsOpen] = useState(false)
  // Snap guides: on by default, switched off from the toolbar or by holding Alt while dragging.
  const [snapOn, setSnapOn] = useState(true)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('content')
  // Live stage: the person can still switch back to the still poster (lighter, and a fallback if the video cannot play).
  const [liveWanted, setLiveWanted] = useState(true)
  const liveOn = liveStage && liveWanted
  const playerRef = useRef<PlayerRef | null>(null)
  const [playFrame, setPlayFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [playRate, setPlayRate] = useState<number>(1)
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] })
  // Share the live playhead with panels outside the editor (the captions panel): current frame and a way to jump. Null while the live player is off.
  const seekLive = useCallback((f: number) => { try { playerRef.current?.pause(); playerRef.current?.seekTo(f) } catch { /* no player */ } }, [])
  useEffect(() => { liveBridge.publish(liveOn ? { frame: playFrame, seek: seekLive } : { frame: null, seek: null }) }, [liveOn, playFrame, seekLive])
  useEffect(() => () => liveBridge.publish({ frame: null, seek: null }), [])
  // Layers list reorder: top of the list = frontmost, so the list is the layer array reversed.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onReorderEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const frontToBack = [...settings.layers].reverse().map((l) => l.id)
    const from = frontToBack.indexOf(String(active.id))
    const to = frontToBack.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    const next = [...frontToBack]
    next.splice(to, 0, next.splice(from, 1)[0])
    reorderPreviewLayers?.(next.reverse())
  }
  const restack = (id: string, move: LayerMove) => {
    if (!canMoveLayer(settings.layers, id, move)) return
    reorderPreviewLayers?.(moveLayer(settings.layers, id, move).map((l) => l.id))
  }

  // The Layout Quality Check's "Show" selects the affected layer here.
  useEffect(() => {
    const onSelect = (event: Event) => {
      const id = (event as CustomEvent<{ layerId?: string }>).detail?.layerId
      if (id && settings.layers.some((l) => l.id === id)) setSelectedId(id)
    }
    window.addEventListener('personalization:select-layer', onSelect)
    return () => window.removeEventListener('personalization:select-layer', onSelect)
  }, [settings.layers])

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

  /** Sets a layer's rotation and keeps it inside the safe area (a rotated box is bigger). */
  const commitRotation = useCallback(
    (layer: PreviewLayer, degrees: number) => {
      const rotation = normalizeAngle(degrees)
      const bounded = clampLayerToBounds({ ...layer, rotation }, compW, compH)
      updatePreviewLayer(layer.id, { rotation, x: round(bounded.x), y: round(bounded.y) })
    },
    [updatePreviewLayer, compW, compH],
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
        const moved = offsetLayer(drag.origin, dx, dy, compW, compH)
        if (snapOn && !event.altKey) {
          const self = settings.layers.find((l) => l.id === drag.layerId)
          const others = settings.layers
            .filter((l) => l.id !== drag.layerId && l.visible && l.kind !== 'endCard' && l.kind !== 'design' && (!isImageLayerKind(l.kind) || Boolean(layerImageUrl(l, brand))))
            .map((l) => layerSnapBox(l, isImageLayerKind(l.kind) ? undefined : layerText(l, brand), compW, compH))
          const text = self && !isImageLayerKind(self.kind) ? layerText(self, brand) : undefined
          const res = snapMove(layerSnapBox(moved, text, compW, compH), snapTargets(others, SAFE_AREA_MARGIN))
          setGuides({ x: res.guidesX, y: res.guidesY })
          commitPosition(drag.layerId, clampLayerToBounds({ ...moved, x: moved.x + res.dx, y: moved.y + res.dy }, compW, compH))
        } else {
          setGuides((g) => (g.x.length || g.y.length ? { x: [], y: [] } : g))
          commitPosition(drag.layerId, moved)
        }
      } else if (drag.mode === 'rotate' && drag.box0) {
        const pointer = { x: ((event.clientX - rect.left) / rect.width) * compW, y: ((event.clientY - rect.top) / rect.height) * compH }
        commitRotation(drag.origin, rotationFromPointer({ x: drag.box0.cx, y: drag.box0.cy }, pointer, { snap: event.shiftKey, current: drag.origin.rotation }))
      } else if (drag.mode === 'resize' && drag.handle && drag.box0) {
        // Resizing from any handle keeps the opposite corner (or edge) where it is and the proportions the same.
        const pointer = { x: ((event.clientX - rect.left) / rect.width) * compW, y: ((event.clientY - rect.top) / rect.height) * compH }
        const o = drag.origin
        const r = resizeFromHandle(drag.box0, drag.handle, pointer, { minFactor: MIN_LAYER_SCALE / o.scale, maxFactor: MAX_LAYER_SCALE / o.scale })
        const moved = { ...o, x: o.x + (r.cx - drag.box0.cx) / compW, y: o.y + (r.cy - drag.box0.cy) / compH }
        commitScale(drag.layerId, scaleLayerTo(moved, o.scale * r.factor, compW, compH))
      } else {
        const nextScale = drag.origin.scale * (1 + dx * 2)
        commitScale(drag.layerId, scaleLayerTo(drag.origin, nextScale, compW, compH))
      }
    },
    [commitPosition, commitScale, commitRotation, compW, compH, snapOn, settings.layers, brand],
  )

  const endDrag = useCallback(() => {
    dragRef.current = null
    setGuides((g) => (g.x.length || g.y.length ? { x: [], y: [] } : g))
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

  /** What the customer may do with this layer, from its media role (full-frame designs and effects are neither dragged nor resized). */
  const contractOf = (layer: PreviewLayer) => {
    const d = layer.kind === 'design' && layer.designId ? getRemotionDesignTemplate(layer.designId) : undefined
    return MEDIA_ROLE_CONTRACTS[roleForLayer(layer, d ? { id: d.id, category: d.category } : null)]
  }

  const startDrag = (event: React.PointerEvent, layer: PreviewLayer, mode: 'move' | 'resize' | 'rotate', handle?: HandleId) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedId(layer.id)
    // Editing a moving picture is hard: stop playback while a layer is grabbed.
    try { playerRef.current?.pause() } catch { /* no player */ }
    const allowed = contractOf(layer)
    if (mode === 'move' ? !allowed.userMovable : mode === 'rotate' ? !allowed.userRotatable : !allowed.userResizable) return
    if (layer.locked) return // locked: selectable, but not draggable until unlocked
    const origin = clampLayerToBounds(layer, compW, compH)
    const m = layerBoxMetrics(origin, compW, compH, isImageLayerKind(layer.kind) || layer.kind === 'design' ? undefined : layerText(layer, brand))
    dragRef.current = {
      layerId: layer.id,
      pointerId: typeof event.pointerId === 'number' ? event.pointerId : null,
      startX: event.clientX,
      startY: event.clientY,
      // Snapshot the bounded geometry so the layer follows the pointer from
      // exactly where the customer sees it, even if the saved values were
      // out of the safe area.
      origin,
      mode,
      handle,
      box0: { cx: m.leftPx + m.widthPx / 2, cy: m.topPx + m.heightPx / 2, w: m.widthPx, h: m.heightPx, rotation: origin.rotation ?? 0 },
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
    if (layer.locked || !contractOf(layer).userMovable) return
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
    <div
      style={panelStyle}
      onKeyDown={(event) => {
        // ⌘Z / Ctrl+Z undo, ⇧⌘Z / Ctrl+Shift+Z / Ctrl+Y redo, only while focus is in the editor and not in a field that
        // has its own undo (text boxes, number inputs, selects).
        if (!(event.metaKey || event.ctrlKey) || event.altKey) return
        const t = event.target as HTMLElement | null
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
          if (!(t.tagName === 'INPUT' && ['range', 'checkbox', 'radio', 'color'].includes((t as HTMLInputElement).type))) return
        }
        const k = event.key.toLowerCase()
        if (k === 'z' && !event.shiftKey) {
          event.preventDefault()
          if (canUndoPreview) undoPreview?.()
        } else if ((k === 'z' && event.shiftKey) || k === 'y') {
          event.preventDefault()
          if (canRedoPreview) redoPreview?.()
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <Move size={15} color={C.cyan} />
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
          Edit on the video
        </h3>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
          {addDesigns && (
            <button type="button" data-testid="editor-add-design" aria-expanded={addDesignsOpen} onClick={() => setAddDesignsOpen((v) => !v)} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 10, padding: '0 10px', borderColor: addDesignsOpen ? C.cyan : undefined, color: addDesignsOpen ? C.cyan : undefined }}>
              Add a design
            </button>
          )}
          <Tip id="undo"><button type="button" data-testid="editor-undo" aria-label="Undo" disabled={!canUndoPreview} onClick={() => undoPreview?.()} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 10, padding: '0 10px', opacity: canUndoPreview ? 1 : 0.5 }}>Undo</button></Tip>
          <Tip id="redo"><button type="button" data-testid="editor-redo" aria-label="Redo" disabled={!canRedoPreview} onClick={() => redoPreview?.()} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 10, padding: '0 10px', opacity: canRedoPreview ? 1 : 0.5 }}>Redo</button></Tip>
          <Tip id="snap">
          <button
            type="button"
            data-testid="editor-snap"
            aria-label="Snap to guides"
            aria-pressed={snapOn}
            onClick={() => setSnapOn((v) => !v)}
            style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 10, padding: '0 10px', borderColor: snapOn ? C.cyan : undefined, color: snapOn ? C.cyan : undefined }}
          >
            Snap: {snapOn ? 'On' : 'Off'}
          </button>
          </Tip>
        </span>
        <Tip id="restoreLayout">
        <button
          type="button"
          onClick={() => resetPreviewLayout()}
          aria-label="Restore default layout"
          style={{ ...secondaryButtonStyle, minHeight: 30, marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <RotateCcw size={11} /> Restore default layout
        </button>
        </Tip>
      </div>
      {addDesigns && addDesignsOpen && (
        <div style={{ ...softPanelStyle, margin: '8px 0' }}>
          <AddDesignsPanel />
        </div>
      )}
      <p style={hintStyle}>
        Drag any layer on the video to move it, or use its corner handle to resize. Arrow keys nudge the
        selected layer by 1% (Shift for 5%), Delete hides it. Layers stay inside the 2% safe area of the
        frame, and positions are saved with your project.
      </p>
      <EditorTour />
      <BrandAndTemplates />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 14, marginTop: 12 }} className="guided-overlay-grid">
        {/* ── Stage column: stage + anything pinned directly under it ───── */}
        <div style={{ minWidth: 0, position: 'sticky', top: 8, alignSelf: 'start', display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="overlay-stage-column">
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
          {liveOn ? (
            <>
              <div data-testid="editor-live-player" style={{ position: 'absolute', inset: 0 }}>
                <PersonalizationPlayer
                  inputProps={inputProps}
                  hideTransport
                  loop
                  playerRefOverride={playerRef}
                  onFrameChange={setPlayFrame}
                  onPlayingChange={setPlaying}
                  playbackRate={playRate}
                  ariaLabel="Live preview of your video"
                />
              </div>
              {/* Shield: clicks on empty stage must not reach the Player (it would toggle play). Layers sit above it. */}
              <div aria-hidden data-testid="editor-live-shield" style={{ position: 'absolute', inset: 0 }} />
              {/* Captions: a grip level with them, to drag them up or down (saved as the captions' vertical offset). */}
              {ctx.previewSettings.captions?.enabled && ctx.previewSettings.captions.forUrl === inputProps.videoUrl && (
                <CaptionDragHandle
                  position={ctx.previewSettings.captions.position}
                  offsetY={ctx.previewSettings.captions.custom?.offsetY}
                  onChange={(offsetY) => { const c = ctx.previewSettings.captions; if (c) ctx.updatePreviewCaptions({ custom: { ...c.custom, offsetY } }) }}
                  // Let go over other text and the captions stop short of it (unless "Keep clear of text" is off).
                  onRelease={() => {
                    const c = ctx.previewSettings.captions
                    if (!c || c.custom?.keepClear === false) return
                    const a = captionAvoid(ctx.previewSettings, inputProps.brand)
                    const out = a ? clearOf(a) : null
                    if (out?.overlapped && out.cleared) ctx.updatePreviewCaptions({ custom: { ...c.custom, offsetY: out.offsetY } })
                  }}
                />
              )}
            </>
          ) : (
            <>
          {inputProps.posterUrl ? (
            <img
              src={inputProps.posterUrl}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85, filter: lookFilter(settings.look) }}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 12 }}>
              Your video
            </div>
          )}
          {lookOverlays(settings.look).map((o) => <div key={o.key} aria-hidden style={{ position: 'absolute', inset: 0, background: o.color, pointerEvents: 'none' }} />)}
          {settings.look && settings.look.vignette > 0 ? (
            <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,${vignetteStops(settings.look.vignette)[2].alpha}) 100%)` }} />
          ) : null}
          <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: settings.brandColors.backgroundDim, pointerEvents: 'none' }} />
            </>
          )}
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

          {guides.x.map((x) => (
            <div key={`gx-${x}`} aria-hidden data-testid="snap-guide-x" style={{ position: 'absolute', top: 0, bottom: 0, left: `${x * 100}%`, width: 1, background: '#ff4fd8', opacity: 0.85, pointerEvents: 'none', zIndex: 50 }} />
          ))}
          {guides.y.map((y) => (
            <div key={`gy-${y}`} aria-hidden data-testid="snap-guide-y" style={{ position: 'absolute', left: 0, right: 0, top: `${y * 100}%`, height: 1, background: '#ff4fd8', opacity: 0.85, pointerEvents: 'none', zIndex: 50 }} />
          ))}

          {factor > 0 &&
            editableLayers.filter((layer) => layer.visible).map((layer) => {
              const isDesign = layer.kind === 'design'
              // A headline/tagline that would only repeat the business name on
              // screen isn't drawn in the video, so here it's a faded "add
              // your text" placeholder you can still grab and move.
              const repeatsName = isRepeatedBusinessName(layer, brand, editableLayers)
              const text = repeatsName ? `${LAYER_LABELS[layer.kind]} — add your text` : layerText(layer, brand)
              const box = toStageBox(layer, compW, compH, stageWidth, isDesign || isImageLayerKind(layer.kind) ? undefined : text)
              const imageUrl = layerImageUrl(layer, brand)
              if (!isDesign && !isImageLayerKind(layer.kind) && !text.trim()) return null
              if (isImageLayerKind(layer.kind) && !imageUrl) return null
              const isSelected = selected?.id === layer.id
              const color = layer.color ?? (layer.kind === 'cta' ? settings.brandColors.accent : settings.brandColors.text)
              const design = isDesign && layer.designId ? getRemotionDesignTemplate(layer.designId) : undefined
              // Image presentation: the SAME resolver as the composition, so the stage shows what the video shows.
              const imgHints = isImageLayerKind(layer.kind) ? inputProps.settings?.imageHints?.[imageUrl] : undefined
              let look = isImageLayerKind(layer.kind)
                ? resolveImageLook({ role: roleForLayer(layer), kind: layer.kind, layerStyle: layer.imageStyle, layerRole: layer.imageRole, hints: imgHints, layout: settings.layout, aspect: settings.aspectRatio })
                : null
              const imgUrls = [imageUrl, ...(layer.imageUrls ?? [])].filter(Boolean)
              if (look?.style?.presetId === 'multi-image-collage' && imgUrls.length < 2) look = { ...look, style: presetStyle('rounded-floating-card', settings.aspectRatio) }
              const isSplit = look?.style?.presetId === 'split-screen'

              if (isSplit && look?.style && liveOn) return null // the Player draws the split panel
              if (isSplit && look?.style) {
                // A half-frame panel is placed in composition space (not a draggable box).
                return (
                  <div key={layer.id} role="button" tabIndex={0} aria-label={`Select ${LAYER_LABELS[layer.kind]}`} aria-pressed={isSelected}
                    onClick={() => setSelectedId(layer.id)} onKeyDown={(event) => onLayerKeyDown(event, layer)}
                    style={{ position: 'absolute', left: 0, top: 0, width: compW * factor, height: compH * factor, opacity: layer.opacity, pointerEvents: 'none' }}>
                    <SplitPanel src={imageUrl} side={look.style.splitSide ?? (compH > compW * 1.1 ? 'bottom' : 'right')} imageStyle={look.style} compWidth={compW * factor} compHeight={compH * factor} />
                  </div>
                )
              }

              // Same local scrim the render draws behind this text (stage pixels).
              const scrimMetrics = !liveOn && hasTextScrim(layer.kind) && !repeatsName ? layerBoxMetrics(layer, compW, compH, text) : null
              const stageScrim = scrimMetrics
                ? scrimForBox(
                    { left: scrimMetrics.leftPx * factor, top: scrimMetrics.topPx * factor, width: scrimMetrics.widthPx * factor, height: scrimMetrics.heightPx * factor },
                    compW * factor,
                    compH * factor,
                  )
                : null
              const textMetrics = isTextStyleKind(layer.kind) && layer.kind !== 'cta' ? layerBoxMetrics(layer, compW, compH, text) : null
              const stageAlign = textMetrics ? textAlignFor(layer, textMetrics, compW) : 'center'
              const stageRule = scrimMetrics
                ? accentRuleStyle(
                    layer.kind, layer.animation,
                    { leftPx: scrimMetrics.leftPx * factor, topPx: scrimMetrics.topPx * factor, widthPx: scrimMetrics.widthPx * factor, heightPx: scrimMetrics.heightPx * factor },
                    compW * factor, compH * factor, settings.brandColors.accent, stageAlign,
                  )
                : null

              const layerContent = (
                <>
                  {isImageLayerKind(layer.kind) ? (
                    look?.style ? (
                      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                        {look.style.presetId === 'multi-image-collage' ? (
                          <ImageCollage urls={imgUrls.slice(0, 4)} imageStyle={look.style} boxWidth={box.width} boxHeight={box.width} compHeight={compH} compShort={Math.min(compW, compH)} factor={factor} brand={settings.brandColors} />
                        ) : (
                          <StyledBusinessImage
                            src={imageUrl}
                            imageStyle={look.style}
                            boxWidth={box.width}
                            boxHeight={box.width}
                            compHeight={compH}
                            compShort={Math.min(compW, compH)}
                            factor={factor}
                            brand={settings.brandColors}
                            aspect={imgHints?.aspect}
                          />
                        )}
                      </div>
                    ) : (
                      <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                    )
                  ) : isDesign ? (
                    // The REAL design, drawn by the same composition the video uses (not a name label).
                    <DesignLayerPlayer layer={layer} inputProps={inputProps} fallbackLabel={design ? design.name : 'Design'} />
                  ) : layer.kind === 'cta' ? (
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                      <span
                        style={{
                          ...ctaPillStyle({
                            background: layer.color ?? settings.brandColors.accent,
                            color: '#000000',
                            fontSizePx: box.fontSize,
                            fontFamily: layer.fontFamily,
                          }),
                          pointerEvents: 'none',
                        }}
                      >
                        {text}
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        ...layerTextStyle(isTextStyleKind(layer.kind) ? layer.kind : 'headline', {
                          fontSizePx: box.fontSize,
                          color,
                          fontFamily: layer.fontFamily,
                          align: stageAlign,
                          singleLine: isSingleLineBox(box.width, compW * factor),
                        }),
                        pointerEvents: 'none',
                        ...(repeatsName ? { opacity: 0.45, fontStyle: 'italic', fontSize: Math.max(10, box.fontSize * 0.55) } : {}),
                      }}
                      data-testid={repeatsName ? 'overlay-repeat-placeholder' : undefined}
                    >
                      {text}
                    </div>
                  )}
                </>
              )

              const kfState = isDesign ? NEUTRAL_KEYFRAME_STATE : keyframeStateFor(layer.keyframes, playFrame)
              const boxTransform = [...keyframeTransformParts(kfState, compW * factor, compH * factor), rotateCss(layer.rotation)].filter(Boolean).join(' ')
              let toolbarTop = 0
              let rotateInside = false
              if (isSelected) {
                const drawn = layerBoxMetrics(layer, compW, compH, isImageLayerKind(layer.kind) ? undefined : text)
                const h = drawn.heightPx * factor
                const ext = rotatedExtent(box.width, h, layer.rotation ?? 0)
                const mid = box.top + h / 2
                rotateInside = mid - ext.h / 2 < 40
                const below = mid + ext.h / 2 + 8
                toolbarTop = below + 38 > compH * factor ? mid - ext.h / 2 - 8 - 52 : below
              }

              return (
                <Fragment key={layer.id}>
                {stageScrim ? (
                  <div aria-hidden data-testid="stage-text-scrim" style={{ position: 'absolute', inset: 0, opacity: layer.opacity, pointerEvents: 'none' }}>
                    <div style={scrimStyle(stageScrim)} />
                  </div>
                ) : null}
                {stageRule ? <div aria-hidden data-testid="stage-headline-rule" style={{ ...stageRule, opacity: layer.opacity }} /> : null}
                <div
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
                    cursor: contractOf(layer).userMovable ? 'move' : 'default',
                    outline: isSelected ? `2px dashed ${C.cyan}` : 'none',
                    outlineOffset: 2,
                    // The selected layer's handles must stay grabbable even where another layer's box overlaps them.
                    ...(isSelected ? { zIndex: 3 } : {}),
                    opacity: layer.opacity * kfState.opacity,
                    userSelect: 'none',
                    // The box follows the layer's keyframes at the playhead and turns with the layer (about its own center), and so do its handles.
                    ...(isDesign || !boxTransform ? {} : { transform: boxTransform, transformOrigin: 'center center' }),
                  }}
                >
                  {liveOn ? (
                    // The real Player draws this layer; here it is only a transparent hit area. Text keeps its size
                    // (hidden, not removed) so the box fits it; images and designs mount nothing.
                    isImageLayerKind(layer.kind) || isDesign ? null : <div aria-hidden style={{ visibility: 'hidden' }}>{layerContent}</div>
                  ) : layerContent}
                  {isSelected && contractOf(layer).userResizable && HANDLES.map((h) => (
                    <span key={h.id} style={{ position: 'absolute', left: `${h.left}%`, top: `${h.top}%`, transform: 'translate(-50%, -50%)', zIndex: 4 }}>
                      <Tip id="resizeHandle" side="top">
                        <div
                          role="button"
                          tabIndex={0}
                          // The bottom-right handle keeps the plain name the app has always used; the others say where they are.
                          aria-label={h.id === 'se' ? `Resize ${LAYER_LABELS[layer.kind]}` : `Resize ${LAYER_LABELS[layer.kind]} (${h.label})`}
                          data-testid={`resize-handle-${h.id}`}
                          onPointerDown={(event) => startDrag(event, layer, 'resize', h.id)}
                          onKeyDown={(event) => onHandleKeyDown(event, layer)}
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 3,
                            background: C.cyan,
                            border: '2px solid #000000',
                            cursor: cursorForHandle(h.id, layer.rotation ?? 0),
                            touchAction: 'none',
                          }}
                        />
                      </Tip>
                    </span>
                  ))}
                  {isSelected && contractOf(layer).userRotatable && !layer.locked && layer.kind !== 'design' && (
                    <span style={{ position: 'absolute', left: '50%', // Normally above the top edge; a layer at the very top of the frame would put it outside the (clipped) stage, so it sits just inside instead.
                      top: rotateInside ? 8 : -34, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 4 }}>
                      <Tip id="rotateHandle" side="top">
                        <div
                          role="slider"
                          tabIndex={0}
                          aria-label={`Rotate ${LAYER_LABELS[layer.kind]}`}
                          aria-valuemin={-180}
                          aria-valuemax={180}
                          aria-valuenow={layer.rotation ?? 0}
                          aria-valuetext={`${layer.rotation ?? 0} degrees`}
                          data-testid="rotate-handle"
                          onPointerDown={(event) => startDrag(event, layer, 'rotate')}
                          onDoubleClick={(event) => { event.stopPropagation(); commitRotation(layer, 0) }}
                          onKeyDown={(event) => {
                            const step = event.shiftKey ? 15 : 1
                            const next = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? (layer.rotation ?? 0) - step
                              : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? (layer.rotation ?? 0) + step
                              : event.key === 'Home' ? 0 : null
                            if (next === null) return
                            event.preventDefault()
                            event.stopPropagation()
                            commitRotation(layer, next)
                          }}
                          style={{ width: 14, height: 14, borderRadius: '50%', background: C.cyan, border: '2px solid #000000', cursor: 'grab', touchAction: 'none' }}
                        />
                      </Tip>
                      <span aria-hidden style={{ width: 1, height: 16, background: C.cyan }} />
                    </span>
                  )}
                </div>
                  {isSelected && layer.kind !== 'design' && (
                    <div
                      role="toolbar"
                      aria-label={`${LAYER_LABELS[layer.kind]} actions`}
                      data-testid="layer-toolbar"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      style={{
                        position: 'absolute',
                        left: box.left,
                        // Below the layer's (rotated) bounding box, or above it when there is no room below.
                        top: toolbarTop,
                        display: 'flex',
                        gap: 2,
                        padding: 3,
                        background: 'rgba(8,11,15,.92)',
                        border: `1px solid ${C.borderStrong}`,
                        borderRadius: 10,
                        boxShadow: '0 6px 20px rgba(0,0,0,.5)',
                        zIndex: 60,
                        cursor: 'default',
                      }}
                    >
                      {([
                        { id: 'forward', tip: 'layerForward', label: 'Bring forward', icon: <ArrowUp size={13} />, disabled: !canMoveLayer(settings.layers, layer.id, 'forward'), run: () => restack(layer.id, 'forward') },
                        { id: 'backward', tip: 'layerBackward', label: 'Send backward', icon: <ArrowDown size={13} />, disabled: !canMoveLayer(settings.layers, layer.id, 'backward'), run: () => restack(layer.id, 'backward') },
                        { id: 'lock', tip: 'layerLock', label: layer.locked ? 'Unlock position' : 'Lock position', icon: layer.locked ? <Unlock size={13} /> : <Lock size={13} />, disabled: false, pressed: !!layer.locked, run: () => setPreviewLayerLocked(layer.id, !layer.locked) },
                        { id: 'hide', tip: 'layerHide', label: `Hide ${LAYER_LABELS[layer.kind]}`, icon: <EyeOff size={13} />, disabled: false, run: () => updatePreviewLayer(layer.id, { visible: false }) },
                      ] as { id: string; tip: EditorTipId; label: string; icon: React.ReactNode; disabled: boolean; pressed?: boolean; run: () => void }[]).map((a) => (
                        <Tip key={a.id} id={a.tip} side="top">
                        <button
                          type="button"
                          data-testid={`layer-toolbar-${a.id}`}
                          aria-label={a.label}
                          aria-pressed={a.pressed}
                          disabled={a.disabled}
                          onClick={a.run}
                          style={{
                            width: 26, height: 24, display: 'grid', placeItems: 'center', borderRadius: 6, border: 'none', cursor: a.disabled ? 'default' : 'pointer',
                            background: a.pressed ? 'transparent' : 'transparent', color: a.disabled ? C.muted2 : a.pressed ? C.cyan : C.text, opacity: a.disabled ? 0.5 : 1,
                          }}
                        >
                          {a.icon}
                        </button>
                        </Tip>
                      ))}
                    </div>
                  )}
                </Fragment>
              )
            })}
        </div>
        {liveStage && (
          <div data-testid="editor-transport" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: -2 }}>
            {liveOn && (
              <>
                <Tip id="livePlay" side="top">
                  <button
                    type="button"
                    data-testid="editor-play"
                    aria-label={playing ? 'Pause preview' : 'Play preview'}
                    onClick={() => { const pl = playerRef.current; if (!pl) return; if (pl.isPlaying()) pl.pause(); else pl.play() }}
                    style={{ ...secondaryButtonStyle, minHeight: 28, width: 34, padding: 0, display: 'grid', placeItems: 'center' }}
                  >
                    {playing ? <Pause size={13} /> : <Play size={13} />}
                  </button>
                </Tip>
                <input
                  type="range"
                  data-testid="editor-scrubber"
                  aria-label="Preview position"
                  min={0}
                  max={Math.max(1, Math.round(settings.durationInFrames) - 1)}
                  value={Math.min(playFrame, Math.max(1, Math.round(settings.durationInFrames) - 1))}
                  onChange={(event) => { try { playerRef.current?.pause(); playerRef.current?.seekTo(Number(event.target.value)) } catch { /* no player */ } }}
                  style={{ flex: 1, accentColor: C.cyan }}
                />
                <span data-testid="editor-timecode" style={{ ...hintStyle, margin: 0, fontVariantNumeric: 'tabular-nums', minWidth: 74, textAlign: 'right' }}>
                  {(playFrame / Math.max(1, settings.fps)).toFixed(1)} / {(settings.durationInFrames / Math.max(1, settings.fps)).toFixed(1)} s
                </span>
                <div role="group" aria-label="Preview speed" style={{ display: 'inline-flex', gap: 3 }}>
                  {PLAYBACK_RATES.map((r) => (
                    <button key={r} type="button" data-testid={`editor-speed-${r}`} aria-pressed={playRate === r} onClick={() => setPlayRate(r)} style={{ ...chipStyle(playRate === r), minHeight: 28, fontSize: 10, padding: '0 6px' }}>{r}×</button>
                  ))}
                </div>
              </>
            )}
            <span style={{ flex: liveOn ? undefined : 1 }} />
            <Tip id="liveToggle" side="top">
              <button
                type="button"
                data-testid="editor-live-toggle"
                aria-pressed={liveOn}
                onClick={() => setLiveWanted((v) => !v)}
                style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 10, padding: '0 10px', borderColor: liveOn ? C.cyan : undefined, color: liveOn ? C.cyan : undefined }}
              >
                Live: {liveOn ? 'On' : 'Off'}
              </button>
            </Tip>
          </div>
        )}
        {belowStage}
        <Timeline
          layers={editableLayers}
          labels={Object.fromEntries(editableLayers.map((l) => [l.id, LAYER_LABELS[l.kind]]))}
          durationInFrames={settings.durationInFrames}
          fps={settings.fps}
          selectedId={selected?.id ?? ''}
          onSelect={setSelectedId}
          onChange={(id, patch) => updatePreviewLayer(id, patch)}
          playheadFrame={liveOn ? playFrame : undefined}
          onKeyframeMove={(id, from, to) => {
            const layer = settings.layers.find((l) => l.id === id)
            if (layer) updatePreviewLayer(id, { keyframes: moveKeyframe(layer.keyframes, from, to, settings.durationInFrames) })
          }}
          onSeek={liveOn ? (f) => { try { playerRef.current?.pause(); playerRef.current?.seekTo(f) } catch { /* no player */ } } : undefined}
        />
        </div>

        {/* ── Layer list + controls ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <LookPanel inputProps={inputProps} />
          <CutoutPanel inputProps={inputProps} />
          <div style={labelStyle}>Layers</div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onReorderEnd}>
          <SortableContext items={[...settings.layers].reverse().map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {[...settings.layers].reverse().map((layer) => {
            const layerDesign =
              layer.kind === 'design' && layer.designId
                ? getRemotionDesignTemplate(layer.designId)
                : undefined
            return (
              <SortableRow key={layer.id} id={layer.id} label={LAYER_LABELS[layer.kind]}>
              <div
                role="button"
                tabIndex={0}
                aria-label={`Select ${LAYER_LABELS[layer.kind]}`}
                aria-pressed={selected?.id === layer.id}
                onKeyDown={(event) => {
                  // Keys aimed at the row's own buttons (show/hide) are theirs.
                  if (event.target !== event.currentTarget) return
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
                  <Tip id="layerVisibility">
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
                  </Tip>
                )}
              </div>
              </SortableRow>
            )
          })}
          </SortableContext>
          </DndContext>

          {selected && selected.kind !== 'endCard' && (
            <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <div style={{ color: C.text, fontSize: 12, fontWeight: 800 }}>{LAYER_LABELS[selected.kind]}</div>

              <Tip id="inspectorTabs" side="top">
                <div role="group" aria-label="Layer settings" data-testid="inspector-tabs" style={{ display: 'flex', gap: 4 }}>
                  {INSPECTOR_TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={inspectorTab === t.id}
                      data-testid={`inspector-tab-${t.id}`}
                      onClick={() => setInspectorTab(t.id)}
                      style={{ ...chipStyle(inspectorTab === t.id), minHeight: 28, fontSize: 11, flex: 1 }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </Tip>

              <div id={controlId('panel-content')} hidden={inspectorTab !== 'content'} style={{ display: inspectorTab === 'content' ? 'flex' : 'none', flexDirection: 'column', gap: 10 }}>
              {selected.kind === 'design' && (
                <div style={{ color: C.muted, fontSize: 10 }}>
                  {selectedDesign
                    ? `${selectedDesign.name} — ${selectedDesign.description}`
                    : 'This design is not registered, so it will not render.'}
                </div>
              )}

              {selected.kind === 'design' && selectedDesign && (
                <div data-testid="design-actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Two different things: restoring keeps the design and clears YOUR edits to it; removing takes the design off the video. */}
                  <button
                    type="button"
                    data-testid="design-restore-defaults"
                    onClick={() => updatePreviewLayer(selected.id, { text: undefined, textSlotOverrides: undefined, color: undefined, fontFamily: undefined, imageUrl: undefined })}
                    style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 10, padding: '0 10px' }}
                  >
                    Restore design defaults
                  </button>
                  {!confirmRemoveDesign ? (
                    <button type="button" data-testid="design-remove" onClick={() => setConfirmRemoveDesign(true)} style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 10, padding: '0 10px' }}>
                      Remove design
                    </button>
                  ) : (
                    <span role="alert" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 10, color: C.muted }}>
                      Remove “{selectedDesign.name}” from the video?
                      <button type="button" data-testid="design-remove-confirm" onClick={() => { setConfirmRemoveDesign(false); removePreviewDesignLayer(selected.id) }} style={{ ...secondaryButtonStyle, minHeight: 26, fontSize: 10, padding: '0 8px' }}>Yes, remove</button>
                      <button type="button" onClick={() => setConfirmRemoveDesign(false)} style={{ ...secondaryButtonStyle, minHeight: 26, fontSize: 10, padding: '0 8px' }}>Keep</button>
                    </span>
                  )}
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
                  {/* A design with no text has no text colour or font: those controls would do nothing. */}
                  {!(selected.kind === 'design' && selectedSlots.length === 0) && (
                  <div className="grid grid-cols-2" style={{ gap: 8 }}>
                    <ColorField
                      id={controlId('color')}
                      label={selected.kind === 'cta' ? 'Button color' : 'Color'}
                      ariaLabel={selected.kind === 'cta' ? 'Button color' : 'Text color'}
                      tipId={selected.kind === 'cta' ? 'buttonColor' : 'textColor'}
                      value={selected.color || (selected.kind === 'cta' ? settings.brandColors.accent : settings.brandColors.text)}
                      onChange={(hex) => updatePreviewLayer(selected.id, { color: hex })}
                      brand={settings.brandColors}
                      posterUrl={inputProps.posterUrl}
                    />
                    {/* Only shown when there's a real choice: with one bundled
                        font every option renders the same in the video. */}
                    {SELECTABLE_FONT_COUNT > 1 && (
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
                    )}
                  </div>
                  )}
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

              {isImageLayerKind(selected.kind) && (() => {
                const url = (selected.imageUrl || (selected.kind === 'logo' ? brand.logoUrl : selected.kind === 'serviceImage' ? brand.serviceUrl ?? brand.productUrl : brand.productUrl ?? brand.serviceUrl)) ?? ''
                const hints = inputProps.settings?.imageHints?.[url]
                const resolved = resolveImageLook({ role: roleForLayer(selected), kind: selected.kind, layerStyle: selected.imageStyle, layerRole: selected.imageRole, hints, layout: settings.layout, aspect: settings.aspectRatio })
                if (!resolved.style) return null
                const current: ImageStyle = resolved.style
                // An edit starts from the look being shown and makes it the customer's own.
                const edit = (patch: Partial<ImageStyle>) => {
                  updatePreviewLayer(selected.id, { imageStyle: { ...current, ...patch, auto: false } })
                }
                return (
                  <ImageStyleControls
                    role={(selected.imageRole ?? hints?.role ?? imageRoleForLayerKind(selected.kind))}
                    compShort={Math.min(compW, compH)}
                    onRole={(r) => updatePreviewLayer(selected.id, { imageRole: r, imageStyle: undefined })}
                    onPreset={(id) => updatePreviewLayer(selected.id, { imageStyle: presetStyle(id, settings.aspectRatio, false) })}
                    libraryOptions={imageOptions(selected).filter((o) => o.value && o.value !== url).map((o) => ({ value: o.value, label: o.label }))}
                    extraUrls={selected.imageUrls ?? []}
                    onExtraUrls={(urls) => updatePreviewLayer(selected.id, { imageUrls: urls.length ? urls : undefined })}
                    style={current}
                    isAuto={!selected.imageStyle || selected.imageStyle.auto === true}
                    reason={resolved.reason}
                    onChange={edit}
                    onReset={() => updatePreviewLayer(selected.id, { imageStyle: undefined })}
                  />
                )
              })()}

              </div>

              <div id={controlId('panel-layout')} hidden={inspectorTab !== 'layout'} style={{ display: inspectorTab === 'layout' ? 'flex' : 'none', flexDirection: 'column', gap: 10 }}>
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

              {selected.kind !== 'design' && (
                <LayerEffectsControls
                  layer={selected}
                  onChange={(effects) => updatePreviewLayer(selected.id, { effects })}
                  brand={settings.brandColors}
                  posterUrl={inputProps.posterUrl}
                />
              )}

              {contractOf(selected).userRotatable && selected.kind !== 'design' && (
                <div>
                  <label style={labelStyle} htmlFor={controlId('rotation')}>Rotation</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Tip id="rotationField" side="top">
                      <input
                        id={controlId('rotation')}
                        type="number"
                        aria-label="Layer rotation in degrees"
                        data-testid="rotation-field"
                        min={-180}
                        max={180}
                        step={1}
                        value={selected.rotation ?? 0}
                        disabled={Boolean(selected.locked)}
                        onChange={(event) => {
                          if (event.target.value.trim() === '') return
                          const n = Number(event.target.value)
                          if (Number.isFinite(n)) commitRotation(selected, n)
                        }}
                        style={{ ...inputStyle, width: 90 }}
                      />
                    </Tip>
                    <span style={{ ...hintStyle, margin: 0 }}>degrees</span>
                    <button
                      type="button"
                      data-testid="rotation-reset"
                      disabled={!isRotated(selected.rotation) || Boolean(selected.locked)}
                      onClick={() => commitRotation(selected, 0)}
                      style={{ ...secondaryButtonStyle, minHeight: 28, fontSize: 11, padding: '0 10px', opacity: isRotated(selected.rotation) ? 1 : 0.5 }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}

              </div>

              <div id={controlId('panel-timing')} hidden={inspectorTab !== 'timing'} style={{ display: inspectorTab === 'timing' ? 'flex' : 'none', flexDirection: 'column', gap: 10 }}>
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
                  <label style={labelStyle} htmlFor={controlId('delay')}>Animation starts after (seconds)</label>
                  <input
                    id={controlId('delay')}
                    type="number"
                    aria-label="Animation starts after seconds"
                    min={0}
                    max={Math.max(0, settings.durationInFrames / settings.fps)}
                    step={0.1}
                    value={framesToSeconds(selected.animationDelay, settings.fps)}
                    onChange={(event) => updatePreviewLayer(selected.id, { animationDelay: secondsToFrames(Number(event.target.value), settings.fps) })}
                    style={{ ...inputStyle, minHeight: 34 }}
                  />
                </div>
                <div>
                  <label style={labelStyle} htmlFor={controlId('start')}>Shown from (seconds)</label>
                  <input
                    id={controlId('start')}
                    type="number"
                    aria-label="Shown from seconds"
                    min={0}
                    max={Math.max(0, settings.durationInFrames / settings.fps)}
                    step={0.1}
                    value={framesToSeconds(selected.startFrame, settings.fps)}
                    onChange={(event) => updatePreviewLayer(selected.id, { startFrame: secondsToFrames(Number(event.target.value), settings.fps) })}
                    style={{ ...inputStyle, minHeight: 34 }}
                  />
                </div>
              </div>

              {selected.kind !== 'design' && contractOf(selected).userMovable && (
                <KeyframePanel
                  layer={selected}
                  playFrame={playFrame}
                  fps={settings.fps}
                  durationInFrames={settings.durationInFrames}
                  onChange={(keyframes) => updatePreviewLayer(selected.id, { keyframes })}
                  onSeek={liveOn ? (f) => { try { playerRef.current?.pause(); playerRef.current?.seekTo(f) } catch { /* no player */ } } : undefined}
                />
              )}

              </div>

              <div hidden={inspectorTab !== 'layout'} style={{ display: inspectorTab === 'layout' ? 'flex' : 'none', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: C.text, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  aria-label="Lock position"
                  data-testid="overlay-lock-position"
                  checked={selected.locked === true}
                  onChange={(event) => setPreviewLayerLocked(selected.id, event.target.checked)}
                />
                Lock position (recommendations and layout changes will not move it)
              </label>

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
