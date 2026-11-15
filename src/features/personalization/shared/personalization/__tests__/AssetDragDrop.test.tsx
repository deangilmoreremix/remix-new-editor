// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { screen } from '@testing-library/react'
import { DemoPersonalizeProvider, useDemoPersonalize } from '../DemoPersonalizeProvider'

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test')
  URL.revokeObjectURL = vi.fn()
})

vi.mock('next/navigation', () => ({
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
  uploadFile: vi.fn().mockResolvedValue('https://uploaded.example.com/asset.png'),
}))

// The provider uploads an edited asset through the durable-storage service.
// Without a storage backend that call rejects ("Durable storage is not
// configured") — correct in the app, where the editor modal catches and shows
// it, but these tests exercise the edit/replace state, not storage, so the
// upload is stubbed to succeed. Failure handling has its own test
// (editedAssetUploadFailure.test.tsx).
vi.mock('../assetUploadService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../assetUploadService')>()),
  uploadPersonalizationAsset: vi.fn().mockResolvedValue({
    url: 'https://uploaded.example.com/asset.png',
  }),
}))

function TestOpener({ source, onMounted }: { source: any; onMounted: (open: (opts: any) => void) => void }) {
  const ctx = useDemoPersonalize()
  ;(window as any).__personalizationCtx = ctx
  onMounted(ctx.openPersonalize)
  return null
}

