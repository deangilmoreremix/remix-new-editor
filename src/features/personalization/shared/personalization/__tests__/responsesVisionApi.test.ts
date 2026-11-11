// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  analyzePersonalizationImages,
  responsesSmartEdit,
  responsesSmartEditStream,
  validatePersonalizationImageEdit,
} from '../image-editor/responsesVisionApi'

describe('SmartVideo GO Responses/Vision client', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('requests structured Vision analysis for personalization images', async () => {
    const fetchMock = vi.fn(async (_url: string, options: any) => {
      const body = JSON.parse(options.body)
      expect(body.mode).toBe('analyze')
      expect(body.images[0].categoryHint).toBe('logo')
      return {
        ok: true,
        json: async () => ({
          analyses: [{
            category: 'logo',
            confidence: 99,
            qualityScore: 90,
            relevanceScore: 98,
            targetRole: 'Logo Overlay',
            preserve: ['logo geometry'],
            issues: [],
            recommendedOperations: ['logo_cleanup'],
            transparencyRecommended: true,
            precisionRecommended: true,
            textDetected: true,
            duplicateLikely: false,
            summary: 'Logo asset',
            analyzedAt: new Date().toISOString(),
          }],
        }),
      } as any
    })
    globalThis.fetch = fetchMock as any

    const result = await analyzePersonalizationImages({
      images: [{ id: 'logo-1', imageUrl: 'data:image/png;base64,AA==', categoryHint: 'logo' }],
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/personalization/image-analyze', expect.any(Object))
    expect(result[0].category).toBe('logo')
    expect(result[0].precisionRecommended).toBe(true)
  })

  it('continues conversational image edits through previous_response_id', async () => {
    const fetchMock = vi.fn(async (_url: string, options: any) => {
      const body = JSON.parse(options.body)
      expect(body.previousResponseId).toBe('resp_123')
      expect(body.prompt).toBe('Make the lighting warmer')
      return {
        ok: true,
        json: async () => ({
          imageDataUrl: 'data:image/png;base64,AA==',
          responseId: 'resp_456',
          imageGenerationCallId: 'ig_1',
          revisedPrompt: 'Warm the lighting while preserving the subject.',
          model: 'gpt-image-2.5-sunburst',
        }),
      } as any
    })
    globalThis.fetch = fetchMock as any

    const result = await responsesSmartEdit({
      prompt: 'Make the lighting warmer',
      previousResponseId: 'resp_123',
      imageModel: 'gpt-image-2.5-sunburst',
    })

    expect(result.responseId).toBe('resp_456')
    expect(result.revisedPrompt).toContain('preserving')
  })


  it('streams partial GPT Image 2.5 previews and returns the completed image', async () => {
    const encoder = new TextEncoder()
    const chunks = [
      'data: ' + JSON.stringify({
        type: 'response.image_generation_call.partial_image',
        partial_image_index: 0,
        partial_image_b64: 'UEFSVElBTA==',
      }) + '\n\n',
      'data: ' + JSON.stringify({
        type: 'response.completed',
        response: {
          id: 'resp_streamed',
          model: 'gpt-6-astra',
          output: [{
            type: 'image_generation_call',
            id: 'ig_streamed',
            result: 'RklOQUw=',
            revised_prompt: 'Final refined prompt',
          }],
          usage: { input_tokens: 12 },
        },
      }) + '\n\n',
    ]

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)))
        controller.close()
      },
    })

    globalThis.fetch = vi.fn(async (_url: string, options: any) => {
      const body = JSON.parse(options.body)
      expect(body.stream).toBe(true)
      expect(body.partialImages).toBe(2)
      return { ok: true, body } as any
    }) as any

    // Replace the mocked body with the SSE stream after validating the request.
    ;(globalThis.fetch as any).mockImplementation(async (_url: string, options: any) => {
      const body = JSON.parse(options.body)
      expect(body.stream).toBe(true)
      expect(body.partialImages).toBe(2)
      return { ok: true, body: stream } as any
    })

    const partials: string[] = []
    const result = await responsesSmartEditStream({
      imageUrl: 'data:image/png;base64,AA==',
      prompt: 'Make this more cinematic',
      imageModel: 'gpt-image-2.5-sunburst',
      outputFormat: 'png',
      partialImages: 2,
    }, (dataUrl) => partials.push(dataUrl))

    expect(partials).toEqual(['data:image/png;base64,UEFSVElBTA=='])
    expect(result.imageDataUrl).toBe('data:image/png;base64,RklOQUw=')
    expect(result.responseId).toBe('resp_streamed')
    expect(result.imageGenerationCallId).toBe('ig_streamed')
    expect(result.revisedPrompt).toBe('Final refined prompt')
  })

  it('returns Vision QA validation', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        validation: {
          passed: true,
          confidence: 97,
          issues: [],
          preserved: ['identity'],
          changed: ['background'],
          summary: 'Edit passed visual QA.',
          analyzedAt: new Date().toISOString(),
        },
      }),
    })) as any

    const validation = await validatePersonalizationImageEdit({
      originalImageUrl: 'data:image/png;base64,AA==',
      editedImageUrl: 'data:image/png;base64,BB==',
      preserve: ['identity'],
      intendedOperation: 'remove_background',
    })

    expect(validation.passed).toBe(true)
    expect(validation.preserved).toContain('identity')
  })
})
