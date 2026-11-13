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
// (this file).
vi.mock('../assetUploadService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../assetUploadService')>()),
  uploadPersonalizationAsset: vi.fn().mockRejectedValue(
    new Error('Durable storage is not configured, so this file cannot be saved for later re-use.'),
  ),
}))

function TestOpener({ source, onMounted }: { source: any; onMounted: (open: (opts: any) => void) => void }) {
  const ctx = useDemoPersonalize()
  ;(window as any).__personalizationCtx = ctx
  onMounted(ctx.openPersonalize)
  return null
}

describe('Edited asset upload failure', () => {
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

  const EDIT_META = {
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
  }

  it('a failed durable upload is NOT swallowed: the edit rejects and the asset is marked as errored', async () => {
    renderProvider()
    await openSource()
    let c = (window as any).__personalizationCtx
    await act(async () => {
      c.addIdentityUrl('https://example.com/person.png')
    })
    c = (window as any).__personalizationCtx
    const identity = c.assets.primaryIdentity
    expect(identity).toBeDefined()

    let failure: unknown = null
    await act(async () => {
      try {
        await c.applyEditedPersonalizationAsset(identity.id, 'data:image/png;base64,editedperson', EDIT_META)
      } catch (error) {
        failure = error
      }
    })
    // The caller (ImageEditorModal) receives the error and shows it.
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toMatch(/Durable storage is not configured/)

    // The asset carries the error so the UI can offer a retry.
    c = (window as any).__personalizationCtx
    const after = c.assets.primaryIdentity
    expect(after.uploadStatus).toBe('error')
    expect(String(after.uploadError ?? '')).toMatch(/Durable storage is not configured/)
  })
})
