import { describe, it, expect } from 'vitest'
import { summarizeAssetUsage } from '../assetUsage'
import { applyLayoutPreset, createDefaultPreviewSettings } from '../presets'
import type { PersonalizationAsset } from '../../types'

const asset = (id: string, url: string): PersonalizationAsset => ({ id, role: 'product_image' as never, name: id, url, isPrimary: false, createdAt: '' } as PersonalizationAsset)
const brand = (over: object = {}) => ({ businessName: 'B', headline: 'H', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null, ...over })
const settings = () => applyLayoutPreset(createDefaultPreviewSettings(), 'product-showcase')

describe('summarizeAssetUsage', () => {
  it('25 imported pictures with nothing assigned: none appear', () => {
    const lib = Array.from({ length: 25 }, (_, i) => asset(`a${i}`, `https://x/${i}.png`))
    const s = summarizeAssetUsage(lib, settings(), brand())
    expect(s).toMatchObject({ total: 25, imported: 25, assigned: 0, rendered: 0, unused: 25 })
  })
  it('a picture a visible layer draws is rendered; the rest stay imported', () => {
    const lib = Array.from({ length: 25 }, (_, i) => asset(`a${i}`, `https://x/${i}.png`))
    const s = summarizeAssetUsage(lib, settings(), brand({ productUrl: 'https://x/3.png', logoUrl: 'https://x/9.png' }))
    expect(s.rendered).toBeGreaterThanOrEqual(2)
    expect(s.items.find((i) => i.assetId === 'a3')).toMatchObject({ state: 'rendered', auto: true })
    expect(s.items.find((i) => i.assetId === 'a3')!.usedBy).toContain('Product image')
    expect(s.imported).toBe(25 - s.rendered)
    expect(s.unused).toBe(25 - s.rendered)
  })
  it('an explicit layer picture is not marked automatic; a hidden layer makes it assigned, not rendered', () => {
    const st = settings()
    const layers = st.layers.map((l) => (l.kind === 'productImage' ? { ...l, imageUrl: 'https://x/5.png', visible: false } : l))
    const s = summarizeAssetUsage([asset('a5', 'https://x/5.png')], { layers }, brand())
    expect(s.items[0]).toMatchObject({ state: 'assigned', auto: false })
    expect(s.rendered).toBe(0)
  })
  it('matches an uploaded URL as well as the original', () => {
    const a = { ...asset('u1', 'blob:local'), uploadedUrl: 'https://cdn/u1.png' }
    const s = summarizeAssetUsage([a], settings(), brand({ productUrl: 'https://cdn/u1.png' }))
    expect(s.items[0].state).toBe('rendered')
  })
})
