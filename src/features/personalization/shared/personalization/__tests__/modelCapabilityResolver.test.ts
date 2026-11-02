import { describe, it, expect } from 'vitest'
import { resolveModelCapabilities, resolveAssetsForModel } from '../modelCapabilityResolver'
import type { PersonalizationSource, AssetLibrary, GenerationOptions, PersonalizationAsset } from '../types'

const EMPTY_SOURCE: PersonalizationSource = {
  sourceType: 'landing-demo',
  id: 'demo-1',
  title: 'Test',
  mediaType: 'video',
  sourceMedia: 'https://example.com/source.mp4',
  poster: null,
  shortPrompt: 'test',
  fullPrompt: 'test',
  originalPrompt: 'test',
  aspectRatio: '16:9',
  duration: 10,
  sourceMetadata: {},
}

const EMPTY_ASSETS: AssetLibrary = {
  identities: [],
  primaryIdentity: null,
  logos: [],
  primaryLogo: null,
  products: [],
  brandReferences: [],
  firstFrame: null,
  lastFrame: null,
  ctaGraphic: null,
  audio: [],
  savedReferences: [],
}

function makeAsset(overrides: Partial<PersonalizationAsset> = {}): PersonalizationAsset {
  return {
    id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role: 'presenter_identity',
    name: 'test.jpg',
    url: 'https://example.com/test.jpg',
    uploadedUrl: 'https://example.com/test.jpg',
    isPrimary: false,
    mimeType: 'image/jpeg',
    createdAt: new Date().toISOString(),
    uploadStatus: 'ready',
    file: null,
    ...overrides,
  }
}

describe('resolveModelCapabilities', () => {
  const baseOptions: GenerationOptions = {
    engine: 'smartvideo-recommended',
    preserveAudio: true,
    exactLogoHandling: 'final-overlay',
    exactCtaHandling: 'final-end-card',
    firstFrameMode: 'none',
    lastFrameMode: 'none',
    consentGiven: false,
  }

  it('resolves face swap capabilities for ai-video-face-swap', () => {
    const caps = resolveModelCapabilities(EMPTY_SOURCE, { ...baseOptions, model: 'ai-video-face-swap' })
    expect(caps.supportsFaceSwap).toBe(true)
    expect(caps.supportsV2V).toBe(true)
    expect(caps.imageField).toBe('image_url')
    expect(caps.videoField).toBe('video_url')
    expect(caps.aspectRatioOptions).toEqual([])
    expect(caps.resolutionOptions).toEqual([])
    expect(caps.qualityOptions).toEqual([])
    expect(caps.durationOptions).toEqual([])
  })

  it('resolves recast capabilities for kling-v3.0-pro-recast', () => {
    const caps = resolveModelCapabilities(EMPTY_SOURCE, { ...baseOptions, model: 'kling-v3.0-pro-recast' })
    expect(caps.supportsPersonReplacement).toBe(true)
    expect(caps.supportsRecast).toBe(true)
    expect(caps.supportsV2V).toBe(true)
    expect(caps.aspectRatioOptions).toEqual([])
  })

  it('resolves V2V capabilities for runway-aleph-v2v', () => {
    const caps = resolveModelCapabilities(EMPTY_SOURCE, { ...baseOptions, model: 'runway-aleph-v2v' })
    expect(caps.supportsV2V).toBe(true)
    expect(caps.supportsFaceSwap).toBe(false)
    expect(caps.supportsPersonReplacement).toBe(false)
    expect(caps.aspectRatioOptions).toEqual([])
  })

  it('resolves V2V capabilities for kling-o1-video-edit', () => {
    const caps = resolveModelCapabilities(EMPTY_SOURCE, { ...baseOptions, model: 'kling-o1-video-edit' })
    expect(caps.supportsV2V).toBe(true)
    expect(caps.maxImages).toBe(4)
    expect(caps.aspectRatioOptions).toEqual(['16:9', '9:16', '1:1'])
  })

  it('resolves aspect ratio and duration options for seedance-2-t2v', () => {
    const caps = resolveModelCapabilities(EMPTY_SOURCE, { ...baseOptions, model: 'seedance-2-t2v' })
    expect(caps.aspectRatioOptions).toEqual(['16:9', '9:16', '4:3', '3:4'])
    expect(caps.durationOptions).toEqual([5, 10, 15])
    expect(caps.qualityOptions).toEqual(['high', 'basic'])
    expect(caps.resolutionOptions).toEqual([])
  })

  it('does not falsely assign face swap to non-face models', () => {
    const caps = resolveModelCapabilities(EMPTY_SOURCE, { ...baseOptions, model: 'flux-dev' })
    expect(caps.supportsFaceSwap).toBe(false)
  })
})

