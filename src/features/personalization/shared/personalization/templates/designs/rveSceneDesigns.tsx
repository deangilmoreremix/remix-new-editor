/**
 * Adapters for the React Video Editor templates used as full-screen scenes:
 * Cinematic Title, Logo Typewriter, Highlight Words and Quote Card.
 *
 * The upstream files under `_upstream/rve-*` are EDITED ports (every literal
 * became an optional prop with the upstream value as default, see each
 * file's deviation record). The upstreams size type in `rem`, which is not
 * canvas-relative, so the adapters pass px sizes derived from the frame's
 * short edge (`rveFontSizePx`) and the bundled typeface.
 */

import React from 'react'
import { CinematicTitleIntro } from '../_upstream/rve-cinematic-title-intro/CinematicTitleIntro'
import { LogoTypewriter } from '../_upstream/rve-logo-typewriter/LogoTypewriter'
import { QuoteCard } from '../_upstream/rve-quote-card/QuoteCard'
import { TextHighlight } from '../_upstream/rve-text-highlight/TextHighlight'
import { DESIGN_FONT_STACK } from './fonts'
import { RveDesignStage, rveFontSizePx, withAlpha } from './rveSharedDesign'
import { sceneColors } from './sceneDesigns'
import { darkenColor, slotText, slotValue, truncateText, type DesignAdapterProps } from './shared'

/** Brand gradient used where the upstream had its blue → purple gradient. */
function brandGradient(primary: string, accent: string, angle = 135): string {
  return `linear-gradient(${angle}deg, ${primary}, ${accent})`
}

export const CinematicTitleSceneDesign: React.FC<DesignAdapterProps> = (props) => {
  const colors = sceneColors(props)
  return (
    <RveDesignStage designId="rve-cinematic-title-intro" props={props}>
      <CinematicTitleIntro
        title={truncateText(slotText(props, 'headline', ['businessName']), 34)}
        subtitle={truncateText(slotValue(props, 'businessName'), 40)}
        background={`linear-gradient(135deg, ${colors.background} 0%, ${darkenColor(colors.primary, 0.05)} 100%)`}
        underlineFrom={colors.primary}
        underlineTo={colors.accent}
        titleColor={colors.text}
        subtitleColor={withAlpha(colors.text, 0.8)}
        titleFontSize={`${rveFontSizePx(props, 0.1)}px`}
        subtitleFontSize={`${rveFontSizePx(props, 0.036)}px`}
        underlineMaxWidth={rveFontSizePx(props, 0.45)}
      />
    </RveDesignStage>
  )
}

export const LogoTypewriterSceneDesign: React.FC<DesignAdapterProps> = (props) => {
  const colors = sceneColors(props)
  return (
    <RveDesignStage designId="rve-logo-typewriter" props={props}>
      <LogoTypewriter
        text={truncateText(slotText(props, 'businessName', ['headline']), 22).toUpperCase()}
        backgroundColor={colors.background}
        iconBackground={brandGradient(colors.primary, colors.accent)}
        logoImageSrc={props.media?.logo || undefined}
        textColor={colors.text}
        cursorColor={colors.accent}
        fontSize={`${rveFontSizePx(props, 0.075)}px`}
        iconSize={`${rveFontSizePx(props, 0.13)}px`}
        fontFamily={DESIGN_FONT_STACK}
      />
    </RveDesignStage>
  )
}

export const HighlightWordsSceneDesign: React.FC<DesignAdapterProps> = (props) => {
  const colors = sceneColors(props)
  const words = slotText(props, 'headline', ['businessName']).split(/\s+/).filter(Boolean).slice(0, 7)
  return (
    <RveDesignStage designId="rve-text-highlight" props={props}>
      <TextHighlight
        words={words.length > 0 ? words : ['Welcome']}
        background={`linear-gradient(180deg, ${colors.background}, ${darkenColor(colors.primary, 0.22)})`}
        highlightFrom={colors.primary}
        highlightTo={colors.accent}
        color={colors.text}
        fontSize={`${rveFontSizePx(props, 0.085)}px`}
        maxWidth="80%"
        fontFamily={DESIGN_FONT_STACK}
      />
    </RveDesignStage>
  )
}

export const QuoteCardSceneDesign: React.FC<DesignAdapterProps> = (props) => {
  const colors = sceneColors(props)
  const business = slotValue(props, 'businessName')
  return (
    <RveDesignStage designId="rve-quote-card" props={props}>
      <QuoteCard
        quote={truncateText(slotText(props, 'headline', ['offer']), 120)}
        attribution={business ? `— ${business}` : ''}
        backgroundColor={colors.background}
        quoteMarkColor={colors.accent}
        quoteColor={colors.text}
        attributionColor={withAlpha(colors.text, 0.65)}
        quoteMarkFontSize={`${rveFontSizePx(props, 0.16)}px`}
        quoteFontSize={`${rveFontSizePx(props, 0.055)}px`}
        attributionFontSize={`${rveFontSizePx(props, 0.032)}px`}
        maxWidth="80%"
        serifFontFamily={DESIGN_FONT_STACK}
        fontFamily={DESIGN_FONT_STACK}
      />
    </RveDesignStage>
  )
}
