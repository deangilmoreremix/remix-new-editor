/**
 * Phase 29 - Provider Negative Regression Tests
 *
 * Authoritative routing architecture for AI Assist + Personalization:
 *
 *   Personalization image generation/editing:
 *     - recreate (t2i)  → openaiClient.generateImage() → /images/generations (OpenAI)
 *     - replace_face    → openaiClient.editImage() → /images/edits (OpenAI)
 *     - replace_person  → openaiClient.editImage() → /images/edits (OpenAI)
 *     - keep_design     → openaiClient.editImage() → /images/edits (OpenAI)
 *     → NEVER calls MuAPI generateImage or generateI2I
 *
 *   Personalization video generation:
 *     - recreate (t2v)  → MuAPI generateVideo (MuAPI)
 *     - i2v             → MuAPI generateI2V (MuAPI)
 *     - face_only (v2v) → MuAPI processV2V (MuAPI)
 *     - full_body       → MuAPI processMotionControl (Seedance recast)
 *     → NEVER calls OpenAI /images/generations for video
 *
 *   AI Assist image tools (AiAssistantModal):
 *     - upscale, background-remove, style-transfer, restore → editImage() → /api/proxy/openai-image (OpenAI)
 *     → NEVER calls MuAPI enhanceImage()
 *
 *   Text enhancement (AiAssistantModal):
 *     - rewrite, tone, expand, summarize, translate → callOpenAIChat() → /api/proxy/openai-enhance (OpenAI)
 *
 *   Vision analysis:
 *     - analyze_asset → POST /api/personalization/image-analyze (OpenAI Responses API)
 *
 *   Persistence:
 *     - project, record, generated-video → POST /api/personalization/* (Supabase)
 *
 * These are mandatory architectural regression tests.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { runGeneration } from '@ohb/shared/personalization/generationRouter'
import type { PersonalizationSource, AssetLibrary, ResolvedAssets, GenerationOptions } from '@ohb/shared/personalization/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Track every OpenAI call
const openaiCalls: { endpoint: string; body?: unknown }[] = []

vi.mock('@ohb/shared/personalization/openaiPersonalizationClient', () => {
  const actual = vi.importActual('@/shared/personalization/openaiPersonalizationClient')
  return {
    ...(actual as any),
    createPersonalizationOpenAIClient: vi.fn(() => ({
      generateImage: vi.fn(async (params: unknown) => {
        openaiCalls.push({ endpoint: '/images/generations', body: params })
        return [{ url: 'https://openai.test/image.png', revisedPrompt: 'revised' }]
      }),
      editImage: vi.fn(async (params: unknown) => {
        openaiCalls.push({ endpoint: '/images/edits', body: params })
        return [{ b64_json: 'ZmFrZQ==' }]
      }),
    })),
  }
})

// Mock MuAPI - we spy on the actual exports so toHaveBeenCalled works
const muapiCalls: Record<string, unknown[]> = {
  generateImage: [],
  generateI2I: [],
  generateVideo: [],
  generateI2V: [],
  processV2V: [],
  processRecast: [],
  processMotionControl: [],
  processLipSync: [],
  uploadFile: [],
}

// remix: image generation reads the user's OpenAI key from Settings
// (generationRouter -> getOpenAiKey), separate from the MuAPI `apiKey`.
vi.mock('@ohb/lib/authConfig', () => ({
  getOpenAiKey: () => 'sk-openai-test',
  getApiKey: () => 'sk-test',
}))

vi.mock('@ohb/packages/studio/src/muapi', () => {
  const makeSpy = (name: string) => {
    return vi.fn(async (params: unknown) => {
      muapiCalls[name].push(params)
      return { url: `https://muapi.test/${name}.mp4`, outputs: [`https://muapi.test/${name}.mp4`] }
    })
  }

  return {
    generateImage: makeSpy('generateImage'),
    generateI2I: makeSpy('generateI2I'),
    generateVideo: makeSpy('generateVideo'),
    generateI2V: makeSpy('generateI2V'),
    processV2V: makeSpy('processV2V'),
    processRecast: makeSpy('processRecast'),
    processMotionControl: vi.fn(async (_apiKey: unknown, params: unknown) => {
      muapiCalls.processMotionControl.push(params)
      return { url: 'https://muapi.test/processMotionControl.mp4' }
    }),
    processLipSync: makeSpy('processLipSync'),
    uploadFile: makeSpy('uploadFile'),
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeImageSource(overrides: Partial<PersonalizationSource> = {}): PersonalizationSource {
  return {
    sourceType: 'landing-demo',
    id: 'demo-1',
    title: 'Test Demo',
    mediaType: 'image',
    sourceMedia: 'https://example.com/source.png',
    poster: null,
    shortPrompt: 'test',
    fullPrompt: 'test',
    originalPrompt: 'test',
    aspectRatio: '1:1',
    sourceMetadata: {},
    ...overrides,
  }
}

function makeVideoSource(overrides: Partial<PersonalizationSource> = {}): PersonalizationSource {
  return {
    sourceType: 'landing-demo',
    id: 'demo-2',
    title: 'Test Video',
    mediaType: 'video',
    sourceMedia: 'https://example.com/source.mp4',
    poster: null,
    shortPrompt: 'test',
    fullPrompt: 'test',
    originalPrompt: 'test',
    aspectRatio: '16:9',
    duration: 10,
    sourceMetadata: {},
    ...overrides,
  }
}

function makeAssets(overrides: Partial<AssetLibrary> = {}): AssetLibrary {
  return {
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
    ...overrides,
  }
}

function makeResolved(overrides: Partial<ResolvedAssets> = {}): ResolvedAssets {
  return {
    directInputs: {},
    promptContext: {},
    preProcessing: {},
    postProcessing: {},
    unusedSavedReferences: [],
    ...overrides,
  }
}

const baseOptions: GenerationOptions = {
  engine: 'smartvideo-recommended',
  preserveAudio: true,
  exactLogoHandling: 'final-overlay',
  exactCtaHandling: 'final-end-card',
  firstFrameMode: 'none',
  lastFrameMode: 'none',
  consentGiven: true,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Phase 29 - Provider Negative Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    openaiCalls.length = 0
    for (const key of Object.keys(muapiCalls)) {
      muapiCalls[key].length = 0
    }

    const mockBlob = { blob: () => Promise.resolve(new Blob(['test'], { type: 'image/png' })) }

    ;(global as any).fetch = vi.fn(async (_url: string) => {
      const urlStr = String(_url)
      if (urlStr.includes('/images/generations') || urlStr.includes('/images/edits')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ url: 'https://openai.test/image.png' }] }),
          text: async () => '{}',
          headers: new Headers(),
          blob: () => Promise.resolve(new Blob(['test'], { type: 'image/png' })),
        }
      }
      if (urlStr.includes('/api/v1/predictions/') && urlStr.includes('/result')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'completed', url: 'https://muapi.test/video.mp4', outputs: ['https://muapi.test/video.mp4'] }),
          text: async () => '{}',
          headers: new Headers(),
        }
      }
      if (urlStr.includes('/api/v1/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ request_id: 'req-123', url: 'https://muapi.test/video.mp4', outputs: ['https://muapi.test/video.mp4'] }),
          text: async () => '{}',
          headers: new Headers(),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => '{}',
        headers: new Headers(),
        blob: () => Promise.resolve(new Blob(['test'], { type: 'image/png' })),
      }
    })
  })

  // ── IMAGE PATH ─────────────────────────────────────────────────────────────

  describe('IMAGE path', () => {
    it('text-to-image: calls OpenAI /images/generations and NEVER calls MuAPI generateImage', async () => {
      const result = await runGeneration({
        source: makeImageSource(),
        client: {},
        assets: makeAssets(),
        resolved: makeResolved(),
        prompt: 'A futuristic city at sunset',
        mode: 'recreate',
        options: baseOptions,
        apiKey: 'sk-test',
      })

      expect(result.type).toBe('image')
      expect(result.url).toBe('https://openai.test/image.png')

      // OpenAI MUST have been called for generations
      const generationCalls = openaiCalls.filter((c) => c.endpoint === '/images/generations')
      expect(generationCalls.length).toBeGreaterThanOrEqual(1)

      // MuAPI image functions MUST NOT have been called
      expect(muapiCalls.generateImage).toHaveLength(0)
      expect(muapiCalls.generateI2I).toHaveLength(0)
    })

    it('image-to-image (replace_face): calls OpenAI /images/edits and NEVER calls MuAPI generateI2I', async () => {
      const source = makeImageSource({
        sourceMedia: 'https://example.com/source.png',
      })
      const resolved = makeResolved({
        directInputs: { image_url: 'https://example.com/source.png' },
      })

      const result = await runGeneration({
        source,
        client: {},
        assets: makeAssets(),
        resolved,
        prompt: 'Replace the face with a professional headshot',
        mode: 'replace_face',
        options: baseOptions,
        apiKey: 'sk-test',
      })

      expect(result.type).toBe('image')

      // OpenAI edit MUST have been called
      const editCalls = openaiCalls.filter((c) => c.endpoint === '/images/edits')
      expect(editCalls.length).toBeGreaterThanOrEqual(1)

      // MuAPI image functions MUST NOT have been called
      expect(muapiCalls.generateI2I).toHaveLength(0)
    })

    it('image personalization (keep_design): calls OpenAI /images/edits and NEVER MuAPI', async () => {
      const source = makeImageSource({
        sourceMedia: 'https://example.com/source.png',
      })
      const resolved = makeResolved({
        directInputs: { image_url: 'https://example.com/source.png' },
      })

      const result = await runGeneration({
        source,
        client: {},
        assets: makeAssets(),
        resolved,
        prompt: 'Keep the design but improve colors',
        mode: 'keep_design',
        options: baseOptions,
        apiKey: 'sk-test',
      })

      expect(result.type).toBe('image')
      const editCalls = openaiCalls.filter((c) => c.endpoint === '/images/edits')
      expect(editCalls.length).toBeGreaterThanOrEqual(1)

      expect(muapiCalls.generateImage).toHaveLength(0)
      expect(muapiCalls.generateI2I).toHaveLength(0)
    })

    it('replace_person: calls OpenAI /images/edits and NEVER calls MuAPI generateI2I', async () => {
      const source = makeImageSource({
        sourceMedia: 'https://example.com/source.png',
      })
      const resolved = makeResolved({
        directInputs: { image_url: 'https://example.com/source.png' },
      })

      const result = await runGeneration({
        source,
        client: {},
        assets: makeAssets(),
        resolved,
        prompt: 'Replace the person with a professional presenter',
        mode: 'replace_person',
        options: baseOptions,
        apiKey: 'sk-test',
      })

      expect(result.type).toBe('image')

      const editCalls = openaiCalls.filter((c) => c.endpoint === '/images/edits')
      expect(editCalls.length).toBeGreaterThanOrEqual(1)

      expect(muapiCalls.generateI2I).toHaveLength(0)
    })
  })

  // ── VIDEO PATH ──────────────────────────────────────────────────────────────

  describe('VIDEO path', () => {
    it('recreate (t2v): calls MuAPI generateVideo, NEVER calls OpenAI for image generation', async () => {
      const result = await runGeneration({
        source: makeVideoSource(),
        client: {},
        assets: makeAssets(),
        resolved: makeResolved(),
        prompt: 'A product showcase video',
        mode: 'recreate',
        options: { ...baseOptions, model: 'veo-4-text-to-video' },
        apiKey: 'sk-test',
      })

      expect(result.type).toBe('video')

      // MuAPI video MUST have been called
      expect(muapiCalls.generateVideo).toHaveLength(1)

      // OpenAI image generation MUST NOT have been called for the video path
      const generationCalls = openaiCalls.filter((c) => c.endpoint === '/images/generations')
      expect(generationCalls.length).toBe(0)
    })

    it('face_only (v2v): calls MuAPI processV2V, NEVER calls OpenAI image generation', async () => {
      const source = makeVideoSource({
        sourceMedia: 'https://example.com/source.mp4',
      })
      const resolved = makeResolved({
        directInputs: {
          video_url: 'https://example.com/source.mp4',
          image_url: 'https://example.com/identity.jpg',
        },
      })

      const result = await runGeneration({
        source,
        client: {},
        assets: makeAssets({
          identities: [{ id: 'id-1', url: 'https://example.com/identity.jpg', isPrimary: true, createdAt: '', role: 'presenter_identity', name: 'Test', uploadStatus: 'ready' }],
          primaryIdentity: { id: 'id-1', url: 'https://example.com/identity.jpg', isPrimary: true, createdAt: '', role: 'presenter_identity', name: 'Test', uploadStatus: 'ready' },
        }),
        resolved,
        prompt: 'Swap the face',
        mode: 'face_only',
        options: { ...baseOptions, model: 'ai-video-face-swap' },
        apiKey: 'sk-test',
      })

      expect(result.type).toBe('video')

      expect(muapiCalls.processV2V).toHaveLength(1)

      const generationCalls = openaiCalls.filter((c) => c.endpoint === '/images/generations')
      expect(generationCalls.length).toBe(0)
    })

    it('i2v (image-to-video): calls MuAPI generateI2V, NEVER calls OpenAI image generation', async () => {
      const source = makeVideoSource()
      const resolved = makeResolved({
        directInputs: { image_url: 'https://example.com/first-frame.png' },
      })

      const result = await runGeneration({
        source,
        client: {},
        assets: makeAssets(),
        resolved,
        prompt: 'Animate this image',
        mode: 'recreate',
        options: { ...baseOptions, model: 'seedance-2-t2v' },
        apiKey: 'sk-test',
      })

      expect(result.type).toBe('video')

      expect(muapiCalls.generateI2V).toHaveLength(1)

      const generationCalls = openaiCalls.filter((c) => c.endpoint === '/images/generations')
      expect(generationCalls.length).toBe(0)
    })

    it('full_body (recast): calls MuAPI Seedance motion control, NEVER calls OpenAI image generation', async () => {
      const source = makeVideoSource({
        sourceMedia: 'https://example.com/source.mp4',
      })
      const resolved = makeResolved({
        directInputs: {
          video_url: 'https://example.com/source.mp4',
          image_url: 'https://example.com/identity.jpg',
        },
      })

      const result = await runGeneration({
        source,
        client: {},
        assets: makeAssets(),
        resolved,
        prompt: 'Replace the full presenter',
        mode: 'full_body',
        options: { ...baseOptions, model: 'ai-video-recast', preserveAudio: true },
        apiKey: 'sk-test',
        // The final-video render puts the source audio back on.
        restoresSourceAudio: true,
      })

      expect(result.type).toBe('video')

      expect(muapiCalls.processMotionControl).toHaveLength(1)
      expect(muapiCalls.processMotionControl[0]).toMatchObject({
        model: 'seedance-2.5-motion-control',
        video_url: 'https://example.com/source.mp4',
        images_list: ['https://example.com/identity.jpg'],
        aspect_ratio: 'adaptive',
        generate_audio: false,
      })
      expect(muapiCalls.processRecast).toHaveLength(0)

      const generationCalls = openaiCalls.filter((c) => c.endpoint === '/images/generations')
      expect(generationCalls.length).toBe(0)
    })

    it('full_body without a source-audio restore asks the model for sound, even with "Keep the original sound" on', async () => {
      const result = await runGeneration({
        source: makeVideoSource({ sourceMedia: 'https://example.com/source.mp4' }),
        client: {},
        assets: makeAssets(),
        resolved: makeResolved({
          directInputs: {
            video_url: 'https://example.com/source.mp4',
            image_url: 'https://example.com/identity.jpg',
          },
        }),
        prompt: 'Replace the full presenter',
        mode: 'full_body',
        options: { ...baseOptions, model: 'ai-video-recast', preserveAudio: true },
        apiKey: 'sk-test',
      })

      expect(result.type).toBe('video')
      expect(muapiCalls.processMotionControl).toHaveLength(1)
      expect(muapiCalls.processMotionControl[0]).toMatchObject({ generate_audio: true })
    })
  })

describe('Full Presenter frame shape', () => {
  it('sends the approved aspect ratio when the model offers it, else adaptive', async () => {
    const { motionControlAspectRatio } = await vi.importActual<typeof import('../generationRouter')>('../generationRouter')
    expect(motionControlAspectRatio('9:16')).toBe('9:16')
    expect(motionControlAspectRatio('16:9')).toBe('16:9')
    expect(motionControlAspectRatio('4:5')).toBe('adaptive')
    expect(motionControlAspectRatio(undefined)).toBe('adaptive')
  })
})
})
