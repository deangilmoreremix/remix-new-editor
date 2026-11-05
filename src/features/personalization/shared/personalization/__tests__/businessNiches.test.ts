/**
 * Keeps the client-side niche list aligned with the server's NICHE_MAPPINGS.
 *
 * The /api/personalization/find-businesses route rejects any niche that is not
 * a key of NICHE_MAPPINGS, so drift between these two lists would surface as
 * "Unsupported niche" runtime errors that no other test would catch.
 */

import { describe, it, expect } from 'vitest'
import { BUSINESS_NICHES } from '../businessNiches'
import { NICHE_MAPPINGS, getSupportedNiches } from '../../../../../../netlify/functions/_personalization/src/server/businessDiscovery/nicheMappings'

describe('BUSINESS_NICHES sync with server NICHE_MAPPINGS', () => {
  it('exposes exactly the server-supported niches (same keys, same order)', () => {
    const clientKeys = BUSINESS_NICHES.map((n) => n.key)
    const serverKeys = getSupportedNiches()
    expect(clientKeys).toEqual(serverKeys)
  })

  it('uses the server labels verbatim', () => {
    for (const niche of BUSINESS_NICHES) {
      expect(NICHE_MAPPINGS[niche.key]).toBeDefined()
      expect(niche.label).toBe(NICHE_MAPPINGS[niche.key].label)
    }
  })

  it('has no duplicate keys or empty labels', () => {
    const keys = BUSINESS_NICHES.map((n) => n.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const niche of BUSINESS_NICHES) {
      expect(niche.key.length).toBeGreaterThan(0)
      expect(niche.label.trim().length).toBeGreaterThan(0)
    }
  })
})
