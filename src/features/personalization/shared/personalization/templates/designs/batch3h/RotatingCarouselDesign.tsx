/**
 * Adapter for the upstream `rve-rotating-carousel` template (full-scene
 * intro).
 *
 * Upstream: `templates/rotating-carousel.tsx` (remotion-templates, MIT —
 * React Video Editor). Four feature cards orbit under an "Our Features"
 * title, scaling and fading with depth.
 *
 * Brand mapping: the title is the business name; the four card labels are the
 * headline, the offer, the call to action and the website (falling back to
 * the business name when the customer left them empty). Each card's icon
 * square shows a brand image (cycled) or, with no brand media, a brand
 * gradient.
 */

import React from 'react'
import { RotatingCarousel } from '../../_upstream/rve-rotating-carousel/RotatingCarousel'
import { darkenColor, slotText, slotValue, type DesignAdapterProps } from '../shared'
import { RveDesignStage, withAlpha } from '../rveSharedDesign'
import {
  BrandMediaFill,
  brandImages,
  brandPalette,
  canvasScale,
  cycleImages,
  fitLine,
  sceneBackground,
} from './media'

/** How much larger than the upstream cards the adapter draws. */
const CARD_SCALE = 2

export const RveRotatingCarouselDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = canvasScale(props)
  const f = CARD_SCALE * k
  const cardWidth = Math.round(180 * f)
  const titlePx = Math.round(28.8 * f)
  const labelPx = Math.round(16 * f)
  const cardPadding = Math.round(24 * f)

  const { primary, accent, text: textColor } = brandPalette(props)
  const name = slotText(props, 'businessName', ['headline'])
  const title = fitLine(name, props.width * 0.9, titlePx, 40)

  const candidates = ['headline', 'offer', 'cta', 'website']
    .map((key) => slotValue(props, key))
    .filter(Boolean)
  const pool = candidates.length > 0 ? candidates : [name]
  const cards = Array.from({ length: 4 }, (_, i) =>
    // A nowrap label may run into the card's padding, so the fit width is the
    // content box plus one padding.
    fitLine(pool[i % pool.length], cardWidth + cardPadding, labelPx, 24),
  )

  const images = brandImages(props)
  const slots = cycleImages(images, 4)
  const iconBackground = `linear-gradient(135deg, ${primary}, ${accent})`
  const iconSize = Math.round((images.length > 0 ? 64 : 48) * f)

  return (
    <RveDesignStage designId="rve-rotating-carousel" props={props}>
      <RotatingCarousel
        cards={cards}
        background={sceneBackground(props)}
        title={title}
        titleTop={`${Math.round(40 * f)}px`}
        titleColor={textColor}
        titleFontSize={`${titlePx}px`}
        titleWhiteSpace="nowrap"
        stageWidth={`${Math.round(600 * f)}px`}
        stageHeight={`${Math.round(300 * f)}px`}
        radius={Math.round(Math.min(220 * f, props.width * 0.3))}
        cardWidth={`${cardWidth}px`}
        cardHeight={`${Math.round(220 * f)}px`}
        cardRadius={`${Math.round(16 * f)}px`}
        cardBackground={`linear-gradient(135deg, ${darkenColor(primary, 0.28)}, ${darkenColor(primary, 0.42)})`}
        cardBorder={`${Math.max(1, Math.round(1 * f))}px solid ${withAlpha(accent, 0.35)}`}
        cardPadding={`${cardPadding}px`}
        iconSize={`${iconSize}px`}
        iconRadius={`${Math.round(12 * f)}px`}
        iconBackground={iconBackground}
        iconGap={`${Math.round(16 * f)}px`}
        labelColor={textColor}
        labelFontSize={`${labelPx}px`}
        labelWhiteSpace="nowrap"
        cardContents={slots.map((image) =>
          image ? (
            <BrandMediaFill
              image={image}
              label=""
              background={iconBackground}
              fontSizePx={labelPx}
              showLabel={false}
            />
          ) : null,
        )}
      />
    </RveDesignStage>
  )
}

export default RveRotatingCarouselDesign
