/**
 * Adapter for the upstream `camera-shake` template.
 *
 * Upstream: `src/components/camera-shake/CameraShake.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * An impact-driven full-frame shake: the title card fades in, an impact at
 * 0.9 s fires radial accent rays, a white flash and a decaying shake.
 *
 * NOT A TWO-CLIP TRANSITION: the upstream shakes its OWN title card over a
 * hard-coded black root, so it cannot shake the customer's video. It is
 * adapted as an impact title intro: the headline in an accent frame with the
 * business name beneath, on a deep shade of the brand primary; after the
 * shake settles the card dissolves into the video (frames 78-90, layer ends
 * at 90). The first 10 frames fade up from the upstream's black root.
 *
 * The title uses the upstream's fixed 124 px (84 px below 1920 px wide) inside
 * a padded box and wraps; it is fitted to two lines, the subtitle to one.
 */

import React from 'react'
import { CameraShake } from '../../_upstream/camera-shake/CameraShake'
import { DesignStage, pickColor, slotText, slotValue, type DesignAdapterProps } from '../shared'
import { FadeOut, charsPerLine, ensureDark, ensureLight, fitWords, hex6, mix } from './shared'

export const CAMERA_SHAKE_FADE_START = 78
export const CAMERA_SHAKE_END_FRAME = 90

export const CameraShakeDesign: React.FC<DesignAdapterProps> = (props) => {
  const wide = props.width >= 1920
  const titlePerLine = charsPerLine(props.width - 300, wide ? 124 : 84, { safe: 0.95, advanceEm: 0.68, letterSpacing: 6 })
  const subPerLine = charsPerLine(props.width, wide ? 36 : 28, { safe: 0.85, letterSpacing: 3 })

  const primary = hex6(props.colors?.primary, '#111827')
  const accent = ensureLight(hex6(pickColor([props.colors?.accent, props.colors?.primary]), '#f59e0b'), 0.25)

  return (
    <DesignStage designId="camera-shake" props={props}>
      <FadeOut from={CAMERA_SHAKE_FADE_START} to={CAMERA_SHAKE_END_FRAME}>
        <CameraShake
          title={fitWords(slotText(props, 'headline', ['businessName']), titlePerLine, 2)}
          subtitle={fitWords(slotValue(props, 'businessName'), subPerLine, 1) || undefined}
          background={ensureDark(mix(primary, '#000000', 0.55), 0.05)}
          textColor={pickColor([props.color, props.colors?.text], '#fef3c7')}
          accentColor={accent}
          maxIntensity={28}
          impactAt={0.9}
          shakeDuration={1.6}
        />
      </FadeOut>
    </DesignStage>
  )
}

export default CameraShakeDesign
