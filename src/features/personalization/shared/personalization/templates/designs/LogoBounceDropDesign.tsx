/**
 * Adapter for the upstream `logo-bounce-drop` template.
 *
 * Upstream: `src/components/logo-bounce-drop/LogoBounceDrop.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream drops a wordmark into the composition and lets it bounce on
 * landing. Two upstream values are pinned by the adapter:
 *
 *  - `svgPath` must stay `""` (text mode). The upstream renders inline SVG
 *    when `svgPath` is non-empty, and the adapter has no SVG path data for
 *    the customer's brand — so the design always uses the text mode.
 *  - `backgroundColor` is the canvas fill and is forced to `transparent`; the
 *    upstream default is the opaque `#F8FAFC`.
 *
 * The upstream's display size is a fixed `fontSize: 240` px, which assumes a
 * 1920 px wide canvas. On a 1080 px wide canvas the same wordmark would run
 * off the frame, so the adapter computes the size from the composition width
 * (A6's contract addition C2) and truncates the wordmark (C3). The upstream
 * value is the upper bound, so a 16:9 composition keeps the upstream look.
 *
 * `duration` is in SECONDS, not frames (the upstream multiplies it by `fps`).
 */

import React from 'react'
import { LogoBounceDrop } from '../_upstream/logo-bounce-drop/LogoBounceDrop'
import { useDesignFonts } from './fonts'
import {
  DesignStage,
  TRANSPARENT,
  pickColor,
  slotText,
  truncateText,
  type DesignAdapterProps,
} from './shared'

/** The upstream's own display size, in px, on a 1920 px wide composition. */
const UPSTREAM_FONT_SIZE = 240

/** Long wordmarks are cut so they can never leave the canvas. */
const MAX_WORDMARK_LENGTH = 20

/** The title-safe width the wordmark is fitted into (a fraction of the canvas). */
const TITLE_SAFE_WIDTH = 0.86

/** The average advance of a 900-weight sans, in em. */
const CHAR_ADVANCE = 0.62

/** The wordmark never shrinks below this, in px. */
const MIN_FONT_SIZE = 32

/** The upstream's own motion constants. */
const DROP_HEIGHT = 0.6
const BOUNCE_STRENGTH = 4
const DURATION_SECONDS = 3

export const LogoBounceDropDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()

  const wordmark = truncateText(
    slotText(props, 'businessName', ['headline']),
    MAX_WORDMARK_LENGTH,
  )

  const fontSize = Math.max(
    MIN_FONT_SIZE,
    Math.min(
      UPSTREAM_FONT_SIZE,
      Math.round(
        (props.width * TITLE_SAFE_WIDTH) / (Math.max(1, wordmark.length) * CHAR_ADVANCE),
      ),
    ),
  )

  return (
    <DesignStage designId="logo-bounce-drop" props={props}>
      <LogoBounceDrop
        logoText={wordmark}
        svgPath=""
        viewBox="0 0 300 300"
        dropHeight={DROP_HEIGHT}
        bounceStrength={BOUNCE_STRENGTH}
        logoColor={pickColor([props.color, props.colors?.text], '#0F172A')}
        backgroundColor={TRANSPARENT}
        fontSize={fontSize}
        duration={DURATION_SECONDS}
      />
    </DesignStage>
  )
}

export default LogoBounceDropDesign
