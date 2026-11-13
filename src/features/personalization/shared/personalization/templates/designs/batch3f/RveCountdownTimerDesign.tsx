/**
 * Adapter for the upstream `rve-countdown-timer` template.
 *
 * Upstream: `templates/countdown-timer.tsx` (remotion-templates, MIT — React
 * Video Editor, no named copyright holder). "5, 4, 3, 2, 1" spring in one
 * after another, then a gradient "GO" lands and stays.
 *
 * OVERLAY: the upstream's solid `#111827` canvas is forced `transparent`, so
 * the countdown plays over the customer's video. The digits get a soft drop
 * shadow (an added, off-by-default prop of the copy) so white type stays
 * legible over a bright frame.
 *
 * Brand mapping: the final word is the CTA (the PRIMARY slot — the customer
 * can retype it), filled with a primary -> accent gradient instead of the
 * upstream blue -> purple; the digits use the text colour. "GO" is the
 * fallback when there is no CTA.
 *
 * The upstream sizes its type in `rem` (not canvas-relative), so the adapter
 * passes px derived from the composition's short edge, and shrinks the final
 * word so a long CTA still fits the canvas width on one line.
 */

import React from 'react'
import { CountdownTimer } from '../../_upstream/rve-countdown-timer/CountdownTimer'
import { TRANSPARENT, slotText, truncateText, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import { brandAccent, brandPrimary, brandText } from './shared3f'

/** Digit size as a fraction of the short edge (upstream: 10rem on a 1080 frame ~ 0.15). */
const DIGIT_RATIO = 0.26
/** Final-word size cap as a fraction of the short edge (upstream: 8rem). */
const FINAL_RATIO = 0.2
/** Longest final word, in characters. */
const MAX_FINAL_CHARS = 16

export const RveCountdownTimerDesign: React.FC<DesignAdapterProps> = (props) => {
  const short = Math.min(props.width, props.height)
  const finalWord = truncateText(slotText(props, 'cta', ['offer']), MAX_FINAL_CHARS) || 'GO'
  const digitPx = Math.round(short * DIGIT_RATIO)
  // Bold type is ~0.62 em per glyph; keep the word inside 88 % of the width.
  const finalPx = Math.round(
    Math.min(short * FINAL_RATIO, (props.width * 0.88) / Math.max(1, finalWord.length * 0.62)),
  )

  return (
    <RveDesignStage designId="rve-countdown-timer" props={props}>
      <CountdownTimer
        labels={['5', '4', '3', '2', '1', finalWord]}
        background={TRANSPARENT}
        color={brandText(props)}
        fontSize={`${digitPx}px`}
        finalFontSize={`${finalPx}px`}
        finalGradient={`linear-gradient(135deg, ${brandPrimary(props)}, ${brandAccent(props)})`}
        textShadow="0 6px 24px rgba(0, 0, 0, 0.45)"
      />
    </RveDesignStage>
  )
}

export default RveCountdownTimerDesign
