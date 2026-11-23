// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { CaptionsPanel } from '../CaptionsPanel'
import { applyCaptionsPatch } from '../../captions/captionStyle'
import { registerCaptionStudio, type CaptionStudioRequest } from '../../captions/captionStudioBridge'

const engine = vi.hoisted(() => ({ isModelCached: vi.fn(), modelInfo: vi.fn(), cancelLocalAI: vi.fn(), transcribeVideo: vi.fn() }))
vi.mock('../../localAI/engine', () => engine)
const ctx: { previewSettings: { captions?: unknown; audio: unknown }; updatePreviewCaptions: (p: unknown) => void } = vi.hoisted(() => ({ previewSettings: { audio: null }, updatePreviewCaptions: () => {} }))
vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: () => ctx }))

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })
const VIDEO = 'https://x/clip.mp4'
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
let rerender: () => void
let setUrl: (u: string) => void
let requests: CaptionStudioRequest[]

beforeEach(() => {
  engine.modelInfo.mockResolvedValue({ key: 'whisper', label: 'Whisper', feature: 'x', sizeMB: 40, license: 'MIT' })
  engine.isModelCached.mockResolvedValue(true)
  engine.cancelLocalAI.mockResolvedValue(undefined)
  ctx.previewSettings = { audio: null }
  ctx.updatePreviewCaptions = vi.fn((patch: unknown) => {
    ctx.previewSettings = { ...ctx.previewSettings, captions: applyCaptionsPatch(ctx.previewSettings.captions as never, patch as never) }
    rerender()
  })
  requests = []
  registerCaptionStudio((r) => { requests.push(r) })
  const el = document.body.appendChild(document.createElement('div'))
  const root = createRoot(el)
  let url = VIDEO
  rerender = () => act(() => { root.render(<CaptionsPanel videoUrl={url} />) })
  setUrl = (u) => { url = u; rerender() }
  rerender()
})
afterEach(() => { registerCaptionStudio(null); vi.clearAllMocks(); document.body.innerHTML = '' })

const tok = (text: string, i: number) => ({ text: (i ? ' ' : '') + text, fromMs: i * 400, toMs: i * 400 + 400 })
const payload = (font = 'Inter') => ({ pages: [{ startMs: 0, durationMs: 1600, tokens: ['Call', 'us', 'today'].map(tok) }], style: { fontFamily: font, fontSize: 7, position: 'top', positionY: 0.25, highlightColor: '#00ffff', animation: 'pop', preset: 'capite-hormozi' } })

describe('captions panel with the Caption Studio available', () => {
  it('is one button: no second generator, look picker or line editor', () => {
    expect(q('captions-open-studio')?.textContent).toContain('Open Caption Studio')
    expect(q('captions-generate')).toBeNull()
    expect(q('captions-capite-select')).toBeNull()
    expect(document.querySelector('[data-testid^="captions-style-"]')).toBeNull()
    expect(engine.transcribeVideo).not.toHaveBeenCalled()
  })
  it('opens the studio on this video, with every embedded font allowed', () => {
    act(() => { q('captions-open-studio')!.click() })
    expect(requests).toHaveLength(1)
    expect(requests[0].videoUrl).toBe(VIDEO)
    expect(requests[0].fonts).toBeUndefined() // no restriction: every font is embedded
  })
  it('stores what the studio returns: pages, full style, and the cues for the list and SRT', () => {
    act(() => { q('captions-open-studio')!.click() })
    act(() => { requests[0].onApply(payload()) })
    const c = ctx.previewSettings.captions as { enabled: boolean; forUrl: string; studio: { style: { fontFamily: string; positionY: number; highlightColor: string } }; cues: { text: string }[]; style: string; position: string }
    expect(c).toMatchObject({ enabled: true, forUrl: VIDEO, style: 'hormozi', position: 'top' })
    expect(c.studio.style).toMatchObject({ fontFamily: 'Inter', positionY: 0.25, highlightColor: '#00ffff' })
    expect(c.cues.map((x) => x.text)).toEqual(['Call us today'])
    expect(q('captions-summary')?.textContent).toContain('designed in the Caption Studio')
    expect(q('captions-open-studio')?.textContent).toContain('Edit in Caption Studio')
    expect(q('captions-srt')).not.toBeNull()
  })
  it('carries the studio captions back in when reopened', () => {
    act(() => { q('captions-open-studio')!.click() })
    act(() => { requests[0].onApply(payload()) })
    act(() => { q('captions-open-studio')!.click() })
    expect(requests[1].words?.map((w) => w.text)).toEqual(['Call', 'us', 'today'])
    expect(requests[1].style).toMatchObject({ fontFamily: 'Inter', preset: 'capite-hormozi' })
  })
  it('ignores a result for a video that is no longer the current one', () => {
    act(() => { q('captions-open-studio')!.click() })
    setUrl('https://x/other.mp4') // the person switched video while the studio was open
    act(() => { requests[0].onApply(payload()) })
    expect(ctx.previewSettings.captions).toBeUndefined()
    expect(q('captions-note')?.textContent).toContain('video changed')
  })
})
