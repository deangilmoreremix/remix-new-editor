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

describe('Personalization Image Editing', () => {
  const roots: { root: ReturnType<typeof createRoot>; container: HTMLDivElement }[] = []

  const unmountAll = async () => {
    for (const { root, container } of roots) {
      try {
        await act(async () => {
          root.unmount()
        })
      } catch {}
      container.remove()
    }
    roots.length = 0
  }

  const renderProvider = () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    roots.push({ root, container })
    act(() => {
      root.render(
        <DemoPersonalizeProvider>
          <TestOpener source={null} onMounted={() => {}} />
        </DemoPersonalizeProvider>,
      )
    })
    return container
  }

  const openSource = () => {
    const c = (window as any).__personalizationCtx
    act(() => {
      c.openPersonalize({
        source: {
          sourceType: 'landing-demo',
          id: 'demo-1',
          title: 'Test Demo',
          mediaType: 'image',
          sourceMedia: 'https://example.com/source.png',
          poster: null,
          shortPrompt: 'test',
          fullPrompt: 'test',
          originalPrompt: 'test',
          sourceMetadata: {},
        } as any,
      })
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await unmountAll()
  })

  // A. discovered asset → Edit Image → save → preview updated
  it('A: discovered asset edit updates preview', async () => {
    renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-1',
          sourceUrl: 'https://example.com/orig.png',
          previewUrl: 'https://example.com/orig.png',
          sourceType: 'WEBSITE',
          category: 'product',
          selected: true,
          recommended: false,
          rejected: false,
          assignedSection: 'products',
          autoAssigned: true,
          originalPreviewUrl: undefined,
          editedDataUrl: undefined,
          edited: false,
          videoReady: false,
          hasTransparency: false,
          editMetadata: undefined,
          visionAnalysis: undefined,
          visionValidation: undefined,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    expect(c.discoveredAssets[0].edited).toBe(false)

    await act(async () => {
      c.setDiscoveredAssets((prev: any) => prev.map((item: any) => item.id === 'disc-1' ? {
        ...item,
        originalPreviewUrl: item.originalPreviewUrl || item.previewUrl,
        editedDataUrl: 'data:image/png;base64,editeddata',
        edited: true,
        editMetadata: { operation: 'remove_background' },
        visionValidation: { passed: true, confidence: 90, issues: [], preserved: [], changed: [], summary: 'ok', analyzedAt: new Date().toISOString() },
      } : item))
    })

    c = (window as any).__personalizationCtx
    expect(c.discoveredAssets[0].editedDataUrl).toBe('data:image/png;base64,editeddata')
    expect(c.discoveredAssets[0].edited).toBe(true)
    expect(c.discoveredAssets[0].originalPreviewUrl).toBe('https://example.com/orig.png')
  })

  // B. edited discovered asset → import → edited version preserved
  it('B: edited discovered asset preserves editedDataUrl on import', async () => {
    renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setDiscoveredAssets([
        {
          id: 'disc-2',
          sourceUrl: 'https://example.com/orig2.png',
          previewUrl: 'https://example.com/orig2.png',
          sourceType: 'WEBSITE',
          category: 'logo',
          selected: true,
          recommended: false,
          rejected: false,
          assignedSection: 'logo',
          autoAssigned: true,
          originalPreviewUrl: undefined,
          editedDataUrl: 'data:image/png;base64,editedtwo',
          edited: true,
          videoReady: false,
          hasTransparency: false,
          editMetadata: { operation: 'enhance' },
          visionAnalysis: undefined,
          visionValidation: undefined,
        },
      ])
    })

    c = (window as any).__personalizationCtx
    const disc = c.discoveredAssets[0]
    expect(disc.editedDataUrl).toBe('data:image/png;base64,editedtwo')
    expect(disc.edited).toBe(true)
  })

  // C. Person → edit → primaryIdentity preserved
  it('C: editing primary identity preserves primary state', async () => {
    renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addIdentityUrl('https://example.com/person.png')
    })

    c = (window as any).__personalizationCtx
    const identity = c.assets.primaryIdentity
    expect(identity).toBeDefined()

    await act(async () => {
      c.applyEditedPersonalizationAsset(identity.id, 'data:image/png;base64,editedperson', {
        operation: 'remove_background',
        prompt: 'Remove background',
        model: 'gpt-image-2.5-sunburst',
        quality: 'high',
        transparent: true,
        videoReady: false,
        responseId: null,
        imageGenerationCallId: null,
        revisedPrompt: null,
        outputFormat: 'png',
        outputCompression: null,
        inputFidelity: 'high',
      })
    })

    c = (window as any).__personalizationCtx
    const edited = c.assets.identities.find((a: any) => a.id === identity.id)
    expect(edited).toBeDefined()
    expect(edited.edited).toBe(true)
    expect(edited.editedDataUrl).toBe('data:image/png;base64,editedperson')
    expect(c.assets.primaryIdentity?.id).toBe(identity.id)
  })

  // D. Logo → edit → primaryLogo preserved
  it('D: editing primary logo preserves primary state', async () => {
    renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addLogoUrl('https://example.com/logo.png')
    })

    c = (window as any).__personalizationCtx
    const logo = c.assets.primaryLogo
    expect(logo).toBeDefined()

    await act(async () => {
      c.applyEditedPersonalizationAsset(logo.id, 'data:image/png;base64,editedlogo', {
        operation: 'remove_background',
        prompt: 'Remove background',
        model: 'gpt-image-2.5-sunburst',
        quality: 'high',
        transparent: true,
        videoReady: false,
        responseId: null,
        imageGenerationCallId: null,
        revisedPrompt: null,
        outputFormat: 'png',
        outputCompression: null,
        inputFidelity: 'high',
      })
    })

    c = (window as any).__personalizationCtx
    const edited = c.assets.logos.find((a: any) => a.id === logo.id)
    expect(edited).toBeDefined()
    expect(edited.edited).toBe(true)
    expect(edited.editedDataUrl).toBe('data:image/png;base64,editedlogo')
    expect(c.assets.primaryLogo?.id).toBe(logo.id)
  })

  // E. Product → edit → drag to First Frame → edited version survives
  it('E: edited product survives drag to firstFrame', async () => {
    renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addProductUrl('https://example.com/prod.png')
    })

    c = (window as any).__personalizationCtx
    const product = c.assets.products[0]

    await act(async () => {
      c.applyEditedPersonalizationAsset(product.id, 'data:image/png;base64,editedprod', {
        operation: 'remove_background',
        prompt: 'Remove background',
        model: 'gpt-image-2.5-sunburst',
        quality: 'high',
        transparent: true,
        videoReady: false,
        responseId: null,
        imageGenerationCallId: null,
        revisedPrompt: null,
        outputFormat: 'png',
        outputCompression: null,
        inputFidelity: 'high',
      })
    })

    await act(async () => {
      c.moveLibraryAssetToSection(product.id, 'firstFrame')
    })

    c = (window as any).__personalizationCtx
    const moved = c.assets.firstFrame
    expect(moved).toBeDefined()
    expect(moved.id).toBe(product.id)
    expect(moved.edited).toBe(true)
    expect(moved.editedDataUrl).toBe('data:image/png;base64,editedprod')
    expect(moved.editMetadata?.operation).toBe('remove_background')
  })

  // F. Brand → edit → Move To Products → edited version survives
  it('F: edited brand survives move to products', async () => {
    renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addBrandReferenceUrl('https://example.com/brand.png')
    })

    c = (window as any).__personalizationCtx
    const brand = c.assets.brandReferences[0]

    await act(async () => {
      c.applyEditedPersonalizationAsset(brand.id, 'data:image/png;base64,editedbrand', {
        operation: 'enhance',
        prompt: 'Enhance',
        model: 'gpt-image-2.5-flare',
        quality: 'medium',
        transparent: false,
        videoReady: false,
        responseId: null,
        imageGenerationCallId: null,
        revisedPrompt: null,
        outputFormat: 'png',
        outputCompression: null,
        inputFidelity: 'low',
      })
    })

    await act(async () => {
      c.moveLibraryAssetToSection(brand.id, 'products')
    })

    c = (window as any).__personalizationCtx
    const moved = c.assets.products.find((a: any) => a.id === brand.id)
    expect(moved).toBeDefined()
    expect(moved.edited).toBe(true)
    expect(moved.editedDataUrl).toBe('data:image/png;base64,editedbrand')
  })

  // G. First Frame → edit → slot updated
  it('G: editing firstFrame updates the slot', async () => {
    renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setFirstFrameUrl('https://example.com/first.png')
    })

    c = (window as any).__personalizationCtx
    const frame = c.assets.firstFrame
    expect(frame).toBeDefined()

    await act(async () => {
      c.applyEditedPersonalizationAsset(frame.id, 'data:image/png;base64,editedfirst', {
        operation: 'crop',
        prompt: 'Crop',
        model: 'local',
        quality: 'local',
        transparent: false,
        videoReady: false,
        responseId: null,
        imageGenerationCallId: null,
        revisedPrompt: null,
        outputFormat: 'png',
        outputCompression: null,
        inputFidelity: 'low',
      })
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.firstFrame.id).toBe(frame.id)
    expect(c.assets.firstFrame.edited).toBe(true)
    expect(c.assets.firstFrame.editedDataUrl).toBe('data:image/png;base64,editedfirst')
  })

  // H. Last Frame → edit → slot updated
  it('H: editing lastFrame updates the slot', async () => {
    renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setLastFrameUrl('https://example.com/last.png')
    })

    c = (window as any).__personalizationCtx
    const frame = c.assets.lastFrame
    expect(frame).toBeDefined()

    await act(async () => {
      c.applyEditedPersonalizationAsset(frame.id, 'data:image/png;base64,editedlast', {
        operation: 'crop',
        prompt: 'Crop',
        model: 'local',
        quality: 'local',
        transparent: false,
        videoReady: false,
        responseId: null,
        imageGenerationCallId: null,
        revisedPrompt: null,
        outputFormat: 'png',
        outputCompression: null,
        inputFidelity: 'low',
      })
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.lastFrame.id).toBe(frame.id)
    expect(c.assets.lastFrame.edited).toBe(true)
    expect(c.assets.lastFrame.editedDataUrl).toBe('data:image/png;base64,editedlast')
  })

  // I. CTA → edit → slot updated
  it('I: editing ctaGraphic updates the slot', async () => {
    renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.setCtaGraphicUrl('https://example.com/cta.png')
    })

    c = (window as any).__personalizationCtx
    const cta = c.assets.ctaGraphic
    expect(cta).toBeDefined()

    await act(async () => {
      c.applyEditedPersonalizationAsset(cta.id, 'data:image/png;base64,QUJD', {
        operation: 'crop',
        prompt: 'Crop',
        model: 'local',
        quality: 'local',
        transparent: false,
        videoReady: false,
        responseId: null,
        imageGenerationCallId: null,
        revisedPrompt: null,
        outputFormat: 'png',
        outputCompression: null,
        inputFidelity: 'low',
      })
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.ctaGraphic.id).toBe(cta.id)
    expect(c.assets.ctaGraphic.edited).toBe(true)
    expect(c.assets.ctaGraphic.editedDataUrl).toBe('data:image/png;base64,QUJD')
  })

  // J. edited asset → delete → stale references removed
  it('J: deleting edited asset removes stale references', async () => {
    renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addLogoUrl('https://example.com/logo.png')
    })

    c = (window as any).__personalizationCtx
    const logo = c.assets.primaryLogo

    await act(async () => {
      c.applyEditedPersonalizationAsset(logo.id, 'data:image/png;base64,editedlogo', {
        operation: 'remove_background',
        prompt: 'Remove background',
        model: 'gpt-image-2.5-sunburst',
        quality: 'high',
        transparent: true,
        videoReady: false,
        responseId: null,
        imageGenerationCallId: null,
        revisedPrompt: null,
        outputFormat: 'png',
        outputCompression: null,
        inputFidelity: 'high',
      })
    })

    await act(async () => {
      c.deleteLibraryAsset(logo.id)
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.logos.some((a: any) => a.id === logo.id)).toBe(false)
    expect(c.assets.primaryLogo).toBeNull()
  })

  // K. edited asset → Revert to Original
  it('K: revert library asset restores original', async () => {
    renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addProductUrl('https://example.com/prod.png')
    })

    c = (window as any).__personalizationCtx
    const product = c.assets.products[0]

    await act(async () => {
      c.applyEditedPersonalizationAsset(product.id, 'data:image/png;base64,editedprod', {
        operation: 'remove_background',
        prompt: 'Remove background',
        model: 'gpt-image-2.5-sunburst',
        quality: 'high',
        transparent: true,
        videoReady: false,
        responseId: null,
        imageGenerationCallId: null,
        revisedPrompt: null,
        outputFormat: 'png',
        outputCompression: null,
        inputFidelity: 'high',
      })
    })

    c = (window as any).__personalizationCtx
    expect(c.assets.products[0].edited).toBe(true)

    await act(async () => {
      c.revertLibraryAssetToOriginal(product.id)
    })

    c = (window as any).__personalizationCtx
    const reverted = c.assets.products.find((a: any) => a.id === product.id)
    expect(reverted).toBeDefined()
    expect(reverted.edited).toBe(false)
    expect(reverted.editedDataUrl).toBeUndefined()
    expect(reverted.editMetadata).toBeUndefined()
  })

  // L. What SmartVideo Will Use reflects edited asset
  it('L: edited asset appears in What SmartVideo Will Use', async () => {
    renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addLogoUrl('https://example.com/logo.png')
    })

    c = (window as any).__personalizationCtx
    const logo = c.assets.primaryLogo

    await act(async () => {
      c.applyEditedPersonalizationAsset(logo.id, 'data:image/png;base64,editedlogo', {
        operation: 'remove_background',
        prompt: 'Remove background',
        model: 'gpt-image-2.5-sunburst',
        quality: 'high',
        transparent: true,
        videoReady: false,
        responseId: null,
        imageGenerationCallId: null,
        revisedPrompt: null,
        outputFormat: 'png',
        outputCompression: null,
        inputFidelity: 'high',
      })
    })

    c = (window as any).__personalizationCtx
    const logoInSummary = c.assets.primaryLogo
    expect(logoInSummary).toBeDefined()
    expect(logoInSummary.edited).toBe(true)
  })

  // M. generation asset resolver chooses edited version
  it('M: getGenerationAssetUrl returns edited URL after upload', async () => {
    const { getGenerationAssetUrl } = await import('../DemoPersonalizeProvider')

    // Simulate an edited asset after upload
    const editedAsset = {
      id: 'test-logo',
      role: 'logo' as const,
      name: 'logo.png',
      url: 'https://uploaded.example.com/editedlogo.png',
      uploadedUrl: 'https://uploaded.example.com/editedlogo.png',
      isPrimary: true,
      createdAt: new Date().toISOString(),
      uploadStatus: 'ready' as const,
      edited: true,
      editedDataUrl: 'data:image/png;base64,QUJD',
    }

    const url = getGenerationAssetUrl(editedAsset)
    expect(url).toBe('https://uploaded.example.com/editedlogo.png')
  })

  // N. editing asset A does not alter asset B
  it('N: editing one asset does not alter another', async () => {
    renderProvider()
    await openSource()

    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addLogoUrl('https://example.com/logo1.png')
      c.addLogoUrl('https://example.com/logo2.png')
    })

    c = (window as any).__personalizationCtx
    const logo1 = c.assets.logos[0]
    const logo2 = c.assets.logos[1]

    await act(async () => {
      c.applyEditedPersonalizationAsset(logo1.id, 'data:image/png;base64,editedlogo1', {
        operation: 'remove_background',
        prompt: 'Remove background',
        model: 'gpt-image-2.5-sunburst',
        quality: 'high',
        transparent: true,
        videoReady: false,
        responseId: null,
        imageGenerationCallId: null,
        revisedPrompt: null,
        outputFormat: 'png',
        outputCompression: null,
        inputFidelity: 'high',
      })
    })

    c = (window as any).__personalizationCtx
    const edited1 = c.assets.logos.find((a: any) => a.id === logo1.id)
    const untouched2 = c.assets.logos.find((a: any) => a.id === logo2.id)

    expect(edited1.edited).toBe(true)
    expect(edited1.editedDataUrl).toBe('data:image/png;base64,editedlogo1')
    expect(untouched2.edited).toBeUndefined()
    expect(untouched2.editedDataUrl).toBeUndefined()
  })
})
