// @vitest-environment jsdom
/** The overlay editor's image look: stage rendering and the Image style controls. */
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useDemoPersonalize } from '../../DemoPersonalizeProvider'
import { OverlayEditor } from '../OverlayEditor'
import { createDefaultPreviewSettings, createLayer } from '../../preview/presets'
import type { PreviewInputProps, PreviewLayer } from '../../preview/types'

vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: vi.fn() }))

const URL = 'https://cdn.example.com/p.png'
const BRAND: PreviewInputProps['brand'] = {
  businessName: 'Acme', headline: 'Roofs', offer: '', cta: '', phone: '', website: '',
  logoUrl: 'https://cdn.example.com/logo.png', productUrl: URL, serviceUrl: null,
}
let layersNow: PreviewLayer[] = []

function Harness({ initial, hints }: { initial: PreviewLayer[]; hints: Record<string, { aspect?: number }> }) {
  const [layers, setLayers] = useState(initial)
  layersNow = layers
  const settings = { ...createDefaultPreviewSettings(), layers, imageHints: hints }
  vi.mocked(useDemoPersonalize).mockImplementation(() => ({
    previewSettings: settings,
    updatePreviewLayer: (id: string, patch: Partial<PreviewLayer>) =>
      setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l))),
    setPreviewLayerLocked: vi.fn(), updatePreviewComposition: vi.fn(), resetPreviewLayout: vi.fn(), assets: {},
  }) as never)
  return <OverlayEditor inputProps={{ videoUrl: null, posterUrl: null, isImageSource: false, audioUrl: null, settings, brand: BRAND }} />
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 960 })
  Element.prototype.getBoundingClientRect = function () {
    return { width: 960, height: 540, top: 0, left: 0, right: 960, bottom: 540, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
  }
})
afterEach(() => cleanup())

const product = () => createLayer('productImage', { imageUrl: URL })
const mount = (layers: PreviewLayer[], hints: Record<string, { aspect?: number }> = { [URL]: { aspect: 1.5 } }) =>
  render(<Harness initial={layers} hints={hints} />)

describe('Overlay editor — image styling', () => {
  it('shows the automatic look on the stage: rounded rectangle, shadow on the outer wrapper', () => {
    const { container } = mount([product()])
    const outer = container.querySelector('[data-styled-image="outer"]') as HTMLElement
    expect(outer).toBeTruthy()
    expect(outer.getAttribute('data-shape')).toBe('rounded-rect')
    expect(outer.style.boxShadow).toMatch(/rgba/)
    const clip = container.querySelector('[data-styled-image="clip"]') as HTMLElement
    expect(clip.style.overflow).toBe('hidden')
    expect((container.querySelector('img') as HTMLImageElement).style.objectFit).toBe('contain')
  })

  it('offers shape, radius, border, shadow, fit and exit controls and says the look is automatic', () => {
    mount([product()])
    expect(screen.getByTestId('image-style-mode').textContent).toBe('Automatic')
    expect((screen.getByLabelText('Image shape') as HTMLSelectElement).value).toBe('rounded-rect')
    for (const label of ['Corner radius', 'Border colour', 'Border width', 'Image shadow', 'Image fit', 'Image exit']) {
      expect(screen.getByLabelText(label), label).toBeTruthy()
    }
    expect(screen.queryByLabelText('Crop horizontal')).toBeNull() // only for cover
  })

  it('a customer edit becomes their own style; "Back to automatic" returns control', () => {
    const { container } = mount([product()])
    fireEvent.change(screen.getByLabelText('Image shape'), { target: { value: 'pill' } })
    expect(layersNow[0].imageStyle).toMatchObject({ shape: 'pill', auto: false })
    expect(screen.getByTestId('image-style-mode').textContent).toBe('Your style')
    expect((container.querySelector('[data-styled-image="outer"]') as HTMLElement).getAttribute('data-shape')).toBe('pill')
    act(() => { screen.getByTestId('image-style-reset').click() })
    expect(layersNow[0].imageStyle).toBeUndefined()
    expect(screen.getByTestId('image-style-mode').textContent).toBe('Automatic')
  })

  it('brand-colour border and shadow level are stored on the layer', () => {
    mount([product()])
    fireEvent.change(screen.getByLabelText('Border colour'), { target: { value: 'brand-accent' } })
    expect(layersNow[0].imageStyle).toMatchObject({ borderColor: 'brand-accent', auto: false })
    expect(layersNow[0].imageStyle!.borderWidth).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('Image shadow'), { target: { value: 'none' } })
    expect(layersNow[0].imageStyle!.shadow).toBe('none')
  })

  it('cover fit reveals the crop controls and stores the crop focus', () => {
    mount([product()])
    fireEvent.change(screen.getByLabelText('Image fit'), { target: { value: 'cover' } })
    fireEvent.change(screen.getByLabelText('Crop horizontal'), { target: { value: '0.2' } })
    fireEvent.change(screen.getByLabelText('Crop vertical'), { target: { value: '0.8' } })
    expect(layersNow[0].imageStyle).toMatchObject({ fit: 'cover', cropX: 0.2, cropY: 0.8 })
  })

  it('holds the frame back until the picture size is known (no shadow around an empty square)', () => {
    const { container } = mount([product()], {})
    expect(container.querySelector('[data-styled-image="outer"]')).toBeNull()
    expect(container.querySelector('[data-styled-image="plain"]')).toBeTruthy()
  })

  it('a logo stays unclipped with its original proportions', () => {
    const logo = createLayer('logo', { imageUrl: 'https://cdn.example.com/logo.png' })
    const { container } = mount([logo], { 'https://cdn.example.com/logo.png': { aspect: 3 } })
    expect(container.querySelector('[data-styled-image="outer"]')).toBeNull()
    expect(container.querySelector('[data-styled-image="clip"]')).toBeNull()
    expect((screen.getByLabelText('Image shape') as HTMLSelectElement).value).toBe('square')
    expect((screen.getByLabelText('Image shadow') as HTMLSelectElement).value).toBe('none')
  })
})

