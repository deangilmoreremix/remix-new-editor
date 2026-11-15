/**
 * Adapter for the upstream `rve-pie-chart` template.
 *
 * Upstream: `templates/pie-chart.tsx` (remotion-templates, MIT — React Video
 * Editor, no named copyright holder). A thick ring sweeps in slice by slice
 * around a centre disc, with a "label (value%)" legend underneath.
 *
 * DATA-VISUALIZATION INTRO CARD: the designed backdrop is kept (a deep shade
 * of the brand primary), the layer plays as an intro card and the catalog's
 * `placement.endFrame` then reveals the video.
 *
 * PLACEHOLDER DATA: the customer cannot enter chart data, so the five slices
 * are pinned and generically labelled ("Segment A".."Segment E", 30/25/20/15/10)
 * — not the upstream's "Product A".. demo split.
 *
 * Brand mapping: slices from a primary / accent ramp, the centre disc in the
 * backdrop colour (the upstream paints it the backdrop's slate), the headline
 * as the title.
 */

import React from 'react'
import { PieChart, type PieChartSegment } from '../../_upstream/rve-pie-chart/PieChart'
import { slotText, truncateText, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  FitCanvas,
  brandBackdrop,
  brandBackdropSolid,
  brandPalette,
  fitChars,
  fitScale,
  readableOnDark,
  rgba,
} from './shared3f'

/** The pinned placeholder split (labels and values; colours come from the brand). */
export const PIE_CHART_PLACEHOLDER: Array<Omit<PieChartSegment, 'color'>> = [
  { label: 'Segment A', value: 30 },
  { label: 'Segment B', value: 25 },
  { label: 'Segment C', value: 20 },
  { label: 'Segment D', value: 15 },
  { label: 'Segment E', value: 10 },
]

const CARD_W = 640
const CARD_H = 560
const PREFERRED_SCALE = 1.3

export const RvePieChartDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = fitScale(props, CARD_W, CARD_H, PREFERRED_SCALE)
  const palette = brandPalette(props, PIE_CHART_PLACEHOLDER.length)
  const text = readableOnDark(props)
  const title = truncateText(
    slotText(props, 'headline', ['businessName']),
    fitChars(CARD_W - 40, 28, 34),
  )

  return (
    <RveDesignStage designId="rve-pie-chart" props={props}>
      <FitCanvas props={props} scale={k}>
        <PieChart
          segments={PIE_CHART_PLACEHOLDER.map((segment, i) => ({
            ...segment,
            color: palette[i],
          }))}
          title={title}
          titleWhiteSpace="nowrap"
          background={brandBackdrop(props)}
          centerColor={brandBackdropSolid(props)}
          titleColor={text}
          legendColor={rgba(text, 0.8)}
        />
      </FitCanvas>
    </RveDesignStage>
  )
}

export default RvePieChartDesign
