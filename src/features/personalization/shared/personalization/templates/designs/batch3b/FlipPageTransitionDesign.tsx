/**
 * Adapter for the upstream `flip-page-transition` template.
 *
 * Upstream: `src/components/flip-page-transition/FlipPageTransition.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The "before" page pivots on its left edge like a book page (frames 14-75)
 * and peels away to reveal the "after" page underneath.
 *
 * INTRO-REVEAL ADAPTATION: the turning page is a brand-primary card with the
 * business name; the after page and the root fill are `transparent`, so the
 * page turns away onto the customer's video. The upstream's cast shadow
 * (a soft black gradient on the left) shows over the video while the page is
 * mid-turn and is gone when it completes. The layer ends at frame 75.
 *
 * The label is a fixed 180 px display line; it is fitted to two lines of the
 * canvas width.
 */

import React from 'react'
import { FlipPageTransition } from '../../_upstream/flip-page-transition/FlipPageTransition'
import { DesignStage, TRANSPARENT, pickColor, slotText, type DesignAdapterProps } from '../shared'
import { charsPerLine, fitWords } from './shared'

export const FLIP_PAGE_END_FRAME = 75
const LABEL_FONT_SIZE = 180

export const FlipPageTransitionDesign: React.FC<DesignAdapterProps> = (props) => {
  const perLine = charsPerLine(props.width, LABEL_FONT_SIZE, { letterSpacing: 6 })
  const label = fitWords(slotText(props, 'businessName', ['headline']), perLine, 2)

  return (
    <DesignStage designId="flip-page-transition" props={props}>
      <FlipPageTransition
        colorBefore={pickColor([props.colors?.primary], '#fefae0')}
        colorAfter={TRANSPARENT}
        labelBefore={label}
        labelAfter=""
        textColor={pickColor([props.color, props.colors?.text], '#283618')}
      />
    </DesignStage>
  )
}

export default FlipPageTransitionDesign
