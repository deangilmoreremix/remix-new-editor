/**
 * Adapter for the upstream `rve-logo-glitch-reveal` template.
 *
 * Upstream: `templates/logo-glitch-reveal.tsx`
 * (remotion-templates, MIT — React Video Editor, no named copyright holder).
 *
 * Three red/green/blue copies of the badge jitter apart (screen-blended) and
 * collapse onto the clean badge, which gains a glow as the glitch settles;
 * the company name and tagline fade in with it. Brand mapping: clean badge ←
 * the customer's logo on a white badge, or their initials on a primary →
 * accent gradient; glow ← brand primary; company name ← business name;
 * tagline ← headline; canvas ← transparent. The RGB channel colours are the
 * effect itself (a chromatic split), so they keep the upstream values.
 */

import React from 'react'
import {
  LogoGlitchReveal,
  defaultLogoGlitchRevealProps,
} from '../../_upstream/rve-logo-glitch-reveal/LogoGlitchReveal'
import { DESIGN_FONT_STACK } from '../fonts'
import { TRANSPARENT, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import { hexToRgbTriplet, rveLogoBrand, rvePx, rveRemPx, rveLogoScale } from './rveLogoShared'

export const RVE_LOGO_GLITCH_REVEAL_ID = 'rve-logo-glitch-reveal'

export const RveLogoGlitchRevealDesign: React.FC<DesignAdapterProps> = (props) => {
  const brand = rveLogoBrand(props)
  const k = rveLogoScale(props)
  return (
    <RveDesignStage designId={RVE_LOGO_GLITCH_REVEAL_ID} props={props}>
      <LogoGlitchReveal
        backgroundColor={TRANSPARENT}
        logoSize={rvePx(props, 120)}
        logoBorderRadius={rvePx(props, 24)}
        logoBackground={brand.badgeBackground}
        glowRgb={hexToRgbTriplet(brand.primary) ?? defaultLogoGlitchRevealProps.glowRgb}
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

export default RveLogoGlitchRevealDesign
