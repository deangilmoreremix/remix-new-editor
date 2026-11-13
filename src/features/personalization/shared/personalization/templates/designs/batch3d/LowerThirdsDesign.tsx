/**
 * Adapter for the upstream `LowerThirds` template (repo 3).
 *
 * Upstream: `src/templates/LowerThirds/LowerThirds.tsx` + `styles.tsx`
 * (remotion-video-templates, MIT — © 2026 Alejandro Brito).
 *
 * The upstream composition plays its three lower-third styles back to back —
 * a slide-in bar on a white card, a boxed tinted card that fades and scales
 * up, and a minimal accent rule with the text rising under it — each with
 * the same enter → hold → exit envelope.
 *
 * The upstream `LowerThirds` component also paints a "StageBackground" (an
 * opaque zinc gradient with a faint "LOWER THIRDS" label) that its own source
 * calls "purely cosmetic — helps you see the lower-third contrast while
 * editing". That would hide the customer's video, so this adapter renders the
 * upstream's own building blocks instead — the exported `SlideInBar`,
 * `BoxedFade` and `MinimalLine` styles in the same `<Series>` order, with the
 * same per-style length (`lowerThirdTotalFrames`) and the upstream default
 * timing — on a transparent root. Nothing upstream is edited.
 *
 * Brand mapping: `name` ← business name, `role` ← offer (falling back to the
 * website, then the phone number), `accentColor` ← brand primary. The
 * upstream sets the copy in fixed px (52-58 px name, 30 px role) without a
 * width limit, so both lines are truncated to what fits the composition
 * width (1920 in 16:9, 1080 otherwise).
 */

import React from 'react'
import { AbsoluteFill, Series } from 'remotion'
import { lowerThirdsDefaultProps } from '../../_upstream/brito-lower-thirds/LowerThirds'
import {
  BoxedFade,
  MinimalLine,
  SlideInBar,
  lowerThirdTotalFrames,
  type LowerThirdStyleProps,
} from '../../_upstream/brito-lower-thirds/styles'
import {
  TRANSPARENT,
  pickColor,
  slotText,
  slotValue,
  truncateText,
  type DesignAdapterProps,
} from '../shared'
import { BritoDesignStage, britoFitChars } from './britoShared'

export const BRITO_LOWER_THIRDS_ID = 'brito-lower-thirds'

/** One style's length with the upstream default timing (14 + 70 + 14). */
export const BRITO_LOWER_THIRD_STYLE_FRAMES = lowerThirdTotalFrames(lowerThirdsDefaultProps)

/** The whole design: the three styles back to back (294 frames). */
export const BRITO_LOWER_THIRDS_FRAMES = BRITO_LOWER_THIRD_STYLE_FRAMES * 3

export const BritoLowerThirdsDesign: React.FC<DesignAdapterProps> = (props) => {
  // Safe-area padding (5 % each side) + the card's own 40 + 28 px padding +
  // the 12 px accent bar.
  const textWidth = props.width * 0.9 - 90
  const name = truncateText(
    slotText(props, 'name', ['businessName']),
    britoFitChars(textWidth, 58, 44, 0.58),
  )
  const role = truncateText(
    slotValue(props, 'role') || slotValue(props, 'website') || slotValue(props, 'phone'),
    britoFitChars(textWidth, 30, 64, 0.55),
  )

  const styleProps: LowerThirdStyleProps = {
    name,
    role,
    accentColor: pickColor([props.colors?.primary, props.colors?.accent], '#2563EB'),
    enterDurationInFrames: lowerThirdsDefaultProps.enterDurationInFrames,
    holdDurationInFrames: lowerThirdsDefaultProps.holdDurationInFrames,
    exitDurationInFrames: lowerThirdsDefaultProps.exitDurationInFrames,
  }
  const one = lowerThirdTotalFrames(styleProps)

  return (
    <BritoDesignStage designId={BRITO_LOWER_THIRDS_ID} props={props} overlay>
      <AbsoluteFill style={{ backgroundColor: TRANSPARENT }}>
        <Series>
          <Series.Sequence durationInFrames={one} name="Slide-in bar">
            <SlideInBar {...styleProps} />
          </Series.Sequence>
          <Series.Sequence durationInFrames={one} name="Boxed fade">
            <BoxedFade {...styleProps} />
          </Series.Sequence>
          <Series.Sequence durationInFrames={one} name="Minimal line">
            <MinimalLine {...styleProps} />
          </Series.Sequence>
        </Series>
      </AbsoluteFill>
    </BritoDesignStage>
  )
}

export default BritoLowerThirdsDesign
