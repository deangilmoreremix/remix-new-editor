/**
 * Adapter for the upstream `rve-morph-transition` template (batch 3g).
 *
 * Upstream: `templates/morph-transition.tsx` (remotion-templates, MIT — React Video
 * Editor, no named copyright holder). Edited copy (C8):
 * `../../_upstream/rve-morph-transition/MorphTransition.tsx`.
 *
 * Intro reveal: the brand card shrinks and fades away (scale 1 -> 0.5,
 * opacity gone by 60 % of 2.5 s — the upstream curves) to reveal the
 * customer's video. The incoming scene is empty and transparent.
 */

import React from 'react'
import { MorphTransition } from '../../_upstream/rve-morph-transition/MorphTransition'
import type { RemotionDesignComponentProps } from '../../types'
import { RveDesignStage } from '../rveSharedDesign'
import { BrandCardContent, TRANSPARENT_SCENE, brandPalette } from './batch3gShared'

export const RveMorphTransitionDesign: React.FC<RemotionDesignComponentProps> = (props) => {
  const palette = brandPalette(props)
  return (
    <RveDesignStage designId="rve-morph-transition" props={props}>
      <MorphTransition
        backgroundColor="transparent"
        sceneA={{ background: palette.cardBackground, content: <BrandCardContent props={props} /> }}
        sceneB={TRANSPARENT_SCENE}
      />
    </RveDesignStage>
  )
}

export default RveMorphTransitionDesign
