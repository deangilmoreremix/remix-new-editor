/**
 * Adapter for the upstream `pencil-draw` template.
 *
 * Upstream: `src/components/pencil-draw/PencilDraw.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * A pencil draws a star on a paper-tinted background, then the message and sub line land.
 *
 * The background is part of the illustration, so the design is registered as
 * a `full-scene` intro card: a designed, brand-coloured background, then the
 * layer ends (`placement.endFrame`) and the customer's video plays. The
 * message is `0.09 × min(w, h)` and wraps; a stylesheet scoped to this
 * instance shrinks it when a long name would crowd the illustration.
 */

import React from 'react'
import { PencilDraw } from '../../_upstream/pencil-draw/PencilDraw'
import { useDesignFonts } from '../fonts'
import { DesignStage, type DesignAdapterProps } from '../shared'
import { ScopedUpstream, bottomMessageFitCss, brandPalette, deepShade, messageAndSub, paleTint, readableOn, useScopeId } from './batch3aShared'

export const PencilDrawDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()
  const scopeId = useScopeId('pencil-draw')
  const palette = brandPalette(props)
  const { message, sub } = messageAndSub(props)
  // A paper-like tint of the brand colour; the ink is a deep brand shade.
  const background = paleTint(palette.primary, 0.86)
  const ink = deepShade(palette.primary, 0.7)

  return (
    <DesignStage designId="pencil-draw" props={props}>
      <ScopedUpstream scopeId={scopeId} css={bottomMessageFitCss(scopeId, message, props.width, props.height)}>
        <PencilDraw
          backgroundColor={background}
          pencilColor={palette.accent}
          lineColor={ink}
          eraserColor="#fca5a5"
          textColor={readableOn(background, ink)}
          subColor={readableOn(background, '#64748b')}
          messageText={message}
          subText={sub}
        />
      </ScopedUpstream>
    </DesignStage>
  )
}

export default PencilDrawDesign
