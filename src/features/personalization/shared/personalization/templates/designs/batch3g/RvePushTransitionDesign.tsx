/**
 * Adapter for the upstream `rve-push-transition` template (batch 3g).
 *
 * Upstream: `templates/push-transition.tsx` (remotion-templates, MIT — React Video
 * Editor, no named copyright holder). Edited copy (C8):
 * `../../_upstream/rve-push-transition/PushTransition.tsx`.
 *
 * Intro reveal: the brand card holds for 0.8 s and is then pushed off to the
 * left by a spring (the upstream spring) while the empty, transparent
 * incoming scene slides in — i.e. the customer's video.
 */

import React from 'react'
import { PushTransition } from '../../_upstream/rve-push-transition/PushTransition'
import type { RemotionDesignComponentProps } from '../../types'
import { RveDesignStage } from '../rveSharedDesign'
import { BrandCardContent, TRANSPARENT_SCENE, brandPalette } from './batch3gShared'

export const RvePushTransitionDesign: React.FC<RemotionDesignComponentProps> = (props) => {
  const palette = brandPalette(props)
  return (
    <RveDesignStage designId="rve-push-transition" props={props}>
      <PushTransition
        backgroundColor="transparent"
        sceneA={{ background: palette.cardBackground, content: <BrandCardContent props={props} /> }}
        sceneB={TRANSPARENT_SCENE}
      />
    </RveDesignStage>
  )
}

export default RvePushTransitionDesign
