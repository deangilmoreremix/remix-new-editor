// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { CaptionsPanel } from '../CaptionsPanel'
import { applyCaptionsPatch } from '../../captions/captionStyle'
import { liveBridge } from '../../preview/liveBridge'
import { createDefaultPreviewSettings } from '../../preview/presets'

const engine = vi.hoisted(() => ({ isModelCached: vi.fn(), modelInfo: vi.fn(), cancelLocalAI: vi.fn(), transcribeVideo: vi.fn() }))
vi.mock('../../localAI/engine', () => engine)
const ctx: { previewSettings: { captions?: unknown; audio: unknown; fps: number; durationInFrames: number }; updatePreviewCaptions: (p: unknown) => void } = vi.hoisted(() => ({ previewSettings: { audio: null, fps: 30, durationInFrames: 150 }, updatePreviewCaptions: () => {} }))
vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: () => ctx }))
vi.mock('../../captions/capiteFontLoader', () => ({ loadCaptionFont: vi.fn(async () => ({ loaded: true })) }))

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })

const VIDEO = 'https://x/v.mp4'
type Cue = { startMs: number; endMs: number; text: string; words?: { text: string; startMs: number; endMs: number }[] }
let root: ReturnType<typeof createRoot>
let rerender: () => void
const seed = () => {
  ctx.previewSettings = {
    audio: null, fps: 30, durationInFrames: 150,
    captions: { enabled: true, forUrl: VIDEO, style: 'bold', position: 'bottom', cues: [
      { startMs: 0, endMs: 2000, text: 'hello world', words: [{ text: 'hello', startMs: 0, endMs: 1000 }, { text: 'world', startMs: 1000, endMs: 2000 }] },
      { startMs: 2000, endMs: 4000, text: 'Second HELLO line' },
    ] },
  }
}
beforeEach(() => {
  engine.modelInfo.mockResolvedValue({ key: 'whisper', label: 'x', feature: 'x', sizeMB: 40, license: 'MIT' })
  engine.isModelCached.mockResolvedValue(true)
  seed()
  ctx.updatePreviewCaptions = vi.fn((patch: unknown) => {
    ctx.previewSettings = { ...ctx.previewSettings, captions: applyCaptionsPatch(ctx.previewSettings.captions as never, patch as never) }
    rerender()
  })
})
afterEach(() => { vi.clearAllMocks(); document.body.innerHTML = ''; liveBridge.publish({ frame: null, seek: null }) })

