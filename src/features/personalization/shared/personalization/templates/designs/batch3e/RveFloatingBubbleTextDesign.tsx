/**
 * Adapter for the upstream `rve-floating-bubble-text` template.
 *
 * Upstream: `templates/floating-bubble-text.tsx` (remotion-templates, MIT —
 * React Video Editor, no named copyright holder).
 *
 * A gradient pill with a thin two-colour rim that springs in and then bobs
 * gently. The pill is centred with `left: 50%` + `translate(-50%)`, so its
 * shrink-to-fit width is capped at half the canvas: the adapter uses the
 * width-aware unit (smaller type on 9:16 / 1:1) and lets the copy wrap to at
 * most two lines inside the pill, truncating beyond that.
 *
 * Brand mapping: headline (then offer, business name) → the pill copy; a deep
 * primary → primary → the pill gradient; accent → lightened primary → the rim
 * (the upstream's cyan → magenta); the layer colour → the copy.
 *
 * Export note: the rim relies on `background-clip: padding-box`, which the
 * browser export rasteriser does not implement; in an exported frame the rim
 * reads as part of the pill gradient. The copy and the motion are unchanged.
 */

import React from 'react'
import { FloatingBubbleText } from '../../_upstream/rve-floating-bubble-text/FloatingBubbleText'
import { type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  brandAccent,
  brandPrimary,
  brandText,
  darkenColor,
  fitChars,
  lightenColor,
  px,
  remUnitForCentred,
  slotText,
  truncateText,
  withAlpha,
} from './batch3eShared'

export const RVE_FLOATING_BUBBLE_TEXT_ID = 'rve-floating-bubble-text'

const ZOOM = 1.5

export const RveFloatingBubbleTextDesign: React.FC<DesignAdapterProps> = (props) => {
  const rem = remUnitForCentred(props, ZOOM)
  const unit = rem / 16
  const fontPx = 4.5 * rem
  // Half the canvas minus the pill's 3.5rem horizontal padding on each side.
  const inner = props.width * 0.48 - 7 * rem

  const copy = truncateText(
    slotText(props, 'headline', ['offer', 'businessName']),
    fitChars(inner, fontPx, 2, 28),
  )

  const primary = brandPrimary(props)

  return (
    <RveDesignStage designId={RVE_FLOATING_BUBBLE_TEXT_ID} props={props}>
      <FloatingBubbleText
        text={copy}
        color={brandText(props)}
        gradientFrom={darkenColor(primary, 0.45)}
        gradientTo={primary}
        rimFrom={brandAccent(props)}
        rimTo={lightenColor(primary, 0.45)}
        boxShadow={`0 ${px(8 * unit)} ${px(32 * unit)} ${withAlpha(darkenColor(primary, 0.45), 0.2)}`}
        fontSize={px(fontPx)}
        padding={`${px(2 * rem)} ${px(3.5 * rem)}`}
        borderRadius={px(24 * unit)}
        borderWidth={px(Math.max(2, 3 * unit))}
        floatDistance={20 * unit}
      />
    </RveDesignStage>
  )
}

export default RveFloatingBubbleTextDesign
