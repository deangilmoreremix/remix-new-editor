// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { DemoPersonalizeProvider, useDemoPersonalize } from '../DemoPersonalizeProvider'

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

// The clip lengths the preview should follow.
const clipSeconds: Record<string, number> = {
  'https://cdn.example.com/recast-20s.mp4': 20,
  'https://cdn.example.com/original-5s.mp4': 5,
}
vi.mock('../preview/fitSettingsToClip', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../preview/fitSettingsToClip')>()),
  readClipMetadata: vi.fn(async (url: string) =>
    clipSeconds[url] ? { durationSeconds: clipSeconds[url], width: 1920, height: 1080 } : null),
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
const ORIGINAL = 'https://cdn.example.com/original-5s.mp4'
const RECAST = 'https://cdn.example.com/recast-20s.mp4'

describe('applying a recast sets the preview length', () => {
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
    await act(async () => {
      ctx().openPersonalize({
        source: { id: 'demo-len', title: 'Demo', mediaType: 'video', originalPrompt: 'p', sourceMedia: ORIGINAL, poster: null, fullPrompt: 'p', shortPrompt: 'p', sourceType: 'landing-demo', sourceMetadata: {} },
        initialAssets: {
          presenterVideos: [
            { id: 'pv-1', url: RECAST, name: 'Recast', type: 'presenter_video', source: 'url', mimeType: 'video/mp4', editMetadata: { operation: 'full_body_recast', sourceUrl: 'https://cdn.example.com/performance.mp4' } },
            { id: 'pv-2', url: 'https://cdn.example.com/recast-two.mp4', name: 'Recast two', type: 'presenter_video', source: 'url', mimeType: 'video/mp4', editMetadata: { operation: 'full_body_recast' } },
          ],
        },
      })
    })
    await act(async () => {
      ctx().setPreviewVideo({ url: ORIGINAL, poster: null, title: 'Original', kind: 'demo' })
    })
    await act(async () => {
      ctx().updatePreviewComposition({ durationInFrames: 5 * ctx().previewSettings.fps })
    })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('a longer saved recast runs at its own length, and undo goes back to the original length', async () => {
    const fps = ctx().previewSettings.fps
    expect(ctx().previewSettings.durationInFrames).toBe(5 * fps)

    await act(async () => {
      ctx().applyPresenterVideo('pv-1')
    })
    expect(ctx().previewVideo.url).toBe(RECAST)
    expect(ctx().previewSettings.durationInFrames).toBe(20 * fps)

    await act(async () => {
      ctx().restoreOriginalVideo()
    })
    expect(ctx().previewVideo.url).toBe(ORIGINAL)
    expect(ctx().previewSettings.durationInFrames).toBe(5 * fps)
  })

  it('undo with no chosen video goes back to the demo video and its length', async () => {
    const fps = ctx().previewSettings.fps
    await act(async () => {
      ctx().setPreviewVideo(null)
    })
    await act(async () => {
      ctx().applyPresenterVideo('pv-1')
    })
    expect(ctx().previewSettings.durationInFrames).toBe(20 * fps)

    await act(async () => {
      ctx().restoreOriginalVideo()
    })
    // Undo goes to the demo's own video, kept as an explicit target (a final
    // video run later rewrites the source's media, so it can't be relied on).
    expect(ctx().previewVideo).toMatchObject({ url: ORIGINAL, kind: 'source' })
    expect(ctx().previewSettings.durationInFrames).toBe(5 * fps)
  })

  it("a recast keeps its performance clip's sound with \"Keep the original video's sound\" on, and not with it off", async () => {
    await act(async () => {
      ctx().applyPresenterVideo('pv-1')
    })
    expect(ctx().previewVideo.audioUrl).toBe('https://cdn.example.com/performance.mp4')

    await act(async () => {
      ctx().restoreOriginalVideo()
    })
    await act(async () => {
      ctx().updateGenOptions({ ...ctx().genOptions, preserveAudio: false })
    })
    await act(async () => {
      ctx().applyPresenterVideo('pv-1')
    })
    expect(ctx().previewVideo.audioUrl).toBeNull()
  })

  it('undo after applying two recasts goes back to the chosen demo video, not the source', async () => {
    await act(async () => { ctx().applyPresenterVideo('pv-1') })
    await act(async () => { ctx().applyPresenterVideo('pv-2') })
    expect(ctx().previewVideo.url).toBe('https://cdn.example.com/recast-two.mp4')

    await act(async () => { ctx().restoreOriginalVideo() })
    expect(ctx().previewVideo).toMatchObject({ url: ORIGINAL, kind: 'demo' })
  })

  it("another account signing in removes the previous account's recast from the preview", async () => {
    await act(async () => { ctx().applyPresenterVideo('pv-1') })
    expect(ctx().previewVideo.kind).toBe('recast')

    await act(async () => {
      root.render(<DemoPersonalizeProvider userScope="another-account"><Capture /></DemoPersonalizeProvider>)
    })
    expect(ctx().previewVideo).toBeNull()
  })
})
