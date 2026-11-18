/**
 * Adapter for the upstream `rve-iris-transition` template (batch 3g).
 *
 * Upstream: `templates/iris-transition.tsx` (remotion-templates, MIT — React Video
 * Editor, no named copyright holder). Edited copy (C8):
 * `../../_upstream/rve-iris-transition/IrisTransition.tsx`.
 *
 * Intro reveal: the iris closes on the brand card and re-opens on the
 * customer's video (2.5 s, the upstream timing). The upstream relies on an
 * opaque black root for the area outside the iris; here the root is
 * transparent and `irisOutsideColor` paints a deep brand shade outside the
 * circle instead, so the opening iris shows the video inside it.
 */

import React from 'react'
import { IrisTransition } from '../../_upstream/rve-iris-transition/IrisTransition'
import type { RemotionDesignComponentProps } from '../../types'
import { RveDesignStage } from '../rveSharedDesign'
import { BrandCardContent, TRANSPARENT_SCENE, brandPalette } from './batch3gShared'

export const RveIrisTransitionDesign: React.FC<RemotionDesignComponentProps> = (props) => {
  const palette = brandPalette(props)
  return (
    <RveDesignStage designId="rve-iris-transition" props={props}>
      <IrisTransition
        backgroundColor="transparent"
        irisOutsideColor={palette.deep}
        sceneA={{ background: palette.cardBackground, content: <BrandCardContent props={props} /> }}
        sceneB={TRANSPARENT_SCENE}
      />
    </RveDesignStage>
  )
}

export default RveIrisTransitionDesign
