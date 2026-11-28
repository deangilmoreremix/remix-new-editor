// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createDefaultPreviewSettings } from '../../preview/presets'

const ctx: Record<string, unknown> = {}
vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: () => ctx }))
const px = vi.hoisted(() => ({ loadPixels: vi.fn() }))
vi.mock('../../intelligence/pixelLoader', () => px)
const seek = vi.hoisted(() => vi.fn())
vi.mock('../../preview/PreviewControls', () => ({ seekPreviewTo: seek }))
const ocr = vi.hoisted(() => ({ ocrImage: vi.fn() }))
vi.mock('../../intelligence/ocrIntel', async () => ({ ...(await vi.importActual<object>('../../intelligence/ocrIntel')), ...ocr }))
const engine = vi.hoisted(() => ({
  isModelCached: vi.fn(async () => true), modelInfo: vi.fn(async () => ({ key: 'detr', label: 'Object finder', feature: '', sizeMB: 40, license: 'Apache-2.0' })), cancelLocalAI: vi.fn(),
  grabFramePixels: vi.fn(async () => ({ width: 640, height: 640, data: new Uint8ClampedArray(4) })),
  detectObjects: vi.fn(async () => [{ label: 'bottle', score: 0.9, box: { xmin: 200, ymin: 100, xmax: 400, ymax: 500 } }]),
}))
vi.mock('../../localAI/engine', () => engine)
import { SocialPublishContext } from '../../../../components/SocialPublishProvider'
import { AssetIntelligencePanel, FinalChecksPanel, TranscriptToolsPanel, VideoCheckPanel } from '../SmartTools'

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })
afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks() })
const mount = (node: React.JSX.Element) => { const el = document.createElement('div'); document.body.appendChild(el); act(() => { createRoot(el).render(node) }); return el }
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 20)) }) }
const click = (el: Element | null) => act(() => { (el as HTMLElement).click() })
const solid = (c: [number, number, number]) => { const data = new Uint8ClampedArray(64 * 64 * 4); for (let i = 0; i < 4096; i++) data.set([...c, 255], i * 4); return { data, width: 64, height: 64, naturalWidth: 800, naturalHeight: 800 } }

describe('TranscriptToolsPanel', () => {
  const caps = { enabled: true, cues: [
    { id: '1', start: 0, end: 4, text: 'Welcome to Sunny Dental' }, { id: '2', start: 4.5, end: 8, text: 'Our whitening takes under an hour' },
    { id: '3', start: 30, end: 33, text: 'Book your whitening visit today' }] }
  it('finds a word and seeks the preview to that moment', () => {
    Object.assign(ctx, { previewSettings: { ...createDefaultPreviewSettings(), fps: 30, captions: caps } })
    const el = mount(<TranscriptToolsPanel />)
    act(() => { const i = el.querySelector('[data-testid="transcript-search"]') as HTMLInputElement; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!; set.call(i, 'whitening'); i.dispatchEvent(new Event('input', { bubbles: true })) })
    const hits = el.querySelectorAll('[data-testid="transcript-hit"]')
    expect(hits.length).toBe(2)
    click(hits[1]!)
    expect(seek).toHaveBeenCalledWith(900)
  })
  it('only copies suggested chapters after a confirmation', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    Object.assign(ctx, { previewSettings: { ...createDefaultPreviewSettings(), captions: caps } })
    const el = mount(<TranscriptToolsPanel />)
    click(el.querySelector('[data-testid="copy-chapters"]'))
    expect(writeText).not.toHaveBeenCalled()
    click(el.querySelector('[data-testid="copy-chapters-yes"]')); await flush()
    expect(writeText).toHaveBeenCalledTimes(1)
  })
  it('renders nothing without captions', () => {
    Object.assign(ctx, { previewSettings: createDefaultPreviewSettings() })
    expect(mount(<TranscriptToolsPanel />).innerHTML).toBe('')
  })
})

