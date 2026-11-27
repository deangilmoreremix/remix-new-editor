// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createDefaultPreviewSettings } from '../../preview/presets'
import { normalizeCaptions, type CaptionSettings } from '../../preview/captions'

const state: { settings: Record<string, unknown> } = { settings: {} }
const updatePreviewComposition = vi.fn((patch: { captions?: unknown }) => { if ('captions' in patch) state.settings = { ...state.settings, captions: patch.captions } })
vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: () => ({ previewSettings: state.settings, updatePreviewComposition }) }))
const studio = vi.hoisted(() => ({ open: vi.fn() }))
vi.mock('../../../../../../lib/captionStudio/modal.js', () => ({ openCaptionStudio: (o: unknown) => studio.open(o) }))
// What the Studio's studioPayload() would return for the captions it hands back.
vi.mock('../../../../../../lib/captionStudio/studioData.js', () => ({
  studioPayload: (captions: { text: string; startMs: number; endMs: number }[], style: Record<string, unknown>) => ({
    pages: [{ startMs: captions[0].startMs, durationMs: 1200, tokens: captions.map((c) => ({ text: c.text, fromMs: c.startMs, toMs: c.endMs })) }],
    style: { ...style, animation: 'highlight' },
  }),
}))

import { CaptionsPanel } from '../CaptionsPanel'

afterEach(() => { cleanup(); vi.clearAllMocks() })

const brandColors = { primary: '#112233', accent: '#ddeeff', text: '#ffffff', backgroundDim: 0.18 }
const VIDEO = 'https://x/clip.mp4'
const BRAND = { businessName: 'Rascop And Associates LLC', headline: 'Call us today', offer: '10% off', cta: 'Book now' }
const input = (over: Record<string, unknown> = {}) => ({ videoUrl: VIDEO, posterUrl: null, isImageSource: false, brand: BRAND, ...over })
const tok = (text: string, i: number) => ({ text: (i ? ' ' : '') + text, fromMs: i * 400, toMs: i * 400 + 400 })
const withStudio = (style: Record<string, unknown> = {}): CaptionSettings => normalizeCaptions({
  enabled: true, cues: [{ id: 'c1', start: 0, end: 1.6, text: 'hello brave new world' }], style: {},
  studio: { pages: [{ startMs: 0, durationMs: 1600, tokens: ['hello', 'brave', 'new', 'world'].map(tok) }], style: { fontFamily: 'Anton', fontSize: 6, position: 'bottom', ...style } },
})!
function open(inputProps: Record<string, unknown>, captions?: CaptionSettings, layers: object[] = []) {
  state.settings = { durationInFrames: 150, fps: 30, width: 1920, height: 1080, brandColors, captions, layers }
  render(<CaptionsPanel inputProps={inputProps as never} />)
}
const request = () => studio.open.mock.calls.at(-1)![0] as {
  videoUrl: string; captions: { text: string; startMs: number; endMs: number }[]; style: Record<string, unknown>; fonts?: string[]; applyLabel: string
  onApply: (r: unknown) => void; onError: (e: Error) => void
}
const nameLayerAt = (y: number) => ({ ...createDefaultPreviewSettings().layers.find((l) => l.kind === 'businessName')!, visible: true, opacity: 1, startFrame: 0, endFrame: undefined, x: 0.05, y })

