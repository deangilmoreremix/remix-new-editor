// @vitest-environment jsdom
/**
 * Phase 6 — the overlay editor stage: designs are drawn by the real composition (not a name label),
 * full-frame designs are not draggable/resizable, text-less designs show no font/colour controls,
 * timing is edited in seconds, and "Restore design defaults" is a different action from "Remove design".
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useDemoPersonalize } from '../../DemoPersonalizeProvider'
import { OverlayEditor, framesToSeconds, secondsToFrames } from '../OverlayEditor'
import { createDefaultPreviewSettings, createLayer } from '../../preview/presets'
import type { PreviewInputProps, PreviewLayer } from '../../preview/types'

vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: vi.fn() }))
vi.mock('../DesignLayerPlayer', () => ({ DesignLayerPlayer: ({ layer }: { layer: PreviewLayer }) => <div data-testid="design-layer-player" data-design={layer.designId} /> }))

const BRAND: PreviewInputProps['brand'] = { businessName: 'Acme', headline: 'H', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null }
const update = vi.fn(); const removeDesign = vi.fn()

function renderEditor(layers: PreviewLayer[]) {
  const settings = { ...createDefaultPreviewSettings(), layers }
  vi.mocked(useDemoPersonalize).mockImplementation(() => ({
    previewSettings: settings, updatePreviewLayer: update, updatePreviewComposition: vi.fn(), resetPreviewLayout: vi.fn(),
    setPreviewLayerLocked: vi.fn(), setRemotionDesign: removeDesign, assets: {},
  }) as unknown as ReturnType<typeof useDemoPersonalize>)
  return render(<OverlayEditor inputProps={{ videoUrl: null, posterUrl: null, isImageSource: false, audioUrl: null, settings, brand: BRAND }} />)
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 960 })
  Element.prototype.getBoundingClientRect = () => ({ width: 960, height: 540, top: 0, left: 0, right: 960, bottom: 540, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('design layers in the editor', () => {
  it('draws the real design (player), not the design name label', () => {
    renderEditor([createLayer('design', { designId: 'starfield-warp' })])
    expect(screen.getByTestId('design-layer-player').getAttribute('data-design')).toBe('starfield-warp')
  })
  it('a full-frame design has no resize handle and cannot be moved by keyboard', () => {
    renderEditor([createLayer('design', { designId: 'starfield-warp' })])
    expect(screen.queryByRole('button', { name: /^Resize/ })).toBeNull()
    const mover = screen.getAllByRole('button', { name: /^Move Design/ })[0]
    fireEvent.keyDown(mover, { key: 'ArrowRight' })
    expect(update).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ x: expect.anything() }))
  })
  it('a design with no text shows no text colour or font controls', () => {
    renderEditor([createLayer('design', { designId: 'starfield-warp' })])
    expect(screen.queryByLabelText('Text color')).toBeNull()
    expect(screen.queryByLabelText('Font')).toBeNull()
  })
  it('Restore design defaults keeps the design; Remove design asks first and then removes it', () => {
    const layer = createLayer('design', { designId: 'starfield-warp', color: '#ff0000' })
    renderEditor([layer])
    act(() => { screen.getByTestId('design-restore-defaults').click() })
    expect(update).toHaveBeenCalledWith(layer.id, expect.objectContaining({ color: undefined, textSlotOverrides: undefined }))
    expect(removeDesign).not.toHaveBeenCalled()
    act(() => { screen.getByTestId('design-remove').click() })
    expect(removeDesign).not.toHaveBeenCalled() // asks first
    act(() => { screen.getByTestId('design-remove-confirm').click() })
    expect(removeDesign).toHaveBeenCalledWith(null)
  })
})

describe('timing in seconds', () => {
  it('converts seconds ⇄ frames at the project frame rate', () => {
    expect(secondsToFrames(1.5, 30)).toBe(45)
    expect(framesToSeconds(45, 30)).toBe(1.5)
    expect(secondsToFrames(2, 24)).toBe(48)
    expect(secondsToFrames(-1, 30)).toBe(0)
    expect(secondsToFrames(Number.NaN, 30)).toBe(0)
  })
  it('the timing inputs are in seconds and write frames', () => {
    const layer = createLayer('headline', { startFrame: 30 })
    renderEditor([layer])
    const input = screen.getByLabelText('Shown from seconds') as HTMLInputElement
    expect(input.value).toBe('1')
    fireEvent.change(input, { target: { value: '2.5' } })
    expect(update).toHaveBeenCalledWith(layer.id, { startFrame: 75 })
  })
})
