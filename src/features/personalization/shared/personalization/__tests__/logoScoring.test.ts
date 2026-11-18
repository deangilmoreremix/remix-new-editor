import { describe, expect, it } from 'vitest'
import { pickBestLogo, scoreLogoCandidate } from '../logoScoring'
import type { DiscoveredAsset } from '../types'

const a = (over: Partial<DiscoveredAsset> & { sourceUrl: string }): DiscoveredAsset =>
  ({ id: over.sourceUrl, previewUrl: over.sourceUrl, category: 'logo', selected: false, recommended: false, rejected: false, assignedSection: 'logo', autoAssigned: false, sourceType: 'website', ...over }) as DiscoveredAsset

describe('logo scoring', () => {
  it('prefers a named transparent SVG over a favicon and a banner', () => {
    const picked = pickBestLogo([
      a({ sourceUrl: 'https://x.com/favicon-32.png' }),
      a({ sourceUrl: 'https://x.com/img/banner.jpg' }),
      a({ sourceUrl: 'https://x.com/assets/logo.svg', hasTransparency: true }),
    ])
    expect(picked?.sourceUrl).toContain('logo.svg')
  })
  it('prefers a transparent PNG over a JPEG with the same name', () => {
    expect(scoreLogoCandidate({ sourceUrl: 'https://x.com/logo.png', hasTransparency: true })).toBeGreaterThan(
      scoreLogoCandidate({ sourceUrl: 'https://x.com/logo.jpg' }),
    )
  })
  it('lets discovery recommendation break ties', () => {
    const picked = pickBestLogo([a({ sourceUrl: 'https://x.com/a.png' }), a({ sourceUrl: 'https://x.com/b.png', recommended: true })])
    expect(picked?.sourceUrl).toContain('b.png')
  })
  it('returns null for no candidates and tolerates odd URLs', () => {
    expect(pickBestLogo([])).toBeNull()
    expect(Number.isFinite(scoreLogoCandidate({ sourceUrl: '::::' }))).toBe(true)
  })
})

import { logoQualityNotes } from '../logoScoring'
describe('logoQualityNotes', () => {
  it('flags small and JPEG logos, and stays quiet otherwise', () => {
    expect(logoQualityNotes({ width: 120, height: 80, mimeType: 'image/png', hasTransparency: true })).toHaveLength(1)
    expect(logoQualityNotes({ name: 'logo.jpg', mimeType: 'image/jpeg', width: 800, height: 800 })[0]).toContain('JPEG')
    expect(logoQualityNotes({ name: 'logo.svg', mimeType: 'image/svg+xml' })).toEqual([])
    expect(logoQualityNotes({ mimeType: 'image/png', width: 900, height: 400, hasTransparency: true })).toEqual([])
    expect(logoQualityNotes({ name: 'logo.jpg', mimeType: 'image/jpeg', hasTransparency: true })).toEqual([])
    expect(logoQualityNotes(null)).toEqual([])
    expect(logoQualityNotes({})).toEqual([])
  })
})
