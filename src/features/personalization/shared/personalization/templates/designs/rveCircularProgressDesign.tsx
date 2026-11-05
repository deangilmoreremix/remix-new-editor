/**
 * Adapter for the upstream `rve-circular-progress` template.
 *
 * Upstream: `templates/circular-progress.tsx`
 * (remotion-templates, MIT — React Video Editor, no named copyright holder).
 *
 * The upstream is a **loading ring**: the percentage is a time-driven loop
 * (`interpolate(frame % 90, [0, 90], [0, 100])`), NOT data, so the value is
 * deliberately NOT parameterised — the adapter only brands the colours and
 * the type size.
 *
 * The upstream's ring is a fixed 300 px box (it does not measure the
 * composition), so the design is placed at a scale that keeps it a sensible
 * size on every format.
 *
 * The upstream paints no canvas fill at all (there is no background prop), so
 * the customer's video shows through untouched.
 *
 * The upstream uses the fixed SVG id `progressGradient`; two mounted instances
 * of this design in one composition would share it (contract addition C7).
 */

import React from 'react'
import { CircularProgress } from '../_upstream/rve-circular-progress/CircularProgress'
import { darkenColor, pickColor, type DesignAdapterProps } from './shared'
import { RveDesignStage, rveFontSizePx, withAlpha } from './rveSharedDesign'

/**
 * The percentage label's size, as a fraction of the composition's short edge.
 *
 * The upstream's own value is `3rem` (48 px at the document's default root
 * font size) — `rem` is not canvas-relative, so the adapter passes a px
 * value instead (contract addition C9).
 */
const FONT_SIZE_RATIO = 0.06

/** The unfilled ring's opacity over the video. */
const TRACK_ALPHA = 0.12

/** How much darker the gradient's second stop is than the accent. */
const GRADIENT_DARKEN_FACTOR = 0.45

export const RveCircularProgressDesign: React.FC<DesignAdapterProps> = (props) => {
  const accent = pickColor([props.colors?.accent, props.colors?.primary], '#3b82f6')
  const primary = pickColor([props.colors?.primary], '#3b82f6')

  return (
    <RveDesignStage designId="rve-circular-progress" props={props}>
      <CircularProgress
        trackColor={withAlpha(primary, TRACK_ALPHA)}
        progressFrom={accent}
        progressTo={darkenColor(accent, GRADIENT_DARKEN_FACTOR)}
        dotColor={accent}
        textColor={pickColor([props.color, props.colors?.text], '#ffffff')}
        fontSize={`${rveFontSizePx(props, FONT_SIZE_RATIO)}px`}
      />
    </RveDesignStage>
  )
}

export default RveCircularProgressDesign
