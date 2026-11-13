// @vitest-environment jsdom
/**
 * Batch 3h — the fourteen React Video Editor (repo 2) media / particle
 * templates: gallery grid, image carousel, image comparison slider, image zoom
 * reveal, Ken Burns, masonry gallery, photo stack, picture-in-picture,
 * polaroid frame, rotating carousel, zoom pulse, liquid wave, matrix rain and
 * particle explosion.
 *
 * Pinned properties:
 *  1. the registry entries are complete and truthful (source, licence,
 *     category, placement, primary slot, media bindings);
 *  2. every adapter renders the edited upstream at several frames and in
 *     every format without throwing, with the repo-2 credit;
 *  3. overlays never paint an opaque full-canvas background;
 *  4. with NO brand media no element points at an http(s) URL (the upstream
 *     unsplash/pexels defaults are unreachable), and with brand media the
 *     brand URLs are what the images use;
 *  5. the edited copies still reproduce the upstream with no props.
 */
import React from 'react'
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'

import { BATCH_3H_FIXED_SVG_IDS, BATCH_3H_TEMPLATES } from '../designs/batch3h/entries'
import { RVE_ATTRIBUTION } from '../designs/rveSharedDesign'
import { REMOTION_DESIGN_TEMPLATES } from '../catalog'
import { getRemotionDesignTemplate, isRemotionDesignTemplateSupported } from '../registry'
import { KenBurns } from '../_upstream/rve-ken-burns/KenBurns'
import { ZoomPulse } from '../_upstream/rve-zoom-pulse/ZoomPulse'
import { ImageZoomReveal } from '../_upstream/rve-image-zoom-reveal/ImageZoomReveal'
import { PolaroidFrame } from '../_upstream/rve-polaroid-frame/PolaroidFrame'
import { ParticleExplosion } from '../_upstream/rve-particle-explosion/ParticleExplosion'
import { RotatingCarousel } from '../_upstream/rve-rotating-carousel/RotatingCarousel'
import { PictureInPicture } from '../_upstream/rve-picture-in-picture/PictureInPicture'
import { ImageCarousel } from '../_upstream/rve-image-carousel/ImageCarousel'
import { ImageComparisonSlider } from '../_upstream/rve-image-comparison-slider/ImageComparisonSlider'
import { PhotoStack } from '../_upstream/rve-photo-stack/PhotoStack'
import { LiquidWave } from '../_upstream/rve-liquid-wave/LiquidWave'
import { MatrixRain } from '../_upstream/rve-matrix-rain/MatrixRain'
import { GalleryGrid } from '../_upstream/rve-gallery-grid/GalleryGrid'
import { MasonryGallery } from '../_upstream/rve-masonry-gallery/MasonryGallery'
import type { RemotionDesignComponentProps, RemotionDesignTemplate } from '../types'

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
      durationInFrames: 300,
    }),
    // The real <Img> needs a registered composition; a plain <img> stands in.
    Img: ({ src, ...rest }: { src: string }) =>
      ReactMod.createElement('img', { src, alt: '', ...rest }),
  }
})

const EXPECTED_IDS = [
  'rve-gallery-grid',
  'rve-image-carousel',
  'rve-image-comparison-slider',
  'rve-image-zoom-reveal',
  'rve-ken-burns',
  'rve-masonry-gallery',
  'rve-photo-stack',
  'rve-picture-in-picture',
  'rve-polaroid-frame',
  'rve-rotating-carousel',
  'rve-zoom-pulse',
  'rve-liquid-wave',
  'rve-matrix-rain',
  'rve-particle-explosion',
]

const FULL_SCENE_IDS = [
  'rve-gallery-grid',
  'rve-image-carousel',
  'rve-image-comparison-slider',
  'rve-image-zoom-reveal',
  'rve-ken-burns',
  'rve-masonry-gallery',
  'rve-photo-stack',
  'rve-rotating-carousel',
  'rve-zoom-pulse',
]

const OVERLAY_IDS = EXPECTED_IDS.filter((id) => !FULL_SCENE_IDS.includes(id))

/** Designs that consume brand images. */
const MEDIA_IDS = EXPECTED_IDS.filter(
  (id) => !['rve-liquid-wave', 'rve-matrix-rain', 'rve-particle-explosion'].includes(id),
)

