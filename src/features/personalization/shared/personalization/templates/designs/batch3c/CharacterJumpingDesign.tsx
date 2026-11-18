/**
 * Adapter for the upstream `character-jumping` template (batch 3c).
 *
 * Upstream: `src/components/character-jumping/CharacterJumping.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * A cartoon character jumps three times with squash-and-stretch, sparkles at
 * the apex, and a label rises in underneath.
 *
 * CATEGORY `full-scene`: the sky/ground backdrop IS the design, so it keeps a
 * designed background — a pale tint of the brand primary with a slightly
 * deeper ground strip — and plays as an intro card (`placement.endFrame`).
 * The character is the brand primary, its shadow/pupils a deep shade of it,
 * the sparkles the brand accent.
 *
 * TEXT: the label is the customer's headline. The upstream sizes it
 * `0.065 x shortSide` with no width limit, so it is truncated to what fits
 * 90 % of the canvas width.
 */

import React from 'react'
import { CharacterJumping } from '../../_upstream/character-jumping/CharacterJumping'
import { DesignStage, slotText, truncateText, type DesignAdapterProps } from '../shared'
import { fitChars, shade, shortSide, tint, toHex6 } from './batch3cShared'

export const CharacterJumpingDesign: React.FC<DesignAdapterProps> = (props) => {
  const s = shortSide(props)
  const primary = toHex6(props.colors?.primary, '#0ea5e9')
  const accent = toHex6(props.colors?.accent, '#fbbf24')
  const label = truncateText(
    slotText(props, 'label', ['cta', 'businessName']),
    Math.min(32, fitChars(props.width * 0.9, s * 0.065, 0.62)),
  )

  return (
    <DesignStage designId="character-jumping" props={props}>
      <CharacterJumping
        backgroundColor={tint(primary, 0.86)}
        characterColor={primary}
        shadowColor={shade(primary, 0.45)}
        accentColor={accent}
        groundColor={tint(primary, 0.7)}
        label={label}
        textColor={shade(primary, 0.35)}
        jumpCount={3}
      />
    </DesignStage>
  )
}

export default CharacterJumpingDesign
