// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { applyLayoutPreset, createDefaultPreviewSettings } from '../../preview/presets'

const update = vi.fn()
const ctx: Record<string, unknown> = {}
vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: () => ctx }))
import { AssetUsagePanel } from '../AssetUsagePanel'

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })
afterEach(() => { document.body.innerHTML = ''; update.mockClear() })

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
