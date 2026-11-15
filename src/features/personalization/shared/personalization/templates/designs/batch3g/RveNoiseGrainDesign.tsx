/**
 * Adapter for the upstream `rve-noise-grain` template (batch 3g).
 *
 * Upstream: `templates/noise-grain.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder). Edited copy (C8):
 * `../../_upstream/rve-noise-grain/NoiseGrain.tsx`.
 *
 * Overlay for the whole clip: only the upstream's deterministic grain layer
 * is kept — the sample gradient and sample text are dropped, so the grain
 * sits directly on the customer's video. The grain is tinted with the brand
 * text colour (white by default, like the upstream) at the upstream opacity
 * (0.02..0.08 per cell). The cell size scales with the composition's long
 * edge (12 px at 1080p instead of 8 px) to keep the per-frame SVG bounded.
 */

import React from 'react'
import { NoiseGrain } from '../../_upstream/rve-noise-grain/NoiseGrain'
import type { RemotionDesignComponentProps } from '../../types'
import { RveDesignStage } from '../rveSharedDesign'
import { brandPalette } from './batch3gShared'

export const RveNoiseGrainDesign: React.FC<RemotionDesignComponentProps> = (props) => {
  const palette = brandPalette(props)
  const cellSize = Math.max(6, Math.round(Math.max(props.width, props.height) / 160))
  return (
    <RveDesignStage designId="rve-noise-grain" props={props}>
      <NoiseGrain background={null} showSample={false} cellSize={cellSize} grainColor={palette.text} />
    </RveDesignStage>
  )
}

export default RveNoiseGrainDesign
