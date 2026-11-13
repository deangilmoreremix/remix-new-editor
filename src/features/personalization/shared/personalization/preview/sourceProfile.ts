/**
 * Source-aware composition: what the SELECTED demo video is.
 *
 * Personalization starts from an existing AI-generated demo video, not a blank
 * canvas. This module describes that video for the layout and quality logic:
 * its family, real dimensions, how it sits inside the chosen video shape,
 * regions that are protected, graphics already baked into it, and whether it
 * may be exported commercially.
 *
 * Honesty rules
 *  - Protected zones and baked-in regions exist ONLY where a person verified
 *    them (VERIFIED_SOURCE_PROFILES) or the customer marked them. Nothing is
 *    inferred from the picture; otherwise the profile says "unknown" and the
 *    quality check reports Review Required.
 *  - Rights are `unverified` unless explicitly recorded. A clip that names a
 *    third-party brand is `third-party-reference` and is never treated as
 *    authorized for a personalized export.
 *  - Pure data and helpers: no registry/provider/React imports.
 */
import type { NormRect, ProtectedZone } from './types'

export type SourceFamily = 'minimax-h3' | 'promptfeed' | 'seedance-1' | 'seedance-25' | 'unknown'
export type RightsStatus = 'verified-owned' | 'licensed' | 'third-party-reference' | 'unverified'
export type BakedInStatus = 'known' | 'unknown'

export interface SourceProfile {
  videoSrc: string | null
  family: SourceFamily
  /** Real pixel size from the probed media facts (or measured), else null. */
  sourceWidth: number | null
  sourceHeight: number | null
  /** width / height, or null when the size is unknown. */
  sourceAspect: number | null
  /** Protected subject zones in SOURCE-frame coordinates (verified or customer-marked only). */
  zones: ProtectedZone[]
  zonesVerified: boolean
  /** Graphics already baked into the footage. `unknown` unless reviewed. */
  baked: { status: BakedInStatus; regions: ProtectedZone[] }
  rights: RightsStatus
  rightsNote: string
  /** Who verified the zones/baked-in regions, if anyone. */
  verifiedBy: 'manual-review' | null
}

/** Substrings of a media path/title that name a real third-party brand. */
export const THIRD_PARTY_BRAND_MARKERS: readonly string[] = ['tresemm', 'kitkat', 'muji']

interface VerifiedProfile {
  zones: Omit<ProtectedZone, 'source'>[]
  baked: Omit<ProtectedZone, 'source'>[]
}

/**
 * Per-clip facts verified by looking at the actual footage (frames extracted
 * from real exports). Keep this table small and truthful; add a clip only after
 * inspecting it.
 */
export const VERIFIED_SOURCE_PROFILES: Readonly<Record<string, VerifiedProfile>> = Object.freeze({
  '/media/minimax-h3/videos/luxury-perfume-commercial.webm': {
    zones: [{ id: 'perfume-bottle', label: 'Perfume bottle', x: 0.36, y: 0.02, w: 0.3, h: 0.95 }],
    baked: [{ id: 'minimax-hailuo-mark', label: 'MINIMAX | Hailuo AI mark', x: 0.75, y: 0.9, w: 0.24, h: 0.08 }],
  },
})

export function familyFromSrc(videoSrc: string | null | undefined): SourceFamily {
  const m = /\/media\/(minimax-h3|promptfeed|seedance-1|seedance-25)\//.exec(videoSrc ?? '')
  return (m?.[1] as SourceFamily) ?? 'unknown'
}

export function namesThirdPartyBrand(text: string | null | undefined): boolean {
  const t = (text ?? '').toLowerCase()
  return THIRD_PARTY_BRAND_MARKERS.some((m) => t.includes(m))
}

export function profileForSource(args: {
  videoSrc: string | null | undefined
  title?: string
  width?: number | null
  height?: number | null
  customerZones?: ProtectedZone[]
}): SourceProfile {
  const videoSrc = args.videoSrc ?? null
  const verified = videoSrc ? VERIFIED_SOURCE_PROFILES[videoSrc] : undefined
  const w = args.width && args.width > 0 ? args.width : null
  const h = args.height && args.height > 0 ? args.height : null
  const thirdParty = namesThirdPartyBrand(videoSrc) || namesThirdPartyBrand(args.title)
  const inRegistry = familyFromSrc(videoSrc) !== 'unknown'
  const zones: ProtectedZone[] = [
    ...(verified?.zones ?? []).map((z) => ({ ...z, source: 'template' as const })),
    ...(args.customerZones ?? []),
  ]
  return {
    videoSrc,
    family: familyFromSrc(videoSrc),
    sourceWidth: w,
    sourceHeight: h,
    sourceAspect: w && h ? w / h : null,
    zones,
    zonesVerified: zones.length > 0,
    baked: {
      status: verified ? 'known' : 'unknown',
      regions: (verified?.baked ?? []).map((z) => ({ ...z, source: 'template' as const })),
    },
    // The owner confirmed (2026-11) that ALL 123 registry demo clips may be used with no restrictions, so every clip served
    // from a registry family is `verified-owned` — including those that mention a brand. Any other clip (an upload, an
    // unknown URL) is still unverified, and a third-party-brand one stays a reference clip.
    rights: inRegistry ? 'verified-owned' : thirdParty ? 'third-party-reference' : 'unverified',
    rightsNote: inRegistry
      ? 'Rights confirmed by the owner for this registry demo clip: no usage restrictions.'
      : thirdParty
        ? 'This clip is built around a real third-party brand. It is a reference clip, not something you are licensed to publish as your own ad.'
        : 'No licence or ownership record exists for this clip, so commercial use is not verified.',
    verifiedBy: verified ? 'manual-review' : null,
  }
}

