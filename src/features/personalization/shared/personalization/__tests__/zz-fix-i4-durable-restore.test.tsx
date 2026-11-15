/**
 * Regression test for the durable-restore fall-through fix (Fix I-4).
 *
 * The pre-fix `restoreProject` returned as soon as the Supabase project row
 * was missing, which meant a freshly saved payload that never reached the
 * server (POST returned 200 but the row was not persisted under the lookup
 * key the GET reads) was overwritten with defaults on reload. The per-user
 * localStorage mirror the writeback effect maintains was never consulted.
 *
 * After the fix:
 *   (a) with NO Supabase row but a populated localStorage preview state,
 *       restore returns the saved values
 *   (b) with a Supabase row present, the Supabase row still wins (the
 *       pre-existing durableFieldRestore.test.tsx suite continues to cover
 *       this; we re-assert it here in isolation)
 *   (c) cross-user isolation: localStorage state from another user is NOT
 *       restored
 *
 * Pattern: mirrors the existing durableFieldRestore.test.tsx harness so the
 * suite stays in the browser (no Supabase, no real network) by mocking the
 * `loadProject` client the provider already uses.
 */

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('@ohb/packages/studio/src/muapi', () => ({ uploadFile: vi.fn() }))

vi.mock('../assetUploadService', () => ({ uploadPersonalizationAsset: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}))

vi.mock('@ohb/components/SocialPublishProvider', () => ({
  SocialPublishContext: { Provider: ({ children }: any) => children, Consumer: ({ children }: any) => children(null) } as any,
  useSocialPublish: () => { throw new Error('useSocialPublish must be used within a <SocialPublishProvider>') },
}))

vi.mock('@ohb/lib/authConfig', () => ({
  useAuthConfig: () => ({
    apiKey: 'user-a-api-key',
    openaiKey: '',
    setApiKey: vi.fn(),
    setOpenAiKey: vi.fn(),
    clearApiKey: vi.fn(),
    clearOpenAiKey: vi.fn(),
    clearAllKeys: vi.fn(),
    hasApiKey: true,
    hasOpenaiKey: false,
    isAuthenticated: true,
  }),
}))

vi.mock('../promptPersonalizer', () => ({ personalizePrompt: vi.fn(), regeneratePrompt: vi.fn() }))
vi.mock('../generationRouter', () => ({ runGeneration: vi.fn() }))
vi.mock('../postProcessor', () => ({ applyPostProcessing: vi.fn(), generateEndCardImage: vi.fn() }))
vi.mock('../PersonalizationModal', () => ({ default: () => null }))
vi.mock('../editedAssetPersistence', () => ({ persistEditedPersonalizationAsset: vi.fn() }))

const { DemoPersonalizeProvider, useDemoPersonalize } = await import('../DemoPersonalizeProvider')
const supabase = await import('../supabaseProjectPersistence')

const PREVIEW_STORAGE_PREFIX = 'smartvideo_preview_state_'

function TestCapture() {
  const ctx = useDemoPersonalize()
  ;(window as any).__personalizationCtx = ctx
  return null
}

beforeEach(() => {
  if (typeof window !== 'undefined') localStorage.clear()
})

function makeLocalPreviewPayload() {
  return {
    previewSettings: {
      layout: 'product-showcase',
      layers: [
        { id: 'logo', kind: 'logo', visible: true, x: 0.1, y: 0.1, scale: 0.25, animation: 'logo-reveal', animationDelay: 0, startFrame: 0, opacity: 1, imageUrl: 'https://cdn.example.com/mirror-logo.png' },
        { id: 'headline', kind: 'headline', visible: true, x: 0.5, y: 0.85, scale: 0.05, animation: 'slide-up', animationDelay: 0, startFrame: 0, opacity: 1, text: 'Mirror Headline' },
      ],
      brandColors: { primary: '#112233', accent: '#445566', text: '#778899', backgroundDim: 0.5 },
      aspectRatio: '9:16',
      fps: 30,
      durationInFrames: 300,
      showEndCard: false,
      width: 1080,
      height: 1920,
    },
    previewVideo: { url: 'https://cdn.example.com/mirror-preview.mp4', poster: null, title: 'Mirror clip', kind: 'saved' },
    guidedStep: 3,
    viewMode: 'advanced',
  }
}

