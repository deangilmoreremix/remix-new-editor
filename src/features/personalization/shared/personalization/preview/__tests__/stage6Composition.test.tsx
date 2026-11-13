// @vitest-environment jsdom
/**
 * Stage 6 — what the shared composition draws for captions: the right words at the right moments, none in pauses, word
 * highlight colours, position, case, size relative to the frame, and nothing at all when captions are off or absent.
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PersonalizationComposition } from '../PersonalizationComposition'
import { createDefaultPreviewSettings } from '../presets'
import { defaultCaptionStyle, normalizeCaptionTrack } from '../captions'
import type { PreviewInputProps } from '../types'

let FRAME = 0
vi.mock('@remotion/media', () => ({ Video: () => <div data-testid="media-video" />, Audio: () => null }))
vi.mock('remotion', async () => ({
  AbsoluteFill: ({ children, style, ...rest }: { children?: React.ReactNode; style?: React.CSSProperties }) => <div style={style} {...rest}>{children}</div>,
  Img: ({ src }: { src: string }) => <img src={src} alt="" />,
  Sequence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Internals: { SequenceManager: { Provider: ({ children }: { children?: React.ReactNode }) => <>{children}</> } },
  useCurrentFrame: () => FRAME,
  useVideoConfig: () => ({ width: 1280, height: 720, fps: 30, durationInFrames: 300 }),
  interpolate: (_i: number, _r: number[], o: number[]) => o[o.length - 1] ?? 1,
  spring: () => 1,
  Easing: { out: () => (t: number) => t, in: () => (t: number) => t, inOut: () => (t: number) => t, bezier: () => (t: number) => t, back: () => (t: number) => t, cubic: (t: number) => t, quad: (t: number) => t, ease: (t: number) => t, linear: (t: number) => t },
}))

const props = (captions: unknown, w = 1280, h = 720): PreviewInputProps => ({
  videoUrl: 'https://cdn.example.com/v.mp4', posterUrl: null, isImageSource: false, audioUrl: null,
  settings: { ...createDefaultPreviewSettings(), layers: [], showEndCard: false, fps: 30, durationInFrames: 300, width: w, height: h, ...(captions ? { captions: normalizeCaptionTrack(captions) } : {}) } as never,
  brand: { businessName: 'Acme', headline: 'H', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null },
})
const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = []
function mount(p: PreviewInputProps) { const container = document.createElement('div'); document.body.appendChild(container); const root = createRoot(container); mounted.push({ root, container }); act(() => root.render(<PersonalizationComposition {...p} />)); return container }
afterEach(() => { for (const { root, container } of mounted.splice(0)) { act(() => root.unmount()); container.remove() } FRAME = 0 })
const cap = (c: HTMLElement) => c.querySelector('[data-captions]') as HTMLElement | null
const frameAtMs = (ms: number) => Math.round((ms / 1000) * 30)
const words = [{ text: 'Welcome', startMs: 1000, endMs: 1500 }, { text: 'to', startMs: 1500, endMs: 1800 }, { text: 'Acme', startMs: 1800, endMs: 2400 }, { text: 'Roofing', startMs: 5000, endMs: 5600 }]

describe('captions in the composition', () => {
  it('nothing without captions, with captions off, or with no cues', () => {
    expect(cap(mount(props(null)))).toBeNull(); FRAME = 40
    expect(cap(mount(props({ enabled: false, cues: words })))).toBeNull(); expect(cap(mount(props({ cues: [] })))).toBeNull()
  })
  it('the words appear at their time and not in the pause', () => {
    const at = (ms: number) => { FRAME = frameAtMs(ms); return cap(mount(props({ cues: words, style: { preset: 'minimal' } }))) }
    expect(at(500)).toBeNull(); expect(at(1200)!.textContent).toBe('Welcome to Acme'); expect(at(3500)).toBeNull(); expect(at(5200)!.textContent).toBe('Roofing'); expect(at(9000)).toBeNull()
  })
  it('word highlight: only the spoken word is in the highlight colour (active mode)', () => {
    FRAME = frameAtMs(1600); const spans = [...cap(mount(props({ cues: words, style: { preset: 'tiktok', color: '#ffffff', highlightColor: '#ffe14d' } })))!.querySelectorAll('[data-caption-word]')] as HTMLElement[]
    expect(spans.map((s) => s.textContent)).toEqual(['WELCOME', ' TO', ' ACME']); expect(spans.map((s) => s.style.color)).toEqual(['rgb(255, 255, 255)', 'rgb(255, 225, 77)', 'rgb(255, 255, 255)'])
  })
  it('karaoke mode fills words as they are spoken', () => {
    FRAME = frameAtMs(1600); const spans = [...cap(mount(props({ cues: words, style: { preset: 'karaoke', color: '#222222', highlightColor: '#ffffff', uppercase: false } })))!.querySelectorAll('[data-caption-word]')] as HTMLElement[]
    expect(spans.map((s) => s.style.color)).toEqual(['rgb(255, 255, 255)', 'rgb(255, 255, 255)', 'rgb(34, 34, 34)'])
  })
  it('position and case', () => {
    FRAME = frameAtMs(1200)
    for (const position of ['top', 'middle', 'bottom'] as const) expect(cap(mount(props({ cues: words, style: { position } })))!.dataset.captionPosition).toBe(position)
    expect(cap(mount(props({ cues: words, style: { position: 'top' } })))!.style.top).not.toBe(''); expect(cap(mount(props({ cues: words, style: { position: 'bottom' } })))!.style.bottom).not.toBe('')
    expect(cap(mount(props({ cues: words, style: { uppercase: false } })))!.textContent).toBe('Welcome to Acme'); expect(cap(mount(props({ cues: words, style: { uppercase: true } })))!.textContent).toBe('WELCOME TO ACME')
  })
  it('size follows the frame height (same look at any export size)', () => {
    FRAME = frameAtMs(1200); const size = (w: number, h: number) => parseFloat((cap(mount(props({ cues: words, style: { fontSize: 6 } }, w, h)))!.firstElementChild as HTMLElement).style.fontSize)
    expect(size(1920, 1080) / size(640, 360)).toBeCloseTo(3, 1)
  })
  it('the text is drawn as text (markup in a subtitle is not interpreted)', () => {
    FRAME = frameAtMs(500); const c = mount(props({ cues: [{ text: '<img src=x onerror=alert(1)> hello', startMs: 0, endMs: 3000 }], style: { uppercase: false } }))
    expect(c.querySelector('img[src="x"]')).toBeNull(); expect(cap(c)!.textContent).toContain('<img src=x')
  })
  it('the outline is a ring of text-shadows and never a text-stroke (a stroke eats thin white text)', () => {
    FRAME = frameAtMs(1200); const el = cap(mount(props({ cues: words, style: { preset: 'tiktok', stroke: true } })))!.firstElementChild as HTMLElement
    expect(el.style.textShadow.match(/#000|rgb\(0, 0, 0\)/g)!.length).toBeGreaterThanOrEqual(8); expect(el.style.getPropertyValue('-webkit-text-stroke')).toBe('')
    expect((cap(mount(props({ cues: words, style: { preset: 'tiktok', stroke: false } })))!.firstElementChild as HTMLElement).style.textShadow).not.toMatch(/0px 0 #000/)
  })
  it('background style draws a box; defaults exist for every preset', () => {
    FRAME = frameAtMs(1200); expect((cap(mount(props({ cues: words, style: { preset: 'classic' } })))!.firstElementChild as HTMLElement).style.background).not.toBe('')
    for (const preset of ['tiktok', 'classic', 'box', 'karaoke', 'minimal']) expect(cap(mount(props({ cues: words, style: defaultCaptionStyle(preset) })))).not.toBeNull()
  })
})
