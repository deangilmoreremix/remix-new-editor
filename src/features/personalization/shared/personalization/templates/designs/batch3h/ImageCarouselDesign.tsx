/**
 * Adapter for the upstream `rve-image-carousel` template (full-scene intro).
 *
 * Upstream: `templates/image-carousel.tsx` (remotion-templates, MIT — React
 * Video Editor). Three cards slide past, the active one large and bright.
 *
 * Brand mapping: the three card labels are the business name, the headline
 * and the offer; each card shows a brand image (cycled) or, with no brand
 * media, a brand gradient behind its label. The upstream's 240x320 px cards
 * are scaled up to fill the composition, and the active card is centred
 * (the copy's `centerSlides` flag — see its deviation record).
 */

import React from 'react'
import { ImageCarousel } from '../../_upstream/rve-image-carousel/ImageCarousel'
import { slotText, slotValue, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  BrandMediaFill,
  brandGradients,
  brandImages,
  brandPalette,
  canvasScale,
  cycleImages,
  fitLine,
  sceneBackground,
} from './media'

/** How much larger than the upstream card the adapter draws. */
const CARD_SCALE = 2.3

export const RveImageCarouselDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = canvasScale(props)
  const f = CARD_SCALE * k
  const slideWidth = Math.round(240 * f)
  const slideHeight = Math.round(320 * f)
  const padding = Math.round(16 * f)
  const labelPx = Math.round(16 * f)

  const name = slotText(props, 'businessName', ['headline'])
  const rawLabels = [name, slotValue(props, 'headline'), slotValue(props, 'offer')]
  const labels = rawLabels.map((value) =>
    fitLine(value || name, slideWidth - padding * 2, labelPx, 28),
  )

  const gradients = brandGradients(props)
  const images = brandImages(props)
  const slots = cycleImages(images, 3)
  const { text: textColor } = brandPalette(props)

  const slides = labels.map((label, i) => ({
    label,
    gradient: gradients[i],
    content: slots[i] ? (
      <BrandMediaFill
        image={slots[i]}
        label=""
        background={gradients[i]}
        fontSizePx={labelPx}
        showLabel={false}
      />
    ) : undefined,
  }))

  return (
    <RveDesignStage designId="rve-image-carousel" props={props}>
      <ImageCarousel
        slides={slides}
        background={sceneBackground(props)}
        slideSpacing={Math.round(280 * f)}
        slideWidth={`${slideWidth}px`}
        slideHeight={`${slideHeight}px`}
        slideRadius={`${Math.round(12 * f)}px`}
        slidePadding={`${padding}px`}
        labelColor={textColor}
        labelFontSize={`${labelPx}px`}
        labelFontWeight={700}
        labelShadow="0 2px 10px rgba(0,0,0,0.6)"
        labelWhiteSpace="nowrap"
        centerSlides
      />
    </RveDesignStage>
  )
}

export default RveImageCarouselDesign
