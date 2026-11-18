// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { applyLayoutPreset, createDefaultPreviewSettings } from '../../preview/presets'

const update = vi.fn()
const ctx: Record<string, unknown> = {}
vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: () => ctx }))
const blobGate = vi.hoisted(() => ({ release: null as null | (() => void), all: [] as (() => void)[] }))
vi.mock('../../backgroundRemoval/loadImageBlob', () => ({
  loadImageBlob: () => new Promise<Blob>((resolve) => { const r = () => resolve(new Blob(['x'])); blobGate.release = r; blobGate.all.push(r) }),
}))
vi.mock('../../preview/logoVectorize', async () => {
  const actual = await vi.importActual<typeof import('../../preview/logoVectorize')>('../../preview/logoVectorize')
  return { ...actual, traceLogo: vi.fn(async () => ({ dataUrl: 'data:image/svg+xml;base64,AAA' })) }
})
const engine = vi.hoisted(() => ({
  isModelCached: vi.fn(), modelInfo: vi.fn(), cancelLocalAI: vi.fn(),
  upscaleImage: vi.fn(), upscaleRelease: null as null | (() => void), upscaleCalls: [] as (() => void)[],
}))
vi.mock('../../localAI/engine', () => engine)
import { AssetUsagePanel } from '../AssetUsagePanel'

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })
afterEach(() => { document.body.innerHTML = ''; update.mockClear(); blobGate.all.length = 0; engine.upscaleCalls.length = 0 })

const asset = (id: string) => ({ id, role: 'product_image', name: `pic-${id}`, url: `https://x/${id}.png`, isPrimary: false, createdAt: '' })
function setup(n: number) {
  ctx.assets = { logos: [], products: Array.from({ length: n }, (_, i) => asset(String(i))) }
  ctx.previewSettings = applyLayoutPreset(createDefaultPreviewSettings(), 'product-showcase')
  ctx.previewVideo = null; ctx.source = null; ctx.clientForm = { businessName: 'B' }
  ctx.updatePreviewLayer = update
  const el = document.createElement('div'); document.body.appendChild(el)
  act(() => { createRoot(el).render(<AssetUsagePanel />) })
  return el
}

describe('AssetUsagePanel', () => {
  it('says plainly that importing 25 pictures does not put 25 in the video', () => {
    const el = setup(25)
    const text = el.querySelector('[data-testid="asset-usage-summary"]')!.textContent!
    expect(text).toMatch(/25 imported/)
    expect(text).toMatch(/does not put it in the video/)
    expect(el.querySelectorAll('li').length).toBe(25)
  })
  it('lists the picture the automatic fallback draws as in the video (automatic) and the rest as imported', () => {
    const el = setup(5)
    const states = [...el.querySelectorAll('li')].map((l) => l.getAttribute('data-state'))
    expect(states.filter((s) => s === 'rendered').length).toBeGreaterThanOrEqual(1)
    expect(states.filter((s) => s === 'imported').length).toBeGreaterThanOrEqual(3)
    expect(el.textContent).toMatch(/automatic/)
  })
  it('Product button assigns that picture to the product image layer explicitly', () => {
    const el = setup(4)
    act(() => { (el.querySelector('button[aria-label="Use pic-3 as the product image"]') as HTMLButtonElement).click() })
    const layer = (ctx.previewSettings as { layers: { id: string; kind: string }[] }).layers.find((l) => l.kind === 'productImage')!
    expect(update).toHaveBeenCalledWith(layer.id, expect.objectContaining({ imageUrl: 'https://x/3.png', visible: true }))
  })
  it('renders nothing without any pictures', () => { expect(setup(0).querySelector('[data-testid="asset-usage-panel"]')).toBeNull() })
})

