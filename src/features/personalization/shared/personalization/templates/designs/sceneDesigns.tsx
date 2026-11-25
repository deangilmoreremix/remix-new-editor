/**
 * Adapters for the full-screen scenes (opening and closing scenes).
 *
 * A scene owns the whole frame for a few seconds at the start or end of the
 * video, so — unlike the overlays — these adapters keep the upstream's own
 * opaque background. The background is the customer's PRIMARY brand colour,
 * darkened so text stays readable; text and accents use their TEXT and ACCENT
 * colours. Every upstream file under `_upstream/<id>/` is frozen.
 *
 * Upstream: https://github.com/deangilmoreremix/free-remotion-templates
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 */

import React from 'react'
import { FireworksBurst } from '../_upstream/fireworks-burst/FireworksBurst'
import { GradientTextSweep } from '../_upstream/gradient-text-sweep/GradientTextSweep'
import { KineticWordStack } from '../_upstream/kinetic-word-stack/KineticWordStack'
import { NeonSign } from '../_upstream/neon-sign/NeonSign'
import { ShatterReveal } from '../_upstream/shatter-reveal/ShatterReveal'
import { Typewriter } from '../_upstream/typewriter/Typewriter'
import { DesignStage, darkenColor, pickColor, slotText, slotValue, truncateText, type DesignAdapterProps } from './shared'

/** The customer's palette as a scene needs it: a dark, brand-tinted stage. */
export function sceneColors(props: DesignAdapterProps): { background: string; text: string; accent: string; primary: string } {
  const primary = pickColor([props.colors?.primary], '#29d3f2')
  return {
    primary,
    background: darkenColor(primary, 0.14),
    text: pickColor([props.color, props.colors?.text], '#ffffff'),
    accent: pickColor([props.colors?.accent, primary], '#28c98b'),
  }
}

/** Splits a phrase into up to `max` short words for the stacking scenes. */
export function sceneWords(value: string, max: number): string[] {
  const words = value.split(/\s+/).map((word) => word.trim()).filter(Boolean)
  return words.slice(0, max)
}

export const GradientSweepSceneDesign: React.FC<DesignAdapterProps> = (props) => {
  const colors = sceneColors(props)
  return (
    <DesignStage designId="gradient-text-sweep" props={props}>
      <GradientTextSweep
        backgroundColor={colors.background}
        accentColor={colors.accent}
        textColor={colors.text}
        headline={truncateText(slotText(props, 'headline', ['businessName']), 28)}
        subline={truncateText(slotValue(props, 'businessName'), 36)}
      />
    </DesignStage>
  )
}

export const KineticWordsSceneDesign: React.FC<DesignAdapterProps> = (props) => {
  const colors = sceneColors(props)
  const words = sceneWords(slotText(props, 'headline', ['businessName']), 5)
  return (
    <DesignStage designId="kinetic-word-stack" props={props}>
      <KineticWordStack
        backgroundColor={colors.background}
        accentColor={colors.accent}
        textColor={colors.text}
        words={words.length > 0 ? words.map((word) => word.toUpperCase()) : ['WELCOME']}
      />
    </DesignStage>
  )
}

export const NeonSignSceneDesign: React.FC<DesignAdapterProps> = (props) => {
  const colors = sceneColors(props)
  return (
    <DesignStage designId="neon-sign" props={props}>
      <NeonSign
        backgroundColor={darkenColor(colors.primary, 0.06)}
        neonColor={colors.text}
        glowColor={colors.accent}
        flickerColor={colors.accent}
        frameColor={darkenColor(colors.primary, 0.3)}
        textColor={colors.text}
        subColor={colors.accent}
        signText={truncateText(slotText(props, 'businessName', ['headline']), 16)}
        subText={truncateText(slotValue(props, 'headline'), 36)}
      />
    </DesignStage>
  )
}

export const ShatterSceneDesign: React.FC<DesignAdapterProps> = (props) => {
  const colors = sceneColors(props)
  return (
    <DesignStage designId="shatter-reveal" props={props}>
      <ShatterReveal
        title={truncateText(slotText(props, 'businessName', ['headline']), 22)}
        subtitle={truncateText(slotValue(props, 'headline'), 44)}
        pieces={36}
        spread={280}
        textColor={colors.text}
        background={colors.background}
        tileBackground={`linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`}
        accentColor={colors.accent}
      />
    </DesignStage>
  )
}

export const FireworksSceneDesign: React.FC<DesignAdapterProps> = (props) => {
  const colors = sceneColors(props)
  return (
    <DesignStage designId="fireworks-burst" props={props}>
      <FireworksBurst
        backgroundColor={colors.background}
        burstColors={[colors.primary, colors.accent, colors.text, '#fbbf24', '#f472b6']}
        trailColor={colors.text}
        sparkColor={colors.accent}
        textColor={colors.text}
        subColor={colors.accent}
        messageText={truncateText(slotText(props, 'cta', ['offer', 'headline']), 22)}
        subText={truncateText(slotValue(props, 'businessName'), 36)}
      />
    </DesignStage>
  )
}

export const TypewriterSceneDesign: React.FC<DesignAdapterProps> = (props) => {
  const colors = sceneColors(props)
  return (
    <DesignStage designId="typewriter" props={props}>
      <Typewriter
        backgroundColor={darkenColor(colors.primary, 0.08)}
        machineColor="#374151"
        machineDarkColor="#1f2937"
        keyColor="#4b5563"
        ribbonColor={colors.accent}
        paperColor="#f8fafc"
        textColor={colors.text}
        subColor={colors.accent}
        messageText={truncateText(slotText(props, 'headline', ['businessName']), 18)}
        subText={truncateText(slotValue(props, 'businessName'), 32)}
      />
    </DesignStage>
  )
}
