// @vitest-environment jsdom
/**
 * remix-specific glue around the ported OpenHiggsBolt personalization system:
 * hash routing, studio → source mapping, and the API auth wrapper.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'

vi.mock('../../../lib/apiKeyManager.js', () => ({
  apiKeyManager: {
    getMuapiKey: () => 'mu-key',
    getOpenAIKey: () => 'sk-test-openai-key-1234567890',
  },
}))

import { toRemixRoute, navigate } from '../lib/navigation'
import { buildRemixSource } from '../mount.jsx'
import { installPersonalizationApiAuth } from '../lib/apiAuth'
import { writeHandoff } from '../shared/crossStudio'

describe('navigation shim', () => {
  it('maps OpenHiggsBolt studio paths onto remix hash routes', () => {
    expect(toRemixRoute('/studio/image')).toBe('#/image')
    expect(toRemixRoute('/studio/video')).toBe('#/video')
    expect(toRemixRoute('/studio/vfx-studio')).toBe('#/effects')
    expect(toRemixRoute('/studio/ai-influencer')).toBe('#/influencer')
    expect(toRemixRoute('/studio/motion-studio?template=a%7Cb')).toBe('#/animate?template=a%7Cb')
  })

  it('forwards the handoff prompt through prefill_prompt for prompt-only studios', () => {
    localStorage.removeItem('prefill_prompt')
    writeHandoff({ version: 1, target: 'cinema', from: 'demo-personalization', combinedPrompt: 'Acme Roofing hero shot' } as any)
    navigate('/studio/cinema')
    expect(window.location.hash).toBe('#/cinema')
    expect(localStorage.getItem('prefill_prompt')).toBe('Acme Roofing hero shot')
  })
})

describe('buildRemixSource', () => {
  it('opens prompt-only when the studio has no media yet', () => {
    const source = buildRemixSource({ studioId: 'image', studioName: 'Image Studio', prompt: '  a red car  ' })
    expect(source.mediaType).toBe('prompt-only')
    expect(source.sourceMedia).toBeNull()
    expect(source.sourceType).toBe('studio-project')
    expect(source.originalPrompt).toBe('a red car')
    expect(source.sourceMetadata).toMatchObject({ originStudio: 'image', remixStudioId: 'image' })
  })

  it('uses the studio media when there is a result on screen', () => {
    const source = buildRemixSource({ studioId: 'video', mediaUrl: 'https://cdn.example/out.mp4', prompt: 'p' })
    expect(source.sourceType).toBe('studio-project')
    expect(source.mediaType).toBe('video')
    expect(source.sourceMedia).toBe('https://cdn.example/out.mp4')
  })
})

describe('installPersonalizationApiAuth', () => {
  // The wrapper installs once per page, so it wraps one recording fetch.
  const calls: Array<{ url: string; headers: Headers }> = []

  beforeAll(() => {
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), headers: new Headers(init?.headers) })
      return new Response('{}')
    }) as typeof fetch
    ;(window as any).Clerk = { session: { getToken: async () => 'clerk-session-token' } }
    installPersonalizationApiAuth()
  })

  beforeEach(() => {
    calls.length = 0
  })

  afterAll(() => {
    delete (window as any).Clerk
  })

  it('adds the Clerk bearer to personalization API calls only', async () => {
    await window.fetch('/api/personalization/leads')
    await window.fetch('/api/other')
    expect(calls[0].headers.get('authorization')).toBe('Bearer clerk-session-token')
    expect(calls[1].headers.get('authorization')).toBeNull()
  })

  it("sends the user's OpenAI key only to the image routes", async () => {
    await window.fetch('/api/personalization/image-edit', { method: 'POST' })
    await window.fetch('/api/personalization/find-businesses', { method: 'POST' })
    expect(calls[0].headers.get('x-openai-key')).toBe('sk-test-openai-key-1234567890')
    expect(calls[1].headers.get('x-openai-key')).toBeNull()
  })
})

describe('inferMediaType', () => {
  it('lets the URL extension win over the studio hint', async () => {
    const { inferMediaType } = await import('../mount.jsx')
    expect(inferMediaType('https://cdn.example/ref.png', 'video')).toBe('image')
    expect(inferMediaType('https://cdn.example/out.mp4?x=1', 'image')).toBe('video')
    expect(inferMediaType('https://cdn.example/asset', 'video')).toBe('video')
    expect(inferMediaType('https://cdn.example/asset')).toBe('image')
  })
})

describe('studio hand-off staging', () => {
  it('stages the prompt and reference image for Image Studio', async () => {
    const { consumeStudioPrefill } = await import('../../../lib/studioPrefill.js')
    writeHandoff({
      version: 1,
      target: 'image',
      from: 'demo-personalization',
      combinedPrompt: 'Acme hero',
      referenceImageUrl: 'https://cdn.example/result.png',
    } as any)
    navigate('/studio/image')
    const staged = consumeStudioPrefill('image')
    expect(staged?.prompt).toBe('Acme hero')
    expect(staged?.params?.referenceImageUrl).toBe('https://cdn.example/result.png')
  })
})
