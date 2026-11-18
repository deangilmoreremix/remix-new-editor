// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { CaptionsPanel } from '../CaptionsPanel'
import { applyCaptionsPatch } from '../../captions/captionStyle'
import { liveBridge } from '../../preview/liveBridge'

const engine = vi.hoisted(() => ({ isModelCached: vi.fn(), modelInfo: vi.fn(), cancelLocalAI: vi.fn(), transcribeVideo: vi.fn() }))
vi.mock('../../localAI/engine', () => engine)
const ctx: { previewSettings: { captions?: unknown; audio: unknown; fps: number; durationInFrames: number }; updatePreviewCaptions: (p: unknown) => void } = vi.hoisted(() => ({ previewSettings: { audio: null, fps: 30, durationInFrames: 150 }, updatePreviewCaptions: () => {} }))
vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: () => ctx }))

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

function mount() {
  const el = document.body.appendChild(document.createElement('div'))
  root = createRoot(el)
  rerender = () => act(() => { root.render(<CaptionsPanel videoUrl={VIDEO} />) })
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
