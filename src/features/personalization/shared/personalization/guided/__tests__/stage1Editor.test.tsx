// @vitest-environment jsdom
/**
 * Stage 1 — the overlay editor end to end with REAL state behind the mocked
 * provider: clicks and drags go through the real LayerToolsPanel, layerOps and
 * the editor's own pointer handling, and the assertions read the resulting
 * preview settings. (Provider history/persistence is covered separately.)
 */
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useDemoPersonalize } from '../../DemoPersonalizeProvider'
import { OverlayEditor } from '../OverlayEditor'
import { createDefaultPreviewSettings, createLayer } from '../../preview/presets'
import type { PersonalizationPreviewSettings, PreviewInputProps, PreviewLayer } from '../../preview/types'

vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: vi.fn() }))
vi.mock('../DesignLayerPlayer', () => ({ DesignLayerPlayer: () => <div /> }))

const BRAND: PreviewInputProps['brand'] = {
  businessName: 'Acme', headline: 'H', offer: '', cta: '', phone: '', website: '',
  logoUrl: null, productUrl: null, serviceUrl: null,
}

let latest: PersonalizationPreviewSettings = createDefaultPreviewSettings()

function text(id: string, kind: PreviewLayer['kind'], label: string, patch: Partial<PreviewLayer> = {}): PreviewLayer {
  return { ...createLayer(kind), id, text: label, x: 0.3, y: 0.3, scale: 0.05, animation: 'none', ...patch }
}

