/**
 * Adapter for the upstream `rve-image-comparison-slider` template
 * (full-scene intro).
 *
 * Upstream: `templates/image-comparison-slider.tsx` (remotion-templates, MIT
 * — React Video Editor). A divider sweeps across a frame, wiping a grey
 * "Before" panel away to reveal a colourful "After" panel.
 *
 * Brand mapping: with a brand image, BOTH halves show it — the "before" half
 * in greyscale, the "after" half in full colour — so the sweep reads as a
 * colour reveal of the customer's product. With no brand media the "after"
 * half is a brand gradient. The "after" label is the business name.
 */

import React from 'react'
import { ImageComparisonSlider } from '../../_upstream/rve-image-comparison-slider/ImageComparisonSlider'
import { slotText, type DesignAdapterProps } from '../shared'
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

const BEFORE_PLACEHOLDER = 'linear-gradient(135deg, #1e293b, #374151, #4b5563)'

export const RveImageComparisonSliderDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = canvasScale(props)
  const f = 2.4 * k
  const labelPx = Math.round(24 * f)
  const frameWidthPx = props.width * 0.85

  const image = brandImages(props)[0] ?? null
  const gradients = brandGradients(props)
  const { accent, text: textColor } = brandPalette(props)

  const afterLabel = fitLine(
    slotText(props, 'businessName', ['headline']),
    frameWidthPx * 0.8,
    labelPx,
    32,
  )

  return (
    <RveDesignStage designId="rve-image-comparison-slider" props={props}>
      <ImageComparisonSlider
        background={sceneBackground(props)}
        frameRadius={`${Math.round(12 * f)}px`}
        afterBackground={gradients[0]}
        afterLabel={afterLabel}
        afterLabelColor={textColor}
        afterLabelOpacity={1}
        beforeBackground={BEFORE_PLACEHOLDER}
        beforeLabel="Before"
        beforeLabelColor="#d1d5db"
        labelFontSize={`${labelPx}px`}
        labelFontWeight={700}
        labelShadow="0 2px 12px rgba(0,0,0,0.55)"
        labelWhiteSpace="nowrap"
        dividerWidth={`${Math.max(2, Math.round(3 * f))}px`}
        dividerColor="#ffffff"
        handleSize={`${Math.round(28 * f)}px`}
        handleColor="#ffffff"
        handleBorder={`${Math.max(2, Math.round(3 * f))}px solid ${accent}`}
        afterContent={
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
        beforeContent={
          image ? (
            <BrandMediaFill
              image={image}
              label=""
              background={BEFORE_PLACEHOLDER}
              fontSizePx={labelPx}
              showLabel={false}
              filter="grayscale(1) brightness(0.75)"
            />
          ) : undefined
        }
      />
    </RveDesignStage>
  )
}

export default RveImageComparisonSliderDesign
