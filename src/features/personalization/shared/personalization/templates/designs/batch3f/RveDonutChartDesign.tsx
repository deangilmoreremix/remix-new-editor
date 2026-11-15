/**
 * Adapter for the upstream `rve-donut-chart` template.
 *
 * Upstream: `templates/donut-chart.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder). A ring sweeps in segment by
 * segment around a counting centre figure, with a legend underneath.
 *
 * DATA-VISUALIZATION INTRO CARD: the designed backdrop is kept (a deep shade
 * of the brand primary), the layer plays as an intro card and the catalog's
 * `placement.endFrame` then reveals the video.
 *
 * PLACEHOLDER DATA: the customer cannot enter chart data, so the segments are
 * pinned and generically labelled ("Segment A".."Segment D"). The centre
 * figure counts to 100 % — the whole ring — and is captioned with the
 * business name, so the card reads as a brand badge rather than a claimed
 * statistic. The upstream's demo figures are never used.
 *
 * Brand mapping: segments from a primary / accent ramp, the headline as the
 * title, the business name under the centre figure.
 */

import React from 'react'
import {
  DonutChart,
  type DonutChartSegment,
} from '../../_upstream/rve-donut-chart/DonutChart'
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

/** The pinned placeholder split (labels and values; colours come from the brand). */
export const DONUT_CHART_PLACEHOLDER: Array<Omit<DonutChartSegment, 'color'>> = [
  { label: 'Segment A', value: 35 },
  { label: 'Segment B', value: 30 },
  { label: 'Segment C', value: 20 },
  { label: 'Segment D', value: 15 },
]

/** The upstream card: 600 x 520 + 20 px padding on each side. */
const CARD_W = 640
const CARD_H = 560
const PREFERRED_SCALE = 1.3

export const RveDonutChartDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = fitScale(props, CARD_W, CARD_H, PREFERRED_SCALE)
  const palette = brandPalette(props, DONUT_CHART_PLACEHOLDER.length)
  const text = readableOnDark(props)
  const title = truncateText(
    slotText(props, 'headline', ['businessName']),
    fitChars(CARD_W - 40, 28, 34),
  )
  // The caption sits inside the ring (inner diameter ~220 px at 16 px type).
  const caption = truncateText(slotValue(props, 'businessName'), fitChars(200, 16, 22))

  return (
    <RveDesignStage designId="rve-donut-chart" props={props}>
      <FitCanvas props={props} scale={k}>
        <DonutChart
          segments={DONUT_CHART_PLACEHOLDER.map((segment, i) => ({
            ...segment,
            color: palette[i],
          }))}
          title={title}
          titleWhiteSpace="nowrap"
          centerValue={100}
          centerLabel={caption}
          background={brandBackdrop(props)}
          titleColor={text}
          centerValueColor={text}
          centerLabelColor={rgba(text, 0.7)}
          legendColor={rgba(text, 0.8)}
        />
      </FitCanvas>
    </RveDesignStage>
  )
}

export default RveDonutChartDesign
