/**
 * Adapter for the upstream `LineChart` template (repo 3) — the upstream
 * composition id is "LineChartDraw".
 *
 * Upstream: `src/templates/ChartVideo/LineChart.tsx` (+ `sample-data.ts`)
 * (remotion-video-templates, MIT — © 2026 Alejandro Brito).
 *
 * The upstream draws one line per series across a gridded plot (the
 * pathLength dash trick), staggered 12 frames apart, with a moving marker at
 * the leading edge and a faint area fill once each line is complete.
 *
 * DATA THE CUSTOMER CANNOT SUPPLY: as for the bar chart race, the dataset is
 * the pinned, explicitly labelled placeholder (`BRITO_CHART_PLACEHOLDER`,
 * first three series) — never brand-derived numbers and never the upstream
 * demo data.
 *
 * Brand mapping: title ← headline; series colours ← brand primary, brand
 * accent, then the upstream's categorical violet; the upstream's hard-coded
 * white canvas is tinted with the brand colours through a scoped stylesheet
 * rule (a `data-visualization` intro card).
 *
 * FORMAT: 16:9 only. The upstream puts a 60 px title top-left and the legend
 * top-right on the same row; on a 1080-wide canvas (9:16, 1:1, 4:5) the
 * legend alone takes most of the row and the two collide. In 16:9 the title
 * is truncated to the room left beside the legend.
 *
 * FIXED DURATION: the upstream's `calculateMetadata` gives
 * (60 + steps x 8) + (series − 1) x 12 + 45; with 4 steps and 3 series that is
 * 92 + 24 + 45 = `BRITO_LINE_CHART_FRAMES` (161 frames).
 */

import React from 'react'
import { LineChart } from '../../_upstream/brito-line-chart/LineChart'
import type { ChartProps } from '../../_upstream/brito-bar-chart-race/sample-data'
import { pickColor, slotText, truncateText, type DesignAdapterProps } from '../shared'
import { BRITO_CHART_PLACEHOLDER, britoSeriesColors } from './BarChartRaceDesign'
import {
  BritoDesignStage,
  britoChartBackground,
  britoFitChars,
  britoRootBackgroundCss,
} from './britoShared'

export const BRITO_LINE_CHART_ID = 'brito-line-chart'

/** The line chart draws the first three placeholder series. */
export const BRITO_LINE_CHART_PLACEHOLDER: Omit<ChartProps, 'title'> = {
  steps: BRITO_CHART_PLACEHOLDER.steps,
  series: BRITO_CHART_PLACEHOLDER.series.slice(0, 3),
}

/** (60 + 4 x 8) draw + 2 x 12 stagger + 45 hold. */
export const BRITO_LINE_CHART_FRAMES =
  60 +
  BRITO_LINE_CHART_PLACEHOLDER.steps.length * 8 +
  (BRITO_LINE_CHART_PLACEHOLDER.series.length - 1) * 12 +
  45

/** Approximate width of the upstream legend (20 px swatch, 10 px gap, 30 px label, 28 px gaps). */
function legendWidth(series: ChartProps['series']): number {
  const items = series.reduce((sum, s) => sum + 20 + 10 + s.label.length * 30 * 0.58, 0)
  return items + Math.max(0, series.length - 1) * 28
}

type ChartAdapterProps = DesignAdapterProps & {
  /** The pinned placeholder dataset (see `BRITO_LINE_CHART_PLACEHOLDER`). */
  chartData?: Omit<ChartProps, 'title'>
}

export const BritoLineChartDesign: React.FC<ChartAdapterProps> = (props) => {
  const data =
    props.chartData && Array.isArray(props.chartData.series) && props.chartData.series.length > 0
      ? props.chartData
      : BRITO_LINE_CHART_PLACEHOLDER
  const primary = pickColor([props.colors?.primary], '#2563EB')
  const accent = pickColor([props.colors?.accent], '#0EA5E9')
  const colors = britoSeriesColors(primary, accent, data.series.length)

  // Title starts at x = 130; the legend ends 90 px from the right edge.
  const titleRoom = props.width - 130 - 90 - legendWidth(data.series) - 60
  const title = truncateText(
    slotText(props, 'title', ['businessName']),
    britoFitChars(titleRoom, 60, 48, 0.6),
  )

  return (
    <BritoDesignStage
      designId={BRITO_LINE_CHART_ID}
      props={props}
      overlay={false}
      css={britoRootBackgroundCss(BRITO_LINE_CHART_ID, britoChartBackground(primary, accent))}
    >
      <LineChart
        title={title}
        steps={data.steps}
        series={data.series.map((s, i) => ({ ...s, color: colors[i] }))}
      />
    </BritoDesignStage>
  )
}

export default BritoLineChartDesign
