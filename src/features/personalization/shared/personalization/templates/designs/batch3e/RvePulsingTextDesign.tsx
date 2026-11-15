/**
 * Adapter for the upstream `rve-pulsing-text` template.
 *
 * Upstream: `templates/pulsing-text.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder).
 *
 * Each letter breathes (scale 1 → 1.2 → 1) on a 30-frame loop, six frames
 * after its neighbour, over a soft halo. The row is centred with
 * `left: 50%` + `translate(-50%)`, so it must fit in half the canvas; the
 * adapter fits the type size to the number of letters (never larger than the
 * upstream proportion × zoom) and truncates past 14 characters.
 *
 * Brand mapping: headline (then business name) → the letters (spaces become
 * non-breaking spaces so words stay apart in the flex row), the layer colour
 * → the letters, the brand primary → the halo.
 *
 * Export note: the upstream halo is a `filter: blur(20px)` disc, and the
 * browser export rasteriser implements no CSS `filter`. The adapter passes
 * `glowFilter: "none"` and draws the halo with a translucent disc plus a
 * `box-shadow` glow instead, which the preview and the export draw the same.
 */

import React from 'react'
import { PulsingText } from '../../_upstream/rve-pulsing-text/PulsingText'
import { type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  brandPrimary,
  brandText,
  fitFontPx,
  px,
  remUnitForCentred,
  slotText,
  truncateText,
  withAlpha,
} from './batch3eShared'

export const RVE_PULSING_TEXT_ID = 'rve-pulsing-text'

const ZOOM = 1.6

/** The hard character ceiling (the stagger is 6 frames per letter). */
export const PULSING_TEXT_MAX_CHARS = 14

export const RvePulsingTextDesign: React.FC<DesignAdapterProps> = (props) => {
  const copy = truncateText(
    slotText(props, 'headline', ['businessName', 'offer']),
    PULSING_TEXT_MAX_CHARS,
  )
  const count = Math.max(1, copy.length)

  const rem = remUnitForCentred(props, ZOOM)
  const baseFont = 5 * rem
  const gapRatio = 0.2 // upstream: 1rem gap next to 5rem type
  // Each letter is ~0.62em wide plus a 0.2em gap; the row must fit in ~46 %
  // of the canvas width.
  const fontPx = fitFontPx(props.width * 0.46, count, baseFont, 0.62 + gapRatio, 0.3)

  const primary = brandPrimary(props)

  return (
    <RveDesignStage designId={RVE_PULSING_TEXT_ID} props={props}>
      <PulsingText
        text={copy.replace(/ /g, ' ')}
        color={brandText(props)}
        fontSize={px(fontPx)}
        gap={px(fontPx * gapRatio)}
        glowSize={px(fontPx)}
        glowColor={withAlpha(primary, 0.28)}
        glowFilter="none"
        glowShadow={`0 0 ${px(fontPx * 0.4)} ${px(fontPx * 0.2)} ${withAlpha(primary, 0.28)}`}
      />
    </RveDesignStage>
  )
}

export default RvePulsingTextDesign
