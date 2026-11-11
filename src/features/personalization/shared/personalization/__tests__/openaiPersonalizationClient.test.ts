/**
 * OpenAI Personalization Client — endpoint & model verification
 *
 * Confirms that the shared server-side OpenAI client used by Personalization
 * routes image generation and editing to the correct endpoints with the
 * expected models. Global fetch is mocked so no network call is made.
 *
 *   editImage    → POST https://api.openai.com/v1/images/edits     (gpt-image-2.5-*)
 *   generateImage → POST https://api.openai.com/v1/images/generations (dall-e-3)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createPersonalizationOpenAIClient,
  PersonalizationOpenAIClient,
} from '../openaiPersonalizationClient'

const originalFetch = globalThis.fetch

/**
 * Request init built by PersonalizationOpenAIClient: a POST with a flat header
 * record (Authorization plus an optional Content-Type), an optional body and a
 * timeout signal. Declaring it keeps the mocked call arguments typed so the
 * assertions below read real properties instead of an opaque tuple.
 */
type OpenAIClientFetchInit = {
  method: string
  headers: Record<string, string>
  body?: BodyInit | null
  signal?: AbortSignal
}

function mockResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => data,
  } as unknown as Response
}

describe('PersonalizationOpenAIClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('editImage posts to /v1/images/edits with a gpt-image-2.5 model', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init: OpenAIClientFetchInit) =>
      mockResponse({ data: [{ url: 'https://example.com/edited.png' }] }),
    )
    globalThis.fetch = fetchMock

    const client: PersonalizationOpenAIClient = createPersonalizationOpenAIClient('sk-test')
    const result = await client.editImage({
      prompt: 'Remove the background and keep the logo',
      image: new Blob(['fake-image-bytes'], { type: 'image/png' }),
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/v1/images/edits')

    // editImage sends multipart/form-data; the model rides on the form.
    const body = init.body as FormData
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('model')).toBe('gpt-image-2.5-flare')
    expect(body.get('prompt')).toBe('Remove the background and keep the logo')
    expect(init.headers.Authorization).toBe('Bearer sk-test')

    expect(result).toEqual([{ url: 'https://example.com/edited.png' }])
  })

  it('generateImage posts to /v1/images/generations with the dall-e-3 model', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init: OpenAIClientFetchInit) =>
      mockResponse({ data: [{ url: 'https://example.com/generated.png', revisedPrompt: 'revised' }] }),
    )
    globalThis.fetch = fetchMock

    const client = createPersonalizationOpenAIClient('sk-test')
    const result = await client.generateImage({ prompt: 'A futuristic city skyline at sunset' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/v1/images/generations')

    // generateImage posts a JSON body.
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('dall-e-3')
    expect(body.prompt).toBe('A futuristic city skyline at sunset')
    expect(init.headers.Authorization).toBe('Bearer sk-test')
    expect(init.headers['Content-Type']).toBe('application/json')

    expect(result).toEqual([
      { url: 'https://example.com/generated.png', revisedPrompt: 'revised' },
    ])
  })
})
