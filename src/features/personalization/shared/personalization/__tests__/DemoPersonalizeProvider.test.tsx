// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, useEffect, useLayoutEffect, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'fs'
import { join } from 'path'

vi.mock('@ohb/packages/studio/src/muapi', () => ({
  uploadFile: vi.fn(),
}))

vi.mock('../assetUploadService', () => ({
  uploadPersonalizationAsset: vi.fn(),
}))

// jsdom cannot load images; each test decides which addresses "load".
const imageProbe = vi.hoisted(() => ({ loads: vi.fn(async (_url: string) => false) }))
vi.mock('../imageLoadProbe', () => ({ imageLoadsInBrowser: imageProbe.loads }))

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
  SocialPublishContext: { Provider: ({ children }: any) => children, Consumer: ({ children }: any) => children(null) } as any,
  useSocialPublish: () => {
    throw new Error('useSocialPublish must be used within a <SocialPublishProvider>')
  },
}))

const authKeys = vi.hoisted(() => ({ apiKey: 'test-key', openaiKey: '' }))

vi.mock('@ohb/lib/authConfig', () => ({
  useAuthConfig: () => ({
    apiKey: authKeys.apiKey,
    openaiKey: authKeys.openaiKey,
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

const { DemoPersonalizeProvider, useDemoPersonalize, getGenerationAssetUrl } = await import('../DemoPersonalizeProvider')
const { uploadFile } = await import('@ohb/packages/studio/src/muapi')
const { uploadPersonalizationAsset } = await import('../assetUploadService')
const { personalizePrompt, regeneratePrompt } = await import('../promptPersonalizer')
const { runGeneration } = await import('../generationRouter')
const { applyPostProcessing, generateEndCardImage } = await import('../postProcessor')
const { persistEditedPersonalizationAsset } = await import('../editedAssetPersistence')

const generationPromiseResolvers: ((status: string) => void)[] = []

function TestOpener() {
  const ctx = useDemoPersonalize()
  const ctxRef = useMemo(() => ({ current: ctx as any }), [])
  ctxRef.current = ctx
  ;(window as any).__personalizationCtx = ctxRef.current

  ;(window as any).__onGenerationChange = (status: string) => {
    generationPromiseResolvers.forEach((r) => r(status))
    generationPromiseResolvers.length = 0
  }

  const prevStatusRef = useMemo(() => ({ current: null as string | null }), [])
  useLayoutEffect(() => {
    const status = ctx.generation.status
    if (prevStatusRef.current !== null && prevStatusRef.current !== status) {
      ;(window as any).__onGenerationChange?.(status)
    }
    prevStatusRef.current = status
  }, [ctx])

  return null
}

async function waitForGeneration(expectedStatus: string, timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      generationPromiseResolvers.length = 0
      reject(new Error(`Timed out waiting for generation.status="${expectedStatus}"`))
    }, timeout)

    generationPromiseResolvers.push((status: string) => {
      clearTimeout(timer)
      if (status === expectedStatus) resolve()
      else reject(new Error(`Expected generation.status="${expectedStatus}" but got "${status}"`))
    })
  })
}

/**
 * Waits until the provider's latest committed context satisfies `predicate`.
 *
 * Discovery status transitions are driven by resolved fetch promises and 2s
 * poll timers, so under full-suite CPU contention they commit later than a
 * fixed wall-clock sleep guarantees. Waiting on the state itself (instead of
 * assuming it has already landed) keeps the assertions deterministic without
 * changing what they assert.
 */
async function waitForDiscoveryState(
  latest: () => any,
  predicate: (ctx: any) => boolean,
  timeout = 10000,
): Promise<void> {
  const deadline = Date.now() + timeout

  for (;;) {
    let matched = false
    await act(async () => {
      try {
        matched = Boolean(predicate(latest()))
      } catch {
        matched = false
      }
    })
    if (matched) return

    if (Date.now() >= deadline) {
      const ctx = latest()
      throw new Error(
        `Timed out after ${timeout}ms waiting for discovery state ` +
          `(discoveryStatus="${ctx?.discoveryStatus ?? 'unknown'}", ` +
          `discoveryError="${ctx?.discoveryError ?? 'unknown'}")`,
      )
    }

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
  }
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

beforeEach(() => {
  if (typeof window !== 'undefined') {
    localStorage.clear()
  }
})

describe('DemoPersonalizeProvider durable uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test')
    URL.revokeObjectURL = vi.fn()
    generationPromiseResolvers.length = 0
  })

  const renderProvider = async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <DemoPersonalizeProvider>
          <TestOpener />
        </DemoPersonalizeProvider>,
      )
    })

    return container
  }

  const openSource = async () => {
    await act(async () => {
      ;(window as any).__personalizationCtx.openPersonalize({
        source: { id: 'demo-1', title: 'Test', mediaType: 'video', originalPrompt: 'test', sourceMedia: null, poster: null, fullPrompt: 'test', shortPrompt: 'test', sourceType: 'landing-demo', model: 'kling-o1-video-edit', sourceMetadata: {} },
      })
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
  }

  it('uploads identity files and stores durable URL', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockResolvedValue({ url: 'https://example.com/uploaded-identity.jpg' })

    await renderProvider()
    await openSource()

    const files = createFileList([createFile('dean.jpg', 'image/jpeg')])

    await act(async () => {
      ;(window as any).__personalizationCtx.addIdentityFiles(files)
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctx = (window as any).__personalizationCtx
    const identity = ctx.assets.identities[0]
    expect(identity).toBeTruthy()
    expect(identity.url).toBe('https://example.com/uploaded-identity.jpg')
    expect(identity.uploadStatus).toBe('ready')
  })

  it('uploads logo files and stores durable URL', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockResolvedValue({ url: 'https://example.com/uploaded-logo.png' })

    await renderProvider()
    await openSource()

    const files = createFileList([createFile('logo.png')])

    await act(async () => {
      ;(window as any).__personalizationCtx.addLogoFiles(files)
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctx = (window as any).__personalizationCtx
    const logo = ctx.assets.logos[0]
    expect(logo).toBeTruthy()
    expect(logo.url).toBe('https://example.com/uploaded-logo.png')
    expect(logo.uploadStatus).toBe('ready')
  })

  it('uploads product files and stores durable URL', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockResolvedValue({ url: 'https://example.com/uploaded-product.png' })

    await renderProvider()
    await openSource()

    const files = createFileList([createFile('product.png')])

    await act(async () => {
      ;(window as any).__personalizationCtx.addProductFiles(files)
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctx = (window as any).__personalizationCtx
    const product = ctx.assets.products[0]
    expect(product).toBeTruthy()
    expect(product.url).toBe('https://example.com/uploaded-product.png')
    expect(product.uploadStatus).toBe('ready')
  })

  it('uploads brand reference files and stores durable URL', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockResolvedValue({ url: 'https://example.com/uploaded-brand.png' })

    await renderProvider()
    await openSource()

    const files = createFileList([createFile('brand.png')])

    await act(async () => {
      ;(window as any).__personalizationCtx.addBrandReferenceFiles(files)
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctx = (window as any).__personalizationCtx
    const brand = ctx.assets.brandReferences[0]
    expect(brand).toBeTruthy()
    expect(brand.url).toBe('https://example.com/uploaded-brand.png')
    expect(brand.uploadStatus).toBe('ready')
  })

  it('uploads first frame and stores durable URL', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockResolvedValue({ url: 'https://example.com/uploaded-first.png' })

    await renderProvider()
    await openSource()

    const file = createFile('first.png')

    await act(async () => {
      ;(window as any).__personalizationCtx.setFirstFrameFile(file)
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctx = (window as any).__personalizationCtx
    const firstFrame = ctx.assets.firstFrame
    expect(firstFrame).toBeTruthy()
    expect(firstFrame!.url).toBe('https://example.com/uploaded-first.png')
    expect(firstFrame!.uploadStatus).toBe('ready')
  })

  it('uploads last frame and stores durable URL', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockResolvedValue({ url: 'https://example.com/uploaded-last.png' })

    await renderProvider()
    await openSource()

    const file = createFile('last.png')

    await act(async () => {
      ;(window as any).__personalizationCtx.setLastFrameFile(file)
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctx = (window as any).__personalizationCtx
    const lastFrame = ctx.assets.lastFrame
    expect(lastFrame).toBeTruthy()
    expect(lastFrame!.url).toBe('https://example.com/uploaded-last.png')
    expect(lastFrame!.uploadStatus).toBe('ready')
  })

  it('uploads CTA graphic and stores durable URL', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockResolvedValue({ url: 'https://example.com/uploaded-cta.png' })

    await renderProvider()
    await openSource()

    const file = createFile('cta.png')

    await act(async () => {
      ;(window as any).__personalizationCtx.setCtaGraphicFile(file)
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctx = (window as any).__personalizationCtx
    const cta = ctx.assets.ctaGraphic
    expect(cta).toBeTruthy()
    expect(cta!.url).toBe('https://example.com/uploaded-cta.png')
    expect(cta!.uploadStatus).toBe('ready')
  })

  it('rejects blob URLs in generation guard for logo', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockImplementation(() => new Promise(() => {}))

    await renderProvider()
    await openSource()

    const files = createFileList([createFile('logo.png')])

    await act(async () => {
      ;(window as any).__personalizationCtx.addLogoFiles(files)
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const updatedCtx = (window as any).__personalizationCtx
    const logo = updatedCtx.assets.logos[0]
    expect(logo).toBeTruthy()
    expect(logo.url.startsWith('blob:')).toBe(true)

    const genPromise = waitForGeneration('error')

    await act(async () => {
      await updatedCtx.generate()
    })

    await genPromise

    const finalCtx = (window as any).__personalizationCtx
    expect(finalCtx.generation.status).toBe('error')
    expect(finalCtx.generation.errorMessage).toMatch(/still uploading/i)
  })

  it('handles upload failure and retry', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ url: 'https://example.com/retried-logo.png' })

    await renderProvider()
    await openSource()

    const files = createFileList([createFile('logo.png')])

    await act(async () => {
      ;(window as any).__personalizationCtx.addLogoFiles(files)
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    let ctx = (window as any).__personalizationCtx
    const logo = ctx.assets.logos[0]
    expect(logo.uploadStatus).toBe('error')

    await act(async () => {
      await ctx.retryAssetUpload(logo.id)
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    ctx = (window as any).__personalizationCtx
    const retriedLogo = ctx.assets.logos[0]
    expect(retriedLogo.url).toBe('https://example.com/retried-logo.png')
    expect(retriedLogo.uploadStatus).toBe('ready')
  })

  it('removes asset and revokes blob URL', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockResolvedValue({ url: 'https://example.com/uploaded-logo.png' })

    await renderProvider()
    await openSource()

    const files = createFileList([createFile('logo.png')])

    await act(async () => {
      ;(window as any).__personalizationCtx.addLogoFiles(files)
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctx = (window as any).__personalizationCtx
    const logo = ctx.assets.logos[0]
    expect(logo).toBeTruthy()

    await act(async () => {
      ;(window as any).__personalizationCtx.removeLogo(logo.id)
    })

    expect((window as any).__personalizationCtx.assets.logos.length).toBe(0)
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })

  it('supports multiple concurrent product uploads', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockImplementation((_apiKey: string, { file }: { file: File }) => {
      return new Promise<{ url: string }>((resolve) => {
        setTimeout(() => resolve({ url: `https://example.com/uploaded-${file.name}` }), Math.random() * 50 + 10)
      })
    })

    await renderProvider()
    await openSource()

    const files = createFileList([createFile('p1.png'), createFile('p2.png'), createFile('p3.png')])

    await act(async () => {
      ;(window as any).__personalizationCtx.addProductFiles(files)
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200))
    })

    const ctx = (window as any).__personalizationCtx
    expect(ctx.assets.products.length).toBe(3)
    expect(ctx.assets.products.every((p: any) => p.uploadStatus === 'ready')).toBe(true)
    expect(ctx.assets.products.map((p: any) => p.url)).toEqual([
      'https://example.com/uploaded-p1.png',
      'https://example.com/uploaded-p2.png',
      'https://example.com/uploaded-p3.png',
    ])
  })

  it('supports multiple concurrent brand reference uploads', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockImplementation((_apiKey: string, { file }: { file: File }) => {
      return new Promise<{ url: string }>((resolve) => {
        setTimeout(() => resolve({ url: `https://example.com/uploaded-${file.name}` }), Math.random() * 50 + 10)
      })
    })

    await renderProvider()
    await openSource()

    const files = createFileList([createFile('b1.png'), createFile('b2.png')])

    await act(async () => {
      ;(window as any).__personalizationCtx.addBrandReferenceFiles(files)
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200))
    })

    const ctx = (window as any).__personalizationCtx
    expect(ctx.assets.brandReferences.length).toBe(2)
    expect(ctx.assets.brandReferences.every((b: any) => b.uploadStatus === 'ready')).toBe(true)
  })

  it('keeps primary identity correct during async uploads', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockImplementation((_apiKey: string, { file }: { file: File }) => {
      return new Promise<{ url: string }>((resolve) => {
        setTimeout(() => resolve({ url: `https://example.com/uploaded-${file.name}` }), Math.random() * 100 + 20)
      })
    })

    await renderProvider()
    await openSource()

    const files = createFileList([createFile('face.jpg'), createFile('body.jpg'), createFile('side.jpg')])

    await act(async () => {
      ;(window as any).__personalizationCtx.addIdentityFiles(files)
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 150))
    })

    const ctx = (window as any).__personalizationCtx
    expect(ctx.assets.identities.length).toBe(3)
    expect(ctx.assets.primaryIdentity?.id).toBe(ctx.assets.identities[0].id)
    expect(ctx.assets.identities.every((i: any) => i.uploadStatus === 'ready' || i.uploadStatus === 'uploading')).toBe(true)
  })

  it('keeps primary logo correct during async uploads', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockImplementation((_apiKey: string, { file }: { file: File }) => {
      return new Promise<{ url: string }>((resolve) => {
        setTimeout(() => resolve({ url: `https://example.com/uploaded-${file.name}` }), Math.random() * 100 + 20)
      })
    })

    await renderProvider()
    await openSource()

    const files1 = createFileList([createFile('logo1.png')])
    const files2 = createFileList([createFile('logo2.png')])

    await act(async () => {
      ;(window as any).__personalizationCtx.addLogoFiles(files1)
    })

    await act(async () => {
      ;(window as any).__personalizationCtx.addLogoFiles(files2)
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 150))
    })

    const ctx = (window as any).__personalizationCtx
    expect(ctx.assets.logos.length).toBe(2)
    expect(ctx.assets.primaryLogo?.id).toBe(ctx.assets.logos[0].id)
    expect(ctx.assets.logos.every((l: any) => l.uploadStatus === 'ready' || l.uploadStatus === 'uploading')).toBe(true)
  })

  it('rejects non-image files for identity upload', async () => {
    await renderProvider()
    await openSource()

    const files = createFileList([createFile('doc.txt', 'text/plain')])

    await act(async () => {
      ;(window as any).__personalizationCtx.addIdentityFiles(files)
    })

    const ctx = (window as any).__personalizationCtx
    expect(ctx.assets.identities.length).toBe(0)
  })

  it('rejects non-image files for logo upload', async () => {
    await renderProvider()
    await openSource()

    const files = createFileList([createFile('doc.txt', 'text/plain')])

    await act(async () => {
      ;(window as any).__personalizationCtx.addLogoFiles(files)
    })

    const ctx = (window as any).__personalizationCtx
    expect(ctx.assets.logos.length).toBe(0)
  })

  it('rejects non-image and non-video files for product upload', async () => {
    await renderProvider()
    await openSource()

    const files = createFileList([createFile('doc.txt', 'text/plain')])

    await act(async () => {
      ;(window as any).__personalizationCtx.addProductFiles(files)
    })

    const ctx = (window as any).__personalizationCtx
    expect(ctx.assets.products.length).toBe(0)
  })

  it('rejects non-image and non-video files for brand reference upload', async () => {
    await renderProvider()
    await openSource()

    const files = createFileList([createFile('doc.txt', 'text/plain')])

    await act(async () => {
      ;(window as any).__personalizationCtx.addBrandReferenceFiles(files)
    })

    const ctx = (window as any).__personalizationCtx
    expect(ctx.assets.brandReferences.length).toBe(0)
  })

  it('respects maxImages limit for identity uploads', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockResolvedValue({ url: 'https://example.com/uploaded.jpg' })

    await renderProvider()
    await openSource()

    const files1 = createFileList([createFile('face.jpg', 'image/jpeg')])
    await act(async () => {
      ;(window as any).__personalizationCtx.addIdentityFiles(files1)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    let ctx = (window as any).__personalizationCtx
    expect(ctx.assets.identities.length).toBe(1)

    const files2 = createFileList([createFile('body.jpg', 'image/jpeg'), createFile('side.jpg', 'image/jpeg'), createFile('profile.jpg', 'image/jpeg')])
    await act(async () => {
      ;(window as any).__personalizationCtx.addIdentityFiles(files2)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    ctx = (window as any).__personalizationCtx
    expect(ctx.assets.identities.length).toBe(4)
  })

  it('respects MAX_REFERENCE_UPLOADS limit for logo uploads', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockResolvedValue({ url: 'https://example.com/uploaded.jpg' })

    await renderProvider()
    await openSource()

    const files1 = createFileList([createFile('logo1.png')])
    await act(async () => {
      ;(window as any).__personalizationCtx.addLogoFiles(files1)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    let ctx = (window as any).__personalizationCtx
    expect(ctx.assets.logos.length).toBe(1)

    const files2 = createFileList(Array.from({ length: 10 }, (_, i) => createFile(`logo${i + 2}.png`)))
    await act(async () => {
      ;(window as any).__personalizationCtx.addLogoFiles(files2)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    ctx = (window as any).__personalizationCtx
    expect(ctx.assets.logos.length).toBe(10)
  })

  it('respects MAX_REFERENCE_UPLOADS limit for product uploads', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockResolvedValue({ url: 'https://example.com/uploaded.jpg' })

    await renderProvider()
    await openSource()

    const files1 = createFileList([createFile('p1.png')])
    await act(async () => {
      ;(window as any).__personalizationCtx.addProductFiles(files1)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    let ctx = (window as any).__personalizationCtx
    expect(ctx.assets.products.length).toBe(1)

    const files2 = createFileList(Array.from({ length: 10 }, (_, i) => createFile(`p${i + 2}.png`)))
    await act(async () => {
      ;(window as any).__personalizationCtx.addProductFiles(files2)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    ctx = (window as any).__personalizationCtx
    expect(ctx.assets.products.length).toBe(10)
  })

  it('respects MAX_REFERENCE_UPLOADS limit for brand reference uploads', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockResolvedValue({ url: 'https://example.com/uploaded.jpg' })

    await renderProvider()
    await openSource()

    const files1 = createFileList([createFile('b1.png')])
    await act(async () => {
      ;(window as any).__personalizationCtx.addBrandReferenceFiles(files1)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    let ctx = (window as any).__personalizationCtx
    expect(ctx.assets.brandReferences.length).toBe(1)

    const files2 = createFileList(Array.from({ length: 10 }, (_, i) => createFile(`b${i + 2}.png`)))
    await act(async () => {
      ;(window as any).__personalizationCtx.addBrandReferenceFiles(files2)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    ctx = (window as any).__personalizationCtx
    expect(ctx.assets.brandReferences.length).toBe(10)
  })

  it('getGenerationAssetUrl returns undefined for uploading asset', () => {
    const asset = {
      id: '1',
      role: 'logo' as const,
      name: 'logo.png',
      url: 'blob:http://localhost/test',
      isPrimary: false,
      createdAt: new Date().toISOString(),
      uploadStatus: 'uploading' as const,
    }
    expect(getGenerationAssetUrl(asset)).toBeUndefined()
  })

  it('getGenerationAssetUrl returns undefined for failed asset', () => {
    const asset = {
      id: '1',
      role: 'logo' as const,
      name: 'logo.png',
      url: 'blob:http://localhost/test',
      isPrimary: false,
      createdAt: new Date().toISOString(),
      uploadStatus: 'error' as const,
    }
    expect(getGenerationAssetUrl(asset)).toBeUndefined()
  })

  it('getGenerationAssetUrl returns durable URL when ready', () => {
    const asset = {
      id: '1',
      role: 'logo' as const,
      name: 'logo.png',
      url: 'blob:http://localhost/test',
      uploadedUrl: 'https://example.com/logo.png',
      isPrimary: false,
      createdAt: new Date().toISOString(),
      uploadStatus: 'ready' as const,
    }
    expect(getGenerationAssetUrl(asset)).toBe('https://example.com/logo.png')
  })

  it('getGenerationAssetUrl rejects blob URLs even if status is ready', () => {
    const asset = {
      id: '1',
      role: 'logo' as const,
      name: 'logo.png',
      url: 'blob:http://localhost/test',
      isPrimary: false,
      createdAt: new Date().toISOString(),
      uploadStatus: 'ready' as const,
    }
    expect(getGenerationAssetUrl(asset)).toBeUndefined()
  })

  describe('URL-based asset creation', () => {
    it('adds identity via URL', async () => {
      await renderProvider()
      await openSource()

      await act(async () => {
        ;(window as any).__personalizationCtx.addIdentityUrl('https://example.com/person.jpg')
      })

      const ctx = (window as any).__personalizationCtx
      const identity = ctx.assets.identities[0]
      expect(identity).toBeTruthy()
      expect(identity.url).toBe('https://example.com/person.jpg')
      expect(identity.uploadStatus).toBe('ready')
      expect(identity.file).toBeNull()
    })

    it('adds logo via URL', async () => {
      await renderProvider()
      await openSource()

      await act(async () => {
        ;(window as any).__personalizationCtx.addLogoUrl('https://example.com/logo.png')
      })

      const ctx = (window as any).__personalizationCtx
      const logo = ctx.assets.logos[0]
      expect(logo).toBeTruthy()
      expect(logo.url).toBe('https://example.com/logo.png')
      expect(logo.uploadStatus).toBe('ready')
      expect(logo.file).toBeNull()
    })

    it('adds product via URL', async () => {
      await renderProvider()
      await openSource()

      await act(async () => {
        ;(window as any).__personalizationCtx.addProductUrl('https://example.com/product.jpg')
      })

      const ctx = (window as any).__personalizationCtx
      const product = ctx.assets.products[0]
      expect(product).toBeTruthy()
      expect(product.url).toBe('https://example.com/product.jpg')
      expect(product.uploadStatus).toBe('ready')
      expect(product.file).toBeNull()
    })

    it('adds brand reference via URL', async () => {
      await renderProvider()
      await openSource()

      await act(async () => {
        ;(window as any).__personalizationCtx.addBrandReferenceUrl('https://example.com/brand.jpg')
      })

      const ctx = (window as any).__personalizationCtx
      const brand = ctx.assets.brandReferences[0]
      expect(brand).toBeTruthy()
      expect(brand.url).toBe('https://example.com/brand.jpg')
      expect(brand.uploadStatus).toBe('ready')
      expect(brand.file).toBeNull()
    })

    it('sets first frame via URL', async () => {
      await renderProvider()
      await openSource()

      await act(async () => {
        ;(window as any).__personalizationCtx.setFirstFrameUrl('https://example.com/first-frame.jpg')
      })

      const ctx = (window as any).__personalizationCtx
      const frame = ctx.assets.firstFrame
      expect(frame).toBeTruthy()
      expect(frame.url).toBe('https://example.com/first-frame.jpg')
      expect(frame.uploadStatus).toBe('ready')
      expect(frame.file).toBeNull()
      expect(frame.isPrimary).toBe(true)
    })

    it('sets last frame via URL', async () => {
      await renderProvider()
      await openSource()

      await act(async () => {
        ;(window as any).__personalizationCtx.setLastFrameUrl('https://example.com/last-frame.jpg')
      })

      const ctx = (window as any).__personalizationCtx
      const frame = ctx.assets.lastFrame
      expect(frame).toBeTruthy()
      expect(frame.url).toBe('https://example.com/last-frame.jpg')
      expect(frame.uploadStatus).toBe('ready')
      expect(frame.file).toBeNull()
      expect(frame.isPrimary).toBe(true)
    })

    it('sets CTA graphic via URL', async () => {
      await renderProvider()
      await openSource()

      await act(async () => {
        ;(window as any).__personalizationCtx.setCtaGraphicUrl('https://example.com/cta.png')
      })

      const ctx = (window as any).__personalizationCtx
      const cta = ctx.assets.ctaGraphic
      expect(cta).toBeTruthy()
      expect(cta.url).toBe('https://example.com/cta.png')
      expect(cta.uploadStatus).toBe('ready')
      expect(cta.file).toBeNull()
      expect(cta.isPrimary).toBe(true)
    })
  })
})

describe('DemoPersonalizeProvider generation flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test')
    URL.revokeObjectURL = vi.fn()
    generationPromiseResolvers.length = 0
  })

  const renderProvider = async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <DemoPersonalizeProvider>
          <TestOpener />
        </DemoPersonalizeProvider>,
      )
    })

    return container
  }

  const openSource = async () => {
    await act(async () => {
      ;(window as any).__personalizationCtx.openPersonalize({
        source: { id: 'demo-1', title: 'Test', mediaType: 'video', originalPrompt: 'test', sourceMedia: null, poster: null, fullPrompt: 'test', shortPrompt: 'test', sourceType: 'landing-demo', model: 'kling-o1-video-edit', sourceMetadata: {} },
      })
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
  }

  it('personalizes prompt and updates prompt state', async () => {
    ;(personalizePrompt as any).mockResolvedValue('personalized prompt text')

    await renderProvider()
    await openSource()

    await act(async () => {
      ;(window as any).__personalizationCtx.updateClientForm({ businessName: 'Test Co' })
    })

    await act(async () => {
      ;(window as any).__personalizationCtx.personalizePrompt()
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200))
    })

    const ctx = (window as any).__personalizationCtx
    expect(ctx.promptState.personalized).toBe('personalized prompt text')
    expect(ctx.generation.status).toBe('idle')
  })

  it('falls back when prompt personalization fails', async () => {
    ;(personalizePrompt as any).mockRejectedValue(new Error('OpenAI error'))

    await renderProvider()
    await openSource()

    await act(async () => {
      ;(window as any).__personalizationCtx.updateClientForm({ businessName: 'Test Co' })
    })

    await act(async () => {
      ;(window as any).__personalizationCtx.personalizePrompt()
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200))
    })

    const ctx = (window as any).__personalizationCtx
    expect(ctx.generation.status).toBe('error')
    expect(ctx.generation.errorMessage).toContain('OpenAI error')
  })

  it('blocks generation when assets are still uploading', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockImplementation(() => new Promise(() => {}))

    await renderProvider()
    await openSource()

    const files = createFileList([createFile('logo.png')])

    await act(async () => {
      ;(window as any).__personalizationCtx.addLogoFiles(files)
    })

    await act(async () => {
      ;(window as any).__personalizationCtx.updateClientForm({ businessName: 'Test Co' })
      ;(window as any).__personalizationCtx.setOutputType('image')
      ;(window as any).__personalizationCtx.setMode('recreate')
    })

    await act(async () => {
      ;(window as any).__personalizationCtx.generate()
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    const ctx = (window as any).__personalizationCtx
    expect(ctx.generation.status).toBe('error')
    expect(ctx.generation.errorMessage).toContain('still uploading')
  })

  it('blocks generation when assets have blob URLs', async () => {
    await renderProvider()
    await openSource()

    await act(async () => {
      ;(window as any).__personalizationCtx.updateClientForm({ businessName: 'Test Co' })
      ;(window as any).__personalizationCtx.setOutputType('image')
      ;(window as any).__personalizationCtx.setMode('recreate')
    })

    await act(async () => {
      ;(window as any).__personalizationCtx.addIdentityUrl('blob:http://localhost/test')
    })

    await act(async () => {
      ;(window as any).__personalizationCtx.generate()
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    const ctx = (window as any).__personalizationCtx
    expect(ctx.generation.status).toBe('error')
    expect(ctx.generation.errorMessage).toContain('not uploaded yet')
  })

  it('shows progress view during generation', async () => {
    ;(runGeneration as any).mockImplementation(async (input: any) => {
      input.onProgress?.(50, 'Generating...')
      await new Promise((r) => setTimeout(r, 100))
      return { type: 'video', url: 'https://example.com/video.mp4', metadata: { model: 'test-model' } }
    })

    ;(applyPostProcessing as any).mockResolvedValue({
      finalUrl: 'https://example.com/video-final.mp4',
      originalUrl: 'https://example.com/video.mp4',
      applied: [],
    })

    await renderProvider()
    await openSource()

    await act(async () => {
      ;(window as any).__personalizationCtx.updateClientForm({ businessName: 'Test Co' })
      ;(window as any).__personalizationCtx.setOutputType('video')
      ;(window as any).__personalizationCtx.setMode('recreate')
    })

    await act(async () => {
      ;(window as any).__personalizationCtx.generate()
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 500))
    })

    const ctx = (window as any).__personalizationCtx
    expect(ctx.generation.status).toBe('complete')
    expect(ctx.result.url).toBe('https://example.com/video-final.mp4')
  })

  describe('API key gate', () => {
    const imageSource = { id: 'img-1', title: 'Img', mediaType: 'image', originalPrompt: 'test', sourceMedia: null, poster: null, fullPrompt: 'test', shortPrompt: 'test', sourceType: 'landing-demo', sourceMetadata: {} }

    afterEach(() => {
      authKeys.apiKey = 'test-key'
      authKeys.openaiKey = ''
    })

    const generateImage = async () => {
      await renderProvider()
      await act(async () => {
        ;(window as any).__personalizationCtx.openPersonalize({ source: imageSource })
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })
      await act(async () => {
        ;(window as any).__personalizationCtx.updateClientForm({ businessName: 'Test Co' })
        ;(window as any).__personalizationCtx.setMode('recreate')
      })
      await act(async () => {
        await (window as any).__personalizationCtx.generate()
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 100))
      })
      return (window as any).__personalizationCtx
    }

    it('generates an image with only an OpenAI key', async () => {
      authKeys.apiKey = ''
      authKeys.openaiKey = 'sk-test-openai-key-1234567890'
      ;(runGeneration as any).mockResolvedValue({ type: 'image', url: 'https://example.com/img.png', metadata: {} })
      ;(applyPostProcessing as any).mockResolvedValue({ finalUrl: 'https://example.com/img.png', originalUrl: 'https://example.com/img.png', applied: [] })

      const ctx = await generateImage()
      expect(runGeneration).toHaveBeenCalled()
      expect(ctx.generation.status).toBe('complete')
    })

    it('uploads a base64 result so Edit in Image Studio keeps the image', async () => {
      authKeys.apiKey = ''
      authKeys.openaiKey = 'sk-test-openai-key-1234567890'
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo='
      ;(runGeneration as any).mockResolvedValue({ type: 'image', url: dataUrl, metadata: {} })
      ;(applyPostProcessing as any).mockResolvedValue({ finalUrl: dataUrl, originalUrl: dataUrl, applied: [] })
      ;(uploadPersonalizationAsset as any).mockResolvedValue({ url: 'https://cdn.example.com/personalized.png' })
      localStorage.clear()

      const ctx = await generateImage()
      expect(ctx.generation.status).toBe('complete')
      await act(async () => {
        await ctx.editInImageStudio()
      })

      expect(uploadPersonalizationAsset).toHaveBeenCalled()
      const { readHandoff } = await import('../../crossStudio')
      expect(readHandoff('image')?.referenceImageUrl).toBe('https://cdn.example.com/personalized.png')
    })

    it('opens Video Studio after a recreate with no replacement identity', async () => {
      authKeys.apiKey = 'test-key'
      ;(runGeneration as any).mockResolvedValue({ type: 'video', url: 'https://example.com/v.mp4', metadata: {} })
      ;(applyPostProcessing as any).mockResolvedValue({ finalUrl: 'https://example.com/v.mp4', originalUrl: 'https://example.com/v.mp4', applied: [] })
      localStorage.clear()
      await renderProvider()
      const c = () => (window as any).__personalizationCtx
      await act(async () => {
        c().openPersonalize({ source: { ...imageSource, id: 'vid-1', mediaType: 'video', sourceMedia: 'https://example.com/src.mp4' } })
      })
      await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
      await act(async () => {
        c().updateClientForm({ businessName: 'Test Co' })
        c().setMode('recreate')
      })
      await act(async () => { await c().generate() })
      await act(async () => { await new Promise((r) => setTimeout(r, 100)) })
      expect(c().generation.status).toBe('complete')
      await act(async () => { c().editInVideoStudio() })

      const { readHandoff } = await import('../../crossStudio')
      expect(readHandoff('video')?.videoUrl).toBe('https://example.com/v.mp4')
    })

    it('says the OpenAI key is missing instead of doing nothing', async () => {
      authKeys.openaiKey = ''
      const ctx = await generateImage()
      expect(runGeneration).not.toHaveBeenCalled()
      expect(ctx.generation.status).toBe('error')
      expect(ctx.generation.errorMessage).toContain('OpenAI API key')
    })
  })
})

