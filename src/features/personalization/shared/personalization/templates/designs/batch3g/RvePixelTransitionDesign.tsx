/**
 * Adapter for the upstream `rve-pixel-transition` template (batch 3g).
 *
 * Upstream: `templates/pixel-transition.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder). Edited copy (C8):
 * `../../_upstream/rve-pixel-transition/PixelTransition.tsx`.
 *
 * Intro reveal: the upstream builds a mosaic up pixel by pixel on an opaque
 * canvas. Here the canvas is transparent and the copy runs in `disappear`
 * mode, so a full brand-coloured mosaic dissolves away tile by tile (seeded,
 * deterministic) to uncover the customer's video. The business name sits on
 * the mosaic and fades out in the first second.
 *
 * Tile size scales with the composition's long edge (40 px at 1080p instead
 * of the upstream's 20 px) to keep the tile count — and the DOM — bounded in
 * every format, and the delay spread is 45 frames so the reveal completes in
 * 1.5 s.
 */

import React from 'react'
import { PixelTransition } from '../../_upstream/rve-pixel-transition/PixelTransition'
import type { RemotionDesignComponentProps } from '../../types'
import { darkenColor } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import { BrandCardContent, brandPalette, fadeOut } from './batch3gShared'

export const PIXEL_DELAY_SPREAD = 45
const TITLE_OUT_START = 8
const TITLE_OUT_END = 30

export const RvePixelTransitionDesign: React.FC<RemotionDesignComponentProps> = (props) => {
  const palette = brandPalette(props)
  const pixelSize = Math.max(12, Math.round(Math.max(props.width, props.height) / 48))
  const colors = [
    darkenColor(palette.primary, 0.55),
    darkenColor(palette.primary, 0.4),
    darkenColor(palette.primary, 0.3),
    darkenColor(palette.accent, 0.45),
  ]
  return (
    <RveDesignStage designId="rve-pixel-transition" props={props}>
      <PixelTransition
        background="transparent"
        mode="disappear"
        pixelSize={pixelSize}
        delaySpread={PIXEL_DELAY_SPREAD}
        colors={colors}
      />
      <div
        data-rve-pixel-title
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: fadeOut(props.frame, TITLE_OUT_START, TITLE_OUT_END),
        }}
      >
        <BrandCardContent props={props} />
      </div>
    </RveDesignStage>
  )
}

export default RvePixelTransitionDesign
