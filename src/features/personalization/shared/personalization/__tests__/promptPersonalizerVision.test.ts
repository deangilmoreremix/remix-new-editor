import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@ohb/shared/api/openai', () => ({
  callOpenAIChat: vi.fn(),
}))

import { callOpenAIChat } from '@ohb/shared/api/openai'
import { personalizePrompt } from '../promptPersonalizer'
import { EMPTY_ASSET_LIBRARY } from '../types'

const mockedCallOpenAIChat = callOpenAIChat as any

describe('SmartVideo GO Vision prompt personalization', () => {
  beforeEach(() => {
    mockedCallOpenAIChat.mockReset()
    mockedCallOpenAIChat.mockResolvedValue('personalized result')
  })

  it('passes Vision asset intelligence and Video Ready status into the generation prompt', async () => {
    const product = {
      id: 'product-1',
      role: 'product_reference' as const,
      name: 'roofing-product.png',
      url: 'https://example.com/product.png',
      uploadedUrl: 'https://example.com/product.png',
      isPrimary: false,
      createdAt: new Date().toISOString(),
      uploadStatus: 'ready' as const,
      videoReady: true,
      sourceCategory: 'product' as const,
      visionAnalysis: {
        category: 'product' as const,
        confidence: 97,
        qualityScore: 90,
        relevanceScore: 96,
        targetRole: 'Product Overlay',
        preserve: ['packaging', 'logo', 'label text'],
        issues: ['busy background'],
        recommendedOperations: ['product_isolate'],
        transparencyRecommended: true,
        precisionRecommended: true,
        textDetected: true,
        duplicateLikely: false,
        summary: 'Primary roofing product package.',
        analyzedAt: new Date().toISOString(),
      },
    }

    await personalizePrompt({
      originalPrompt: 'Create a strong product ad.',
      client: {
        id: 'client-1',
        name: 'Test Client',
        industry: 'construction',
        audience: 'customer',
        businessName: 'Test Business',
        location: 'US',
        productService: 'roofing',
        offer: 'best prices',
        ctaHeadline: 'Buy now',
        callToAction: 'Call today',
        phone: '555-0100',
        website: 'https://example.com',
        brandDescription: 'quality',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      assets: {
        ...EMPTY_ASSET_LIBRARY,
        products: [product],
      },
      outputType: 'video',
    })

    expect(mockedCallOpenAIChat).toHaveBeenCalledTimes(1)
    const messages = mockedCallOpenAIChat.mock.calls[0][0]
    const userMessage = messages.find((m: any) => m.role === 'user')?.content
    expect(userMessage).toContain('Primary roofing product package')
    expect(userMessage).toContain('target role: Product Overlay')
    expect(userMessage).toContain('status: video ready')
    expect(userMessage).toContain('protect: packaging, logo, label text')
  })
})