describe('Overlay editor — Image Overlay Styles selector', () => {
  const ids = ['rounded-floating-card', 'circular-portrait', 'product-spotlight', 'cinematic-reveal', 'multi-image-collage', 'polaroid', 'split-screen', 'soft-masked']

  it('lists all eight presets, marks suitability for the image role, and keeps the existing controls', () => {
    mount([product()])
    for (const id of ids) expect(screen.getByTestId(`image-preset-${id}`), id).toBeTruthy()
    expect(screen.getByTestId('image-preset-product-spotlight').textContent).toMatch(/Suits product images/)
    expect(screen.getByTestId('image-preset-circular-portrait').textContent).toMatch(/Less suited to product images/)
    // the earlier rounded-image controls are all still there as overrides
    for (const label of ['Image shape', 'Corner radius', 'Border colour', 'Image shadow', 'Image fit', 'Image exit']) expect(screen.getByLabelText(label), label).toBeTruthy()
  })

  it('choosing a preset stores it as the customer\'s style; the stage shows it; overrides still work on top', () => {
    const { container } = mount([product()])
    fireEvent.click(screen.getByTestId('image-preset-polaroid'))
    expect(layersNow[0].imageStyle).toMatchObject({ presetId: 'polaroid', frame: 'polaroid', auto: false })
    expect(container.querySelector('[data-preset="polaroid"]')).toBeTruthy()
    expect(screen.getByTestId('image-preset-polaroid').getAttribute('aria-pressed')).toBe('true')
    fireEvent.change(screen.getByLabelText('Image shadow'), { target: { value: 'none' } })
    expect(layersNow[0].imageStyle).toMatchObject({ presetId: 'polaroid', shadow: 'none', auto: false })
  })

  it('points at the existing template instead of duplicating it', () => {
    mount([product()])
    fireEvent.click(screen.getByTestId('image-preset-polaroid'))
    expect(screen.getByTestId('image-preset-reuse').textContent).toMatch(/Polaroid Drop/)
    fireEvent.click(screen.getByTestId('image-preset-soft-masked'))
    expect(screen.queryByTestId('image-preset-reuse')).toBeNull() // soft-masked is new, not a reuse
  })

  it('collage shows its picker; with fewer than two pictures the stage falls back to the plain card', () => {
    const { container } = mount([product()])
    fireEvent.click(screen.getByTestId('image-preset-multi-image-collage'))
    expect(screen.getByTestId('collage-picker')).toBeTruthy()
    expect(container.querySelector('[data-styled-image="collage"]')).toBeNull() // only one picture
    expect(container.querySelector('[data-styled-image="outer"]')).toBeTruthy()
  })

  it('split screen draws a half-frame panel and offers the side control', () => {
    const { container } = mount([product()])
    fireEvent.click(screen.getByTestId('image-preset-split-screen'))
    expect(container.querySelector('[data-styled-image="split"]')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Split screen side'), { target: { value: 'left' } })
    expect(layersNow[0].imageStyle).toMatchObject({ presetId: 'split-screen', splitSide: 'left', splitSideAuto: false })
    expect((container.querySelector('[data-styled-image="split"]') as HTMLElement).getAttribute('data-side')).toBe('left')
  })

  it('"Back to automatic" returns to the role-based default', () => {
    mount([product()])
    fireEvent.click(screen.getByTestId('image-preset-soft-masked'))
    act(() => { screen.getByTestId('image-style-reset').click() })
    expect(layersNow[0].imageStyle).toBeUndefined()
    expect(screen.getByTestId('image-style-mode').textContent).toBe('Automatic')
  })
})
