/**
 * Adapter for the upstream `card-flip-transition` template.
 *
 * Upstream: `src/components/card-flip-transition/CardFlipTransition.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The whole frame is a card that turns 180° around the Y axis between frames
 * 30 and 75; the front face is the "before" scene, the back face the "after".
 *
 * INTRO-REVEAL ADAPTATION: the front face is a brand-primary card with the
 * business name; the back face and the stage backdrop are `transparent`, so
 * once the card has turned the customer's video is what is "behind" it. The
 * layer ends at frame 75, the moment the flip completes. While the card is
 * mid-turn the upstream's faint stage wash and contact shadow are visible
 * over the video.
 *
 * The label is a fixed 180 px (composition px) display line that wraps on
 * word boundaries, so the name is fitted to the canvas width (two lines max).
 */

import React from 'react'
import { CardFlipTransition } from '../../_upstream/card-flip-transition/CardFlipTransition'
import { DesignStage, TRANSPARENT, pickColor, slotText, type DesignAdapterProps } from '../shared'
import { charsPerLine, fitWords } from './shared'

export const CARD_FLIP_END_FRAME = 75
const LABEL_FONT_SIZE = 180

export const CardFlipTransitionDesign: React.FC<DesignAdapterProps> = (props) => {
  const perLine = charsPerLine(props.width, LABEL_FONT_SIZE, { letterSpacing: 6 })
  const label = fitWords(slotText(props, 'businessName', ['headline']), perLine, 2)

  return (
    <DesignStage designId="card-flip-transition" props={props}>
      <CardFlipTransition
        colorBefore={pickColor([props.colors?.primary], '#22223b')}
        colorAfter={TRANSPARENT}
        labelBefore={label}
        labelAfter=""
        textColor={pickColor([props.color, props.colors?.text], '#ffffff')}
        backdropColor={TRANSPARENT}
      />
    </DesignStage>
  )
}

export default CardFlipTransitionDesign