describe('AssetUsagePanel logo tracing', () => {
  const logo = { id: 'L1', role: 'logo', name: 'logo-1', url: 'https://x/logo.png', isPrimary: true, createdAt: '' }
  function setupLogo() {
    const add = vi.fn()
    ctx.assets = { logos: [logo], products: [], primaryLogo: logo }
    ctx.previewSettings = applyLayoutPreset(createDefaultPreviewSettings(), 'product-showcase')
    ctx.previewVideo = null; ctx.source = { id: 'S1' }; ctx.clientForm = { id: 'client-A', businessName: 'A' }
    ctx.updatePreviewLayer = update; ctx.addLogoUrl = add; ctx.setPrimaryLogo = vi.fn()
    const el = document.createElement('div'); document.body.appendChild(el)
    const root = createRoot(el)
    act(() => { root.render(<AssetUsagePanel />) })
    return { el, root, add }
  }
  const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

  it('adds the traced logo to the same client', async () => {
    const { el, add } = setupLogo()
    act(() => { (el.querySelector('[data-testid="logo-trace-L1"]') as HTMLButtonElement).click() })
    await act(async () => { blobGate.release?.() }); await settle()
    expect(add).toHaveBeenCalledWith('data:image/svg+xml;base64,AAA')
  })
  it('drops a trace that finishes after the person moved to another client', async () => {
    const { el, root, add } = setupLogo()
    act(() => { (el.querySelector('[data-testid="logo-trace-L1"]') as HTMLButtonElement).click() })
    ctx.clientForm = { id: 'client-B', businessName: 'B' }
    act(() => { root.render(<AssetUsagePanel />) })
    await act(async () => { blobGate.release?.() }); await settle()
    expect(add).not.toHaveBeenCalled()
  })
  it('drops a trace for client A even if the person goes A -> B -> A before it finishes', async () => {
    const { el, root, add } = setupLogo()
    act(() => { (el.querySelector('[data-testid="logo-trace-L1"]') as HTMLButtonElement).click() })
    ctx.clientForm = { id: 'client-B', businessName: 'B' }
    act(() => { root.render(<AssetUsagePanel />) })
    ctx.clientForm = { id: 'client-A', businessName: 'A' }
    act(() => { root.render(<AssetUsagePanel />) })
    await act(async () => { blobGate.release?.() }); await settle()
    expect(add).not.toHaveBeenCalled()
  })
  it('re-enables the trace buttons after the client changes mid-trace', async () => {
    const { el, root } = setupLogo()
    act(() => { (el.querySelector('[data-testid="logo-trace-L1"]') as HTMLButtonElement).click() })
    expect((el.querySelector('[data-testid="logo-trace-L1"]') as HTMLButtonElement).disabled).toBe(true)
    ctx.clientForm = { id: 'client-B', businessName: 'B' }
    act(() => { root.render(<AssetUsagePanel />) })
    expect((el.querySelector('[data-testid="logo-trace-L1"]') as HTMLButtonElement).disabled).toBe(false)
  })
  it('keeps the buttons disabled while the new client\'s trace runs, even if the old client\'s trace finishes first', async () => {
    const { el, root, add } = setupLogo()
    const btn = () => el.querySelector('[data-testid="logo-trace-L1"]') as HTMLButtonElement
    act(() => { btn().click() }) // trace for client A
    ctx.clientForm = { id: 'client-B', businessName: 'B' }
    act(() => { root.render(<AssetUsagePanel />) })
    expect(btn().disabled).toBe(false) // the switch cleared A's busy state
    act(() => { btn().click() }) // trace for client B
    expect(btn().disabled).toBe(true)
    expect(blobGate.all).toHaveLength(2)
    await act(async () => { blobGate.all[0]() }); await settle() // A finishes first
    expect(btn().disabled).toBe(true) // B is still running
    expect(add).not.toHaveBeenCalled() // and A's logo was dropped
    await act(async () => { blobGate.all[1]() }); await settle() // B finishes
    expect(add).toHaveBeenCalledTimes(1)
    expect(btn().disabled).toBe(false)
  })
  it('drops a trace that finishes after the panel is gone', async () => {
    const { el, root, add } = setupLogo()
    act(() => { (el.querySelector('[data-testid="logo-trace-L1"]') as HTMLButtonElement).click() })
    act(() => { root.unmount() })
    await act(async () => { blobGate.release?.() }); await settle()
    expect(add).not.toHaveBeenCalled()
  })
})

