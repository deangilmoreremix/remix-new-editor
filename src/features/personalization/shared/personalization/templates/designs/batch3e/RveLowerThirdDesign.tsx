/**
 * Adapter for the upstream `rve-lower-third` template.
 *
 * Upstream: `templates/lower-third.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder).
 *
 * A broadcast-style lower third: a thin gradient accent line, then a dark
 * name panel with a coloured edge bar slides in from the left, and the name
 * and title fade up inside it. The upstream lays it on a full-canvas dark
 * gradient; as an overlay the adapter makes that transparent so the panel
 * sits on the customer's video (the panel keeps its own translucent black).
 *
 * Brand mapping: business name → the name line (primary slot), offer (then
 * headline) → the title line, primary → accent → the accent line, primary →
 * the edge bar, the layer colour → the name. Sizes scale with the
 * composition; both lines are truncated to fit 70 % of the canvas width, and
 * the panel's slide-in distance is widened to the canvas so a long name can
 * never peek in before its entrance.
 */

import React from 'react'
import { LowerThird } from '../../_upstream/rve-lower-third/LowerThird'
import { TRANSPARENT, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  brandAccent,
  brandPrimary,
  brandText,
  firstSlot,
  fitChars,
  px,
  remUnit,
  slotText,
  truncateText,
} from './batch3eShared'

export const RVE_LOWER_THIRD_ID = 'rve-lower-third'

const ZOOM = 1.8

export const RveLowerThirdDesign: React.FC<DesignAdapterProps> = (props) => {
  const rem = remUnit(props, ZOOM)
  const unit = rem / 16
  const namePx = 1.6 * rem
  const titlePx = 1 * rem
  const left = 40 * unit
  const textWidth = props.width * 0.7 - 64 * unit

  const name = truncateText(
    slotText(props, 'businessName', ['headline']),
    fitChars(textWidth / 1.02, namePx, 1, 36),
  )
  const title = truncateText(
    firstSlot(props, ['offer', 'headline']),
    fitChars(textWidth / 1.05, titlePx, 1, 56),
  )

  const primary = brandPrimary(props)

  return (
    <RveDesignStage designId={RVE_LOWER_THIRD_ID} props={props}>
      <LowerThird
        name={name}
        title={title}
        background={TRANSPARENT}
        accentFrom={primary}
        accentTo={brandAccent(props)}
        barColor={primary}
        nameColor={brandText(props)}
        nameFontSize={px(namePx)}
        titleFontSize={px(titlePx)}
        panelPadding={`${px(16 * unit)} ${px(32 * unit)}`}
        left={Math.round(left)}
        accentWidth={Math.round(200 * unit)}
        accentHeight={Math.max(2, Math.round(3 * unit))}
        accentGap={Math.round(4 * unit)}
        barWidth={Math.max(3, Math.round(4 * unit))}
        titleGap={Math.round(4 * unit)}
        accentTravel={Math.round(left + 200 * unit + 8)}
        barTravel={Math.round(props.width)}
      />
    </RveDesignStage>
  )
}

export default RveLowerThirdDesign
