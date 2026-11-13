/**
 * Adapter for the upstream `social-reel` template.
 *
 * Upstream: `src/components/social-reel/SocialReel.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * A generic vertical "short-form video player" mock-up (avatar, handle,
 * action rail, progress bar) cycles a catch copy → second copy → info panel →
 * pulsing CTA. It is a social mock-up whose background IS the design, so it is
 * registered as a `full-scene` intro card.
 *
 * LAYOUT: the upstream is a fixed 1920×1080 stage framing a 608×1080 player
 * (hard-coded pixels, it ignores the composition size). The adapter renders
 * that stage in a 1920×1080 box and scales it so the PLAYER fills the frame
 * height — 1× on 16:9 and 1:1, ~1.78× on 9:16 (the player then fills the
 * whole portrait frame) — over a brand-tinted backdrop.
 *
 * Copy: no upstream demo copy is reachable. The like counter label becomes
 * "Like" so the design never shows a made-up like count. The comment counter
 * ("318") is hard-coded upstream and is hidden by a scoped style rule; the
 * "Follow" / "Share" labels are hard-coded upstream and are
 * not switchable through props.
 */

import React from 'react'
import { AbsoluteFill } from 'remotion'
import { SocialReel } from '../../_upstream/social-reel/SocialReel'
import { useDesignFonts } from '../fonts'
import { DesignStage, slotText, slotValue, truncateText, type DesignAdapterProps } from '../shared'
import { brandPalette, deepShade, mixHex, ScopedUpstream, scopeSelector, useScopeId } from './batch3aShared'

const STAGE_W = 1920
const STAGE_H = 1080
const PLAYER_W = 608

/** `@acmeroofing` from "Acme Roofing". */
export function toHandle(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '')
  return slug ? `@${slug.slice(0, 18)}` : ''
}

/** Splits a headline into its lead and its last (accented) word. */
export function splitHeadline(headline: string): { lead: string; accent: string } {
  const words = headline.split(/\s+/).filter(Boolean)
  if (words.length <= 1) return { lead: '', accent: words[0] ?? '' }
  return { lead: words.slice(0, -1).join(' '), accent: words[words.length - 1] }
}

export const SocialReelDesign: React.FC<DesignAdapterProps> = (props) => {
  useDesignFonts()
  const palette = brandPalette(props)

  const businessName = truncateText(slotValue(props, 'businessName'), 18)
  const headline = truncateText(slotText(props, 'headline', ['offer', 'businessName']), 28)
  const offer = truncateText(slotValue(props, 'offer'), 36)
  const cta = truncateText(slotValue(props, 'cta'), 22)
  const website = truncateText(slotValue(props, 'website'), 30)
  const phone = truncateText(slotValue(props, 'phone'), 30)
  const { lead, accent } = splitHeadline(headline)

  const infoLines = [businessName, phone, website].filter((line) => line.length > 0)

  const s = Math.min(props.width / PLAYER_W, props.height / STAGE_H)
  const left = (props.width - STAGE_W * s) / 2
  const top = (props.height - STAGE_H * s) / 2
  const backdrop = deepShade(palette.primary, 0.88)

  // The upstream hard-codes a "318" comment count on the action rail. A made-up
  // engagement number must never appear on a customer's video, so the label of
  // the rail's second item (the comment counter) is hidden for this instance.
  const scopeId = useScopeId('social-reel')
  const hideFakeCount = `${scopeSelector(scopeId)} [style*="right: 28px"][style*="bottom: 130px"] > div:nth-child(2) > span { visibility: hidden !important; }`

  return (
    <DesignStage designId="social-reel" props={props}>
      <AbsoluteFill
        data-batch3a-backdrop
        style={{
          background: `radial-gradient(120% 120% at 50% 0%, ${mixHex(backdrop, '#ffffff', 0.08)} 0%, ${backdrop} 60%, #08090d 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left,
          top,
          width: STAGE_W,
          height: STAGE_H,
          transformOrigin: 'top left',
          transform: Math.abs(s - 1) < 0.0001 ? undefined : `scale(${s})`,
        }}
      >
        <ScopedUpstream scopeId={scopeId} css={hideFakeCount}>
        <SocialReel
          brandName={businessName || ' '}
          handle={toHandle(businessName)}
          headline={lead}
          headlineAccent={accent}
          secondCopy={offer}
          infoLines={infoLines}
          ctaText={cta}
          accentColor={palette.accent}
          bgFrom={deepShade(palette.primary, 0.72)}
          bgVia={deepShade(mixHex(palette.primary, palette.accent, 0.5), 0.68)}
          bgTo={deepShade(palette.accent, 0.74)}
          caption={website || offer}
          likeCount="Like"
        />
        </ScopedUpstream>
      </div>
    </DesignStage>
  )
}

export default SocialReelDesign
