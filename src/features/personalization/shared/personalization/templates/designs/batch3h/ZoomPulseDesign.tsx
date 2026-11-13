/**
 * Adapter for the upstream `rve-zoom-pulse` template (full-scene intro).
 *
 * Upstream: `templates/zoom-pulse.tsx` (remotion-templates, MIT — React Video
 * Editor). One full-frame photo breathes in and out (1x → 1.1x → 1x).
 *
 * Brand mapping: the photo is the customer's product (or service) image; a
 * logo-only brand gets its logo on a brand gradient and a brand with no
 * media gets a brand gradient with the business name — all pulse the same
 * way. The upstream's remote pexels default is NEVER reached: the adapter
 * always passes a brand URL or `null`.
 */

import React from 'react'
import { ZoomPulse } from '../../_upstream/rve-zoom-pulse/ZoomPulse'
import { darkenColor, slotText, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  BrandMediaFill,
  brandImages,
  brandPalette,
  canvasScale,
  fitLine,
  isPhoto,
  sceneBackground,
} from './media'

export const RveZoomPulseDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = canvasScale(props)
  const image = brandImages(props)[0] ?? null
  const { primary, text: textColor } = brandPalette(props)
  const labelPx = Math.round(96 * k)
  const label = fitLine(
    slotText(props, 'businessName', ['headline']),
    props.width * 0.8,
    labelPx,
    32,
  )

  return (
    <RveDesignStage designId="rve-zoom-pulse" props={props}>
      <ZoomPulse
        imageUrl={isPhoto(image) ? image.url : null}
        duration={4}
        minScale={1}
        maxScale={1.1}
        background={darkenColor(primary, 0.15)}
        fallback={
          <BrandMediaFill
            image={image}
            label={label}
            background={sceneBackground(props)}
            fontSizePx={labelPx}
            textColor={textColor}
          />
        }
      />
    </RveDesignStage>
  )
}

export default RveZoomPulseDesign
