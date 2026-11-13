/**
 * Adapter for the upstream `kinetic-word-stack` template.
 *
 * Upstream: `src/components/kinetic-word-stack/KineticWordStack.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream drops one upper-cased word per beat into a centred vertical
 * stack; the last word lands in the accent colour. The adapter splits the
 * customer's headline into at most five lines (grouping words when there are
 * more) and, because the upstream sizes each line from the composition HEIGHT,
 * overrides the word `font-size` from a stylesheet scoped to this instance
 * when the longest line would not fit the canvas width (9:16).
 */

import React from 'react'
import { KineticWordStack } from '../../_upstream/kinetic-word-stack/KineticWordStack'
import { useDesignFonts } from '../fonts'
import { DesignStage, TRANSPARENT, slotText, truncateText, type DesignAdapterProps } from '../shared'
import { ScopedUpstream, brandPalette, fitFontSize, scopeSelector, useScopeId } from './batch3aShared'

const MAX_HEADLINE_LENGTH = 40
const MAX_LINES = 5

/** Splits a headline into at most `MAX_LINES` stack lines. */
export function toStackLines(headline: string): string[] {
  const words = headline.split(/\s+/).filter(Boolean)
  if (words.length <= MAX_LINES) return words
  const perLine = Math.ceil(words.length / MAX_LINES)
  const lines: string[] = []
  for (let i = 0; i < words.length; i += perLine) {
    lines.push(words.slice(i, i + perLine).join(' '))
  }
  return lines
}

export const KineticWordStackDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()
  const scopeId = useScopeId('kinetic-word-stack')
  const palette = brandPalette(props)

  const headline = truncateText(slotText(props, 'headline', ['offer', 'businessName']), MAX_HEADLINE_LENGTH)
  const words = toStackLines(headline)
  const safeWords = words.length > 0 ? words : [' ']

  const upstreamSize = Math.round(Math.round(props.height * 0.155) * 0.74)
  const longest = safeWords.reduce((a, b) => (b.length > a.length ? b : a), '')
  const fitted = fitFontSize(longest.toUpperCase(), {
    maxWidth: props.width * 0.88,
    maxSize: upstreamSize,
    advance: 0.74,
    wrap: false,
  })
  const css =
    fitted < upstreamSize
      ? `${scopeSelector(scopeId)} span { font-size: ${fitted}px !important; }`
      : ''

  return (
    <DesignStage designId="kinetic-word-stack" props={props}>
      <ScopedUpstream scopeId={scopeId} css={css}>
        <KineticWordStack
          backgroundColor={TRANSPARENT}
          accentColor={palette.accent}
          textColor={palette.text}
          words={safeWords}
        />
      </ScopedUpstream>
    </DesignStage>
  )
}

export default KineticWordStackDesign
