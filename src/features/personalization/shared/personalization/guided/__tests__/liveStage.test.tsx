// @vitest-environment jsdom
/**
 * The editor's live stage: the real Player draws the video and the layer boxes are a transparent interaction layer
 * above it. jsdom cannot play video, so the Player is a stub that exposes a fake PlayerRef; these tests cover what the
 * EDITOR does around it (what it mounts, what it hides, pausing on grab, the transport and the Live toggle).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { useDemoPersonalize } from '../../DemoPersonalizeProvider'
import { OverlayEditor } from '../OverlayEditor'
import { createDefaultPreviewSettings, createLayer } from '../../preview/presets'
import type { PreviewInputProps, PreviewLayer } from '../../preview/types'

vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: vi.fn() }))

const player = { pause: vi.fn(), play: vi.fn(), seekTo: vi.fn(), isPlaying: vi.fn(() => false) }
let playerProps: Record<string, unknown> | null = null
vi.mock('../../preview/PersonalizationPlayer', async () => {
  const React = await import('react')
  return {
    PersonalizationPlayer: (props: { playerRefOverride?: { current: unknown }; onFrameChange?: (f: number) => void; onPlayingChange?: (p: boolean) => void }) => {
      playerProps = props as unknown as Record<string, unknown>
      if (props.playerRefOverride) props.playerRefOverride.current = player
      return React.createElement('div', { 'data-testid': 'stub-player' })
    },
  }
})

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 960 })
  Element.prototype.getBoundingClientRect = function () {
    return { width: 960, height: 540, top: 0, left: 0, right: 960, bottom: 540, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
  }
})
beforeEach(() => { vi.mocked(useDemoPersonalize).mockReset(); Object.values(player).forEach((f) => f.mockClear()); playerProps = null })
afterEach(() => { cleanup() })

const BRAND = { businessName: 'Acme Roofing', headline: 'Roofs that last', offer: '10% off', cta: 'Book now', phone: '555', website: 'acme.test', logoUrl: 'https://cdn.example.com/logo.png', productUrl: 'https://cdn.example.com/product.png', serviceUrl: null }

function setup(layers: PreviewLayer[], liveStage: boolean | undefined, over: Partial<PreviewInputProps> = {}) {
  const updatePreviewLayer = vi.fn()
  const settings = { ...createDefaultPreviewSettings(), layers }
  vi.mocked(useDemoPersonalize).mockReturnValue({
    previewSettings: settings, updatePreviewLayer, updatePreviewComposition: vi.fn(), resetPreviewLayout: vi.fn(), assets: {},
  } as unknown as ReturnType<typeof useDemoPersonalize>)
  render(createElement(OverlayEditor, { inputProps: { videoUrl: '/v.webm', posterUrl: '/p.png', isImageSource: false, audioUrl: null, settings, brand: BRAND, ...over }, liveStage }))
  return { updatePreviewLayer }
}

const layers = () => [createLayer('logo', { x: 0.2, y: 0.2 }), createLayer('headline', { x: 0.6, y: 0.6 })]

describe('OverlayEditor live stage', () => {
  it('is off by default: the still poster is shown and no Player is mounted', () => {
    setup(layers(), undefined)
    expect(screen.queryByTestId('stub-player')).toBeNull()
    expect(screen.queryByTestId('editor-transport')).toBeNull()
    expect(document.querySelector('img[src="/p.png"]')).toBeTruthy()
  })

  it('when on, mounts the Player with the editor input, hides the transport bar, and shields it from clicks', () => {
    setup(layers(), true)
    expect(screen.getByTestId('stub-player')).toBeTruthy()
    expect(screen.getByTestId('editor-live-shield')).toBeTruthy()
    expect(playerProps!.hideTransport).toBe(true)
    expect((playerProps!.inputProps as PreviewInputProps).videoUrl).toBe('/v.webm')
    expect(document.querySelector('img[src="/p.png"]')).toBeNull() // the poster is replaced
  })

  it('draws nothing itself for layers the Player draws, but keeps a hit box per layer', () => {
    setup(layers(), true)
    expect(screen.getByRole('button', { name: 'Move Logo' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Move Headline' })).toBeTruthy()
    // no editor-drawn logo image, scrim or rule: the composition draws those
    expect(screen.getByRole('button', { name: 'Move Logo' }).querySelector('img')).toBeNull()
    expect(screen.queryByTestId('stage-text-scrim')).toBeNull()
    expect(screen.queryByTestId('stage-headline-rule')).toBeNull()
  })

  it('keeps the text hidden but present, so the hit box still fits it', () => {
    setup(layers(), true)
    const box = screen.getByRole('button', { name: 'Move Headline' })
    const hidden = box.querySelector('[aria-hidden]') as HTMLElement
    expect(hidden.style.visibility).toBe('hidden')
    expect(hidden.textContent).toContain('Roofs that last')
  })

  it('pauses playback when a layer is grabbed, and still moves the layer', () => {
    const { updatePreviewLayer } = setup(layers(), true)
    act(() => { fireEvent.pointerDown(screen.getByRole('button', { name: 'Move Logo' }), { clientX: 200, clientY: 100, pointerId: 1 }) })
    expect(player.pause).toHaveBeenCalled()
    act(() => { fireEvent.pointerMove(window, { clientX: 260, clientY: 100, pointerId: 1 }) })
    expect(updatePreviewLayer).toHaveBeenCalled()
  })

  it('the transport plays, pauses, scrubs and shows the time from the Player', () => {
    setup(layers(), true)
    act(() => { fireEvent.click(screen.getByTestId('editor-play')) })
    expect(player.play).toHaveBeenCalledTimes(1)
    player.isPlaying.mockReturnValue(true)
    act(() => { fireEvent.click(screen.getByTestId('editor-play')) })
    expect(player.pause).toHaveBeenCalled()
    act(() => { fireEvent.change(screen.getByTestId('editor-scrubber'), { target: { value: '45' } }) })
    expect(player.seekTo).toHaveBeenLastCalledWith(45)
    act(() => { (playerProps!.onFrameChange as (f: number) => void)(60) })
    expect(screen.getByTestId('editor-timecode').textContent).toMatch(/^2\.0 \//)
    act(() => { (playerProps!.onPlayingChange as (p: boolean) => void)(true) })
    expect(screen.getByTestId('editor-play').getAttribute('aria-label')).toBe('Pause preview')
  })

  it('the Live toggle switches to the still poster and back', () => {
    setup(layers(), true)
    const toggle = screen.getByTestId('editor-live-toggle')
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    act(() => { fireEvent.click(toggle) })
    expect(screen.queryByTestId('stub-player')).toBeNull()
    expect(screen.queryByTestId('editor-play')).toBeNull()
    expect(document.querySelector('img[src="/p.png"]')).toBeTruthy()
    expect(screen.getByTestId('editor-live-toggle').getAttribute('aria-pressed')).toBe('false')
    act(() => { fireEvent.click(screen.getByTestId('editor-live-toggle')) })
    expect(screen.getByTestId('stub-player')).toBeTruthy()
  })

  it('shows a playhead on the timeline at the current frame and seeks when the ruler is clicked', () => {
    setup(layers(), true)
    act(() => { (playerProps!.onFrameChange as (f: number) => void)(75) })
    expect(screen.getAllByTestId('timeline-playhead').length).toBeGreaterThan(0)
    act(() => { fireEvent.pointerDown(screen.getByTestId('timeline-ruler'), { clientX: 480, clientY: 5 }) })
    expect(player.seekTo).toHaveBeenCalledTimes(1)
    const f = player.seekTo.mock.calls[0][0] as number
    expect(f).toBeGreaterThan(60)
    expect(f).toBeLessThan(90) // the middle of a 150-frame video
  })

  it('has no playhead when the stage is not live', () => {
    setup(layers(), undefined)
    expect(screen.queryByTestId('timeline-playhead')).toBeNull()
  })
})
