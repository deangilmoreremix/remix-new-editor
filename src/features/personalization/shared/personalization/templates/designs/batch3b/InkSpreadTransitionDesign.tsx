/**
 * Adapter for the upstream `ink-spread-transition` template.
 *
 * Upstream: `src/components/ink-spread-transition/InkSpreadTransition.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * Ink droplets (an SVG gooey filter chain) bleed across the "before" page in
 * the after-scene colour, then the after-scene label brushes in.
 *
 * WHY THE "AFTER" SIDE IS NOT TRANSPARENT: the ink IS painted in
 * `colorAfter`, and the after label is painted in `colorBefore`. A
 * transparent `colorAfter` would make the ink invisible (nothing would ever
 * cover the before page), and a transparent `colorBefore` would make the after
 * label invisible. So the adapter plays it as a branded two-card intro: a
 * brand-primary card with the business name is swallowed by ink in a deep
 * shade of the brand, the headline brushes in (in the primary), and the whole
 * card then dissolves into the customer's video (frames 70-84, layer ends at
 * 84).
 *
 * The labels are a fixed 220 px with wide letter spacing and wrap on word
 * boundaries; on a 1080 px wide canvas that leaves ~6 characters per line, so
 * the design is offered for 16:9 only, and the labels are fitted to two lines.
 */

import React from 'react'
import { InkSpreadTransition } from '../../_upstream/ink-spread-transition/InkSpreadTransition'
import { DesignStage, pickColor, slotText, slotValue, type DesignAdapterProps } from '../shared'
import { FadeOut, charsPerLine, ensureDark, fitWords, hex6, mix } from './shared'

export const INK_FADE_START = 70
export const INK_END_FRAME = 84
const LABEL_FONT_SIZE = 220

export const InkSpreadTransitionDesign: React.FC<DesignAdapterProps> = (props) => {
  const primary = hex6(props.colors?.primary, '#f5f1e8')
  const ink = ensureDark(mix(hex6(pickColor([props.colors?.accent, props.colors?.primary]), '#1a1a1a'), '#000000', 0.7), 0.03)
  // The before label uses the widest spacing the after label animates from.
  const beforePerLine = charsPerLine(props.width, LABEL_FONT_SIZE, { letterSpacing: 16 })
  const afterPerLine = charsPerLine(props.width, LABEL_FONT_SIZE, { letterSpacing: 34 })
  const before = fitWords(slotText(props, 'businessName', ['headline']), beforePerLine, 2)
  const after = fitWords(slotValue(props, 'headline') || slotValue(props, 'offer'), afterPerLine, 2)

  return (
    <DesignStage designId="ink-spread-transition" props={props}>
      <FadeOut from={INK_FADE_START} to={INK_END_FRAME}>
        <InkSpreadTransition
          colorBefore={primary}
          colorAfter={ink}
          labelBefore={before}
          labelAfter={after}
          textColor={pickColor([props.color, props.colors?.text], '#1a1a1a')}
        />
      </FadeOut>
    </DesignStage>
  )
}

export default InkSpreadTransitionDesign
