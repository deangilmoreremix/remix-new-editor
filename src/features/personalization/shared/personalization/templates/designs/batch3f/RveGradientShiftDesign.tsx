/**
 * Adapter for the upstream `rve-gradient-shift` template.
 *
 * Upstream: `templates/gradient-shift.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder). A full-frame linear gradient whose
 * three colours drift through a palette while its angle slowly rotates.
 *
 * OVERLAY (a translucent colour wash), NOT an opaque full scene: the upstream
 * is nothing but a gradient — there is no text or shape on it — so as an
 * opaque intro card it would just be a few seconds of empty colour before the
 * video. As a translucent wash it does something useful: it grades the
 * customer's whole video with a slowly turning brand-colour gradient. The
 * copy's added `alpha` prop turns the upstream's opaque `rgb()` stops into
 * `rgba()` stops at {@link GRADIENT_SHIFT_ALPHA}, so the video always shows
 * through.
 *
 * Brand mapping: the palette walk runs primary -> accent -> deep primary ->
 * primary (the upstream walks three navy shades and back).
 */

import React from 'react'
import { GradientShift } from '../../_upstream/rve-gradient-shift/GradientShift'
import { darkenColor, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import { brandAccent, brandPrimary, rgbOf } from './shared3f'

/** Opacity of the wash over the video. */
export const GRADIENT_SHIFT_ALPHA = 0.32

const FALLBACK = { r: 41, g: 211, b: 242 }

export const RveGradientShiftDesign: React.FC<DesignAdapterProps> = (props) => {
  const primary = brandPrimary(props)
  const accent = brandAccent(props)
  const colors = [
    rgbOf(primary, FALLBACK),
    rgbOf(accent, FALLBACK),
    rgbOf(darkenColor(primary, 0.5), FALLBACK),
    rgbOf(primary, FALLBACK),
  ]

  return (
    <RveDesignStage designId="rve-gradient-shift" props={props}>
      <GradientShift colors={colors} alpha={GRADIENT_SHIFT_ALPHA} />
    </RveDesignStage>
  )
}

export default RveGradientShiftDesign
