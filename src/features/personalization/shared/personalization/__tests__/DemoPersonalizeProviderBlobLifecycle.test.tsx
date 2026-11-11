// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { DemoPersonalizeContextValue } from '../DemoPersonalizeProvider'
import type { PersistEditedAssetClientResult } from '../editedAssetPersistence'

declare global {
  interface Window {
    __personalizationCtx: DemoPersonalizeContextValue
  }
}

type PersonalizationAssetEntry = DemoPersonalizeContextValue['assets']['logos'][number]
type SavedClientAssetEntry = DemoPersonalizeContextValue['savedClientAssets']['logos'][number]
type TimerId = ReturnType<typeof setTimeout>

vi.mock('@ohb/packages/studio/src/muapi', () => ({
  uploadFile: vi.fn(),
}))

vi.mock('../assetUploadService', () => ({
  uploadPersonalizationAsset: vi.fn(),
}))

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
    Consumer: ({ children }: { children: (value: null) => ReactNode }) => children(null),
  },
  useSocialPublish: () => {
    throw new Error('useSocialPublish must be used within a <SocialPublishProvider>')
  },
}))

// Mutable API key so a single describe can flip into test-mode-key for the
// test-mode bypass scenario (vi.mock is hoisted, so it must read a variable).
const authState = vi.hoisted(() => ({ apiKey: 'test-key' }))

