/**
 * Adapter for the upstream `rve-image-zoom-reveal` template (full-scene
 * intro).
 *
 * Upstream: `templates/image-zoom-reveal.tsx` (remotion-templates, MIT —
 * React Video Editor). An image settles from a blurred 2x zoom into focus,
 * then a caption fades in over it.
 *
 * Brand mapping: the image is the first brand image (product → service →
 * logo); with no brand media it is a brand gradient. The caption is the
 * headline (falling back to the offer, then the business name).
 */

import React from 'react'
import { ImageZoomReveal } from '../../_upstream/rve-image-zoom-reveal/ImageZoomReveal'
import { darkenColor, slotText, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  BrandMediaFill,
  brandGradients,
  brandImages,
  brandPalette,
  canvasScale,
  fitLine,
  sceneBackground,
} from './media'

export const RveImageZoomRevealDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = canvasScale(props)
  const f = 2.4 * k
  const labelPx = Math.round(28.8 * f)

  const image = brandImages(props)[0] ?? null
  const gradients = brandGradients(props)
  const { primary, text: textColor } = brandPalette(props)

  const label = fitLine(
    slotText(props, 'headline', ['offer', 'businessName']),
    props.width * 0.8 * 0.9,
    labelPx,
    40,
  )

  return (
    <RveDesignStage designId="rve-image-zoom-reveal" props={props}>
      <ImageZoomReveal
        background={sceneBackground(props)}
        frameRadius={`${Math.round(12 * f)}px`}
        frameBorder={`${Math.max(2, Math.round(3 * f))}px solid ${darkenColor(primary, 0.45)}`}
        imageBackground={gradients[0]}
        label={label}
        labelColor={textColor}
        labelFontSize={`${labelPx}px`}
        labelFontWeight={700}
        labelShadow="0 2px 14px rgba(0,0,0,0.6)"
        labelWhiteSpace="nowrap"
        content={
          image ? (
            <BrandMediaFill
              image={image}
              label=""
              background={gradients[0]}
              fontSizePx={labelPx}
              showLabel={false}
            />
          ) : undefined
        }
      />
    </RveDesignStage>
  )
}

export default RveImageZoomRevealDesign
