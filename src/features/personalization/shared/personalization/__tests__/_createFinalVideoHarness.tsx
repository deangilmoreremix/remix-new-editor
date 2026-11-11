// @vitest-environment jsdom
/**
 * Shared harness for the `createFinalVideo` branded-render tests.
 *
 * `createFinalVideo` lives inside the `DemoPersonalizeProvider` React component,
 * so exercising its branded-render branch means rendering the provider. This
 * harness pins down the same dependency mock set the existing
 * `DemoPersonalizeProvider.test.tsx` uses, plus a controllable mock of
 * `@remotion/web-renderer` (the real `exportPersonalizedVideo` /
 * `cancelActiveExport` plumbing runs unchanged and calls through the mock).
 *
 * Mock factories here use inline `vi.fn()` for the provider deps (self-contained)
 * and `vi.hoisted` for `@remotion/web-renderer`. The hoisted object is NOT
 * exported — tests reach the same renderer spies by importing them from
 * `@remotion/web-renderer`, which resolves to these instances.
 */
import { vi } from 'vitest'
import { act, useLayoutEffect, useRef, type FC, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

// ── Provider dependency mocks (same set as DemoPersonalizeProvider.test.tsx) ──
vi.mock('@ohb/packages/studio/src/muapi', () => ({ uploadFile: vi.fn() }))
vi.mock('../assetUploadService', () => ({ uploadPersonalizationAsset: vi.fn() }))
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
  SocialPublishContext: {
    Provider: ({ children }: { children: ReactNode }) => children,
    Consumer: ({ children }: { children: (v: null) => ReactNode }) => children(null),
  } as any,
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
vi.mock('../generationRouter', () => ({ runGeneration: vi.fn() }))
vi.mock('../postProcessor', () => ({
  applyPostProcessing: vi.fn(),
  generateEndCardImage: vi.fn(),
}))
vi.mock('../PersonalizationModal', () => ({ default: () => null }))
vi.mock('../editedAssetPersistence', () => ({
  persistEditedPersonalizationAsset: vi.fn(),
}))

// ── @remotion/web-renderer mock ────────────────────────────────────────────────
const rendererMocks = vi.hoisted(() => ({
  canRenderMediaOnWeb: vi.fn(),
  renderMediaOnWeb: vi.fn(),
  getEncodableVideoCodecs: vi.fn(),
  getEncodableAudioCodecs: vi.fn(),
}))

vi.mock('@remotion/web-renderer', () => ({
  canRenderMediaOnWeb: rendererMocks.canRenderMediaOnWeb,
  renderMediaOnWeb: rendererMocks.renderMediaOnWeb,
  getEncodableVideoCodecs: rendererMocks.getEncodableVideoCodecs,
  getEncodableAudioCodecs: rendererMocks.getEncodableAudioCodecs,
}))

// Configure a fully-capable browser by default. Tests override per-case.
export function configureCapableBrowser() {
  rendererMocks.getEncodableVideoCodecs.mockImplementation((container: string) =>
    Promise.resolve(container === 'mp4' ? (['h264'] as const) : (['vp9', 'vp8'] as const)),
  )
  rendererMocks.getEncodableAudioCodecs.mockImplementation((container: string) =>
    Promise.resolve(container === 'mp4' ? (['aac'] as const) : (['opus', 'vorbis'] as const)),
  )
  rendererMocks.canRenderMediaOnWeb.mockResolvedValue({ canRender: true, issues: [] as unknown[] })
  rendererMocks.renderMediaOnWeb.mockImplementation(async () => ({
    getBlob: async () => new Blob(['fake-branded-video-bytes'], { type: 'video/mp4' }),
  }))
}

export function resetRendererMocks() {
  vi.clearAllMocks()
  configureCapableBrowser()
}

// The hoisted spies — same instances `@remotion/web-renderer` resolves to and
// that `webExport.ts` calls through.
export const canRenderMediaOnWeb = rendererMocks.canRenderMediaOnWeb
export const renderMediaOnWeb = rendererMocks.renderMediaOnWeb
export const getEncodableVideoCodecs = rendererMocks.getEncodableVideoCodecs
export const getEncodableAudioCodecs = rendererMocks.getEncodableAudioCodecs

// ── Provider + webExport re-exports (loaded AFTER the mocks above register) ────
const providerModule = await import('../DemoPersonalizeProvider')
const webExportModule = await import('../webExport')

export const DemoPersonalizeProvider = providerModule.DemoPersonalizeProvider
export const useDemoPersonalize = providerModule.useDemoPersonalize
export const { cancelActiveExport, isExportActive } = webExportModule
export type { WebExportResult } from '../webExport'

// ── Render helpers ────────────────────────────────────────────────────────────
export interface HarnessRef {
  current: any
}

export const TestOpener: FC<{ ctxRef: HarnessRef }> = ({ ctxRef }) => {
  const ctx = useDemoPersonalize()
  ctxRef.current = ctx
  ;(window as any).__personalizationCtx = ctx
  return null
}

export async function renderProvider(ctxRef: HarnessRef): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(
      <DemoPersonalizeProvider>
        <TestOpener ctxRef={ctxRef} />
      </DemoPersonalizeProvider>,
    )
  })
  return container
}

export function makeDemoSource() {
  return {
    id: 'demo-1',
    title: 'Test',
    mediaType: 'video' as const,
    originalPrompt: 'test',
    sourceMedia: null,
    poster: null,
    fullPrompt: 'test',
    shortPrompt: 'test',
    sourceType: 'landing-demo' as const,
    model: 'kling-o1-video-edit',
    sourceMetadata: {},
  }
}

export async function openSource(ctxRef: HarnessRef) {
  await act(async () => {
    ;(window as any).__personalizationCtx.openPersonalize({ source: makeDemoSource() })
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50))
  })
}

export function getCtx(ctxRef: HarnessRef): any {
  return (window as any).__personalizationCtx
}

export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
