/**
 * Adapter for the upstream `rve-progress-bars` template.
 *
 * Upstream: `templates/progress-bars.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder). Five labelled bars fill one after
 * another, each with a counting percentage.
 *
 * DATA-VISUALIZATION INTRO CARD: the designed backdrop is kept (a deep shade
 * of the brand primary), the layer plays as an intro card and the catalog's
 * `placement.endFrame` then reveals the video.
 *
 * PLACEHOLDER DATA: the customer cannot enter scores, so the rows are pinned
 * and generically labelled ("Category A".."Category E") — not the upstream's
 * "React / TypeScript / ..." demo skills.
 *
 * Brand mapping: bars from a primary / accent ramp, the headline as the title.
 */

import React from 'react'
import {
  ProgressBars,
  type ProgressBarsItem,
} from '../../_upstream/rve-progress-bars/ProgressBars'
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

/** The pinned placeholder rows (labels and values; colours come from the brand). */
export const PROGRESS_BARS_PLACEHOLDER: Array<Omit<ProgressBarsItem, 'color'>> = [
  { label: 'Category A', value: 92 },
  { label: 'Category B', value: 81 },
  { label: 'Category C', value: 72 },
  { label: 'Category D', value: 64 },
  { label: 'Category E', value: 53 },
]

/** The upstream card: 700 px wide + 50 px side padding; ~520 px tall with five rows. */
const CARD_W = 800
const CARD_H = 520
const PREFERRED_SCALE = 1.25

export const RveProgressBarsDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = fitScale(props, CARD_W, CARD_H, PREFERRED_SCALE)
  const palette = brandPalette(props, PROGRESS_BARS_PLACEHOLDER.length)
  const text = readableOnDark(props)
  const title = truncateText(
    slotText(props, 'headline', ['businessName']),
    fitChars(700 - 20, 28, 38),
  )

  return (
    <RveDesignStage designId="rve-progress-bars" props={props}>
      <FitCanvas props={props} scale={k}>
        <ProgressBars
          skills={PROGRESS_BARS_PLACEHOLDER.map((row, i) => ({ ...row, color: palette[i] }))}
          title={title}
          titleWhiteSpace="nowrap"
          background={brandBackdrop(props)}
          titleColor={text}
          labelColor={text}
          valueColor={rgba(text, 0.8)}
        />
      </FitCanvas>
    </RveDesignStage>
  )
}

export default RveProgressBarsDesign
