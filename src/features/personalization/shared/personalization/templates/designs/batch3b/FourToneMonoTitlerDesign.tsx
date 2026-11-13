/**
 * Adapter for the upstream `four-tone-mono-titler` template.
 *
 * Upstream: `src/components/four-tone-mono-titler/FourToneMonoTitler.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * A handheld-console style title card: a strictly four-tone pixel scene whose
 * lower-third panel wipes in from the left, then a highlight shimmers across
 * the title. The upstream paints its darkest tone over the WHOLE canvas (a
 * `<rect>` inside the frozen SVG), so it cannot be an overlay — it is a
 * full-scene intro card. The four tones are derived from the brand primary
 * (screen) and the brand accent (type), so the card stays strictly four-tone.
 *
 * Text is drawn with the pixel-kit 5x7 bitmap font, which never wraps: the
 * title (4 internal px per dot) is cut to 17 characters and the subtitle
 * (2 px per dot) to 34 so neither leaves the 480x270 internal canvas.
 */

import React from 'react'
import { FourToneMonoTitler } from '../../_upstream/four-tone-mono-titler/FourToneMonoTitler'
import { DesignStage, pickColor, slotText, slotValue, type DesignAdapterProps } from '../shared'
import { bitmapSafe, ensureDark, ensureLight, hex6, mix } from './shared'

export const FOUR_TONE_TITLE_MAX = 17
export const FOUR_TONE_SUBTITLE_MAX = 34

export const FourToneMonoTitlerDesign: React.FC<DesignAdapterProps> = (props) => {
  const primary = hex6(props.colors?.primary, '#29d3f2')
  const accent = hex6(pickColor([props.colors?.accent, props.colors?.primary]), '#28c98b')
  const tone0 = ensureDark(mix(primary, '#000000', 0.8), 0.04)
  const tone1 = mix(primary, '#000000', 0.5)
  const tone2 = ensureLight(accent, 0.3)
  const tone3 = ensureLight(mix(tone2, '#ffffff', 0.5), 0.6)

  const title = bitmapSafe(slotText(props, 'headline', ['businessName']), FOUR_TONE_TITLE_MAX)
  const subtitle = bitmapSafe(slotValue(props, 'businessName'), FOUR_TONE_SUBTITLE_MAX)

  return (
    <DesignStage designId="four-tone-mono-titler" props={props} stageStyle={{ backgroundColor: tone0 }}>
      <FourToneMonoTitler
        title={title.toUpperCase()}
        subtitle={subtitle.toUpperCase()}
        tone0={tone0}
        tone1={tone1}
        tone2={tone2}
        tone3={tone3}
        titleCell={4}
        subtitleCell={2}
        wipeFrames={60}
        shimmerSpeed={3.2}
        ditherDensity={0.6}
        showAmbient
      />
    </DesignStage>
  )
}

export default FourToneMonoTitlerDesign
