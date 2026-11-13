import { describe, it, expect } from 'vitest'
import { mergeDiscoveredAssets } from '../DemoPersonalizeProvider'
import type { DiscoveredAsset } from '../types'

const a = (o: Partial<DiscoveredAsset>): DiscoveredAsset => ({ id: 'x', previewUrl: 'https://s/x.jpg', category: 'logo', ...o }) as DiscoveredAsset

describe('mergeDiscoveredAssets', () => {
  it('keeps cutouts and removal state the browser added when the final result arrives', () => {
    const prev = [a({ id: '1', editedDataUrl: 'data:image/png;base64,CUT', edited: true, hasTransparency: true, videoReady: true, originalPreviewUrl: 'https://s/1.jpg', bgRemoval: { status: 'done' }, showOriginal: true })]
    const next = [a({ id: '1', previewUrl: 'https://s/1.jpg', relevanceScore: 9 }), a({ id: '2' })]
    const merged = mergeDiscoveredAssets(prev, next)
    expect(merged[0].editedDataUrl).toBe('data:image/png;base64,CUT')
    expect(merged[0].hasTransparency).toBe(true)
    expect(merged[0].bgRemoval).toEqual({ status: 'done' })
    expect(merged[0].showOriginal).toBe(true)
    expect(merged[0].relevanceScore).toBe(9) // server fields win
    expect(merged[1].editedDataUrl).toBeUndefined() // new assets are untouched
  })

  it('keeps verified transparency of an already-transparent image that got no cutout', () => {
    const prev = [a({ id: '1', hasTransparency: true, bgRemoval: { status: 'skipped', message: 'Transparent' } })]
    const merged = mergeDiscoveredAssets(prev, [a({ id: '1' })])
    expect(merged[0].hasTransparency).toBe(true)
    expect(merged[0].editedDataUrl).toBeUndefined()
  })

  it('returns the new list as is when there was nothing before', () => {
    const next = [a({ id: '1' })]
    expect(mergeDiscoveredAssets([], next)).toBe(next)
  })
})
