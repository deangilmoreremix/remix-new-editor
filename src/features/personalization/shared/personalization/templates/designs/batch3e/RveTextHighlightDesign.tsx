/**
 * Adapter for the upstream `rve-text-highlight` template.
 *
 * Upstream: `templates/text-highlight.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder).
 *
 * A marker-style gradient sweeps behind each word of the line, one word
 * after another (0.6 s per word). The upstream paints a full-canvas dark
 * gradient behind the words; as an overlay the adapter makes it transparent
 * and adds a soft text shadow so the words read on the video before their
 * highlight lands.
 *
 * Brand mapping: headline (then offer) → the words (at most 8; a single word
 * is cut at 14 characters); primary → accent → the highlight gradient; the
 * layer colour → the words. The word block wraps inside a column of
 * `min(700px × unit, 90 % of the canvas)`, and the type is shrunk so the
 * longest word always fits that column.
 */

import React from 'react'
import { TextHighlight } from '../../_upstream/rve-text-highlight/TextHighlight'
import { DESIGN_FONT_STACK } from '../fonts'
import { TRANSPARENT, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  READABLE_TEXT_SHADOW,
  brandAccent,
  brandPrimary,
  brandText,
  fitFontPx,
  px,
  remUnit,
  slotText,
  truncateText,
} from './batch3eShared'

export const RVE_TEXT_HIGHLIGHT_ID = 'rve-text-highlight'

const ZOOM = 1.5

/** The most words the sweep runs over (0.6 s each). */
export const TEXT_HIGHLIGHT_MAX_WORDS = 8

/** The longest single word. */
const MAX_WORD_LENGTH = 14

/** Splits the copy into the highlighted words. */
export function textHighlightWords(raw: string): string[] {
  const words = raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => truncateText(word, MAX_WORD_LENGTH))
  if (words.length <= TEXT_HIGHLIGHT_MAX_WORDS) return words
  const kept = words.slice(0, TEXT_HIGHLIGHT_MAX_WORDS)
  kept[kept.length - 1] = `${kept[kept.length - 1]}…`
  return kept
}

export const RveTextHighlightDesign: React.FC<DesignAdapterProps> = (props) => {
  const words = textHighlightWords(slotText(props, 'headline', ['offer', 'businessName']))

  const rem = remUnit(props, ZOOM)
  const unit = rem / 16
  const column = Math.min(700 * unit, props.width * 0.9)
  // The column has 40px (× unit) of padding per side and each word 12px.
  const inner = column - 80 * unit - 24 * unit
  const longest = Math.max(1, ...words.map((word) => word.length))
  const fontPx = fitFontPx(inner, longest, 3.5 * rem, 0.62, 0.4)

  return (
    <RveDesignStage designId={RVE_TEXT_HIGHLIGHT_ID} props={props}>
      <TextHighlight
        words={words}
        background={TRANSPARENT}
        color={brandText(props)}
        highlightFrom={brandPrimary(props)}
        highlightTo={brandAccent(props)}
        fontSize={px(fontPx)}
        gap={px(16 * unit)}
        maxWidth={px(column)}
        padding={px(40 * unit)}
        wordPadding={`${px(4 * unit)} ${px(12 * unit)}`}
        highlightRadius={px(6 * unit)}
        fontFamily={DESIGN_FONT_STACK}
        textShadow={READABLE_TEXT_SHADOW}
      />
    </RveDesignStage>
  )
}

export default RveTextHighlightDesign
