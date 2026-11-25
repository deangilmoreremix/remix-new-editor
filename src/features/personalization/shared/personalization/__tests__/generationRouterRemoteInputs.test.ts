// @vitest-environment jsdom
/**
 * The two ways a generation used to fail before it reached the model:
 *  - MuAPI fetches inputs from its own servers, so a demo-library video (`/media/...`), a `blob:` upload or inline data
 *    has to be hosted on MuAPI first;
 *  - images are made by OpenAI, so they need the visitor's OpenAI key. The MuAPI key must never be sent to OpenAI.
 * MuAPI and OpenAI are mocked: no credits are spent.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const openai = vi.hoisted(() => ({
  generateImage: vi.fn(async () => [{ url: 'https://openai.test/new.png' }]),
  editImage: vi.fn(async () => [{ b64_json: 'ZmFrZQ==' }]),
  createdWith: [] as string[],
}))
vi.mock('../openaiPersonalizationClient', () => ({
  createPersonalizationOpenAIClient: (key: string) => {
    openai.createdWith.push(key)
    return { generateImage: openai.generateImage, editImage: openai.editImage }
  },
}))

const muapi = vi.hoisted(() => ({
  generateVideo: vi.fn(async () => ({ url: 'https://cdn.muapi/out.mp4' })),
  generateI2V: vi.fn(async () => ({ url: 'https://cdn.muapi/out.mp4' })),
  generateI2I: vi.fn(async () => ({ url: 'https://cdn.muapi/out.png' })),
  processMotionControl: vi.fn(async () => ({ url: 'https://cdn.muapi/out.mp4' })),
  processLipSync: vi.fn(async () => ({ url: 'https://cdn.muapi/out.mp4' })),
  processV2V: vi.fn(async () => ({ url: 'https://cdn.muapi/out.mp4' })),
  uploadFile: vi.fn(async (_key: string, file: File) => `https://cdn.muapi/uploads/${file.name}`),
}))
vi.mock('@ohb/packages/studio/src/muapi', () => muapi)

import { runGeneration, needsUpload } from '../generationRouter'
import type { GenerationInput } from '../generationRouter'

const OPTIONS = { engine: 'smartvideo-recommended', preserveAudio: true, exactLogoHandling: 'final-overlay', exactCtaHandling: 'ai-generated', firstFrameMode: 'none' } as never

function input(overrides: Partial<GenerationInput> & { directInputs?: Record<string, unknown>; mediaType?: 'video' | 'image'; sourceMedia?: string } = {}): GenerationInput {
  const { directInputs = {}, mediaType = 'video', sourceMedia = '/media/demo.mp4', ...rest } = overrides
  return {
    source: { id: 'demo', title: 'Demo', mediaType, sourceMedia, originalPrompt: '', fullPrompt: '', shortPrompt: '', sourceType: 'landing-demo', sourceMetadata: {} } as never,
    client: {},
    assets: {} as never,
    resolved: { directInputs, promptContext: {}, preProcessing: {}, postProcessing: {}, unusedSavedReferences: [] } as never,
    prompt: 'Recreate this video for Acme Roofing.',
    mode: null,
    options: OPTIONS,
    apiKey: 'mu-key',
    ...rest,
  }
}

beforeEach(() => {
  for (const fn of Object.values(muapi)) fn.mockClear()
  openai.generateImage.mockClear()
  openai.editImage.mockClear()
  openai.createdWith.length = 0
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(['bytes'], { type: 'video/mp4' }) })))
})

describe('local files are uploaded so MuAPI can read them', () => {
  it('flags relative, blob, data and same-host URLs only', () => {
    expect(needsUpload('/media/demo.mp4')).toBe(true)
    expect(needsUpload('blob:http://localhost/abc')).toBe(true)
    expect(needsUpload('data:video/mp4;base64,AAAA')).toBe(true)
    expect(needsUpload(`${window.location.origin}/clip.mp4`)).toBe(true)
    expect(needsUpload('https://cdn.example.com/clip.mp4')).toBe(false)
    expect(needsUpload('')).toBe(false)
  })

  it('hosts a demo-library video on MuAPI before the video call, and sends the hosted URL', async () => {
    await runGeneration(input({ directInputs: { video_url: '/media/demo.mp4' } }))
    expect(muapi.uploadFile).toHaveBeenCalledTimes(1)
    const [key, file] = muapi.uploadFile.mock.calls[0] as unknown as [string, File]
    expect(key).toBe('mu-key')
    expect(file.name).toBe('demo.mp4')
    const sent = JSON.stringify([...muapi.generateVideo.mock.calls, ...muapi.processV2V.mock.calls])
    expect(sent).toContain('https://cdn.muapi/uploads/demo.mp4')
    expect(sent).not.toContain('"/media/demo.mp4"')
  })

  it('does not re-upload a public https URL', async () => {
    await runGeneration(input({ sourceMedia: 'https://cdn.example.com/clip.mp4', directInputs: { video_url: 'https://cdn.example.com/clip.mp4' } }))
    expect(muapi.uploadFile).not.toHaveBeenCalled()
  })

  it('uploads the same file once even when it is used as source and as an input', async () => {
    await runGeneration(input({ directInputs: { video_url: '/media/demo.mp4' } }))
    expect(muapi.uploadFile).toHaveBeenCalledTimes(1)
  })
})

describe("images use the visitor's own OpenAI key", () => {
  it('asks for the OpenAI key instead of sending the MuAPI key to OpenAI', async () => {
    await expect(runGeneration(input({ mediaType: 'image', sourceMedia: 'https://cdn.example.com/a.png' }))).rejects.toThrow(/OpenAI key/)
    expect(openai.createdWith).toEqual([])
  })

  it('creates the OpenAI client with the OpenAI key, never the MuAPI key', async () => {
    await runGeneration(input({ mediaType: 'image', sourceMedia: 'https://cdn.example.com/a.png', openaiKey: 'oa-key' }))
    expect(openai.createdWith).toEqual(['oa-key'])
    expect(openai.createdWith).not.toContain('mu-key')
  })
})
