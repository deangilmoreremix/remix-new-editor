/**
 * Adapter for the upstream `parallax-pan` template (batch 3c, repo 1 — not
 * the repo-2 photo pan of the same name).
 *
 * Upstream: `src/components/parallax-pan/ParallaxPan.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * Far mountains, mid hills, the foreground and a row of trees pan at
 * different speeds under a sky gradient and a sun, with the headline centred
 * on top. Everything is inline SVG/CSS — no images, no network.
 *
 * CATEGORY `full-scene`: the landscape IS the design, so it keeps its
 * background, driven by the brand: the sky runs from a deep shade of the
 * primary down to the accent (a branded "sunset"), and the three ridges are
 * progressively deeper shades of the primary. The upstream's trees keep their
 * hard-coded greens. It plays as an intro card (`placement.endFrame`); the
 * upstream reads `durationInFrames` from `useVideoConfig()`, which inside the
 * layer's Sequence is the card's own length, so the pan spans the card.
 *
 * TEXT: headline (title) and business name (subtitle). The upstream wraps the
 * text (72 px below 1920 px width, 108 px at 1920), so both are capped.
 */

import React from 'react'
import { ParallaxPan } from '../../_upstream/parallax-pan/ParallaxPan'
import { DesignStage, pickColor, slotText, slotValue, truncateText, type DesignAdapterProps } from '../shared'
import { readableOnDark, shade, toHex6 } from './batch3cShared'

const MAX_TITLE_LENGTH = 40
const MAX_SUBTITLE_LENGTH = 56

export const ParallaxPanDesign: React.FC<DesignAdapterProps> = (props) => {
  const primary = toHex6(props.colors?.primary, '#1e3a8a')
  const accent = toHex6(props.colors?.accent, '#f59e0b')

  return (
    <DesignStage designId="parallax-pan" props={props}>
      <ParallaxPan
        title={truncateText(slotText(props, 'title', ['businessName']), MAX_TITLE_LENGTH)}
        subtitle={truncateText(slotValue(props, 'subtitle'), MAX_SUBTITLE_LENGTH)}
        skyTop={shade(primary, 0.45)}
        skyBottom={accent}
        mountainColor={shade(primary, 0.32)}
        hillColor={shade(primary, 0.22)}
        groundColor={shade(primary, 0.1)}
        textColor={readableOnDark(pickColor([props.color, props.colors?.text], '#fef3c7'))}
        panDistance={600}
      />
    </DesignStage>
  )
}

export default ParallaxPanDesign