describe('CaptionsPanel: the Caption Studio is the one place to make captions', () => {
  it('is one button: no second generator, look picker or line editor', () => {
    open(input())
    expect(screen.getByTestId('captions-open-studio').textContent).toContain('Open Caption Studio')
    expect(screen.queryByTestId('captions-script')).toBeNull()
    expect(screen.queryByTestId('captions-toggle-panel')).toBeNull()
    expect(document.querySelector('[data-testid^="captions-style-"]')).toBeNull()
  })
  it('opens the studio on this video with every embedded font allowed', async () => {
    open(input())
    fireEvent.click(screen.getByTestId('captions-open-studio'))
    await waitFor(() => expect(studio.open).toHaveBeenCalledTimes(1))
    const r = request()
    expect(r.videoUrl).toBe(VIDEO)
    expect(r.fonts).toBeUndefined()
    expect(r.captions).toEqual([]) // nothing yet: the studio transcribes
  })
  it('stores what the studio returns: the studio pages and full style, plus lines for the list and the downloads', async () => {
    open(input())
    fireEvent.click(screen.getByTestId('captions-open-studio'))
    await waitFor(() => expect(studio.open).toHaveBeenCalled())
    act(() => { request().onApply({ captions: [{ text: 'Call', startMs: 0, endMs: 400 }, { text: ' us', startMs: 500, endMs: 900 }], captionStyle: { preset: 'capite-hormozi', fontFamily: 'Anton', weight: 'light', fontSize: 7, position: 'top', positionY: 0.3, highlightColor: '#00ffff' } }) })
    await waitFor(() => expect(updatePreviewComposition).toHaveBeenCalled())
    const c = updatePreviewComposition.mock.calls.at(-1)![0].captions as CaptionSettings
    expect(c.enabled).toBe(true)
    expect(c.cues[0]).toMatchObject({ text: 'Call us', start: 0 })
    expect(c.studio?.style).toMatchObject({ fontFamily: 'Anton', weight: 'light', positionY: 0.3, highlightColor: '#00ffff' })
    expect(c.studio?.pages[0].tokens.map((t) => t.text.trim())).toEqual(['Call', 'us'])
  })
  it('reopens on the studio captions, word by word, in their own style', async () => {
    open(input(), withStudio({ weight: 'bold' }))
    expect(screen.getByTestId('captions-open-studio').textContent).toContain('Edit in the Caption Studio')
    fireEvent.click(screen.getByTestId('captions-open-studio'))
    await waitFor(() => expect(studio.open).toHaveBeenCalled())
    const r = request()
    expect(r.captions.map((c) => c.text.trim())).toEqual(['hello', 'brave', 'new', 'world'])
    expect(r.style).toMatchObject({ fontFamily: 'Anton', weight: 'bold' })
  })
  it('needs a video: the button is off without one, and for image sources', () => {
    open(input({ videoUrl: null }))
    expect((screen.getByTestId('captions-open-studio') as HTMLButtonElement).disabled).toBe(true)
    cleanup()
    open(input({ isImageSource: true }))
    expect((screen.getByTestId('captions-open-studio') as HTMLButtonElement).disabled).toBe(true)
  })
  it('says so, and changes nothing, when the studio returns no words or fails to open', async () => {
    open(input(), withStudio())
    fireEvent.click(screen.getByTestId('captions-open-studio'))
    await waitFor(() => expect(studio.open).toHaveBeenCalled())
    act(() => { request().onApply({ captions: [{ text: '  ', startMs: 0, endMs: 100 }], captionStyle: {} }) })
    await waitFor(() => expect(screen.getByTestId('captions-notice').textContent).toMatch(/nothing was changed/))
    expect(updatePreviewComposition).not.toHaveBeenCalled()
    act(() => { request().onError(new Error('no model')) })
    await waitFor(() => expect(screen.getByTestId('captions-notice').textContent).toContain('no model'))
  })
})

describe('CaptionsPanel: what is made', () => {
  it('can be switched off and on, and removed', () => {
    open(input(), withStudio())
    fireEvent.click(screen.getByTestId('captions-enabled'))
    expect((updatePreviewComposition.mock.calls.at(-1)![0].captions as CaptionSettings).enabled).toBe(false)
    fireEvent.click(screen.getByTestId('captions-remove'))
    expect(updatePreviewComposition.mock.calls.at(-1)![0]).toEqual({ captions: undefined })
  })
  it('offers the downloads', () => {
    open(input(), withStudio())
    for (const id of ['captions-srt', 'captions-vtt', 'captions-txt', 'captions-ass', 'captions-copy']) expect(screen.getByTestId(id)).not.toBeNull()
  })
})

describe('CaptionsPanel: keeping the Studio captions off other text', () => {
  it('warns when the captions cover a layer, and moves them clear in one click', () => {
    open(input(), withStudio({ positionY: 0.84 }), [nameLayerAt(0.84)])
    expect(screen.getByTestId('captions-overlap').textContent).toMatch(/cover/i)
    fireEvent.click(screen.getByTestId('captions-clear-now'))
    const y = (updatePreviewComposition.mock.calls.at(-1)![0].captions as CaptionSettings).studio!.style.positionY!
    expect(y).toBeLessThan(0.84)
  })
  it('says nothing when they are clear', () => {
    open(input(), withStudio({ positionY: 0.84 }), [nameLayerAt(0.1)])
    expect(screen.queryByTestId('captions-overlap')).toBeNull()
    expect(screen.queryByTestId('captions-clear-now')).toBeNull()
  })
})
