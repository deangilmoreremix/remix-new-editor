/**
 * Adapter for the upstream `rve-liquid-wave` template (overlay).
 *
 * Upstream: `templates/liquid-wave.tsx` (remotion-templates, MIT — React
 * Video Editor). A soft, blurred gradient wave rolls across the frame.
 *
 * As an overlay the slate canvas is transparent and the wave sits low in the
 * frame (its baseline at 80 % of the height instead of 50 %) as a branded
 * band under the customer's video, painted primary → accent at 90 % opacity.
 *
 * The upstream's gradient id is the document-global `"gradient"`; the adapter
 * passes a per-instance id (React `useId`) so this design never needs the
 * one-instance-per-composition warning and never collides with another
 * design's `"gradient"`.
 */

import React, { useId } from 'react'
import { LiquidWave } from '../../_upstream/rve-liquid-wave/LiquidWave'
import { TRANSPARENT, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import { brandPalette, canvasScale } from './media'

export const RveLiquidWaveDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = canvasScale(props)
  const { primary, accent } = brandPalette(props)
  const rawId = useId()
  const gradientId = `rve-liquid-wave-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`

  return (
    <RveDesignStage designId="rve-liquid-wave" props={props}>
      <LiquidWave
        background={TRANSPARENT}
        gradientId={gradientId}
        gradientStart={primary}
        gradientEnd={accent}
        amplitude={Math.round(50 * k)}
        baselineRatio={0.8}
        blurPx={Math.max(4, Math.round(10 * k))}
        pathOpacity={0.9}
      />
    </RveDesignStage>
  )
}

export default RveLiquidWaveDesign