describe('Asset Drag/Drop and Management', () => {
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
    document.body.innerHTML = ''
    await unmountAll()
    ;(window as any).__personalizationCtx = null
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }
  })

  afterEach(() => {
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
  }

  // A. Discovered asset → drag to Products → assignedSection products
  it('A: moves discovered asset to Products section', async () => {
    await renderProvider()
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
          assignedSection: null,
          autoAssigned: false,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    await act(async () => {
      c.moveDiscoveredAssetToSection('disc-1', 'products')
    })

    c = (window as any).__personalizationCtx
    expect(c.discoveredAssets[0].assignedSection).toBe('products')
    expect(c.discoveredAssets[0].autoAssigned).toBe(false)
  })

  // B. Brand → drag to Products → removed from Brand, appears in Products
  it('B: moves library asset from brand to products', async () => {
    await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addBrandReferenceUrl('https://test.com/brand.png')
    })

    c = (window as any).__personalizationCtx
    const brandAsset = c.assets.brandReferences[0]
    expect(brandAsset).toBeDefined()

    await act(async () => {
      c.moveLibraryAssetToSection(brandAsset.id, 'products')
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.brandReferences.some((a: any) => a.id === brandAsset.id)).toBe(false)
    expect(c.assets.products.some((a: any) => a.id === brandAsset.id)).toBe(true)
    expect(c.assets.products.find((a: any) => a.id === brandAsset.id)?.role).toBe('product_reference')
  })

  // C. Product → drag to First Frame → single-slot updated
  it('C: moves product to firstFrame single-slot', async () => {
    await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addProductUrl('https://test.com/prod.png')
    })

    c = (window as any).__personalizationCtx
    const productAsset = c.assets.products[0]
    expect(productAsset).toBeDefined()

    await act(async () => {
      c.moveLibraryAssetToSection(productAsset.id, 'firstFrame')
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.firstFrame?.id).toBe(productAsset.id)
    expect(c.assets.firstFrame?.role).toBe('first_frame')
    expect(c.assets.products.some((a: any) => a.id === productAsset.id)).toBe(false)
  })

  // D. Second asset → drop onto occupied First Frame → existing replaced
  it('D: second asset replaces occupied firstFrame', async () => {
    await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setFirstFrameUrl('https://test.com/first.png')
    })

    c = (window as any).__personalizationCtx
    const firstAsset = c.assets.firstFrame
    expect(firstAsset).toBeDefined()

    await act(async () => {
      c.addProductUrl('https://test.com/second.png')
    })

    c = (window as any).__personalizationCtx
    const secondAsset = c.assets.products[0]
    expect(secondAsset).toBeDefined()

    await act(async () => {
      c.moveLibraryAssetToSection(secondAsset.id, 'firstFrame')
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.firstFrame?.id).toBe(secondAsset.id)
    // firstAsset should be removed from firstFrame (not in any collection)
    expect(c.assets.firstFrame?.id).not.toBe(firstAsset.id)
  })

  // E. Edited asset → move sections → edit metadata preserved
  it('E: preserves edit metadata when moving asset', async () => {
    await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addLogoUrl('https://test.com/logo.png')
    })

    c = (window as any).__personalizationCtx
    const logoAsset = c.assets.logos[0]
    expect(logoAsset).toBeDefined()

    // Simulate edit by applying edited personalization asset
    await act(async () => {
      c.applyEditedPersonalizationAsset(logoAsset.id, 'data:image/png;base64,editeddata', {
        operation: 'remove_background',
        prompt: 'Remove background',
        model: 'gpt-image-2.5-sunburst',
        quality: 'high',
        transparent: true,
        videoReady: false,
        responseId: 'resp-1',
        imageGenerationCallId: 'call-1',
        revisedPrompt: null,
        outputFormat: 'png',
        outputCompression: null,
        inputFidelity: 'high',
        visionAnalysis: {
          category: 'logo',
          confidence: 90,
          qualityScore: 80,
          relevanceScore: 85,
          targetRole: 'Logo',
          preserve: [],
          issues: [],
          recommendedOperations: [],
          transparencyRecommended: false,
          precisionRecommended: false,
          textDetected: false,
          duplicateLikely: false,
          summary: 'test',
          analyzedAt: new Date().toISOString(),
        },
        visionValidation: {
          passed: true,
          confidence: 96,
          issues: [],
          preserved: [],
          changed: [],
          summary: 'Edit passed',
          analyzedAt: new Date().toISOString(),
        },
      })
    })

    c = (window as any).__personalizationCtx
    const editedAsset = c.assets.logos.find((a: any) => a.id === logoAsset.id)
    expect(editedAsset?.edited).toBe(true)
    expect(editedAsset?.editMetadata?.operation).toBe('remove_background')

    await act(async () => {
      c.moveLibraryAssetToSection(logoAsset.id, 'products')
    })

    c = (window as any).__personalizationCtx
    const moved = c.assets.products.find((a: any) => a.id === logoAsset.id)
    expect(moved).toBeDefined()
    expect(moved.edited).toBe(true)
    expect(moved.editMetadata?.operation).toBe('remove_background')
    expect(moved.visionAnalysis?.summary).toBe('test')
  })

  // F. Remove from section → assignedSection null
  it('F: removeDiscoveredAssetFromSection sets assignedSection null', async () => {
    await renderProvider()
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
          assignedSection: 'logo',
          autoAssigned: true,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    await act(async () => {
      c.removeDiscoveredAssetFromSection('disc-1')
    })

    c = (window as any).__personalizationCtx
    expect(c.discoveredAssets[0].assignedSection).toBe(null)
    expect(c.discoveredAssets[0].autoAssigned).toBe(false)
  })

  // G. Delete asset → removed completely
  it('G: deleteLibraryAsset removes asset completely', async () => {
    await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addLogoUrl('https://test.com/del.png')
    })

    c = (window as any).__personalizationCtx
    const logoAsset = c.assets.logos[0]
    expect(logoAsset).toBeDefined()

    await act(async () => {
      c.deleteLibraryAsset(logoAsset.id)
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.logos.some((a: any) => a.id === logoAsset.id)).toBe(false)
  })

  // H. Delete primary identity → primary state valid
  it('H: deleting primary identity clears primary safely', async () => {
    await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addIdentityUrl('https://test.com/me.png')
    })

    c = (window as any).__personalizationCtx
    const identityAsset = c.assets.primaryIdentity
    expect(identityAsset).toBeDefined()

    await act(async () => {
      c.deleteLibraryAsset(identityAsset.id)
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.primaryIdentity).toBeNull()
    expect(c.assets.identities.some((a: any) => a.id === identityAsset.id)).toBe(false)
  })

  // I. Move primary logo → primary state valid
  it('I: moving primary logo clears logos and adds to brand', async () => {
    await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addLogoUrl('https://test.com/logo.png')
    })

    c = (window as any).__personalizationCtx
    const logoAsset = c.assets.primaryLogo
    expect(logoAsset).toBeDefined()
    expect(c.assets.primaryLogo?.id).toBe(logoAsset.id)

    await act(async () => {
      c.moveLibraryAssetToSection(logoAsset.id, 'brand')
    })

    c = (window as any).__personalizationCtx
    // After moving, logo should be in brandReferences
    expect(c.assets.brandReferences.some((a: any) => a.id === logoAsset.id)).toBe(true)
    // Should be removed from logos
    expect(c.assets.logos.some((a: any) => a.id === logoAsset.id)).toBe(false)
    // primaryLogo should be null since no more logos
    expect(c.assets.primaryLogo).toBeNull()
  })

  // J. Manual drag → autoAssigned false
  it('J: manual move sets autoAssigned false for discovered assets', async () => {
    await renderProvider()
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
          recommended: false,
          rejected: false,
          assignedSection: 'logo',
          autoAssigned: true,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    await act(async () => {
      c.moveDiscoveredAssetToSection('disc-1', 'brand')
    })

    c = (window as any).__personalizationCtx
    expect(c.discoveredAssets[0].autoAssigned).toBe(false)
    expect(c.discoveredAssets[0].assignedSection).toBe('brand')
  })

  // K. Role updates when moving between sections
  it('K: role updates when moving library asset to different section', async () => {
    await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addProductUrl('https://test.com/prod.png')
    })

    c = (window as any).__personalizationCtx
    const productAsset = c.assets.products[0]
    expect(productAsset).toBeDefined()
    expect(productAsset.role).toBe('product_reference')

    await act(async () => {
      c.moveLibraryAssetToSection(productAsset.id, 'firstFrame')
    })

    c = (window as any).__personalizationCtx
    // Role should update to match the new section
    expect(c.assets.firstFrame?.role).toBe('first_frame')
    // Asset should no longer be in products
    expect(c.assets.products.some((a: any) => a.id === productAsset.id)).toBe(false)
  })

  // L. Asset moves between sections correctly
  it('L: asset moves from products to firstFrame', async () => {
    await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addProductUrl('https://test.com/prod.png')
    })

    c = (window as any).__personalizationCtx
    const productAsset = c.assets.products[0]
    expect(productAsset).toBeDefined()
    expect(c.assets.products.length).toBe(1)

    await act(async () => {
      c.moveLibraryAssetToSection(productAsset.id, 'firstFrame')
    })

    c = (window as any).__personalizationCtx
    // Asset should now be in firstFrame, not in products
    expect(c.assets.firstFrame?.id).toBe(productAsset.id)
    expect(c.assets.products.length).toBe(0)
  })

  // M. Move To fallback produces same result as drag/drop
  it('M: moveLibraryAssetToSection produces same result regardless of trigger', async () => {
    await renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addBrandReferenceUrl('https://test.com/brand.png')
    })

    c = (window as any).__personalizationCtx
    const brandAsset = c.assets.brandReferences[0]
    expect(brandAsset).toBeDefined()

    await act(async () => {
      c.moveLibraryAssetToSection(brandAsset.id, 'products')
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.brandReferences.some((a: any) => a.id === brandAsset.id)).toBe(false)
    expect(c.assets.products.some((a: any) => a.id === brandAsset.id)).toBe(true)
    expect(c.assets.products.find((a: any) => a.id === brandAsset.id)?.role).toBe('product_reference')
  })
})
