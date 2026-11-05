import { describe, it, expect, vi } from 'vitest'

const saveAsset = vi.hoisted(() => vi.fn(async () => ({ id: 'asset-1', url: 'https://store.example/v.mp4' })))
vi.mock('../../../lib/assetLibrary.js', () => ({ saveAsset }))

import { saveToRemixAssetLibrary } from '../lib/remixAssetLibrary'
import { buildPreviewInput } from '../shared/personalization/guided/buildPreviewInput'

describe('saveToRemixAssetLibrary', () => {
  it('saves into remix\'s permanent Asset Library (the one the Library page lists)', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'personalized.mp4', { type: 'video/mp4' })
    const saved = await saveToRemixAssetLibrary(file)
    expect(saveAsset).toHaveBeenCalledWith(file, {}, { source: 'personalization' })
    expect(saved).toEqual({ id: 'asset-1', url: 'https://store.example/v.mp4' })
  })
})

describe('buildPreviewInput', () => {
  const base = { previewSettings: { audio: null } as any, previewVideo: null, clientForm: {}, assets: { products: [] } as any }

  it('keeps a still-image source out of videoUrl and uses it as the poster', () => {
    const input = buildPreviewInput({ ...base, source: { mediaType: 'image', sourceMedia: 'https://cdn.example/a.png', poster: null } as any })
    expect(input.isImageSource).toBe(true)
    expect(input.videoUrl).toBeNull()
    expect(input.posterUrl).toBe('https://cdn.example/a.png')
  })

  it('still uses an explicitly selected preview video for an image source', () => {
    const input = buildPreviewInput({
      ...base,
      previewVideo: { url: 'https://cdn.example/b.mp4', poster: null } as any,
      source: { mediaType: 'image', sourceMedia: 'https://cdn.example/a.png', poster: null } as any,
    })
    expect(input.videoUrl).toBe('https://cdn.example/b.mp4')
  })

  it('uses the source media as the video for video sources', () => {
    const input = buildPreviewInput({ ...base, source: { mediaType: 'video', sourceMedia: 'https://cdn.example/s.mp4', poster: 'https://cdn.example/p.jpg' } as any })
    expect(input.videoUrl).toBe('https://cdn.example/s.mp4')
    expect(input.posterUrl).toBe('https://cdn.example/p.jpg')
  })
})
