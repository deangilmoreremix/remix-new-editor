/**
 * Adapter for the upstream `rve-bounce-text` template.
 *
 * Upstream: `templates/bounce-text.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder).
 *
 * A rounded gradient card that scales in with the headline sliding across it
 * and a subtitle fading in under it. The card is 80 % of the canvas wide (and
 * rests at 0.8 scale), so it never fills the frame: the canvas stays
 * transparent and the customer's video shows around it.
 *
 * Brand mapping: headline → title, offer (then business name) → subtitle,
 * the brand primary → the card gradient (a deep shade → the primary itself,
 * mirroring the upstream's dark-blue → blue), the layer colour → both lines.
 */

import React from 'react'
import { BounceText } from '../../_upstream/rve-bounce-text/BounceText'
import { DESIGN_FONT_STACK } from '../fonts'
import { type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  brandPrimary,
  brandText,
  darkenColor,
  firstSlot,
  fitChars,
  px,
  remUnit,
  slotText,
  truncateText,
} from './batch3eShared'

export const RVE_BOUNCE_TEXT_ID = 'rve-bounce-text'

/** Upstream size × this zoom on a 1080 px short edge. */
const ZOOM = 1.6

export const RveBounceTextDesign: React.FC<DesignAdapterProps> = (props) => {
  const rem = remUnit(props, ZOOM)
  const titlePx = 3.5 * rem
  const subtitlePx = 1.8 * rem
  // The card is 80 % wide with 3rem of horizontal padding on each side.
  const inner = props.width * 0.8 - 6 * rem

  const title = truncateText(
    slotText(props, 'headline', ['offer', 'businessName']),
    fitChars(inner, titlePx, 2, 44),
  )
  const subtitle = truncateText(
    firstSlot(props, ['offer', 'businessName']),
    fitChars(inner, subtitlePx, 2, 70),
  )

  const primary = brandPrimary(props)
  const text = brandText(props)

  return (
    <RveDesignStage designId={RVE_BOUNCE_TEXT_ID} props={props}>
      <BounceText
        title={title}
        subtitle={subtitle}
        gradientFrom={darkenColor(primary, 0.4)}
        gradientTo={primary}
        titleColor={text}
        subtitleColor={text}
        titleFontSize={px(titlePx)}
        subtitleFontSize={px(subtitlePx)}
        subtitleGap={px(0.75 * rem)}
        padding={`${px(2 * rem)} ${px(3 * rem)}`}
        borderRadius={px((20 * rem) / 16)}
        fontFamily={DESIGN_FONT_STACK}
      />
    </RveDesignStage>
  )
}

export default RveBounceTextDesign
