/**
 * Adapter for the upstream `KineticText` template (repo 3).
 *
 * Upstream: `src/templates/KineticText/KineticText.tsx`
 * (remotion-video-templates, MIT — © 2026 Alejandro Brito).
 *
 * The upstream plays a list of lines one after another; inside each line the
 * words spring up one by one (4 frames apart), the finished line holds, then
 * fades out. An "emphasis" line is set larger, bolder and in the emphasis
 * colour — the upstream demo ends on its punch line ("code.").
 *
 * Brand mapping: the lines are the customer's headline, offer and call to
 * action, in that order, with the call to action as the emphasised punch
 * line (empty fields are skipped; with no copy at all the business name is
 * used). `textColor` ← the layer colour / brand text colour,
 * `emphasisColor` ← brand accent, `backgroundColor` ← `transparent` (an
 * overlay: the customer's video shows through).
 *
 * FIXED DURATION: the upstream's `calculateMetadata` derives the length from
 * the word count (`layoutKinetic`). The design keeps that timeline but bounds
 * it: at most three lines of at most five words each, so the design never
 * runs longer than `BRITO_KINETIC_MAX_FRAMES` (276 frames). The upstream type
 * is fixed px (104 / 150 px) inside an 82 %-wide wrapping row, so every word
 * is also truncated to what fits that row at the composition width.
 */

import React from 'react'
import {
  KineticText,
  layoutKinetic,
  type KineticTextProps,
} from '../../_upstream/brito-kinetic-text/KineticText'
import {
  TRANSPARENT,
  pickColor,
  slotText,
  slotValue,
  truncateText,
  type DesignAdapterProps,
} from '../shared'
import { BritoDesignStage, britoFitChars } from './britoShared'

export const BRITO_KINETIC_TEXT_ID = 'brito-kinetic-text'

/** At most this many words per line. */
export const BRITO_KINETIC_MAX_WORDS = 5

/** The longest timeline the design can produce (3 lines x 5 words). */
export const BRITO_KINETIC_MAX_FRAMES = layoutKinetic([
  { text: 'a b c d e' },
  { text: 'a b c d e' },
  { text: 'a b c d e', emphasis: true },
]).totalDuration

function toLine(value: string, maxWordChars: number): string {
  const words = value.trim().split(/\s+/).filter(Boolean)
  const kept = words.slice(0, BRITO_KINETIC_MAX_WORDS).map((word) => truncateText(word, maxWordChars))
  if (words.length > BRITO_KINETIC_MAX_WORDS && kept.length > 0) {
    const last = kept[kept.length - 1]
    if (!last.endsWith('…')) kept[kept.length - 1] = `${last}…`
  }
  return kept.join(' ')
}

/** Builds the kinetic lines from the brand copy. */
export function britoKineticLines(
  props: DesignAdapterProps,
): KineticTextProps['lines'] {
  const rowWidth = props.width * 0.82
  const normalChars = britoFitChars(rowWidth, 104, 22, 0.62)
  const emphasisChars = britoFitChars(rowWidth, 150, 18, 0.64)

  const lines: KineticTextProps['lines'] = []
  const headline = toLine(slotText(props, 'headline'), normalChars)
  const offer = toLine(slotValue(props, 'offer'), normalChars)
  const cta = toLine(slotValue(props, 'cta'), emphasisChars)
  if (headline) lines.push({ text: headline })
  if (offer) lines.push({ text: offer })
  if (cta) lines.push({ text: cta, emphasis: true })
  if (lines.length === 0) {
    const name = toLine(slotValue(props, 'businessName'), emphasisChars)
    lines.push({ text: name || ' ', emphasis: true })
  }
  return lines
}

export const BritoKineticTextDesign: React.FC<DesignAdapterProps> = (props) => {
  const lines = britoKineticLines(props)
  return (
    <BritoDesignStage designId={BRITO_KINETIC_TEXT_ID} props={props} overlay>
      <KineticText
        lines={lines}
        backgroundColor={TRANSPARENT}
        textColor={pickColor([props.color, props.colors?.text], '#FAFAFA')}
        emphasisColor={pickColor([props.colors?.accent, props.colors?.primary], '#60A5FA')}
      />
    </BritoDesignStage>
  )
}

export default BritoKineticTextDesign
