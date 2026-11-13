// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { DemoPersonalizeProvider, useDemoPersonalize } from '../DemoPersonalizeProvider'
import { stripSessionScopedUrls } from '../supabaseProjectPersistence'
import { normalizePreviewSettings } from '../preview/presets'
import { groupLayers, reorderLayer } from '../guided/layerOps'

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

function TestOpener() {
  const ctx = useDemoPersonalize()
  ;(window as any).__personalizationCtx = ctx
  return null
}

/**
 * Stage 1 with the REAL provider: layer edits made through `editPreviewSettings`
 * join the same undo/redo history as every other edit and survive the
 * save-payload -> JSON -> restore round trip used by project persistence.
 */
describe('Stage 1 edits through the real provider', () => {
  const roots: { root: ReturnType<typeof createRoot>; container: HTMLDivElement }[] = []
  let clock = 1_000_000

  beforeEach(() => {
    vi.clearAllMocks()
    // History coalesces edits made within 600 ms; a controllable clock makes each edit its own step.
    clock = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => clock)
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    for (const { root, container } of roots) {
      try { await act(async () => { root.unmount() }) } catch {}
      container.remove()
    }
    roots.length = 0
  })

  const ctx = () => (window as any).__personalizationCtx
  const layers = () => ctx().previewSettings.layers as any[]
  const layer = (id: string) => layers().find((l) => l.id === id)
  const step = () => { clock += 1000 }

  const mountAndOpen = async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    roots.push({ root, container })
    await act(async () => {
      root.render(<DemoPersonalizeProvider><TestOpener /></DemoPersonalizeProvider>)
    })
    await act(async () => {
      ctx().openPersonalize({
        source: {
          sourceType: 'landing-demo', id: 'demo-1', title: 'Test Demo', mediaType: 'image',
          sourceMedia: 'https://example.com/source.png', poster: null, shortPrompt: 't', fullPrompt: 't',
          originalPrompt: 't', sourceMetadata: {},
        } as any,
      })
    })
  }

  it('applies a pure edit, then undo and redo walk it back and forth', async () => {
    await mountAndOpen()
    const ids = layers().map((l) => l.id)
    expect(ids.length).toBeGreaterThan(2)
    const [a, b] = ids
    step()
    await act(async () => { ctx().editPreviewSettings((p: any) => groupLayers(p, [a, b])!.settings) })
    expect(layer(a).groupId).toBe('group-1')
    expect(layer(b).groupId).toBe('group-1')
    step()
    await act(async () => { ctx().editPreviewSettings((p: any) => reorderLayer(p, a, 'front')) })
    expect(layers().at(-1).id).toBe(a)

    expect(ctx().canUndoPreview).toBe(true)
    await act(async () => { ctx().undoPreview() })
    expect(layers().map((l) => l.id)).toEqual(ids) // reorder undone
    expect(layer(a).groupId).toBe('group-1') // grouping still there
    await act(async () => { ctx().undoPreview() })
    expect(layer(a).groupId).toBeUndefined() // grouping undone
    expect(ctx().canRedoPreview).toBe(true)
    await act(async () => { ctx().redoPreview() })
    expect(layer(a).groupId).toBe('group-1')
    await act(async () => { ctx().redoPreview() })
    expect(layers().at(-1).id).toBe(a)
  })

  it('rotation, grouping, source transform and custom fields survive save -> JSON -> restore', async () => {
    await mountAndOpen()
    const [a, b] = layers().map((l) => l.id)
    step()
    await act(async () => {
      ctx().editPreviewSettings((p: any) => ({
        ...groupLayers(p, [a, b])!.settings,
        layers: groupLayers(p, [a, b])!.settings.layers.map((l: any) => (l.id === a ? { ...l, rotation: 27.5 } : l)),
        sourceTransform: { x: 0.3, y: 0.6, zoom: 1.75 },
        customFields: { city: 'Austin', offer_code: 'SAVE10' },
      }))
    })
    const before = ctx().previewSettings
    // The exact save path: strip session-scoped URLs, serialise, then restore through the normaliser.
    const saved = stripSessionScopedUrls({ previewSettings: before } as any).previewSettings
    const restored = normalizePreviewSettings(JSON.parse(JSON.stringify(saved)))
    expect(restored.layers.find((l: any) => l.id === a)).toMatchObject({ rotation: 27.5, groupId: 'group-1' })
    expect(restored.layers.find((l: any) => l.id === b).groupId).toBe('group-1')
    expect(restored.sourceTransform).toEqual({ x: 0.3, y: 0.6, zoom: 1.75 })
    expect(restored.customFields).toEqual({ city: 'Austin', offer_code: 'SAVE10' })
    // Restoring a restored copy changes nothing (idempotent), and layer order is kept.
    expect(normalizePreviewSettings(JSON.parse(JSON.stringify(restored)))).toEqual(restored)
    expect(restored.layers.map((l: any) => l.id)).toEqual(before.layers.map((l: any) => l.id))
  })
})
