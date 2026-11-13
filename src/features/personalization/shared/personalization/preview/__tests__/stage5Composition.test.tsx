// @vitest-environment jsdom
/**
 * Stage 5 — what the shared composition draws for footage effects and text effects: the colour filter and camera
 * transform on the footage (and the presenter picture), the overlays, the fade cover, text shadow / glow / outline,
 * exits and the new entrance animations — and that nothing changes when no effect is set.
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PersonalizationComposition } from '../PersonalizationComposition'
import { createDefaultPreviewSettings } from '../presets'
import { defaultPresenter } from '../presenter'
import { clearMatteRegistry, registerMatteUrl } from '../presenterMatteRegistry'
import { IDENTITY_LOOK } from '../videoEffects'
import type { PreviewInputProps, PreviewLayer } from '../types'

let FRAME = 30
vi.mock('@remotion/media', () => ({
  Video: ({ src, muted }: { src: string; muted?: boolean }) => <div data-testid="media-video" data-src={src} data-muted={String(Boolean(muted))} />,
  Audio: ({ src }: { src: string }) => <div data-testid="media-audio" data-src={src} />,
}))
vi.mock('remotion', async () => ({
  AbsoluteFill: ({ children, style, ...rest }: { children?: React.ReactNode; style?: React.CSSProperties }) => <div style={style} {...rest}>{children}</div>,
  Img: ({ src }: { src: string }) => <img src={src} alt="" />,
  Sequence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Internals: { SequenceManager: { Provider: ({ children }: { children?: React.ReactNode }) => <>{children}</> } },
  useCurrentFrame: () => FRAME,
  useVideoConfig: () => ({ width: 1280, height: 720, fps: 30, durationInFrames: 150 }),
  interpolate: (v: number, i: number[], o: number[]) => { const t = Math.max(0, Math.min(1, (v - i[0]) / (i[i.length - 1] - i[0]))); return o[0] + (o[o.length - 1] - o[0]) * t },
  spring: ({ frame }: { frame: number }) => Math.min(1, frame / 15),
  Easing: { out: () => (t: number) => t, in: () => (t: number) => t, inOut: () => (t: number) => t, bezier: () => (t: number) => t, back: () => (t: number) => t, cubic: (t: number) => t, quad: (t: number) => t, ease: (t: number) => t, linear: (t: number) => t },
}))

const VIDEO = 'https://cdn.example.com/talk.mp4'
const text = (patch: Partial<PreviewLayer> = {}): PreviewLayer => ({ id: 'headline', kind: 'headline', visible: true, x: 0.5, y: 0.5, scale: 0.06, animation: 'none', animationDelay: 0, startFrame: 0, opacity: 1, text: 'Hello', ...patch } as PreviewLayer)
const props = (settingsPatch: Record<string, unknown> = {}, layers: PreviewLayer[] = []): PreviewInputProps => ({
  videoUrl: VIDEO, posterUrl: null, isImageSource: false, audioUrl: null,
  settings: { ...createDefaultPreviewSettings(), layers, showEndCard: false, fps: 30, durationInFrames: 150, width: 1280, height: 720, ...settingsPatch } as never,
  brand: { businessName: 'Acme', headline: 'H', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null },
})
const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = []
function mount(p: PreviewInputProps) { const container = document.createElement('div'); document.body.appendChild(container); const root = createRoot(container); mounted.push({ root, container }); act(() => root.render(<PersonalizationComposition {...p} />)); return container }
afterEach(() => { for (const { root, container } of mounted.splice(0)) { act(() => root.unmount()); container.remove() } clearMatteRegistry(); FRAME = 30 })
const frameDiv = (c: HTMLElement) => c.querySelector('[data-footage-frame]') as HTMLElement | null
const styleOf = (el: Element | null | undefined) => (el as HTMLElement | null)?.style

describe('footage effects in the composition', () => {
  it('no effects: the video is drawn exactly as before (no wrapper, no overlays, no fade)', () => {
    const c = mount(props()); expect(frameDiv(c)).toBeNull(); expect(c.querySelector('[data-footage-tint],[data-footage-vignette],[data-footage-fade]')).toBeNull()
    expect(mount(props({ footageEffects: { look: IDENTITY_LOOK } })).querySelector('[data-footage-frame]')).toBeNull() // an identity look is not a look
  })
  it('a look puts the CSS filter on the footage, inside an isolated group, with the overlays', () => {
    const c = mount(props({ footageEffects: { look: { ...IDENTITY_LOOK, brightness: 1.2, contrast: 1.1, saturation: 0.8, temperature: 0.5, vignette: 0.6 } } }))
    const f = frameDiv(c)!; expect(f.style.isolation).toBe('isolate')
    expect((f.firstElementChild as HTMLElement).style.filter).toBe('brightness(1.2) contrast(1.1) saturate(0.8)')
    expect(c.querySelector('[data-footage-tint]')?.getAttribute('style')).toMatch(/multiply/); expect(c.querySelector('[data-footage-vignette]')?.getAttribute('style')).toMatch(/radial-gradient/)
    expect(f.querySelector('[data-testid="media-video"]')).toBeTruthy() // the video is inside the group
  })
  it('camera motion: the transform follows the frame (start, middle, end)', () => {
    const fx = { motion: { enabled: true, zoom: { from: 1, to: 1.5 }, pan: { x: { from: 0, to: 0 }, y: { from: 0, to: 0 } }, ease: 'linear' as const } }
    const scaleAt = (frame: number) => { FRAME = frame; const c = mount(props({ footageEffects: fx })); return styleOf(frameDiv(c)!.firstElementChild)!.transform }
    expect(scaleAt(0)).toBe('translate(0px, 0px) scale(1)'); expect(scaleAt(149)).toBe('translate(0px, 0px) scale(1.5)'); expect(scaleAt(74.5)).toBe('translate(0px, 0px) scale(1.25)')
  })
  it('fade: a black cover at the first frame, none in the middle, back at the last', () => {
    const fx = { fade: { inFrames: 30, outFrames: 30 } }
    const cover = (frame: number) => { FRAME = frame; const c = mount(props({ footageEffects: fx })); return c.querySelector('[data-footage-fade]') as HTMLElement | null }
    expect(cover(0)!.style.opacity).toBe('1'); expect(cover(15)!.style.opacity).toBe('0.5'); expect(cover(75)).toBeNull(); expect(cover(149)!.style.opacity).toBe('1')
  })
  it('the presenter picture gets the same look; a removed background drops the two overlays but keeps the filter', () => {
    registerMatteUrl('pm_mediapipe_abcdef12', 'blob:matte')
    const presenter = (mode: 'keep' | 'remove') => ({ ...defaultPresenter('bubble'), background: { ...defaultPresenter('bubble').background, mode }, matte: { key: 'pm_mediapipe_abcdef12', engine: 'mediapipe' as const, sourceUrl: VIDEO, createdAt: 'x' } })
    const fx = { look: { ...IDENTITY_LOOK, contrast: 1.3, temperature: 0.5, vignette: 0.5 } }
    const keep = mount(props({ presenter: presenter('keep'), footageEffects: fx })); expect(keep.querySelector('[data-presenter-layer] [data-footage-frame]')).toBeTruthy(); expect(keep.querySelector('[data-footage-tint]')).toBeTruthy(); expect(keep.querySelector('[data-footage-vignette]')).toBeTruthy()
    const removed = mount(props({ presenter: presenter('remove'), footageEffects: fx })); const f = removed.querySelector('[data-presenter-layer] [data-footage-frame]') as HTMLElement
    expect((f.firstElementChild as HTMLElement).style.filter).toBe('contrast(1.3)'); expect(removed.querySelector('[data-footage-tint]')).toBeNull(); expect(removed.querySelector('[data-footage-vignette]')).toBeNull()
  })
  it('the bubble has a soft (blurred) shadow, the form the web renderer draws; the border is a real border, not a spread shadow', () => {
    const el = mount(props({ presenter: defaultPresenter('bubble') })).querySelector('[data-presenter-layer]') as HTMLElement
    expect(el.style.boxShadow).toMatch(/40px/); expect(el.style.boxShadow).not.toMatch(/\b0px 0px 0px\b/)
    expect((el.querySelector('div > div + div') as HTMLElement | null)?.style.border ?? el.innerHTML).toMatch(/solid/)
  })
})

describe('text layer effects in the composition', () => {
  const textEl = (c: HTMLElement) => [...c.querySelectorAll('div')].find((d) => d.textContent === 'Hello' && d.style.fontSize) as HTMLElement
  const wrapOf = (c: HTMLElement) => textEl(c).parentElement as HTMLElement
  it('shadow, glow and outline become text-shadow / text-stroke on the text', () => {
    const c = mount(props({}, [text({ effect: { shadow: 1, glow: { color: '#ff0000', strength: 1 }, outline: { color: '#0000ff', width: 0.05 } } })])); const s = textEl(c).style
    expect(s.textShadow).toMatch(/rgb\(255, 0, 0\)|#ff0000/); expect(s.textShadow).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.9\)/); expect(s.getPropertyValue('-webkit-text-stroke')).toMatch(/0, 0, 255|#0000ff/)
  })
  it('no effect: no shadow or stroke at all', () => { const s = textEl(mount(props({}, [text()]))).style; expect(s.textShadow).toBe(''); expect(s.getPropertyValue('-webkit-text-stroke')).toBe('') })
  it('exit: untouched before the window, fading inside it, gone at the end frame', () => {
    const layer = text({ endFrame: 100, exit: { animation: 'fade', frames: 20 } })
    const opacityAt = (f: number) => { FRAME = f; return wrapOf(mount(props({}, [layer]))).style.opacity }
    FRAME = 50; expect(mount(props({}, [layer])).textContent).toContain('Hello')
    expect(opacityAt(50)).toBe('1'); expect(Number(opacityAt(90))).toBeCloseTo(0.5, 2)
    FRAME = 101; expect(mount(props({}, [layer])).textContent).not.toContain('Hello') // past endFrame the layer is not drawn
  })
  it('slide-up exit moves the text up as it leaves', () => {
    const layer = text({ endFrame: 100, exit: { animation: 'slide-up', frames: 20 } }); FRAME = 99
    const wrap = wrapOf(mount(props({}, [layer])))
    expect(wrap.style.transform).toMatch(/translateY\(-(3\d|40)(\.\d+)?px\)/)
  })
  it('blur-in starts blurred and ends sharp; zoom-in starts larger; bounce starts above', () => {
    const wrapAt = (animation: string, f: number) => { FRAME = f; return wrapOf(mount(props({}, [text({ animation: animation as never })]))) }
    expect(wrapAt('blur-in', 0).style.filter).toMatch(/blur\(14px\)/); expect(wrapAt('blur-in', 60).style.filter).toBe('')
    expect(wrapAt('zoom-in', 0).style.transform).toMatch(/scale\(1\.4\)/); expect(wrapAt('zoom-in', 60).style.transform).toBe('')
    expect(wrapAt('bounce', 0).style.transform).toMatch(/translateY\(-90px\)/)
  })
  it('the original animations are unchanged (fade at frame 0 is invisible; none is plain)', () => {
    FRAME = 0; const fade = wrapOf(mount(props({}, [text({ animation: 'fade' })])))
    expect(fade.style.opacity).toBe('0'); expect(fade.style.filter).toBe('')
    FRAME = 30; expect(wrapOf(mount(props({}, [text()]))).style.transform).toBe('')
  })
})
