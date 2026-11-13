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

describe('Layer placement state (manual / locked / recommended)', () => {
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

  const ctx = () => (window as any).__personalizationCtx
  const layer = (id: string) => ctx().previewSettings.layers.find((l: any) => l.id === id)

  it('a geometry edit marks the layer manual; a text edit does not', async () => {
    renderProvider(); await openSource()
    expect(layer('headline').placementSource).toBeUndefined()
    await act(async () => { ctx().updatePreviewLayer('headline', { text: 'Hello' }) })
    expect(layer('headline').placementSource).toBeUndefined()
    await act(async () => { ctx().updatePreviewLayer('headline', { x: 0.6 }) })
    expect(layer('headline').placementSource).toBe('manual')
    expect(layer('headline').x).toBe(0.6)
  })

  it('a locked layer ignores geometry edits until it is unlocked', async () => {
    renderProvider(); await openSource()
    const x0 = layer('headline').x
    await act(async () => { ctx().setPreviewLayerLocked('headline', true) })
    expect(layer('headline').locked).toBe(true)
    await act(async () => { ctx().updatePreviewLayer('headline', { x: 0.9, y: 0.9 }) })
    expect(layer('headline').x).toBe(x0)
    // non-geometry edits still work while locked
    await act(async () => { ctx().updatePreviewLayer('headline', { text: 'Still editable' }) })
    expect(layer('headline').text).toBe('Still editable')
    await act(async () => { ctx().setPreviewLayerLocked('headline', false) })
    expect(layer('headline').locked).toBeUndefined()
    await act(async () => { ctx().updatePreviewLayer('headline', { x: 0.9 }) })
    expect(layer('headline').x).toBe(0.9)
  })

  it('applying placements never moves locked or hand-placed layers unless overriding manual', async () => {
    renderProvider(); await openSource()
    await act(async () => {
      ctx().updatePreviewLayer('businessName', { x: 0.7, y: 0.7 }) // manual
      ctx().setPreviewLayerLocked('headline', true)
    })
    const items = [
      { layerId: 'logo', x: 0.9, y: 0.1 },
      { layerId: 'businessName', x: 0.3, y: 0.3 },
      { layerId: 'headline', x: 0.3, y: 0.5 },
    ]
    await act(async () => { ctx().applyPreviewPlacements(items) })
    expect(layer('logo').x).toBe(0.9)
    expect(layer('logo').placementSource).toBe('recommended')
    expect(layer('businessName').x).toBe(0.7) // manual kept
    expect(layer('headline').x).not.toBe(0.3) // locked kept
    await act(async () => { ctx().applyPreviewPlacements(items, { overrideManual: true }) })
    expect(layer('businessName').x).toBe(0.3) // explicit restore replaces manual
    expect(layer('businessName').placementSource).toBe('recommended')
    expect(layer('headline').x).not.toBe(0.3) // locked is never overridden
  })

  it('protected zones are stored with the settings and can be cleared', async () => {
    renderProvider(); await openSource()
    await act(async () => { ctx().setPreviewProtectedZones([{ id: 'z1', label: 'Presenter', source: 'user', x: 0.3, y: 0.1, w: 0.4, h: 0.8 }]) })
    expect(ctx().previewSettings.protectedZones).toHaveLength(1)
    await act(async () => { ctx().setPreviewProtectedZones([]) })
    expect(ctx().previewSettings.protectedZones).toBeUndefined()
  })
})
