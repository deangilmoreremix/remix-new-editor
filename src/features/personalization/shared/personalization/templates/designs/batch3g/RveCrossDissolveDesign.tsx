/**
 * Adapter for the upstream `rve-cross-dissolve` template (batch 3g).
 *
 * Upstream: `templates/cross-dissolve.tsx` (remotion-templates, MIT — React Video
 * Editor, no named copyright holder). Edited copy (C8):
 * `../../_upstream/rve-cross-dissolve/CrossDissolve.tsx`.
 *
 * Intro reveal: the brand card dissolves linearly into the customer's video
 * over 2.5 s (the upstream timing). The root fill is transparent and the
 * incoming scene is empty, so what fades in is the video itself.
 */

import React from 'react'
import { CrossDissolve } from '../../_upstream/rve-cross-dissolve/CrossDissolve'
import type { RemotionDesignComponentProps } from '../../types'
import { RveDesignStage } from '../rveSharedDesign'
import { BrandCardContent, TRANSPARENT_SCENE, brandPalette } from './batch3gShared'

export const RveCrossDissolveDesign: React.FC<RemotionDesignComponentProps> = (props) => {
  const palette = brandPalette(props)
  return (
    <RveDesignStage designId="rve-cross-dissolve" props={props}>
      <CrossDissolve
        backgroundColor="transparent"
        sceneA={{ background: palette.cardBackground, content: <BrandCardContent props={props} /> }}
        sceneB={TRANSPARENT_SCENE}
      />
    </RveDesignStage>
  )
}

export default RveCrossDissolveDesign
