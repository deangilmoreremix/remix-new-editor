/**
 * Adapter for the upstream `line-chart-anim` template (batch 3c).
 *
 * Upstream: `src/components/line-chart-anim/LineChartAnim.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream draws a polyline left to right (stroke-dashoffset), popping
 * dots and x-axis labels in as the line reaches them, under a title.
 *
 * CATEGORY `data-visualization`: the chart is drawn on a designed panel — a
 * deep shade of the brand primary — because the upstream paints its x-axis
 * labels a hard-coded `rgba(255,255,255,0.7)` and rings every dot with the
 * `background` colour; both only read on a dark, opaque panel. The design
 * plays as an intro card (`placement.endFrame`) and then reveals the video.
 *
 * DATA: the customer cannot enter chart data, so the `points` are a pinned,
 * illustrative upward trend with neutral axis labels ("Wk 1".."Wk 6"). The
 * upstream draws no y-axis values, so no figure is claimed. The upstream demo
 * dataset ("Monthly Active Users" / "Jan"…) is never used.
 *
 * SIZING: the upstream's chart is a fixed 1000 px SVG and its title a fixed
 * 60 px, so the title/subtitle are truncated to what fits the canvas width.
 */

import React from 'react'
import { LineChartAnim, type LinePoint } from '../../_upstream/line-chart-anim/LineChartAnim'
import { DesignStage, pickColor, slotText, slotValue, truncateText, type DesignAdapterProps } from '../shared'
import { fitChars, readableOnDark, shade, toHex6 } from './batch3cShared'

/** Pinned illustrative dataset (the upstream shows no y values). */
export const LINE_CHART_PLACEHOLDER_POINTS: LinePoint[] = [
  { label: 'Wk 1', value: 32 },
  { label: 'Wk 2', value: 45 },
  { label: 'Wk 3', value: 41 },
  { label: 'Wk 4', value: 60 },
  { label: 'Wk 5', value: 74 },
  { label: 'Wk 6', value: 90 },
]

type Props = DesignAdapterProps & { points?: LinePoint[] }

export const LineChartAnimDesign: React.FC<Props> = (props) => {
  const points = Array.isArray(props.points) && props.points.length > 1 ? props.points : LINE_CHART_PLACEHOLDER_POINTS
  const usable = props.width - 160
  const title = truncateText(slotText(props, 'title', ['businessName']), Math.min(48, fitChars(usable, 60, 0.64)))
  const subtitle = truncateText(slotValue(props, 'subtitle'), Math.min(64, fitChars(usable, 28, 0.56)))
  const primary = toHex6(props.colors?.primary, '#29d3f2')
  const panel = shade(primary, 0.16)

  return (
    <DesignStage designId="line-chart-anim" props={props}>
      <LineChartAnim
        title={title}
        subtitle={subtitle}
        points={points}
        background={panel}
        titleColor={readableOnDark(pickColor([props.color, props.colors?.text], '#ffffff'))}
        lineColor={pickColor([props.colors?.accent, props.colors?.primary], '#22d3ee')}
        gridColor="rgba(255,255,255,0.08)"
      />
    </DesignStage>
  )
}

export default LineChartAnimDesign
