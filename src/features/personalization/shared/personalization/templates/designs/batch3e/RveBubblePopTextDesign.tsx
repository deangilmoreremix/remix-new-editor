/**
 * Adapter for the upstream `rve-bubble-pop-text` template.
 *
 * Upstream: `templates/bubble-pop-text.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder).
 *
 * Every letter pops in inside its own gradient bubble, five frames apart.
 * The upstream draws a fixed 100 px bubble per character in a row that is
 * centred with `left: 50%` + `translate(-50%)` — that row's shrink-to-fit
 * width is capped at half the canvas, so a long word would squash the
 * bubbles into ovals. The adapter therefore sizes the bubbles from the
 * number of letters so the whole row always fits in ~46 % of the canvas
 * width (it never grows past the upstream proportion × zoom).
 *
 * Brand mapping: business name (then headline) → the letters, upper-cased
 * like the upstream's "HELLO"; a multi-word name keeps a bubble-wide gap
 * between words (`hideSpaceBubbles`) and is cut to the first word when it is
 * longer than the bubble budget; brand primary → the bubble gradient and its
 * glow; the layer colour → the letters.
 */

import React from 'react'
import { BubblePopText } from '../../_upstream/rve-bubble-pop-text/BubblePopText'
import { type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import {
  brandPrimary,
  brandText,
  darkenColor,
  px,
  remUnit,
  slotText,
  withAlpha,
} from './batch3eShared'

export const RVE_BUBBLE_POP_TEXT_ID = 'rve-bubble-pop-text'

const ZOOM = 1.6

/** The most letters (spaces included) the row may hold. */
export const BUBBLE_POP_MAX_CHARS = 10

/** Picks the copy for the bubbles: the whole name, its first word, or a cut. */
export function bubblePopCopy(raw: string): string {
  const value = raw.trim().replace(/\s+/g, ' ').toUpperCase()
  if (value.length <= BUBBLE_POP_MAX_CHARS) return value
  const first = value.split(' ')[0] ?? ''
  if (first.length > 0 && first.length <= BUBBLE_POP_MAX_CHARS) return first
  return value.slice(0, BUBBLE_POP_MAX_CHARS)
}

export const RveBubblePopTextDesign: React.FC<DesignAdapterProps> = (props) => {
  const copy = bubblePopCopy(slotText(props, 'businessName', ['headline']))
  const count = Math.max(1, copy.length)

  const rem = remUnit(props, ZOOM)
  const baseSize = (100 * rem) / 16
  const baseGap = 0.5 * rem
  const available = props.width * 0.46
  // Each bubble is `size` + two borders (4 % of the size each) wide.
  const fitted = (available - baseGap * (count - 1)) / (count * 1.08)
  const size = Math.max(12, Math.min(baseSize, fitted))
  const ratio = size / 100

  const primary = brandPrimary(props)

  return (
    <RveDesignStage designId={RVE_BUBBLE_POP_TEXT_ID} props={props}>
      <BubblePopText
        text={copy}
        color={brandText(props)}
        gradientFrom={darkenColor(primary, 0.45)}
        gradientTo={primary}
        border={`${px(Math.max(1, 4 * ratio))} solid rgba(255, 255, 255, 0.2)`}
        boxShadow={`0 ${px(4 * ratio)} ${px(15 * ratio)} ${withAlpha(primary, 0.5)}`}
        fontSize={px(64 * ratio)}
        bubbleSize={px(size)}
        lineHeight={px(92 * ratio)}
        gap={px(Math.min(baseGap, 8 * ratio))}
        hideSpaceBubbles
      />
    </RveDesignStage>
  )
}

export default RveBubblePopTextDesign
