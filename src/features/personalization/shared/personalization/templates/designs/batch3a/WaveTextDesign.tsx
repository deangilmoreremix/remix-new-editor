/**
 * Adapter for the upstream `wave-text` template.
 *
 * Upstream: `src/components/wave-text/WaveText.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * Every character of the headline rides a sine wave (per-character phase),
 * then a spaced sub line slides up.
 *
 * NOT SWITCHABLE BY PROPS: the root's fill is
 * `linear-gradient(background → shade(background, -15))`; `shade()` turns
 * `"transparent"` into `#000000`, so the canvas would fade to opaque black.
 * The adapter clears the root `background` from a stylesheet scoped to this
 * instance (composition workaround, upstream untouched). The headline is a
 * fixed 140 px `inline-flex` row that never wraps, so the same stylesheet
 * shrinks it to the canvas width, and the wave amplitude scales with it.
 */

import React from 'react'
import { WaveText } from '../../_upstream/wave-text/WaveText'
import { useDesignFonts } from '../fonts'
import { DesignStage, TRANSPARENT, slotText, slotValue, truncateText, type DesignAdapterProps } from '../shared'
import { ScopedUpstream, brandPalette, fitFontSize, mixHex, scopeSelector, useScopeId } from './batch3aShared'

const MAX_TEXT_LENGTH = 28
const MAX_SUB_LENGTH = 40
const UPSTREAM_FONT_SIZE = 140
const UPSTREAM_AMPLITUDE = 18

export const WaveTextDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()
  const scopeId = useScopeId('wave-text')
  const palette = brandPalette(props)

  const text = truncateText(slotText(props, 'text', ['offer', 'businessName']), MAX_TEXT_LENGTH)
  const subText = truncateText(slotValue(props, 'subText'), MAX_SUB_LENGTH)

  const fitted = fitFontSize(text, {
    maxWidth: props.width * 0.9,
    maxSize: UPSTREAM_FONT_SIZE,
    advance: 0.64,
    wrap: false,
  })
  const sel = scopeSelector(scopeId)
  const css =
    `${sel} > div:first-child { background: transparent !important; }` +
    (fitted < UPSTREAM_FONT_SIZE
      ? `\n${sel} > div:first-child > span:first-child { font-size: ${fitted}px !important; }`
      : '')

  return (
    <DesignStage designId="wave-text" props={props}>
      <ScopedUpstream scopeId={scopeId} css={css}>
        <WaveText
          text={text}
          subText={subText || undefined}
          background={TRANSPARENT}
          textColor={palette.text}
          subTextColor={mixHex(palette.accent, '#ffffff', 0.25)}
          amplitude={Math.max(6, Math.round((UPSTREAM_AMPLITUDE * fitted) / UPSTREAM_FONT_SIZE))}
          waveSpeed={28}
          wavelength={0.55}
        />
      </ScopedUpstream>
    </DesignStage>
  )
}

export default WaveTextDesign
