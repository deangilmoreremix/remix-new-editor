/**
 * Adapter for the upstream `text-mask-reveal` template.
 *
 * Upstream: `src/components/text-mask-reveal/TextMaskReveal.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream sweeps an accent block across each line of a stack, uncovering
 * the text as the block exits.
 *
 * ARRAY PROP: the upstream takes `lines: string[]`, and the design layer
 * delivers ONE string per text slot (A6's contract addition C1). The adapter
 * therefore derives the array from the resolved slot value:
 *  - split on newlines first;
 *  - otherwise split on single spaces into at most 3 chunks of at most 18
 *    characters each.
 *
 * The upstream falls back to the demo string `["REVEAL"]` when `lines` is
 * empty, so the adapter always passes a non-empty array — an empty string is
 * used rather than the upstream's placeholder.
 *
 * The upstream uppercases every line, so the rendered text is upper-case.
 *
 * NOT SWITCHABLE: the upstream paints a full-canvas 13 %-alpha accent glow in
 * the corner (a radial wash at 18 % / 22 %). It cannot be turned off, so the
 * design is placed at `scale < 1` (the wash stays inside the box) and the
 * caveat is declared in the catalog's `capabilities.notes` (A6's C5).
 */

import React from 'react'
import { TextMaskReveal } from '../_upstream/text-mask-reveal/TextMaskReveal'
import { useDesignFonts } from './fonts'
import {
  DesignStage,
  TRANSPARENT,
  pickColor,
  slotText,
  truncateText,
  type DesignAdapterProps,
} from './shared'

/** The maximum number of characters in one revealed line. */
const MAX_LINE_LENGTH = 18

/** The maximum number of lines the stack may have. */
const MAX_LINES = 3

/**
 * Derives the upstream's `lines` array from one slot value.
 *
 * Newlines win; otherwise the words are packed greedily into at most
 * `MAX_LINES` chunks of at most `MAX_LINE_LENGTH` characters.
 */
function deriveLines(value: string): string[] {
  const source = typeof value === 'string' ? value.trim() : ''
  if (!source) return []

  const byNewline = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (byNewline.length > 1) {
    return byNewline.slice(0, MAX_LINES).map((line) => truncateText(line, MAX_LINE_LENGTH))
  }

  const words = source.split(/\s+/)
  const chunks: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (!current || candidate.length <= MAX_LINE_LENGTH) {
      current = candidate
      continue
    }
    chunks.push(current)
    current = word
    if (chunks.length >= MAX_LINES) break
  }

  if (current && chunks.length < MAX_LINES) {
    chunks.push(current)
  }

  return chunks
    .slice(0, MAX_LINES)
    .map((chunk) => truncateText(chunk, MAX_LINE_LENGTH))
    .filter((chunk) => chunk.length > 0)
}

export const TextMaskRevealDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()

  const headline = slotText(props, 'headline', ['offer', 'businessName'])
  const derived = deriveLines(headline)
  // The upstream falls back to ["REVEAL"] for an empty array — never reachable.
  const lines = derived.length > 0 ? derived : ['']

  return (
    <DesignStage designId="text-mask-reveal" props={props}>
      <TextMaskReveal
        backgroundColor={TRANSPARENT}
        accentColor={pickColor([props.colors?.accent, props.colors?.primary], '#22d3ee')}
        textColor={pickColor([props.color, props.colors?.text], '#ecfeff')}
        lines={lines}
      />
    </DesignStage>
  )
}

export default TextMaskRevealDesign
