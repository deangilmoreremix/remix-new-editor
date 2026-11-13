/**
 * Adapter for the upstream `eye-reveal` template.
 *
 * Upstream: `src/components/eye-reveal/EyeReveal.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * An eye opens, the iris grows, it blinks, then the message and sub line land. Uses the fixed SVG clip id `eyeClip` (one instance per composition).
 *
 * The background is part of the illustration, so the design is registered as
 * a `full-scene` intro card: a designed, brand-coloured background, then the
 * layer ends (`placement.endFrame`) and the customer's video plays. The
 * message is `0.09 × min(w, h)` and wraps; a stylesheet scoped to this
 * instance shrinks it when a long name would crowd the illustration.
 */

import React from 'react'
import { EyeReveal } from '../../_upstream/eye-reveal/EyeReveal'
import { useDesignFonts } from '../fonts'
import { DesignStage, type DesignAdapterProps } from '../shared'
import { ScopedUpstream, bottomMessageFitCss, brandPalette, deepShade, messageAndSub, mixHex, readableOn, useScopeId } from './batch3aShared'

export const EyeRevealDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()
  const scopeId = useScopeId('eye-reveal')
  const palette = brandPalette(props)
  const { message, sub } = messageAndSub(props)
  const background = deepShade(palette.primary, 0.84)

  return (
    <DesignStage designId="eye-reveal" props={props}>
      <ScopedUpstream scopeId={scopeId} css={bottomMessageFitCss(scopeId, message, props.width, props.height)}>
        <EyeReveal
          backgroundColor={background}
          scleraColor="#f8fafc"
          irisColor={palette.accent}
          pupilColor={deepShade(palette.primary, 0.92)}
          lidColor={deepShade(palette.primary, 0.62)}
          textColor={readableOn(background, palette.text)}
          subColor={readableOn(background, mixHex(palette.text, palette.accent, 0.5))}
          messageText={message}
          subText={sub}
        />
      </ScopedUpstream>
    </DesignStage>
  )
}

export default EyeRevealDesign
