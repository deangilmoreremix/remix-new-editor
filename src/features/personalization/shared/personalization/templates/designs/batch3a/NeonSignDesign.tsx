/**
 * Adapter for the upstream `neon-sign` template.
 *
 * Upstream: `src/components/neon-sign/NeonSign.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * The upstream flickers a neon word on inside a mounted sign frame, then
 * fades a sub line in. The frame is a fixed `0.5 × min(w, h)` wide and the
 * SVG text is a fixed `0.10 × min(w, h)` — sized for a four-letter "OPEN".
 * A business name is longer, so the adapter overrides the SVG text's
 * `font-size` / `letter-spacing` presentation attributes from a stylesheet
 * scoped to this instance (CSS beats SVG presentation attributes), keeping the
 * name inside the sign frame. The upstream file is untouched.
 *
 * Canvas fill is forced transparent; the glow is a low-alpha radial halo.
 */

import React from 'react'
import { NeonSign } from '../../_upstream/neon-sign/NeonSign'
import { useDesignFonts } from '../fonts'
import { DesignStage, TRANSPARENT, slotText, slotValue, truncateText, type DesignAdapterProps } from '../shared'
import {
  ScopedUpstream,
  brandPalette,
  deepShade,
  fitFontSize,
  mixHex,
  scopeSelector,
  useScopeId,
} from './batch3aShared'

const MAX_SIGN_LENGTH = 16
const MAX_SUB_LENGTH = 40

export const NeonSignDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()
  const scopeId = useScopeId('neon-sign')
  const palette = brandPalette(props)

  const signText = truncateText(slotText(props, 'signText', ['headline']), MAX_SIGN_LENGTH)
  const subText = truncateText(slotValue(props, 'subText'), MAX_SUB_LENGTH)

  const scale = Math.min(props.width, props.height)
  const upstreamSize = scale * 0.1
  const fitted = fitFontSize(signText, {
    maxWidth: scale * 0.5 * 0.9,
    maxSize: upstreamSize,
    advance: 0.66 + 0.15,
    wrap: false,
    minSize: Math.max(12, scale * 0.03),
  })
  const sel = scopeSelector(scopeId)
  const css =
    fitted < Math.round(upstreamSize)
      ? `${sel} svg text { font-size: ${fitted}px; letter-spacing: ${Math.round(fitted * 0.15)}px; }`
      : ''

  return (
    <DesignStage designId="neon-sign" props={props}>
      <ScopedUpstream scopeId={scopeId} css={css}>
        <NeonSign
          backgroundColor={TRANSPARENT}
          neonColor={mixHex(palette.accent, '#ffffff', 0.55)}
          glowColor={palette.accent}
          flickerColor={palette.accent}
          frameColor={mixHex(deepShade(palette.primary, 0.35), '#3f3f46', 0.4)}
          textColor={palette.text}
          subColor={palette.text}
          signText={signText}
          subText={subText}
        />
      </ScopedUpstream>
    </DesignStage>
  )
}

export default NeonSignDesign
