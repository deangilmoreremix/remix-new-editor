// @vitest-environment jsdom
/**
 * Batch 3g — fifteen React Video Editor (`remotion-templates`) transitions
 * and overlay effects, ported as C8 edited copies.
 *
 * Pinned here:
 *  1. registry metadata (ids, categories, attribution, slots, placement);
 *  2. every adapter renders at several frames with the brand data;
 *  3. transitions start on a visible brand card and END with nothing painted
 *     (the "after" side is transparent, so the customer's video shows);
 *  4. overlays never paint an opaque fill;
 *  5. the upstream copies reproduce the upstream design with no props, keep
 *     their credit/provenance and ship no URL outside comments.
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

import {
  BATCH_3G_FIXED_SVG_IDS,
  BATCH_3G_TEMPLATES,
} from '../designs/batch3g/entries'
import { RVE_ATTRIBUTION } from '../designs/rveSharedDesign'
import type {
  RemotionDesignComponentProps,
  RemotionDesignTemplate,
  RemotionDesignTextField,
} from '../types'

import { BlindsTransition } from '../_upstream/rve-blinds-transition/BlindsTransition'
import { ClockWipe } from '../_upstream/rve-clock-wipe/ClockWipe'
import { CrossDissolve } from '../_upstream/rve-cross-dissolve/CrossDissolve'
import { FadeThroughBlack } from '../_upstream/rve-fade-through-black/FadeThroughBlack'
import { FilmBurn } from '../_upstream/rve-film-burn/FilmBurn'
import { IrisTransition } from '../_upstream/rve-iris-transition/IrisTransition'
import { LetterboxReveal } from '../_upstream/rve-letterbox-reveal/LetterboxReveal'
import { MorphTransition } from '../_upstream/rve-morph-transition/MorphTransition'
import { PixelTransition } from '../_upstream/rve-pixel-transition/PixelTransition'
import { PushTransition } from '../_upstream/rve-push-transition/PushTransition'
import { ZoomThrough } from '../_upstream/rve-zoom-through/ZoomThrough'
import { CardFlip } from '../_upstream/rve-card-flip/CardFlip'
import { NoiseGrain } from '../_upstream/rve-noise-grain/NoiseGrain'
import { VignettePulse } from '../_upstream/rve-vignette-pulse/VignettePulse'
import { SpotlightReveal } from '../_upstream/rve-spotlight-reveal/SpotlightReveal'

const clock = vi.hoisted(() => ({ frame: 0, width: 1920, height: 1080 }))

vi.mock('remotion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('remotion')>()
  const ReactMod = await import('react')
  return {
    ...actual,
    useCurrentFrame: () => clock.frame,
    useVideoConfig: () => ({
      width: clock.width,
      height: clock.height,
      fps: 30,
      durationInFrames: 150,
    }),
    Img: ({ src, ...rest }: { src: string }) =>
      ReactMod.createElement('img', { src, alt: '', ...rest }),
  }
})

const SLUGS = [
  'blinds-transition',
  'clock-wipe',
  'cross-dissolve',
  'fade-through-black',
  'film-burn',
  'iris-transition',
  'letterbox-reveal',
  'morph-transition',
  'pixel-transition',
  'push-transition',
  'zoom-through',
  'card-flip',
  'noise-grain',
  'vignette-pulse',
  'spotlight-reveal',
]
const IDS = SLUGS.map((slug) => `rve-${slug}`)
const OVERLAY_IDS = ['rve-noise-grain', 'rve-vignette-pulse', 'rve-spotlight-reveal']
const TRANSITION_IDS = IDS.filter((id) => !OVERLAY_IDS.includes(id))

const LOGO_URL = 'https://cdn.example.com/brand/logo.png'

const BRAND_VALUES: Record<RemotionDesignTextField, string> = {
  businessName: 'Acme Roofing',
  headline: 'Roofing done right',
  offer: '20% off this week',
  cta: 'Book now',
  phone: '555-0100',
  website: 'acme.example.com',
}

function makeProps(
  template: RemotionDesignTemplate,
  overrides: Partial<RemotionDesignComponentProps> = {},
): RemotionDesignComponentProps {
  const slots: Record<string, string> = {}
  for (const slot of template.textSlots ?? []) slots[slot.key] = BRAND_VALUES[slot.field]
  const primary = (template.textSlots ?? []).find((slot) => slot.primary)
  return {
    text: primary ? BRAND_VALUES[primary.field] : '',
    textSlots: slots,
    colors: { primary: '#d9ff00', accent: '#28c98b', text: '#ffffff', backgroundDim: 0.18 },
    media: { logo: LOGO_URL, product: null, service: null },
    box: { leftPx: 0, topPx: 0, widthPx: 1920, heightPx: 1080 },
    width: 1920,
    height: 1080,
    frame: clock.frame,
    fps: 30,
    opacity: 1,
    color: '#ffffff',
    ...overrides,
  }
}

function byId(id: string): RemotionDesignTemplate {
  const found = BATCH_3G_TEMPLATES.find((entry) => entry.id === id)
  if (!found) throw new Error(`missing ${id}`)
  return found
}

function renderAt(
  template: RemotionDesignTemplate,
  frame: number,
  overrides: Partial<RemotionDesignComponentProps> = {},
) {
  clock.frame = frame
  const Component = template.component
  return render(<Component {...makeProps(template, { frame, ...overrides })} />)
}

function canvasOf(container: HTMLElement): HTMLElement {
  const canvas = container.querySelector('[data-remotion-design-canvas]') as HTMLElement | null
  if (!canvas) throw new Error('no design canvas')
  return canvas
}

/* ----------------------------- visibility model ---------------------------- */

