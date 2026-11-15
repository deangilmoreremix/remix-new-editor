import { describe, it, expect } from 'vitest'
import { withoutAutoImported } from '../DemoPersonalizeProvider'
import { EMPTY_ASSET_LIBRARY, type PersonalizationAsset } from '../types'

const asset = (id: string, extra: Partial<PersonalizationAsset> = {}): PersonalizationAsset =>
  ({ id, url: `https://cdn.example.com/${id}.png`, name: id, type: 'logo', source: 'url', ...extra }) as PersonalizationAsset

const AUTO = new Set(['disc-1', 'disc-2'])

describe('withoutAutoImported', () => {
  it('removes auto-placed assets from every slot they were moved to', () => {
    const auto1 = asset('a1', { sourceDiscoveredAssetId: 'disc-1' })
    const auto2 = asset('a2', { sourceDiscoveredAssetId: 'disc-2' })
    const manual = asset('m1')
    const next = withoutAutoImported({
      ...EMPTY_ASSET_LIBRARY,
      identities: [auto1, manual],
      primaryIdentity: auto1,
      firstFrame: auto2,
      lastFrame: auto2,
      ctaGraphic: auto1,
      products: [auto2],
    }, AUTO)
    // Flag and pointer together, as for logos.
    expect(next.identities).toEqual([{ ...manual, isPrimary: true }])
    expect(next.primaryIdentity).toMatchObject({ id: 'm1', isPrimary: true })
    expect(next.firstFrame).toBeNull()
    expect(next.lastFrame).toBeNull()
    expect(next.ctaGraphic).toBeNull()
    expect(next.products).toEqual([])
  })

  it('promotes the remaining logo, flag and pointer together, when the primary goes', () => {
    const autoLogo = asset('a1', { sourceDiscoveredAssetId: 'disc-1', isPrimary: true })
    const manualLogo = asset('m1', { isPrimary: false })
    const next = withoutAutoImported({ ...EMPTY_ASSET_LIBRARY, logos: [autoLogo, manualLogo], primaryLogo: autoLogo }, AUTO)
    expect(next.logos).toHaveLength(1)
    expect(next.logos[0]).toMatchObject({ id: 'm1', isPrimary: true })
    expect(next.primaryLogo).toMatchObject({ id: 'm1', isPrimary: true })
  })

  it('keeps edited copies and a manual primary', () => {
    const edited = asset('a1', { sourceDiscoveredAssetId: 'disc-1', edited: true } as Partial<PersonalizationAsset>)
    const manual = asset('m1', { isPrimary: true })
    const next = withoutAutoImported({ ...EMPTY_ASSET_LIBRARY, logos: [manual, edited], primaryLogo: manual }, AUTO)
    expect(next.logos.map((a) => a.id)).toEqual(['m1', 'a1'])
    expect(next.primaryLogo?.id).toBe('m1')
  })
})
