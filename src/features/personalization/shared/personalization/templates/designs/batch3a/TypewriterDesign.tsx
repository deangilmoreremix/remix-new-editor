/**
 * Adapter for the upstream `typewriter` template.
 *
 * Upstream: `src/components/typewriter/Typewriter.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The typewriter body pops in, the carriage travels while lines are typed onto the paper, then the message and sub line land.
 *
 * The background is part of the illustration, so the design is registered as
 * a `full-scene` intro card: a designed, brand-coloured background, then the
 * layer ends (`placement.endFrame`) and the customer's video plays. The
 * message is `0.09 × min(w, h)` and wraps; a stylesheet scoped to this
 * instance shrinks it when a long name would crowd the illustration.
 */

import React from 'react'
import { Typewriter } from '../../_upstream/typewriter/Typewriter'
import { useDesignFonts } from '../fonts'
import { DesignStage, type DesignAdapterProps } from '../shared'
import { ScopedUpstream, bottomMessageFitCss, brandPalette, deepShade, messageAndSub, mixHex, readableOn, useScopeId } from './batch3aShared'

export const TypewriterDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()
  const scopeId = useScopeId('typewriter')
  const palette = brandPalette(props)
  const { message, sub } = messageAndSub(props)
  const background = deepShade(palette.primary, 0.82)

  return (
    <DesignStage designId="typewriter" props={props}>
      <ScopedUpstream scopeId={scopeId} css={bottomMessageFitCss(scopeId, message, props.width, props.height)}>
        <Typewriter
          backgroundColor={background}
          machineColor={mixHex('#374151', palette.primary, 0.22)}
          machineDarkColor={mixHex('#1f2937', palette.primary, 0.18)}
          keyColor={mixHex('#4b5563', palette.primary, 0.2)}
          ribbonColor={palette.accent}
          paperColor="#f8fafc"
          textColor={readableOn(background, palette.text)}
          subColor={readableOn(background, palette.accent)}
          messageText={message}
          subText={sub}
        />
      </ScopedUpstream>
    </DesignStage>
  )
}

export default TypewriterDesign
