/**
 * Adapter for the upstream `racing-chart` template (batch 3c).
 *
 * Upstream: `src/components/racing-chart/RacingChart.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream races horizontal bars through a sequence of value steps,
 * reordering them by rank, under a title.
 *
 * CATEGORY `data-visualization`: the upstream paints the bar labels and the
 * value read-outs a hard-coded `#ffffff`, so the race runs on a designed dark
 * panel (a deep shade of the brand primary) and plays as an intro card.
 *
 * DATA: the customer cannot enter series data, so the five series are a
 * PINNED PLACEHOLDER set labelled "Placeholder A".."E" (C13 convention), with
 * the bars painted from the brand palette. The upstream demo series
 * ("Market Share Race" / "Aurora"…) are never used. The title is the
 * customer's headline.
 *
 * TIMING: `frames` (frames per step) is 28, so the race finishes at frame
 * 18 + 4 x 28 = 130 and holds until `placement.endFrame` (150).
 */

import React from 'react'
import { RacingChart, type RacingChartDatum } from '../../_upstream/racing-chart/RacingChart'
import { DesignStage, pickColor, slotText, truncateText, type DesignAdapterProps } from '../shared'
import { mixColor, readableOnDark, shade, tint, toHex6 } from './batch3cShared'

/** Frames spent between consecutive steps. */
export const RACING_CHART_STEP_FRAMES = 28

/** The placeholder series; colours are filled from the brand at render time. */
export const RACING_CHART_PLACEHOLDER_SERIES: Array<Omit<RacingChartDatum, 'color'>> = [
  { label: 'Placeholder A', values: [22, 28, 34, 41, 48] },
  { label: 'Placeholder B', values: [30, 32, 33, 35, 36] },
  { label: 'Placeholder C', values: [18, 24, 30, 32, 38] },
  { label: 'Placeholder D', values: [26, 25, 24, 22, 20] },
  { label: 'Placeholder E', values: [12, 16, 20, 28, 34] },
]

const MAX_TITLE_LENGTH = 48

type Props = DesignAdapterProps & { data?: RacingChartDatum[] }

export const RacingChartDesign: React.FC<Props> = (props) => {
  const primary = toHex6(props.colors?.primary, '#29d3f2')
  const accent = toHex6(props.colors?.accent, '#28c98b')
  const palette = [accent, primary, tint(accent, 0.4), tint(primary, 0.4), mixColor(primary, accent, 0.5)]
  const data: RacingChartDatum[] =
    Array.isArray(props.data) && props.data.length > 0
      ? props.data
      : RACING_CHART_PLACEHOLDER_SERIES.map((series, i) => ({ ...series, color: palette[i % palette.length] }))

  return (
    <DesignStage designId="racing-chart" props={props}>
      <RacingChart
        data={data}
        frames={RACING_CHART_STEP_FRAMES}
        title={truncateText(slotText(props, 'title', ['businessName']), MAX_TITLE_LENGTH)}
        background={shade(primary, 0.16)}
        titleColor={readableOnDark(pickColor([props.color, props.colors?.text], '#ffffff'))}
      />
    </DesignStage>
  )
}

export default RacingChartDesign
