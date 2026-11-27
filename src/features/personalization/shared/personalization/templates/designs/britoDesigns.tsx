/**
 * Adapters for the `remotion-video-templates` designs (MIT, © 2026 Alejandro
 * Brito): Logo Intro and Kinetic Text as full-screen scenes, and the
 * slide-in-bar lower third as an overlay.
 *
 * The upstream files live under `_upstream/remotion-video-templates/` with
 * their own `lib/` helpers. Two documented local changes: `lib/fonts.ts`
 * resolves to the bundled face instead of a Google Fonts download, and Logo
 * Intro loads the logo URL directly instead of through `staticFile()`.
 */

import React from 'react'
import { AbsoluteFill } from 'remotion'
import { KineticText } from '../_upstream/remotion-video-templates/templates/KineticText/KineticText'
import { LogoIntro } from '../_upstream/remotion-video-templates/templates/LogoIntro/LogoIntro'
import { SlideInBar } from '../_upstream/remotion-video-templates/templates/LowerThirds/styles'
import { ShatterSceneDesign, sceneColors } from './sceneDesigns'
import { DESIGN_FONT_ATTRIBUTION } from '../typography'
import { DesignStage, slotText, slotValue, truncateText, type DesignAdapterProps } from './shared'

/** Credit line drawn inside every `remotion-video-templates` design. */
export const BRITO_VIDEO_CREDIT = `© 2026 Alejandro Brito · MIT · ${DESIGN_FONT_ATTRIBUTION}`

export const LogoIntroSceneDesign: React.FC<DesignAdapterProps> = (props) => {
  const colors = sceneColors(props)
  const logo = props.media?.logo
  // Without a logo there is nothing to burst in: show the business name with
  // the shatter scene instead of an empty image.
  if (!logo) return <ShatterSceneDesign {...props} />
  return (
    <DesignStage designId="rvt-logo-intro" props={props} credit={BRITO_VIDEO_CREDIT}>
      <LogoIntro
        logoSrc={logo}
        brandColor={colors.primary}
        accentColor={colors.accent}
        backgroundColor={colors.background}
        particleCount={28}
      />
    </DesignStage>
  )
}

/** Breaks a phrase into short lines (about two words each) for Kinetic Text. */
export function kineticLines(headline: string, businessName: string): { text: string; emphasis?: boolean }[] {
  const words = headline.split(/\s+/).filter(Boolean).slice(0, 8)
  const lines: { text: string; emphasis?: boolean }[] = []
  for (let i = 0; i < words.length; i += 2) lines.push({ text: words.slice(i, i + 2).join(' ') })
  if (businessName) lines.push({ text: businessName, emphasis: true })
  return lines.length > 0 ? lines.slice(0, 6) : [{ text: 'Welcome', emphasis: true }]
}

export const KineticTextSceneDesign: React.FC<DesignAdapterProps> = (props) => {
  const colors = sceneColors(props)
  const lines = kineticLines(
    truncateText(slotText(props, 'headline'), 60),
    truncateText(slotValue(props, 'businessName'), 28),
  )
  return (
    <DesignStage designId="rvt-kinetic-text" props={props} credit={BRITO_VIDEO_CREDIT}>
      <KineticText lines={lines} backgroundColor={colors.background} textColor={colors.text} emphasisColor={colors.accent} />
    </DesignStage>
  )
}

/** Held on screen for the rest of the video once it slides in. */
const HOLD_FOREVER_FRAMES = 1_000_000

export const SlideInBarDesign: React.FC<DesignAdapterProps> = (props) => {
  const colors = sceneColors(props)
  return (
    <DesignStage designId="rvt-slide-in-bar" props={props} credit={BRITO_VIDEO_CREDIT}>
      <AbsoluteFill>
        <SlideInBar
          name={truncateText(slotText(props, 'businessName', ['headline']), 32)}
          role={truncateText(slotValue(props, 'headline'), 44)}
          accentColor={colors.accent}
          enterDurationInFrames={14}
          holdDurationInFrames={HOLD_FOREVER_FRAMES}
          exitDurationInFrames={14}
        />
      </AbsoluteFill>
    </DesignStage>
  )
}
