/**
 * Adapter for the upstream `rve-ken-burns` template (full-scene intro).
 *
 * Upstream: `templates/ken-burns.tsx` (remotion-templates, MIT — React Video
 * Editor). A slow, eased push-in and drift across one full-frame photo.
 *
 * Brand mapping: the photo is the customer's product (or service) image. A
 * logo-only brand gets its logo contained on a brand gradient, and a brand
 * with no media gets a brand gradient carrying the business name — both
 * drift with the same Ken Burns move. The upstream's remote unsplash default
 * is NEVER reached: the adapter always passes a brand URL or `null`.
 *
 * The upstream's 20-second move is retimed to the intro's 5 seconds with a
 * gentler 1.25x end scale so the push-in is visible before the card ends.
 */

import React from 'react'
import { KenBurns } from '../../_upstream/rve-ken-burns/KenBurns'
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

/** The design's natural length in seconds (= `placement.endFrame` at 30 fps). */
export const KEN_BURNS_SECONDS = 5

export const RveKenBurnsDesign: React.FC<DesignAdapterProps> = (props) => {
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
    <RveDesignStage designId="rve-ken-burns" props={props}>
      <KenBurns
        imageUrl={isPhoto(image) ? image.url : null}
        duration={KEN_BURNS_SECONDS}
        scale={1.25}
        translateX={Math.round(-50 * k)}
        translateY={Math.round(-30 * k)}
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

export default RveKenBurnsDesign
