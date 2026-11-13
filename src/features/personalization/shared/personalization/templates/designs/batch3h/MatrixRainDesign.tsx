/**
 * Adapter for the upstream `rve-matrix-rain` template (overlay).
 *
 * Upstream: `templates/matrix-rain.tsx` (remotion-templates, MIT — React
 * Video Editor). Columns of glowing glyphs fall and wrap down the frame.
 *
 * As an overlay the navy gradient canvas is transparent, so the glyphs rain
 * over the customer's video. The glyphs take the brand text colour and glow
 * in the brand primary; column spacing and glyph size scale with the
 * composition so every format has the same density.
 */

import React from 'react'
import { MatrixRain } from '../../_upstream/rve-matrix-rain/MatrixRain'
import { TRANSPARENT, type DesignAdapterProps } from '../shared'
import { RveDesignStage, withAlpha } from '../rveSharedDesign'
import { brandPalette, canvasScale, rgbTriple } from './media'

export const RveMatrixRainDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = canvasScale(props)
  const { primary, text } = brandPalette(props)

  return (
    <RveDesignStage designId="rve-matrix-rain" props={props}>
      <MatrixRain
        background={TRANSPARENT}
        columnWidth={Math.max(12, Math.round(28 * k))}
        fontSize={`${Math.max(12, Math.round(28 * k))}px`}
        charRgb={rgbTriple(text)}
        glow={`0 0 ${Math.max(4, Math.round(8 * k))}px ${withAlpha(primary, 0.9)}`}
      />
    </RveDesignStage>
  )
}

export default RveMatrixRainDesign
