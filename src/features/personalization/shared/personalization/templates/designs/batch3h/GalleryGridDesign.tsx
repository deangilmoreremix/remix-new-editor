/**
 * Adapter for the upstream `rve-gallery-grid` template (full-scene intro).
 *
 * Upstream: `templates/gallery-grid.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder). Six tiles spring into a 3x2 grid.
 *
 * Brand mapping: every tile shows a brand image (product → service → logo,
 * cycled); with no brand media the tiles are brand-colour gradients and one
 * of them carries the business name. The slate background becomes a deep
 * brand-tinted gradient. Portrait formats flip the grid to 2x3.
 */

import React from 'react'
import { GalleryGrid } from '../../_upstream/rve-gallery-grid/GalleryGrid'
import { slotText, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  BrandMediaFill,
  brandGradients,
  brandImages,
  brandPalette,
  canvasScale,
  cycleImages,
  fitLine,
  isPortrait,
  sceneBackground,
} from './media'

export const RveGalleryGridDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = canvasScale(props)
  const portrait = isPortrait(props)
  const cols = portrait ? 2 : 3
  const rows = portrait ? 3 : 2
  const gap = Math.round(16 * k)
  const padding = Math.round(32 * k)

  const gradients = brandGradients(props)
  const slots = cycleImages(brandImages(props), 6)
  const { text: textColor } = brandPalette(props)

  const tileWidth = (props.width * 0.9 - gap * (cols - 1)) / cols
  const labelPx = Math.round(40 * k)
  const label = fitLine(slotText(props, 'businessName', ['headline']), tileWidth * 0.85, labelPx, 32)
  // The placeholder name goes on ONE tile (the top-centre one in 3x2, the
  // middle-left one in 2x3) so the grid reads as a designed card, not a list.
  const labelIndex = portrait ? 2 : 1

  const cells = gradients.map((gradient, i) => ({
    gradient,
    delay: i * 4,
    content: (
      <BrandMediaFill
        image={slots[i]}
        label={label}
        background={gradient}
        fontSizePx={labelPx}
        textColor={textColor}
        showLabel={i === labelIndex}
      />
    ),
  }))

  return (
    <RveDesignStage designId="rve-gallery-grid" props={props}>
      <GalleryGrid
        cells={cells}
        background={sceneBackground(props)}
        padding={`${padding}px`}
        gap={`${gap}px`}
        gridTemplateColumns={Array(cols).fill('1fr').join(' ')}
        gridTemplateRows={Array(rows).fill('1fr').join(' ')}
        borderRadius={`${Math.round(14 * k)}px`}
      />
    </RveDesignStage>
  )
}

export default RveGalleryGridDesign
