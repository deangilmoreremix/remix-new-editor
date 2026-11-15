/**
 * Adapter for the upstream `rve-blinds-transition` template (batch 3g).
 *
 * Upstream: `templates/blinds-transition.tsx` (remotion-templates, MIT — React Video
 * Editor, no named copyright holder). Edited copy (C8):
 * `../../_upstream/rve-blinds-transition/BlindsTransition.tsx`.
 *
 * Intro reveal: the brand card is painted on the eight blinds, which flip
 * open one after another (the upstream timing) to uncover the customer's
 * video. The scene underneath the blinds is left empty and transparent.
 * `alignSlices` is on so every blind carries its own slice of the card (the
 * upstream's width-relative margin only fills the first blind in 16:9), and
 * the perspective scales with the composition width.
 */

import React from 'react'
import { BlindsTransition } from '../../_upstream/rve-blinds-transition/BlindsTransition'
import type { RemotionDesignComponentProps } from '../../types'
import { RveDesignStage } from '../rveSharedDesign'
import { BrandCardContent, TRANSPARENT_SCENE, brandPalette } from './batch3gShared'

export const RveBlindsTransitionDesign: React.FC<RemotionDesignComponentProps> = (props) => {
  const palette = brandPalette(props)
  return (
    <RveDesignStage designId="rve-blinds-transition" props={props}>
      <BlindsTransition
        backgroundColor="transparent"
        alignSlices
        perspective={`${Math.round(props.width * 0.42)}px`}
        sceneA={{ background: palette.cardBackground, content: <BrandCardContent props={props} /> }}
        sceneB={TRANSPARENT_SCENE}
      />
    </RveDesignStage>
  )
}

export default RveBlindsTransitionDesign
