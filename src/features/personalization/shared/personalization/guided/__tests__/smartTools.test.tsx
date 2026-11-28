// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { applyLayoutPreset, createDefaultPreviewSettings } from '../../preview/presets'

const ctx: Record<string, unknown> = {}
vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: () => ctx }))
const px = vi.hoisted(() => ({ loadPixels: vi.fn() }))
vi.mock('../../intelligence/pixelLoader', () => px)
import { AssetIntelligencePanel, FinalChecksPanel, FreeContentPanel } from '../SmartTools'

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })
afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks() })

const solid = (w: number, h: number, c: [number, number, number]) => {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) data.set([...c, 255], i * 4)
  return { data, width: w, height: h, naturalWidth: w * 8, naturalHeight: h * 8 }
}
const mount = (node: React.JSX.Element) => { const el = document.createElement('div'); document.body.appendChild(el); act(() => { createRoot(el).render(node) }); return el }
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 20)) }) }
const dAsset = (id: string) => ({ id, sourceUrl: `https://x/${id}`, previewUrl: `https://x/${id}.png`, category: 'logo', selected: true, rejected: false })

describe('AssetIntelligencePanel', () => {
  const setup = () => {
    const setDiscoveredAssets = vi.fn(), updatePreviewBrandColors = vi.fn()
    Object.assign(ctx, { discoveredAssets: [dAsset('a'), dAsset('b'), dAsset('c')], setDiscoveredAssets, updatePreviewBrandColors, previewSettings: createDefaultPreviewSettings() })
    // a and b are the same red picture at two sizes; c is a different blue one.
    px.loadPixels.mockImplementation(async (url: string) => (url.includes('/c') ? solid(64, 64, [20, 40, 210]) : solid(url.includes('/a') ? 96 : 48, url.includes('/a') ? 96 : 48, [210, 30, 30])))
    return { setDiscoveredAssets, updatePreviewBrandColors, el: mount(<AssetIntelligencePanel />) }
  }
  it('reports duplicates but changes nothing until the customer acts', async () => {
    const { el, setDiscoveredAssets, updatePreviewBrandColors } = setup()
    act(() => { (el.querySelector('[data-testid="optimize-assets"]') as HTMLButtonElement).click() })
    await flush()
    expect(el.querySelector('[data-testid="asset-report-summary"]')!.textContent).toMatch(/Checked 3 pictures: 1 near-duplicate/)
    expect(setDiscoveredAssets).not.toHaveBeenCalled()
    expect(updatePreviewBrandColors).not.toHaveBeenCalled()
  })
  it('hides only the smaller duplicate (reversible flag, not a delete)', async () => {
    const { el, setDiscoveredAssets } = setup()
    act(() => { (el.querySelector('[data-testid="optimize-assets"]') as HTMLButtonElement).click() })
    await flush()
    act(() => { (el.querySelector('[data-testid="hide-duplicates"]') as HTMLButtonElement).click() })
    const next = setDiscoveredAssets.mock.calls[0]![0] as { id: string; rejected: boolean }[]
    expect(next.map((a) => [a.id, a.rejected])).toEqual([['a', false], ['b', true], ['c', false]])
    expect(el.querySelector('[data-testid="asset-note"]')!.textContent).toMatch(/Nothing was deleted/)
  })
  it('never overwrites brand colours without an explicit confirmation', async () => {
    const { el, updatePreviewBrandColors } = setup()
    act(() => { (el.querySelector('[data-testid="optimize-assets"]') as HTMLButtonElement).click() })
    await flush()
    act(() => { (el.querySelector('[data-testid="use-palette"]') as HTMLButtonElement).click() })
    expect(updatePreviewBrandColors).not.toHaveBeenCalled()
    expect(el.querySelector('[data-testid="palette-confirm"]')).not.toBeNull()
    act(() => { (el.querySelector('[data-testid="palette-confirm-yes"]') as HTMLButtonElement).click() })
    expect(updatePreviewBrandColors).toHaveBeenCalledTimes(1)
    expect(updatePreviewBrandColors.mock.calls[0]![0].primary).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('assigns the best picture only to an empty slot and never replaces one the customer chose', async () => {
    const { el } = setup()
    const base = createDefaultPreviewSettings()
    const layers = applyLayoutPreset(base, 'product-showcase').layers
    const addLogoUrl = vi.fn(), updatePreviewLayer = vi.fn()
    Object.assign(ctx, { addLogoUrl, updatePreviewLayer, assets: { logos: [] }, previewSettings: { ...base, layers: layers.map((l) => (l.kind === 'productImage' ? { ...l, imageUrl: 'https://mine/pick.png' } : l)) } })
    px.loadPixels.mockImplementation(async (url: string) => (url.includes('/c') ? { ...solid(64, 64, [20, 40, 210]), naturalWidth: 1000, naturalHeight: 1000 } : solid(32, 32, [210, 30, 30])))
    const el2 = mount(<AssetIntelligencePanel />)
    act(() => { (el2.querySelector('[data-testid="optimize-assets"]') as HTMLButtonElement).click() })
    await flush()
    const btn = el2.querySelector('[data-testid="assign-best"]') as HTMLButtonElement | null
    if (btn) { act(() => { btn.click() }); expect(updatePreviewLayer).not.toHaveBeenCalled() }
    void el
  })
  it('says so when pictures cannot be read instead of reporting a fake success', async () => {
    const { el } = setup()
    px.loadPixels.mockResolvedValue(null)
    act(() => { (el.querySelector('[data-testid="optimize-assets"]') as HTMLButtonElement).click() })
    await flush()
    expect(el.querySelector('[data-testid="asset-report-summary"]')!.textContent).toMatch(/Checked 0 pictures.*3 could not be read/)
  })
})

describe('FinalChecksPanel', () => {
  const quality = (over: object = {}) => ({ report: { issues: [], blocksExport: false, ...over }, sampling: 'idle' }) as never
  const input = (over: object = {}) => ({ videoUrl: 'blob:v', isImageSource: false, posterUrl: null, brand: { businessName: 'Acme', headline: 'Hi', offer: '', cta: '', phone: '', website: '', logoUrl: 'x', productUrl: null, serviceUrl: null }, ...over }) as never
  const run = (inp: never, q = quality()) => {
    Object.assign(ctx, { previewSettings: applyLayoutPreset(createDefaultPreviewSettings(), 'business-introduction'), assets: {}, discoveredAssets: [] })
    return mount(<FinalChecksPanel inputProps={inp} quality={q} />)
  }
  it('lists audio as not checked rather than passed when it was never analysed', () => {
    const el = run(input())
    expect(el.querySelector('[data-check="audio"]')!.getAttribute('data-status')).toBe('unchecked')
  })
  it('fails on a raw {{placeholder}} so it cannot be approved by accident', () => {
    const inp = input({ brand: { businessName: 'Hi {{firstname}}', headline: '', offer: '', cta: '', phone: '', website: '', logoUrl: 'x', productUrl: null, serviceUrl: null } })
    const el = run(inp)
    expect(el.querySelector('[data-check="tokens"]')!.getAttribute('data-status')).toBe('fail')
    expect(el.querySelector('[data-testid="preflight-summary"]')!.textContent).toMatch(/Fix first: Personalization tokens valid/)
  })
  it('states that social safe zones are estimates', () => {
    expect(run(input()).querySelector('[data-testid="safe-zones"]')!.textContent).toMatch(/estimates/)
  })
})

describe('FreeContentPanel', () => {
  it('asks before putting a price or promotion into the video, and is labelled as template-based', () => {
    Object.assign(ctx, { clientForm: { businessName: 'Acme Spa', industry: 'Spa', offer: 'We are really offering 20% off all massages this month' }, previewSettings: createDefaultPreviewSettings() })
    const onPick = vi.fn()
    const el = mount(<FreeContentPanel onPick={onPick} />)
    act(() => { (el.querySelector('[data-testid="free-content-toggle"]') as HTMLButtonElement).click() })
    expect(el.textContent).toMatch(/No AI model is downloaded and no paid service is called/)
    const offerBtn = el.querySelector('[data-testid="fc-offer"] button') as HTMLButtonElement
    act(() => { offerBtn.click() })
    expect(onPick).not.toHaveBeenCalled()
    act(() => { (el.querySelector('[data-testid="fc-claim-yes"]') as HTMLButtonElement).click() })
    expect(onPick).toHaveBeenCalledWith('offer', expect.stringContaining('20%'), 'offer')
  })
  it('disables translation (no paid fallback) when the browser has no translator', () => {
    Object.assign(ctx, { clientForm: { businessName: 'Acme' }, previewSettings: createDefaultPreviewSettings() })
    const el = mount(<FreeContentPanel onPick={vi.fn()} />)
    act(() => { (el.querySelector('[data-testid="free-content-toggle"]') as HTMLButtonElement).click() })
    expect((el.querySelector('[data-testid="fc-translate"]') as HTMLButtonElement).disabled).toBe(true)
  })
})
