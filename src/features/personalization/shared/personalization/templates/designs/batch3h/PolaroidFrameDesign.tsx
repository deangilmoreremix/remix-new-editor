/**
 * Adapter for the upstream `rve-polaroid-frame` template (overlay).
 *
 * Upstream: `templates/polaroid-frame.tsx` (remotion-templates, MIT — React
 * Video Editor). An instant-photo print drops in from above and settles at a
 * slight tilt, with a handwritten-style caption.
 *
 * As an overlay the slate canvas is transparent, so the print lands on the
 * customer's video. The photo is the customer's brand image (product →
 * service → logo) or, with no brand media, a brand gradient with the
 * business name; the caption is the business name.
 */

import React from 'react'
import { PolaroidFrame } from '../../_upstream/rve-polaroid-frame/PolaroidFrame'
import { TRANSPARENT, slotText, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  BrandMediaFill,
  brandGradients,
  brandImages,
  brandPalette,
  canvasScale,
  fitLine,
} from './media'

export const RvePolaroidFrameDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = canvasScale(props)
  const photo = Math.round(Math.min(props.width, props.height) * 0.42)
  const pad = Math.round(photo * 0.046)
  const captionPx = Math.round(34 * k)
  const placeholderPx = Math.round(44 * k)

  const image = brandImages(props)[0] ?? null
  const gradients = brandGradients(props)
  const { text: textColor } = brandPalette(props)
  const name = slotText(props, 'businessName', ['headline'])
  const caption = fitLine(name, photo, captionPx, 32)

  return (
    <RveDesignStage designId="rve-polaroid-frame" props={props}>
      <PolaroidFrame
        background={TRANSPARENT}
        dropDistance={Math.round(300 * k)}
        cardPadding={`${pad}px ${pad}px ${pad * 4}px ${pad}px`}
        cardRadius={`${Math.max(2, Math.round(4 * k))}px`}
        cardShadow={`0 ${Math.round(20 * k)}px ${Math.round(60 * k)}px rgba(0, 0, 0, 0.5)`}
        photoWidth={`${photo}px`}
        photoHeight={`${photo}px`}
        photoBackground={gradients[0]}
        caption={caption}
        captionFontSize={`${captionPx}px`}
        captionMarginTop={`${pad}px`}
        captionWhiteSpace="nowrap"
        photoContent={
          <BrandMediaFill
            image={image}
            label={fitLine(name, photo * 0.85, placeholderPx, 24)}
            background={gradients[0]}
            fontSizePx={placeholderPx}
            textColor={textColor}
          />
        }
      />
    </RveDesignStage>
  )
}

export default RvePolaroidFrameDesign
