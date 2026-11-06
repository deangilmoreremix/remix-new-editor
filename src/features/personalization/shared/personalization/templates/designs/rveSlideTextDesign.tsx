/**
 * Adapter for the upstream `rve-slide-text` template.
 *
 * Upstream: `templates/slide-text.tsx`
 * (remotion-templates, MIT — React Video Editor, no named copyright holder).
 *
 * The smallest of the four batch-2 edits: the upstream slides a single
 * heading in from the right (two springs) and then leaves it on screen. Only
 * the copy, the colour, the size and the weight are brandable; the springs
 * are byte-identical to the upstream's.
 *
 * The upstream's type size is `4rem`, which resolves against the DOCUMENT
 * root font size and not against the composition, so the adapter passes a
 * canvas-relative px value instead (contract addition C9).
 *
 * The upstream centres the heading in a 100 %-wide container and does not set
 * `whiteSpace: "nowrap"`, so a long headline wraps and then overflows the
 * canvas. The adapter truncates it to what fits on one line.
 */

import React from 'react'
import { SlideText } from '../_upstream/rve-slide-text/SlideText'
import { pickColor, slotText, truncateText, type DesignAdapterProps } from './shared'
import { RveDesignStage, rveFontSizePx, rveMaxChars } from './rveSharedDesign'

/**
 * The heading's size, as a fraction of the composition's short edge.
 *
 * The upstream's own value is `4rem` (64 px at the document's default root
 * font size) — `rem` is not canvas-relative, so the adapter passes a px
 * value instead (contract addition C9).
 */
const FONT_SIZE_RATIO = 0.07

/** The hard character ceiling. The real limit is the composition width. */
const MAX_HEADLINE_LENGTH = 40

export const RveSlideTextDesign: React.FC<DesignAdapterProps> = (props) => {
  const fontSizePx = rveFontSizePx(props, FONT_SIZE_RATIO)
  const maxChars = rveMaxChars(props, fontSizePx, MAX_HEADLINE_LENGTH)

  const text = truncateText(
    slotText(props, 'headline', ['offer', 'businessName']),
    maxChars,
  )

  return (
    <RveDesignStage designId="rve-slide-text" props={props}>
      <SlideText
        text={text}
        color={pickColor([props.color, props.colors?.text], '#ffffff')}
        fontSize={`${fontSizePx}px`}
        fontWeight="bold"
      />
    </RveDesignStage>
  )
}

export default RveSlideTextDesign
