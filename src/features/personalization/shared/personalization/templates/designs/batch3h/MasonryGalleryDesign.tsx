/**
 * Adapter for the upstream `rve-masonry-gallery` template (full-scene intro).
 *
 * Upstream: `templates/masonry-gallery.tsx` (remotion-templates, MIT — React
 * Video Editor). Six staggered blocks of uneven height spring into three
 * columns.
 *
 * Brand mapping: every block shows a brand image (cycled); with no brand
 * media the blocks are brand gradients and one carries the business name.
 * Portrait formats use two columns of three blocks.
 */

import React from 'react'
import { MasonryGallery } from '../../_upstream/rve-masonry-gallery/MasonryGallery'
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

/** The upstream's three-column layout (column, height, delay). */
const LANDSCAPE_LAYOUT = [
  { col: 0, height: '45%', delay: 0 },
  { col: 0, height: '50%', delay: 6 },
  { col: 1, height: '55%', delay: 3 },
  { col: 1, height: '40%', delay: 9 },
  { col: 2, height: '40%', delay: 5 },
  { col: 2, height: '55%', delay: 11 },
]

/** Two columns of three for 9:16 / 4:5. */
const PORTRAIT_LAYOUT = [
  { col: 0, height: '30%', delay: 0 },
  { col: 0, height: '36%', delay: 6 },
  { col: 0, height: '28%', delay: 10 },
  { col: 1, height: '36%', delay: 3 },
  { col: 1, height: '26%', delay: 8 },
  { col: 1, height: '32%', delay: 12 },
]

export const RveMasonryGalleryDesign: React.FC<DesignAdapterProps> = (props) => {
  const k = canvasScale(props)
  const portrait = isPortrait(props)
  const layout = portrait ? PORTRAIT_LAYOUT : LANDSCAPE_LAYOUT
  const columnCount = portrait ? 2 : 3
  const gap = Math.round(16 * k)

  const gradients = brandGradients(props)
  const slots = cycleImages(brandImages(props), layout.length)
  const { text: textColor } = brandPalette(props)

  const colWidth = (props.width * 0.9 - gap * (columnCount - 1)) / columnCount
  const labelPx = Math.round(40 * k)
  const label = fitLine(slotText(props, 'businessName', ['headline']), colWidth * 0.85, labelPx, 32)
  // The placeholder name sits on the tallest block of the middle column
  // (landscape) / the first block (portrait).
  const labelIndex = portrait ? 0 : 2

  const blocks = layout.map((item, i) => ({
    ...item,
    gradient: gradients[i],
    content: (
      <BrandMediaFill
        image={slots[i]}
        label={label}
        background={gradients[i]}
        fontSizePx={labelPx}
        textColor={textColor}
        showLabel={i === labelIndex}
      />
    ),
  }))

  return (
    <RveDesignStage designId="rve-masonry-gallery" props={props}>
      <MasonryGallery
        blocks={blocks}
        columnCount={columnCount}
        background={sceneBackground(props)}
        padding={`${Math.round(32 * k)}px`}
        gap={`${gap}px`}
        borderRadius={`${Math.round(14 * k)}px`}
      />
    </RveDesignStage>
  )
}

export default RveMasonryGalleryDesign
