import { describe, expect, it, vi } from 'vitest'
import { makeDiscoveredAssetVideoReady } from '../image-editor/batchVideoReady'

// jsdom cannot decode images; the PNG re-encode is covered in normalizeImage.test.ts.
vi.mock('../image-editor/normalizeImage', () => ({ normalizeImageDataUrl: async (dataUrl: string) => dataUrl }))

describe('makeDiscoveredAssetVideoReady', () => {
  it('uses a fallback message when validation returns empty issues and empty summary', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async (_url: string, _options?: any) => {
      const url = String(_url)
      if (url.includes('/api/personalization/download-image')) {
        return {
          ok: true,
          json: async () => ({
            results: [{ ok: true, dataUrl: 'data:image/png;base64,AA==' }],
          }),
        } as any
      }
      if (url.includes('/api/personalization/image-analyze')) {
        return {
          ok: true,
          json: async () => ({
            validation: {
              passed: false,
              confidence: 0,
              issues: [],
              preserved: [],
              changed: [],
              summary: '',
            },
          }),
        } as any
      }
      if (url.includes('/api/personalization/image-edit')) {
        return {
          ok: true,
          json: async () => ({
            data: [{ b64_json: 'ZmFrZQ==' }],
          }),
        } as any
      }
      return { ok: true, json: async () => ({}) } as any
    }) as any

    const asset = {
      id: 'asset-1',
      sourceUrl: 'data:image/png;base64,AA==',
      previewUrl: 'data:image/png;base64,AA==',
      sourceType: 'WEBSITE' as const,
      category: 'product' as const,
      assignedSection: 'products' as const,
      selected: true,
      recommended: true,
      rejected: false,
      autoAssigned: true,
      videoReady: false,
      editedDataUrl: undefined as string | undefined,
      edited: false,
      hasTransparency: false,
      visionAnalysis: {
        id: 'asset-1',
        category: 'product',
        confidence: 80,
        qualityScore: 80,
        relevanceScore: 80,
        targetRole: 'Product Overlay',
        preserve: [],
        issues: [],
        recommendedOperations: [],
        transparencyRecommended: false,
        precisionRecommended: false,
        textDetected: false,
        duplicateLikely: false,
        summary: 'Product asset',
      } as any,
      editMetadata: undefined as any,
      originalPreviewUrl: undefined as string | undefined,
    }

    await expect(
      makeDiscoveredAssetVideoReady(asset, { businessName: 'Acme', industry: 'Roofing' }),
    ).rejects.toThrow('The edited image did not pass visual QA.')

    globalThis.fetch = originalFetch
  })
})
