/**
 * Adapter for the upstream `rve-particle-explosion` template (overlay).
 *
 * Upstream: `templates/particle-explosion.tsx` (remotion-templates, MIT —
 * React Video Editor). A word pops in at the centre while 150 particles
 * burst outwards into a spinning ring and fade over three seconds.
 *
 * The upstream root is already transparent, so it overlays the customer's
 * video as-is. The word is the customer's offer (falling back to the
 * headline, then the business name), kept on one line and truncated to the
 * canvas width; the particles cycle through brand-colour shades and the ring
 * radius scales with the composition.
 */

import React from 'react'
import { ParticleExplosion } from '../../_upstream/rve-particle-explosion/ParticleExplosion'
import { darkenColor, slotText, truncateText, type DesignAdapterProps } from '../shared'
import { RveDesignStage, lightenColor, rveMaxChars, withAlpha } from '../rveSharedDesign'
import { brandPalette, canvasScale } from './media'

export const RveParticleExplosionDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = canvasScale(props)
  const fontSizePx = Math.round(80 * k)
  const { primary, accent, text: textColor } = brandPalette(props)
  const text = truncateText(
    slotText(props, 'offer', ['headline', 'businessName']),
    rveMaxChars(props, fontSizePx, 24),
  )

  return (
    <RveDesignStage designId="rve-particle-explosion" props={props}>
      <ParticleExplosion
        text={text}
        distance={Math.round(270 * k)}
        distanceJitter={Math.round(60 * k)}
        textFontSize={`${fontSizePx}px`}
        textColor={textColor}
        textShadow={`0 0 ${Math.round(16 * k)}px ${withAlpha(primary, 0.8)}`}
        textWhiteSpace="nowrap"
        particleSize={`${Math.max(6, Math.round(18 * k))}px`}
        particleColors={[
          primary,
          accent,
          lightenColor(primary, 0.4),
          lightenColor(accent, 0.4),
          darkenColor(primary, 0.8),
        ]}
      />
    </RveDesignStage>
  )
}

export default RveParticleExplosionDesign
