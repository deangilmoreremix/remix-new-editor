/**
 * Adapter for the upstream `rve-clock-wipe` template (batch 3g).
 *
 * Upstream: `templates/clock-wipe.tsx` (remotion-templates, MIT — React Video
 * Editor, no named copyright holder). Edited copy (C8):
 * `../../_upstream/rve-clock-wipe/ClockWipe.tsx`.
 *
 * Intro reveal: the brand card is swept away clockwise from 12 o'clock over
 * 2.5 s (the upstream timing). `invertWipe` clips the card to the un-swept
 * region, so the swept wedge uncovers the customer's video; the scene
 * underneath is left empty and transparent.
 */

import React from 'react'
import { ClockWipe } from '../../_upstream/rve-clock-wipe/ClockWipe'
import type { RemotionDesignComponentProps } from '../../types'
import { RveDesignStage } from '../rveSharedDesign'
import { BrandCardContent, TRANSPARENT_SCENE, brandPalette } from './batch3gShared'

export const RveClockWipeDesign: React.FC<RemotionDesignComponentProps> = (props) => {
  const palette = brandPalette(props)
  return (
    <RveDesignStage designId="rve-clock-wipe" props={props}>
      <ClockWipe
        backgroundColor="transparent"
        invertWipe
        sceneA={{ background: palette.cardBackground, content: <BrandCardContent props={props} /> }}
        sceneB={TRANSPARENT_SCENE}
      />
    </RveDesignStage>
  )
}

export default RveClockWipeDesign
