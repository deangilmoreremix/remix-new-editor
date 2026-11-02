/**
 * Ownership badge styling shared by the Lead Finder result cards
 * (PersonalizationModal) and the guided Simple Mode search results
 * (StepFindBusiness). Mirrors the server ownership vocabulary in
 * `src/server/businessDiscovery/types.ts`.
 */
import type { CSSProperties } from 'react'
import type { BusinessOwnership } from './types'

export const OWNERSHIP_LABELS: Record<BusinessOwnership, string> = {
  independent: 'Independent',
  local_multi_location: 'Local multi-location',
  franchise_chain: 'Franchise',
  national_bigbox: 'National chain',
  unknown: 'Ownership unknown',
}

const OWNERSHIP_BADGE_TONES: Record<BusinessOwnership, { color: string; background: string; border: string }> = {
  independent: {
    color: '#28c98b',
    background: 'rgba(40,201,139,.12)',
    border: 'rgba(40,201,139,.45)',
  },
  local_multi_location: {
    color: '#29d3f2',
    background: 'rgba(41,211,242,.12)',
    border: 'rgba(41,211,242,.45)',
  },
  franchise_chain: {
    color: '#f5b545',
    background: 'rgba(245,181,69,.12)',
    border: 'rgba(245,181,69,.45)',
  },
  national_bigbox: {
    color: 'rgba(255,255,255,.58)',
    background: 'rgba(255,255,255,.04)',
    border: 'rgba(255,255,255,.16)',
  },
  unknown: {
    color: 'rgba(255,255,255,.58)',
    background: 'rgba(255,255,255,.04)',
    border: 'rgba(255,255,255,.16)',
  },
}

export function ownershipLabel(ownership: BusinessOwnership): string {
  return OWNERSHIP_LABELS[ownership] ?? 'Ownership unknown'
}

export function ownershipBadgeStyle(ownership: BusinessOwnership): CSSProperties {
  const tone = OWNERSHIP_BADGE_TONES[ownership] ?? OWNERSHIP_BADGE_TONES.unknown
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 9px',
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    border: `1px solid ${tone.border}`,
    background: tone.background,
    color: tone.color,
    whiteSpace: 'nowrap',
  }
}