describe('DemoPersonalizeProvider asset import / durable upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test')
    URL.revokeObjectURL = vi.fn()
    ;(globalThis as any).fetch = vi.fn()
  })

  const renderProvider = async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <DemoPersonalizeProvider>
          <TestOpener />
        </DemoPersonalizeProvider>,
      )
    })

    return container
  }

  const openSource = async () => {
    await act(async () => {
      ;(window as any).__personalizationCtx.openPersonalize({
        source: { id: 'demo-1', title: 'Test', mediaType: 'video', originalPrompt: 'test', sourceMedia: null, poster: null, fullPrompt: 'test', shortPrompt: 'test', sourceType: 'landing-demo', model: 'kling-o1-video-edit', sourceMetadata: {} },
      })
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
  }

  const mockDownloadResponse = (results: Array<{ url: string; ok: boolean; dataUrl?: string; error?: string }>) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results }),
    } as Response)
    return fetchSpy
  }

  it('surfaces partial download failures in discoveryError and importConfirmation', async () => {
    const fetchSpy = mockDownloadResponse([
      { url: 'https://example.com/a.jpg', ok: true, dataUrl: `data:image/png;base64,${Buffer.from('fake-image-a').toString('base64')}` },
      { url: 'https://example.com/b.jpg', ok: false, error: 'Network timeout' },
      { url: 'https://example.com/c.jpg', ok: true, dataUrl: `data:image/png;base64,${Buffer.from('fake-image-c').toString('base64')}` },
    ])
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockResolvedValue({ url: 'https://example.com/uploaded.png' })

    await renderProvider()
    await openSource()

    await act(async () => {
      ;(window as any).__personalizationCtx.setDiscoveredAssets([
        { id: 'd1', sourceUrl: 'https://example.com/a.jpg', previewUrl: 'https://example.com/a.jpg', sourceType: 'WEBSITE', category: 'logo', confidence: 90, selected: true, recommended: true, rejected: false, assignedSection: 'logo', autoAssigned: true, originalPreviewUrl: 'https://example.com/a.jpg', edited: false, videoReady: false, hasTransparency: false, editMetadata: undefined, visionAnalysis: undefined, visionValidation: undefined },
        { id: 'd2', sourceUrl: 'https://example.com/b.jpg', previewUrl: 'https://example.com/b.jpg', sourceType: 'WEBSITE', category: 'person', confidence: 85, selected: true, recommended: true, rejected: false, assignedSection: 'person', autoAssigned: true, originalPreviewUrl: 'https://example.com/b.jpg', edited: false, videoReady: false, hasTransparency: false, editMetadata: undefined, visionAnalysis: undefined, visionValidation: undefined },
        { id: 'd3', sourceUrl: 'https://example.com/c.jpg', previewUrl: 'https://example.com/c.jpg', sourceType: 'WEBSITE', category: 'brand', confidence: 80, selected: true, recommended: true, rejected: false, assignedSection: 'brand', autoAssigned: true, originalPreviewUrl: 'https://example.com/c.jpg', edited: false, videoReady: false, hasTransparency: false, editMetadata: undefined, visionAnalysis: undefined, visionValidation: undefined },
      ])
    })

    let ctx = (window as any).__personalizationCtx
    await act(async () => {
      await ctx.importDiscoveredAssets()
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    ctx = (window as any).__personalizationCtx
    expect(ctx.discoveryError).toMatch(/1 of 3 assets failed to download/)
    expect(ctx.importConfirmation).toBeTruthy()
    expect(ctx.importConfirmation.count).toBe(2)

    fetchSpy.mockRestore()
  })

  it('reports upload failures during import and exposes retry affordance', async () => {
    const fetchSpy = mockDownloadResponse([
      { url: 'https://example.com/a.jpg', ok: true, dataUrl: `data:image/png;base64,${Buffer.from('fake-image-a').toString('base64')}` },
      { url: 'https://example.com/b.jpg', ok: true, dataUrl: `data:image/png;base64,${Buffer.from('fake-image-b').toString('base64')}` },
    ])
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset
      .mockRejectedValueOnce(new Error('Storage quota exceeded'))
      .mockResolvedValueOnce({ url: 'https://example.com/uploaded-b.png' })

    await renderProvider()
    await openSource()

    await act(async () => {
      ;(window as any).__personalizationCtx.setDiscoveredAssets([
        { id: 'd1', sourceUrl: 'https://example.com/a.jpg', previewUrl: 'https://example.com/a.jpg', sourceType: 'WEBSITE', category: 'logo', confidence: 90, selected: true, recommended: true, rejected: false, assignedSection: 'logo', autoAssigned: true, originalPreviewUrl: 'https://example.com/a.jpg', edited: false, videoReady: false, hasTransparency: false, editMetadata: undefined, visionAnalysis: undefined, visionValidation: undefined },
        { id: 'd2', sourceUrl: 'https://example.com/b.jpg', previewUrl: 'https://example.com/b.jpg', sourceType: 'WEBSITE', category: 'brand', confidence: 85, selected: true, recommended: true, rejected: false, assignedSection: 'brand', autoAssigned: true, originalPreviewUrl: 'https://example.com/b.jpg', edited: false, videoReady: false, hasTransparency: false, editMetadata: undefined, visionAnalysis: undefined, visionValidation: undefined },
      ])
    })

    let ctx = (window as any).__personalizationCtx
    await act(async () => {
      await ctx.importDiscoveredAssets()
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    ctx = (window as any).__personalizationCtx
    expect(ctx.discoveryError).toMatch(/1 of 2 asset\(s\) failed to upload/)
    expect(ctx.importConfirmation).toBeTruthy()
    expect(ctx.importConfirmation.failedCount).toBe(1)
    // `count` reports every asset that was ADDED to the session library —
    // both of them are usable for personalization even though only one could
    // be stored durably. The upload failure is reported separately via
    // `failedCount` and `discoveryError`.
    expect(ctx.importConfirmation.count).toBe(2)

    const allAssets = [
      ...ctx.assets.identities,
      ...ctx.assets.logos,
      ...ctx.assets.products,
      ...ctx.assets.brandReferences,
      ctx.assets.firstFrame,
      ctx.assets.lastFrame,
      ctx.assets.ctaGraphic,
    ].filter(Boolean)
    const failedAsset = allAssets.find((a: any) => a.uploadStatus === 'error')
    expect(failedAsset).toBeTruthy()
    expect(failedAsset.uploadError).toBeTruthy()

    fetchSpy.mockRestore()
  })

  it('links a discovered website image by its address: no download, no storage upload', async () => {
    imageProbe.loads.mockResolvedValue(true)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response)
    const { uploadPersonalizationAsset } = await import('../assetUploadService')
    vi.mocked(uploadPersonalizationAsset).mockClear()

    await renderProvider()
    await openSource()
    await act(async () => {
      ;(window as any).__personalizationCtx.setDiscoveredAssets([
        { id: 'w1', sourceUrl: 'https://biz.example/logo.png', previewUrl: 'https://biz.example/logo.png', sourceType: 'WEBSITE', category: 'logo', confidence: 90, selected: true, recommended: true, rejected: false, assignedSection: 'logo', autoAssigned: true, originalPreviewUrl: 'https://biz.example/logo.png', edited: false, videoReady: false, hasTransparency: false },
      ])
    })
    await act(async () => {
      await (window as any).__personalizationCtx.importDiscoveredAssets()
    })

    const ctx = (window as any).__personalizationCtx
    expect(fetchSpy.mock.calls.some(([u]) => String(u).includes('/api/personalization/download-image'))).toBe(false)
    expect(uploadPersonalizationAsset).not.toHaveBeenCalled()
    expect(ctx.assets.primaryLogo?.url).toBe('https://biz.example/logo.png')
    expect(ctx.assets.primaryLogo?.uploadStatus).toBe('ready')
    expect(ctx.discoveryError ?? '').not.toMatch(/failed to upload/)

    imageProbe.loads.mockResolvedValue(false)
    fetchSpy.mockRestore()
  })

  it('downloads and stores only the image its site blocks from loading here', async () => {
    imageProbe.loads.mockImplementation(async (url: string) => !url.includes('blocked'))
    const requested: string[] = []
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (String(url).includes('/api/personalization/download-image')) {
        const urls: string[] = JSON.parse(String(init?.body)).urls
        requested.push(...urls)
        return { ok: true, status: 200, json: async () => ({ ok: true, results: urls.map((u) => ({ url: u, ok: true, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' })) }) } as Response
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response
    })

    await renderProvider()
    await openSource()
    const asset = (id: string, url: string) => ({ id, sourceUrl: url, previewUrl: url, sourceType: 'WEBSITE', category: 'product', confidence: 90, selected: true, recommended: true, rejected: false, assignedSection: 'products', autoAssigned: true, originalPreviewUrl: url, edited: false, videoReady: false, hasTransparency: false })
    await act(async () => {
      ;(window as any).__personalizationCtx.setDiscoveredAssets([asset('ok', 'https://biz.example/a.jpg'), asset('bl', 'https://blocked.example/b.jpg')])
    })
    await act(async () => {
      await (window as any).__personalizationCtx.importDiscoveredAssets()
    })

    expect(requested).toEqual(['https://blocked.example/b.jpg'])
    const products = (window as any).__personalizationCtx.assets.products
    expect(products.map((p: any) => p.originalUrl).sort()).toEqual(['https://biz.example/a.jpg', 'https://blocked.example/b.jpg'])

    imageProbe.loads.mockReset()
    imageProbe.loads.mockResolvedValue(false)
    fetchSpy.mockRestore()
  })

  it('reports and keeps blocked images whose download fails, alongside linked ones', async () => {
    imageProbe.loads.mockImplementation(async (url: string) => !url.includes('blocked'))
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (String(url).includes('/api/personalization/download-image')) {
        const urls: string[] = JSON.parse(String(init?.body)).urls
        return { ok: true, status: 200, json: async () => ({ ok: true, results: urls.map((u) => ({ url: u, ok: false, error: 'blocked' })) }) } as Response
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response
    })

    await renderProvider()
    await openSource()
    const asset = (id: string, url: string) => ({ id, sourceUrl: url, previewUrl: url, sourceType: 'WEBSITE', category: 'product', confidence: 90, selected: true, recommended: true, rejected: false, assignedSection: 'products', autoAssigned: true, originalPreviewUrl: url, edited: false, videoReady: false, hasTransparency: false })
    await act(async () => {
      ;(window as any).__personalizationCtx.setDiscoveredAssets([asset('ok', 'https://biz.example/a.jpg'), asset('bl', 'https://blocked.example/b.jpg')])
    })
    await act(async () => {
      await (window as any).__personalizationCtx.importDiscoveredAssets()
    })

    const ctx = (window as any).__personalizationCtx
    expect(ctx.discoveryError).toMatch(/1 of 2 assets failed to download/)
    expect(ctx.discoveredAssets.map((a: any) => a.id)).toEqual(['bl'])
    expect(ctx.assets.products).toHaveLength(1)

    imageProbe.loads.mockReset()
    imageProbe.loads.mockResolvedValue(false)
    fetchSpy.mockRestore()
  })

  it('imports more than 20 assets in batches the download route accepts', async () => {
    const batchSizes: number[] = []
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (String(url).includes('/api/personalization/download-image')) {
        const urls: string[] = JSON.parse(String(init?.body)).urls
        batchSizes.push(urls.length)
        if (urls.length > 20) {
          return { ok: false, status: 400, json: async () => ({ error: 'Maximum 20 URLs allowed per request' }) } as Response
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, results: urls.map((u) => ({ url: u, ok: true, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' })) }),
        } as Response
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response
    })

    await renderProvider()
    await openSource()

    const many = Array.from({ length: 25 }, (_, i) => ({
      id: `d${i}`, sourceUrl: `https://example.com/${i}.jpg`, previewUrl: `https://example.com/${i}.jpg`, sourceType: 'WEBSITE', category: 'product', confidence: 90, selected: true, recommended: true, rejected: false, assignedSection: 'products', autoAssigned: true, originalPreviewUrl: `https://example.com/${i}.jpg`, edited: false, videoReady: false, hasTransparency: false,
    }))
    await act(async () => {
      ;(window as any).__personalizationCtx.setDiscoveredAssets(many)
    })
    await act(async () => {
      await (window as any).__personalizationCtx.importDiscoveredAssets()
    })

    expect(batchSizes).toEqual([20, 5])
    expect((window as any).__personalizationCtx.discoveryError ?? '').not.toMatch(/Maximum 20 URLs/)

    fetchSpy.mockRestore()
  })

  it('shows actionable message for 401 auth error on download-image', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response)

    await renderProvider()
    await openSource()

    await act(async () => {
      ;(window as any).__personalizationCtx.setDiscoveredAssets([
        { id: 'd1', sourceUrl: 'https://example.com/a.jpg', previewUrl: 'https://example.com/a.jpg', sourceType: 'WEBSITE', category: 'logo', confidence: 90, selected: true, recommended: true, rejected: false, assignedSection: 'logo', autoAssigned: true, originalPreviewUrl: 'https://example.com/a.jpg', edited: false, videoReady: false, hasTransparency: false, editMetadata: undefined, visionAnalysis: undefined, visionValidation: undefined },
      ])
    })

    let ctx = (window as any).__personalizationCtx
    await act(async () => {
      await ctx.importDiscoveredAssets()
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    ctx = (window as any).__personalizationCtx
    expect(ctx.discoveryError).toMatch(/Authentication required/)

    fetchSpy.mockRestore()
  })

  it('shows actionable message for 403 entitlement error on download-image', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({}),
    } as Response)

    await renderProvider()
    await openSource()

    await act(async () => {
      ;(window as any).__personalizationCtx.setDiscoveredAssets([
        { id: 'd1', sourceUrl: 'https://example.com/a.jpg', previewUrl: 'https://example.com/a.jpg', sourceType: 'WEBSITE', category: 'logo', confidence: 90, selected: true, recommended: true, rejected: false, assignedSection: 'logo', autoAssigned: true, originalPreviewUrl: 'https://example.com/a.jpg', edited: false, videoReady: false, hasTransparency: false, editMetadata: undefined, visionAnalysis: undefined, visionValidation: undefined },
      ])
    })

    let ctx = (window as any).__personalizationCtx
    await act(async () => {
      await ctx.importDiscoveredAssets()
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    ctx = (window as any).__personalizationCtx
    expect(ctx.discoveryError).toMatch(/Contact your administrator/)

    fetchSpy.mockRestore()
  })
})

describe('DemoPersonalizeProvider business search / research', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test')
    URL.revokeObjectURL = vi.fn()
    ;(globalThis as any).fetch = vi.fn()
  })

  const renderProvider = async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <DemoPersonalizeProvider>
          <TestOpener />
        </DemoPersonalizeProvider>,
      )
    })

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

  it('populates client form from selected business and preserves manual website entry', async () => {
    await renderProvider()
    await openSource()

    const businessWithNoWebsite = {
      id: 'osm-1',
      source: 'OPENSTREETMAP' as const,
      name: 'No Website Co',
      category: 'Roofing',
      city: 'Tampa',
      region: 'FL',
      phone: '555-1234',
      website: undefined,
      websiteStatus: 'unknown' as const,
      verificationStatus: 'unverified' as const,
      leadScore: 80,
    }

    await act(async () => {
      ;(window as any).__personalizationCtx.selectBusiness(businessWithNoWebsite)
    })

    const ctx = (window as any).__personalizationCtx
    expect(ctx.selectedBusiness.id).toBe('osm-1')
    expect(ctx.selectedBusiness.website).toBeUndefined()
    expect(ctx.clientForm.businessName).toBe('No Website Co')
    expect(ctx.clientForm.website).toBeUndefined()

    await act(async () => {
      ;(window as any).__personalizationCtx.updateClientForm({ website: 'https://nowebsite.com' })
    })

    expect((window as any).__personalizationCtx.clientForm.website).toBe('https://nowebsite.com')
  })

  it('sets error state when researchBusiness is called with no website', async () => {
    await renderProvider()
    await openSource()

    await act(async () => {
      ;(window as any).__personalizationCtx.selectBusiness({
        id: 'osm-2',
        source: 'OPENSTREETMAP',
        name: 'Still No Website',
        category: 'Plumbing',
        city: 'Miami',
        region: 'FL',
        phone: '555-5678',
        website: undefined,
        websiteStatus: 'unknown',
        verificationStatus: 'unverified',
        leadScore: 60,
      })
    })

    await act(async () => {
      ;(window as any).__personalizationCtx.researchBusiness()
    })

    const ctx = (window as any).__personalizationCtx
    expect(ctx.businessResearch.status).toBe('error')
    expect(ctx.businessResearch.error).toMatch(/No website available/)
  })

  it('uses manual website for research and stores BusinessResearchResult', async () => {
    const mockResearchResult = {
      canonicalUrl: 'https://manual-example.com',
      finalUrl: 'https://manual-example.com',
      reachable: true,
      statusCode: 200,
      contentType: 'text/html',
      title: 'Manual Example',
      description: 'A manually entered website',
      logoUrl: 'https://manual-example.com/logo.png',
      socialLinks: { facebook: 'https://facebook.com/manual' },
      jsonLd: [],
      openGraph: {},
      twitterCard: {},
      contactInfo: { phones: ['555-9999'], emails: ['info@manual.com'], addresses: [] },
    }

    ;(globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, research: mockResearchResult }),
    } as Response))

    await renderProvider()
    await openSource()

    await act(async () => {
      ;(window as any).__personalizationCtx.selectBusiness({
        id: 'osm-3',
        source: 'OPENSTREETMAP',
        name: 'Manual Entry Co',
        category: 'HVAC',
        city: 'Orlando',
        region: 'FL',
        phone: '555-1111',
        website: undefined,
        websiteStatus: 'unknown',
        verificationStatus: 'unverified',
        leadScore: 90,
      })
    })

    await act(async () => {
      ;(window as any).__personalizationCtx.updateClientForm({ website: 'https://manual-example.com' })
    })

    await act(async () => {
      ;(window as any).__personalizationCtx.researchBusiness()
    })

    const ctx = (window as any).__personalizationCtx
    expect(ctx.businessResearch.status).toBe('done')
    expect(ctx.businessResearch.result).toBeDefined()
    expect(ctx.businessResearch.result.canonicalUrl).toBe('https://manual-example.com')
    expect(ctx.businessResearch.result.reachable).toBe(true)
    expect(ctx.businessResearch.result.socialLinks.facebook).toBe('https://facebook.com/manual')
    expect(ctx.businessResearch.result.contactInfo.phones).toEqual(['555-9999'])
  })

  it('keeps business selected and allows retry after research failure with corrected URL', async () => {
    ;(globalThis as any).fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Website unreachable' }),
    } as Response))

    await renderProvider()
    await openSource()

    await act(async () => {
      ;(window as any).__personalizationCtx.selectBusiness({
        id: 'osm-retry',
        source: 'OPENSTREETMAP',
        name: 'Retry Co',
        category: 'Roofing',
        city: 'Tampa',
        region: 'FL',
        phone: '555-1234',
        website: 'https://unreachable.example.com',
        websiteStatus: 'listed',
        verificationStatus: 'unverified',
        leadScore: 80,
      })
    })

    let ctx = (window as any).__personalizationCtx
    expect(ctx.selectedBusiness.id).toBe('osm-retry')
    expect(ctx.businessSearchMode).toBe('selected')

    await act(async () => {
      ;(window as any).__personalizationCtx.researchBusiness()
    })

    ctx = (window as any).__personalizationCtx
    expect(ctx.businessResearch.status).toBe('error')
    expect(ctx.businessResearch.error).toMatch(/unreachable/i)
    expect(ctx.selectedBusiness.id).toBe('osm-retry')
    expect(ctx.businessSearchMode).toBe('selected')

    ;(globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        research: {
          canonicalUrl: 'https://corrected.example.com',
          finalUrl: 'https://corrected.example.com',
          reachable: true,
          statusCode: 200,
          contentType: 'text/html',
          title: 'Corrected',
          description: '',
          logoUrl: '',
          socialLinks: {},
          jsonLd: [],
          openGraph: {},
          twitterCard: {},
          contactInfo: { phones: [], emails: [], addresses: [] },
        },
      }),
    } as Response))

    await act(async () => {
      ;(window as any).__personalizationCtx.updateClientForm({ website: 'https://corrected.example.com' })
    })

    await act(async () => {
      ;(window as any).__personalizationCtx.researchBusiness()
    })

    ctx = (window as any).__personalizationCtx
    expect(ctx.businessResearch.status).toBe('done')
    expect(ctx.businessResearch.result.canonicalUrl).toBe('https://corrected.example.com')
  })
})

