// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { CaptionsPanel } from '../CaptionsPanel'
import { applyCaptionsPatch } from '../../captions/captionStyle'

const engine = vi.hoisted(() => ({ isModelCached: vi.fn(), modelInfo: vi.fn(), cancelLocalAI: vi.fn(), transcribeVideo: vi.fn() }))
vi.mock('../../localAI/engine', () => engine)
// The panel keeps its captions in the provider's preview settings; a tiny stand-in with the real merge/clean rules.
const ctx: { previewSettings: { captions?: unknown; audio: unknown }; updatePreviewCaptions: (p: unknown) => void } = vi.hoisted(() => ({ previewSettings: { audio: null }, updatePreviewCaptions: () => {} }))
vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: () => ctx }))

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })
const VIDEO = 'https://x/clip.mp4'
const w = (text: string, startMs: number, endMs: number) => ({ text, startMs, endMs })
let root: ReturnType<typeof createRoot>
let rerender: () => void

beforeEach(() => {
  engine.modelInfo.mockResolvedValue({ key: 'whisper', label: 'Speech to text (Whisper tiny)', feature: 'x', sizeMB: 40, license: 'MIT' })
  engine.isModelCached.mockResolvedValue(true)
  engine.cancelLocalAI.mockResolvedValue(undefined)
  engine.transcribeVideo.mockResolvedValue({ text: 'Call us today', captions: [w('Call', 0, 300), w('us', 320, 500), w('today', 520, 900)] })
  ctx.previewSettings = { audio: null }
  ctx.updatePreviewCaptions = vi.fn((patch: unknown) => {
    const next = applyCaptionsPatch(ctx.previewSettings.captions as never, patch as never)
    ctx.previewSettings = { ...ctx.previewSettings, captions: next }
    rerender()
  })
})
afterEach(() => { vi.clearAllMocks(); document.body.innerHTML = '' })

