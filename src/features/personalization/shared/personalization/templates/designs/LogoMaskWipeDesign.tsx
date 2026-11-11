/**
 * Adapter for the upstream `logo-mask-wipe` template.
 *
 * Upstream: `src/components/logo-mask-wipe/LogoMaskWipe.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream reveals a monogram badge and a wordmark through a diagonal
 * mask wipe. Its `backgroundColor` prop is the canvas fill and is forced to
 * `transparent`; the upstream default is the opaque `#0a0800`.
 *
 * Two upstream traits are NOT switchable and are declared in the catalog's
 * `capabilities.notes`:
 *  - the faint accent backdrop glow (a 13 %-alpha radial wash over the
 *    whole canvas), and
 *  - the fixed SVG `clipPath` id `lmw-wipe` — two mounted instances of this
 *    design would share the DOM id, so at most one instance per composition
 *    may be used (A6's contract addition C7).
 *
 * The wordmark's font size is `height * 0.05` with `0.22em` tracking, so it
 * is relative to the composition and needs no fitting; it is truncated only so
 * a very long business name cannot run off the canvas.
 */

import React from 'react'
import { LogoMaskWipe } from '../_upstream/logo-mask-wipe/LogoMaskWipe'
import { useDesignFonts } from './fonts'
import {
  DesignStage,
  TRANSPARENT,
  pickColor,
  slotText,
  truncateText,
  type DesignAdapterProps,
} from './shared'

/** Long wordmarks are cut so they can never leave the canvas. */
const MAX_BRAND_TEXT_LENGTH = 28

export const LogoMaskWipeDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()

  const brandText = truncateText(
    slotText(props, 'businessName', ['headline']),
    MAX_BRAND_TEXT_LENGTH,
  )
  const monogram = brandText.charAt(0).toUpperCase() || '★'

  return (
    <DesignStage designId="logo-mask-wipe" props={props}>
      <LogoMaskWipe
        backgroundColor={TRANSPARENT}
        accentColor={pickColor([props.colors?.accent, props.colors?.primary], '#eab308')}
        textColor={pickColor([props.color, props.colors?.text], '#fefce8')}
        monogram={monogram}
        brandText={brandText}
      />
    </DesignStage>
  )
}

export default LogoMaskWipeDesign
