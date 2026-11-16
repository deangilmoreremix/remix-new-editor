/**
 * Adapter for the upstream `rve-picture-in-picture` template (overlay).
 *
 * Upstream: `templates/picture-in-picture.tsx` (remotion-templates, MIT —
 * React Video Editor). A "Main Content" panel fills the frame and a small
 * "Speaker" inset springs in at the bottom-right corner.
 *
 * As an overlay the customer's video IS the main content: the main panel and
 * the canvas are transparent and the "Main Content" placeholder is dropped.
 * The inset shows the customer's brand image (product → service → logo) with
 * the business name as its caption; with no brand media it is a brand
 * gradient with the business name centred, exactly like the upstream inset.
 */

import React from 'react'
import { PictureInPicture } from '../../_upstream/rve-picture-in-picture/PictureInPicture'
import { TRANSPARENT, slotText, type DesignAdapterProps } from '../shared'
import { RveDesignStage, withAlpha } from '../rveSharedDesign'
import {
  BrandMediaFill,
  brandGradients,
  brandImages,
  brandPalette,
  canvasScale,
  fitLine,
} from './media'

export const RvePictureInPictureDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = canvasScale(props)
  const short = Math.min(props.width, props.height)
  const pipWidth = Math.round(Math.max(props.width * 0.25, short * 0.36))
  const pipHeight = Math.round(pipWidth * 0.72)
  const margin = Math.round(short * 0.045)
  const labelPx = Math.round(Math.max(18, pipWidth * 0.075))

  const image = brandImages(props)[0] ?? null
  const gradients = brandGradients(props)
  const { text: textColor } = brandPalette(props)
  const label = fitLine(
    slotText(props, 'businessName', ['headline']),
    pipWidth * 0.86,
    labelPx,
    32,
  )

  return (
    <RveDesignStage designId="rve-picture-in-picture" props={props}>
      <PictureInPicture
        background={TRANSPARENT}
        mainBackground={TRANSPARENT}
        showMainLabel={false}
        pipBottom={`${margin}px`}
        pipRight={`${margin}px`}
        pipWidth={`${pipWidth}px`}
        pipHeight={`${pipHeight}px`}
        pipBackground={gradients[0]}
        pipRadius={`${Math.round(14 * k)}px`}
        pipBorder={`${Math.max(2, Math.round(3 * k))}px solid ${withAlpha(textColor, 0.35)}`}
        pipShadow={`0 ${Math.round(10 * k)}px ${Math.round(36 * k)}px rgba(0, 0, 0, 0.45)`}
        pipLabel={label}
        pipLabelColor={textColor}
        pipLabelFontSize={`${labelPx}px`}
        pipLabelShadow="0 2px 8px rgba(0,0,0,0.6)"
        pipLabelWhiteSpace="nowrap"
        pipAlignItems={image ? 'flex-end' : 'center'}
        pipPadding={image ? `${Math.round(labelPx * 0.6)}px` : undefined}
        pipContent={
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

export default RvePictureInPictureDesign
