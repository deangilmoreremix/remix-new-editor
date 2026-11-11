/**
 * Adapter for the upstream `bar-chart-anim` template.
 *
 * Upstream: `src/components/bar-chart-anim/BarChartAnim.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream grows a set of bars from the baseline, staggered, under a
 * title and a subtitle.
 *
 * ARRAY PROP THE CUSTOMER CANNOT SUPPLY: the upstream's `bars: BarItem[]` is a
 * required array, and the design layer has no way for a customer to enter
 * data. Per A6's contract addition C13 the dataset is therefore PINNED — as
 * an explicitly labelled placeholder — in the catalog's `defaultProps`, and
 * the adapter never fabricates data from brand text and never falls through
 * to the upstream's own demo dataset (`"Quarterly Revenue"` / `"Q1"`…).
 *
 * The placeholder bars carry no colour of their own, so the upstream paints
 * every bar with the brand accent (`b.color ?? accentColor`).
 *
 * `background` is the canvas fill and is forced to `transparent`; the upstream
 * default is the opaque `#0f172a`.
 */

import React from 'react'
import { BarChartAnim } from '../_upstream/bar-chart-anim/BarChartAnim'
import { useDesignFonts } from './fonts'
import {
  DesignStage,
  TRANSPARENT,
  pickColor,
  slotText,
  slotValue,
  truncateText,
  type DesignAdapterProps,
} from './shared'

/** One bar of the chart (structurally identical to the upstream's `BarItem`). */
export interface BarChartPlaceholderBar {
  label: string
  value: number
  color?: string
}

/**
 * The pinned placeholder dataset.
 *
 * The labels say "Placeholder" on purpose: the bars are stand-ins, not the
 * customer's data, and the design must not look like it is showing numbers.
 */
export const BAR_CHART_PLACEHOLDER_BARS: BarChartPlaceholderBar[] = [
  { label: 'Placeholder 1', value: 120 },
  { label: 'Placeholder 2', value: 180 },
  { label: 'Placeholder 3', value: 240 },
  { label: 'Placeholder 4', value: 320 },
]

/** The upstream's type is relative to the canvas, so the caps are generous. */
const MAX_TITLE_LENGTH = 48
const MAX_SUBTITLE_LENGTH = 48

/** The props the catalog's `defaultProps` extend. */
type BarChartAnimAdapterProps = DesignAdapterProps & {
  /** The pinned placeholder dataset (see `BAR_CHART_PLACEHOLDER_BARS`). */
  bars?: BarChartPlaceholderBar[]
}

export const BarChartAnimDesign: React.FC<BarChartAnimAdapterProps> = (props) => {
  useDesignFonts()

  const bars =
    Array.isArray(props.bars) && props.bars.length > 0
      ? props.bars
      : BAR_CHART_PLACEHOLDER_BARS

  const title = truncateText(
    slotText(props, 'title', ['headline', 'businessName']),
    MAX_TITLE_LENGTH,
  )
  const subtitle = truncateText(slotValue(props, 'subtitle'), MAX_SUBTITLE_LENGTH)

  return (
    <DesignStage designId="bar-chart-anim" props={props}>
      <BarChartAnim
        title={title}
        subtitle={subtitle}
        bars={bars}
        background={TRANSPARENT}
        titleColor={pickColor([props.color, props.colors?.text], '#ffffff')}
        accentColor={pickColor([props.colors?.accent, props.colors?.primary], '#60a5fa')}
      />
    </DesignStage>
  )
}

export default BarChartAnimDesign