describe('DemoPersonalizeProvider deleteSavedClient regression', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test')
    URL.revokeObjectURL = vi.fn()
    generationPromiseResolvers.length = 0
  })

  const renderProvider = async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <DemoPersonalizeProvider>
          <TestOpener />
        </DemoPersonalizeProvider>,
      )
    })

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

  it('deletes saved client deterministically and clears selected state and job refs', async () => {
    await renderProvider()
    await openSource()

    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockResolvedValue({ url: 'https://example.com/uploaded.png' })

    await act(async () => {
      ;(window as any).__personalizationCtx.saveClient()
    })

    await act(async () => {
      const files = createFileList([createFile('logo.png')])
      ;(window as any).__personalizationCtx.addLogoFiles(files)
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    let ctx = (window as any).__personalizationCtx
    const clientId = ctx.selectedClientId
    expect(clientId).toBeTruthy()

    await act(async () => {
      ;(window as any).__personalizationCtx.deleteSavedClient(clientId)
    })

    ctx = (window as any).__personalizationCtx
    expect(ctx.clients.find((c: any) => c.id === clientId)).toBeUndefined()
    expect(ctx.selectedClientId).toBe('')
    expect(ctx.savedClientAssets.logos).toHaveLength(0)
    expect(ctx.clientForm.businessName).toBeUndefined()
  })
})

