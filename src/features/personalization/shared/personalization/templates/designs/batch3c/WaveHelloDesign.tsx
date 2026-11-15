/**
 * Adapter for the upstream `wave-hello` template (batch 3c).
 *
 * Upstream: `src/components/wave-hello/WaveHello.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * A cartoon character slides up and waves while a greeting and a subline
 * slide in beside it.
 *
 * CATEGORY `full-scene`: the backdrop IS the design — a pale tint of the
 * brand primary — and it plays as an intro card (`placement.endFrame`). The
 * shirt is the brand primary; legs, hair and the greeting are a deep shade of
 * it so the greeting stays legible on the pale backdrop. The skin keeps the
 * upstream's cartoon `#fbbf24` (a character's skin is not a brand colour).
 *
 * TEXT: the greeting is the business name, the subline the headline. The
 * upstream anchors the text block at `left: 54 %` with no right edge, so the
 * text wraps inside the remaining width; both are capped so the block cannot
 * grow taller than the canvas.
 */

import React from 'react'
import { WaveHello } from '../../_upstream/wave-hello/WaveHello'
import { DesignStage, slotText, slotValue, truncateText, type DesignAdapterProps } from '../shared'
import { shade, tint, toHex6 } from './batch3cShared'

/** The upstream's cartoon skin tone. */
export const WAVE_HELLO_SKIN = '#fbbf24'

const MAX_TITLE_LENGTH = 22
const MAX_SUBTITLE_LENGTH = 48

export const WaveHelloDesign: React.FC<DesignAdapterProps> = (props) => {
  const primary = toHex6(props.colors?.primary, '#3b82f6')
  const deep = shade(primary, 0.5)

  return (
    <DesignStage designId="wave-hello" props={props}>
      <WaveHello
        backgroundColor={tint(primary, 0.86)}
        skinColor={WAVE_HELLO_SKIN}
        bodyColor={primary}
        accentColor={deep}
        textColor={shade(primary, 0.3)}
        title={truncateText(slotText(props, 'title', ['headline']), MAX_TITLE_LENGTH)}
        subtitle={truncateText(slotValue(props, 'subtitle'), MAX_SUBTITLE_LENGTH)}
      />
    </DesignStage>
  )
}

export default WaveHelloDesign
