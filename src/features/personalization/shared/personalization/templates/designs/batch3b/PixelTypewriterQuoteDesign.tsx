/**
 * Adapter for the upstream `pixel-typewriter-quote` template.
 *
 * Upstream: `src/components/pixel-typewriter-quote/PixelTypewriterQuote.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * A kinetic quote card: 5x7 bitmap glyphs strike one at a time, flare in the
 * accent and settle to the ink colour, then the attribution types in. The
 * upstream paints a banded background over the whole canvas, so this is a
 * full-scene intro card in a deep shade of the brand primary.
 *
 * Fitting: the upstream wraps at 21 characters per line and centres the block
 * vertically; more than four lines would push the attribution off the 270 px
 * internal canvas, so the adapter pre-wraps with the same greedy rule, keeps
 * four lines and ends a cut quote with "..". Words longer than a line are
 * split. The typing speed (`cps`) is raised for long text so the quote and the
 * attribution finish by frame ~120 and hold until the card ends.
 */

import React from 'react'
import { PixelTypewriterQuote } from '../../_upstream/pixel-typewriter-quote/PixelTypewriterQuote'
import { DesignStage, pickColor, slotText, slotValue, type DesignAdapterProps } from '../shared'
import { bitmapSafe, ensureDark, ensureLight, hex6, mix } from './shared'

/** The upstream's column width: floor((480 - 96) / 18). */
const COLUMN_CHARS = 21
const MAX_LINES = 4
const MAX_ATTRIBUTION = 30
const UPSTREAM_CPS = 0.55
/** Frame by which the body + attribution should be fully typed. */
const TYPED_BY_FRAME = 120

/** Same greedy wrap as the upstream, after splitting over-long words. */
export function fitQuote(text: string): string {
  const words = text
    .split(' ')
    .filter(Boolean)
    .flatMap((w) => {
      const parts: string[] = []
      for (let i = 0; i < w.length; i += COLUMN_CHARS) parts.push(w.slice(i, i + COLUMN_CHARS))
      return parts
    })
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const candidate = cur.length === 0 ? w : `${cur} ${w}`
    if (candidate.length > COLUMN_CHARS && cur.length > 0) {
      lines.push(cur)
      cur = w
    } else {
      cur = candidate
    }
  }
  if (cur.length > 0) lines.push(cur)
  if (lines.length <= MAX_LINES) return lines.join(' ')
  const kept = lines.slice(0, MAX_LINES)
  const last = kept[MAX_LINES - 1]
  kept[MAX_LINES - 1] = last.length > COLUMN_CHARS - 2 ? `${last.slice(0, COLUMN_CHARS - 2)}..` : `${last}..`
  return kept.join(' ')
}

export const PixelTypewriterQuoteDesign: React.FC<DesignAdapterProps> = (props) => {
  const primary = hex6(props.colors?.primary, '#29d3f2')
  const accent = ensureLight(hex6(pickColor([props.colors?.accent, props.colors?.primary]), '#28c98b'), 0.3)
  const ink = ensureLight(hex6(pickColor([props.color, props.colors?.text]), '#ffffff'), 0.55)
  const background = ensureDark(mix(primary, '#000000', 0.85), 0.03)

  const quote = fitQuote(bitmapSafe(slotText(props, 'headline', ['offer', 'businessName']), 200))
  const name = bitmapSafe(slotValue(props, 'businessName'), MAX_ATTRIBUTION - 2)
  const attribution = name ? `- ${name}` : ''

  const totalChars = quote.length + 8 + attribution.length
  const cps = Math.max(UPSTREAM_CPS, totalChars / TYPED_BY_FRAME)

  return (
    <DesignStage designId="pixel-typewriter-quote" props={props} stageStyle={{ backgroundColor: background }}>
      <PixelTypewriterQuote
        quote={quote}
        attribution={attribution}
        backgroundColor={background}
        inkColor={ink}
        accentColor={accent}
        cps={cps}
      />
    </DesignStage>
  )
}

export default PixelTypewriterQuoteDesign
