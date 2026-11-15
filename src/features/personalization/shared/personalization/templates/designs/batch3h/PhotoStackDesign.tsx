/**
 * Adapter for the upstream `rve-photo-stack` template (full-scene intro).
 *
 * Upstream: `templates/photo-stack.tsx` (remotion-templates, MIT — React
 * Video Editor). Three white-bordered prints pop onto a pile, fanned at
 * -5° / 0° / 5°.
 *
 * Brand mapping: each print shows a brand image (cycled). With no brand media
 * the prints keep the upstream's icon + caption look on brand gradients, and
 * the captions are the business name, the headline and the offer (the top
 * print — the last to land — carries the business name).
 */

import React from 'react'
import { PhotoStack } from '../../_upstream/rve-photo-stack/PhotoStack'
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

/** How much larger than the upstream 200x260 print the adapter draws. */
const PRINT_SCALE = 2.4

export const RvePhotoStackDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = canvasScale(props)
  const f = PRINT_SCALE * k
  const photoWidth = Math.round(200 * f)
  const labelPx = Math.round(19.2 * f)

  const name = slotText(props, 'businessName', ['headline'])
  // Bottom → top: the last print lands on top, so it gets the business name.
  const raw = [slotValue(props, 'offer'), slotValue(props, 'headline'), name]
  const labels = raw.map((value) => fitLine(value || name, photoWidth * 0.85, labelPx, 24))

  const gradients = brandGradients(props)
  const slots = cycleImages(brandImages(props), 3)
  const { text: textColor } = brandPalette(props)
  const rotations = [-5, 0, 5]

  const photos = labels.map((label, i) => ({
    label,
    rotation: rotations[i],
    gradient: gradients[i],
    delay: i * 8,
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
    <RveDesignStage designId="rve-photo-stack" props={props}>
      <PhotoStack
        photos={photos}
        background={sceneBackground(props)}
        offsetXStep={Math.round(30 * f)}
        offsetYStep={Math.round(-10 * f)}
        photoWidth={`${photoWidth}px`}
        photoHeight={`${Math.round(260 * f)}px`}
        photoRadius={`${Math.round(8 * f)}px`}
        photoBorder={`${Math.max(3, Math.round(6 * f))}px solid #ffffff`}
        photoShadow={`0 ${Math.round(8 * f)}px ${Math.round(30 * f)}px rgba(0, 0, 0, 0.4)`}
        iconSize={`${Math.round(50 * f)}px`}
        iconGap={`${Math.round(12 * f)}px`}
        labelColor={textColor}
        labelFontSize={`${labelPx}px`}
        labelWhiteSpace="nowrap"
      />
    </RveDesignStage>
  )
}

export default RvePhotoStackDesign
