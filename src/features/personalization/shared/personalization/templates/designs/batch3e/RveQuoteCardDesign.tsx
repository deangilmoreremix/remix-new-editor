/**
 * Adapter for the upstream `rve-quote-card` template.
 *
 * Upstream: `templates/quote-card.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder).
 *
 * FULL-SCENE design. A large opening quote mark fades in, the quote follows
 * in italics and the attribution slides in under it — on a solid card that
 * IS the design. The adapter keeps that card (a deep shade of the brand
 * primary instead of the upstream's `#111827`) and the catalog gives the
 * layer an `endFrame`, so it plays as an intro card and then reveals the
 * customer's video.
 *
 * Brand mapping: the quote is the customer's headline (then offer) — a
 * statement the business stands behind — and the attribution is
 * "— <business name>". The brand primary → the quote mark, the layer colour
 * → the quote, a 70 % tint of it → the attribution. The quote wraps inside a
 * column of `min(700px × unit, 86 % of the canvas)` and is truncated at
 * roughly four lines.
 */

import React from 'react'
import { QuoteCard } from '../../_upstream/rve-quote-card/QuoteCard'
import { DESIGN_FONT_STACK } from '../fonts'
import { type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  brandPrimary,
  brandSceneColor,
  brandText,
  firstSlot,
  fitChars,
  lightenColor,
  px,
  remUnit,
  slotText,
  truncateText,
  withAlpha,
} from './batch3eShared'

export const RVE_QUOTE_CARD_ID = 'rve-quote-card'

const ZOOM = 1.8

export const RveQuoteCardDesign: React.FC<DesignAdapterProps> = (props) => {
  const rem = remUnit(props, ZOOM)
  const unit = rem / 16
  const quotePx = 1.8 * rem
  const attributionPx = 1.1 * rem
  const column = Math.min(700 * unit, props.width * 0.86)

  const quote = truncateText(
    slotText(props, 'headline', ['offer', 'businessName']),
    fitChars(column, quotePx, 4, 160),
  )
  const name = truncateText(firstSlot(props, ['businessName']), fitChars(column, attributionPx, 1, 48))
  const attribution = name ? `— ${name}` : ''

  const text = brandText(props)

  return (
    <RveDesignStage designId={RVE_QUOTE_CARD_ID} props={props}>
      <QuoteCard
        quote={quote}
        attribution={attribution}
        backgroundColor={brandSceneColor(props)}
        quoteMarkColor={lightenColor(brandPrimary(props), 0.1)}
        quoteColor={text}
        attributionColor={withAlpha(text, 0.7)}
        quoteMarkFontSize={px(6 * rem)}
        quoteFontSize={px(quotePx)}
        attributionFontSize={px(attributionPx)}
        quoteMarkGap={px(1 * rem)}
        attributionGap={px(2 * rem)}
        maxWidth={px(column)}
        padding={px(4 * rem)}
        attributionTravel={40 * unit}
        serifFontFamily={DESIGN_FONT_STACK}
        fontFamily={DESIGN_FONT_STACK}
      />
    </RveDesignStage>
  )
}

export default RveQuoteCardDesign