function rotation(transform: string, axis: 'X' | 'Y'): number {
  const match = transform.match(new RegExp(`rotate${axis}\\((-?[\\d.e-]+)deg\\)`))
  return match ? Number(match[1]) : 0
}

/** Whether `el` is invisible because of itself or one of its ancestors. */
function isHidden(el: HTMLElement, root: HTMLElement): boolean {
  let node: HTMLElement | null = el
  while (node && node !== root.parentElement) {
    const s = node.style
    if (s.opacity !== '' && Number(s.opacity) <= 0.001) return true
    if (s.height === '0%') return true
    if (/circle\(0%/.test(s.clipPath)) return true
    const tx = s.transform.match(/translateX\((-?[\d.e-]+)%\)/)
    if (tx && Math.abs(Number(tx[1])) >= 99.5) return true
    if (s.backfaceVisibility === 'hidden') {
      const parentTransform = node.parentElement?.style.transform ?? ''
      const rx = rotation(s.transform, 'X') + rotation(parentTransform, 'X')
      const ry = rotation(s.transform, 'Y') + rotation(parentTransform, 'Y')
      if (Math.cos((rx * Math.PI) / 180) * Math.cos((ry * Math.PI) / 180) <= 0.01) return true
    }
    node = node.parentElement
  }
  return false
}

function colorIsInvisible(color: string): boolean {
  const c = color.trim().toLowerCase()
  if (c === 'transparent' || c === '') return true
  const rgba = c.match(/^rgba\(([^)]*)\)$/)
  if (rgba) {
    const alpha = Number(rgba[1].split(',').pop())
    return alpha <= 0.001
  }
  return false
}

/** Whether `el` paints a visible fill inside the canvas (ignoring ancestors). */
function paints(el: HTMLElement, width: number, height: number): boolean {
  const s = el.style
  if (s.backgroundColor && !colorIsInvisible(s.backgroundColor)) return true
  const image = s.backgroundImage
  if (!image || image === 'none') return false
  if (el.hasAttribute('data-iris-outside') || el.hasAttribute('data-spotlight-outside')) {
    const radius = Number(image.match(/circle ([\d.]+)px/)?.[1] ?? 0)
    // The mask paints only OUTSIDE its circle; once the circle covers the
    // corners it paints nothing inside the canvas.
    return radius < Math.sqrt(width * width + height * height) / 2
  }
  const colors = image.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}\b|\bwhite\b|\bblack\b/gi) ?? []
  return colors.some((color) => !colorIsInvisible(color))
}

function visiblePainters(container: HTMLElement, width = 1920, height = 1080): HTMLElement[] {
  const canvas = canvasOf(container)
  return Array.from(canvas.querySelectorAll<HTMLElement>('*')).filter(
    (el) => paints(el, width, height) && !isHidden(el, canvas),
  )
}

