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

const webExport = vi.hoisted(() => ({
  exportPersonalizedVideo: vi.fn(),
  downloadWebExportBlob: vi.fn(),
  cancelActiveExport: vi.fn(),
}))
vi.mock('../webExport', () => webExport)

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
const SOURCE = { id: 'batch-src', title: 'Promo', mediaType: 'video', originalPrompt: 'p', sourceMedia: 'https://cdn.example.com/v.mp4', poster: null, fullPrompt: 'p', shortPrompt: 'p', sourceType: 'landing-demo', sourceMetadata: {} }

const client = (id: string, businessName: string) => ({ id, name: businessName, businessName, audience: 'client', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' })
const ok = (name: string) => ({ ok: true, blob: new Blob([name]), mimeType: 'video/mp4', extension: 'mp4', warning: null })

describe('export one video per saved client', () => {
  let root: ReturnType<typeof createRoot>
  let container: HTMLDivElement

  beforeEach(async () => {
    localStorage.clear()
    webExport.exportPersonalizedVideo.mockReset()
    webExport.downloadWebExportBlob.mockReset()
    localStorage.setItem('smartvideo_clients', JSON.stringify({
      a: client('a', 'Acme Plumbing'),
      b: client('b', 'Bright Dental'),
      c: client('c', 'Acme Plumbing'),
    }))
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => { root.render(<DemoPersonalizeProvider><Capture /></DemoPersonalizeProvider>) })
    await act(async () => { ctx().openPersonalize({ source: SOURCE }) })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  const approve = async () => { await act(async () => { ctx().approvePersonalization() }) }

  it('does nothing until the preview is approved', async () => {
    await act(async () => { await ctx().exportForAllClients() })
    expect(webExport.exportPersonalizedVideo).not.toHaveBeenCalled()
  })

  it('renders each client with their own details over the same layout, with unique file names', async () => {
    webExport.exportPersonalizedVideo.mockImplementation(async ({ inputProps }: any) => ok(inputProps.brand.businessName))
    await approve()
    await act(async () => { await ctx().exportForAllClients() })

    const names = webExport.exportPersonalizedVideo.mock.calls.map(([o]: any) => o.inputProps.brand.businessName).sort()
    expect(names).toEqual(['Acme Plumbing', 'Acme Plumbing', 'Bright Dental'])
    const files = webExport.downloadWebExportBlob.mock.calls.map(([, f]: any) => f).sort()
    expect(files).toEqual(['Promo - Acme Plumbing (2).mp4', 'Promo - Acme Plumbing.mp4', 'Promo - Bright Dental.mp4'])
    expect(ctx().batchExport).toMatchObject({ status: 'done', progress: 100, message: 'Exported 3 branded videos' })
  })

  it('keeps going when one client fails and says which', async () => {
    webExport.exportPersonalizedVideo.mockImplementation(async ({ inputProps }: any) =>
      inputProps.brand.businessName === 'Bright Dental' ? { ok: false, reason: 'render-failed', error: 'logo did not load' } : ok('x'))
    await approve()
    await act(async () => { await ctx().exportForAllClients() })
    expect(webExport.downloadWebExportBlob).toHaveBeenCalledTimes(2)
    expect(ctx().batchExport.message).toBe('Exported 2 of 3. Failed: Bright Dental (logo did not load)')
  })

  it('stops when cancelled and does not download the rest', async () => {
    let first = true
    webExport.exportPersonalizedVideo.mockImplementation(async () => {
      if (first) { first = false; ctx().cancelExport(); return { ok: false, reason: 'cancelled', error: 'Render cancelled.' } }
      return ok('x')
    })
    await approve()
    await act(async () => { await ctx().exportForAllClients() })
    expect(webExport.exportPersonalizedVideo).toHaveBeenCalledTimes(1)
    expect(webExport.downloadWebExportBlob).not.toHaveBeenCalled()
    expect(ctx().batchExport.message).toMatch(/cancelled/i)
  })

  it('does nothing with fewer than two saved clients', async () => {
    localStorage.setItem('smartvideo_clients', JSON.stringify({ a: client('a', 'Solo') }))
    await approve()
    await act(async () => { await ctx().exportForAllClients() })
    expect(webExport.exportPersonalizedVideo).not.toHaveBeenCalled()
  })
})