describe('resolveAssetsForModel', () => {
  const baseOptions: GenerationOptions = {
    engine: 'smartvideo-recommended',
    preserveAudio: true,
    exactLogoHandling: 'final-overlay',
    exactCtaHandling: 'final-end-card',
    firstFrameMode: 'none',
    lastFrameMode: 'none',
    consentGiven: false,
  }

  it('routes identity image to direct inputs for face_only with ai-video-face-swap', () => {
    const source: PersonalizationSource = {
      ...EMPTY_SOURCE,
      mediaType: 'video',
      sourceMedia: 'https://example.com/source.mp4',
    }
    const assets: AssetLibrary = {
      ...EMPTY_ASSETS,
      primaryIdentity: makeAsset({ url: 'https://example.com/identity.jpg', uploadedUrl: 'https://example.com/identity.jpg' }),
      identities: [makeAsset({ url: 'https://example.com/identity.jpg', uploadedUrl: 'https://example.com/identity.jpg' })],
    }
    const caps = resolveModelCapabilities(source, { ...baseOptions, model: 'ai-video-face-swap' })
    const resolved = resolveAssetsForModel(source, assets, 'face_only', baseOptions, caps)

    expect(resolved.directInputs.image_url).toBe('https://example.com/identity.jpg')
    expect(resolved.directInputs.video_url).toBe('https://example.com/source.mp4')
  })

  it('routes identity image to direct inputs for full_body with kling-v3.0-pro-recast', () => {
    const source: PersonalizationSource = {
      ...EMPTY_SOURCE,
      mediaType: 'video',
      sourceMedia: 'https://example.com/source.mp4',
    }
    const assets: AssetLibrary = {
      ...EMPTY_ASSETS,
      primaryIdentity: makeAsset({ url: 'https://example.com/identity.jpg', uploadedUrl: 'https://example.com/identity.jpg' }),
      identities: [makeAsset({ url: 'https://example.com/identity.jpg', uploadedUrl: 'https://example.com/identity.jpg' })],
    }
    const caps = resolveModelCapabilities(source, { ...baseOptions, model: 'kling-v3.0-pro-recast' })
    const resolved = resolveAssetsForModel(source, assets, 'full_body', baseOptions, caps)

    expect(resolved.directInputs.image_url).toBe('https://example.com/identity.jpg')
    expect(resolved.directInputs.video_url).toBe('https://example.com/source.mp4')
  })

  it('routes source video to direct inputs for recreate with runway-aleph-v2v', () => {
    const source: PersonalizationSource = {
      ...EMPTY_SOURCE,
      mediaType: 'video',
      sourceMedia: 'https://example.com/source.mp4',
    }
    const assets: AssetLibrary = {
      ...EMPTY_ASSETS,
      primaryIdentity: makeAsset({ url: 'https://example.com/identity.jpg', uploadedUrl: 'https://example.com/identity.jpg' }),
      identities: [makeAsset({ url: 'https://example.com/identity.jpg', uploadedUrl: 'https://example.com/identity.jpg' })],
    }
    const caps = resolveModelCapabilities(source, { ...baseOptions, model: 'runway-aleph-v2v' })
    const resolved = resolveAssetsForModel(source, assets, 'recreate', baseOptions, caps)

    expect(resolved.directInputs.video_url).toBe('https://example.com/source.mp4')
  })

  it('puts logo in postProcessing for exact overlay', () => {
    const source: PersonalizationSource = {
      ...EMPTY_SOURCE,
      mediaType: 'video',
      sourceMedia: 'https://example.com/source.mp4',
    }
    const assets: AssetLibrary = {
      ...EMPTY_ASSETS,
      primaryLogo: makeAsset({ role: 'logo', url: 'https://example.com/logo.png', uploadedUrl: 'https://example.com/logo.png' }),
      logos: [makeAsset({ role: 'logo', url: 'https://example.com/logo.png', uploadedUrl: 'https://example.com/logo.png' })],
    }
    const caps = resolveModelCapabilities(source, { ...baseOptions, model: 'runway-aleph-v2v' })
    const resolved = resolveAssetsForModel(source, assets, 'recreate', baseOptions, caps)

    expect(resolved.postProcessing.logo).toBe('https://example.com/logo.png')
  })

  it('rejects blob URLs in direct inputs', () => {
    const source: PersonalizationSource = {
      ...EMPTY_SOURCE,
      mediaType: 'video',
      sourceMedia: 'https://example.com/source.mp4',
    }
    const assets: AssetLibrary = {
      ...EMPTY_ASSETS,
      primaryIdentity: makeAsset({ url: 'blob:http://localhost/test', uploadedUrl: undefined }),
    }
    const caps = resolveModelCapabilities(source, { ...baseOptions, model: 'ai-video-face-swap' })
    const resolved = resolveAssetsForModel(source, assets, 'face_only', baseOptions, caps)

    expect(resolved.directInputs.image_url).toBeUndefined()
    expect(resolved.directInputs.video_url).toBe('https://example.com/source.mp4')
  })
})
