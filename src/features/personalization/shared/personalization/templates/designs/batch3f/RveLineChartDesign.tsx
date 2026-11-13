/**
 * Adapter for the upstream `rve-line-chart` template.
 *
 * Upstream: `templates/line-chart.tsx` (remotion-templates, MIT — React Video
 * Editor, no named copyright holder). A line that draws itself across a grid,
 * with data points popping in.
 *
 * DATA-VISUALIZATION INTRO CARD: the designed backdrop is kept (a deep shade
 * of the brand primary), the layer plays as an intro card and the catalog's
 * `placement.endFrame` then reveals the video.
 *
 * PLACEHOLDER DATA: the customer cannot enter chart data, so the line is a
 * pinned, generic upward trend over ten months — not the upstream's demo
 * values. The adapter never fabricates numbers from brand text.
 *
 * Brand mapping: the line in the brand primary, the points in the accent with
 * a text-colour ring, the headline as the title.
 */

import React from 'react'
import { LineChart, type LineChartPoint } from '../../_upstream/rve-line-chart/LineChart'
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
export const LINE_CHART_PLACEHOLDER_DATA: LineChartPoint[] = [
  { x: 0, y: 20, label: 'Jan' },
  { x: 1, y: 28, label: 'Feb' },
  { x: 2, y: 34, label: 'Mar' },
  { x: 3, y: 31, label: 'Apr' },
  { x: 4, y: 46, label: 'May' },
  { x: 5, y: 52, label: 'Jun' },
  { x: 6, y: 61, label: 'Jul' },
  { x: 7, y: 68, label: 'Aug' },
  { x: 8, y: 77, label: 'Sep' },
  { x: 9, y: 88, label: 'Oct' },
]

const CARD_W = 940
const CARD_H = 540
const PREFERRED_SCALE = 1.25

export const RveLineChartDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = fitScale(props, CARD_W, CARD_H, PREFERRED_SCALE)
  const [line, point] = brandPalette(props, 2)
  const text = readableOnDark(props)
  const title = truncateText(
    slotText(props, 'headline', ['businessName']),
    fitChars(CARD_W - 60, 28, 44),
  )

  return (
    <RveDesignStage designId="rve-line-chart" props={props}>
      <FitCanvas props={props} scale={k}>
        <LineChart
          data={LINE_CHART_PLACEHOLDER_DATA}
          title={title}
          titleWhiteSpace="nowrap"
          background={brandBackdrop(props)}
          lineColor={line}
          pointColor={point}
          pointStroke={text}
          titleColor={text}
        />
      </FitCanvas>
    </RveDesignStage>
  )
}

export default RveLineChartDesign
