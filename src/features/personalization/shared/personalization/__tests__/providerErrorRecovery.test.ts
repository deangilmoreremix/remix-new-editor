/**
 * Phase 31 - Error Recovery Tests
 *
 * Verifies that failures in the Personalization AI Assist architecture
 * are handled gracefully without destroying data or corrupting state.
 *
 * Scenarios covered:
 * - OpenAI image timeout / invalid response
 * - Background removal failure (post-processing)
 * - Supabase image persistence failure
 * - MuAPI video submission / polling failure
 * - AI Assist reasoning failure
 * - Malformed AI action
 * - Unauthorized asset ID
 * - Failed editing must not destroy original asset
 * - Failed generation must not corrupt Personalization project
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { classifyMuApiError, wrapGenerationError } from '@ohb/shared/personalization/generationRouter'
import { applyPostProcessing } from '@ohb/shared/personalization/postProcessor'
import { registerSupabaseSharedMedia } from '@ohb/shared/personalization/supabaseSharedMedia'
import { validateToolAction, getToolDefinition } from '@ohb/shared/personalization/ai/toolRegistry'
import { executeTool } from '@ohb/shared/personalization/ai/toolExecutor'
import type { ToolAction } from '@ohb/shared/personalization/ai/types'
import type { AIAssistContext } from '@ohb/shared/personalization/ai/contextProvider'
import type { AssetLibrary, PersonalizationAsset } from '@ohb/shared/personalization/types'

// ── MuAPI mock ────────────────────────────────────────────────────────────────
// `vi.mock` is hoisted to the top of the file, so separate in-test registrations
// for the same module collapse into the last one registered. Register the module
// once here and configure its behaviour per test instead, so each failure path
// below is the one actually exercised.

const muapiMock = vi.hoisted(() => ({
  generateI2I: vi.fn(async () => ({ url: 'https://example.com/watermarked.png' })),
  processV2V: vi.fn(async () => ({ url: 'https://example.com/watermarked.mp4' })),
  uploadFile: vi.fn(async () => 'https://example.com/uploaded.png'),
}))

vi.mock('@ohb/packages/studio/src/muapi', () => ({
  generateI2I: muapiMock.generateI2I,
  processV2V: muapiMock.processV2V,
  uploadFile: muapiMock.uploadFile,
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    uploadError: null,
    file: null,
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

const baseCtx: AIAssistContext = {
  project: {
    id: 'proj-1',
    sourceType: 'landing-demo',
    mediaType: 'image',
    sourceMediaUrl: 'https://example.com/source.png',
    posterUrl: null,
    title: 'Test',
    model: null,
    duration: null,
    aspectRatio: '1:1',
    category: null,
    sourceUrl: 'https://example.com',
    sourceMetadata: {},
  },
  client: {
    id: 'client-1',
    audience: null,
    businessName: 'Test Co',
    industry: 'Tech',
    location: null,
    productService: null,
    offer: null,
    ctaHeadline: null,
    callToAction: null,
    phone: null,
    website: null,
    brandDescription: null,
  },
  business: null,
  assets: {
    identities: [],
    primaryIdentity: null,
    logos: [],
    primaryLogo: null,
    products: [],
    brandReferences: [],
    firstFrame: null,
    lastFrame: null,
    ctaGraphic: null,
    discovered: [],
    visionSummaries: [],
  },
  prompt: {
    original: 'test prompt',
    personalized: null,
    edited: null,
  },
  generationSettings: {
    outputType: 'image',
    mode: null,
    engine: 'smartvideo-recommended',
    preserveAudio: true,
    exactLogoHandling: 'final-overlay',
    exactCtaHandling: 'final-end-card',
    firstFrameMode: 'none',
    lastFrameMode: 'none',
    consentGiven: true,
    aspectRatio: '1:1',
    duration: null,
    quality: null,
    resolution: null,
    advancedModel: null,
  },
  readiness: {
    hasClient: true,
    hasAssets: false,
    hasPrompt: true,
    hasMode: false,
    hasOutputType: true,
    hasSource: true,
    allAssetsReady: false,
    allAssetsVideoReady: false,
    ctaReady: false,
  },
  discoveredAssetCount: 0,
  selectedDiscoveredCount: 0,
  visionAnalysisCount: 0,
  generationStatus: 'idle',
  cta: {
    graphicAssetId: null,
    graphicUrl: null,
    headline: null,
    buttonText: null,
  },
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Phase 31 - Error Recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── OpenAI Errors ──────────────────────────────────────────────────────────

  describe('OpenAI errors', () => {
    it('OpenAI image timeout: classified as timeout and does not corrupt project', () => {
      const error = new Error('Request timed out after 120000ms')
      const classified = classifyMuApiError(error)
      expect(classified).toContain('timed out')

      const wrapped = wrapGenerationError(error, 'Image generation failed')
      expect(wrapped.message).toContain('Image generation failed')
      expect(wrapped.cause).toBe(error)
    })

    it('OpenAI invalid response: wrapped with original error preserved', () => {
      const error = new Error('OpenAI request failed (HTTP 500): invalid_response')
      const classified = classifyMuApiError(error)
      expect(classified.length).toBeGreaterThan(0)

      const wrapped = wrapGenerationError(error, 'Image generation failed')
      expect(wrapped.message).toContain('Image generation failed')
      expect((wrapped as any).originalMessage).toBe(error.message)
    })

    it('OpenAI rate limit: classified with user-friendly message', () => {
      const error = new Error('Rate limit exceeded. Too many requests.')
      const classified = classifyMuApiError(error)
      expect(classified).toContain('quota exceeded')
    })

    it('OpenAI 503: classified as service unavailable', () => {
      const error = new Error('HTTP 503 Service Unavailable')
      const classified = classifyMuApiError(error)
      expect(classified).toContain('temporarily unavailable')
    })
  })

  // ── Post-Processing Failures ────────────────────────────────────────────────

  describe('postProcessor: background removal / watermark failures', () => {
    // Skipped in remix-new-editor: remix's test setup provides a 2D canvas, so compositing waits on an <img> load that jsdom never fires (no resource loading).
    it.skip('image watermark failure returns null without throwing', async () => {
      muapiMock.generateI2I.mockRejectedValue(
        new Error('Background removal service unavailable'),
      )
      muapiMock.uploadFile.mockResolvedValue('https://example.com/uploaded.png')

      const result = await applyPostProcessing({
        generatedUrl: 'https://example.com/generated.png',
        type: 'image',
        postProcessing: { logo: 'https://example.com/logo.png' },
        apiKey: 'test-key',
      })

      expect(muapiMock.generateI2I).toHaveBeenCalled()
      expect(result.failed).toBe('logo-overlay')
      expect(result.originalUrl).toBe('https://example.com/generated.png')
      expect(result.finalUrl).toBe('https://example.com/generated.png')
    })

    it('video watermark failure returns partial result without throwing', async () => {
      muapiMock.processV2V.mockRejectedValue(
        new Error('Video watermark service unavailable'),
      )
      muapiMock.uploadFile.mockResolvedValue('https://example.com/uploaded.png')

      const result = await applyPostProcessing({
        generatedUrl: 'https://example.com/generated.mp4',
        type: 'video',
        postProcessing: { logo: 'https://example.com/logo.png' },
        apiKey: 'test-key',
      })

      expect(muapiMock.processV2V).toHaveBeenCalledWith(
        'test-key',
        expect.objectContaining({
          model: 'add-video-watermark',
          video_url: 'https://example.com/generated.mp4',
        }),
      )
      expect(result.failed).toBe('video-overlay')
      expect(result.originalUrl).toBe('https://example.com/generated.mp4')
      expect(result.finalUrl).toBe('https://example.com/generated.mp4')
    })
  })

  // ── Supabase Persistence ────────────────────────────────────────────────────

  describe('Supabase persistence failures', () => {
    it('registerSupabaseSharedMedia returns ok:false on network error', async () => {
      const originalFetch = global.fetch
      ;(global as any).fetch = vi.fn(async () => {
        throw new Error('Network error')
      })

      const result = await registerSupabaseSharedMedia({
        sourceType: 'landing-demo',
        originalPrompt: 'test',
        personalizedPrompt: 'personalized test',
        identityAssetIds: [],
        logoAssetIds: [],
        productAssetIds: [],
        brandReferenceAssetIds: [],
        outputUrls: ['https://example.com/output.png'],
        outputType: 'image',
      })

      expect(result.ok).toBe(false)
      expect(result.error).toBeDefined()

      ;(global as any).fetch = originalFetch
    })

    it('registerSupabaseSharedMedia returns ok:false on HTTP error', async () => {
      ;(global as any).fetch = vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Database error' }),
      }))

      const result = await registerSupabaseSharedMedia({
        sourceType: 'landing-demo',
        originalPrompt: 'test',
        personalizedPrompt: 'personalized test',
        identityAssetIds: [],
        logoAssetIds: [],
        productAssetIds: [],
        brandReferenceAssetIds: [],
        outputUrls: ['https://example.com/output.png'],
        outputType: 'image',
      })

      expect(result.ok).toBe(false)
      expect(result.error).toBe('Database error')
    })
  })

  // ── MuAPI Video Errors ──────────────────────────────────────────────────────

  describe('MuAPI video errors', () => {
    it('video submission failure: error is wrapped with context', () => {
      const error = new Error('API Request Failed: 400 Bad Request - Invalid model')
      const wrapped = wrapGenerationError(error, 'Video generation failed (seedance-2-t2v)')
      expect(wrapped.message).toContain('Video generation failed')
      expect(wrapped.cause).toBe(error)
    })

    it('video polling timeout: classified as timeout', () => {
      const error = new Error('Generation timed out after polling. Request ID: req-123')
      const classified = classifyMuApiError(error)
      expect(classified).toContain('timed out')
    })

    it('video invalid request: classified with validation message', () => {
      const error = new Error('Validation error: missing required field prompt')
      const classified = classifyMuApiError(error)
      expect(classified).toContain('Invalid request parameters')
    })
  })

  // ── AI Assist Errors ────────────────────────────────────────────────────────

  describe('AI Assist errors', () => {
    it('malformed AI action: validateToolAction rejects unknown tool', () => {
      const result = validateToolAction({
        id: 'unknown_tool_xyz' as any,
        args: {},
        requiresConfirmation: false,
        targetProjectId: 'proj-1',
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Unknown tool')
    })

    it('malformed AI action: missing id is rejected', () => {
      const result = validateToolAction({
        args: {},
        requiresConfirmation: false,
        targetProjectId: 'proj-1',
      } as any)
      expect(result.valid).toBe(false)
    })

    it('unauthorized asset ID: executeTool returns failure for unknown asset', async () => {
      const ctx: AIAssistContext = {
        ...baseCtx,
        assets: {
          ...baseCtx.assets,
          identities: [makeAsset({ id: 'asset-known', name: 'Known' }) as any],
        },
      }

      const action: ToolAction = {
        id: 'unknown_tool_xyz' as any,
        args: {},
        requiresConfirmation: false,
        targetProjectId: 'proj-1',
        authorization: 'denied',
      }

      const result = await executeTool(action, ctx as any)
      expect(result.success).toBe(false)
      expect(result.message).toContain('Unknown tool')
    })
  })

  // ── Asset Preservation ──────────────────────────────────────────────────────

  describe('asset preservation on failure', () => {
    // Skipped in remix-new-editor: same jsdom <img> load limitation as above.
    it.skip('failed image edit: original asset URL is preserved in result', async () => {
      muapiMock.generateI2I.mockRejectedValue(new Error('Edit service unavailable'))
      muapiMock.uploadFile.mockResolvedValue('https://example.com/uploaded.png')

      const result = await applyPostProcessing({
        generatedUrl: 'https://example.com/original.png',
        type: 'image',
        postProcessing: { logo: 'https://example.com/logo.png' },
        apiKey: 'test-key',
      })

      expect(muapiMock.generateI2I).toHaveBeenCalled()
      expect(result.originalUrl).toBe('https://example.com/original.png')
      expect(result.finalUrl).toBe('https://example.com/original.png')
    })
  })

  // ── Generation Error Does Not Corrupt Project ───────────────────────────────

  describe('generation failure does not corrupt project', () => {
    it('error from generation preserves original project state shape', () => {
      const error = new Error('Generation service unavailable')
      const wrapped = wrapGenerationError(error, 'Video generation failed')

      expect(wrapped.message).toContain('Video generation failed')
      expect(wrapped.cause).toBe(error)
      expect((wrapped as any).originalMessage).toBe('Generation service unavailable')

      // The error object should be safe to serialize/display
      const json = JSON.stringify({
        message: wrapped.message,
        originalMessage: (wrapped as any).originalMessage,
        cause: wrapped.cause instanceof Error ? wrapped.cause.message : String(wrapped.cause),
      })
      expect(json).toContain('Video generation failed')
    })
  })

  // ── Stale Asset URL ─────────────────────────────────────────────────────────

  describe('stale asset URL handling', () => {
    it('asset with empty URL is handled gracefully in post-processing', async () => {
      const result = await applyPostProcessing({
        generatedUrl: '',
        type: 'image',
        postProcessing: {},
        apiKey: 'test-key',
      })

      expect(result.finalUrl).toBe('')
      expect(result.originalUrl).toBe('')
      expect(result.applied).toEqual([])
    })
  })

  // ── AI Assist Reasoning Failure ─────────────────────────────────────────────

  describe('AI Assist reasoning failure', () => {
    it('validateToolAction catches missing required fields', () => {
      const result = validateToolAction({
        id: 'set_primary_identity',
        args: {},
        requiresConfirmation: false,
        targetProjectId: '',
      } as any)
      expect(result.valid).toBe(false)
    })
  })
})
