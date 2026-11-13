/**
 * Adapter for the upstream `particle-snow` template (batch 3c).
 *
 * Upstream: `src/components/particle-snow/ParticleSnow.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * Three parallax layers of snowflakes drift down over twinkling stars and a
 * faint top-down glow; a title and subline fade in at the lower centre.
 *
 * OVERLAY (`visual-effect`): the upstream's `backgroundColor` is a plain
 * canvas fill, so it is forced to `transparent`. The upstream still paints a
 * 12 %-opacity accent glow across the top of the canvas (the "night sky"
 * gradient) — a light brand tint over the video, not an opaque fill. Snow and
 * stars stay white; the glow and the title halo use the brand accent.
 *
 * FIXED SVG ID: the glow is `<linearGradient id="snow-sky">`, declared in
 * `BATCH_3C_FIXED_SVG_IDS` (one instance per composition).
 *
 * COLOUR NORMALISATION: the upstream builds `${accentColor}88` for the title
 * halo, so the accent is normalised to `#rrggbb` first.
 *
 * TEXT: title = headline, subline = offer; the block spans the canvas width
 * and wraps, so the strings are only capped.
 */

import React from 'react'
import { ParticleSnow } from '../../_upstream/particle-snow/ParticleSnow'
import { DesignStage, TRANSPARENT, pickColor, slotText, slotValue, truncateText, type DesignAdapterProps } from '../shared'
import { toHex6 } from './batch3cShared'

const MAX_TITLE_LENGTH = 32
const MAX_SUBTITLE_LENGTH = 56

export const ParticleSnowDesign: React.FC<DesignAdapterProps> = (props) => (
  <DesignStage designId="particle-snow" props={props}>
    <ParticleSnow
      backgroundColor={TRANSPARENT}
      snowColor="#f8fafc"
      accentColor={toHex6(props.colors?.accent, '#38bdf8')}
      flakeCount={70}
      title={truncateText(slotText(props, 'title', ['businessName']), MAX_TITLE_LENGTH)}
      subtitle={truncateText(slotValue(props, 'subtitle'), MAX_SUBTITLE_LENGTH)}
      textColor={pickColor([props.color, props.colors?.text], '#f8fafc')}
    />
  </DesignStage>
)

export default ParticleSnowDesign
