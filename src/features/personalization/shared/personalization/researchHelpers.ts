/**
 * Pure helpers that turn a business research result into modal state.
 * Kept out of DemoPersonalizeProvider.tsx so they can be unit-tested without
 * loading the provider (and its Supabase client).
 */
import { DEFAULT_PREVIEW_BRAND_COLORS } from './preview/types'

/**
 * The first prose paragraph of page Markdown (not a heading, list item or
 * quote), with Markdown emphasis and links reduced to plain text, at most
 * 300 characters. Undefined when there is none.
 */
export function firstParagraphOf(markdown: string | undefined): string | undefined {
  if (!markdown) return undefined
  for (const block of markdown.split(/\n+/)) {
    const line = block.trim()
    if (!line || /^(#|-|>|\*\s)/.test(line)) continue
    const plain = line
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*\*|\*/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (plain.length < 40) continue
    return plain.length > 300 ? `${plain.slice(0, 297).replace(/\s+\S*$/, '')}…` : plain
  }
  return undefined
}

const HEX_BRAND_COLOR = /^#[0-9a-f]{6}$/i

/** Only well-formed `#rrggbb` primary / accent colours, or null. */
export function researchBrandColors(value: unknown): { primary?: string; accent?: string } | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const colors: { primary?: string; accent?: string } = {}
  for (const key of ['primary', 'accent'] as const) {
    const color = record[key]
    if (typeof color === 'string' && HEX_BRAND_COLOR.test(color)) colors[key] = color.toLowerCase()
  }
  return colors.primary || colors.accent ? colors : null
}

export interface BrandColorPair {
  primary: string
  accent: string
}

function samePair(a: BrandColorPair, b: { primary: string; accent: string } | null): boolean {
  return Boolean(
    b &&
      a.primary.toLowerCase() === b.primary.toLowerCase() &&
      a.accent.toLowerCase() === b.accent.toLowerCase(),
  )
}

/**
 * The preview brand colours after a business's research arrives.
 *
 * `autoApplied` is the pair this function last applied (null when none). The
 * current colours belong to the visitor only when they are neither the
 * defaults nor that auto-applied pair: then they are kept whatever the
 * research says. Otherwise:
 *   - a researched palette replaces them (so business B is not left with
 *     business A's palette), and
 *   - research with no palette restores the defaults when the current pair
 *     was auto-applied for an earlier business.
 *
 * Returns the colours and the pair now auto-applied (null when none), which
 * the caller stores for the next call. `colors` is the same object as
 * `current` when nothing changes.
 */
export function applyResearchedBrandColors<T extends BrandColorPair>(
  current: T,
  researched: { primary?: string; accent?: string } | null,
  autoApplied: BrandColorPair | null = null,
): { colors: T; autoApplied: BrandColorPair | null } {
  const isDefault = samePair(current, DEFAULT_PREVIEW_BRAND_COLORS)
  const isAutoApplied = samePair(current, autoApplied)
  if (!isDefault && !isAutoApplied) return { colors: current, autoApplied: null }

  if (!researched) {
    if (isAutoApplied && !isDefault) {
      return {
        colors: {
          ...current,
          primary: DEFAULT_PREVIEW_BRAND_COLORS.primary,
          accent: DEFAULT_PREVIEW_BRAND_COLORS.accent,
        },
        autoApplied: null,
      }
    }
    return { colors: current, autoApplied: isAutoApplied ? autoApplied : null }
  }

  // Start from the defaults so a palette with only a primary does not keep
  // the previous business's accent.
  const colors = {
    ...current,
    primary: researched.primary ?? DEFAULT_PREVIEW_BRAND_COLORS.primary,
    accent: researched.accent ?? DEFAULT_PREVIEW_BRAND_COLORS.accent,
  }
  if (samePair(colors, current)) return { colors: current, autoApplied: { primary: current.primary, accent: current.accent } }
  return { colors, autoApplied: { primary: colors.primary, accent: colors.accent } }
}
