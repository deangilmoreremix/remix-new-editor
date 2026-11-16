/**
 * Adapter for the upstream `thinking-bubble` template (batch 3c).
 *
 * Upstream: `src/components/thinking-bubble/ThinkingBubble.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * A cartoon character looks up; small bubbles chain up to a thought bubble
 * where three dots blink, and a thought line fades in under the bubble.
 *
 * CATEGORY `full-scene`: the scene background IS the design and it plays as
 * an intro card (`placement.endFrame`).
 *
 * PINNED BACKGROUND: the upstream picks the pupil colour with
 * `backgroundColor === "#fafaf9" ? "#292524" : "#fff"` — on any other
 * background the pupils turn white on white eyes and the character loses its
 * eyes. The canvas fill is therefore pinned to the upstream's own `#fafaf9`
 * (a neutral off-white); the brand shows through the character (primary),
 * its ground strip (a tint of the primary the upstream derives itself), the
 * bubble outline and the blinking dots (accent).
 *
 * COLOUR NORMALISATION: the upstream builds `${characterColor}18`, so the
 * primary is normalised to `#rrggbb` first.
 *
 * TEXT: the thought line is the customer's headline; it wraps inside the
 * bubble's width, so it is capped at 48 characters.
 */

import React from 'react'
import { ThinkingBubble } from '../../_upstream/thinking-bubble/ThinkingBubble'
import { DesignStage, slotText, truncateText, type DesignAdapterProps } from '../shared'
import { shade, tint, toHex6 } from './batch3cShared'

/** The only background the upstream draws dark pupils on. */
export const THINKING_BUBBLE_BACKGROUND = '#fafaf9'

const MAX_THOUGHT_LENGTH = 48

export const ThinkingBubbleDesign: React.FC<DesignAdapterProps> = (props) => {
  const primary = toHex6(props.colors?.primary, '#78716c')
  const accent = toHex6(props.colors?.accent, '#a8a29e')
  const thought = truncateText(slotText(props, 'thought', ['businessName']), MAX_THOUGHT_LENGTH)

  return (
    <DesignStage designId="thinking-bubble" props={props}>
      <ThinkingBubble
        backgroundColor={THINKING_BUBBLE_BACKGROUND}
        characterColor={primary}
        bubbleColor="#ffffff"
        bubbleBorder={tint(primary, 0.55)}
        dotColor={accent}
        thoughtText={thought}
        textColor={shade(primary, 0.4)}
        showText={thought.length > 0}
      />
    </DesignStage>
  )
}

export default ThinkingBubbleDesign