vi.mock('@ohb/lib/authConfig', () => ({
  useAuthConfig: () => ({
    apiKey: authState.apiKey,
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

vi.mock('../PersonalizationModal', () => ({
  default: () => null,
}))

vi.mock('../editedAssetPersistence', () => ({
  persistEditedPersonalizationAsset: vi.fn(),
}))

const { DemoPersonalizeProvider, useDemoPersonalize } = await import('../DemoPersonalizeProvider')
const { uploadPersonalizationAsset } = await import('../assetUploadService')
const { persistEditedPersonalizationAsset } = await import('../editedAssetPersistence')

// 1x1 transparent PNG — same payload used by the reference edit-persistence tests.
const TEST_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

// ── Environment save/restore ────────────────────────────────────────────────
const originalSetTimeout = globalThis.setTimeout
const originalClearTimeout = globalThis.clearTimeout
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL
const originalFetch = globalThis.fetch

function TestOpener() {
  const ctx = useDemoPersonalize()
  window.__personalizationCtx = ctx
  return null
}

function createFile(name: string, type = 'image/png'): File {
  return new File([name], name, { type })
}

function createFileList(files: File[]): FileList {
  const list: Record<number, File> = {}
  files.forEach((file, i) => {
    list[i] = file
  })
  return {
    length: files.length,
    item: (i: number) => list[i] ?? null,
    ...list,
  } as unknown as FileList
}

const activeRoots: { root: Root; container: HTMLElement }[] = []
let pendingTimers: Set<TimerId> = new Set()
let blobCounter = 0
let capturedRejection: unknown = null

function unhandledRejectionHandler(reason: unknown) {
  capturedRejection = reason
}

function installTimerTracking() {
  const trackedSetTimeout = ((fn: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) => {
    const id = originalSetTimeout(() => {
      pendingTimers.delete(id)
      ;(fn as (...a: unknown[]) => void)(...args)
    }, ms)
    pendingTimers.add(id)
    return id
  }) as typeof globalThis.setTimeout
  globalThis.setTimeout = trackedSetTimeout

  const trackedClearTimeout = ((id: TimerId) => {
    pendingTimers.delete(id)
    return originalClearTimeout(id)
  }) as typeof globalThis.clearTimeout
  globalThis.clearTimeout = trackedClearTimeout
}

function uninstallTimerTracking() {
  globalThis.setTimeout = originalSetTimeout
  globalThis.clearTimeout = originalClearTimeout
}

// ── Observable blob-URL assertions ────────────────────────────────────────
function revokeCalls(): string[] {
  return vi.mocked(URL.revokeObjectURL).mock.calls.map((call) => call[0])
}

/** Count of revoke calls that targeted a NON-blob (https://…) URL — must be 0. */
function revokedHttpCount(): number {
  return revokeCalls().filter((u) => typeof u !== 'string' || !u.startsWith('blob:')).length
}

function countRevoked(url: string): number {
  return revokeCalls().filter((u) => u === url).length
}

/** The distinct blob URL string handed back for the File with the given name. */
function blobFor(fileName: string): string | undefined {
  const create = vi.mocked(URL.createObjectURL)
  for (let i = 0; i < create.mock.calls.length; i++) {
    const arg = create.mock.calls[i][0] as File
    if (arg && arg.name === fileName) return create.mock.results[i].value
  }
  return undefined
}

// Bounded polling helpers.
async function waitFor(cond: () => boolean, timeout = 2000, interval = 20): Promise<void> {
  const start = Date.now()
  while (Date.now() - start <= timeout) {
    let ok = false
    await act(async () => {
      try {
        ok = Boolean(cond())
      } catch {
        ok = false
      }
    })
    if (ok) return
    await act(async () => {
      await new Promise((r) => setTimeout(r, interval))
    })
  }
  throw new Error('waitFor timed out waiting for condition')
}

/** Polls a raw condition WITHOUT act() — safe after a root has been unmounted. */
async function settle(cond: () => boolean, timeout = 2000, interval = 20): Promise<void> {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error('settle timed out waiting for condition')
    await new Promise((r) => setTimeout(r, interval))
  }
}

/**
 * Mock Supabase edited-asset persistence to resolve on a macrotask — the way a
 * real network round-trip behaves. This lets React commit the provider's
 * intermediate "edited" asset state (syncing assetsRef) before the provider
 * runs its blob-release step.
 */
function mockPersistResolvesAfter(publicUrl: string, ms = 25): void {
  vi.mocked(persistEditedPersonalizationAsset).mockImplementation(
    () =>
      new Promise<PersistEditedAssetClientResult>((resolve) =>
        setTimeout(() =>
          resolve({
            ok: true,
            assetId: 'edited-asset',
            publicUrl,
            hasTransparency: false,
            transparentPixelCount: 0,
            totalPixelCount: 0,
          }),
          ms,
        ),
      ),
  )
}

/** Mock asset upload to resolve on a macrotask, like a real network round-trip. */
function mockUploadResolvesAfter(url: string, ms = 30): void {
  vi.mocked(uploadPersonalizationAsset).mockImplementation(
    () =>
      new Promise((resolve) =>
        setTimeout(() => resolve({ url }), ms),
      ),
  )
}

const renderProvider = async (opts: { testMode?: boolean } = {}): Promise<Root> => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  activeRoots.push({ root, container })
  await act(async () => {
    root.render(
      <DemoPersonalizeProvider testMode={opts.testMode}>
        <TestOpener />
      </DemoPersonalizeProvider>,
    )
  })
  return root
}

const openSource = async () => {
  await act(async () => {
    window.__personalizationCtx.openPersonalize({
      source: { id: 'demo-1', title: 'Test', mediaType: 'video', originalPrompt: 'test', sourceMedia: null, poster: null, fullPrompt: 'test', shortPrompt: 'test', sourceType: 'landing-demo', model: 'kling-o1-video-edit', sourceMetadata: {} },
    })
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50))
  })
}

describe('DemoPersonalizeProvider blob-URL lifecycle', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      localStorage.clear()
    }
    blobCounter = 0
    pendingTimers = new Set()
    capturedRejection = null
    authState.apiKey = 'test-key'
    vi.clearAllMocks()
    vi.resetModules()
    // Distinct blob per created file so liveness checks can tell them apart.
    URL.createObjectURL = vi.fn((file: File) => 'blob:http://localhost/test-' + (file?.name ?? 'x') + '-' + ++blobCounter)
    URL.revokeObjectURL = vi.fn()
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch
    installTimerTracking()
    process.on('unhandledRejection', unhandledRejectionHandler)
  })

  afterEach(async () => {
    process.off('unhandledRejection', unhandledRejectionHandler)
    vi.useRealTimers()

    // Unmount every provider still mounted — this cancels the debounced
    // Supabase persist and releases owned blobs via the unmount effect.
    const roots = activeRoots.splice(0)
    for (const { root, container } of roots) {
      await act(async () => {
        root.unmount()
      })
      container.remove()
    }
    // Flush any late microtasks/timers so unhandled rejections can surface.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    uninstallTimerTracking()

    if (capturedRejection !== null) {
      URL.createObjectURL = originalCreateObjectURL
      URL.revokeObjectURL = originalRevokeObjectURL
      globalThis.fetch = originalFetch
      const msg = capturedRejection instanceof Error ? capturedRejection.message : String(capturedRejection)
      throw new Error('Unhandled promise rejection during test: ' + msg)
    }
    if (pendingTimers.size > 0) {
      URL.createObjectURL = originalCreateObjectURL
      URL.revokeObjectURL = originalRevokeObjectURL
      globalThis.fetch = originalFetch
      throw new Error(`Unresolved timers after test: ${pendingTimers.size} still pending`)
    }

    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    globalThis.fetch = originalFetch
  })

  it('instant upload revokes its original blob URL', async () => {
    vi.mocked(uploadPersonalizationAsset).mockResolvedValue({ url: 'https://example.com/uploaded-logo.png' })

    await renderProvider()
    await openSource()

    await act(async () => {
      window.__personalizationCtx.addLogoFiles(createFileList([createFile('logo.png')]))
    })

    await waitFor(() => window.__personalizationCtx.assets.logos[0]?.uploadStatus === 'ready')

    const ctx = window.__personalizationCtx
    const logo = ctx.assets.logos[0]
    const originalBlob = blobFor('logo.png')

    expect(logo).toBeTruthy()
    expect(logo.url).toBe('https://example.com/uploaded-logo.png')
    expect(logo.uploadStatus).toBe('ready')
    expect(originalBlob).toBeTruthy()
    // Exactly one revoke, and it is the original blob — never an https URL.
    expect(revokeCalls().length).toBe(1)
    expect(revokeCalls()[0]).toBe(originalBlob)
    expect(revokedHttpCount()).toBe(0)
  })

  it('delayed upload revokes its original blob URL after completion', async () => {
    // Manually gated so the "while uploading" assertions are deterministic and
    // not subject to real-timer / act-flush timing.
    let releaseUpload!: (value: { url: string }) => void
    vi.mocked(uploadPersonalizationAsset).mockImplementation(
      () => new Promise<{ url: string }>((resolve) => { releaseUpload = resolve }),
    )

    await renderProvider()
    await openSource()

    await act(async () => {
      window.__personalizationCtx.addLogoFiles(createFileList([createFile('logo.png')]))
    })

    const originalBlob = blobFor('logo.png')

    // While uploading: still the blob, not yet revoked.
    let logo = window.__personalizationCtx.assets.logos[0]
    expect(logo.uploadStatus).toBe('uploading')
    expect(logo.url).toBe(originalBlob)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    await act(async () => {
      releaseUpload({ url: 'https://example.com/uploaded-logo.png' })
    })

    await waitFor(() => window.__personalizationCtx.assets.logos[0]?.uploadStatus === 'ready')

    logo = window.__personalizationCtx.assets.logos[0]
    expect(logo.url).toBe('https://example.com/uploaded-logo.png')
    expect(logo.uploadStatus).toBe('ready')
    expect(revokeCalls().length).toBe(1)
    expect(revokeCalls()[0]).toBe(originalBlob)
    expect(revokedHttpCount()).toBe(0)
  })

  it('concurrent uploads generate independent durable URLs and revoke each original blob once', async () => {
    vi.mocked(uploadPersonalizationAsset).mockImplementation((_apiKey: string, { file }: { file: File }) => {
      const delay = file.name === 'p1.png' ? 30 : file.name === 'p2.png' ? 60 : 90
      return new Promise<{ url: string }>((resolve) => setTimeout(() => resolve({ url: `https://example.com/uploaded-${file.name}` }), delay))
    })

    await renderProvider()
    await openSource()

    await act(async () => {
      window.__personalizationCtx.addProductFiles(createFileList([createFile('p1.png'), createFile('p2.png'), createFile('p3.png')]))
    })

    await waitFor(() => {
      const ps = window.__personalizationCtx.assets.products
      return ps.length === 3 && ps.every((p: PersonalizationAssetEntry) => p.uploadStatus === 'ready')
    })

    const ctx = window.__personalizationCtx
    const products = ctx.assets.products
    expect(products.length).toBe(3)
    expect(products.map((p: PersonalizationAssetEntry) => p.url)).toEqual([
      'https://example.com/uploaded-p1.png',
      'https://example.com/uploaded-p2.png',
      'https://example.com/uploaded-p3.png',
    ])

    // Each original product blob revoked exactly once → 3 total, all blob URLs.
    expect(blobFor('p1.png')).toBeTruthy()
    expect(countRevoked(blobFor('p1.png')!)).toBe(1)
    expect(countRevoked(blobFor('p2.png')!)).toBe(1)
    expect(countRevoked(blobFor('p3.png')!)).toBe(1)
    expect(revokeCalls().length).toBe(3)
    expect(revokedHttpCount()).toBe(0)
  })

  it('removing an asset during upload does not recreate the asset or revoke a live blob', async () => {
    let uploadResolved = 0
    vi.mocked(uploadPersonalizationAsset).mockImplementation((_key: string, { file }: { file: File }) =>
      new Promise<{ url: string }>((resolve) => {
        setTimeout(() => {
          uploadResolved += 1
          resolve({ url: `https://example.com/uploaded-${file.name}` })
        }, 100)
      }),
    )

    await renderProvider()
    await openSource()

    await act(async () => {
      window.__personalizationCtx.addLogoFiles(createFileList([createFile('logo.png')]))
    })

    const originalBlob = blobFor('logo.png')
    const logoId = window.__personalizationCtx.assets.logos[0].id
    // Upload is still pending — remove before it completes.
    expect(uploadResolved).toBe(0)
    expect(window.__personalizationCtx.assets.logos[0].uploadStatus).toBe('uploading')

    await act(async () => {
      window.__personalizationCtx.removeLogo(logoId)
    })

    // Its own blob may be revoked once at removal time.
    expect(countRevoked(originalBlob!)).toBe(1)

    // Wait past the upload completion (act-wrapped so the still-mounted
    // provider's post-completion state update does not warn).
    await waitFor(() => uploadResolved >= 1)

    // Asset stays gone; the stale completion is a no-op.
    const ctx = window.__personalizationCtx
    expect(ctx.assets.logos.length).toBe(0)
    expect(countRevoked(originalBlob!)).toBe(1)
    expect(revokedHttpCount()).toBe(0)
  })

  it('upload failure keeps a usable preview and retry revokes the original blob once', async () => {
    vi.mocked(uploadPersonalizationAsset)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ url: 'https://example.com/retried-logo.png' })

    await renderProvider()
    await openSource()

    await act(async () => {
      window.__personalizationCtx.addLogoFiles(createFileList([createFile('logo.png')]))
    })

    await waitFor(() => window.__personalizationCtx.assets.logos[0]?.uploadStatus === 'error')

    const originalBlob = blobFor('logo.png')
    let logo = window.__personalizationCtx.assets.logos[0]
    // Failure keeps the local blob alive and revokes nothing.
    expect(logo.uploadStatus).toBe('error')
    expect(logo.url).toBe(originalBlob)
    expect(logo.url.startsWith('blob:')).toBe(true)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    await act(async () => {
      await window.__personalizationCtx.retryAssetUpload(logo.id)
    })
    await waitFor(() => window.__personalizationCtx.assets.logos[0]?.uploadStatus === 'ready')

    logo = window.__personalizationCtx.assets.logos[0]
    // Retry replaces the temporary blob with the durable URL and revokes it once.
    expect(logo.url).toBe('https://example.com/retried-logo.png')
    expect(logo.uploadStatus).toBe('ready')
    expect(revokeCalls().length).toBe(1)
    expect(revokeCalls()[0]).toBe(originalBlob)
    expect(revokedHttpCount()).toBe(0)
  })

  it('failed retry keeps the preview usable and revokes nothing', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(uploadPersonalizationAsset)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))

    await renderProvider()
    await openSource()

    await act(async () => {
      window.__personalizationCtx.addLogoFiles(createFileList([createFile('logo.png')]))
    })

    await waitFor(() => window.__personalizationCtx.assets.logos[0]?.uploadStatus === 'error')

    const originalBlob = blobFor('logo.png')
    let logo = window.__personalizationCtx.assets.logos[0]
    expect(logo.url).toBe(originalBlob)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    await act(async () => {
      try {
        await window.__personalizationCtx.retryAssetUpload(logo.id)
      } catch {
        /* expected — retry fails */
      }
    })

    await waitFor(() => window.__personalizationCtx.assets.logos[0]?.uploadStatus === 'error')

    logo = window.__personalizationCtx.assets.logos[0]
    // Still local blob (usable preview), still error, still nothing revoked.
    expect(logo.url).toBe(originalBlob)
    expect(logo.url.startsWith('blob:')).toBe(true)
    expect(logo.uploadStatus).toBe('error')
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    expect(revokedHttpCount()).toBe(0)
    errSpy.mockRestore()
  })

  it('edited assets use the correct durable URL and keep the revert original usable', async () => {
    vi.mocked(uploadPersonalizationAsset).mockResolvedValue({ url: 'https://example.com/durable-logo.png' })
    mockPersistResolvesAfter('https://example.com/edited.png')

    await renderProvider()
    await openSource()

    await act(async () => {
      window.__personalizationCtx.addLogoFiles(createFileList([createFile('logo.png')]))
    })
    await waitFor(() => window.__personalizationCtx.assets.logos[0]?.uploadStatus === 'ready')

    const originalBlob = blobFor('logo.png')
    const logoId = window.__personalizationCtx.assets.logos[0].id
    expect(window.__personalizationCtx.assets.logos[0].url).toBe('https://example.com/durable-logo.png')
    // Original (upload) blob revoked exactly once on upload replacement.
    expect(countRevoked(originalBlob!)).toBe(1)
    expect(revokedHttpCount()).toBe(0)

    const applyPromise = (() => {
      let p!: Promise<void>
      act(() => {
        p = window.__personalizationCtx.applyEditedPersonalizationAsset(logoId, TEST_DATA_URL, {
          operation: 'remove-background',
          prompt: 'remove background',
          model: 'test-model',
          quality: 'high',
          transparent: true,
          videoReady: false,
        })
      })
      return p
    })()

    // The provider sets the edited asset state, THEN awaits the (network-like)
    // persistence before releasing its preview blob. Give React a real render
    // turn to commit the edit (syncing the asset ref the release reads) and let
    // the persist resolve — the same ordering a real network round-trip has.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await act(async () => {
      await applyPromise
    })

    await waitFor(() => {
      const l = window.__personalizationCtx.assets.logos.find((x: PersonalizationAssetEntry) => x.id === logoId)
      return l?.url === 'https://example.com/edited.png' && l?.uploadStatus === 'ready'
    })

    const edited = window.__personalizationCtx.assets.logos.find((x: PersonalizationAssetEntry) => x.id === logoId)!
    expect(edited.url).toBe('https://example.com/edited.png')
    expect(edited.uploadedUrl).toBe('https://example.com/edited.png')
    expect(edited.uploadStatus).toBe('ready')
    expect(edited.edited).toBe(true)
    expect(edited.editMetadata?.operation).toBe('remove-background')
    // The edit's temporary preview blob is revoked exactly once.
    expect(blobFor('logo-edited.png')).toBeTruthy()
    expect(countRevoked(blobFor('logo-edited.png')!)).toBe(1)
    // Original blob still revoked exactly once; no https URL ever revoked.
    expect(countRevoked(originalBlob!)).toBe(1)
    expect(revokedHttpCount()).toBe(0)

    // Revert: the still-referenced original URL must survive; revoke count stable.
    const revokesBefore = revokeCalls().length
    await act(async () => {
      window.__personalizationCtx.revertLibraryAssetToOriginal(logoId)
    })

    const reverted = window.__personalizationCtx.assets.logos.find((x: PersonalizationAssetEntry) => x.id === logoId)!
    expect(reverted.url).toBe('https://example.com/durable-logo.png')
    expect(reverted.edited).toBe(false)
    expect(reverted.uploadStatus).toBe('ready')
    expect(revokeCalls().length).toBe(revokesBefore)
    expect(revokedHttpCount()).toBe(0)
  })

  it('saved-client edited asset propagates durable URLs and releases the edit blob once', async () => {
    vi.mocked(uploadPersonalizationAsset).mockResolvedValue({ url: 'https://example.com/uploaded-logo.png' })
    mockPersistResolvesAfter('https://example.com/persisted-saved.png')

    await renderProvider()
    await openSource()

    await act(async () => {
      window.__personalizationCtx.addLogoFiles(createFileList([createFile('logo.png')]))
    })
    await waitFor(() => window.__personalizationCtx.assets.logos[0]?.uploadStatus === 'ready')

    await act(async () => {
      window.__personalizationCtx.saveClient()
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctxBefore = window.__personalizationCtx
    const clientId = ctxBefore.selectedClientId
    expect(clientId).toBeTruthy()
    const logoId = ctxBefore.assets.logos[0].id

    const applyPromise = (() => {
      let p!: Promise<void>
      act(() => {
        p = window.__personalizationCtx.applyEditedSavedClientAsset(clientId, logoId, TEST_DATA_URL, {
          operation: 'remove-background',
          prompt: 'remove background',
          model: 'test-model',
          quality: 'high',
          transparent: true,
          videoReady: false,
        })
      })
      return p
    })()

    // Let React commit the edited asset (syncing the asset refs the release
    // step reads) and let the network-like persistence resolve.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await act(async () => {
      await applyPromise
    })

    await waitFor(() => {
      const s = window.__personalizationCtx.savedClientAssets.logos.find((l: SavedClientAssetEntry) => l.id === logoId)
      return s?.url === 'https://example.com/persisted-saved.png' && s?.uploadStatus === 'ready'
    })

    const ctxAfter = window.__personalizationCtx
    const savedLogo = ctxAfter.savedClientAssets.logos.find((l: SavedClientAssetEntry) => l.id === logoId)!
    expect(savedLogo).toBeTruthy()
    expect(savedLogo.edited).toBe(true)
    expect(savedLogo.editMetadata?.operation).toBe('remove-background')
    expect(savedLogo.url).toBe('https://example.com/persisted-saved.png')
    expect(savedLogo.uploadedUrl).toBe('https://example.com/persisted-saved.png')

    const jobLogo = ctxAfter.assets.logos.find((l: PersonalizationAssetEntry) => l.id === logoId)!
    expect(jobLogo).toBeTruthy()
    expect(jobLogo.edited).toBe(true)
    expect(jobLogo.url).toBe('https://example.com/persisted-saved.png')

    // The temporary edit blob is released exactly once (idempotent across the
    // saved + job ownership entries).
    const editBlob = blobFor('logo-edited.png')
    expect(editBlob).toBeTruthy()
    expect(countRevoked(editBlob!)).toBe(1)
    expect(revokedHttpCount()).toBe(0)
  })

  it('a saved entry keeps its blob alive when its job copy finishes uploading', async () => {
    // Long delay so the "saved while upload in flight" state is stable across
    // act() flushes even on a loaded machine.
    mockUploadResolvesAfter('https://example.com/uploaded-logo.png', 200)
    await renderProvider()
    await openSource()

    await act(async () => {
      window.__personalizationCtx.addLogoFiles(createFileList([createFile('logo.png')]))
    })

    // Save the client while the upload is still in flight: the saved entry
    // mirrors the local (blob) preview.
    await act(async () => {
      window.__personalizationCtx.saveClient()
    })

    const logoId = window.__personalizationCtx.assets.logos[0].id
    const uploadBlob = blobFor('logo.png')
    expect(uploadBlob).toBeTruthy()
    expect(window.__personalizationCtx.savedClientAssets.logos.some((l: SavedClientAssetEntry) => l.id === logoId)).toBe(true)
    const savedBefore = window.__personalizationCtx.savedClientAssets.logos.find((l: SavedClientAssetEntry) => l.id === logoId)!
    expect(savedBefore.url).toBe(uploadBlob)

    // Deselect the client so the mirror effect can no longer repair the saved
    // entry, then let the upload finish.
    await act(async () => {
      window.__personalizationCtx.selectClient('')
    })
    await waitFor(() => window.__personalizationCtx.assets.logos[0]?.uploadStatus === 'ready')

    // The job copy now holds the durable URL, but the saved entry still renders
    // its blob preview: that blob must NOT have been revoked.
    const saved = window.__personalizationCtx.savedClientAssets.logos.find((l: SavedClientAssetEntry) => l.id === logoId)!
    expect(saved).toBeTruthy()
    expect(saved.url).toBe(uploadBlob)
    expect(countRevoked(uploadBlob!)).toBe(0)
    expect(revokedHttpCount()).toBe(0)
  })

  it('saved-client edit fallback replaces the saved entry blob with the durable URL', async () => {
    mockUploadResolvesAfter('https://example.com/uploaded-logo.png')
    vi.mocked(uploadPersonalizationAsset)
      .mockResolvedValueOnce({ url: 'https://example.com/uploaded-logo.png' })
      .mockResolvedValueOnce({ url: 'https://example.com/uploaded-saved.png' })
    vi.mocked(persistEditedPersonalizationAsset).mockResolvedValue({
      ok: false,
      assetId: 'edited-asset',
      publicUrl: '',
      hasTransparency: false,
      transparentPixelCount: 0,
      totalPixelCount: 0,
      error: 'persistence unavailable',
    })

    await renderProvider()
    await openSource()

    await act(async () => {
      window.__personalizationCtx.addLogoFiles(createFileList([createFile('logo.png')]))
    })
    await act(async () => {
      window.__personalizationCtx.saveClient()
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    await waitFor(() => window.__personalizationCtx.assets.logos[0]?.uploadStatus === 'ready')

    const clientId = window.__personalizationCtx.selectedClientId
    const logoId = window.__personalizationCtx.assets.logos[0].id

    // Deselect the client so only the saved library references the edit
    // result — the mirror effect cannot repair the entry in this scenario.
    await act(async () => {
      window.__personalizationCtx.selectClient('')
    })

    const applyPromise = (() => {
      let p!: Promise<void>
      act(() => {
        p = window.__personalizationCtx.applyEditedSavedClientAsset(clientId, logoId, TEST_DATA_URL, {
          operation: 'remove-background',
          prompt: 'remove background',
          model: 'test-model',
          quality: 'high',
          transparent: true,
          videoReady: false,
        })
      })
      return p
    })()

    await act(async () => {
      await new Promise((r) => setTimeout(r, 40))
    })
    await act(async () => {
      await applyPromise
    })

    // The saved entry must end up on the durable fallback URL — never on the
    // edit preview blob that the upload release revoked.
    await waitFor(() => {
      const s = window.__personalizationCtx.savedClientAssets.logos.find((l: SavedClientAssetEntry) => l.id === logoId)
      return s?.url === 'https://example.com/uploaded-saved.png' && s?.uploadStatus === 'ready'
    })

    const savedLogo = window.__personalizationCtx.savedClientAssets.logos.find((l: SavedClientAssetEntry) => l.id === logoId)!
    expect(savedLogo.edited).toBe(true)
    expect(savedLogo.editMetadata?.operation).toBe('remove-background')
    expect(savedLogo.uploadedUrl).toBe('https://example.com/uploaded-saved.png')
    expect(String(savedLogo.url).startsWith('blob:')).toBe(false)

    // The edit blob is released exactly once; the original upload blob is
    // released exactly once (it lost its last saved reference when the edit
    // replaced it); no durable URL is ever revoked.
    const editBlob = blobFor('logo-edited.png')
    expect(editBlob).toBeTruthy()
    expect(countRevoked(editBlob!)).toBe(1)
    expect(countRevoked(blobFor('logo.png')!)).toBe(1)
    expect(revokedHttpCount()).toBe(0)
  })
  it('test-mode bypass swaps the blob for a fake durable URL and revokes the original', async () => {
    authState.apiKey = 'test-mode-key'
    vi.mocked(uploadPersonalizationAsset).mockResolvedValue({ url: 'https://example.com/SHOULD-NOT-BE-USED.png' })

    await renderProvider({ testMode: true })
    await openSource()

    await act(async () => {
      window.__personalizationCtx.addLogoFiles(createFileList([createFile('logo.png')]))
    })

    await waitFor(() => window.__personalizationCtx.assets.logos[0]?.uploadStatus === 'ready')

    const logo = window.__personalizationCtx.assets.logos[0]
    const originalBlob = blobFor('logo.png')

    // The test-mode bypass engaged with its fake durable URL.
    expect(logo.url).toBe('https://example.com/test-uploaded-asset.png')
    expect(logo.uploadStatus).toBe('ready')
    expect(countRevoked(originalBlob!)).toBe(1)
    expect(uploadPersonalizationAsset).not.toHaveBeenCalled()
    expect(revokedHttpCount()).toBe(0)
  })

  it('unmounting the provider releases remaining owned blob URLs', async () => {
    // Hold the uploads in flight until this test releases them. A wall-clock
    // delay (e.g. 200ms) is not a safe "still uploading" window here: under
    // full-suite CPU contention the provider's own render can be delayed past
    // it, so the uploads would already be `ready` when the assertions run.
    // Gating them keeps the "unmounted while uploads are pending" scenario
    // deterministic without changing what is asserted.
    let releaseUploads!: () => void
    const uploadsPending = new Promise<void>((resolve) => {
      releaseUploads = resolve
    })
    let uploadResolved = 0
    vi.mocked(uploadPersonalizationAsset).mockImplementation((_key: string, { file }: { file: File }) =>
      uploadsPending.then(() => {
        uploadResolved += 1
        return { url: `https://example.com/uploaded-${file.name}` }
      }),
    )

    const root = await renderProvider()
    await openSource()

    await act(async () => {
      window.__personalizationCtx.addLogoFiles(createFileList([createFile('a.png'), createFile('b.png')]))
    })

    // Both assets are registered as `uploading` before any upload completes.
    await waitFor(() => {
      const logos = window.__personalizationCtx.assets.logos
      return logos.length === 2 && logos.every((l: PersonalizationAssetEntry) => l.uploadStatus === 'uploading')
    })

    const logos = window.__personalizationCtx.assets.logos
    expect(logos.length).toBe(2)
    expect(logos.every((l: PersonalizationAssetEntry) => l.uploadStatus === 'uploading')).toBe(true)
    const blobA = blobFor('a.png')
    const blobB = blobFor('b.png')
    expect(uploadResolved).toBe(0) // uploads still pending

    // Unmount BEFORE the uploads complete.
    await act(async () => {
      root.unmount()
    })

    // Both owned blobs are released exactly once; nothing https is revoked.
    expect(countRevoked(blobA!)).toBe(1)
    expect(countRevoked(blobB!)).toBe(1)
    expect(revokedHttpCount()).toBe(0)

    // Let the still-pending uploads settle so their timers do not leak and no
    // rejection is produced from the completed-but-unmounted uploads.
    releaseUploads()
    await settle(() => uploadResolved >= 2)

    expect(countRevoked(blobA!)).toBe(1)
    expect(countRevoked(blobB!)).toBe(1)
    expect(revokedHttpCount()).toBe(0)
  })

  it('leaves no unresolved timers or unhandled promise rejections', async () => {
    vi.mocked(uploadPersonalizationAsset).mockResolvedValue({ url: 'https://example.com/uploaded-logo.png' })

    const root = await renderProvider()
    await openSource()

    await act(async () => {
      window.__personalizationCtx.addLogoFiles(createFileList([createFile('logo.png')]))
    })
    await waitFor(() => window.__personalizationCtx.assets.logos[0]?.uploadStatus === 'ready')

    // Closing keeps the provider mounted (a debounced persist may still be
    // scheduled); unmounting cancels it.
    await act(async () => {
      window.__personalizationCtx.closePersonalize()
    })
    await act(async () => {
      root.unmount()
    })

    // No provider-created timer should survive teardown, and nothing rejected.
    await settle(() => pendingTimers.size === 0, 500)
    expect(pendingTimers.size).toBe(0)
    expect(capturedRejection).toBeNull()
  })
})
