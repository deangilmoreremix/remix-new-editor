/**
 * Adapter for the upstream `rve-logo-typewriter` template.
 *
 * Upstream: `templates/logo-typewriter.tsx`
 * (remotion-templates, MIT — React Video Editor, no named copyright holder).
 *
 * A round icon springs in, then the wordmark types itself out beside it
 * (0.15 characters per frame) behind a blinking cursor. Brand mapping:
 * wordmark ← business name in capitals (the upstream literal is set in
 * capitals); icon ← the customer's logo, or a primary → accent gradient
 * disc; cursor ← brand primary; canvas ← transparent. Sizes are
 * canvas-relative, and the wordmark is truncated to what fits one line next
 * to the icon.
 */

import React from 'react'
import { LogoTypewriter } from '../../_upstream/rve-logo-typewriter/LogoTypewriter'
import { DESIGN_FONT_STACK } from '../fonts'
import { TRANSPARENT, slotText, truncateText, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import { britoFitChars } from './britoShared'
import { rveLogoBrand, rvePx, rveRemPx, rveLogoScale } from './rveLogoShared'

export const RVE_LOGO_TYPEWRITER_ID = 'rve-logo-typewriter'

/** Hard ceiling; at 0.15 chars/frame, 24 characters type out in 160 frames. */
const MAX_WORDMARK_LENGTH = 24

export const RveLogoTypewriterDesign: React.FC<DesignAdapterProps> = (props) => {
  const brand = rveLogoBrand(props)
  const k = rveLogoScale(props)
  const fontSizePx = 32 * k
  const room = props.width * 0.88 - (50 + 16) * k
  const wordmark = truncateText(
    slotText(props, 'wordmark', ['businessName']).toUpperCase(),
    britoFitChars(room, fontSizePx, MAX_WORDMARK_LENGTH, 0.74),
  )
  return (
    <RveDesignStage designId={RVE_LOGO_TYPEWRITER_ID} props={props}>
      <LogoTypewriter
        text={wordmark}
        backgroundColor={TRANSPARENT}
        gap={rvePx(props, 16)}
        iconSize={rvePx(props, 50)}
        iconBackground={brand.logo ? TRANSPARENT : brand.gradient}
        logoImageSrc={brand.logo}
        textColor={brand.textColor}
        fontSize={rveRemPx(props, 2)}
        fontFamily={DESIGN_FONT_STACK}
        cursorColor={brand.primary}
        cursorMarginLeft={rvePx(props, 2)}
      />
    </RveDesignStage>
  )
}

export default RveLogoTypewriterDesign
