/**
 * Deterministic discovery fixtures for testing.
 *
 * These fixtures represent raw discovery results and must flow through
 * the same normalization, classification, and auto-placement pipeline
 * as live Firecrawl or static discovery.
 */

import type { DiscoveryResult } from '../discoveryProvider'

export const FIXTURES: Record<string, DiscoveryResult> = {
  'https://www.joesroofing.com': {
    provider: 'STATIC_FALLBACK',
    pagesCrawled: 2,
    rawCandidates: 3,
    candidates: [
      { url: 'https://www.joesroofing.com/wp-content/uploads/2023/01/logo.png', sourcePage: 'https://www.joesroofing.com', sourceType: 'WEBSITE' },
      { url: 'https://www.joesroofing.com/wp-content/uploads/2023/01/team.jpg', sourcePage: 'https://www.joesroofing.com', sourceType: 'WEBSITE' },
      { url: 'https://www.joesroofing.com/wp-content/uploads/2023/01/work.jpg', sourcePage: 'https://www.joesroofing.com', sourceType: 'WEBSITE' },
    ],
    socialProfiles: [],
  },
}

export function getFixture(websiteUrl: string): DiscoveryResult | null {
  const normalized = websiteUrl.toLowerCase().replace(/\/$/, '')
  return FIXTURES[normalized] || null
}
