/**
 * Adapter for the upstream `rve-comparison-chart` template.
 *
 * Upstream: `templates/comparison-chart.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder). Two bars — "Before" and "After" —
 * count up side by side, split by a divider.
 *
 * DATA-VISUALIZATION INTRO CARD: the designed backdrop is kept (a deep shade
 * of the brand primary), the layer plays as an intro card and the catalog's
 * `placement.endFrame` then reveals the video.
 *
 * PLACEHOLDER DATA: the customer cannot enter numbers, so the two values are
 * a pinned, generic 35 % -> 90 % before/after — not the upstream's 34 / 89.
 * The labels stay "Before" / "After" (generic words, not data).
 *
 * Brand mapping: "before" in the brand primary, "after" in the accent, the
 * headline as the title.
 */

import React from 'react'
import { ComparisonChart } from '../../_upstream/rve-comparison-chart/ComparisonChart'
import { slotText, truncateText, type DesignAdapterProps } from '../shared'
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

/** The pinned placeholder values (0-100). */
export const COMPARISON_CHART_PLACEHOLDER = { before: 35, after: 90 } as const

/** The upstream card: 700 x 480 + 40 px padding on each side. */
const CARD_W = 780
const CARD_H = 560
const PREFERRED_SCALE = 1.25

export const RveComparisonChartDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = fitScale(props, CARD_W, CARD_H, PREFERRED_SCALE)
  const [before, after] = brandPalette(props, 2)
  const text = readableOnDark(props)
  const title = truncateText(
    slotText(props, 'headline', ['businessName']),
    fitChars(700 - 20, 28, 38),
  )

  return (
    <RveDesignStage designId="rve-comparison-chart" props={props}>
      <FitCanvas props={props} scale={k}>
        <ComparisonChart
          title={title}
          titleWhiteSpace="nowrap"
          beforeValue={COMPARISON_CHART_PLACEHOLDER.before}
          afterValue={COMPARISON_CHART_PLACEHOLDER.after}
          beforeColor={before}
          beforeGlow={`0 0 20px ${rgba(before, 0.3)}`}
          afterColor={after}
          afterGlow={`0 0 20px ${rgba(after, 0.3)}`}
          background={brandBackdrop(props)}
          titleColor={text}
          labelColor={rgba(text, 0.8)}
        />
      </FitCanvas>
    </RveDesignStage>
  )
}

export default RveComparisonChartDesign