describe('AssetUsagePanel sharpen 2x', () => {
  const small = { id: 'S1', role: 'logo', name: 'small-logo.png', url: 'https://x/small.png', isPrimary: true, createdAt: '', width: 300, height: 120, mimeType: 'image/png' }
  const big = { id: 'B1', role: 'product_reference', name: 'big.jpg', url: 'https://x/big.jpg', isPrimary: false, createdAt: '', width: 2400, height: 1600, mimeType: 'image/jpeg' }
  function setupSharpen(extra: object[] = [], cached = true) {
    const add = { addLogoFiles: vi.fn(), addLogoUrl: vi.fn(), addProductFiles: vi.fn(), addProductUrl: vi.fn() }
    engine.upscaleImage.mockReset()
    engine.isModelCached.mockResolvedValue(cached)
    engine.modelInfo.mockResolvedValue({ key: 'upscale', label: 'Upscale stills 2x', feature: 'x', sizeMB: 4, license: 'Apache-2.0' })
    engine.cancelLocalAI.mockResolvedValue(undefined)
    engine.upscaleImage.mockImplementation(() => new Promise<Blob>((resolve) => { engine.upscaleCalls.push(() => resolve(new Blob(['png'], { type: 'image/png' }))) }))
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/sharp') as unknown as typeof URL.createObjectURL
    ctx.assets = { logos: [small], products: [big, ...extra], primaryLogo: small }
    ctx.previewSettings = applyLayoutPreset(createDefaultPreviewSettings(), 'product-showcase')
    ctx.previewVideo = null; ctx.source = { id: 'S1' }; ctx.clientForm = { id: 'client-A', businessName: 'A' }
    ctx.updatePreviewLayer = update; ctx.setPrimaryLogo = vi.fn(); Object.assign(ctx, add)
    const el = document.createElement('div'); document.body.appendChild(el)
    const root = createRoot(el)
    act(() => { root.render(<AssetUsagePanel />) })
    return { el, root, add }
  }
  const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 5)) })

  it('offers it for a small picture only', () => {
    const { el } = setupSharpen()
    expect(el.querySelector('[data-testid="sharpen-S1"]')).toBeTruthy()
    expect(el.querySelector('[data-testid="sharpen-B1"]')).toBeNull()
  })
  it('adds a sharper copy of a small logo as a new logo and keeps the original', async () => {
    const { el, add } = setupSharpen()
    act(() => { (el.querySelector('[data-testid="sharpen-S1"]') as HTMLButtonElement).click() }); await tick()
    expect(engine.upscaleImage).toHaveBeenCalledWith('https://x/small.png', expect.objectContaining({ signal: expect.anything() }))
    await act(async () => { engine.upscaleCalls[0]() }); await tick()
    expect(add.addLogoUrl).toHaveBeenCalledWith('blob:http://localhost/sharp') // jsdom has no DataTransfer, so the URL path
    expect(add.addProductUrl).not.toHaveBeenCalled()
    expect(el.textContent).toMatch(/original is still there/)
  })
  it('asks before downloading the model, and downloads nothing if declined', async () => {
    const { el } = setupSharpen([], false)
    act(() => { (el.querySelector('[data-testid="sharpen-S1"]') as HTMLButtonElement).click() }); await tick()
    expect(el.querySelector('[data-testid="local-ai-notice"]')?.getAttribute('data-phase')).toBe('confirm')
    expect(el.textContent).toMatch(/one-time download of about 4 MB/)
    expect(engine.upscaleImage).not.toHaveBeenCalled()
    act(() => { (el.querySelector('[data-testid="local-ai-decline"]') as HTMLButtonElement).click() }); await tick()
    expect(engine.upscaleImage).not.toHaveBeenCalled()
  })
  it('drops a sharpened copy for a client the person has left', async () => {
    const { el, root, add } = setupSharpen()
    act(() => { (el.querySelector('[data-testid="sharpen-S1"]') as HTMLButtonElement).click() }); await tick()
    ctx.clientForm = { id: 'client-B', businessName: 'B' }
    act(() => { root.render(<AssetUsagePanel />) })
    await act(async () => { engine.upscaleCalls[0]() }); await tick()
    expect(add.addLogoUrl).not.toHaveBeenCalled()
    expect(add.addLogoFiles).not.toHaveBeenCalled()
  })
  it('shows a plain error when the picture cannot be read, and leaves everything as it was', async () => {
    const { el, add } = setupSharpen()
    engine.upscaleImage.mockRejectedValue(new Error('This image cannot be read by the browser'))
    act(() => { (el.querySelector('[data-testid="sharpen-S1"]') as HTMLButtonElement).click() }); await tick()
    expect(el.querySelector('[data-testid="local-ai-error"]')?.textContent).toContain('cannot be read')
    expect(add.addLogoUrl).not.toHaveBeenCalled()
  })
})
