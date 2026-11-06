/**
 * Adapter for the upstream `end-card` template.
 *
 * Upstream: `src/components/end-card/EndCard.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream is NOT a transparent overlay: its root is an `AbsoluteFill`
 * painted with the `background` prop, and that same prop is handed to the CTA
 * button as `labelColor={background}`. Passing `"transparent"` would make the
 * CTA label and its chevron invisible.
 *
 * The adapter therefore renders the end card as a BOUNDED CARD:
 *
 *  - the card fill is a solid, darkened shade of the brand primary, so the
 *    white title and the accent-coloured CTA pill both stay legible (the
 *    default brand primary is a light cyan, which would be unreadable);
 *  - the design box is smaller than the composition (the catalog placement
 *    uses `scale < 1`), so the opaque fill is confined to the box and the
 *    customer's video stays visible around it;
 *  - the stage clips the fill with a border radius, so the bounded region
 *    reads as a CTA card rather than a rectangular wipe.
 */

import React from 'react'
import { EndCard } from '../_upstream/end-card/EndCard'
import {
  DesignStage,
  darkenColor,
  pickColor,
  slotValue,
  truncateText,
  type DesignAdapterProps,
} from './shared'

/** The card fill is the brand primary, darkened for legibility. */
const CARD_DARKEN_FACTOR = 0.3

/** The bounded card gets rounded corners so it reads as a card. */
const CARD_RADIUS = 24
const CARD_SHADOW = '0 18px 48px rgba(0,0,0,0.35)'

/** Long copy is truncated so it never leaves the card. */
const MAX_TITLE_LENGTH = 48
const MAX_SUBTITLE_LENGTH = 64
const MAX_CTA_LENGTH = 24

const FALLBACK_CTA = 'Learn more'

export const PromoCtaDesign: React.FC<DesignAdapterProps> = (props) => {
  const headline = slotValue(props, 'headline')
  const offer = slotValue(props, 'offer')
  const businessName = slotValue(props, 'businessName')

  const title = truncateText(headline || offer || businessName, MAX_TITLE_LENGTH)

  // The subtitle supports the title; it never repeats it.
  const subtitleSource =
    offer && offer !== title ? offer : businessName !== title ? businessName : ''
  const subtitle = truncateText(subtitleSource, MAX_SUBTITLE_LENGTH)

  const ctaText = truncateText(slotValue(props, 'cta'), MAX_CTA_LENGTH) || FALLBACK_CTA

  return (
    <DesignStage
      designId="promo-cta"
      props={props}
      stageStyle={{ borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW }}
    >
      <EndCard
        title={title}
        subtitle={subtitle}
        ctaText={ctaText}
        background={darkenColor(
          pickColor([props.colors?.primary], '#0b1f3a'),
          CARD_DARKEN_FACTOR,
        )}
        titleColor={pickColor([props.color, props.colors?.text])}
        accentColor={pickColor([props.colors?.accent, props.colors?.primary], '#d4af37')}
      />
    </DesignStage>
  )
}

export default PromoCtaDesign
