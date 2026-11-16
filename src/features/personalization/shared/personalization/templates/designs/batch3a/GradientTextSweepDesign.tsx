/**
 * Adapter for the upstream `gradient-text-sweep` template.
 *
 * Upstream: `src/components/gradient-text-sweep/GradientTextSweep.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream settles an upper-cased headline in, sweeps an accent sheen
 * across the glyphs (`background-clip: text`), draws an underline and raises a
 * spaced sub line. Its headline size is derived from the composition HEIGHT
 * (`0.155 × h`), which overflows a 9:16 canvas, so the adapter overrides the
 * headline / sub-line `font-size` from a stylesheet scoped to this instance
 * when the estimate says the text would not fit. The upstream file is
 * untouched.
 */

import React from 'react'
import { GradientTextSweep } from '../../_upstream/gradient-text-sweep/GradientTextSweep'
import { useDesignFonts } from '../fonts'
import { DesignStage, TRANSPARENT, slotText, slotValue, truncateText, type DesignAdapterProps } from '../shared'
import { ScopedUpstream, brandPalette, fitFontSize, scopeSelector, useScopeId } from './batch3aShared'

const MAX_HEADLINE_LENGTH = 32
const MAX_SUBLINE_LENGTH = 28

export const GradientTextSweepDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()
  const scopeId = useScopeId('gradient-text-sweep')
  const palette = brandPalette(props)

  const headline = truncateText(slotText(props, 'headline', ['offer', 'businessName']), MAX_HEADLINE_LENGTH)
  const subline = truncateText(slotValue(props, 'subline'), MAX_SUBLINE_LENGTH)

  // The upstream's own size formula.
  const title = headline.toUpperCase()
  const baseFont = Math.round(props.height * 0.155)
  const lenAdj = Math.min(1, 14 / Math.max(title.length, 1))
  const upstreamSize = Math.round(baseFont * (0.7 + 0.3 * lenAdj))

  const fitted = fitFontSize(title, {
    maxWidth: props.width * 0.86,
    maxHeight: props.height * 0.5,
    maxSize: upstreamSize,
    advance: 0.72,
    lineHeight: 1.05,
  })
  const sel = scopeSelector(scopeId)
  const wrapper = `${sel} > div:first-child > div:nth-child(2)`
  const sub = Math.round(fitted * 0.2)
  const css =
    fitted < upstreamSize
      ? `${wrapper} > span:first-child { font-size: ${fitted}px !important; }\n` +
        `${wrapper} > span:nth-child(3) { font-size: ${sub}px !important; letter-spacing: ${Math.round(sub * 0.35)}px !important; }`
      : ''

  return (
    <DesignStage designId="gradient-text-sweep" props={props}>
      <ScopedUpstream scopeId={scopeId} css={css}>
        <GradientTextSweep
          backgroundColor={TRANSPARENT}
          accentColor={palette.accent}
          textColor={palette.text}
          headline={headline}
          subline={subline}
        />
      </ScopedUpstream>
    </DesignStage>
  )
}

export default GradientTextSweepDesign
