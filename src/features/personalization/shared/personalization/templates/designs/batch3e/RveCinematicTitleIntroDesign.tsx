/**
 * Adapter for the upstream `rve-cinematic-title-intro` template.
 *
 * Upstream: `templates/cinematic-title-intro.tsx` (remotion-templates, MIT —
 * React Video Editor, no named copyright holder).
 *
 * FULL-SCENE design. The upstream's dark diagonal gradient IS the look (a
 * title card in front of the story), so the canvas keeps a designed
 * background — rebuilt from the brand (deep primary → deep accent) — and the
 * catalog gives the layer an `endFrame`, so the card plays as an intro and
 * then reveals the customer's video.
 *
 * Brand mapping: headline → title, business name → subtitle, primary →
 * accent → the underline gradient, the layer colour → the title (and an 80 %
 * tint of it → the subtitle, as upstream).
 */

import React from 'react'
import { CinematicTitleIntro } from '../../_upstream/rve-cinematic-title-intro/CinematicTitleIntro'
import { type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  brandAccent,
  brandPrimary,
  brandSceneGradient,
  brandText,
  firstSlot,
  fitChars,
  px,
  remUnit,
  slotText,
  truncateText,
  withAlpha,
} from './batch3eShared'

export const RVE_CINEMATIC_TITLE_INTRO_ID = 'rve-cinematic-title-intro'

const ZOOM = 1.8

export const RveCinematicTitleIntroDesign: React.FC<DesignAdapterProps> = (props) => {
  const rem = remUnit(props, ZOOM)
  const unit = rem / 16
  const titlePx = 4 * rem
  const subtitlePx = 1.5 * rem
  const inner = props.width * 0.88

  const title = truncateText(
    slotText(props, 'headline', ['businessName', 'offer']),
    // The title is letter-spaced 0.05em, so each glyph is a little wider.
    fitChars(inner / 1.08, titlePx, 2, 40),
  )
  const subtitle = truncateText(
    firstSlot(props, ['businessName', 'offer']),
    fitChars(inner / 1.15, subtitlePx, 1, 48),
  )

  const text = brandText(props)

  return (
    <RveDesignStage designId={RVE_CINEMATIC_TITLE_INTRO_ID} props={props}>
      <CinematicTitleIntro
        title={title}
        subtitle={subtitle}
        background={brandSceneGradient(props)}
        titleColor={text}
        subtitleColor={withAlpha(text, 0.8)}
        underlineFrom={brandPrimary(props)}
        underlineTo={brandAccent(props)}
        titleFontSize={px(titlePx)}
        subtitleFontSize={px(subtitlePx)}
        underlineMaxWidth={Math.round(320 * unit)}
        underlineHeight={Math.max(2, Math.round(4 * unit))}
        underlineGap={Math.round(16 * unit)}
        subtitleGap={Math.round(24 * unit)}
      />
    </RveDesignStage>
  )
}

export default RveCinematicTitleIntroDesign
