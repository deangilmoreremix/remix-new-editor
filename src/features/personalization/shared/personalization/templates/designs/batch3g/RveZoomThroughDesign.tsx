/**
 * Adapter for the upstream `rve-zoom-through` template (batch 3g).
 *
 * Upstream: `templates/zoom-through.tsx` (remotion-templates, MIT — React Video
 * Editor, no named copyright holder). Edited copy (C8):
 * `../../_upstream/rve-zoom-through/ZoomThrough.tsx`.
 *
 * Intro reveal: the camera zooms through the brand card (scale 1 -> 3 while
 * it fades, the upstream first half) into the customer's video. The incoming
 * scene is empty and transparent.
 */

import React from 'react'
import { ZoomThrough } from '../../_upstream/rve-zoom-through/ZoomThrough'
import type { RemotionDesignComponentProps } from '../../types'
import { RveDesignStage } from '../rveSharedDesign'
import { BrandCardContent, TRANSPARENT_SCENE, brandPalette } from './batch3gShared'

export const RveZoomThroughDesign: React.FC<RemotionDesignComponentProps> = (props) => {
  const palette = brandPalette(props)
  return (
    <RveDesignStage designId="rve-zoom-through" props={props}>
      <ZoomThrough
        backgroundColor="transparent"
        sceneA={{ background: palette.cardBackground, content: <BrandCardContent props={props} /> }}
        sceneB={TRANSPARENT_SCENE}
      />
    </RveDesignStage>
  )
}

export default RveZoomThroughDesign
