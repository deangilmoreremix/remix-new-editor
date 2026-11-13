/**
 * Adapter for the upstream `rve-sound-wave` template.
 *
 * Upstream: `templates/sound-wave.tsx` (remotion-templates, MIT — React Video
 * Editor, no named copyright holder). A row of forty rounded bars bounces like
 * an audio visualiser (a sine wave plus seeded jitter — deterministic, it is
 * not driven by real audio).
 *
 * OVERLAY: the upstream paints no fill of its own, but it does apply a
 * full-canvas `backdrop-filter: blur(8px)` and a blue inset glow — over a
 * video that would blur and tint the customer's footage. Both are switched
 * off (`none`), so only the bars sit over the video.
 *
 * Brand mapping: bars in the brand primary with an accent glow. The upstream
 * sizes the bars in fixed px for a 1920-wide frame; the adapter scales the
 * width, gap, radius and height so the wave spans ~85 % of the canvas width on
 * every format.
 */

import React from 'react'
import { SoundWave } from '../../_upstream/rve-sound-wave/SoundWave'
import { type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import { brandAccent, brandPrimary, rgba } from './shared3f'

/** Upstream wave footprint: 40 x (12 px bar + 4 px gap), up to 150 px tall. */
const WAVE_W = 640
const WAVE_H = 150

export const RveSoundWaveDesign: React.FC<DesignAdapterProps> = (props) => {
  const width = Math.max(1, props.width)
  const height = Math.max(1, props.height)
  const k = Math.max(0.2, Math.min((width * 0.85) / WAVE_W, (height * 0.5) / WAVE_H))
  const px = (value: number) => `${Math.round(value * k * 100) / 100}px`

  return (
    <RveDesignStage designId="rve-sound-wave" props={props}>
      <SoundWave
        barWidth={px(12)}
        gap={px(4)}
        barRadius={px(6)}
        amplitude={100 * k}
        jitter={50 * k}
        barColor={brandPrimary(props)}
        barGlow={`0 0 ${px(10)} ${rgba(brandAccent(props), 0.6)}`}
        backdropFilter="none"
        insetGlow="none"
      />
    </RveDesignStage>
  )
}

export default RveSoundWaveDesign
