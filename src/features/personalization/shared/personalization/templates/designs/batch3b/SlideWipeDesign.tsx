/**
 * Adapter for the upstream `slide-wipe` template.
 *
 * Upstream: `src/components/slide-wipe/SlideWipe.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The "before" page slides off to the left while the "after" page slides in
 * from the right (frames 30-75).
 *
 * INTRO-REVEAL ADAPTATION: the outgoing page is a brand-primary card with the
 * business name; the incoming page and the backdrop are `transparent`, so the
 * branded card slides away and uncovers the customer's video. The layer ends
 * at frame 75.
 *
 * The label size is 16.6 % of the composition HEIGHT, so it is large on tall
 * canvases; the design is offered for 16:9 and 1:1, and the label is fitted to
 * two lines of the canvas width.
 */

import React from 'react'
import { SlideWipe } from '../../_upstream/slide-wipe/SlideWipe'
import { DesignStage, TRANSPARENT, pickColor, slotText, type DesignAdapterProps } from '../shared'
import { charsPerLine, fitWords } from './shared'

export const SLIDE_WIPE_END_FRAME = 75

export const SlideWipeDesign: React.FC<DesignAdapterProps> = (props) => {
  const perLine = charsPerLine(props.width, props.height * 0.166, { letterSpacing: 6 })
  const label = fitWords(slotText(props, 'businessName', ['headline']), perLine, 2)

  return (
    <DesignStage designId="slide-wipe" props={props}>
      <SlideWipe
        colorBefore={pickColor([props.colors?.primary], '#0d4f8b')}
        colorAfter={TRANSPARENT}
        labelBefore={label}
        labelAfter=""
        textColor={pickColor([props.color, props.colors?.text], '#ffffff')}
        backdropColor={TRANSPARENT}
      />
    </DesignStage>
  )
}

export default SlideWipeDesign