function mount(videoUrl: string | null = VIDEO) {
  const el = document.body.appendChild(document.createElement('div'))
  root = createRoot(el)
  let url = videoUrl
  rerender = () => act(() => { root.render(<CaptionsPanel videoUrl={url} />) })
  rerender()
  return { el, setUrl: (u: string | null) => { url = u; rerender() } }
}
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`)
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 5)) })
const click = (el: Element | null) => act(async () => { (el as HTMLElement).click() })
const readBlob = (b: Blob) => new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsText(b) })
const generate = async (el: HTMLElement) => { await click(q(el, 'captions-generate')); await tick() }
const stored = () => ctx.previewSettings.captions as { enabled: boolean; style: string; position: string; forUrl: string; cues: { text: string; words?: unknown[] }[] } | undefined

describe('CaptionsPanel', () => {
  it('renders nothing without a video', () => { expect(q(mount(null).el, 'captions-panel')).toBeNull() })

  it('asks before the one-time download, then puts the captions into the video settings', async () => {
    engine.isModelCached.mockResolvedValue(false)
    const { el } = mount()
    await generate(el)
    expect(q(el, 'local-ai-notice')?.getAttribute('data-phase')).toBe('confirm')
    expect(el.textContent).toMatch(/about 40 MB/)
    expect(engine.transcribeVideo).not.toHaveBeenCalled()
    await click(q(el, 'local-ai-confirm')); await tick()
    expect(engine.transcribeVideo).toHaveBeenCalledWith(VIDEO, expect.anything())
    expect(stored()).toMatchObject({ enabled: true, forUrl: VIDEO, style: 'bold', position: 'bottom' })
    expect(stored()!.cues[0].text).toBe('Call us today')
    expect((q(el, 'captions-edit-0') as HTMLInputElement).value).toBe('Call us today')
  })

  it('lets the person switch captions off, pick a look and a place', async () => {
    const { el } = mount(); await generate(el)
    await click(q(el, 'captions-enabled'))
    expect(stored()?.enabled).toBe(false)
    await click(q(el, 'captions-style-bar'))
    await click(q(el, 'captions-position-top'))
    expect(stored()).toMatchObject({ style: 'bar', position: 'top' })
    expect(q(el, 'captions-style-bar')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('describes the looks, with Clean as a plain white text with a thin outline', async () => {
    const { el } = mount(); await generate(el)
    expect(q(el, 'captions-style-clean')?.getAttribute('title')).toBe('Plain white text with a thin dark outline')
    expect(q(el, 'captions-look-hint')?.textContent).toMatch(/Bar is the safest on very busy footage/)
  })

  it('corrects a line, and deletes a line that is cleared', async () => {
    engine.transcribeVideo.mockResolvedValue({ text: '', captions: [w('Call', 0, 300), w('us', 320, 500), w('Free', 3000, 3300), w('quote', 3320, 3600)] })
    const { el } = mount(); await generate(el)
    expect(stored()!.cues).toHaveLength(2)
    const edit = async (i: number, value: string) => {
      const input = q(el, `captions-edit-${i}`) as HTMLInputElement
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
        setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
      })
    }
    await edit(0, 'Call as today')
    expect(stored()!.cues[0].text).toBe('Call as today')
    expect(stored()!.cues[0].words).toBeUndefined() // the old word timing no longer fits the new text
    expect(stored()!.cues[1].words).toBeDefined()
    await edit(1, '   ')
    expect(stored()!.cues.map((c) => c.text)).toEqual(['Call as today'])
  })

  it('asks before replacing captions the person already has', async () => {
    const { el } = mount(); await generate(el)
    engine.transcribeVideo.mockClear()
    await click(q(el, 'captions-generate'))
    expect(q(el, 'captions-redo-confirm')).toBeTruthy()
    await click(q(el, 'captions-redo-no'))
    expect(engine.transcribeVideo).not.toHaveBeenCalled()
    await click(q(el, 'captions-generate')); await click(q(el, 'captions-redo-yes')); await tick()
    expect(engine.transcribeVideo).toHaveBeenCalledTimes(1)
  })

  it('keeps the look the person chose when the captions are written again', async () => {
    const { el } = mount(); await generate(el)
    await click(q(el, 'captions-style-clean')); await click(q(el, 'captions-position-middle'))
    await click(q(el, 'captions-generate')); await click(q(el, 'captions-redo-yes')); await tick()
    expect(stored()).toMatchObject({ style: 'clean', position: 'middle' })
  })

  it('removes the captions from the video', async () => {
    const { el } = mount(); await generate(el)
    await click(q(el, 'captions-remove'))
    expect(stored()).toBeUndefined()
    expect(q(el, 'captions-result')).toBeNull()
  })

  it('downloads SRT and VTT files from the (corrected) lines', async () => {
    const created: Blob[] = []
    URL.createObjectURL = vi.fn((b: Blob) => { created.push(b); return 'blob:x' }) as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn()
    const names: string[] = []
    const origClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) { names.push(this.download) }
    try {
      const { el } = mount(); await generate(el)
      await click(q(el, 'captions-srt')); await click(q(el, 'captions-vtt'))
      expect(names).toEqual(['captions.srt', 'captions.vtt'])
      expect(await readBlob(created[0])).toContain('00:00:00,000 -->')
      expect((await readBlob(created[1])).startsWith('WEBVTT')).toBe(true)
    } finally { HTMLAnchorElement.prototype.click = origClick }
  })

  it('copies the text, and says so plainly when the browser refuses', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true })
    const { el } = mount(); await generate(el)
    await click(q(el, 'captions-copy')); await tick()
    expect(write).toHaveBeenCalledWith('Call us today')
    expect(q(el, 'captions-copy-note')?.textContent).toBe('Copied.')
    write.mockRejectedValueOnce(new Error('denied'))
    await click(q(el, 'captions-copy')); await tick()
    expect(q(el, 'captions-copy-note')?.textContent).toMatch(/would not copy/)
  })

  it('says so when there is no speech, and when the sound cannot be read, and sets nothing', async () => {
    engine.transcribeVideo.mockResolvedValueOnce({ text: '', captions: [] })
    const { el } = mount(); await generate(el)
    expect(q(el, 'captions-note')?.textContent).toMatch(/No speech was found/)
    expect(stored()).toBeUndefined()
    engine.transcribeVideo.mockRejectedValueOnce(new Error('This clip has no audio track that the browser can decode'))
    await generate(el)
    expect(q(el, 'local-ai-error')?.textContent).toMatch(/no audio track/)
    expect(stored()).toBeUndefined()
  })

  it('drops captions made for a video the person has since left', async () => {
    let finish!: (v: unknown) => void
    engine.transcribeVideo.mockReturnValueOnce(new Promise((r) => { finish = r }))
    const { el, setUrl } = mount('https://x/a.mp4')
    await generate(el)
    setUrl('https://x/b.mp4')
    await act(async () => { finish({ text: 'old', captions: [w('old', 0, 400)] }) }); await tick()
    expect(stored()).toBeUndefined()
  })

  it('never shows captions written for a different video', async () => {
    const { el, setUrl } = mount(); await generate(el)
    expect(q(el, 'captions-result')).toBeTruthy()
    setUrl('https://x/other.mp4')
    expect(q(el, 'captions-result')).toBeNull()
  })

  it('warns when a different sound track is chosen', async () => {
    ctx.previewSettings = { audio: { url: 'https://x/song.mp3', name: 'song' } }
    const { el } = mount(); await generate(el)
    expect(q(el, 'captions-notes')?.textContent).toMatch(/different sound track/)
  })

  it('offers all 27 Capite looks in a grouped picker and applies the chosen one', async () => {
    const { el } = mount(); await generate(el)
    const select = q(el, 'captions-capite-select') as HTMLSelectElement
    expect(select.querySelectorAll('option[value]:not([value=""])')).toHaveLength(27)
    expect(select.querySelectorAll('optgroup')).toHaveLength(4)
    expect(q(el, 'captions-capite-hint')).toBeNull()
    await act(async () => { select.value = 'hormozi'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(stored()?.style).toBe('hormozi')
    expect(q(el, 'captions-capite-hint')?.textContent).toMatch(/Bold cyan highlights/)
    await click(q(el, 'captions-style-bar'))
    expect(stored()?.style).toBe('bar')
    expect((q(el, 'captions-capite-select') as HTMLSelectElement).value).toBe('')
  })
})
