import { describe, expect, it } from 'vitest'
import type { AssetLibrary, GenerationOptions, PersonalizationAsset, PersonalizationSource } from '../types'
import {
  fitToModel,
  FACE_SWAP_MODEL,
  FULL_BODY_MODEL,
  optionsForGeneration,
  resolveAssetsForModel,
  resolveModelCapabilities,
} from '../modelCapabilityResolver'

// Face only / Full presenter used to work out what to send from the demo's own
// model (e.g. a text-to-video model), so the presenter photo was never sent and
// the run failed with "No identity image provided".

const demo = {
  id: 'demo-1', title: 'Demo', mediaType: 'video', originalPrompt: 'p', fullPrompt: 'p', shortPrompt: 'p',
  sourceMedia: 'https://cdn.example/demo.mp4', poster: null, sourceType: 'landing-demo', sourceMetadata: {},
  model: 'veo-4-text-to-video',
} as unknown as PersonalizationSource

const photo = {
  id: 'face-1', name: 'face.jpg', role: 'presenter_identity', url: 'https://cdn.example/face.jpg',
  uploadedUrl: 'https://cdn.example/face.jpg', uploadStatus: 'ready', isPrimary: true,
} as unknown as PersonalizationAsset

const assets = {
  identities: [photo], primaryIdentity: photo, logos: [], primaryLogo: null, products: [], brandReferences: [],
  firstFrame: null, lastFrame: null, ctaGraphic: null, savedReferences: [],
} as unknown as AssetLibrary

const options = { engine: 'smartvideo-recommended', preserveAudio: true, consentGiven: true } as unknown as GenerationOptions

describe('generation uses the model the mode really calls', () => {
  it('Face only sends the presenter photo even when the demo uses another model', () => {
    const modelOptions = optionsForGeneration(demo, options, 'face_only')
    expect(modelOptions.model).toBe(FACE_SWAP_MODEL)
    const resolved = resolveAssetsForModel(demo, assets, 'face_only', modelOptions, resolveModelCapabilities(demo, modelOptions))
    expect(resolved.directInputs.image_url).toBe('https://cdn.example/face.jpg')
  })

  it('Full presenter sends the presenter photo', () => {
    const modelOptions = optionsForGeneration(demo, options, 'full_body')
    expect(modelOptions.model).toBe(FULL_BODY_MODEL)
    const resolved = resolveAssetsForModel(demo, assets, 'full_body', modelOptions, resolveModelCapabilities(demo, modelOptions))
    expect(resolved.directInputs.image_url).toBe('https://cdn.example/face.jpg')
  })

  it("(the old way: the demo's own model) never sent the photo", () => {
    const resolved = resolveAssetsForModel(demo, assets, 'face_only', options, resolveModelCapabilities(demo, options))
    expect(resolved.directInputs.image_url).toBeUndefined()
  })

  it('an advanced model choice still applies to Recreate', () => {
    expect(optionsForGeneration(demo, { ...options, advancedModel: 'kling-v2' }, 'recreate').model).toBe('kling-v2')
  })
})

describe('fitToModel', () => {
  const veo = { aspectRatioOptions: ['16:9', '9:16', '1:1'], durationOptions: [4, 6, 8] }

  it('keeps what the user chose when the model supports it', () => {
    expect(fitToModel(veo, { aspectRatio: '9:16', durationSeconds: 6 })).toEqual({ aspectRatio: '9:16', duration: 6 })
  })

  it('never sends a ratio the model lacks; uses the nearest length it offers', () => {
    expect(fitToModel(veo, { aspectRatio: '4:5', durationSeconds: 5 }, '1:1')).toEqual({ aspectRatio: '1:1', duration: 4 })
    expect(fitToModel(veo, { aspectRatio: '4:5', durationSeconds: 30 })).toEqual({ aspectRatio: '16:9', duration: 8 })
  })

  it('passes values through for models without fixed options', () => {
    expect(fitToModel({ aspectRatioOptions: [], durationOptions: [] }, { aspectRatio: '4:5', durationSeconds: 12 })).toEqual({ aspectRatio: '4:5', duration: 12 })
  })
})

describe('image demos: Replace person keeps the demo image', () => {
  it('edits the demo image and sends the photo as a second image', () => {
    const imageDemo = { ...demo, mediaType: 'image', sourceMedia: 'https://cdn.example/design.png', model: 'gpt-image-2.5-flare' } as PersonalizationSource
    const modelOptions = optionsForGeneration(imageDemo, options, 'replace_person')
    const resolved = resolveAssetsForModel(imageDemo, assets, 'replace_person', modelOptions, resolveModelCapabilities(imageDemo, modelOptions))
    expect(resolved.directInputs.image_url).toBe('https://cdn.example/design.png')
    expect(resolved.directInputs.reference_image_url).toBe('https://cdn.example/face.jpg')
  })
})
