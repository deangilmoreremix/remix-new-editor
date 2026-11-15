/**
 * Adapter for the upstream `rve-spotlight-reveal` template (batch 3g).
 *
 * Upstream: `templates/spotlight-reveal.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder). Edited copy (C8):
 * `../../_upstream/rve-spotlight-reveal/SpotlightReveal.tsx`.
 *
 * Entrance effect over the customer's video: a spotlight opens from the
 * centre of a deep brand-coloured frame, with the upstream's glowing rim
 * (tinted with the brand accent), and reveals the video inside it. The
 * upstream paints an opaque root and an opaque panel; here both are
 * transparent and `outsideColor` darkens only the area outside the circle.
 * The reveal length is pinned to 90 frames (the upstream reads the host
 * composition's duration, which would make the reveal last as long as the
 * whole clip). The business name shows inside the spotlight and fades out
 * before the layer ends.
 */

import React from 'react'
import { SpotlightReveal } from '../../_upstream/rve-spotlight-reveal/SpotlightReveal'
import type { RemotionDesignComponentProps } from '../../types'
import { RveDesignStage } from '../rveSharedDesign'
import { BrandCardContent, brandPalette, fadeOut, rgbTriplet } from './batch3gShared'

export const SPOTLIGHT_DURATION = 90
const TITLE_OUT_START = 50
const TITLE_OUT_END = 70

export const RveSpotlightRevealDesign: React.FC<RemotionDesignComponentProps> = (props) => {
  const palette = brandPalette(props)
  return (
    <RveDesignStage designId="rve-spotlight-reveal" props={props}>
      <SpotlightReveal
        backgroundColor="transparent"
        contentBackground="transparent"
        outsideColor={palette.deep}
        glowRgb={rgbTriplet(palette.accent, '139, 92, 246')}
        durationInFrames={SPOTLIGHT_DURATION}
        content={
          <div
            data-rve-spotlight-title
            style={{ display: 'flex', justifyContent: 'center', width: '100%', opacity: fadeOut(props.frame, TITLE_OUT_START, TITLE_OUT_END) }}
          >
            <BrandCardContent props={props} showEmblem={false} />
          </div>
        }
      />
    </RveDesignStage>
  )
}

export default RveSpotlightRevealDesign
