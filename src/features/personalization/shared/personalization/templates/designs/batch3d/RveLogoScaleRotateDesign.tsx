/**
 * Adapter for the upstream `rve-logo-scale-rotate` template.
 *
 * Upstream: `templates/logo-scale-rotate.tsx`
 * (remotion-templates, MIT — React Video Editor, no named copyright holder).
 *
 * A round badge scales up from nothing while spinning a full turn, then
 * pulses a soft glow; the company name slides up under it. Brand mapping:
 * badge ← the customer's logo on a white badge, or their initials on a
 * primary → accent gradient; glow ← brand primary; company name ← business
 * name; canvas ← transparent. Sizes are canvas-relative.
 */

import React from 'react'
import { LogoScaleRotate } from '../../_upstream/rve-logo-scale-rotate/LogoScaleRotate'
import { DESIGN_FONT_STACK } from '../fonts'
import { TRANSPARENT, type DesignAdapterProps } from '../shared'
import { RveDesignStage } from '../rveSharedDesign'
import { rveLogoBrand, rvePx, rveRemPx, rveLogoScale } from './rveLogoShared'

export const RVE_LOGO_SCALE_ROTATE_ID = 'rve-logo-scale-rotate'

export const RveLogoScaleRotateDesign: React.FC<DesignAdapterProps> = (props) => {
  const brand = rveLogoBrand(props)
  const k = rveLogoScale(props)
  return (
    <RveDesignStage designId={RVE_LOGO_SCALE_ROTATE_ID} props={props}>
      <LogoScaleRotate
        backgroundColor={TRANSPARENT}
        logoSize={rvePx(props, 100)}
        logoBackground={brand.badgeBackground}
        glowColor={brand.glow(0.6)}
        logoText={brand.monogram}
        logoTextColor="#ffffff"
        logoFontSize={rveRemPx(props, 1.2)}
        logoImageSrc={brand.logo}
        fontFamily={DESIGN_FONT_STACK}
        companyName={brand.companyName(28.8 * k, 0)}
        companyNameColor={brand.textColor}
        companyNameFontSize={rveRemPx(props, 1.8)}
        companyNameMarginTop={rveRemPx(props, 1.5)}
      />
    </RveDesignStage>
  )
}

export default RveLogoScaleRotateDesign