const PRODUCT_URL = 'https://cdn.example.com/brand/product.jpg'
const SERVICE_URL = 'https://cdn.example.com/brand/service.jpg'
const LOGO_URL = 'https://cdn.example.com/brand/logo.png'
const BRAND_URLS = [PRODUCT_URL, SERVICE_URL, LOGO_URL]

const NO_MEDIA = { product: null, service: null, logo: null }

function makeProps(
  overrides: Partial<RemotionDesignComponentProps> = {},
): RemotionDesignComponentProps {
  const width = overrides.width ?? 1920
  const height = overrides.height ?? 1080
  return {
    text: 'Acme Roofing',
    textSlots: {
      businessName: 'Acme Roofing',
      headline: 'Roofing done right',
      offer: '20% off this week',
      cta: 'Book now',
      website: 'acme.example',
    },
    colors: { primary: '#d9ff00', accent: '#28c98b', text: '#ffffff', backgroundDim: 0.18 },
    media: NO_MEDIA,
    box: { leftPx: 0, topPx: 0, widthPx: width, heightPx: height },
    width,
    height,
    frame: clock.frame,
    fps: 30,
    opacity: 1,
    color: '#ffffff',
    ...overrides,
  }
}

function template(id: string): RemotionDesignTemplate {
  const found = BATCH_3H_TEMPLATES.find((entry) => entry.id === id)
  if (!found) throw new Error(`missing ${id}`)
  return found
}

function renderDesign(id: string, overrides: Partial<RemotionDesignComponentProps> = {}) {
  const Component = template(id).component
  const props = makeProps(overrides)
  clock.width = props.width
  clock.height = props.height
  return render(<Component {...props} />)
}

function canvasOf(container: HTMLElement): HTMLElement {
  const canvas = container.querySelector<HTMLElement>('[data-remotion-design-canvas]')
  if (!canvas) throw new Error('no design canvas')
  return canvas
}

function isTransparent(value: string | null | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase()
  return v === '' || v === 'transparent' || v === 'none' || v === 'rgba(0, 0, 0, 0)'
}

/** Elements that paint a non-transparent fill over the whole canvas. */
function opaqueFullCanvasFills(container: HTMLElement, width: number, height: number): Element[] {
  const canvas = canvasOf(container)
  const full = (w: string, h: string) =>
    (w === '100%' || w === `${width}px`) && (h === '100%' || h === `${height}px`)
  return Array.from(canvas.querySelectorAll<HTMLElement>('*')).filter((el) => {
    const style = el.style
    if (!style) return false
    const fill = [style.background, style.backgroundColor, style.backgroundImage].some(
      (value) => !isTransparent(value),
    )
    if (!fill) return false
    if (el.tagName.toLowerCase() === 'svg') {
      return el.getAttribute('width') === String(width) && el.getAttribute('height') === String(height)
    }
    return full(style.width, style.height)
  })
}

function srcs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[src]')).map((el) => el.getAttribute('src') ?? '')
}

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
afterEach(() => {
  cleanup()
})

/* -------------------------------------------------------------------------- */
/* Metadata                                                                    */
/* -------------------------------------------------------------------------- */

