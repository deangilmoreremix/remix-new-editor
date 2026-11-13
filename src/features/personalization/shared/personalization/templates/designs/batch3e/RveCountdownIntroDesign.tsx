/**
 * Adapter for the upstream `rve-countdown-intro` template.
 *
 * Upstream: `templates/countdown-intro.tsx` (remotion-templates, MIT —
 * React Video Editor, no named copyright holder).
 *
 * FULL-SCENE design. A 3-2-1 countdown with a draining progress ring, then a
 * closing word bounces in — a "get ready" intro card on a solid background.
 * The adapter keeps the card (a deep shade of the brand primary instead of
 * `#111827`) and the catalog gives the layer an `endFrame` of 120 frames
 * (3 s of countdown + 1 s on the closing word at 30 fps), after which the
 * customer's video plays.
 *
 * Brand mapping: call to action (then offer) → the closing word (the
 * upstream's "GO!"), kept on one line and truncated to fit; the brand
 * primary → the ring and the closing word; a dark primary → the ring track;
 * the layer colour → the digits. The ring scales with the composition.
 *
 * The SVG declares no `id`s, so this design has no one-instance constraint.
 */

import React from 'react'
import { CountdownIntro } from '../../_upstream/rve-countdown-intro/CountdownIntro'
import { DESIGN_FONT_STACK } from '../fonts'
import { type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  brandPrimary,
  brandSceneColor,
  brandText,
  darkenColor,
  fitChars,
  lightenColor,
  px,
  remUnit,
  slotText,
  truncateText,
} from './batch3eShared'

export const RVE_COUNTDOWN_INTRO_ID = 'rve-countdown-intro'

/** 3 s countdown + 1 s on the closing word, at 30 fps. */
export const COUNTDOWN_INTRO_FRAMES = 120

const ZOOM = 2

export const RveCountdownIntroDesign: React.FC<DesignAdapterProps> = (props) => {
  const rem = remUnit(props, ZOOM)
  const unit = rem / 16
  const goPx = 3.5 * rem

  const goText = truncateText(
    slotText(props, 'cta', ['offer', 'businessName']),
    fitChars(props.width * 0.86, goPx, 1, 24),
  )

  const primary = brandPrimary(props)

  return (
    <RveDesignStage designId={RVE_COUNTDOWN_INTRO_ID} props={props}>
      <CountdownIntro
        goText={goText}
        backgroundColor={brandSceneColor(props)}
        trackColor={darkenColor(primary, 0.32)}
        ringColor={primary}
        numberColor={brandText(props)}
        goColor={lightenColor(primary, 0.1)}
        numberFontSize={px(4 * rem)}
        goFontSize={px(goPx)}
        ringSize={Math.round(180 * unit)}
        radius={Math.round(70 * unit)}
        strokeWidth={Math.max(3, Math.round(6 * unit))}
        fontFamily={DESIGN_FONT_STACK}
        goWhiteSpace="nowrap"
      />
    </RveDesignStage>
  )
}

export default RveCountdownIntroDesign
