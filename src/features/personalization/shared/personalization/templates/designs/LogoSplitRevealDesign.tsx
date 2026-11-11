/**
 * Adapter for the upstream `logo-split-reveal` template.
 *
 * Upstream: `src/components/logo-split-reveal/LogoSplitReveal.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream draws the wordmark twice, each half clipped to one side of the
 * box, and the halves converge from the outside towards the centre.
 *
 * `splitOffset` is the one upstream prop whose default assumes a 1920 px
 * wide canvas: the upstream default is 960 px, which is exactly half of 1920.
 * On any other canvas the halves would start at the wrong distance, so the
 * adapter computes it from the composition width (A6's contract addition C2):
 *
 *     splitOffset = Math.round(width * 0.5)
 *
 * The upstream's own `safeFontSize` clamp already keeps the wordmark inside
 * the title-safe area whatever text it is given, so the adapter only truncates
 * the wordmark (A6's contract addition C3).
 *
 * `revealDuration` and `duration` are in SECONDS, not frames.
 */

import React from 'react'
import { LogoSplitReveal } from '../_upstream/logo-split-reveal/LogoSplitReveal'
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

/** Long wordmarks are cut so the two halves stay readable. */
const MAX_WORDMARK_LENGTH = 20

/** The upstream's own motion constants (seconds). */
const REVEAL_DURATION_SECONDS = 1.4
const DURATION_SECONDS = 4

export const LogoSplitRevealDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()

  const wordmark = truncateText(
    slotText(props, 'businessName', ['headline']),
    MAX_WORDMARK_LENGTH,
  )

  return (
    <DesignStage designId="logo-split-reveal" props={props}>
      <LogoSplitReveal
        logoText={wordmark}
        splitOffset={Math.round(props.width * 0.5)}
        revealDuration={REVEAL_DURATION_SECONDS}
        logoColor={pickColor([props.color, props.colors?.text], '#0F172A')}
        backgroundColor={TRANSPARENT}
        fontSize={UPSTREAM_FONT_SIZE}
        duration={DURATION_SECONDS}
      />
    </DesignStage>
  )
}

export default LogoSplitRevealDesign