describe('batch 3h — registry entries', () => {
  it('exports exactly the fourteen designs in order', () => {
    expect(BATCH_3H_TEMPLATES.map((entry) => entry.id)).toEqual(EXPECTED_IDS)
  })

  it('registers every design in the catalog and the registry', () => {
    const catalogIds = REMOTION_DESIGN_TEMPLATES.map((entry) => entry.id)
    for (const id of EXPECTED_IDS) {
      expect(catalogIds).toContain(id)
      expect(getRemotionDesignTemplate(id)).toBe(template(id))
    }
    expect(new Set(catalogIds).size).toBe(catalogIds.length)
  })

  it.each(EXPECTED_IDS)('%s carries complete, truthful metadata', (id) => {
    const entry = template(id)
    expect(entry.name.trim().length).toBeGreaterThan(0)
    expect(entry.description.trim().length).toBeGreaterThan(10)
    expect(entry.component).toBeTruthy()
    expect(entry.source).toEqual({
      repository: 'remotion-templates',
      repositoryUrl: 'https://github.com/deangilmoreremix/remotion-templates',
      sourcePath: `templates/${id.replace(/^rve-/, '')}.tsx`,
      license: 'MIT',
      attribution: RVE_ATTRIBUTION,
    })
    expect(entry.capabilities.preview).toBe(true)
    expect(entry.capabilities.browserExport).toBe(true)
    expect((entry.capabilities.notes ?? '').length).toBeGreaterThan(0)
    expect(entry.previewCompatible).toBe(true)
    expect(entry.aspectRatios).toContain('16:9')
    for (const ratio of entry.aspectRatios ?? []) {
      expect(isRemotionDesignTemplateSupported(id, ratio).supported).toBe(true)
    }
    expect(entry.requiredMedia ?? []).toEqual([])
    expect(entry.animation?.durationInFrames).toBeGreaterThan(0)

    const slots = entry.textSlots ?? []
    const primary = slots.filter((slot) => slot.primary)
    expect(primary).toHaveLength(slots.length > 0 ? 1 : 0)
    expect(new Set(slots.map((slot) => slot.key)).size).toBe(slots.length)

    for (const binding of entry.media ?? []) {
      expect(['logo', 'product', 'service']).toContain(binding.role)
      expect(binding.required).not.toBe(true)
    }
  })

  it('classifies the full-scene designs with an intro-card placement', () => {
    for (const id of FULL_SCENE_IDS) {
      const entry = template(id)
      expect(entry.category, id).toBe('full-scene')
      expect(entry.placement).toMatchObject({ x: 0.5, y: 0.5, scale: 1 })
      expect(entry.placement?.endFrame, id).toBeGreaterThanOrEqual(90)
      expect(entry.placement?.endFrame, id).toBeLessThanOrEqual(150)
    }
  })

  it('classifies the overlays without an endFrame', () => {
    for (const id of OVERLAY_IDS) {
      const entry = template(id)
      expect(entry.category, id).not.toBe('full-scene')
      expect(entry.placement?.endFrame, id).toBeUndefined()
    }
  })

  it('declares brand media bindings for every image design', () => {
    for (const id of MEDIA_IDS) {
      const roles = (template(id).media ?? []).map((binding) => binding.role)
      expect(roles, id).toEqual(['product', 'service', 'logo'])
    }
  })

  it('declares no fixed SVG ids', () => {
    expect(BATCH_3H_FIXED_SVG_IDS).toEqual({})
  })
})

/* -------------------------------------------------------------------------- */
/* Rendering                                                                   */
/* -------------------------------------------------------------------------- */

