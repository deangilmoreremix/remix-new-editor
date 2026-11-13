/**
 * Adapter for the upstream `shatter-reveal` template.
 *
 * Upstream: `src/components/shatter-reveal/ShatterReveal.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * Fragments of a picture tile start scattered and rotated, converge into one
 * tile carrying the headline, then an accent bar wipes in and a sub line
 * fades up. The tile fills the canvas (minus a 7.4 % inset), so the tile IS
 * the design: it is registered as a `full-scene` intro card with a designed
 * brand background and a brand gradient tile, and plays before the
 * customer's video.
 *
 * The headline is a fixed `0.26 × min(w, h)` (sized for "Reveal"); a longer
 * headline would be cut by the fragment windows, so a stylesheet scoped to
 * this instance shrinks it to fit the tile. The scatter distance (a fixed
 * 280 px upstream) is scaled with the canvas.
 */

import React from 'react'
import { ShatterReveal } from '../../_upstream/shatter-reveal/ShatterReveal'
import { useDesignFonts } from '../fonts'
import { DesignStage, slotText, slotValue, truncateText, type DesignAdapterProps } from '../shared'
import {
  ScopedUpstream,
  brandPalette,
  deepShade,
  fitFontSize,
  mixHex,
  scopeSelector,
  useScopeId,
} from './batch3aShared'

const MAX_TITLE_LENGTH = 28
const MAX_SUBTITLE_LENGTH = 48

export const ShatterRevealDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()
  const scopeId = useScopeId('shatter-reveal')
  const palette = brandPalette(props)

  const title = truncateText(slotText(props, 'title', ['offer', 'businessName']), MAX_TITLE_LENGTH)
  const subtitle = truncateText(slotValue(props, 'subtitle'), MAX_SUBTITLE_LENGTH)

  const scale = Math.min(props.width, props.height)
  const inset = scale * 0.074
  const tileW = props.width - inset * 2
  const tileH = props.height - inset * 2
  const upstreamSize = scale * 0.26
  const fitted = fitFontSize(title, {
    maxWidth: tileW * 0.86,
    maxHeight: tileH * 0.7,
    maxSize: upstreamSize,
    advance: 0.66,
    lineHeight: 1.05,
  })
  // root > inset > relative > fragment > window > tile > title
  const titleSel = `${scopeSelector(scopeId)} > div:first-child > div:first-child > div > div > div > div > div`
  const css =
    `${titleSel} { text-align: center; max-width: ${Math.round(tileW * 0.9)}px; }` +
    (fitted < Math.round(upstreamSize) ? `\n${titleSel} { font-size: ${fitted}px !important; }` : '')

  return (
    <DesignStage designId="shatter-reveal" props={props}>
      <ScopedUpstream scopeId={scopeId} css={css}>
        <ShatterReveal
          title={title}
          subtitle={subtitle}
          pieces={36}
          spread={Math.round((280 * scale) / 1080)}
          textColor={palette.text}
          background={deepShade(palette.primary, 0.82)}
          tileBackground={`linear-gradient(135deg, ${deepShade(palette.primary, 0.25)} 0%, ${mixHex(
            palette.primary,
            palette.accent,
            0.5,
          )} 50%, ${deepShade(palette.accent, 0.2)} 100%)`}
          accentColor={palette.accent}
        />
      </ScopedUpstream>
    </DesignStage>
  )
}

export default ShatterRevealDesign