function mount(brand?: unknown) {
  const el = document.body.appendChild(document.createElement('div'))
  root = createRoot(el)
  rerender = () => act(() => { root.render(<CaptionsPanel videoUrl={VIDEO} brand={brand as never} />) })
  rerender()
  return el
}
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`)
const click = (el: Element | null) => act(async () => { (el as HTMLElement).click() })
const type = (el: Element | null, value: string) => act(async () => {
  const input = el as HTMLInputElement
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
})
const cues = () => (ctx.previewSettings.captions as { cues: Cue[] }).cues

describe('transcript editor (remix)', () => {
  it('edits a line\'s start and end', async () => {
    const el = mount()
    await type(q(el, 'captions-start-1'), '2.5')
    expect(cues()[1]).toMatchObject({ startMs: 2500 })
    await type(q(el, 'captions-end-0'), '1.5')
    expect(cues()[0].endMs).toBe(1500)
  })
  it('nudges a start or an end by a tenth of a second, inside the video, and keeps word times that still fit', async () => {
    const el = mount()
    await click(q(el, 'captions-nudge-0-end-minus'))
    expect(cues()[0]).toMatchObject({ startMs: 0, endMs: 1900 })
    expect(cues()[0].words!.at(-1)).toMatchObject({ endMs: 1900 })
    await click(q(el, 'captions-nudge-1-start-plus'))
    expect(cues().find((c) => c.text === 'Second HELLO line')).toMatchObject({ startMs: 2100, endMs: 4000 })
    await click(q(el, 'captions-nudge-0-start-minus'))
    expect(cues()[0].startMs).toBe(0)
  })
  it('replaces text in every line (ignoring case by default), says how many, and drops word times of changed lines', async () => {
    const el = mount()
    await type(q(el, 'captions-find'), 'hello')
    await type(q(el, 'captions-replace'), 'hi')
    await click(q(el, 'captions-replace-all'))
    expect(cues().map((c) => c.text)).toEqual(['hi world', 'Second hi line'])
    expect(cues()[0].words).toBeUndefined()
    expect(q(el, 'captions-edit-notice')?.textContent).toMatch(/2 replacements/)
  })
  it('can match case and whole words, and says so when nothing matches', async () => {
    const el = mount()
    await type(q(el, 'captions-find'), 'hell')
    await click(q(el, 'captions-find-word'))
    await type(q(el, 'captions-replace'), 'X')
    await click(q(el, 'captions-replace-all'))
    expect(cues().map((c) => c.text)).toEqual(['hello world', 'Second HELLO line'])
    expect(q(el, 'captions-edit-notice')?.textContent).toMatch(/Nothing to replace/)
  })
  it('changes every line to UPPER, Title or lower case', async () => {
    const el = mount()
    await click(q(el, 'captions-case-upper'))
    expect(cues().map((c) => c.text)).toEqual(['HELLO WORLD', 'SECOND HELLO LINE'])
    await click(q(el, 'captions-case-title'))
    expect(cues().map((c) => c.text)).toEqual(['Hello World', 'Second Hello Line'])
    await click(q(el, 'captions-case-lower'))
    expect(cues().map((c) => c.text)).toEqual(['hello world', 'second hello line'])
  })
  it('jumps the live preview to a line, and marks the line that is playing', async () => {
    const el = mount()
    expect(q(el, 'captions-seek-1')).toBeNull() // no live preview yet
    const seek = vi.fn()
    await act(async () => { liveBridge.publish({ frame: 70, seek }) }) // 2.33 s
    await click(q(el, 'captions-seek-1'))
    expect(seek).toHaveBeenCalledWith(60) // 2 s at 30 fps
    expect(q(el, 'captions-line-0')?.getAttribute('data-active')).toBe('false')
    expect(q(el, 'captions-line-1')?.getAttribute('data-active')).toBe('true')
  })
})

describe('captions customizer (remix)', () => {
  const custom = () => (ctx.previewSettings.captions as { custom?: Record<string, unknown> }).custom
  const change = (el: Element | null, value: string) => act(async () => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
    el!.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  })
  it('offers Capite\'s 16 fonts, grouped, and a way back to the look\'s own', async () => {
    const el = mount()
    const select = q(el, 'captions-font') as HTMLSelectElement
    expect(select.querySelectorAll('option[value]:not([value=""])')).toHaveLength(16)
    expect(select.querySelectorAll('optgroup').length).toBeGreaterThanOrEqual(3)
    await change(select, 'Bebas Neue')
    expect(custom()).toEqual({ fontFamily: 'Bebas Neue' })
    await change(select, '')
    expect(custom()).toBeUndefined()
  })
  it('sets the weight, italic and casing, and goes back to the look\'s own', async () => {
    const el = mount()
    await click(q(el, 'captions-weight-light'))
    await click(q(el, 'captions-italic'))
    await click(q(el, 'captions-casing-title'))
    expect(custom()).toEqual({ weight: 'light', italic: true, casing: 'title' })
    await click(q(el, 'captions-weight-default'))
    await click(q(el, 'captions-italic'))
    await click(q(el, 'captions-casing-default'))
    expect(custom()).toBeUndefined()
  })
  it('sets the outline and background colours, each with a clear button', async () => {
    const el = mount()
    await change(q(el, 'captions-outline-color'), '#ff0000')
    await change(q(el, 'captions-bg-color'), '#00ff00')
    expect(custom()).toEqual({ outlineColor: '#ff0000', backgroundColor: '#00ff00' })
    await click(q(el, 'captions-outline-clear'))
    await click(q(el, 'captions-bg-clear'))
    expect(custom()).toBeUndefined()
  })
  it('moves the caption with a vertical offset slider, Reset puts it back, and a position chip does too', async () => {
    const el = mount()
    await change(q(el, 'captions-offset'), '-0.2')
    expect(custom()).toEqual({ offsetY: -0.2 })
    await click(q(el, 'captions-offset-reset'))
    expect(custom()).toBeUndefined()
    await change(q(el, 'captions-offset'), '0.2')
    await click(q(el, 'captions-position-top'))
    expect(custom()).toBeUndefined()
  })
})

describe('captions keeping clear of other text (remix)', () => {
  const brand = { businessName: 'Rascop And Associates LLC', headline: 'Call us today', offer: '10% off', cta: 'Book now' }
  const nameLayer = (y: number) => ({ ...createDefaultPreviewSettings().layers.find((l) => l.kind === 'businessName')!, visible: true, opacity: 1, startFrame: 0, endFrame: undefined, x: 0.05, y })
  const custom = () => (ctx.previewSettings.captions as { custom?: Record<string, unknown> }).custom
  const withLayer = (y: number, customStyle?: Record<string, unknown>) => {
    ctx.previewSettings = { ...ctx.previewSettings, width: 1920, height: 1080, layers: [nameLayer(y)], captions: { ...(ctx.previewSettings.captions as object), custom: customStyle } } as never
  }
  it('warns when the captions cover another layer, and is quiet when they do not', async () => {
    withLayer(0.84)
    const el = mount(brand)
    expect(q(el, 'captions-overlap-warning')?.textContent).toMatch(/cover/i)
    document.body.innerHTML = ''
    withLayer(0.1)
    expect(q(mount(brand), 'captions-overlap-warning')).toBeNull()
  })
  it('moves the captions clear with one click', async () => {
    withLayer(0.84)
    const el = mount(brand)
    await click(q(el, 'captions-clear-now'))
    expect(typeof custom()?.offsetY).toBe('number')
    expect(Math.abs(custom()!.offsetY as number)).toBeGreaterThan(0.01)
    expect(q(el, 'captions-overlap-warning')).toBeNull() // clear now
  })
  it('has a "keep clear of text" setting that is on until it is switched off', async () => {
    withLayer(0.1)
    const el = mount(brand)
    expect(q(el, 'captions-keep-clear')?.getAttribute('aria-pressed')).toBe('true')
    await click(q(el, 'captions-keep-clear'))
    expect(custom()).toEqual({ keepClear: false })
    expect(q(el, 'captions-keep-clear')?.getAttribute('aria-pressed')).toBe('false')
    await click(q(el, 'captions-keep-clear'))
    expect(custom()).toBeUndefined()
  })
  it('suggests switching it on when it is off and the captions cover something', async () => {
    withLayer(0.84, { keepClear: false })
    expect(q(mount(brand), 'captions-overlap-warning')?.textContent).toMatch(/keep clear/i)
  })
})
