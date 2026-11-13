/**
 * Adapter for the upstream `rve-vignette-pulse` template (batch 3g).
 *
 * Upstream: `templates/vignette-pulse.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder). Edited copy (C8):
 * `../../_upstream/rve-vignette-pulse/VignettePulse.tsx`.
 *
 * Overlay for the whole clip: the sample content is dropped and the root is
 * transparent, so only the breathing vignette (0.3..0.8 strength, one pulse
 * per second — the upstream curve) darkens the edges of the customer's
 * video. The vignette is a near-black shade of the brand primary.
 */

import React from 'react'
import { VignettePulse } from '../../_upstream/rve-vignette-pulse/VignettePulse'
import type { RemotionDesignComponentProps } from '../../types'
import { RveDesignStage } from '../rveSharedDesign'
import { brandPalette, rgbTriplet } from './batch3gShared'

export const RveVignettePulseDesign: React.FC<RemotionDesignComponentProps> = (props) => {
  const palette = brandPalette(props)
  return (
    <RveDesignStage designId="rve-vignette-pulse" props={props}>
      <VignettePulse
        backgroundColor="transparent"
        showSample={false}
        vignetteRgb={rgbTriplet(palette.deep, '0, 0, 0')}
      />
    </RveDesignStage>
  )
}

export default RveVignettePulseDesign
