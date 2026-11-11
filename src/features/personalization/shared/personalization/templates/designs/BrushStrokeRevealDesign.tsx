/**
 * Adapter for the upstream `brush-stroke-reveal` template.
 *
 * Upstream: `src/components/brush-stroke-reveal/BrushStrokeReveal.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream paints the title onto the canvas in horizontal brush-stroke
 * bands, then fades in an accent dot and the description line.
 *
 * THE FOOTGUN: the upstream's `background` prop defaults to the OPAQUE cream
 * `#fffdf6` — in the default-props object AND in the destructuring default —
 * so an adapter that forgets the prop paints the customer's video out. The
 * adapter therefore passes `"transparent"` explicitly, every time.
 *
 * The upstream's display size is a fixed `fontSize: 160` px with
 * `letterSpacing: 12` and it is NOT a prop, so the adapter cannot resize it;
 * the title is truncated instead (A6's contract addition C3). The title does
 * wrap (the upstream sets no `whiteSpace`), so a long title becomes two
 * lines rather than running off the canvas.
 */

import React from 'react'
import { BrushStrokeReveal } from '../_upstream/brush-stroke-reveal/BrushStrokeReveal'
import { useDesignFonts } from './fonts'
import {
  DesignStage,
  TRANSPARENT,
  pickColor,
  slotText,
  slotValue,
  truncateText,
  type DesignAdapterProps,
} from './shared'

/** The upstream's fixed display size is 160 px, so the title is cut short. */
const MAX_TITLE_LENGTH = 24
const MAX_DESCRIPTION_LENGTH = 48

/** The upstream's own motion constants. */
const STROKES = 3
const DIRECTION = 'left' as const

export const BrushStrokeRevealDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()

  const title = truncateText(
    slotText(props, 'headline', ['offer', 'businessName']),
    MAX_TITLE_LENGTH,
  )
  const description = truncateText(slotValue(props, 'offer'), MAX_DESCRIPTION_LENGTH)

  return (
    <DesignStage designId="brush-stroke-reveal" props={props}>
      <BrushStrokeReveal
        title={title}
        description={description}
        strokes={STROKES}
        direction={DIRECTION}
        textColor={pickColor([props.color, props.colors?.text], '#1a1a1a')}
        background={TRANSPARENT}
        accentColor={pickColor([props.colors?.accent, props.colors?.primary], '#a93226')}
      />
    </DesignStage>
  )
}

export default BrushStrokeRevealDesign
