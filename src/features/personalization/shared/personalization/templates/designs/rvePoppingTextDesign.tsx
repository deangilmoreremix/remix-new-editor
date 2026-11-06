/**
 * Adapter for the upstream `rve-popping-text` template.
 *
 * Upstream: `templates/popping-text.tsx`
 * (remotion-templates, MIT — React Video Editor, no named copyright holder).
 *
 * The upstream splits one string into characters and pops each one in (a
 * scale and a fade, staggered by seven frames per character). Each character
 * takes the next colour of a three-entry palette (`i % colors.length`), so
 * the adapter keeps THREE entries — a dark, a mid and a light shade of the
 * brand primary — and the rotation looks exactly like the upstream's.
 *
 * The upstream's type size is `8rem` and its family is `Impact`, neither of
 * which is canvas-relative, so the adapter passes a canvas-relative px size
 * and the bundled deterministic family instead (contract additions C9 and
 * C11).
 */

import React from 'react'
import { PoppingText } from '../_upstream/rve-popping-text/PoppingText'
import { DESIGN_FONT_STACK } from './fonts'
import { darkenColor, pickColor, slotText, truncateText, type DesignAdapterProps } from './shared'
import { RveDesignStage, lightenColor, rveFontSizePx, rveMaxChars } from './rveSharedDesign'

/**
 * The headline's size, as a fraction of the composition's short edge.
 *
 * The upstream's own value is `8rem` (128 px at the document's default root
 * font size) — `rem` is not canvas-relative, so the adapter passes a px
 * value instead (contract addition C9).
 */
const FONT_SIZE_RATIO = 0.13

/**
 * The hard character ceiling.
 *
 * The upstream staggers the characters by seven frames each, so a long
 * headline is still animating after two seconds. The real limit is the
 * composition width — `rveMaxChars` applies it.
 */
const MAX_HEADLINE_LENGTH = 12

/** How far the palette's dark and light entries sit from the brand primary. */
const PALETTE_DARKEN_FACTOR = 0.45
const PALETTE_LIGHTEN_FACTOR = 0.45

export const RvePoppingTextDesign: React.FC<DesignAdapterProps> = (props) => {
  const fontSizePx = rveFontSizePx(props, FONT_SIZE_RATIO)
  const maxChars = rveMaxChars(props, fontSizePx, MAX_HEADLINE_LENGTH)

  const text = truncateText(
    slotText(props, 'headline', ['offer', 'businessName']),
    maxChars,
  )

  const primary = pickColor([props.colors?.primary], '#1e3a8a')

  // Three entries, in the upstream's dark → mid → light order, so the
  // per-character rotation reads the same way the upstream's does.
  const palette = [
    darkenColor(primary, PALETTE_DARKEN_FACTOR),
    primary,
    lightenColor(primary, PALETTE_LIGHTEN_FACTOR),
  ]

  return (
    <RveDesignStage designId="rve-popping-text" props={props}>
      <PoppingText
        text={text}
        colors={palette}
        outlineColor={pickColor([props.colors?.text], '#ffffff')}
        fontSize={`${fontSizePx}px`}
        fontFamily={DESIGN_FONT_STACK}
        letterSpacing="0.05em"
      />
    </RveDesignStage>
  )
}

export default RvePoppingTextDesign
