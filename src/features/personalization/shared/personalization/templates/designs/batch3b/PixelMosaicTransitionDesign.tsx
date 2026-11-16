/**
 * Adapter for the upstream `pixel-mosaic-transition` template.
 *
 * Upstream: `src/components/pixel-mosaic-transition/PixelMosaicTransition.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream is a two-screen stinger: screen A (a procedurally drawn day
 * scene) coarsens into ever larger pixel blocks, swaps to screen B (night) at
 * peak coarseness (frame 45) and refines again. Both screens are opaque
 * procedural fields, so neither can be made transparent through props.
 *
 * INTRO-REVEAL ADAPTATION: screen A is painted in the brand colours (sky =
 * primary, sun = accent). It plays verbatim until the swap; from the swap on
 * the upstream is frozen on its last screen-A frame (peak coarseness) and the
 * chunky mosaic dissolves away over 12 frames, revealing the customer's video
 * where the upstream would have revealed screen B. Screen B is never shown.
 *
 * LEAD-IN: during its first frames the upstream samples the scene at a block
 * size of 1-3 internal px, i.e. up to 480x270 = 129,600 SVG <rect>s per frame,
 * which stalls a browser preview. The adapter starts the upstream 8 frames in
 * (block size ~4, ~8,000 rects), so the card opens already in chunky pixel-art
 * and the swap lands at layer frame 37.
 */

import React from 'react'
import { Freeze, Sequence, useCurrentFrame } from 'remotion'
import { PixelMosaicTransition } from '../../_upstream/pixel-mosaic-transition/PixelMosaicTransition'
import { DesignStage, pickColor, type DesignAdapterProps } from '../shared'
import { FadeOut, ensureDark, ensureLight, hex6, mix } from './shared'

/** Upstream frames skipped at the start (see LEAD-IN above). */
export const MOSAIC_LEAD_IN = 8
/** The upstream swaps A -> B at its frame 45 (DURATION_FRAMES / 2). */
export const MOSAIC_SWAP_FRAME = 45 - MOSAIC_LEAD_IN
export const MOSAIC_FADE_FRAMES = 12
export const MOSAIC_END_FRAME = MOSAIC_SWAP_FRAME + MOSAIC_FADE_FRAMES

export const PixelMosaicTransitionDesign: React.FC<DesignAdapterProps> = (props) => {
  const frame = useCurrentFrame()
  const primary = hex6(props.colors?.primary, '#29d3f2')
  const accent = ensureLight(hex6(pickColor([props.colors?.accent, props.colors?.primary]), '#28c98b'), 0.4)
  const dark = ensureDark(mix(primary, '#000000', 0.8), 0.04)

  return (
    <DesignStage designId="pixel-mosaic-transition" props={props}>
      <FadeOut from={MOSAIC_SWAP_FRAME} to={MOSAIC_END_FRAME}>
        <Freeze frame={MOSAIC_SWAP_FRAME - 1} active={frame >= MOSAIC_SWAP_FRAME}>
          <Sequence from={-MOSAIC_LEAD_IN} layout="none" name="mosaic-lead-in">
            <PixelMosaicTransition
              backgroundColor={dark}
              screenAColor={primary}
              screenAAccent={accent}
              screenBColor={dark}
              screenBAccent={accent}
              maxCell={48}
              ditherOpacity={0.08}
            />
          </Sequence>
        </Freeze>
      </FadeOut>
    </DesignStage>
  )
}

export default PixelMosaicTransitionDesign
