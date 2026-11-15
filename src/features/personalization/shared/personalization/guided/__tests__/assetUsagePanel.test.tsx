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
import { AssetUsagePanel } from '../AssetUsagePanel'

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })
afterEach(() => { document.body.innerHTML = ''; update.mockClear(); blobGate.all.length = 0 })

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
