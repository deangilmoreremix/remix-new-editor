/**
 * Adapter for the upstream `rve-title-split` template.
 *
 * Upstream: `templates/title-split.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder).
 *
 * Two upper-case lines meet in the middle: an outlined line drops from above
 * and a solid line rises from below, then both glow softly. The upstream
 * paints a full-canvas `#111827` behind them; as an overlay the adapter makes
 * that canvas transparent so the lines sit on the customer's video.
 *
 * Brand mapping: headline → the outlined top line, business name → the solid
 * bottom line (both upper-cased like the upstream "CREATIVE" / "STUDIO"); the
 * layer colour → the outline and the solid line; the brand primary → the
 * glow. Instead of truncating early, the type is fitted to the longer line so
 * both stay on one line in every format (down to 40 % of the upstream size),
 * and copy past 22 characters is truncated.
 */

import React from 'react'
import { TitleSplit } from '../../_upstream/rve-title-split/TitleSplit'
import { DESIGN_FONT_STACK } from '../fonts'
import { TRANSPARENT, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  brandPrimary,
  brandText,
  firstSlot,
  fitFontPx,
  px,
  remUnit,
  rgbTriplet,
  slotText,
  truncateText,
} from './batch3eShared'

export const RVE_TITLE_SPLIT_ID = 'rve-title-split'

const ZOOM = 1.6

/** The hard character ceiling per line. */
export const TITLE_SPLIT_MAX_CHARS = 22

/** Upper-case bold glyphs + the 0.15em letter spacing, as a fraction of the size. */
const SPACED_CAPS_RATIO = 0.82

export const RveTitleSplitDesign: React.FC<DesignAdapterProps> = (props) => {
  const top = truncateText(
    slotText(props, 'headline', ['offer', 'businessName']),
    TITLE_SPLIT_MAX_CHARS,
  ).toUpperCase()
  const bottom = truncateText(
    firstSlot(props, ['businessName', 'offer']),
    TITLE_SPLIT_MAX_CHARS,
  ).toUpperCase()

  const rem = remUnit(props, ZOOM)
  const unit = rem / 16
  const longest = Math.max(top.length, bottom.length, 1)
  const fontPx = fitFontPx(props.width * 0.88, longest, 5 * rem, SPACED_CAPS_RATIO, 0.4)

  const text = brandText(props)

  return (
    <RveDesignStage designId={RVE_TITLE_SPLIT_ID} props={props}>
      <TitleSplit
        topText={top}
        bottomText={bottom}
        backgroundColor={TRANSPARENT}
        strokeColor={text}
        strokeWidth={px(Math.max(1.5, fontPx * 0.025))}
        bottomColor={text}
        glowRgb={rgbTriplet(brandPrimary(props))}
        fontSize={px(fontPx)}
        gap={px(0.25 * rem)}
        travel={120 * unit}
        fontFamily={DESIGN_FONT_STACK}
      />
    </RveDesignStage>
  )
}

export default RveTitleSplitDesign
