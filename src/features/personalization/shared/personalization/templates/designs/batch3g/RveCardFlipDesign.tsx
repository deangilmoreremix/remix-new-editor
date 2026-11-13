/**
 * Adapter for the upstream `rve-card-flip` template (batch 3g).
 *
 * Upstream: `templates/card-flip.tsx` (remotion-templates, MIT — React Video
 * Editor, no named copyright holder). Edited copy (C8):
 * `../../_upstream/rve-card-flip/CardFlip.tsx`.
 *
 * Intro reveal: the upstream spins a 300x400 card a full turn. Used as a
 * transition, the card is the size of the whole composition, its front face
 * is the brand card and its back face is transparent; it holds for 0.8 s and
 * then the upstream spring flips it half a turn (`rotateTo` 180), so the
 * back — the customer's video — ends up facing the viewer. The spring
 * (damping 15, mass 0.5) is the upstream's; the perspective scales with the
 * composition.
 */

import React from 'react'
import { CardFlip } from '../../_upstream/rve-card-flip/CardFlip'
import type { RemotionDesignComponentProps } from '../../types'
import { RveDesignStage } from '../rveSharedDesign'
import { BrandCardContent, brandPalette } from './batch3gShared'

export const CARD_FLIP_HOLD_FRAMES = 24

export const RveCardFlipDesign: React.FC<RemotionDesignComponentProps> = (props) => {
  const palette = brandPalette(props)
  return (
    <RveDesignStage designId="rve-card-flip" props={props}>
      <CardFlip
        cardWidth={`${props.width}px`}
        cardHeight={`${props.height}px`}
        perspective={`${Math.round(Math.max(props.width, props.height) * 1.6)}px`}
        rotateTo={180}
        startFrame={CARD_FLIP_HOLD_FRAMES}
        front={{
          background: palette.cardBackground,
          borderRadius: '0px',
          color: palette.text,
          content: <BrandCardContent props={props} />,
        }}
        back={{ background: 'transparent', borderRadius: '0px', content: null }}
      />
    </RveDesignStage>
  )
}

export default RveCardFlipDesign
