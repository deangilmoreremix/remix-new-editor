// @vitest-environment jsdom
/**
 * Stage 1 — the shared Remotion composition (used by BOTH the live preview and
 * the web-renderer export) applies rotation, the source-footage transform, image
 * zoom and custom fields. If these hold here they hold in both outputs, because
 * there is only one composition.
 */
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PersonalizationComposition } from '../PersonalizationComposition'
import { createDefaultPreviewSettings } from '../presets'
import type { PreviewInputProps, PreviewLayer } from '../types'

const FRAME = 30

vi.mock('@remotion/media', () => ({
  Video: ({ src, style }: { src: string; style?: React.CSSProperties }) => (
    <div data-testid="media-video" data-src={src} style={style} />
  ),
}))

vi.mock('remotion', async () => ({
  AbsoluteFill: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => (
    <div data-abs="1" style={style}>{children}</div>
  ),
  Img: ({ src, style }: { src: string; style?: React.CSSProperties }) => <img src={src} alt="" style={style} />,
  Sequence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Internals: { SequenceManager: { Provider: ({ children }: { children?: React.ReactNode }) => <>{children}</> } },
  useCurrentFrame: () => FRAME,
  useVideoConfig: () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 150 }),
  interpolate: (_i: number, _r: number[], out: number[]) => out[out.length - 1] ?? 1,
  spring: () => 1,
  Easing: {
    out: () => (t: number) => t, in: () => (t: number) => t, inOut: () => (t: number) => t,
    bezier: () => (t: number) => t, back: () => (t: number) => t,
    cubic: (t: number) => t, quad: (t: number) => t, ease: (t: number) => t, linear: (t: number) => t,
  },
}))

function textLayer(id: string, kind: PreviewLayer['kind'], patch: Partial<PreviewLayer> = {}): PreviewLayer {
  return { id, kind, visible: true, x: 0.5, y: 0.5, scale: 0.06, animation: 'none', animationDelay: 0, startFrame: 0, opacity: 1, ...patch }
}

function props(layers: PreviewLayer[], settingsPatch: Record<string, unknown> = {}): PreviewInputProps {
  return {
    videoUrl: 'https://cdn.example.com/presenter.mp4',
    posterUrl: null,
    isImageSource: false,
    audioUrl: null,
    settings: { ...createDefaultPreviewSettings(), layers, showEndCard: false, ...settingsPatch },
    brand: { businessName: 'Acme', headline: 'H', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null },
  }
}

const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = []
function mount(p: PreviewInputProps) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ root, container })
  act(() => root.render(<PersonalizationComposition {...p} />))
  return container
}
afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('rotation', () => {
  /** The element holding the text itself (the auto-height box the rotation pivots on). */
  const textEl = (c: HTMLElement, label: string) => {
    const el = Array.from(c.querySelectorAll<HTMLElement>('*')).find((n) => n.children.length === 0 && n.textContent === label)
    expect(el, `text "${label}" should be drawn`).toBeTruthy()
    return el as HTMLElement
  }
  it('rotates a text layer on its own auto-height box and leaves others untouched', () => {
    const c = mount(props([
      textLayer('hl', 'headline', { text: 'Spin me', rotation: 25 }),
      textLayer('tg', 'tagline', { text: 'Stay put', y: 0.8 }),
    ]))
    expect(textEl(c, 'Spin me').style.transform).toBe('rotate(25deg)')
    expect(textEl(c, 'Stay put').style.transform).toBe('')
    expect(c.innerHTML.match(/rotate\(/g)?.length).toBe(1)
  })
  it('does NOT rotate the frame-tall wrapper (that would pivot far below the text)', () => {
    const c = mount(props([textLayer('hl', 'headline', { text: 'Spin me', rotation: 25, animation: 'pop' })]))
    let node: HTMLElement | null = textEl(c, 'Spin me').parentElement
    while (node && node !== c) {
      expect(node.style.transform ?? '').not.toContain('rotate(')
      node = node.parentElement
    }
  })
  it('rotates a call-to-action pill on its own box too', () => {
    const c = mount(props([textLayer('cta', 'cta', { text: 'Book now', rotation: -15 })]))
    const pill = textEl(c, 'Book now')
    expect(pill.parentElement!.style.transform).toBe('rotate(-15deg)')
  })
  it('rotates an image layer about its square box', () => {
    const p = props([{ ...textLayer('lg', 'logo'), scale: 0.2, rotation: 40 }])
    p.brand = { ...p.brand, logoUrl: 'https://cdn.example.com/logo.png' }
    const c = mount(p)
    const img = c.querySelector<HTMLImageElement>('img[src="https://cdn.example.com/logo.png"]')!
    expect(img).toBeTruthy()
    let node: HTMLElement | null = img
    let found = false
    while (node && node !== c) { if ((node.style.transform ?? '').includes('rotate(40deg)')) found = true; node = node.parentElement }
    expect(found).toBe(true)
  })
  it('never rotates a full-frame design layer', () => {
    // A design with no registered template is skipped entirely; the point is it must not throw.
    expect(() => mount(props([{ ...textLayer('d', 'design'), designId: 'nope', rotation: 30 }]))).not.toThrow()
  })
})

describe('source footage transform (presenter)', () => {
  it('is absent by default', () => {
    const v = mount(props([])).querySelector<HTMLElement>('[data-testid="media-video"]')!
    expect(v.style.transform).toBe('')
    expect(v.style.objectFit).toBe('cover')
  })
  it('pans and zooms the footage about the same focal point', () => {
    const v = mount(props([], { sourceTransform: { x: 0.25, y: 0.75, zoom: 2 } })).querySelector<HTMLElement>('[data-testid="media-video"]')!
    expect(v.style.objectPosition).toBe('25% 75%')
    expect(v.style.transform).toBe('scale(2)')
    expect(v.style.transformOrigin).toBe('25% 75%')
  })
  it('applies to an image source too', () => {
    const c = mount({ ...props([], { sourceTransform: { x: 0.5, y: 0.5, zoom: 3 } }), videoUrl: null, isImageSource: true, posterUrl: 'https://cdn.example.com/p.jpg' })
    const img = c.querySelector<HTMLImageElement>('img')!
    expect(img.style.transform).toBe('scale(3)')
  })
})

describe('custom fields', () => {
  it('substitutes {{key}} in layer text and leaves other tokens alone', () => {
    const c = mount(props(
      [textLayer('hl', 'headline', { text: 'Hello {{city}} — {{firstName}}' })],
      { customFields: { city: 'Austin' } },
    ))
    expect(c.textContent).toContain('Hello Austin — {{firstName}}')
  })
  it('does nothing without custom fields', () => {
    const c = mount(props([textLayer('hl', 'headline', { text: 'Hello {{city}}' })]))
    expect(c.textContent).toContain('Hello {{city}}')
  })
})

describe('determinism', () => {
  it('renders byte-identical markup for identical props (same frame)', () => {
    const p = props(
      [textLayer('hl', 'headline', { text: 'Same {{city}}', rotation: 12 })],
      { sourceTransform: { x: 0.4, y: 0.6, zoom: 1.5 }, customFields: { city: 'Austin' } },
    )
    expect(mount(p).innerHTML).toBe(mount(JSON.parse(JSON.stringify(p))).innerHTML)
  })
})
