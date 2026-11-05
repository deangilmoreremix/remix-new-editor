/**
 * Adapter for the upstream `rve-animated-text` template.
 *
 * Upstream: `templates/animated-text.tsx`
 * (remotion-templates, MIT — React Video Editor, no named copyright holder).
 *
 * The upstream splits one string into characters and springs each one in
 * (a fade, a rise and a rotation, staggered by five frames per character).
 * Only the copy, the colour and the type size are brandable; the springs are
 * byte-identical to the upstream's.
 *
 * The upstream's type size is `5rem`, which resolves against the DOCUMENT
 * root font size and not against the composition, so the adapter passes a
 * canvas-relative px value instead (contract addition C9).
 *
 * The upstream centres the copy in a 100 %-wide container and does not set
 * `whiteSpace: "nowrap"`, so a long headline wraps and then overflows the
 * canvas. The adapter truncates it to what fits on one line.
 */

import React from 'react'
import { AnimatedText } from '../_upstream/rve-animated-text/AnimatedText'
import { pickColor, slotText, truncateText, type DesignAdapterProps } from './shared'
import { RveDesignStage, rveFontSizePx, rveMaxChars } from './rveSharedDesign'

/**
 * The headline's size, as a fraction of the composition's short edge.
 *
 * The upstream's own value is `5rem` (80 px at the document's default root
 * font size) — `rem` is not canvas-relative, so the adapter passes a px
 * value instead (contract addition C9).
 */
const FONT_SIZE_RATIO = 0.09

/**
 * The hard character ceiling.
 *
 * The upstream staggers the characters by five frames each, so a 24-character
 * headline is still animating after two seconds. The real limit is the
 * composition width — `rveMaxChars` applies it.
 */
const MAX_HEADLINE_LENGTH = 24

export const RveAnimatedTextDesign: React.FC<DesignAdapterProps> = (props) => {
  const fontSizePx = rveFontSizePx(props, FONT_SIZE_RATIO)
  const maxChars = rveMaxChars(props, fontSizePx, MAX_HEADLINE_LENGTH)

  const text = truncateText(
    slotText(props, 'headline', ['offer', 'businessName']),
    maxChars,
  )

  return (
    <RveDesignStage designId="rve-animated-text" props={props}>
      <AnimatedText
        text={text}
        color={pickColor([props.color, props.colors?.text], '#ffffff')}
        fontSize={`${fontSizePx}px`}
        fontWeight="bold"
      />
    </RveDesignStage>
  )
}

export default RveAnimatedTextDesign
