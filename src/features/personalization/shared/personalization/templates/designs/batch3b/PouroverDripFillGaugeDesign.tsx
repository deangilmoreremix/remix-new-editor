/**
 * Adapter for the upstream `pourover-drip-fill-gauge` template.
 *
 * Upstream: `src/components/pourover-drip-fill-gauge/PouroverDripFillGauge.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * A pixel-art pour-over: water drips through a cone and fills a carafe while
 * a "VOLUME" readout counts up to 100 % and a gauge bar fills. One progress
 * value drives everything; it is a self-running animation, not customer data.
 *
 * The upstream paints its darkest tone over the whole canvas, so this is a
 * data-visualization card that plays as an intro. The four tones are derived
 * from the brand: background and body from the primary, the liquid from the
 * primary and the highlights / readout from the accent. `fillSpeed` is
 * shortened from 0.78 to 0.6 so the carafe is full by frame 108 and the card
 * holds briefly before revealing the video at frame 150.
 */

import React from 'react'
import { PouroverDripFillGauge } from '../../_upstream/pourover-drip-fill-gauge/PouroverDripFillGauge'
import { DesignStage, pickColor, type DesignAdapterProps } from '../shared'
import { ensureDark, ensureLight, hex6, mix } from './shared'

export const POUROVER_FILL_SPEED = 0.6

export const PouroverDripFillGaugeDesign: React.FC<DesignAdapterProps> = (props) => {
  const primary = hex6(props.colors?.primary, '#29d3f2')
  const accent = hex6(pickColor([props.colors?.accent, props.colors?.primary]), '#28c98b')
  const toneBg = ensureDark(mix(primary, '#000000', 0.85), 0.03)
  const toneDark = mix(primary, '#000000', 0.5)
  const toneMid = ensureLight(primary, 0.18)
  const toneLight = ensureLight(mix(accent, '#ffffff', 0.35), 0.5)

  return (
    <DesignStage designId="pourover-drip-fill-gauge" props={props}>
      <PouroverDripFillGauge
        toneBg={toneBg}
        toneDark={toneDark}
        toneMid={toneMid}
        toneLight={toneLight}
        fillSpeed={POUROVER_FILL_SPEED}
        showDrips
      />
    </DesignStage>
  )
}

export default PouroverDripFillGaugeDesign
