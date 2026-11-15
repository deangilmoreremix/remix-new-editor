import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { getRemotionDesignTemplate } from '../templates'
import { resolveDesignSlotValues } from './designSlots'
import { resolveDesignMedia } from './PersonalizationComposition'
import { DEFAULT_PREVIEW_BRAND_COLORS } from './types'
import type { PreviewBrandColors, PreviewInputProps, PreviewLayer } from './types'
import type { RemotionDesignComponentProps } from '../templates/types'

/**
 * A registered Remotion design drawn on a TRANSPARENT background, to be placed
 * inside a host's own positioned box (the Timeline Editor's overlay wrapper).
 *
 * It resolves text slots and media exactly like `PersonalizationComposition`
 * (same `resolveDesignSlotValues` / `resolveDesignMedia`), but draws no video,
 * no dimming and no end card, so it can sit on top of anything. Time is local:
 * it reads `useCurrentFrame()` of the enclosing Sequence, so the design's
 * animation starts when the overlay does.
 */
export interface DesignOverlayProps {
  designId: string
  /** The primary text slot (the layer's own text); absent = the brand value. */
  text?: string
  /** Per-slot overrides for the design's other slots, keyed by slot key. */
  textSlotOverrides?: Record<string, string>
  brand: PreviewInputProps['brand']
  brandColors?: Partial<PreviewBrandColors>
  /** Replaces the design's primary media (e.g. a chosen image). */
  imageUrl?: string
  /** The composition's size in px. */
  width: number
  height: number
  /** The size in px of the box this component is drawn into. */
  boxWidthPx: number
  boxHeightPx: number
  color?: string
  fontFamily?: string
}

export const DesignOverlay: React.FC<DesignOverlayProps> = (props) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const design = getRemotionDesignTemplate(props.designId)
  if (!design) return null

  const colors: PreviewBrandColors = { ...DEFAULT_PREVIEW_BRAND_COLORS, ...(props.brandColors ?? {}) }
  const layer = {
    id: 'design-overlay',
    kind: 'design',
    designId: props.designId,
    visible: true,
    x: 0.5,
    y: 0.5,
    scale: 1,
    animation: 'none',
    animationDelay: 0,
    startFrame: 0,
    opacity: 1,
    text: props.text,
    textSlotOverrides: props.textSlotOverrides,
    imageUrl: props.imageUrl,
    color: props.color,
    fontFamily: props.fontFamily,
  } as unknown as PreviewLayer

  const slots = resolveDesignSlotValues(design, layer, props.brand)
  const textSlots = Array.isArray(design.textSlots) ? design.textSlots : []
  const primary = textSlots.find((slot) => slot && slot.primary) ?? textSlots[0]
  const DesignComponent = design.component
  const designProps = (design.defaultProps ?? {}) as Partial<RemotionDesignComponentProps>

  return (
    <AbsoluteFill data-remotion-design-id={design.id} style={{ pointerEvents: 'none' }}>
      <DesignComponent
        {...designProps}
        text={primary ? (slots[primary.key] ?? '') : ''}
        textSlots={slots}
        colors={{ primary: colors.primary, accent: colors.accent, text: colors.text, backgroundDim: colors.backgroundDim }}
        media={resolveDesignMedia(design, layer, props.brand)}
        box={{ leftPx: 0, topPx: 0, widthPx: props.boxWidthPx, heightPx: props.boxHeightPx }}
        width={props.width}
        height={props.height}
        frame={frame}
        fps={fps}
        opacity={1}
        color={props.color ?? colors.text}
        fontFamily={props.fontFamily}
      />
    </AbsoluteFill>
  )
}

export default DesignOverlay
