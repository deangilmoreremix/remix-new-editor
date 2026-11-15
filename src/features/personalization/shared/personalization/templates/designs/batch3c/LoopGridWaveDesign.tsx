/**
 * Adapter for the upstream `loop-grid-wave` template (batch 3c).
 *
 * Upstream: `src/components/loop-grid-wave/LoopGridWave.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * An 18 x 12 grid of dots swells and dims in a diagonal wave; frame 0 and
 * frame 90 are identical, so the loop is seamless for any clip length.
 *
 * OVERLAY (`visual-effect`): the upstream's `backgroundColor` is a plain
 * canvas fill, so it is forced to `transparent` and the dots ripple over the
 * customer's video. Resting dots are the brand primary, wave crests the
 * accent. The grid is laid out against the composition, so every aspect ratio
 * gets a full grid. Textless.
 */

import React from 'react'
import { LoopGridWave } from '../../_upstream/loop-grid-wave/LoopGridWave'
import { DesignStage, TRANSPARENT, pickColor, type DesignAdapterProps } from '../shared'

export const LoopGridWaveDesign: React.FC<DesignAdapterProps> = (props) => (
  <DesignStage designId="loop-grid-wave" props={props}>
    <LoopGridWave
      backgroundColor={TRANSPARENT}
      dotColor={pickColor([props.colors?.primary], '#334155')}
      accentColor={pickColor([props.colors?.accent, props.colors?.text], '#38bdf8')}
      amplitude={1}
      speed={1}
    />
  </DesignStage>
)

export default LoopGridWaveDesign