/** A final (non-preview) export needs the customer's explicit confirmation of rights. */
export function rightsNeedConfirmation(p: Pick<SourceProfile, 'rights'>): boolean {
  return p.rights === 'unverified' || p.rights === 'third-party-reference'
}

export type AspectClass = 'landscape-16:9' | 'portrait-9:16' | 'square' | 'portrait-4:5' | 'landscape-other' | 'portrait-other' | 'unknown'

/** Classifies a real media size so layout rules do not assume a standard ratio. */
export function aspectClass(width: number | null | undefined, height: number | null | undefined): AspectClass {
  if (!width || !height || width <= 0 || height <= 0) return 'unknown'
  const r = width / height
  const near = (t: number) => Math.abs(r - t) / t < 0.03
  if (near(16 / 9)) return 'landscape-16:9'
  if (near(9 / 16)) return 'portrait-9:16'
  if (near(1)) return 'square'
  if (near(4 / 5)) return 'portrait-4:5'
  return r > 1 ? 'landscape-other' : 'portrait-other'
}

export interface SourceFit {
  policy: 'contain' | 'cover'
  /** Where the source picture sits inside the composition, normalized (top-left origin). */
  visible: NormRect
  /** Fraction of the source picture cut off (0 for contain). */
  cropLoss: number
  /** True when bars appear (contain with a different shape). */
  letterboxed: boolean
}

/**
 * Where a source of `sourceAspect` lands in a `compW`×`compH` composition. The
 * renderer letterboxes (contain) — verified against real exports — so that is
 * the default; `cover` is available for a future crop-to-fill option.
 */
export function fitSourceToComposition(
  sourceAspect: number | null,
  compW: number,
  compH: number,
  policy: 'contain' | 'cover' = 'contain',
): SourceFit {
  const comp = compW / compH
  if (!sourceAspect || !(sourceAspect > 0) || Math.abs(sourceAspect - comp) / comp < 0.005) {
    return { policy, visible: { x: 0, y: 0, w: 1, h: 1 }, cropLoss: 0, letterboxed: false }
  }
  if (policy === 'contain') {
    if (sourceAspect > comp) {
      const h = comp / sourceAspect
      return { policy, visible: { x: 0, y: (1 - h) / 2, w: 1, h }, cropLoss: 0, letterboxed: true }
    }
    const w = sourceAspect / comp
    return { policy, visible: { x: (1 - w) / 2, y: 0, w, h: 1 }, cropLoss: 0, letterboxed: true }
  }
  // cover: the source fills the frame; the part outside is cropped
  const loss = sourceAspect > comp ? 1 - comp / sourceAspect : 1 - sourceAspect / comp
  return { policy, visible: { x: 0, y: 0, w: 1, h: 1 }, cropLoss: loss, letterboxed: false }
}

/** Maps a zone given in SOURCE coordinates into composition coordinates. */
export function mapZoneToComposition(zone: ProtectedZone, fit: SourceFit, sourceAspect: number | null, compAspect: number): ProtectedZone {
  if (fit.policy === 'contain' || !sourceAspect) {
    return { ...zone, x: fit.visible.x + zone.x * fit.visible.w, y: fit.visible.y + zone.y * fit.visible.h, w: zone.w * fit.visible.w, h: zone.h * fit.visible.h }
  }
  // cover: scale up so the source fills, then shift by the crop offset
  const scaleX = sourceAspect > compAspect ? sourceAspect / compAspect : 1
  const scaleY = sourceAspect > compAspect ? 1 : compAspect / sourceAspect
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  const x0 = clamp((zone.x - 0.5) * scaleX + 0.5)
  const y0 = clamp((zone.y - 0.5) * scaleY + 0.5)
  const x1 = clamp((zone.x + zone.w - 0.5) * scaleX + 0.5)
  const y1 = clamp((zone.y + zone.h - 0.5) * scaleY + 0.5)
  return { ...zone, x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }
}

/**
 * Protected zones in COMPOSITION coordinates: the verified/customer subject
 * zones plus verified baked-in graphics (overlays must not sit on a watermark).
 */
export function compositionZones(profile: SourceProfile, compW: number, compH: number, policy: 'contain' | 'cover' = 'contain'): ProtectedZone[] {
  const fit = fitSourceToComposition(profile.sourceAspect, compW, compH, policy)
  const comp = compW / compH
  return [...profile.zones, ...profile.baked.regions].map((z) => mapZoneToComposition(z, fit, profile.sourceAspect, comp))
}
