/**
 * Adapter for the upstream `scramble-text` template.
 *
 * Upstream: `src/components/scramble-text/ScrambleText.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * A bracketed label fades in, then the headline "decrypts" left to right
 * through a scrambling charset (seeded, deterministic) and blooms a glow.
 *
 * NOT SWITCHABLE BY PROPS: the upstream paints its root with
 * `backgroundImage: linear-gradient(background → shiftLightness(background, 8))`
 * plus faint scanlines. `shiftLightness("transparent")` yields `#000000`, so
 * even a transparent `background` fades to opaque black. The adapter clears
 * the root's `background-image` from a stylesheet scoped to this instance (a
 * composition workaround — the upstream file is untouched), which makes the
 * design a true overlay. The headline is a fixed 180 px; the same stylesheet
 * shrinks it when it would not fit the canvas.
 */

import React from 'react'
import { ScrambleText } from '../../_upstream/scramble-text/ScrambleText'
import { useDesignFonts } from '../fonts'
import { DesignStage, TRANSPARENT, slotText, slotValue, truncateText, type DesignAdapterProps } from '../shared'
import { ScopedUpstream, brandPalette, fitFontSize, scopeSelector, useScopeId } from './batch3aShared'

const MAX_TEXT_LENGTH = 32
const MAX_LABEL_LENGTH = 24
const UPSTREAM_FONT_SIZE = 180
/** The upstream's own charset (a motion constant, not demo copy). */
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*+=?/<>'

export const ScrambleTextDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()
  const scopeId = useScopeId('scramble-text')
  const palette = brandPalette(props)

  const text = truncateText(slotText(props, 'text', ['offer', 'businessName']), MAX_TEXT_LENGTH)
  const label = truncateText(slotValue(props, 'label'), MAX_LABEL_LENGTH).toUpperCase()

  const fitted = fitFontSize(text, {
    maxWidth: props.width * 0.9 - 96,
    maxHeight: props.height * 0.55,
    maxSize: UPSTREAM_FONT_SIZE,
    advance: 0.66,
    lineHeight: 1.25,
  })
  const sel = scopeSelector(scopeId)
  const css =
    `${sel} > div:first-child { background-image: none !important; background-color: transparent !important; }` +
    (fitted < UPSTREAM_FONT_SIZE ? `\n${sel} > div:first-child span { font-size: ${fitted}px !important; }` : '')

  return (
    <DesignStage designId="scramble-text" props={props}>
      <ScopedUpstream scopeId={scopeId} css={css}>
        <ScrambleText
          text={text}
          label={label || undefined}
          background={TRANSPARENT}
          textColor={palette.text}
          labelColor={palette.accent}
          scrambleDuration={60}
          charset={CHARSET}
        />
      </ScopedUpstream>
    </DesignStage>
  )
}

export default ScrambleTextDesign
