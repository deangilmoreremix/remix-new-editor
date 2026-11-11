// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { screen } from '@testing-library/react'
import { DemoPersonalizeProvider, useDemoPersonalize } from '../DemoPersonalizeProvider'

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
})

vi.mock('@ohb/lib/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

vi.mock('@ohb/components/SocialPublishProvider', () => ({
  SocialPublishContext: { Provider: ({ children }: any) => children, Consumer: ({ children }: any) => children(null) } as any,
  useSocialPublish: () => {
    throw new Error('useSocialPublish must be used within a <SocialPublishProvider>')
  },
}))

vi.mock('@ohb/lib/authConfig', () => ({
  useAuthConfig: () => ({
    apiKey: 'test-key',
    openaiKey: '',
    setApiKey: vi.fn(),
    setOpenAiKey: vi.fn(),
    clearApiKey: vi.fn(),
    clearOpenAiKey: vi.fn(),
    clearAllKeys: vi.fn(),
    hasApiKey: true,
    hasOpenAiKey: false,
    isAuthenticated: true,
  }),
}))

vi.mock('../promptPersonalizer', () => ({
  personalizePrompt: vi.fn(),
  regeneratePrompt: vi.fn(),
}))

vi.mock('../generationRouter', () => ({
  runGeneration: vi.fn(),
}))

vi.mock('../postProcessor', () => ({
  applyPostProcessing: vi.fn(),
  generateEndCardImage: vi.fn(),
}))

vi.mock('@ohb/packages/studio/src/muapi', () => ({
  uploadFile: vi.fn(),
}))

function TestOpener({ source, onMounted }: { source: any; onMounted: (open: (opts: any) => void) => void }) {
  const ctx = useDemoPersonalize()
  ;(window as any).__personalizationCtx = ctx
  onMounted(ctx.openPersonalize)
  return null
}

describe('Discovered Assets Integration', () => {
  let mockUploadFile: any
  let originalFetch: typeof globalThis.fetch
  let originalCreateObjectURL: typeof URL.createObjectURL
  let originalRevokeObjectURL: typeof URL.revokeObjectURL
  const roots: { root: ReturnType<typeof createRoot>; container: HTMLDivElement }[] = []

  const unmountAll = async () => {
    for (const { root, container } of roots) {
      try {
        await act(async () => {
          root.unmount()
        })
      } catch {
        // ignore unmount errors
      }
      if (container.parentNode) {
        container.parentNode.removeChild(container)
      }
    }
    roots.length = 0
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    originalFetch = globalThis.fetch
    originalCreateObjectURL = URL.createObjectURL
    originalRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test')
    URL.revokeObjectURL = vi.fn()
    document.body.innerHTML = ''
    await unmountAll()
    ;(window as any).__personalizationCtx = null
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }

    // Mock the download-image endpoint used by importDiscoveredAssets
    ;(globalThis as any).fetch = vi.fn(async (url: string, options?: any) => {
      if (typeof url === 'string' && url.includes('/api/personalization/download-image')) {
        const body = typeof options?.body === 'string' ? JSON.parse(options.body) : {}
        const urls = Array.isArray(body?.urls) ? body.urls : []
        const results = urls.map((u: string) => ({
          url: u,
          dataUrl: `data:image/png;base64,${Buffer.from('fake-image-data').toString('base64')}`,
          ok: true,
        }))
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, results }),
        } as any
      }
      if (typeof url === 'string' && url.includes('/api/personalization/image-analyze')) {
        const body = typeof options?.body === 'string' ? JSON.parse(options.body) : {}
        if (body?.mode === 'validate') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              validation: {
                passed: true,
                confidence: 96,
                issues: [],
                preserved: ['logo', 'brand colors'],
                changed: ['background'],
                summary: 'Requested edit succeeded and protected branding was preserved.',
                analyzedAt: new Date().toISOString(),
                model: 'gpt-6-astra',
              },
            }),
          } as any
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            analyses: (body?.images || []).map((image: any) => ({
              id: image.id,
              category: image.id === 'disc-vision' ? 'branded_vehicle' : (image.categoryHint || 'brand'),
              confidence: 94,
              qualityScore: 88,
              relevanceScore: 93,
              targetRole: 'Branded Vehicle Asset',
              preserve: ['vehicle wrap', 'logo', 'phone number'],
              issues: ['busy background'],
              recommendedOperations: ['vehicle_enhance', 'safe_area'],
              transparencyRecommended: false,
              precisionRecommended: true,
              textDetected: true,
              duplicateLikely: false,
              summary: 'Company vehicle with important branded wrap and contact text.',
              analyzedAt: new Date().toISOString(),
              model: 'gpt-6-astra',
            })),
          }),
        } as any
      }
      if (typeof url === 'string' && url.includes('/api/personalization/discover-assets')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, discoveredAssets: [], count: 0 }),
        } as any
      }
      return originalFetch(url, options)
    })

    // Configure uploadFile mock to return a durable URL
    try {
      const mod = await import('@ohb/packages/studio/src/muapi')
      mockUploadFile = (mod as any)?.uploadFile
      if (mockUploadFile) {
        mockUploadFile.mockResolvedValue('https://uploaded.example.com/discovered.png')
      }
    } catch {
      // ignore if module cannot be imported in test env
    }
  })

  afterEach(() => {
    ;(globalThis as any).fetch = originalFetch
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    unmountAll()
  })

  const renderProvider = async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <DemoPersonalizeProvider>
          <TestOpener
            source={{ id: 'demo-1', title: 'Test Demo', mediaType: 'video', originalPrompt: 'test', sourceMedia: null, poster: null, fullPrompt: 'test', shortPrompt: 'test', sourceType: 'landing-demo', sourceMetadata: {} }}
            onMounted={() => {}}
          />
        </DemoPersonalizeProvider>,
      )
    })

    roots.push({ root, container })
    return container
  }

  const openSource = async () => {
    await act(async () => {
      ;(window as any).__personalizationCtx.openPersonalize({
        source: { id: 'demo-1', title: 'Test', mediaType: 'video', originalPrompt: 'test', sourceMedia: null, poster: null, fullPrompt: 'test', shortPrompt: 'test', sourceType: 'landing-demo', sourceMetadata: {} },
      })
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    // Simple Mode is the default customer presentation; these tests exercise
    // the full Advanced Editing surface, so opt into it after opening.
    await act(async () => {
      const button = screen.queryByRole('button', { name: /advanced editing/i });
      if (button) (button as HTMLButtonElement).click();
    })
  }

  it('renders the Find Business Assets button', async () => {
    const container = await renderProvider()
    await openSource()

    const findButtons = screen.getAllByText('Find Business Assets')
    expect(findButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('does not render a duplicate Website field in CTA section', async () => {
    const container = await renderProvider()
    await openSource()

    const websiteLabels = screen.getAllByText('Website')
    expect(websiteLabels.length).toBe(1)
  })

  it('renders Website above Business Name in Client Profile', async () => {
    const container = await renderProvider()
    await openSource()

    const websiteLabels = screen.getAllByText('Website')
    const businessNameLabels = screen.getAllByText('Business Name')

    const websiteLabel = websiteLabels[0]
    const businessNameLabel = businessNameLabels[0]

    const allLabels = Array.from(container.querySelectorAll('label'))
    expect(allLabels.indexOf(websiteLabel as any)).toBeGreaterThanOrEqual(0)
    expect(allLabels.indexOf(businessNameLabel as any)).toBeGreaterThanOrEqual(0)
    expect(allLabels.indexOf(websiteLabel as any)).toBeLessThan(allLabels.indexOf(businessNameLabel as any))
  })

  it('binds Website input to clientForm.website', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    expect(c.clientForm.website).toBeUndefined()

    await act(async () => {
      c.updateClientForm({ website: 'https://test.com' })
    })

    c = (window as any).__personalizationCtx
    expect(c.clientForm.website).toBe('https://test.com')
  })

  it('preserves manual uploads after discovery state changes', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addLogoUrl('https://manual-logo.png')
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.logos.length).toBe(1)
    expect(c.assets.logos[0].url).toBe('https://manual-logo.png')

    await act(async () => {
      c.discoverAssets('https://test.com')
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.logos.length).toBe(1)
    expect(c.assets.logos[0].url).toBe('https://manual-logo.png')
  })

  it('keeps discovered assets temporary and separate from AssetLibrary', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-1',
          sourceUrl: 'https://test.com/logo.png',
          previewUrl: 'https://test.com/logo.png',
          sourceType: 'WEBSITE',
          category: 'logo',
          selected: true,
          recommended: true,
          rejected: false,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    expect(c.discoveredAssets.length).toBe(1)
    expect(c.assets.logos.length).toBe(0)
    expect(c.discoveryStatus).toBe('reviewing')
  })

  it('rejecting a discovered asset does not affect AssetLibrary', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    const logosBefore = c.assets.logos.length

    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-1',
          sourceUrl: 'https://test.com/logo.png',
          previewUrl: 'https://test.com/logo.png',
          sourceType: 'WEBSITE',
          category: 'logo',
          selected: true,
          recommended: true,
          rejected: false,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    const logosAfterSet = c.assets.logos.length
    expect(logosAfterSet).toBe(logosBefore)

    await act(async () => {
      c.rejectDiscoveredAsset('disc-1')
    })

    c = (window as any).__personalizationCtx
    expect(c.discoveredAssets[0].rejected).toBe(true)
    expect(c.assets.logos.length).toBe(logosBefore)
  })

  it('changing discovered asset category updates the asset', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-1',
          sourceUrl: 'https://test.com/logo.png',
          previewUrl: 'https://test.com/logo.png',
          sourceType: 'WEBSITE',
          category: 'logo',
          selected: true,
          recommended: true,
          rejected: false,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    await act(async () => {
      c.updateDiscoveredAssetCategory('disc-1', 'brand')
    })

    c = (window as any).__personalizationCtx
    expect(c.discoveredAssets[0].category).toBe('brand')
  })

  it('selecting recommended assets selects only recommended ones', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-1',
          sourceUrl: 'https://test.com/logo.png',
          previewUrl: 'https://test.com/logo.png',
          sourceType: 'WEBSITE',
          category: 'logo',
          selected: false,
          recommended: true,
          rejected: false,
        },
        {
          id: 'disc-2',
          sourceUrl: 'https://test.com/product.png',
          previewUrl: 'https://test.com/product.png',
          sourceType: 'WEBSITE',
          category: 'product',
          selected: false,
          recommended: false,
          rejected: false,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    await act(async () => {
      c.selectRecommendedDiscoveredAssets()
    })

    c = (window as any).__personalizationCtx
    expect(c.discoveredAssets[0].selected).toBe(true)
    expect(c.discoveredAssets[1].selected).toBe(false)
  })

  it('uses SmartVideo GO Vision to refine discovery category, scores, and preservation metadata', async () => {
    await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-vision',
          sourceUrl: 'https://test.com/truck.jpg',
          previewUrl: 'https://test.com/truck.jpg',
          sourceType: 'WEBSITE',
          category: 'brand',
          selected: false,
          recommended: false,
          rejected: false,
          assignedSection: 'brand',
          autoAssigned: true,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    await act(async () => {
      await c.analyzeDiscoveredAssets()
    })

    c = (window as any).__personalizationCtx
    expect(c.visionStatus).toBe('complete')
    expect(c.discoveredAssets[0].category).toBe('branded_vehicle')
    expect(c.discoveredAssets[0].confidence).toBe(94)
    expect(c.discoveredAssets[0].qualityScore).toBe(88)
    expect(c.discoveredAssets[0].relevanceScore).toBe(93)
    expect(c.discoveredAssets[0].recommended).toBe(true)
    expect(c.discoveredAssets[0].selected).toBe(true)
    expect(c.discoveredAssets[0].assignedSection).toBe('brand')
    expect(c.discoveredAssets[0].visionAnalysis.preserve).toContain('vehicle wrap')
    expect(c.discoveredAssets[0].visionAnalysis.recommendedOperations).toContain('vehicle_enhance')
  })

  it('imports selected person assets into identities', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-1',
          sourceUrl: 'https://test.com/person.jpg',
          previewUrl: 'https://test.com/person.jpg',
          sourceType: 'WEBSITE',
          category: 'person',
          selected: true,
          recommended: true,
          rejected: false,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    await act(async () => {
      c.importDiscoveredAssets()
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.identities.length).toBe(1)
    expect(c.assets.identities[0].role).toBe('presenter_identity')
    expect(c.assets.identities[0].url).toBeTruthy()
  })

  it('imports selected logo assets into logos', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-1',
          sourceUrl: 'https://test.com/logo.png',
          previewUrl: 'https://test.com/logo.png',
          sourceType: 'WEBSITE',
          category: 'logo',
          selected: true,
          recommended: true,
          rejected: false,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    await act(async () => {
      c.importDiscoveredAssets()
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.logos.length).toBe(1)
    expect(c.assets.logos[0].role).toBe('logo')
    // After durable import the URL may be a blob URL (test env) or a durable URL (real env)
    expect(c.assets.logos[0].url).toBeTruthy()
  })

  it('imports selected product/service assets into products', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-1',
          sourceUrl: 'https://test.com/product.png',
          previewUrl: 'https://test.com/product.png',
          sourceType: 'WEBSITE',
          category: 'product',
          selected: true,
          recommended: true,
          rejected: false,
        },
        {
          id: 'disc-2',
          sourceUrl: 'https://test.com/service.png',
          previewUrl: 'https://test.com/service.png',
          sourceType: 'WEBSITE',
          category: 'service',
          selected: true,
          recommended: true,
          rejected: false,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    await act(async () => {
      c.importDiscoveredAssets()
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.products.length).toBe(2)
    expect(c.assets.products.every((p: any) => p.role === 'product_reference')).toBe(true)
  })

  it('imports selected brand/storefront assets into brandReferences', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-1',
          sourceUrl: 'https://test.com/storefront.png',
          previewUrl: 'https://test.com/storefront.png',
          sourceType: 'WEBSITE',
          category: 'storefront',
          selected: true,
          recommended: true,
          rejected: false,
        },
        {
          id: 'disc-2',
          sourceUrl: 'https://test.com/office.png',
          previewUrl: 'https://test.com/office.png',
          sourceType: 'WEBSITE',
          category: 'office',
          selected: true,
          recommended: true,
          rejected: false,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    await act(async () => {
      c.importDiscoveredAssets()
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.brandReferences.length).toBe(2)
    expect(c.assets.brandReferences.every((b: any) => b.role === 'brand_reference')).toBe(true)
  })

  it('preserves manually assigned First Frame, Last Frame, and CTA destinations on import', async () => {
    await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-first',
          sourceUrl: 'https://test.com/storefront.png',
          previewUrl: 'https://test.com/storefront.png',
          sourceType: 'WEBSITE',
          category: 'storefront',
          selected: true,
          recommended: true,
          rejected: false,
          assignedSection: 'firstFrame',
          autoAssigned: false,
        },
        {
          id: 'disc-last',
          sourceUrl: 'https://test.com/product.png',
          previewUrl: 'https://test.com/product.png',
          sourceType: 'WEBSITE',
          category: 'product',
          selected: true,
          recommended: true,
          rejected: false,
          assignedSection: 'lastFrame',
          autoAssigned: false,
        },
        {
          id: 'disc-cta',
          sourceUrl: 'https://test.com/brand.png',
          previewUrl: 'https://test.com/brand.png',
          sourceType: 'WEBSITE',
          category: 'brand',
          selected: true,
          recommended: true,
          rejected: false,
          assignedSection: 'ctaGraphic',
          autoAssigned: false,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    await act(async () => {
      await c.importDiscoveredAssets()
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.firstFrame?.role).toBe('first_frame')
    expect(c.assets.firstFrame?.sourceCategory).toBe('storefront')
    expect(c.assets.lastFrame?.role).toBe('last_frame')
    expect(c.assets.lastFrame?.sourceCategory).toBe('product')
    expect(c.assets.ctaGraphic?.role).toBe('cta_graphic')
    expect(c.assets.ctaGraphic?.sourceCategory).toBe('brand')
  })

  it('does not auto-populate firstFrame during import', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-1',
          sourceUrl: 'https://test.com/anything.png',
          previewUrl: 'https://test.com/anything.png',
          sourceType: 'WEBSITE',
          category: 'brand',
          selected: true,
          recommended: true,
          rejected: false,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    await act(async () => {
      c.importDiscoveredAssets()
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.firstFrame).toBeNull()
  })

  it('does not auto-populate lastFrame during import', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-1',
          sourceUrl: 'https://test.com/anything.png',
          previewUrl: 'https://test.com/anything.png',
          sourceType: 'WEBSITE',
          category: 'brand',
          selected: true,
          recommended: true,
          rejected: false,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    await act(async () => {
      c.importDiscoveredAssets()
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.lastFrame).toBeNull()
  })

  it('does not auto-populate ctaGraphic during import', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-1',
          sourceUrl: 'https://test.com/anything.png',
          previewUrl: 'https://test.com/anything.png',
          sourceType: 'WEBSITE',
          category: 'brand',
          selected: true,
          recommended: true,
          rejected: false,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    await act(async () => {
      c.importDiscoveredAssets()
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.ctaGraphic).toBeNull()
  })

  it('preserves existing primary identity unless none exists', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addIdentityUrl('https://existing-identity.png')
    })

    c = (window as any).__personalizationCtx
    const existingId = c.assets.primaryIdentity?.id
    expect(existingId).toBeTruthy()

    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-1',
          sourceUrl: 'https://test.com/person.jpg',
          previewUrl: 'https://test.com/person.jpg',
          sourceType: 'WEBSITE',
          category: 'person',
          selected: true,
          recommended: true,
          rejected: false,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    await act(async () => {
      c.importDiscoveredAssets()
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.identities.length).toBe(2)
    expect(c.assets.primaryIdentity?.id).toBe(existingId)
  })

  it('preserves existing primary logo unless none exists', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addLogoUrl('https://existing-logo.png')
    })

    c = (window as any).__personalizationCtx
    const existingLogoId = c.assets.primaryLogo?.id
    expect(existingLogoId).toBeTruthy()

    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-1',
          sourceUrl: 'https://test.com/logo.png',
          previewUrl: 'https://test.com/logo.png',
          sourceType: 'WEBSITE',
          category: 'logo',
          selected: true,
          recommended: true,
          rejected: false,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    await act(async () => {
      c.importDiscoveredAssets()
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.logos.length).toBe(2)
    expect(c.assets.primaryLogo?.id).toBe(existingLogoId)
  })

  it('only imports selected and non-rejected assets', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-1',
          sourceUrl: 'https://test.com/selected.png',
          previewUrl: 'https://test.com/selected.png',
          sourceType: 'WEBSITE',
          category: 'logo',
          selected: true,
          recommended: true,
          rejected: false,
        },
        {
          id: 'disc-2',
          sourceUrl: 'https://test.com/unselected.png',
          previewUrl: 'https://test.com/unselected.png',
          sourceType: 'WEBSITE',
          category: 'logo',
          selected: false,
          recommended: false,
          rejected: false,
        },
        {
          id: 'disc-3',
          sourceUrl: 'https://test.com/rejected.png',
          previewUrl: 'https://test.com/rejected.png',
          sourceType: 'WEBSITE',
          category: 'logo',
          selected: true,
          recommended: true,
          rejected: true,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    await act(async () => {
      c.importDiscoveredAssets()
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.logos.length).toBe(1)
    expect(c.assets.logos[0].url).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // Regression: URL-only assets (no sourceUrl) must not crash rendering or import
  // Raw discovery candidates carry only previewUrl; sourceUrl is optional at
  // runtime even though the type declares it required.
  // -------------------------------------------------------------------------

  it('does not crash when importing an asset with only previewUrl (no sourceUrl)', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-url-only',
          // No sourceUrl — only previewUrl, as raw candidates arrive
          previewUrl: 'https://test.com/asset.png',
          sourceType: 'WEBSITE',
          category: 'logo',
          selected: true,
          recommended: true,
          rejected: false,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    expect(c.discoveredAssets.length).toBe(1)
    expect(c.discoveredAssets[0].sourceUrl).toBeUndefined()
    expect(c.discoveredAssets[0].previewUrl).toBe('https://test.com/asset.png')

    // Import must not crash on URL-only assets — whether or not the upload
    // succeeds in the test environment, no exception should escape.
    await expect(
      act(async () => {
        c.importDiscoveredAssets()
      }),
    ).resolves.not.toThrow()
  })

  it('does not crash when importing mixed assets with and without sourceUrl', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-1',
          sourceUrl: 'https://test.com/with-source.png',
          previewUrl: 'https://test.com/with-source.png',
          sourceType: 'WEBSITE',
          category: 'logo',
          selected: true,
          recommended: true,
          rejected: false,
        },
        {
          id: 'disc-2',
          // No sourceUrl — only previewUrl
          previewUrl: 'https://test.com/no-source.png',
          sourceType: 'WEBSITE',
          category: 'product',
          selected: true,
          recommended: true,
          rejected: false,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    expect(c.discoveredAssets.length).toBe(2)

    // Import must not crash on mixed assets
    await expect(
      act(async () => {
        c.importDiscoveredAssets()
      }),
    ).resolves.not.toThrow()
  })

  it('does not crash when importing an asset with neither sourceUrl nor previewUrl', async () => {
    const container = await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-no-url',
          // Neither sourceUrl nor previewUrl — degenerate case
          sourceType: 'WEBSITE',
          category: 'brand',
          selected: true,
          recommended: true,
          rejected: false,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    expect(c.discoveredAssets.length).toBe(1)

    // Import should not crash; the asset has no downloadable URL so nothing
    // gets created, but no exception escapes.
    await expect(
      act(async () => {
        c.importDiscoveredAssets()
      }),
    ).resolves.not.toThrow()
  })

  // -------------------------------------------------------------------------
  // Regression: guided-view rendering of URL-only assets must not crash
  // StepFindBusiness renders asset.sourceUrl.replace(...) in the review panel
  // (StepFindBusiness.tsx:465). It must fall back to previewUrl when sourceUrl
  // is absent — raw discovery candidates carry only previewUrl.
  // -------------------------------------------------------------------------

  it('renders StepFindBusiness guided view with URL-only assets without crashing', async () => {
    const container = await renderProvider()
    await act(async () => {
      ;(window as any).__personalizationCtx.openPersonalize({
        source: {
          id: 'demo-1',
          title: 'Test Demo',
          mediaType: 'video',
          originalPrompt: 'test',
          sourceMedia: null,
          poster: null,
          fullPrompt: 'test',
          shortPrompt: 'test',
          sourceType: 'landing-demo',
          sourceMetadata: {},
        },
      })
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    // Stay in Simple Mode (guided) — do NOT click "Advanced Editing".
    // Click "Find Business Assets" to navigate to StepFindBusiness.
    const findButtons = screen.getAllByRole('button', { name: /find business assets/i })
    expect(findButtons.length).toBeGreaterThanOrEqual(1)
    await act(async () => {
      findButtons[0].click()
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctx = (window as any).__personalizationCtx
    await act(async () => {
      ctx.setDiscoveredAssets([
        {
          id: 'disc-guided-url-only',
          // No sourceUrl — only previewUrl, as raw candidates arrive
          previewUrl: 'https://test.com/asset.png',
          sourceType: 'WEBSITE',
          category: 'logo',
          selected: true,
          recommended: true,
          rejected: false,
        },
      ])
    })

    // Give React a chance to render the review panel
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const c = (window as any).__personalizationCtx
    // No crash: the component rendered the previewUrl fallback on line 465
    expect(c.discoveredAssets.length).toBe(1)
    expect(c.discoveredAssets[0].sourceUrl).toBeUndefined()
    expect(c.discoveredAssets[0].previewUrl).toBe('https://test.com/asset.png')
  })
})
