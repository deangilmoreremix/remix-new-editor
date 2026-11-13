/**
 * Adapter for the upstream `LogoIntro` template (repo 3).
 *
 * Upstream: `src/templates/LogoIntro/LogoIntro.tsx`
 * (remotion-video-templates, MIT — © 2026 Alejandro Brito).
 *
 * The upstream pops the logo in with an overshooting spring, wipes it on
 * left-to-right, bursts seeded particles out of it and settles it on a soft
 * brand-tinted glow; it fades out over the last 12 frames of its duration.
 *
 * Brand mapping:
 *  - `logoSrc` ← the customer's logo (`media.logo`). The upstream read a file
 *    from `public/` through `staticFile()`; the copy takes a resolved URL
 *    (deviation D3). Without a logo, the upstream's new `logoPlaceholder`
 *    slot gets a branded monogram badge (business initials on a
 *    primary → accent gradient) — plain DOM, so no broken `<img>`.
 *  - `brandColor` ← brand primary, `accentColor` ← brand accent (particles,
 *    glow, drop shadow).
 *  - `backgroundColor` ← `transparent`: this is an overlay, the customer's
 *    video shows through. (The upstream's glow gradient fades to
 *    `withAlpha(backgroundColor, 0)`, which is fully transparent either way.)
 *
 * The fade-out runs against the composition's duration (the design layer has
 * no `endFrame`), so the logo stays on screen and fades out at the end of the
 * clip, like the repo-1 logo reveals.
 */

import React from 'react'
import { LogoIntro } from '../../_upstream/brito-logo-intro/LogoIntro'
import { TRANSPARENT, pickColor, slotText, type DesignAdapterProps } from '../shared'
import { BritoDesignStage, BritoLogoPlaceholder } from './britoShared'

export const BRITO_LOGO_INTRO_ID = 'brito-logo-intro'

/** The upstream's logo box is a fixed 460x460 px square. */
const LOGO_SIZE = 460

/** The upstream default particle count. */
const PARTICLE_COUNT = 28

export const BritoLogoIntroDesign: React.FC<DesignAdapterProps> = (props) => {
  const primary = pickColor([props.colors?.primary], '#2563EB')
  const accent = pickColor([props.colors?.accent], '#0EA5E9')
  const logo = typeof props.media?.logo === 'string' ? props.media.logo.trim() : ''
  const name = slotText(props, 'businessName')

  return (
    <BritoDesignStage designId={BRITO_LOGO_INTRO_ID} props={props} overlay>
      <LogoIntro
        logoSrc={logo}
        brandColor={primary}
        accentColor={accent}
        backgroundColor={TRANSPARENT}
        particleCount={PARTICLE_COUNT}
        logoPlaceholder={
          <BritoLogoPlaceholder size={LOGO_SIZE} primary={primary} accent={accent} name={name} />
        }
      />
    </BritoDesignStage>
  )
}

export default BritoLogoIntroDesign
