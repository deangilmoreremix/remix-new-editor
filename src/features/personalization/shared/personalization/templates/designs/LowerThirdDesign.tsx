/**
 * Adapter for the upstream `lower-third-glass-card` template.
 *
 * Upstream: `src/components/lower-third-glass-card/LowerThirdGlassCard.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream anchors the glass card to the bottom-left of the *composition*
 * and draws both text lines with `whiteSpace: "nowrap"`, which is not
 * overridable through props. A long business name or offer would therefore
 * run off the card and off the canvas, so the adapter truncates the strings
 * it passes (≈ 28 characters for the name, ≈ 40 for the title).
 *
 * The card body's fill is a hardcoded translucent white gradient — NOT the
 * `backgroundColor` prop — so the frosted-glass look survives; the
 * `backgroundColor` prop is the canvas fill and is forced to `transparent`.
 */

import React from 'react'
import { LowerThirdGlassCard } from '../_upstream/lower-third-glass-card/LowerThirdGlassCard'
import {
  DesignStage,
  TRANSPARENT,
  pickColor,
  slotValue,
  truncateText,
  type DesignAdapterProps,
} from './shared'

/** `whiteSpace: "nowrap"` means the text must be cut to fit the card. */
const MAX_NAME_LENGTH = 28
const MAX_TITLE_LENGTH = 40

export const LowerThirdDesign: React.FC<DesignAdapterProps> = (props) => {
  const name = truncateText(
    slotValue(props, 'businessName') || slotValue(props, 'offer'),
    MAX_NAME_LENGTH,
  )
  const title = truncateText(slotValue(props, 'offer'), MAX_TITLE_LENGTH)

  return (
    <DesignStage designId="lower-third" props={props}>
      <LowerThirdGlassCard
        backgroundColor={TRANSPARENT}
        accentColor={pickColor([props.colors?.accent, props.colors?.primary], '#06b6d4')}
        textColor={pickColor([props.color, props.colors?.text])}
        nameText={name}
        titleText={title}
      />
    </DesignStage>
  )
}

export default LowerThirdDesign
