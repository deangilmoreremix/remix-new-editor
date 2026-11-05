/**
 * Adapter for the upstream `logo-blur-reveal` template.
 *
 * Upstream: `src/components/logo-blur-reveal/LogoBlurReveal.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream resolves a wordmark out of a heavy out-of-focus blur and adds a
 * subtle 1.08 → 1.0 "lens focusing" scale.
 *
 * `backgroundColor` is the canvas fill and is forced to `transparent`; the
 * upstream default is the opaque `#F8FAFC`.
 *
 * TWO THINGS THE CATALOG MUST DECLARE:
 *  - the single rasteriser-dependent feature is `filter: blur(40px)`. Chromium
 *    supports it, but the blur has to be verified in an exported frame — the
 *    same class of risk as the bokeh effect's blur;
 *  - the upstream fades the whole layer out over the last 0.4 s of its
 *    `duration`, so the design must not be the last thing on screen.
 *
 * The upstream's display size is a fixed `fontSize: 260` px, so the adapter
 * computes it from the composition width (A6's contract addition C2) and
 * truncates the wordmark (C3). The upstream value is the upper bound, so a
 * 16:9 composition keeps the upstream look.
 *
 * `revealDuration` and `duration` are in SECONDS, not frames.
 */

import React from 'react'
import { LogoBlurReveal } from '../_upstream/logo-blur-reveal/LogoBlurReveal'
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
const UPSTREAM_FONT_SIZE = 260

/** Long wordmarks are cut so they can never leave the canvas. */
const MAX_WORDMARK_LENGTH = 20

/** The title-safe width the wordmark is fitted into (a fraction of the canvas). */
const TITLE_SAFE_WIDTH = 0.86

/** The average advance of a 900-weight sans, in em. */
const CHAR_ADVANCE = 0.62

/** The wordmark never shrinks below this, in px. */
const MIN_FONT_SIZE = 32

/** The upstream's own motion constants (seconds / px). */
const BLUR_AMOUNT = 40
const REVEAL_DURATION_SECONDS = 1.6
const DURATION_SECONDS = 4

export const LogoBlurRevealDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()

  const wordmark = truncateText(
    slotText(props, 'businessName', ['headline']),
    MAX_WORDMARK_LENGTH,
  )

  const fontSize = Math.max(
    MIN_FONT_SIZE,
    Math.min(
      UPSTREAM_FONT_SIZE,
      Math.round(
        (props.width * TITLE_SAFE_WIDTH) / (Math.max(1, wordmark.length) * CHAR_ADVANCE),
      ),
    ),
  )

  return (
    <DesignStage designId="logo-blur-reveal" props={props}>
      <LogoBlurReveal
        logoText={wordmark}
        blurAmount={BLUR_AMOUNT}
        revealDuration={REVEAL_DURATION_SECONDS}
        logoColor={pickColor([props.color, props.colors?.text], '#0F172A')}
        backgroundColor={TRANSPARENT}
        fontSize={fontSize}
        duration={DURATION_SECONDS}
      />
    </DesignStage>
  )
}

export default LogoBlurRevealDesign