describe('DemoPersonalizeProvider saved-client edited asset regression', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test')
    URL.revokeObjectURL = vi.fn()
    generationPromiseResolvers.length = 0
  })

  const renderProvider = async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <DemoPersonalizeProvider>
          <TestOpener />
        </DemoPersonalizeProvider>,
      )
    })

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

  it('propagates edited saved-client logo to current job with uploaded URL', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockResolvedValue({ url: 'https://example.com/uploaded-logo.png' })

    await renderProvider()
    await openSource()

    await act(async () => {
      const files = createFileList([createFile('logo.png')])
      ;(window as any).__personalizationCtx.addLogoFiles(files)
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    await act(async () => {
      ;(window as any).__personalizationCtx.saveClient()
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctxBefore = (window as any).__personalizationCtx
    const clientId = ctxBefore.selectedClientId
    expect(clientId).toBeTruthy()

    const originalLogo = ctxBefore.assets.logos[0]
    expect(originalLogo).toBeTruthy()

    await act(async () => {
      ;(window as any).__personalizationCtx.applyEditedSavedClientAsset(
        clientId,
        originalLogo.id,
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        {
          operation: 'remove-background',
          prompt: 'remove background',
          model: 'test-model',
          quality: 'high',
          transparent: true,
          videoReady: false,
        },
      )
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctxAfter = (window as any).__personalizationCtx
    const savedLogo = ctxAfter.savedClientAssets.logos.find((l: any) => l.id === originalLogo.id)
    expect(savedLogo).toBeTruthy()
    expect(savedLogo.edited).toBe(true)
    expect(savedLogo.editMetadata?.operation).toBe('remove-background')
    expect(savedLogo.url).toBe('https://example.com/uploaded-logo.png')

    const jobLogo = ctxAfter.assets.logos.find((l: any) => l.id === originalLogo.id)
    expect(jobLogo).toBeTruthy()
    expect(jobLogo.edited).toBe(true)
    expect(jobLogo.editMetadata?.operation).toBe('remove-background')
    expect(jobLogo.url).toBe('https://example.com/uploaded-logo.png')
  })

  it('propagates edited saved-client brand reference to current job with uploaded URL', async () => {
    const mockUploadPersonalizationAsset = uploadPersonalizationAsset as any
    mockUploadPersonalizationAsset.mockResolvedValue({ url: 'https://example.com/uploaded-brand.png' })

    await renderProvider()
    await openSource()

    await act(async () => {
      const files = createFileList([createFile('brand.png')])
      ;(window as any).__personalizationCtx.addBrandReferenceFiles(files)
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    await act(async () => {
      ;(window as any).__personalizationCtx.saveClient()
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctxBefore = (window as any).__personalizationCtx
    const clientId = ctxBefore.selectedClientId
    expect(clientId).toBeTruthy()

    const originalBrand = ctxBefore.assets.brandReferences[0]
    expect(originalBrand).toBeTruthy()

    await act(async () => {
      ;(window as any).__personalizationCtx.applyEditedSavedClientAsset(
        clientId,
        originalBrand.id,
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        {
          operation: 'enhance',
          prompt: 'enhance quality',
          model: 'test-model',
          quality: 'high',
          transparent: false,
          videoReady: false,
        },
      )
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctxAfter = (window as any).__personalizationCtx
    const savedBrand = ctxAfter.savedClientAssets.brandReferences.find((b: any) => b.id === originalBrand.id)
    expect(savedBrand).toBeTruthy()
    expect(savedBrand.edited).toBe(true)
    expect(savedBrand.editMetadata?.operation).toBe('enhance')
    expect(savedBrand.url).toBe('https://example.com/uploaded-brand.png')

    const jobBrand = ctxAfter.assets.brandReferences.find((b: any) => b.id === originalBrand.id)
    expect(jobBrand).toBeTruthy()
    expect(jobBrand.edited).toBe(true)
    expect(jobBrand.editMetadata?.operation).toBe('enhance')
    expect(jobBrand.url).toBe('https://example.com/uploaded-brand.png')
  })
})

describe('DemoPersonalizeProvider zero-key discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test')
    URL.revokeObjectURL = vi.fn()
    generationPromiseResolvers.length = 0
  })

  /**
   * Renders the provider and exposes the context value of its most recent
   * commit through `latest()`.
   *
   * Snapshots are collected per render instead of reading the shared
   * `window.__personalizationCtx`, because the earlier describes in this file
   * never unmount their roots: a late re-render of one of those providers can
   * overwrite the window global with its own (idle) context. Under full-suite
   * CPU contention that clobbering raced these discovery assertions and made
   * them report a stale 'idle' status.
   */
  const renderProvider = async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const commits: any[] = []

    function DiscoveryOpener() {
      const ctx = useDemoPersonalize()
      commits.push(ctx)
      return null
    }

    await act(async () => {
      root.render(
        <DemoPersonalizeProvider>
          <DiscoveryOpener />
        </DemoPersonalizeProvider>,
      )
    })

    return {
      container,
      latest: () => commits[commits.length - 1],
    }
  }

  it('does not show false no-assets message when background job is queued with zero fast assets', async () => {
    const { latest } = await renderProvider()

    // Track fetch calls to simulate status polling
    const fetchCalls: Array<{ url: string; opts?: any }> = []
    const mockFetch = vi.fn(async (url: string, opts?: any) => {
      fetchCalls.push({ url, opts })

      const body = typeof opts?.body === 'string' ? JSON.parse(opts.body) : {}
      if (url.includes('/api/personalization/discover-assets/status?jobId=')) {
        // Status poll - return complete with assets
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'complete',
            result: {
              discoveredAssets: [
                { id: '1', sourceUrl: 'https://example.com/logo.png', previewUrl: 'https://example.com/logo.png', category: 'logo', confidence: 80, selected: true, recommended: true, rejected: false },
              ],
            },
          }),
        }
      }

      // Initial POST - return 202 with zero fast assets
      return {
        ok: true,
        status: 202,
        json: async () => ({
          ok: true,
          status: 'processing',
          jobId: 'test-job-123',
          browserQueued: true,
          discoveredAssets: [],
          providerUsed: 'SMARTVIDEO_STATIC',
        }),
      }
    })

    // @ts-ignore
    global.fetch = mockFetch

    await act(async () => {
      latest().discoverAssets('https://example.com')
    })

    // The queued job keeps the provider in `discovering` while the status
    // endpoint is polled (2s interval, max 60 polls) — wait for that state
    // instead of assuming the commit already landed.
    await waitForDiscoveryState(latest, (ctx) => ctx.discoveryStatus === 'discovering')

    let ctx = latest()
    expect(ctx.discoveryStatus).toBe('discovering')
    expect(ctx.discoveryError).toBeNull()

    // Wait for the poll to settle on `reviewing` rather than sleeping a fixed
    // 2500ms, which CPU contention between test files can outrun.
    await waitForDiscoveryState(latest, (ctx) => ctx.discoveryStatus === 'reviewing')

    ctx = latest()
    expect(ctx.discoveryStatus).toBe('reviewing')
    expect(ctx.discoveredAssets).toHaveLength(1)

    const legacyPollCalls = fetchCalls.filter((call) => call.url === '/api/personalization/discover-assets?jobId=test-job-123')
    expect(legacyPollCalls).toHaveLength(0)
  })

  it('drops a discovery poll that finishes after the modal was closed', async () => {
    const { latest } = await renderProvider()
    // @ts-ignore
    global.fetch = vi.fn(async (url: string) => {
      if (url.includes('/discover-assets/status?jobId=')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'complete',
            result: { discoveredAssets: [{ id: '1', sourceUrl: 'https://old.example/logo.png', previewUrl: 'https://old.example/logo.png', category: 'logo', confidence: 80, selected: true, recommended: true, rejected: false }] },
          }),
        }
      }
      return {
        ok: true,
        status: 202,
        json: async () => ({ ok: true, status: 'processing', jobId: 'old-job', browserQueued: true, discoveredAssets: [], providerUsed: 'SMARTVIDEO_STATIC' }),
      }
    })

    await act(async () => {
      latest().discoverAssets('https://old.example')
    })
    await waitForDiscoveryState(latest, (ctx) => ctx.discoveryStatus === 'discovering')
    await act(async () => { latest().closePersonalize() })
    await act(async () => { await new Promise((r) => setTimeout(r, 2600)) })

    expect(latest().discoveredAssets).toHaveLength(0)
    expect(latest().discoveryStatus).not.toBe('reviewing')
  })

  it('shows no-assets message only after background job completes with zero assets', async () => {
    const { latest } = await renderProvider()

    const fetchCalls: Array<{ url: string; opts?: any }> = []
    const mockFetch = vi.fn(async (url: string, opts?: any) => {
      fetchCalls.push({ url, opts })

      if (url.includes('/api/personalization/discover-assets/status?jobId=')) {
        // Status poll - return complete with zero assets
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'complete',
            result: {
              discoveredAssets: [],
            },
          }),
        }
      }

      // Initial POST - return 202 with zero fast assets
      return {
        ok: true,
        status: 202,
        json: async () => ({
          ok: true,
          status: 'processing',
          jobId: 'test-job-456',
          browserQueued: true,
          discoveredAssets: [],
          providerUsed: 'SMARTVIDEO_STATIC',
        }),
      }
    })

    // @ts-ignore
    global.fetch = mockFetch

    await act(async () => {
      latest().discoverAssets('https://example.com')
    })

    // Wait for the queued-job state (`discovering`) before the poll resolves.
    await waitForDiscoveryState(latest, (ctx) => ctx.discoveryStatus === 'discovering')

    let ctx = latest()
    expect(ctx.discoveryStatus).toBe('discovering')
    expect(ctx.discoveryError).toBeNull()

    // The no-assets message is only allowed once the background job has
    // actually completed with zero assets — wait for that settled state
    // instead of a fixed sleep.
    await waitForDiscoveryState(
      latest,
      (ctx) => ctx.discoveryStatus === 'idle' && ctx.discoveryError === 'No useful assets were found on that website.',
    )

    ctx = latest()
    expect(ctx.discoveryStatus).toBe('idle')
    expect(ctx.discoveryError).toBe('No useful assets were found on that website.')

    const legacyPollCalls = fetchCalls.filter((call) => call.url === '/api/personalization/discover-assets?jobId=test-job-456')
    expect(legacyPollCalls).toHaveLength(0)
  })
})

