/**
 * Adapter for the upstream `BarChartRace` template (repo 3).
 *
 * Upstream: `src/templates/ChartVideo/BarChartRace.tsx` (+ `sample-data.ts`)
 * (remotion-video-templates, MIT — © 2026 Alejandro Brito).
 *
 * The upstream grows a set of horizontal bars from zero, then races them
 * through the data steps — bars re-rank smoothly as values overtake each
 * other — with the current step label large and faint in the corner.
 *
 * DATA THE CUSTOMER CANNOT SUPPLY: the chart needs a time series, and the
 * design layer has no way for a customer to enter data. As with the repo-1
 * bar chart (A6 contract addition C13) the dataset is PINNED as an explicitly
 * labelled placeholder (`BRITO_CHART_PLACEHOLDER` — "Sample A".."Sample D",
 * "Step 1".."Step 4") in the catalog's `defaultProps`. The adapter never
 * fabricates numbers from brand text and never falls through to the
 * upstream demo dataset ("Monthly Active Users by Product").
 *
 * Brand mapping: the title is the customer's headline; the series are
 * painted brand primary, brand accent, then the upstream's own categorical
 * colours 3 and 4 (violet, amber). The upstream hard-codes a white canvas;
 * this is a `data-visualization` card (an intro that then reveals the video),
 * so the canvas is kept but tinted with the brand colours through a scoped
 * stylesheet rule — the upstream's ink text stays legible on it.
 *
 * FIXED DURATION: the upstream's `calculateMetadata` gives
 * INTRO + (steps − 1) x 45 + HOLD; with the four placeholder steps that is
 * 18 + 135 + 45 = `BRITO_BAR_CHART_RACE_FRAMES` (198 frames).
 */

import React from 'react'
import { BarChartRace } from '../../_upstream/brito-bar-chart-race/BarChartRace'
import type { ChartProps } from '../../_upstream/brito-bar-chart-race/sample-data'
import { seriesColor } from '../../_upstream/brito-lib/colors'
import { pickColor, slotText, truncateText, type DesignAdapterProps } from '../shared'
import {
  BritoDesignStage,
  britoChartBackground,
  britoFitChars,
  britoRootBackgroundCss,
} from './britoShared'

export const BRITO_BAR_CHART_RACE_ID = 'brito-bar-chart-race'

/**
 * The pinned placeholder dataset shared by both repo-3 charts.
 *
 * The labels say "Sample" on purpose: the values are stand-ins, not the
 * customer's numbers. The series colours are filled in from the brand.
 */
export const BRITO_CHART_PLACEHOLDER: Omit<ChartProps, 'title'> = {
  steps: ['Step 1', 'Step 2', 'Step 3', 'Step 4'],
  series: [
    { label: 'Sample A', color: '#2563EB', values: [20, 45, 70, 96] },
    { label: 'Sample B', color: '#0EA5E9', values: [42, 52, 61, 70] },
    { label: 'Sample C', color: '#8B5CF6', values: [10, 31, 66, 82] },
    { label: 'Sample D', color: '#F59E0B', values: [56, 53, 50, 48] },
  ],
}

/** 18-frame intro + 3 steps x 45 frames + 45-frame hold. */
export const BRITO_BAR_CHART_RACE_FRAMES = 18 + (BRITO_CHART_PLACEHOLDER.steps.length - 1) * 45 + 45

/** Brand primary, brand accent, then the upstream's categorical colours. */
export function britoSeriesColors(primary: string, accent: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? primary : i === 1 ? accent : seriesColor(i),
  )
}

type ChartAdapterProps = DesignAdapterProps & {
  /** The pinned placeholder dataset (see `BRITO_CHART_PLACEHOLDER`). */
  chartData?: Omit<ChartProps, 'title'>
}

export const BritoBarChartRaceDesign: React.FC<ChartAdapterProps> = (props) => {
  const data =
    props.chartData && Array.isArray(props.chartData.series) && props.chartData.series.length > 0
      ? props.chartData
      : BRITO_CHART_PLACEHOLDER
  const primary = pickColor([props.colors?.primary], '#2563EB')
  const accent = pickColor([props.colors?.accent], '#0EA5E9')
  const colors = britoSeriesColors(primary, accent, data.series.length)

  // 64 px title from x = 70; one line, so it never reaches the bars at y = 210.
  const title = truncateText(
    slotText(props, 'title', ['businessName']),
    britoFitChars(props.width - 140, 64, 56, 0.6),
  )

  return (
    <BritoDesignStage
      designId={BRITO_BAR_CHART_RACE_ID}
      props={props}
      overlay={false}
      css={britoRootBackgroundCss(BRITO_BAR_CHART_RACE_ID, britoChartBackground(primary, accent))}
    >
      <BarChartRace
        title={title}
        steps={data.steps}
        series={data.series.map((s, i) => ({ ...s, color: colors[i] }))}
      />
    </BritoDesignStage>
  )
}

export default BritoBarChartRaceDesign
