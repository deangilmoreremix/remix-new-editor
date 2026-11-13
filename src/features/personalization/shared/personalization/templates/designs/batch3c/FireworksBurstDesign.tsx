/**
 * Adapter for the upstream `fireworks-burst` template (batch 3c).
 *
 * Upstream: `src/components/fireworks-burst/FireworksBurst.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * Three firework bursts (rising trail, twelve petals, sparks) go off in turn,
 * then a message pops in under them with a subline.
 *
 * OVERLAY (`visual-effect`): the upstream's `backgroundColor` is a plain
 * canvas fill, so it is forced to `transparent` and the bursts go off over
 * the customer's video. The petals cycle through a palette derived from the
 * brand primary, accent and text colours; trail and sparks use the accent.
 *
 * TEXT: message = headline, subline = offer. The text block spans the canvas
 * width and wraps, so the strings are only capped.
 */

import React from 'react'
import { FireworksBurst } from '../../_upstream/fireworks-burst/FireworksBurst'
import { DesignStage, TRANSPARENT, pickColor, slotText, slotValue, truncateText, type DesignAdapterProps } from '../shared'
import { mixColor, shade, tint, toHex6 } from './batch3cShared'

const MAX_MESSAGE_LENGTH = 32
const MAX_SUBTEXT_LENGTH = 56

export const FireworksBurstDesign: React.FC<DesignAdapterProps> = (props) => {
  const primary = toHex6(props.colors?.primary, '#ef4444')
  const accent = toHex6(props.colors?.accent, '#fbbf24')
  const text = pickColor([props.color, props.colors?.text], '#f8fafc')
  const burstColors = [
    primary,
    accent,
    tint(primary, 0.45),
    tint(accent, 0.45),
    toHex6(text, '#ffffff'),
    mixColor(primary, accent, 0.5),
    shade(accent, 0.8),
  ]

  return (
    <DesignStage designId="fireworks-burst" props={props}>
      <FireworksBurst
        backgroundColor={TRANSPARENT}
        burstColors={burstColors}
        trailColor={tint(accent, 0.6)}
        sparkColor={accent}
        textColor={text}
        subColor={accent}
        messageText={truncateText(slotText(props, 'message', ['businessName']), MAX_MESSAGE_LENGTH)}
        subText={truncateText(slotValue(props, 'subtext'), MAX_SUBTEXT_LENGTH)}
      />
    </DesignStage>
  )
}

export default FireworksBurstDesign
