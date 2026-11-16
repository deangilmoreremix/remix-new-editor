/**
 * Adapter for the upstream `pixel-waterfall-cycle` template.
 *
 * Upstream: `src/components/pixel-waterfall-cycle/PixelWaterfallCycle.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * A pixel-art waterfall animated purely by colour cycling, framed by cliffs,
 * with foam spray and mist. The scene is drawn at 360x640 (portrait) and
 * paints the whole canvas, so it is a full-scene intro card. In 9:16 it fills
 * the frame; in landscape/square the upstream's own `PixelStage` letterboxes
 * it as a centred portrait panel on the sky colour.
 *
 * Brand mapping: the sky is a deep shade of the primary, the cliffs a darker
 * one, the foam a pale tint of the accent. The water itself cycles through
 * the upstream's fixed WATER_RAMP (a pixel-kit constant, not a prop).
 */

import React from 'react'
import { PixelWaterfallCycle } from '../../_upstream/pixel-waterfall-cycle/PixelWaterfallCycle'
import { DesignStage, pickColor, type DesignAdapterProps } from '../shared'
import { ensureDark, ensureLight, hex6, mix } from './shared'

export const PixelWaterfallCycleDesign: React.FC<DesignAdapterProps> = (props) => {
  const primary = hex6(props.colors?.primary, '#29d3f2')
  const accent = hex6(pickColor([props.colors?.accent, props.colors?.primary]), '#28c98b')

  return (
    <DesignStage designId="pixel-waterfall-cycle" props={props}>
      <PixelWaterfallCycle
        backgroundColor={ensureDark(mix(primary, '#000000', 0.7), 0.05)}
        accentColor={ensureLight(mix(accent, '#ffffff', 0.7), 0.7)}
        cliffColor={ensureDark(mix(primary, '#000000', 0.8), 0.03)}
        cycleSpeed={0.2}
        showMist
      />
    </DesignStage>
  )
}

export default PixelWaterfallCycleDesign
