/**
 * Adapter for the upstream `rve-area-chart` template.
 *
 * Upstream: `templates/area-chart.tsx` (remotion-templates, MIT — React Video
 * Editor, no named copyright holder). An area chart revealed left to right on
 * a rounded panel over a dark gradient.
 *
 * DATA-VISUALIZATION INTRO CARD: the designed backdrop is kept (a deep shade
 * of the brand primary instead of the upstream slate), the layer plays as an
 * intro card and the catalog's `placement.endFrame` then reveals the video.
 *
 * PLACEHOLDER DATA: the customer cannot enter chart data, so the plotted
 * points are a pinned, clearly generic rising trend (`Wk 1`..`Wk 10`), not the
 * upstream's demo week. The adapter never fabricates numbers from brand text.
 *
 * The upstream uses the fixed SVG ids `areaGradient` and `revealClip`
 * (declared in `BATCH_3F_FIXED_SVG_IDS`).
 */

import React from 'react'
import { AreaChart, type AreaChartPoint } from '../../_upstream/rve-area-chart/AreaChart'
import { slotText, truncateText, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  FitCanvas,
  brandBackdrop,
  brandPalette,
  fitChars,
  fitScale,
  readableOnDark,
} from './shared3f'

/** The pinned placeholder trend (y on the upstream's 0-100 scale). */
export const AREA_CHART_PLACEHOLDER_DATA: AreaChartPoint[] = [
  { x: 0, y: 18, label: 'Wk 1' },
  { x: 1, y: 30, label: 'Wk 2' },
  { x: 2, y: 27, label: 'Wk 3' },
  { x: 3, y: 42, label: 'Wk 4' },
  { x: 4, y: 48, label: 'Wk 5' },
  { x: 5, y: 57, label: 'Wk 6' },
  { x: 6, y: 63, label: 'Wk 7' },
  { x: 7, y: 71, label: 'Wk 8' },
  { x: 8, y: 79, label: 'Wk 9' },
  { x: 9, y: 90, label: 'Wk 10' },
]

/** The upstream card: a 900 x 500 panel + 20 px padding on each side. */
const CARD_W = 940
const CARD_H = 540
/** Card scale on a 1080-px short edge. */
const PREFERRED_SCALE = 1.25

export const RveAreaChartDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = fitScale(props, CARD_W, CARD_H, PREFERRED_SCALE)
  const [series] = brandPalette(props, 1)
  const text = readableOnDark(props)
  const title = truncateText(
    slotText(props, 'headline', ['businessName']),
    fitChars(CARD_W - 60, 28, 44),
  )

  return (
    <RveDesignStage designId="rve-area-chart" props={props}>
      <FitCanvas props={props} scale={k}>
        <AreaChart
          data={AREA_CHART_PLACEHOLDER_DATA}
          title={title}
          titleWhiteSpace="nowrap"
          background={brandBackdrop(props)}
          areaColor={series}
          lineColor={series}
          pointColor={text}
          titleColor={text}
        />
      </FitCanvas>
    </RveDesignStage>
  )
}

export default RveAreaChartDesign
