/**
 * Adapter for the upstream `logo-stroke-draw` template.
 *
 * Upstream: `src/components/logo-stroke-draw/LogoStrokeDraw.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream draws a monogram badge (an SVG ring + a single glyph) and a
 * wordmark underneath. It has NO image prop, so the customer's logo is
 * injected by the adapter: when `media.logo` is present the monogram is
 * blanked (a single space) and the adapter draws the logo image over the
 * badge, faded in on the upstream's own `fillIn` window (frames 44 → 66).
 * Without a logo the monogram lockup is used on its own.
 *
 * The upstream's `backgroundColor` prop is forced to `transparent`.
 */

import React from 'react'
import { Img, interpolate } from 'remotion'
import { LogoStrokeDraw } from '../_upstream/logo-stroke-draw/LogoStrokeDraw'
import {
  DesignStage,
  TRANSPARENT,
  pickColor,
  slotText,
  truncateText,
  type DesignAdapterProps,
} from './shared'

/** The upstream's badge geometry (fractions of the composition height). */
const BADGE_RADIUS_FACTOR = 0.2
const BADGE_STROKE_FACTOR = 0.011
const BADGE_CENTER_Y_FACTOR = 0.42

/** The upstream's badge fill window, in layer-local frames. */
const FILL_IN_START = 44
const FILL_IN_END = 66

/** The wordmark is a single line; long business names are truncated. */
const MAX_BRAND_TEXT_LENGTH = 32

export const LogoRevealDesign: React.FC<DesignAdapterProps> = (props) => {
  const brandText = truncateText(
    slotText(props, 'businessName', ['headline']),
    MAX_BRAND_TEXT_LENGTH,
  )
  const logoUrl = (props.media?.logo ?? '').trim()
  const hasLogo = logoUrl.length > 0

  // A blank monogram keeps the badge geometry but hides the glyph while the
  // customer's own logo is faded in on top of it.
  const monogram = hasLogo
    ? ' '
    : brandText.charAt(0).toUpperCase() || '★'

  const accentColor = pickColor([props.colors?.accent, props.colors?.primary], '#eab308')
  const textColor = pickColor([props.color, props.colors?.text])

  const badgeRadius = props.height * BADGE_RADIUS_FACTOR
  const badgeStroke = props.height * BADGE_STROKE_FACTOR
  const badgeDiameter = 2 * (badgeRadius - badgeStroke / 2)
  const badgeCenterX = props.width / 2
  const badgeCenterY = props.height * BADGE_CENTER_Y_FACTOR

  const fillIn = interpolate(props.frame, [FILL_IN_START, FILL_IN_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <DesignStage designId="logo-reveal" props={props}>
      <LogoStrokeDraw
        backgroundColor={TRANSPARENT}
        accentColor={accentColor}
        textColor={textColor}
        monogram={monogram}
        brandText={brandText}
      />
      {hasLogo ? (
        <Img
          src={logoUrl}
          data-remotion-design-logo
          style={{
            position: 'absolute',
            left: badgeCenterX - badgeDiameter / 2,
            top: badgeCenterY - badgeDiameter / 2,
            width: badgeDiameter,
            height: badgeDiameter,
            objectFit: 'contain',
            opacity: fillIn,
          }}
        />
      ) : null}
    </DesignStage>
  )
}

export default LogoRevealDesign