async function mountAndOpen(opts: { loadResult: unknown; userScope?: string }) {
  vi.spyOn(supabase, 'loadProject').mockResolvedValue({ ok: true, data: opts.loadResult as any })

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <DemoPersonalizeProvider userScope={opts.userScope}>
        <TestCapture />
      </DemoPersonalizeProvider>,
    )
  })

  await act(async () => {
    ;(window as any).__personalizationCtx.openPersonalize({
      source: {
        id: 'demo-restore-i4',
        title: 'Restore test',
        mediaType: 'video',
        originalPrompt: 'Original prompt',
        sourceMedia: 'https://cdn.example.com/original.mp4',
        poster: null,
        fullPrompt: 'Original prompt',
        shortPrompt: 'Original prompt',
        sourceType: 'go-ai-viral-video',
        model: 'kling-o1-video-edit',
        sourceMetadata: {},
      },
    })
  })

  await act(async () => {
    await new Promise((r) => setTimeout(r, 120))
  })

  // The modal opens fresh and offers the saved project; continue with it.
  const opened = (window as any).__personalizationCtx
  if (opened.resumableProject) {
    await act(async () => {
      await opened.resumeLastProject()
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 120))
    })
  }
}

describe('DemoPersonalizeProvider durable-restore fall-through (Fix I-4)', () => {
  it('(a) restores the per-user localStorage preview mirror when Supabase has no row', async () => {
    // No Supabase row: loadProject returns ok=true with no data.
    await mountAndOpen({ loadResult: undefined, userScope: 'userA' })

    // Pre-populate localStorage under userA's scope AFTER mount but BEFORE the
    // restore promise resolves? Simpler: pre-populate, then open. The writeback
    // effect debounces 800ms; the restore effect resolves within ~tens of ms.
    // We re-do the scenario by seeding localStorage first and remounting.
    localStorage.clear()
    localStorage.setItem(
      `${PREVIEW_STORAGE_PREFIX}userA_demo-restore-i4`,
      JSON.stringify(makeLocalPreviewPayload()),
    )

    // Re-mount to trigger the restore path with the seeded mirror present.
    await mountAndOpen({ loadResult: undefined, userScope: 'userA' })

    const ctx = (window as any).__personalizationCtx

    // Brand colors from the mirror — Supabase had no row, so the mirror wins.
    expect(ctx.previewSettings.brandColors.primary).toBe('#112233')
    expect(ctx.previewSettings.brandColors.accent).toBe('#445566')
    expect(ctx.previewSettings.brandColors.text).toBe('#778899')
    expect(ctx.previewSettings.brandColors.backgroundDim).toBe(0.5)

    // Aspect ratio + composition dimensions from the mirror.
    expect(ctx.previewSettings.aspectRatio).toBe('9:16')
    expect(ctx.previewSettings.width).toBe(1080)
    expect(ctx.previewSettings.height).toBe(1920)
    expect(ctx.previewSettings.fps).toBe(30)
    expect(ctx.previewSettings.durationInFrames).toBe(300)
    expect(ctx.previewSettings.showEndCard).toBe(false)

    // Layout + a representative layer from the mirror.
    expect(ctx.previewSettings.layout).toBe('product-showcase')
    const headline = ctx.previewSettings.layers.find((l: any) => l.kind === 'headline')
    expect(headline?.text).toBe('Mirror Headline')
    expect(headline?.x).toBe(0.5)
    expect(headline?.y).toBe(0.85)

    const logo = ctx.previewSettings.layers.find((l: any) => l.kind === 'logo')
    expect(logo?.imageUrl).toBe('https://cdn.example.com/mirror-logo.png')

    // previewVideo + guided step + view mode from the mirror.
    expect(ctx.previewVideo?.url).toBe('https://cdn.example.com/mirror-preview.mp4')
    expect(ctx.guidedStep).toBe(3)
    expect(ctx.viewMode).toBe('advanced')

    // Approval is always cleared on restore — re-confirmation is a UX choice.
    expect(ctx.previewApproved).toBe(false)
  })

  it('(a2) falls back to defaults when localStorage mirror is empty AND Supabase has no row', async () => {
    localStorage.clear()
    await mountAndOpen({ loadResult: undefined, userScope: 'userA' })

    const ctx = (window as any).__personalizationCtx
    // Default layout seeded from the source.
    expect(ctx.previewSettings.layout).toBe('business-introduction')
    expect(ctx.previewSettings.layers.length).toBeGreaterThan(0)
    expect(ctx.previewVideo).toBeNull()
    expect(ctx.guidedStep).toBe(1)
    expect(ctx.viewMode).toBe('simple')
  })

  it('(b) Supabase row still wins when both Supabase and localStorage have state', async () => {
    localStorage.clear()

    // Supabase has the row (this is what loadProject would return when the
    // row exists for the current user+source).
    const supabaseEntry = {
      id: 'proj-i4',
      sourceDemoId: 'demo-restore-i4',
      sourceDemoSlug: 'demo-restore-i4',
      sourceType: 'go-ai-viral-video',
      personalizationMode: 'face_only',
      model: 'kling-o1-video-edit',
      originalPrompt: 'Original prompt',
      personalizedPrompt: 'Personalized prompt',
      identityAssetIds: [],
      logoAssetIds: [],
      productAssetIds: [],
      brandReferenceAssetIds: [],
      firstFrameAssetId: null,
      lastFrameAssetId: null,
      outputUrls: [],
      outputType: 'prompt',
      clientId: null,
      status: 'draft',
      ctaHeadline: null,
      callToAction: null,
      generationSettings: {
        engine: 'smartvideo-recommended',
        preserveAudio: true,
        exactLogoHandling: 'final-overlay',
        exactCtaHandling: 'final-end-card',
        firstFrameMode: 'uploaded',
        lastFrameMode: 'uploaded',
        aspectRatio: '9:16',
        consentGiven: false,
      },
      aiAssistState: {},
      previewSettings: {
        layout: 'product-showcase',
        layers: [
          { id: 'headline', kind: 'headline', visible: true, x: 0.5, y: 0.85, scale: 0.05, animation: 'slide-up', animationDelay: 0, startFrame: 0, opacity: 1, text: 'Supabase Headline' },
        ],
        brandColors: { primary: '#aaaaaa', accent: '#bbbbbb', text: '#cccccc', backgroundDim: 0.25 },
        aspectRatio: '9:16',
        fps: 30,
        durationInFrames: 240,
        showEndCard: false,
        width: 1080,
        height: 1920,
      },
      previewVideo: { url: 'https://cdn.example.com/supabase-preview.mp4', poster: null, title: 'Supabase clip', kind: 'saved' },
      guidedStep: 2,
      viewMode: 'simple',
    }

    // Pre-populate the mirror with conflicting values — Supabase must win.
    localStorage.setItem(
      `${PREVIEW_STORAGE_PREFIX}userA_demo-restore-i4`,
      JSON.stringify(makeLocalPreviewPayload()),
    )

    await mountAndOpen({ loadResult: supabaseEntry, userScope: 'userA' })

    const ctx = (window as any).__personalizationCtx

    // Supabase preview settings win over the mirror.
    expect(ctx.previewSettings.brandColors.primary).toBe('#aaaaaa')
    expect(ctx.previewSettings.brandColors.accent).toBe('#bbbbbb')
    expect(ctx.previewSettings.brandColors.backgroundDim).toBe(0.25)
    expect(ctx.previewSettings.durationInFrames).toBe(240)

    const headline = ctx.previewSettings.layers.find((l: any) => l.kind === 'headline')
    expect(headline?.text).toBe('Supabase Headline')

    expect(ctx.previewVideo?.url).toBe('https://cdn.example.com/supabase-preview.mp4')
    expect(ctx.guidedStep).toBe(2)
    expect(ctx.viewMode).toBe('simple')
  })

  it('(c) does NOT restore localStorage mirror written by a different user', async () => {
    localStorage.clear()

    // userA wrote the mirror while logged in.
    localStorage.setItem(
      `${PREVIEW_STORAGE_PREFIX}userA_demo-restore-i4`,
      JSON.stringify(makeLocalPreviewPayload()),
    )

    // userB (different scope) opens the modal — Supabase also has no row, so
    // the fall-through would normally hit localStorage, but the key is scoped
    // to userA, so userB must NOT see userA's preview state.
    await mountAndOpen({ loadResult: undefined, userScope: 'userB' })

    const ctx = (window as any).__personalizationCtx

    // userA's distinctive values must NOT leak into userB's preview.
    expect(ctx.previewSettings.brandColors.primary).not.toBe('#112233')
    expect(ctx.previewSettings.brandColors.accent).not.toBe('#445566')

    const headline = ctx.previewSettings.layers.find((l: any) => l.kind === 'headline')
    expect(headline?.text).not.toBe('Mirror Headline')

    expect(ctx.previewVideo?.url).not.toBe('https://cdn.example.com/mirror-preview.mp4')
    expect(ctx.guidedStep).not.toBe(3)

    // userB's view mode must remain the default — not 'advanced'.
    expect(ctx.viewMode).toBe('simple')

    // userA's key remains untouched in storage so they can still reload it.
    const userAKey = `${PREVIEW_STORAGE_PREFIX}userA_demo-restore-i4`
    expect(localStorage.getItem(userAKey)).not.toBeNull()
  })
})