describe('DemoPersonalizeProvider edit persistence fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test')
    URL.revokeObjectURL = vi.fn()
    generationPromiseResolvers.length = 0
  })

  const renderProvider = async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <DemoPersonalizeProvider>
          <TestOpener />
        </DemoPersonalizeProvider>,
      )
    })

    return container
  }

  const openSource = async () => {
    await act(async () => {
      ;(window as any).__personalizationCtx.openPersonalize({
        source: { id: 'demo-1', title: 'Test', mediaType: 'video', originalPrompt: 'test', sourceMedia: null, poster: null, fullPrompt: 'test', shortPrompt: 'test', sourceType: 'landing-demo', model: 'kling-o1-video-edit', sourceMetadata: {} },
      })
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
  }

  it('applyEditedPersonalizationAsset falls back to upload when Supabase persistence fails', async () => {
    const mockPersist = persistEditedPersonalizationAsset as any
    mockPersist.mockResolvedValue({ ok: false })
    const mockUpload = uploadPersonalizationAsset as any
    mockUpload.mockResolvedValue({ url: 'https://example.com/uploaded.png' })

    await renderProvider()
    await openSource()

    const files = createFileList([createFile('logo.png')])
    await act(async () => {
      ;(window as any).__personalizationCtx.addLogoFiles(files)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctx = (window as any).__personalizationCtx
    const logo = ctx.assets.logos[0]
    expect(logo).toBeTruthy()

    await act(async () => {
      ;(window as any).__personalizationCtx.applyEditedPersonalizationAsset(
        logo.id,
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        {
          operation: 'enhance',
          prompt: 'enhance quality',
          model: 'test-model',
          quality: 'high',
          transparent: false,
          videoReady: false,
        },
      )
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const updated = (window as any).__personalizationCtx.assets.logos.find((l: any) => l.id === logo.id)
    expect(updated).toBeTruthy()
    expect(updated.url).toBe('https://example.com/uploaded.png')
    expect(updated.uploadStatus).toBe('ready')
    expect(mockUpload).toHaveBeenCalled()
  })

  it('applyEditedSavedClientAsset falls back to upload when Supabase persistence fails', async () => {
    const mockPersist = persistEditedPersonalizationAsset as any
    mockPersist.mockResolvedValue({ ok: false })
    const mockUpload = uploadPersonalizationAsset as any
    mockUpload.mockResolvedValue({ url: 'https://example.com/uploaded-saved.png' })

    await renderProvider()
    await openSource()

    const files = createFileList([createFile('logo.png')])
    await act(async () => {
      ;(window as any).__personalizationCtx.addLogoFiles(files)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    await act(async () => {
      ;(window as any).__personalizationCtx.saveClient()
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctxBefore = (window as any).__personalizationCtx
    const clientId = ctxBefore.selectedClientId
    expect(clientId).toBeTruthy()

    const originalLogo = ctxBefore.assets.logos[0]
    expect(originalLogo).toBeTruthy()

    await act(async () => {
      ;(window as any).__personalizationCtx.applyEditedSavedClientAsset(
        clientId,
        originalLogo.id,
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        {
          operation: 'enhance',
          prompt: 'enhance quality',
          model: 'test-model',
          quality: 'high',
          transparent: false,
          videoReady: false,
        },
      )
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctxAfter = (window as any).__personalizationCtx
    const savedLogo = ctxAfter.savedClientAssets.logos.find((l: any) => l.id === originalLogo.id)
    expect(savedLogo).toBeTruthy()
    expect(savedLogo.url).toBe('https://example.com/uploaded-saved.png')
    expect(savedLogo.uploadStatus).toBe('ready')

    const jobLogo = ctxAfter.assets.logos.find((l: any) => l.id === originalLogo.id)
    expect(jobLogo).toBeTruthy()
    expect(jobLogo.url).toBe('https://example.com/uploaded-saved.png')
    expect(mockUpload).toHaveBeenCalled()
  })

  it('applyEditedPersonalizationAsset uses Supabase URL when persistence succeeds', async () => {
    const mockPersist = persistEditedPersonalizationAsset as any
    mockPersist.mockResolvedValue({ ok: true, publicUrl: 'https://example.com/persisted.png' })
    const mockUpload = uploadPersonalizationAsset as any
    mockUpload.mockResolvedValue({ url: 'https://example.com/uploaded.png' })

    await renderProvider()
    await openSource()

    const files = createFileList([createFile('logo.png')])
    await act(async () => {
      ;(window as any).__personalizationCtx.addLogoFiles(files)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctx = (window as any).__personalizationCtx
    const logo = ctx.assets.logos[0]
    expect(logo).toBeTruthy()

    // The initial addLogoFiles upload already ran once — reset it so any
    // further upload call proves the Supabase result was not used.
    mockUpload.mockClear()

    await act(async () => {
      ;(window as any).__personalizationCtx.applyEditedPersonalizationAsset(
        logo.id,
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        {
          operation: 'enhance',
          prompt: 'enhance quality',
          model: 'test-model',
          quality: 'high',
          transparent: false,
          videoReady: false,
        },
      )
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockPersist).toHaveBeenCalledTimes(1)

    const updated = (window as any).__personalizationCtx.assets.logos.find((l: any) => l.id === logo.id)
    expect(updated).toBeTruthy()
    expect(updated.url).toBe('https://example.com/persisted.png')
    expect(updated.uploadedUrl).toBe('https://example.com/persisted.png')
    expect(updated.uploadStatus).toBe('ready')
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('applyEditedSavedClientAsset uses Supabase URL when persistence succeeds', async () => {
    const mockPersist = persistEditedPersonalizationAsset as any
    mockPersist.mockResolvedValue({ ok: true, publicUrl: 'https://example.com/persisted-saved.png' })
    const mockUpload = uploadPersonalizationAsset as any
    mockUpload.mockResolvedValue({ url: 'https://example.com/uploaded-saved.png' })

    await renderProvider()
    await openSource()

    const files = createFileList([createFile('logo.png')])
    await act(async () => {
      ;(window as any).__personalizationCtx.addLogoFiles(files)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    await act(async () => {
      ;(window as any).__personalizationCtx.saveClient()
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    const ctxBefore = (window as any).__personalizationCtx
    const clientId = ctxBefore.selectedClientId
    expect(clientId).toBeTruthy()

    const originalLogo = ctxBefore.assets.logos[0]
    expect(originalLogo).toBeTruthy()

    mockUpload.mockClear()

    await act(async () => {
      ;(window as any).__personalizationCtx.applyEditedSavedClientAsset(
        clientId,
        originalLogo.id,
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        {
          operation: 'enhance',
          prompt: 'enhance quality',
          model: 'test-model',
          quality: 'high',
          transparent: false,
          videoReady: false,
        },
      )
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockPersist).toHaveBeenCalledTimes(1)

    const ctxAfter = (window as any).__personalizationCtx
    const savedLogo = ctxAfter.savedClientAssets.logos.find((l: any) => l.id === originalLogo.id)
    expect(savedLogo).toBeTruthy()
    expect(savedLogo.url).toBe('https://example.com/persisted-saved.png')
    expect(savedLogo.uploadedUrl).toBe('https://example.com/persisted-saved.png')
    expect(savedLogo.uploadStatus).toBe('ready')

    const jobLogo = ctxAfter.assets.logos.find((l: any) => l.id === originalLogo.id)
    expect(jobLogo).toBeTruthy()
    expect(jobLogo.url).toBe('https://example.com/persisted-saved.png')
    expect(mockUpload).not.toHaveBeenCalled()
  })
})

describe('DemoPersonalizeProvider persistence dedup (Phase 3 review finding 1)', () => {
  const PROVIDER_PATH = join(
    process.cwd(),
    'src/features/personalization/shared/personalization/DemoPersonalizeProvider.tsx',
  )

  it('has exactly one projectPersistence.persist call in an effect', () => {
    const source = readFileSync(PROVIDER_PATH, 'utf-8')
    // Count persist calls inside useEffect blocks (not flush/cancel)
    const persistCalls = source.match(/projectPersistence\.current\.persist\(/g)
    expect(persistCalls).not.toBeNull()
    expect(persistCalls!.length).toBe(1)
  })

  // Unmount cleanup, the restore, and the fresh-start reset when the modal opens.
  it('has exactly three cancel calls: unmount, restore and fresh start', () => {
    const source = readFileSync(PROVIDER_PATH, 'utf-8')
    const cancelCalls = source.match(/projectPersistence\.current\.cancel\(/g)
    expect(cancelCalls).not.toBeNull()
    expect(cancelCalls!.length).toBe(3)
  })
})

describe('saved client library survives an empty job', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('keeps a client\'s saved assets on load, on a new source, and when the client is picked', async () => {
    const { saveClientAssets, loadClientAssets } = await import('../clientAssets')
    const { setCurrentClientId, createClient } = await import('../clientProfile')
    const clientId = createClient({ businessName: 'Acme Roofing' }).id
    const logo = {
      id: 'saved-logo-1', role: 'logo', name: 'logo.png', url: 'https://cdn.example/logo.png',
      isPrimary: true, mimeType: 'image/png', createdAt: new Date().toISOString(),
      uploadStatus: 'ready', uploadError: null,
    } as any
    saveClientAssets(clientId, {
      identities: [], primaryIdentity: null, logos: [logo], primaryLogo: logo, products: [], brandReferences: [],
    })
    setCurrentClientId(clientId)

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <DemoPersonalizeProvider>
          <TestOpener />
        </DemoPersonalizeProvider>,
      )
    })
    await act(async () => {
      ;(window as any).__personalizationCtx.openPersonalize({
        source: { id: 'demo-2', title: 'Test', mediaType: 'video', originalPrompt: 'test', sourceMedia: null, poster: null, fullPrompt: 'test', shortPrompt: 'test', sourceType: 'landing-demo', sourceMetadata: {} },
      })
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    // Mounting with the client selected and opening a new (empty) job must not
    // wipe the saved library…
    expect(loadClientAssets(clientId).logos.map((l) => l.id)).toEqual(['saved-logo-1'])

    // …and neither must picking that saved client while the job is empty.
    await act(async () => {
      ;(window as any).__personalizationCtx.useSavedClient(clientId)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    const ctx = (window as any).__personalizationCtx
    expect(ctx.selectedClientId).toBe(clientId)
    expect(ctx.savedClientAssets.logos.map((l: any) => l.id)).toEqual(['saved-logo-1'])
    expect(loadClientAssets(clientId).logos.map((l) => l.id)).toEqual(['saved-logo-1'])
    expect(loadClientAssets(clientId).primaryLogo?.id).toBe('saved-logo-1')
    await act(async () => root.unmount())
    container.remove()
  })
})

describe('review fixes: approved options, stale sessions, saved-asset removal', () => {
  const videoSource = (id: string) => ({ id, title: 'Test', mediaType: 'video', originalPrompt: 'test', sourceMedia: null, poster: null, fullPrompt: 'test', shortPrompt: 'test', sourceType: 'landing-demo', model: 'kling-o1-video-edit', sourceMetadata: {} })
  const tick = (ms = 50) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
  const ctx = () => (window as any).__personalizationCtx

  let root: ReturnType<typeof createRoot> | null = null
  let container: HTMLDivElement | null = null
  const mount = async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(
        <DemoPersonalizeProvider>
          <TestOpener />
        </DemoPersonalizeProvider>,
      )
    })
  }
  const open = async (id: string, onComplete?: (...args: any[]) => void) => {
    await act(async () => { ctx().openPersonalize({ source: videoSource(id), ...(onComplete ? { onComplete } : {}) }) })
    await tick()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })
  afterEach(async () => {
    if (root) await act(async () => root!.unmount())
    container?.remove()
    root = null
    container = null
  })

  it('creates the final AI video with the approved preview aspect ratio and duration', async () => {
    ;(runGeneration as any).mockResolvedValue({ type: 'video', url: 'https://example.com/v.mp4', metadata: {} })
    ;(applyPostProcessing as any).mockResolvedValue({ finalUrl: 'https://example.com/v.mp4', originalUrl: 'https://example.com/v.mp4', applied: [] })
    await mount()
    await open('demo-a')
    await act(async () => {
      ctx().setMode('recreate')
      ctx().updatePreviewComposition({ aspectRatio: '9:16', fps: 30, durationInFrames: 240 })
    })
    await tick()
    await act(async () => { await ctx().createFinalVideo() })
    await tick()
    expect(runGeneration).toHaveBeenCalledTimes(1)
    const options = (runGeneration as any).mock.calls[0][0].options
    expect(options.aspectRatio).toBe('9:16')
    expect(options.duration).toBe(8)
  })

  it('drops a generation that finishes after its modal session was closed', async () => {
    let finish: (v: unknown) => void = () => {}
    ;(runGeneration as any).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    ;(applyPostProcessing as any).mockResolvedValue({ finalUrl: 'https://example.com/old.mp4', originalUrl: 'https://example.com/old.mp4', applied: [] })
    await mount()
    await open('demo-old')
    await act(async () => { ctx().setMode('recreate') })
    let pending: Promise<void> | null = null
    await act(async () => { pending = ctx().generate() })
    await tick()
    expect(runGeneration).toHaveBeenCalledTimes(1)

    const onComplete = vi.fn()
    await act(async () => { ctx().closePersonalize() })
    await open('demo-new', onComplete)
    await act(async () => {
      finish({ type: 'video', url: 'https://example.com/old.mp4', metadata: {} })
      await pending
    })
    await tick()
    expect(ctx().result).toBeNull()
    expect(ctx().generation.status).not.toBe('complete')
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('removing a saved asset leaves the job\'s other assets, roles and primaries alone', async () => {
    const asset = (id: string, role: string) => ({ id, role, name: `${id}.png`, url: `https://cdn.example/${id}.png`, uploadedUrl: `https://cdn.example/${id}.png`, isPrimary: true, mimeType: 'image/png', createdAt: new Date().toISOString(), uploadStatus: 'ready', uploadError: null })
    await mount()
    await open('demo-assets')
    await act(async () => { await ctx().saveClient() })
    await tick()
    expect(ctx().selectedClientId).toBeTruthy()
    await act(async () => {
      ctx().selectSavedAsset(asset('person-1', 'presenter_identity'))
      ctx().selectSavedAsset(asset('logo-1', 'logo'))
    })
    await tick()
    expect(ctx().assets.logos.map((a: any) => a.id)).toEqual(['logo-1'])

    await act(async () => { ctx().removeSavedAsset('person-1') })
    await tick()
    const assets = ctx().assets
    expect(assets.identities).toEqual([])
    expect(assets.primaryIdentity).toBeNull()
    expect(assets.logos.map((a: any) => a.id)).toEqual(['logo-1'])
    expect(assets.primaryLogo?.id).toBe('logo-1')
  })
})