describe('batch 3h — adapters render', () => {
  it.each(EXPECTED_IDS)('%s renders at several frames with no credit line', (id) => {
    for (const frame of [0, 15, 45, 90, 149]) {
      clock.frame = frame
      const { container, unmount } = renderDesign(id, { frame })
      expect(container.querySelector(`[data-remotion-design="${id}"]`)).not.toBeNull()
      expect(container.querySelector('[data-remotion-design-credit]')).toBeNull()
      expect(canvasOf(container).innerHTML.length).toBeGreaterThan(0)
      unmount()
    }
  })

  it.each(EXPECTED_IDS)('%s renders in 9:16, 1:1 and 4:5', (id) => {
    clock.frame = 60
    for (const [width, height] of [
      [1080, 1920],
      [1080, 1080],
      [1080, 1350],
    ]) {
      const { container, unmount } = renderDesign(id, { width, height, frame: 60 })
      expect(container.querySelector(`[data-remotion-design="${id}"]`)).not.toBeNull()
      unmount()
    }
  })

  it.each(OVERLAY_IDS)('%s keeps the canvas transparent (overlay)', (id) => {
    for (const [width, height] of [
      [1920, 1080],
      [1080, 1920],
    ]) {
      clock.frame = 30
      const { container, unmount } = renderDesign(id, {
        width,
        height,
        frame: 30,
        media: { product: PRODUCT_URL, service: null, logo: LOGO_URL },
      })
      expect(opaqueFullCanvasFills(container, width, height)).toEqual([])
      unmount()
    }
  })

  it.each(FULL_SCENE_IDS)('%s paints a designed full-frame background', (id) => {
    clock.frame = 30
    const { container } = renderDesign(id, { frame: 30 })
    const root = canvasOf(container).firstElementChild as HTMLElement
    const html = canvasOf(container).innerHTML
    // jsdom drops gradient values it cannot parse from the `background`
    // shorthand, so accept either the parsed style or the serialized markup.
    const painted =
      !isTransparent(root.style.background) ||
      !isTransparent(root.style.backgroundColor) ||
      /gradient|rgb\(/.test(html)
    expect(painted).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */
/* Media                                                                       */
/* -------------------------------------------------------------------------- */

describe('batch 3h — brand media', () => {
  it.each(EXPECTED_IDS)('%s renders no http(s) image without brand media', (id) => {
    for (const frame of [0, 60]) {
      clock.frame = frame
      const { container, unmount } = renderDesign(id, { frame, media: NO_MEDIA })
      expect(srcs(container).filter((src) => /^https?:/i.test(src))).toEqual([])
      expect(container.innerHTML).not.toMatch(/unsplash|pexels/i)
      unmount()
    }
  })

  it.each(EXPECTED_IDS)('%s also renders no http(s) image with an empty media map', (id) => {
    const { container } = renderDesign(id, { media: {} })
    expect(srcs(container).filter((src) => /^https?:/i.test(src))).toEqual([])
  })

  it.each(MEDIA_IDS)('%s shows a brand placeholder with the business name when there is no media', (id) => {
    clock.frame = 120
    const { container } = renderDesign(id, { frame: 120, media: NO_MEDIA })
    // The zoom reveal's only text is its caption (the headline); every other
    // image design carries the business name on its placeholder.
    const expected = id === 'rve-image-zoom-reveal' ? 'Roofing done right' : 'Acme Roofing'
    expect(canvasOf(container).textContent).toContain(expected)
  })

  it.each(MEDIA_IDS)('%s uses the brand product image when provided', (id) => {
    clock.frame = 60
    const { container } = renderDesign(id, {
      frame: 60,
      media: { product: PRODUCT_URL, service: SERVICE_URL, logo: LOGO_URL },
    })
    const found = srcs(container)
    expect(found).toContain(PRODUCT_URL)
    for (const src of found) expect(BRAND_URLS).toContain(src)
  })

  it.each(MEDIA_IDS)('%s uses the logo when it is the only brand image', (id) => {
    clock.frame = 60
    const { container } = renderDesign(id, {
      frame: 60,
      media: { product: null, service: null, logo: LOGO_URL },
    })
    expect(srcs(container)).toContain(LOGO_URL)
    expect(srcs(container).every((src) => src === LOGO_URL)).toBe(true)
  })

  it('cycles through several brand images in the galleries', () => {
    for (const id of ['rve-gallery-grid', 'rve-masonry-gallery']) {
      const { container, unmount } = renderDesign(id, {
        frame: 60,
        media: { product: PRODUCT_URL, service: SERVICE_URL, logo: LOGO_URL },
      })
      const found = srcs(container)
      expect(found).toHaveLength(6)
      for (const url of BRAND_URLS) expect(found).toContain(url)
      unmount()
    }
  })

  it('shows the before/after photo twice, greyscale on the before side', () => {
    const { container } = renderDesign('rve-image-comparison-slider', {
      frame: 45,
      media: { product: PRODUCT_URL, service: null, logo: null },
    })
    const imgs = Array.from(container.querySelectorAll<HTMLImageElement>('img'))
    expect(imgs.map((img) => img.getAttribute('src'))).toEqual([PRODUCT_URL, PRODUCT_URL])
    expect(imgs.some((img) => (img.style.filter || '').includes('grayscale'))).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */
/* Text                                                                        */
/* -------------------------------------------------------------------------- */

describe('batch 3h — brand text', () => {
  const LONG = 'The Extraordinarily Long Business Name Roofing And Siding Company Incorporated'

  it.each(EXPECTED_IDS.filter((id) => (template(id).textSlots ?? []).length > 0))(
    '%s truncates a very long name/offer instead of overflowing',
    (id) => {
      clock.frame = 120
      const { container } = renderDesign(id, {
        frame: 120,
        text: LONG,
        textSlots: {
          businessName: LONG,
          headline: LONG,
          offer: LONG,
          cta: LONG,
          website: LONG,
        },
      })
      const text = canvasOf(container).textContent ?? ''
      expect(text).not.toContain(LONG)
      expect(text).toContain('…')
    },
  )

  it('puts the offer at the centre of the particle burst', () => {
    clock.frame = 30
    const { container } = renderDesign('rve-particle-explosion', { frame: 30 })
    expect(canvasOf(container).textContent).toContain('20% off this week')
    expect(canvasOf(container).textContent).not.toContain('BOOM!')
  })

  it('titles the feature carousel with the business name and fills the cards', () => {
    const { container } = renderDesign('rve-rotating-carousel', { frame: 30 })
    const text = canvasOf(container).textContent ?? ''
    for (const value of ['Acme Roofing', 'Roofing done right', '20% off this week', 'Book now']) {
      expect(text).toContain(value)
    }
    expect(text).not.toContain('Our Features')
    expect(text).not.toContain('Feature 1')
  })

  it('never reaches the upstream demo strings', () => {
    const demo = [
      'Mountain',
      'Featured Image',
      'Summer 2024',
      'Main Content',
      'Speaker',
      'Photo 1',
      'Our Features',
      'BOOM!',
    ]
    for (const id of EXPECTED_IDS) {
      clock.frame = 120
      const { container, unmount } = renderDesign(id, { frame: 120 })
      const text = canvasOf(container).textContent ?? ''
      for (const value of demo) expect(text, `${id}: ${value}`).not.toContain(value)
      unmount()
    }
  })
})

/* -------------------------------------------------------------------------- */
/* Edited copies                                                               */
/* -------------------------------------------------------------------------- */

describe('batch 3h — edited upstream copies keep the upstream defaults', () => {
  it('reproduces the upstream copy and images with no props', () => {
    clock.frame = 90
    const cases: Array<[React.ReactElement, string[]]> = [
      [<ImageZoomReveal key="a" />, ['Featured Image']],
      [<PolaroidFrame key="b" />, ['Summer 2024']],
      [<ParticleExplosion key="c" />, ['BOOM!']],
      [<RotatingCarousel key="d" />, ['Our Features', 'Feature 1', 'Feature 4']],
      [<PictureInPicture key="e" />, ['Main Content', 'Speaker']],
      [<ImageCarousel key="f" />, ['Mountain', 'Ocean', 'Forest']],
      [<ImageComparisonSlider key="g" />, ['Before', 'After']],
      [<PhotoStack key="h" />, ['Photo 1', 'Photo 2', 'Photo 3']],
    ]
    for (const [element, strings] of cases) {
      const { container, unmount } = render(element)
      for (const value of strings) expect(container.textContent).toContain(value)
      unmount()
    }
  })

  it('keeps the upstream remote image defaults documented (never used by an adapter)', () => {
    const kb = render(<KenBurns />)
    expect(kb.container.querySelector('img')?.getAttribute('src')).toBe(
      'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba',
    )
    kb.unmount()
    const zp = render(<ZoomPulse />)
    expect(zp.container.querySelector('img')?.getAttribute('src')).toMatch(/^https:\/\/images\.pexels\.com\//)
    zp.unmount()
  })

  it('drives Ken Burns and Zoom Pulse from the frame, not a CSS animation', () => {
    clock.frame = 0
    const start = render(<KenBurns imageUrl="/a.jpg" duration={5} />)
    const t0 = start.container.querySelector('img')?.style.transform ?? ''
    start.unmount()
    clock.frame = 150
    const end = render(<KenBurns imageUrl="/a.jpg" duration={5} />)
    const t1 = end.container.querySelector('img')?.style.transform ?? ''
    expect(t0).toContain('scale(1)')
    expect(t1).toContain('scale(1.5)')
    expect(end.container.innerHTML).not.toMatch(/animation|@keyframes/)
    end.unmount()

    clock.frame = 60 // half of the 4 s loop → the 50 % keyframe
    const pulse = render(<ZoomPulse imageUrl="/a.jpg" />)
    expect(pulse.container.querySelector('img')?.style.transform).toBe('scale(1.1)')
    pulse.unmount()
  })

  it('keeps the upstream gallery, masonry, wave and rain defaults renderable', () => {
    clock.frame = 30
    for (const element of [
      <GalleryGrid key="1" />,
      <MasonryGallery key="2" />,
      <LiquidWave key="3" />,
      <MatrixRain key="4" />,
    ]) {
      const { container, unmount } = render(element)
      expect(container.innerHTML.length).toBeGreaterThan(0)
      unmount()
    }
    const wave = render(<LiquidWave />)
    expect(wave.container.querySelector('linearGradient')?.getAttribute('id')).toBe('gradient')
    wave.unmount()
  })

  it('gives the liquid wave adapter a per-instance gradient id', () => {
    const { container } = renderDesign('rve-liquid-wave', { frame: 10 })
    const id = container.querySelector('linearGradient')?.getAttribute('id') ?? ''
    expect(id).not.toBe('gradient')
    expect(id).toMatch(/^rve-liquid-wave-[A-Za-z0-9_-]+$/)
    expect(container.querySelector('path')?.getAttribute('fill')).toBe(`url(#${id})`)
  })
})
