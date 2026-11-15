// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { DemoPersonalizeProvider, useDemoPersonalize } from '../DemoPersonalizeProvider'
import { createDefaultPreviewSettings } from '../preview/presets'

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
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
  uploadFile: vi.fn(),
}))


function Capture() {
  ;(window as any).__ctx = useDemoPersonalize()
  return null
}

const ctx = () => (window as any).__ctx
const SOURCE = { id: 'timeline-src', title: 'Timeline', mediaType: 'video', originalPrompt: 'p', sourceMedia: 'https://cdn.example.com/v.mp4', poster: null, fullPrompt: 'p', shortPrompt: 'p', sourceType: 'landing-demo', sourceMetadata: {} }

describe('overlay layers in and out for a host editor', () => {
  let root: ReturnType<typeof createRoot>
  let container: HTMLDivElement

  beforeEach(async () => {
    localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(<DemoPersonalizeProvider><Capture /></DemoPersonalizeProvider>)
    })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  const seed = () => createDefaultPreviewSettings().layers.map((l) => (l.kind === 'logo' ? { ...l, x: 0.8, y: 0.3, scale: 0.2 } : l))

  it('opens on the seeded layers, and reports edits once on close', async () => {
    const onLayersChange = vi.fn()
    await act(async () => { ctx().openPersonalize({ source: SOURCE, initialLayers: seed(), onLayersChange }) })
    const logo = () => ctx().previewSettings.layers.find((l: any) => l.kind === 'logo')
    expect(logo()).toMatchObject({ x: 0.8, y: 0.3, scale: 0.2 })

    await act(async () => { ctx().updatePreviewLayer(logo().id, { x: 0.6 }) })
    await act(async () => { ctx().closePersonalize() })

    expect(onLayersChange).toHaveBeenCalledTimes(1)
    const payload = onLayersChange.mock.calls[0][0]
    expect(payload.layers.find((l: any) => l.kind === 'logo').x).toBeCloseTo(0.6, 2)
    expect(payload.settings).toMatchObject({ fps: expect.any(Number), width: expect.any(Number), height: expect.any(Number) })
  })

  it('reports nothing when the layers were not touched', async () => {
    const onLayersChange = vi.fn()
    await act(async () => { ctx().openPersonalize({ source: SOURCE, initialLayers: seed(), onLayersChange }) })
    await act(async () => { ctx().closePersonalize() })
    expect(onLayersChange).not.toHaveBeenCalled()
  })

  it('does not leak the callback or the seed into the next open', async () => {
    const onLayersChange = vi.fn()
    await act(async () => { ctx().openPersonalize({ source: SOURCE, initialLayers: seed(), onLayersChange }) })
    await act(async () => { ctx().closePersonalize() })
    await act(async () => { ctx().openPersonalize({ source: SOURCE }) })
    const logo = ctx().previewSettings.layers.find((l: any) => l.kind === 'logo')
    expect(logo.scale).not.toBe(0.2)
    await act(async () => { ctx().updatePreviewLayer(logo.id, { x: 0.1 }) })
    await act(async () => { ctx().closePersonalize() })
    expect(onLayersChange).not.toHaveBeenCalled()
  })
})