function Harness({ initial }: { initial: PersonalizationPreviewSettings }) {
  const [settings, setSettings] = useState(initial)
  latest = settings
  vi.mocked(useDemoPersonalize).mockImplementation(() => ({
    previewSettings: settings,
    updatePreviewLayer: (id: string, patch: Partial<PreviewLayer>) =>
      setSettings((p) => ({ ...p, layers: p.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
    editPreviewSettings: (fn: (p: PersonalizationPreviewSettings) => PersonalizationPreviewSettings) => setSettings((p) => fn(p)),
    setPreviewLayerLocked: (id: string, locked: boolean) =>
      setSettings((p) => ({ ...p, layers: p.layers.map((l) => (l.id === id ? { ...l, locked } : l)) })),
    updatePreviewComposition: vi.fn(), resetPreviewLayout: vi.fn(), setRemotionDesign: vi.fn(),
    undoPreview: vi.fn(), redoPreview: vi.fn(), canUndoPreview: false, canRedoPreview: false,
    assets: {},
  }) as unknown as ReturnType<typeof useDemoPersonalize>)
  return <OverlayEditor inputProps={{ videoUrl: null, posterUrl: null, isImageSource: false, audioUrl: null, settings, brand: BRAND }} />
}

function mountEditor(layers: PreviewLayer[]) {
  const settings = { ...createDefaultPreviewSettings(), layers, showEndCard: false }
  latest = settings
  return render(<Harness initial={settings} />)
}

const layer = (id: string) => latest.layers.find((l) => l.id === id)!

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 960 })
  Element.prototype.getBoundingClientRect = () =>
    ({ width: 960, height: 540, top: 0, left: 0, right: 960, bottom: 540, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

/** A pointer event carrying the same pointerId the pointerdown had (jsdom provides PointerEvent when it can). */
function ptr(type: string, init: { clientX?: number; clientY?: number; altKey?: boolean } = {}): Event {
  const Ctor = (typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent) as typeof MouseEvent
  return new Ctor(type, { ...init, pointerId: 1, bubbles: true } as MouseEventInit)
}

/** Pointer drag from clientX 100 by (dx, dy) CSS px on the 960x540 stage; Alt turns snapping off. */
function drag(handle: HTMLElement, dx: number, dy: number, alt = true) {
  fireEvent.pointerDown(handle, { pointerId: 1, clientX: 100, clientY: 100 })
  act(() => {
    window.dispatchEvent(ptr('pointermove', { clientX: 100 + dx, clientY: 100 + dy, altKey: alt }))
  })
  act(() => { window.dispatchEvent(ptr('pointerup')) })
}

const rows = () => screen.getAllByRole('button', { name: /^Select (Headline|Tagline|Offer|Call to action)$/ })

describe('rotate', () => {
  it('writes rotation through the slider and number box, and resets it', () => {
    mountEditor([text('hl', 'headline', 'One')])
    fireEvent.change(screen.getByLabelText('Rotation'), { target: { value: '30' } })
    expect(layer('hl').rotation).toBe(30)
    fireEvent.change(screen.getByLabelText('Rotation degrees'), { target: { value: '-45' } })
    expect(layer('hl').rotation).toBe(-45)
    fireEvent.click(screen.getByLabelText('Reset rotation'))
    expect(layer('hl').rotation).toBeUndefined()
  })
  it('draws the stage box rotated', () => {
    mountEditor([text('hl', 'headline', 'One', { rotation: 20 })])
    expect(screen.getByRole('button', { name: 'Move Headline' }).style.transform).toBe('rotate(20deg)')
  })
  it('refuses to rotate a locked layer', () => {
    mountEditor([text('hl', 'headline', 'One', { locked: true })])
    expect((screen.getByLabelText('Rotation') as HTMLInputElement).disabled).toBe(true)
    expect(layer('hl').rotation).toBeUndefined()
  })
})

describe('duplicate and stack order', () => {
  it('duplicates, selects the copy, and reorders it', () => {
    mountEditor([text('hl', 'headline', 'One'), text('tg', 'tagline', 'Two', { y: 0.6 })])
    fireEvent.click(screen.getByLabelText('Duplicate layer'))
    expect(latest.layers.map((l) => l.id)).toEqual(['hl', 'hl-2', 'tg'])
    expect(rows().length).toBe(3)
    // The copy is the selected layer now: sending it to the back moves it first.
    fireEvent.click(screen.getByLabelText('Move layer to back'))
    expect(latest.layers.map((l) => l.id)).toEqual(['hl-2', 'hl', 'tg'])
    fireEvent.click(screen.getByLabelText('Move layer to front'))
    expect(latest.layers.map((l) => l.id)).toEqual(['hl', 'tg', 'hl-2'])
  })
})

describe('group, move together, ungroup', () => {
  const two = () => mountEditor([
    text('hl', 'headline', 'One', { x: 0.3, y: 0.3 }),
    text('tg', 'tagline', 'Two', { x: 0.6, y: 0.6 }),
  ])
  it('Shift-click multi-selects and Group links the layers', () => {
    two()
    expect((screen.getByLabelText('Group selected layers') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(rows()[1], { shiftKey: true })
    const group = screen.getByLabelText('Group selected layers') as HTMLButtonElement
    expect(group.disabled).toBe(false)
    fireEvent.click(group)
    expect(layer('hl').groupId).toBe('group-1')
    expect(layer('tg').groupId).toBe('group-1')
    expect(screen.getAllByTestId('layer-group-badge')).toHaveLength(2)
  })
  it('dragging one member moves the whole group by the same amount', () => {
    two()
    fireEvent.click(rows()[1], { shiftKey: true })
    fireEvent.click(screen.getByLabelText('Group selected layers'))
    drag(screen.getByRole('button', { name: 'Move Headline' }), 96, 54) // = +0.1, +0.1
    expect(layer('hl').x).toBeCloseTo(0.4, 2)
    expect(layer('hl').y).toBeCloseTo(0.4, 2)
    expect(layer('tg').x).toBeCloseTo(0.7, 2)
    expect(layer('tg').y).toBeCloseTo(0.7, 2)
    expect(layer('hl').placementSource).toBe('manual')
  })
  it('Ungroup releases the link; a plain click then drags only one layer', () => {
    two()
    fireEvent.click(rows()[1], { shiftKey: true })
    fireEvent.click(screen.getByLabelText('Group selected layers'))
    fireEvent.click(screen.getByLabelText('Ungroup layers'))
    expect(layer('hl').groupId).toBeUndefined()
    expect(screen.queryAllByTestId('layer-group-badge')).toHaveLength(0)
    // Both are still multi-selected, so a drag carries the selection (as in design tools)...
    drag(screen.getByRole('button', { name: 'Move Headline' }), 96, 0)
    expect(layer('hl').x).toBeCloseTo(0.4, 2)
    expect(layer('tg').x).toBeCloseTo(0.7, 2)
    // ...and a plain click on one layer goes back to single-layer dragging.
    fireEvent.click(rows()[0])
    drag(screen.getByRole('button', { name: 'Move Headline' }), 96, 0)
    expect(layer('hl').x).toBeCloseTo(0.5, 2)
    expect(layer('tg').x).toBeCloseTo(0.7, 2)
  })
  it('a locked group member stays put while the others move', () => {
    mountEditor([
      text('hl', 'headline', 'One', { x: 0.3, y: 0.3 }),
      text('tg', 'tagline', 'Two', { x: 0.6, y: 0.6, locked: true }),
    ])
    fireEvent.click(rows()[1], { shiftKey: true })
    fireEvent.click(screen.getByLabelText('Group selected layers'))
    drag(screen.getByRole('button', { name: 'Move Headline' }), 96, 0)
    expect(layer('hl').x).toBeCloseTo(0.4, 2)
    expect(layer('tg').x).toBe(0.6)
  })
})

describe('plain drag, lock and snapping', () => {
  it('moves a single layer and never a locked one', () => {
    mountEditor([text('hl', 'headline', 'One', { x: 0.3 }), text('tg', 'tagline', 'Two', { x: 0.6, y: 0.6, locked: true })])
    drag(screen.getByRole('button', { name: 'Move Headline' }), 96, 0)
    expect(layer('hl').x).toBeCloseTo(0.4, 2)
    drag(screen.getByRole('button', { name: 'Move Tagline' }), 96, 0)
    expect(layer('tg').x).toBe(0.6)
  })
  it('snaps the centre to the frame centre, shows a guide, and clears it on release', () => {
    mountEditor([text('hl', 'headline', 'One', { x: 0.495, y: 0.3 }), text('tg', 'tagline', 'Two', { x: 0.85, y: 0.8 })])
    const handle = screen.getByRole('button', { name: 'Move Headline' })
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 100, clientY: 100 })
    act(() => { window.dispatchEvent(ptr('pointermove', { clientX: 101, clientY: 100 })) })
    expect(layer('hl').x).toBeCloseTo(0.5, 3) // 0.496 snapped to the centre line
    const guides = screen.getAllByTestId('snap-guide')
    expect(guides.some((g) => g.getAttribute('data-axis') === 'x' && g.style.left === '50%')).toBe(true)
    act(() => { window.dispatchEvent(ptr('pointerup')) })
    expect(screen.queryAllByTestId('snap-guide')).toHaveLength(0)
  })
  it('holding Alt turns snapping off', () => {
    mountEditor([text('hl', 'headline', 'One', { x: 0.495, y: 0.3 })])
    drag(screen.getByRole('button', { name: 'Move Headline' }), 1, 0, true)
    expect(layer('hl').x).toBeCloseTo(0.496, 3)
    expect(screen.queryAllByTestId('snap-guide')).toHaveLength(0)
  })
  it('the grid option adds grid guides; without it the same drag has none', () => {
    const run = (grid: boolean) => {
      cleanup()
      mountEditor([text('hl', 'headline', 'One', { x: 0.3, y: 0.3 })])
      if (grid) fireEvent.click(screen.getByLabelText('Snap to grid'))
      const handle = screen.getByRole('button', { name: 'Move Headline' })
      fireEvent.pointerDown(handle, { pointerId: 1, clientX: 100, clientY: 100 })
      // +0.0465 across (centre .3465 is 0.0035 off the 0.35 grid line): inside the snap threshold, off every frame/layer line.
      act(() => { window.dispatchEvent(ptr('pointermove', { clientX: 100 + 0.0465 * 960, clientY: 100 })) })
      const kinds = screen.queryAllByTestId('snap-guide').map((g) => `${g.getAttribute('data-axis')}:${g.getAttribute('data-kind')}`)
      const x = layer('hl').x
      act(() => { window.dispatchEvent(ptr('pointerup')) })
      return { kinds, x }
    }
    const off = run(false)
    expect(off.kinds).not.toContain('x:grid')
    expect(off.x).toBeCloseTo(0.3465, 3)
    const on = run(true)
    expect(on.kinds).toContain('x:grid')
    expect(on.x).not.toBeCloseTo(0.3465, 3) // it moved onto a grid line
    expect(Math.abs(on.x - 0.3465)).toBeLessThanOrEqual(0.012)
  })
})

describe('align', () => {
  it('aligns a single layer to the frame and several to each other', () => {
    mountEditor([text('hl', 'headline', 'One', { x: 0.3, y: 0.2 }), text('tg', 'tagline', 'Two', { x: 0.7, y: 0.6 })])
    fireEvent.click(screen.getByLabelText('Align centre'))
    expect(layer('hl').x).toBeCloseTo(0.5, 2)
    fireEvent.click(rows()[1], { shiftKey: true })
    fireEvent.click(screen.getByLabelText('Align top'))
    expect(layer('hl').y - layer('tg').y).toBeLessThan(0.05) // same top edge (text anchors differ by line height only)
  })
})

describe('presenter transform, custom fields, layouts', () => {
  it('moves and zooms the footage, and resets it', () => {
    mountEditor([text('hl', 'headline', 'One')])
    expect((screen.getByLabelText('Reset footage position') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Footage zoom'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Footage horizontal position'), { target: { value: '0.25' } })
    expect(latest.sourceTransform).toEqual({ x: 0.25, y: 0.5, zoom: 2 })
    fireEvent.click(screen.getByLabelText('Reset footage position'))
    expect(latest.sourceTransform).toBeUndefined()
  })
  it('adds, edits, validates and removes custom fields, and the stage shows the value', () => {
    mountEditor([text('hl', 'headline', 'Hello {{city}}')])
    expect(screen.getByRole('button', { name: 'Move Headline' }).textContent).toContain('{{city}}')
    fireEvent.change(screen.getByLabelText('New field name'), { target: { value: 'bad name' } })
    fireEvent.click(screen.getByLabelText('Add custom field'))
    expect(screen.getByRole('alert').textContent).toMatch(/starts with a letter/)
    expect(latest.customFields).toBeUndefined()
    fireEvent.change(screen.getByLabelText('New field name'), { target: { value: 'city' } })
    fireEvent.change(screen.getByLabelText('New field value'), { target: { value: 'Austin' } })
    fireEvent.click(screen.getByLabelText('Add custom field'))
    expect(latest.customFields).toEqual({ city: 'Austin' })
    expect(screen.getByRole('button', { name: 'Move Headline' }).textContent).toContain('Hello Austin')
    fireEvent.change(screen.getByLabelText('Value for city'), { target: { value: 'Dallas' } })
    expect(latest.customFields).toEqual({ city: 'Dallas' })
    fireEvent.change(screen.getByLabelText('New field name'), { target: { value: 'city' } })
    fireEvent.click(screen.getByLabelText('Add custom field'))
    expect(screen.getByRole('alert').textContent).toMatch(/already exists/)
    fireEvent.click(screen.getByLabelText('Remove field city'))
    expect(latest.customFields).toBeUndefined()
  })
  it('saves a layout and applies it to a different arrangement without touching text', () => {
    window.localStorage.clear()
    mountEditor([text('hl', 'headline', 'Secret One', { x: 0.2, y: 0.2, rotation: 15 })])
    fireEvent.change(screen.getByLabelText('Layout name'), { target: { value: 'Corner' } })
    fireEvent.click(screen.getByLabelText('Save layout'))
    expect(window.localStorage.getItem('smartvideo.personalization.savedLayouts.v1')).not.toContain('Secret One')
    // Move the layer elsewhere and apply the layout back.
    drag(screen.getByRole('button', { name: 'Move Headline' }), 200, 0)
    expect(layer('hl').x).toBeGreaterThan(0.3)
    fireEvent.click(screen.getByLabelText('Apply layout Corner'))
    expect(layer('hl')).toMatchObject({ x: 0.2, y: 0.2, rotation: 15, text: 'Secret One' })
    expect(screen.getByRole('status').textContent).toMatch(/Applied “Corner” to 1 layer/)
    fireEvent.click(screen.getByLabelText('Delete layout Corner'))
    expect(within(document.body).queryByLabelText('Apply layout Corner')).toBeNull()
    expect(window.localStorage.getItem('smartvideo.personalization.savedLayouts.v1')).toBe('[]')
  })
})

describe('hosts without editPreviewSettings', () => {
  it('still renders and drags through updatePreviewLayer (existing behaviour)', () => {
    const update = vi.fn()
    const settings = { ...createDefaultPreviewSettings(), layers: [text('hl', 'headline', 'One')], showEndCard: false }
    vi.mocked(useDemoPersonalize).mockImplementation(() => ({
      previewSettings: settings, updatePreviewLayer: update, updatePreviewComposition: vi.fn(), resetPreviewLayout: vi.fn(),
      setPreviewLayerLocked: vi.fn(), setRemotionDesign: vi.fn(), assets: {},
    }) as unknown as ReturnType<typeof useDemoPersonalize>)
    render(<OverlayEditor inputProps={{ videoUrl: null, posterUrl: null, isImageSource: false, audioUrl: null, settings, brand: BRAND }} />)
    expect(screen.queryByTestId('layer-tools')).toBeNull()
    drag(screen.getByRole('button', { name: 'Move Headline' }), 96, 0)
    expect(update).toHaveBeenCalledWith('hl', expect.objectContaining({ x: expect.any(Number) }))
  })
})
