import { beforeEach, describe, expect, it, vi } from 'vitest'

const muapi = vi.hoisted(() => ({
  generateI2V: vi.fn(async () => ({ url: 'https://out.example/i2v.mp4' })),
  generateVideo: vi.fn(async () => ({ url: 'https://out.example/t2v.mp4' })),
  processV2V: vi.fn(),
  processRecast: vi.fn(),
  generateI2I: vi.fn(),
  processLipSync: vi.fn(),
  uploadFile: vi.fn(),
}))
vi.mock('@ohb/packages/studio/src/muapi', () => muapi)
vi.mock('@ohb/lib/authConfig', () => ({ getOpenAiKey: () => '', getApiKey: () => 'k' }))

import { runGeneration } from '../generationRouter'

const source = (model: string, poster: string | null = null) => ({
  sourceType: 'landing-demo', id: 'd', title: 't', mediaType: 'video',
  sourceMedia: 'https://cdn.example/source.mp4', poster, shortPrompt: 'p', fullPrompt: 'p', originalPrompt: 'p',
  model, aspectRatio: '16:9', duration: 5, sourceMetadata: {},
}) as any

const run = (model: string, directInputs: Record<string, unknown>, poster: string | null = null) =>
  runGeneration({
    source: source(model, poster),
    client: {},
    assets: {} as any,
    resolved: { directInputs, promptContext: {}, postProcessing: {} } as any,
    prompt: 'make it mine',
    mode: 'recreate',
    options: { model } as any,
    apiKey: 'k',
  } as any)

beforeEach(() => vi.clearAllMocks())

describe('image-to-video source models', () => {
  it('sends an I2V-only model through generateI2V with a start image, even for a video source', async () => {
    // The resolver supplies video_url for a video source; seedance-2-i2v exists only in the I2V catalog.
    const result = await run('seedance-2-i2v', { video_url: 'https://cdn.example/source.mp4' }, 'https://cdn.example/poster.jpg')
    expect(muapi.generateVideo).not.toHaveBeenCalled()
    expect(muapi.generateI2V).toHaveBeenCalledTimes(1)
    const params = (muapi.generateI2V.mock.calls[0] as any)[1]
    expect(params.model).toBe('seedance-2-i2v')
    expect(params.image_url).toBe('https://cdn.example/poster.jpg')
    expect(result.url).toBe('https://out.example/i2v.mp4')
  })

  it('prefers the first frame over the poster as the start image', async () => {
    await run('seedance-2-i2v', { video_url: 'v.mp4', first_image_url: 'https://cdn.example/first.jpg' }, 'https://cdn.example/poster.jpg')
    expect((muapi.generateI2V.mock.calls[0] as any)[1].image_url).toBe('https://cdn.example/first.jpg')
  })

  it('says a start image is needed instead of submitting a bad request', async () => {
    await expect(run('seedance-2-i2v', { video_url: 'https://cdn.example/source.mp4' })).rejects.toThrow(/start image/i)
    expect(muapi.generateI2V).not.toHaveBeenCalled()
    expect(muapi.generateVideo).not.toHaveBeenCalled()
  })

  it('still uses generateVideo for a text-to-video model', async () => {
    const id = 'seedance-2-t2v'
    await run(id, { video_url: 'https://cdn.example/source.mp4' })
    expect(muapi.generateVideo).toHaveBeenCalledTimes(1)
    expect(muapi.generateI2V).not.toHaveBeenCalled()
  })
})
