// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { CaptionsPanel } from '../CaptionsPanel'

const engine = vi.hoisted(() => ({ isModelCached: vi.fn(), modelInfo: vi.fn(), cancelLocalAI: vi.fn(), transcribeVideo: vi.fn() }))
vi.mock('../../localAI/engine', () => engine)

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })
const w = (text: string, startMs: number, endMs: number) => ({ text, startMs, endMs })
beforeEach(() => {
  engine.modelInfo.mockResolvedValue({ key: 'whisper', label: 'Speech to text (Whisper tiny)', feature: 'x', sizeMB: 40, license: 'MIT' })
  engine.isModelCached.mockResolvedValue(true)
  engine.cancelLocalAI.mockResolvedValue(undefined)
  engine.transcribeVideo.mockResolvedValue({ text: 'Call us today', captions: [w('Call', 0, 300), w('us', 320, 500), w('today', 520, 900)] })
})
afterEach(() => { vi.clearAllMocks(); document.body.innerHTML = '' })

function mount(videoUrl: string | null = 'https://x/clip.mp4') {
  const el = document.body.appendChild(document.createElement('div'))
  const root = createRoot(el)
  act(() => { root.render(<CaptionsPanel videoUrl={videoUrl} />) })
  return { el, root }
}
const readBlob = (b: Blob) => new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsText(b) })
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 5)) })
const click = (el: Element | null) => act(async () => { (el as HTMLElement).click() })

describe('CaptionsPanel', () => {
  it('renders nothing without a video', () => { expect(mount(null).el.querySelector('[data-testid="captions-panel"]')).toBeNull() })

  it('asks before the one-time download, then lists the captions', async () => {
    engine.isModelCached.mockResolvedValue(false)
    const { el } = mount()
    await click(el.querySelector('[data-testid="captions-generate"]')); await tick()
    expect(el.querySelector('[data-testid="local-ai-notice"]')?.getAttribute('data-phase')).toBe('confirm')
    expect(el.textContent).toMatch(/about 40 MB/)
    expect(engine.transcribeVideo).not.toHaveBeenCalled()
    await click(el.querySelector('[data-testid="local-ai-confirm"]')); await tick()
    expect(engine.transcribeVideo).toHaveBeenCalledWith('https://x/clip.mp4', expect.anything())
    expect(el.querySelector('[data-testid="captions-list"]')!.textContent).toContain('Call us today')
  })

  it('downloads SRT and VTT files', async () => {
    const created: Blob[] = []
    URL.createObjectURL = vi.fn((b: Blob) => { created.push(b); return 'blob:x' }) as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn()
    const names: string[] = []
    const origClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) { names.push(this.download) }
    try {
      const { el } = mount()
      await click(el.querySelector('[data-testid="captions-generate"]')); await tick()
      await click(el.querySelector('[data-testid="captions-srt"]'))
      await click(el.querySelector('[data-testid="captions-vtt"]'))
      expect(names).toEqual(['captions.srt', 'captions.vtt'])
      expect(await readBlob(created[0])).toContain('00:00:00,000 -->')
      expect((await readBlob(created[1])).startsWith('WEBVTT')).toBe(true)
    } finally { HTMLAnchorElement.prototype.click = origClick }
  })

  it('copies the text, and says so plainly when the browser refuses', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true })
    const { el } = mount()
    await click(el.querySelector('[data-testid="captions-generate"]')); await tick()
    await click(el.querySelector('[data-testid="captions-copy"]')); await tick()
    expect(write).toHaveBeenCalledWith('Call us today')
    expect(el.querySelector('[data-testid="captions-copy-note"]')?.textContent).toBe('Copied.')
    write.mockRejectedValueOnce(new Error('denied'))
    await click(el.querySelector('[data-testid="captions-copy"]')); await tick()
    expect(el.querySelector('[data-testid="captions-copy-note"]')?.textContent).toMatch(/would not copy/)
  })

  it('says so when there is no speech, and when the sound cannot be read', async () => {
    engine.transcribeVideo.mockResolvedValueOnce({ text: '', captions: [] })
    const { el } = mount()
    await click(el.querySelector('[data-testid="captions-generate"]')); await tick()
    expect(el.querySelector('[data-testid="captions-note"]')?.textContent).toMatch(/No speech was found/)
    expect(el.querySelector('[data-testid="captions-list"]')).toBeNull()
    engine.transcribeVideo.mockRejectedValueOnce(new Error('This clip has no audio track that the browser can decode'))
    await click(el.querySelector('[data-testid="captions-generate"]')); await tick()
    expect(el.querySelector('[data-testid="local-ai-error"]')?.textContent).toMatch(/no audio track/)
  })

  it('drops captions made for a video the person has since left', async () => {
    let finish!: (v: unknown) => void
    engine.transcribeVideo.mockReturnValueOnce(new Promise((r) => { finish = r }))
    const { el, root } = mount('https://x/a.mp4')
    await click(el.querySelector('[data-testid="captions-generate"]')); await tick()
    act(() => { root.render(<CaptionsPanel videoUrl="https://x/b.mp4" />) })
    await act(async () => { finish({ text: 'old', captions: [w('old', 0, 400)] }) }); await tick()
    expect(el.querySelector('[data-testid="captions-list"]')).toBeNull()
  })
})