/* ---------------------------------------------------------------------------- */

const originalWarn = console.warn
beforeAll(() => {
  console.warn = (...args: unknown[]) => {
    const first = typeof args[0] === 'string' ? args[0] : ''
    if (first.includes('bundled design font')) return
    originalWarn(...args)
  }
})
afterAll(() => {
  console.warn = originalWarn
})
beforeEach(() => {
  clock.frame = 0
  clock.width = 1920
  clock.height = 1080
})

describe('batch 3g — registry entries', () => {
  it('exports all fifteen designs in order with unique ids', () => {
    expect(BATCH_3G_TEMPLATES.map((entry) => entry.id)).toEqual(IDS)
    expect(new Set(IDS).size).toBe(IDS.length)
  })

  it('classifies transitions and overlays', () => {
    for (const id of TRANSITION_IDS) expect(byId(id).category, id).toBe('transition')
    for (const id of OVERLAY_IDS) expect(byId(id).category, id).toBe('visual-effect')
  })

  it('attributes every entry to the repo-2 upstream', () => {
    for (const entry of BATCH_3G_TEMPLATES) {
      const slug = entry.id.replace(/^rve-/, '')
      expect(entry.source).toEqual({
        repository: 'remotion-templates',
        repositoryUrl: 'https://github.com/deangilmoreremix/remotion-templates',
        sourcePath: `templates/${slug}.tsx`,
        license: 'MIT',
        attribution: RVE_ATTRIBUTION,
      })
    }
  })

  it('declares complete, truthful metadata', () => {
    const fields: RemotionDesignTextField[] = ['businessName', 'headline', 'offer', 'cta', 'phone', 'website']
    for (const entry of BATCH_3G_TEMPLATES) {
      expect(entry.name.length, entry.id).toBeGreaterThan(0)
      expect(entry.description.length, entry.id).toBeGreaterThan(10)
      expect(entry.component, entry.id).toBeTruthy()
      expect(entry.capabilities.preview, entry.id).toBe(true)
      expect(entry.capabilities.browserExport, entry.id).toBe(true)
      expect((entry.capabilities.notes ?? '').length, entry.id).toBeGreaterThan(0)
      expect(entry.previewCompatible, entry.id).toBe(true)
      expect(entry.aspectRatios, entry.id).toContain('16:9')
      expect(entry.requiredMedia ?? [], entry.id).toEqual([])
      expect(Array.isArray(entry.colors), entry.id).toBe(true)
      expect(Array.isArray(entry.media), entry.id).toBe(true)
      expect(entry.animation?.durationInFrames, entry.id).toBeGreaterThan(0)
      const slots = entry.textSlots ?? []
      const primary = slots.filter((slot) => slot.primary)
      expect(primary.length, entry.id).toBe(slots.length === 0 ? 0 : 1)
      for (const slot of slots) expect(fields, entry.id).toContain(slot.field)
      // Full-frame designs: scale 1 requires no layer entrance and opacity 1.
      expect(entry.placement, entry.id).toMatchObject({ x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none' })
    }
  })

  it('ends every transition (and the entrance-only spotlight) at its endFrame', () => {
    for (const id of [...TRANSITION_IDS, 'rve-spotlight-reveal']) {
      const entry = byId(id)
      const end = entry.placement?.endFrame
      expect(typeof end, id).toBe('number')
      expect(end!, id).toBeGreaterThanOrEqual(30)
      expect(end!, id).toBeLessThanOrEqual(120)
      expect(entry.animation?.durationInFrames, id).toBe(end)
      expect(entry.textSlots?.find((slot) => slot.primary)?.field, id).toBe('businessName')
    }
    for (const id of ['rve-noise-grain', 'rve-vignette-pulse']) {
      expect(byId(id).placement?.endFrame, id).toBeUndefined()
      expect(byId(id).textSlots, id).toEqual([])
    }
  })

  it('declares no fixed SVG ids', () => {
    expect(BATCH_3G_FIXED_SVG_IDS).toEqual({})
  })
})

describe('batch 3g — adapters render with brand data', () => {
  it('renders every design at several frames without throwing', () => {
    for (const entry of BATCH_3G_TEMPLATES) {
      const end = entry.placement?.endFrame ?? 90
      for (const frame of [0, Math.round(end / 3), Math.round(end / 2), end]) {
        const { container, unmount } = renderAt(entry, frame)
        expect(container.innerHTML.length, `${entry.id}@${frame}`).toBeGreaterThan(0)
        expect(container.querySelector('[data-remotion-design-credit]'), entry.id).toBeNull()
        const stage = container.querySelector('[data-remotion-design]') as HTMLElement
        expect(stage.getAttribute('data-remotion-design'), entry.id).toBe(entry.id)
        expect(stage.style.backgroundColor, entry.id).toBe('transparent')
        const root = canvasOf(container).firstElementChild as HTMLElement
        expect(colorIsInvisible(root.style.backgroundColor), entry.id).toBe(true)
        expect(root.style.backgroundImage || 'none', entry.id).toBe('none')
        unmount()
      }
    }
  })

  it('shows the business name, the headline and the logo on the transition card', () => {
    for (const id of TRANSITION_IDS) {
      const { container, unmount } = renderAt(byId(id), 0)
      const text = canvasOf(container).textContent ?? ''
      expect(text, id).toContain('Acme Roofing')
      if (id !== 'rve-letterbox-reveal') {
        expect(text, id).toContain('Roofing done right')
        expect(container.querySelector(`img[src="${LOGO_URL}"]`), id).not.toBeNull()
      }
      // The upstream demo copy never reaches the customer.
      expect(text, id).not.toMatch(/Scene [AB12]|Remotion|CINEMATIC|Film Burn Effect/)
      unmount()
    }
  })

  it('falls back to a brand monogram tile when there is no logo', () => {
    for (const id of TRANSITION_IDS) {
      const { container, unmount } = renderAt(byId(id), 0, {
        media: { logo: null, product: null, service: null },
      })
      expect(container.querySelector('img'), id).toBeNull()
      if (id !== 'rve-letterbox-reveal') {
        const tile = container.querySelector('[data-rve-logo-placeholder]') as HTMLElement
        expect(tile, id).not.toBeNull()
        expect(tile.textContent, id).toBe('A')
        expect(tile.style.backgroundImage, id).toContain('rgb(217, 255, 0)')
      }
      unmount()
    }
  })

  it('paints the card with the brand colour', () => {
    const { container } = renderAt(byId('rve-cross-dissolve'), 0, {
      colors: { primary: '#ff0055', accent: '#28c98b', text: '#ffffff', backgroundDim: 0.18 },
    })
    const painted = visiblePainters(container).map((el) => el.style.backgroundImage).join(' ')
    // darkenColor('#ff0055', 0.55) = #8c002f
    expect(painted).toContain('rgb(140, 0, 47)')
  })

  it('truncates long copy to one line and scales type with the composition', () => {
    const long = 'Acme Roofing and Exterior Restoration Specialists of the Greater Metropolitan Area'
    for (const [width, height] of [
      [1920, 1080],
      [1080, 1920],
      [1080, 1080],
    ]) {
      clock.width = width
      clock.height = height
      const entry = byId('rve-push-transition')
      const { container, unmount } = renderAt(entry, 0, {
        width,
        height,
        box: { leftPx: 0, topPx: 0, widthPx: width, heightPx: height },
        text: long,
        textSlots: { businessName: long, headline: 'Roofing done right' },
      })
      const h2 = container.querySelector('[data-rve-before] h2') as HTMLElement
      expect(h2.textContent!.length).toBeLessThanOrEqual(40)
      expect(h2.textContent!.endsWith('…')).toBe(true)
      expect(h2.style.whiteSpace).toBe('nowrap')
      expect(h2.style.fontSize).toBe(`${Math.round(Math.min(width, height) * 0.075)}px`)
      // The title fits the canvas width at ~0.62 em per glyph.
      expect(h2.textContent!.length * Math.min(width, height) * 0.075 * 0.62).toBeLessThanOrEqual(width)
      unmount()
    }
  })
})

describe('batch 3g — transitions reveal the video', () => {
  it('starts on a visible card and ends with nothing painted over the video', () => {
    for (const id of [...TRANSITION_IDS, 'rve-spotlight-reveal']) {
      const entry = byId(id)
      const start = renderAt(entry, 0)
      expect(visiblePainters(start.container).length, `${id} start`).toBeGreaterThan(0)
      start.unmount()

      const end = renderAt(entry, entry.placement!.endFrame!)
      const canvas = canvasOf(end.container)
      expect(visiblePainters(end.container).map((el) => el.outerHTML.slice(0, 160)), `${id} end`).toEqual([])
      for (const card of Array.from(canvas.querySelectorAll<HTMLElement>('[data-rve-before]'))) {
        expect(isHidden(card, canvas), `${id} card hidden at end`).toBe(true)
      }
      end.unmount()
    }
  })

  it('reveals the video in 9:16 as well', () => {
    clock.width = 1080
    clock.height = 1920
    for (const id of [...TRANSITION_IDS, 'rve-spotlight-reveal']) {
      const entry = byId(id)
      const overrides = {
        width: 1080,
        height: 1920,
        box: { leftPx: 0, topPx: 0, widthPx: 1080, heightPx: 1920 },
      }
      const end = renderAt(entry, entry.placement!.endFrame!, overrides)
      expect(visiblePainters(end.container, 1080, 1920), id).toEqual([])
      end.unmount()
    }
  })
})

describe('batch 3g — overlays stay transparent', () => {
  it('never paints an opaque fill or text over the video', () => {
    for (const id of ['rve-noise-grain', 'rve-vignette-pulse']) {
      for (const frame of [0, 7, 15, 45]) {
        const { container, unmount } = renderAt(byId(id), frame)
        const canvas = canvasOf(container)
        expect(canvas.textContent ?? '', id).toBe('')
        for (const el of Array.from(canvas.querySelectorAll<HTMLElement>('*'))) {
          expect(colorIsInvisible(el.style.backgroundColor || 'transparent'), id).toBe(true)
        }
        unmount()
      }
    }
  })

  it('keeps the grain faint and tinted with the brand text colour', () => {
    const { container } = renderAt(byId('rve-noise-grain'), 3, { color: '#ffeeaa' })
    const rects = Array.from(container.querySelectorAll('rect'))
    expect(rects.length).toBe(160 * 90)
    for (const rect of rects.slice(0, 200)) {
      expect(rect.getAttribute('fill')).toBe('#ffeeaa')
      expect(Number(rect.getAttribute('opacity'))).toBeLessThanOrEqual(0.08)
    }
  })

  it('tints the vignette with a deep brand shade', () => {
    const { container } = renderAt(byId('rve-vignette-pulse'), 0)
    const images = Array.from(canvasOf(container).querySelectorAll<HTMLElement>('*')).map(
      (el) => el.style.backgroundImage,
    )
    // darkenColor('#d9ff00', 0.12) = #05191d
    expect(images.join(' ')).toContain('rgba(5, 25, 29, 0.55)')
  })
})

describe('batch 3g — upstream copies', () => {
  const cases: Array<[string, React.FC, number, string[], string | null]> = [
    ['BlindsTransition', BlindsTransition, 20, ['Scene A', 'Blinds opening...', 'Scene B', 'Behind the blinds'], 'rgb(17, 24, 39)'],
    ['ClockWipe', ClockWipe, 20, ['Scene A', 'Clock wipe transition', 'Scene B', 'Revealed by clock wipe'], 'rgb(17, 24, 39)'],
    ['CrossDissolve', CrossDissolve, 20, ['Scene A', 'Dissolving away...', 'Scene B', 'Appearing...'], 'rgb(17, 24, 39)'],
    ['FadeThroughBlack', FadeThroughBlack, 20, ['Scene 1', 'Fading out...', 'Scene 2', 'Fading in...'], 'rgb(17, 24, 39)'],
    ['FilmBurn', FilmBurn, 20, ['Film Burn Effect', 'Light leak overlay'], 'rgb(17, 24, 39)'],
    ['IrisTransition', IrisTransition, 20, ['Scene A', 'Iris closing...'], 'rgb(0, 0, 0)'],
    ['LetterboxReveal', LetterboxReveal, 20, ['CINEMATIC', 'A letterbox reveal'], 'rgb(17, 24, 39)'],
    ['MorphTransition', MorphTransition, 20, ['Scene A', 'Morphing away...', 'Scene B', 'Morphing in...'], 'rgb(17, 24, 39)'],
    ['PushTransition', PushTransition, 20, ['Scene A', 'Being pushed out...', 'Scene B', 'Pushing in...'], 'rgb(17, 24, 39)'],
    ['ZoomThrough', ZoomThrough, 20, ['Zooming In...', 'Arriving...'], 'rgb(17, 24, 39)'],
    ['CardFlip', CardFlip, 20, ['Remotion 👋', 'Back'], null],
    ['VignettePulse', VignettePulse, 20, ['Your Content Here', 'Vignette pulses around the edges'], 'rgb(17, 24, 39)'],
    ['SpotlightReveal', SpotlightReveal, 20, ['REVEALED', 'Spotlight reveal transition'], 'rgb(10, 10, 10)'],
  ]

  it('reproduce the upstream design when rendered with no props', () => {
    for (const [name, Component, frame, texts, rootBg] of cases) {
      clock.frame = frame
      const { container, unmount } = render(<Component />)
      const text = container.textContent ?? ''
      for (const expected of texts) expect(text, name).toContain(expected)
      const root = container.firstElementChild as HTMLElement
      if (rootBg) expect(root.style.backgroundColor, name).toBe(rootBg)
      unmount()
    }
  })

  it('keep upstream literals in the default DOM', () => {
    clock.frame = 0
    const blinds = render(<BlindsTransition />)
    const h2s = Array.from(blinds.container.querySelectorAll('h2')) as HTMLElement[]
    expect(h2s).toHaveLength(9) // Scene B + eight blinds
    expect(h2s[0].style.fontFamily).toContain('Inter')
    expect(h2s[0].style.fontSize).toBe('2.5rem')
    expect(blinds.container.innerHTML).toContain('perspective(800px)')
    blinds.unmount()

    const dissolve = render(<CrossDissolve />)
    expect((dissolve.container.querySelector('h2') as HTMLElement).style.fontFamily).toBe('')
    dissolve.unmount()

    const flip = render(<CardFlip />)
    expect(flip.container.innerHTML).toContain('width: 300px')
    expect(flip.container.innerHTML).toContain('perspective: 1000px')
    flip.unmount()

    clock.frame = 30
    const pixels = render(<PixelTransition />)
    const root = pixels.container.firstElementChild as HTMLElement
    expect(root.style.background).toBe('rgb(15, 23, 42)')
    expect(root.children.length).toBeGreaterThan(0)
    expect(root.children.length).toBeLessThan(96 * 54)
    expect((root.children[0] as HTMLElement).style.width).toBe('20px')
    pixels.unmount()

    clock.frame = 5
    const grain = render(<NoiseGrain />)
    expect(grain.container.textContent).toContain('Film Grain Overlay')
    expect(grain.container.querySelectorAll('rect')).toHaveLength(240 * 135)
    expect(grain.container.querySelector('rect')?.getAttribute('fill')).toBe('white')
    grain.unmount()
  })

  const upstreamDir = path.join(process.cwd(), 'src', 'features', 'personalization', 'shared', 'personalization', 'templates', '_upstream')
  const files = fs.existsSync(upstreamDir)
    ? SLUGS.map((slug) => {
        const dir = path.join(upstreamDir, `rve-${slug}`)
        const file = fs.readdirSync(dir).find((name) => name.endsWith('.tsx'))
        return path.join(dir, file!)
      })
    : []

  it('keep the credit and provenance, with no URL outside comments', () => {
    expect(files).toHaveLength(15)
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf-8')
      const name = path.basename(file)
      expect(source, name).toContain('Credit appreciated but not required')
      expect(source, name).toContain('https://github.com/deangilmoreremix/remotion-templates')
      expect(source, name).toContain('DEVIATION RECORD')
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n')
      expect(code, name).not.toMatch(/https?:\/\//)
      expect(code, name).not.toMatch(/Math\.random|Date\.now|staticFile|@keyframes/)
      expect(code, name).not.toMatch(/\bid=["{]/)
    }
  })
})
