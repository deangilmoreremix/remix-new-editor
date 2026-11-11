/**
 * Adapter for the upstream `bounce-in-headline` template.
 *
 * Upstream: `src/components/bounce-in-headline/BounceInHeadline.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream renders the whole headline in a single `<div>` with a hardcoded
 * `fontSize: 130` and centres it in the composition. Because the adapter
 * scales the composition-sized canvas into the design box, that hardcoded
 * size stays proportional to the composition — it must NOT be re-based on the
 * box.
 *
 * The upstream's `background` prop is a canvas fill; it is forced to
 * `transparent` so the customer's video shows through.
 */

import React from 'react'
import { BounceInHeadline } from '../_upstream/bounce-in-headline/BounceInHeadline'
import {
  DesignStage,
  TRANSPARENT,
  pickColor,
  slotText,
  truncateText,
  type DesignAdapterProps,
} from './shared'

/** The upstream's own motion constants (frames, at the upstream's 30 fps). */
const BOUNCES = 3
const BOUNCE_HEIGHT = 120
const DELAY_FRAMES = 0
const DURATION_FRAMES = 36

/** Long headlines are truncated so they never leave the design box. */
const MAX_HEADLINE_LENGTH = 60

export const AnimatedHeadlineDesign: React.FC<DesignAdapterProps> = (props) => {
  const headline = truncateText(
    slotText(props, 'headline', ['offer', 'businessName']),
    MAX_HEADLINE_LENGTH,
  )

  return (
    <DesignStage designId="animated-headline" props={props}>
      <BounceInHeadline
        headline={headline}
        background={TRANSPARENT}
        color={pickColor([props.color, props.colors?.text])}
        bounces={BOUNCES}
        height={BOUNCE_HEIGHT}
        delay={DELAY_FRAMES}
        duration={DURATION_FRAMES}
      />
    </DesignStage>
  )
}

export default AnimatedHeadlineDesign
