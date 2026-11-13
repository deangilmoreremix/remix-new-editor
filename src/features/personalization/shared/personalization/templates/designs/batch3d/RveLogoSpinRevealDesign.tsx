/**
 * Adapter for the upstream `rve-logo-spin-reveal` template.
 *
 * Upstream: `templates/logo-spin-reveal.tsx`
 * (remotion-templates, MIT — React Video Editor, no named copyright holder).
 *
 * A round badge swings in around its vertical axis (rotateY 90° → 0 inside a
 * perspective container), then the company name and tagline slide up. Brand
 * mapping: badge ← the customer's logo on a white badge, or their initials on
 * a primary → accent gradient; company name ← business name; tagline ←
 * headline; canvas ← transparent. Sizes are canvas-relative.
 */

import React from 'react'
import { LogoSpinReveal } from '../../_upstream/rve-logo-spin-reveal/LogoSpinReveal'
import { DESIGN_FONT_STACK } from '../fonts'
import { TRANSPARENT, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import { rveLogoBrand, rvePx, rveRemPx, rveLogoScale } from './rveLogoShared'

export const RVE_LOGO_SPIN_REVEAL_ID = 'rve-logo-spin-reveal'

export const RveLogoSpinRevealDesign: React.FC<DesignAdapterProps> = (props) => {
  const brand = rveLogoBrand(props)
  const k = rveLogoScale(props)
  return (
    <RveDesignStage designId={RVE_LOGO_SPIN_REVEAL_ID} props={props}>
      <LogoSpinReveal
        backgroundColor={TRANSPARENT}
        perspective={rvePx(props, 1000)}
        logoSize={rvePx(props, 120)}
        logoBackground={brand.badgeBackground}
        logoShadow={`0 0 ${Math.round(50 * k)}px ${brand.glow(0.4)}`}
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

export default RveLogoSpinRevealDesign