describe('FinalChecksPanel publishing handoff', () => {
  const quality = { report: { issues: [], blocksExport: false }, sampling: 'idle' } as never
  const brand = { businessName: 'Acme', headline: 'Hi', offer: '', cta: 'Call', phone: '', website: '', logoUrl: 'x', productUrl: null, serviceUrl: null }
  const inp = { videoUrl: 'blob:v', isImageSource: false, posterUrl: null, brand } as never
  const setup = (opts: { mediaUrl?: string | null; provider?: boolean }) => {
    Object.assign(ctx, { previewSettings: createDefaultPreviewSettings(), assets: {}, discoveredAssets: [] })
    const openPublish = vi.fn()
    const node = <FinalChecksPanel inputProps={inp} quality={quality} mediaUrl={opts.mediaUrl} />
    const el = mount(opts.provider === false ? node : <SocialPublishContext.Provider value={{ openPublish } as never}>{node}</SocialPublishContext.Provider>)
    return { el, openPublish, btn: () => el.querySelector('[data-testid="final-publish"]') as HTMLButtonElement }
  }
  it('is disabled until the video exists, and without the publishing provider', () => {
    expect(setup({ mediaUrl: null }).btn().disabled).toBe(true)
    expect(setup({ mediaUrl: 'https://v/final.mp4', provider: false }).btn().disabled).toBe(true)
  })
  it('hands the finished video to the existing publishing modal', () => {
    const { btn, openPublish } = setup({ mediaUrl: 'https://v/final.mp4' })
    expect(btn().disabled).toBe(false)
    click(btn())
    expect(openPublish).toHaveBeenCalledWith(expect.objectContaining({ mediaUrl: 'https://v/final.mp4', mediaType: 'video', title: 'Acme' }))
  })
})

describe('AssetIntelligencePanel: product crop and OCR', () => {
  const run = async () => {
    const addProductFiles = vi.fn(), addProductUrl = vi.fn()
    Object.assign(ctx, { discoveredAssets: [{ id: 'a', sourceUrl: 'u', previewUrl: 'https://x/a.png', category: 'product', selected: true, rejected: false }], setDiscoveredAssets: vi.fn(), updatePreviewBrandColors: vi.fn(), previewSettings: createDefaultPreviewSettings(), addProductFiles, addProductUrl, assets: {} })
    const data = new Uint8ClampedArray(64 * 64 * 4); for (let i = 0; i < 4096; i++) data.set([(i * 7) % 256, (i * 13) % 256, (i * 29) % 256, 255], i * 4)
    px.loadPixels.mockResolvedValue({ data, width: 64, height: 64, naturalWidth: 1200, naturalHeight: 1200 })
    const el = mount(<AssetIntelligencePanel />)
    click(el.querySelector('[data-testid="optimize-assets"]')); await flush()
    return { el, addProductFiles }
  }
  it('suggests a crop from the on-device detector and offers Reset', async () => {
    const { el } = await run()
    if (!el.querySelector('[data-testid="detect-product"]')) throw new Error('no detect button: ' + el.textContent)
    click(el.querySelector('[data-testid="detect-product"]')); await flush()
    expect(engine.detectObjects).toHaveBeenCalled()
    expect(el.querySelector('[data-testid="crop-product"]')).not.toBeNull()
    click(el.querySelector('[data-testid="reset-product-crop"]'))
    expect(el.querySelector('[data-testid="crop-product"]')).toBeNull()
  })
  it('asks before downloading the OCR reader and requires confirmation for prices', async () => {
    const { el } = await run()
    ocr.ocrImage.mockResolvedValue({ lines: [{ text: 'Pizza $12.99', kind: 'price', needsConfirm: true, confidence: 90 }, { text: 'Joe’s Pizza', kind: 'text', needsConfirm: false, confidence: 95 }] })
    click(el.querySelector('[data-testid="read-text"]'))
    expect(ocr.ocrImage).not.toHaveBeenCalled()
    expect(el.querySelector('[data-testid="ocr-consent"]')!.textContent).toMatch(/downloads roughly 15 MB/)
    click(el.querySelector('[data-testid="ocr-go"]')); await flush()
    const copies = el.querySelectorAll('[data-testid="ocr-copy"]') as NodeListOf<HTMLButtonElement>
    expect(copies[0]!.disabled).toBe(true)
    expect(copies[1]!.disabled).toBe(false)
    click(el.querySelector('[data-testid="ocr-confirm"]'))
    expect((el.querySelectorAll('[data-testid="ocr-copy"]')[0] as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('VideoCheckPanel is hidden without a readable video', () => {
  it('does not crash on a partial project', () => {
    for (const k of Object.keys(ctx)) delete ctx[k]
    expect(mount(<VideoCheckPanel />).innerHTML).toBe('')
  })
})
