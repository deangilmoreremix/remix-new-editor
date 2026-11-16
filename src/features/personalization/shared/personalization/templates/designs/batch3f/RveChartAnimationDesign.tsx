/**
 * Adapter for the upstream `rve-chart-animation` template (a bar chart).
 *
 * Upstream: `templates/chart-animation.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder). Bars grow from the baseline one
 * after another, each topped by its value, under a title and a subtitle.
 *
 * DATA-VISUALIZATION INTRO CARD: the designed backdrop is kept (a deep shade
 * of the brand primary), the layer plays as an intro card and the catalog's
 * `placement.endFrame` then reveals the video.
 *
 * PLACEHOLDER DATA: the customer cannot enter chart data, so the bars are a
 * pinned, generic eight-month upward trend — not the upstream's demo values.
 * The adapter never fabricates numbers from brand text.
 *
 * Brand mapping: the bars alternate brand primary / accent (the upstream
 * rotates a ten-colour palette), the headline is the title and the offer the
 * subtitle.
 *
 * The upstream uses the fixed SVG id `shadow` (declared in
 * `BATCH_3F_FIXED_SVG_IDS`).
 */

import React from 'react'
import {
  ChartAnimation,
  type ChartAnimationPoint,
} from '../../_upstream/rve-chart-animation/ChartAnimation'
import { slotText, slotValue, truncateText, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  FitCanvas,
  brandBackdrop,
  brandPalette,
  fitChars,
  fitScale,
  readableOnDark,
  rgba,
} from './shared3f'

/** The pinned placeholder bars (y on the upstream's 0-100 scale). */
export const CHART_ANIMATION_PLACEHOLDER_DATA: ChartAnimationPoint[] = [
  { x: 0, y: 38, label: 'Jan' },
  { x: 1, y: 47, label: 'Feb' },
  { x: 2, y: 44, label: 'Mar' },
  { x: 3, y: 56, label: 'Apr' },
  { x: 4, y: 61, label: 'May' },
  { x: 5, y: 66, label: 'Jun' },
  { x: 6, y: 72, label: 'Jul' },
  { x: 7, y: 80, label: 'Aug' },
]

const CARD_W = 940
const CARD_H = 540
const PREFERRED_SCALE = 1.25

export const RveChartAnimationDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = fitScale(props, CARD_W, CARD_H, PREFERRED_SCALE)
  const text = readableOnDark(props)
  const title = truncateText(
    slotText(props, 'headline', ['businessName']),
    fitChars(CARD_W - 60, 28, 44),
  )
  // A secondary slot never inherits the headline.
  const subtitle = truncateText(slotValue(props, 'offer'), fitChars(CARD_W - 60, 16, 70))

  return (
    <RveDesignStage designId="rve-chart-animation" props={props}>
      <FitCanvas props={props} scale={k}>
        <ChartAnimation
          data={CHART_ANIMATION_PLACEHOLDER_DATA}
          colors={brandPalette(props, 2)}
          title={title}
          subtitle={subtitle}
          titleWhiteSpace="nowrap"
          subtitleWhiteSpace="nowrap"
          background={brandBackdrop(props)}
          valueColor={text}
          titleColor={text}
          subtitleColor={rgba(text, 0.75)}
        />
      </FitCanvas>
    </RveDesignStage>
  )
}

export default RveChartAnimationDesign
