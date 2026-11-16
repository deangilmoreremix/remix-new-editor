/**
 * Adapter for the upstream `rve-logo-fade-reveal` template.
 *
 * Upstream: `templates/logo-fade-reveal.tsx`
 * (remotion-templates, MIT — React Video Editor, no named copyright holder).
 *
 * The badge fades and scales up (0.8 → 1), then the company name and the
 * tagline rise in. Brand mapping: badge ← the customer's logo on a white
 * badge, or their initials on a primary → accent gradient; company name ←
 * business name; tagline ← headline; colours ← brand; canvas ← transparent.
 * Sizes are canvas-relative (see `./rveLogoShared.ts`).
 */

import React from 'react'
import { LogoFadeReveal } from '../../_upstream/rve-logo-fade-reveal/LogoFadeReveal'
import { DESIGN_FONT_STACK } from '../fonts'
import { TRANSPARENT, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import { rveLogoBrand, rvePx, rveRemPx, rveLogoScale } from './rveLogoShared'

export const RVE_LOGO_FADE_REVEAL_ID = 'rve-logo-fade-reveal'

export const RveLogoFadeRevealDesign: React.FC<DesignAdapterProps> = (props) => {
  const brand = rveLogoBrand(props)
  const k = rveLogoScale(props)
  return (
    <RveDesignStage designId={RVE_LOGO_FADE_REVEAL_ID} props={props}>
      <LogoFadeReveal
        backgroundColor={TRANSPARENT}
        logoSize={rvePx(props, 120)}
        logoBorderRadius={rvePx(props, 24)}
        logoBackground={brand.badgeBackground}
        logoShadow={`0 0 ${Math.round(40 * k)}px ${brand.glow(0.3)}`}
        logoText={brand.monogram}
        logoTextColor="#ffffff"
        logoFontSize={rveRemPx(props, 1.8)}
        logoImageSrc={brand.logo}
        fontFamily={DESIGN_FONT_STACK}
        companyName={brand.companyName(32 * k, 0.05)}
        companyNameColor={brand.textColor}
        companyNameFontSize={rveRemPx(props, 2)}
        companyNameMarginTop={rveRemPx(props, 1.5)}
        tagline={brand.tagline(16 * k)}
        taglineColor={brand.taglineColor}
        taglineFontSize={rveRemPx(props, 1)}
        taglineMarginTop={rveRemPx(props, 0.5)}
      />
    </RveDesignStage>
  )
}

export default RveLogoFadeRevealDesign
