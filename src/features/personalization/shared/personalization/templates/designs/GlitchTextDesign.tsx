/**
 * Adapter for the upstream `glitch-text` template.
 *
 * Upstream: `src/components/glitch-text/GlitchText.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream stacks three copies of the text — a red layer, a cyan layer and
 * the main layer — and offsets the coloured ones with Remotion's seeded
 * `random()`, so the effect is deterministic.
 *
 * THE BLEND IS NOT THE `bokeh-circles` CASE: the red and cyan layers use
 * `mixBlendMode: "screen"`, but the blend happens INSIDE the text stack — the
 * parent `<div>` carries a `transform`, so it creates the stacking context and
 * the layers blend against the main text layer, not against the customer's
 * video. Nothing has to be "fixed" here: the scale-wrapper may stay, and the
 * blend renders as flat #FF0033 / #00E0FF fringes, which is the intended
 * glitch look (A6's contract addition C6).
 *
 * The upstream's display size is a fixed `fontSize: 220` px and the text is
 * `whiteSpace: "nowrap"`, so the adapter truncates the headline (A6's C3) and
 * computes the size from the composition width (A6's C2) with the upstream
 * value as the upper bound.
 *
 * The three "tear bands" repaint the background colour opaquely; with
 * `"transparent"` they read as transparent tear bands, which is the desired
 * glitch over the customer's video.
 */

import React from 'react'
import { GlitchText } from '../_upstream/glitch-text/GlitchText'
import { useDesignFonts } from './fonts'
import {
  DesignStage,
  TRANSPARENT,
  pickColor,
  slotText,
  truncateText,
  type DesignAdapterProps,
} from './shared'

/** The upstream's own display size, in px, on a 1920 px wide composition. */
const UPSTREAM_FONT_SIZE = 220

/** `whiteSpace: "nowrap"` means the headline must be cut to fit. */
const MAX_HEADLINE_LENGTH = 18

/** The title-safe width the headline is fitted into (a fraction of the canvas). */
const TITLE_SAFE_WIDTH = 0.86

/** The average advance of a 900-weight sans, in em. */
const CHAR_ADVANCE = 0.62

/** The headline never shrinks below this, in px. */
const MIN_FONT_SIZE = 32

/** The upstream's own motion constants. */
const INTENSITY = 0.8
const DURATION_SECONDS = 4

export const GlitchTextDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()

  const headline = truncateText(
    slotText(props, 'headline', ['offer', 'businessName']),
    MAX_HEADLINE_LENGTH,
  )

  const fontSize = Math.max(
    MIN_FONT_SIZE,
    Math.min(
      UPSTREAM_FONT_SIZE,
      Math.round(
        (props.width * TITLE_SAFE_WIDTH) / (Math.max(1, headline.length) * CHAR_ADVANCE),
      ),
    ),
  )

  return (
    <DesignStage designId="glitch-text" props={props}>
      <GlitchText
        text={headline}
        glitchColor={pickColor([props.color, props.colors?.text], '#FFFFFF')}
        intensity={INTENSITY}
        backgroundColor={TRANSPARENT}
        fontSize={fontSize}
        duration={DURATION_SECONDS}
      />
    </DesignStage>
  )
}

export default GlitchTextDesign
