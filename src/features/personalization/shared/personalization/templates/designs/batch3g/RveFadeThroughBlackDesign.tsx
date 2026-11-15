/**
 * Adapter for the upstream `rve-fade-through-black` template (batch 3g).
 *
 * Upstream: `templates/fade-through-black.tsx` (remotion-templates, MIT — React Video
 * Editor, no named copyright holder). Edited copy (C8):
 * `../../_upstream/rve-fade-through-black/FadeThroughBlack.tsx`.
 *
 * Intro reveal: the brand card fades down to a near-black shade of the brand
 * colour and the customer's video fades up out of it (3 s, the upstream
 * timing). The incoming scene is empty and the root fill is transparent.
 */

import React from 'react'
import { FadeThroughBlack } from '../../_upstream/rve-fade-through-black/FadeThroughBlack'
import type { RemotionDesignComponentProps } from '../../types'
import { RveDesignStage } from '../rveSharedDesign'
import { BrandCardContent, TRANSPARENT_SCENE, brandPalette } from './batch3gShared'

export const RveFadeThroughBlackDesign: React.FC<RemotionDesignComponentProps> = (props) => {
  const palette = brandPalette(props)
  return (
    <RveDesignStage designId="rve-fade-through-black" props={props}>
      <FadeThroughBlack
        backgroundColor="transparent"
        overlayColor={palette.deep}
        scene1={{ background: palette.cardBackground, content: <BrandCardContent props={props} /> }}
        scene2={TRANSPARENT_SCENE}
      />
    </RveDesignStage>
  )
}

export default RveFadeThroughBlackDesign
