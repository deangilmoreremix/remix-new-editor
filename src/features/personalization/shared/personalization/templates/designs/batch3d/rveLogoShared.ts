/**
 * Shared brand mapping for the five batch-3d repo-2 logo reveals
 * (`rve-logo-*`, from `remotion-templates` — React Video Editor, MIT).
 *
 * The upstream logo reveals are sized for a small player: a 100-120 px badge
 * and `rem` type, which resolves against the DOCUMENT root font size and not
 * against the composition (contract addition C9). The adapters therefore pass
 * px values derived from the composition's SHORT edge (1080 px in all four
 * supported formats), keeping the upstream's proportions: every upstream
 * length is multiplied by one factor `k`, chosen so the 120 px badge becomes
 * 20 % of the short edge (216 px, k = 1.8 at 1080).
 */

import type { RemotionDesignComponentProps } from '../../types'
import { lightenColor, withAlpha } from '../rveSharedDesign'
import { pickColor, slotText, slotValue, truncateText } from '../shared'
import { britoFitChars, britoMonogram } from './britoShared'

/** The upstream's 16 px `rem` base. */
const REM = 16

/** Upstream length → canvas px factor (120 px badge → 20 % of the short edge). */
export function rveLogoScale(props: RemotionDesignComponentProps): number {
  return (Math.min(props.width, props.height) * 0.2) / 120
}

/** An upstream `rem` length as canvas px. */
export function rveRemPx(props: RemotionDesignComponentProps, rem: number): string {
  return `${Math.round(rem * REM * rveLogoScale(props) * 10) / 10}px`
}

/** An upstream px length as canvas px. */
export function rvePx(props: RemotionDesignComponentProps, px: number): string {
  return `${Math.round(px * rveLogoScale(props) * 10) / 10}px`
}

/** `#rrggbb` → "r, g, b" (for the glitch glow); `null` for anything else. */
export function hexToRgbTriplet(value: string): string | null {
  const hex = value.trim().replace(/^#/, '')
  const full =
    hex.length === 3 && /^[0-9a-f]{3}$/i.test(hex)
      ? hex.split('').map((c) => c + c).join('')
      : hex
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  return `${parseInt(full.slice(0, 2), 16)}, ${parseInt(full.slice(2, 4), 16)}, ${parseInt(
    full.slice(4, 6),
    16,
  )}`
}

/** The brand values every repo-2 logo reveal uses. */
export interface RveLogoBrand {
  primary: string
  accent: string
  textColor: string
  /** Lighter shade of the primary, for the tagline (upstream: a light tint). */
  taglineColor: string
  /** The badge fill: brand gradient, or white behind a real logo. */
  badgeBackground: string
  /** The brand gradient (the upstream's own 135° two-stop gradient). */
  gradient: string
  /** The customer's logo URL, or undefined. */
  logo: string | undefined
  /** Business initials for the text badge. */
  monogram: string
  /** Company name, truncated to one line at the given size. */
  companyName: (fontSizePx: number, letterSpacingEm: number) => string
  /** Tagline, truncated to one line at the given size. */
  tagline: (fontSizePx: number) => string
  /** A soft glow in the brand primary. */
  glow: (alpha: number) => string
}

export function rveLogoBrand(props: RemotionDesignComponentProps): RveLogoBrand {
  const primary = pickColor([props.colors?.primary], '#4361ee')
  const accent = pickColor([props.colors?.accent], '#7209b7')
  const logoRaw = typeof props.media?.logo === 'string' ? props.media.logo.trim() : ''
  const logo = logoRaw || undefined
  const gradient = `linear-gradient(135deg, ${primary}, ${accent})`
  const name = slotText(props, 'companyName', ['businessName'])
  const available = props.width * 0.88
  return {
    primary,
    accent,
    textColor: pickColor([props.color, props.colors?.text], '#ffffff'),
    taglineColor: lightenColor(primary, 0.45),
    badgeBackground: logo ? '#ffffff' : gradient,
    gradient,
    logo,
    monogram: britoMonogram(name),
    companyName: (fontSizePx, letterSpacingEm) =>
      truncateText(name, britoFitChars(available, fontSizePx, 32, 0.6 + letterSpacingEm)),
    tagline: (fontSizePx) =>
      truncateText(slotValue(props, 'tagline'), britoFitChars(available, fontSizePx, 60, 0.55)),
    glow: (alpha) => withAlpha(primary, alpha),
  }
}
