// @vitest-environment jsdom
/**
 * The Phase 2 batch-1 design catalog.
 *
 * These tests cover the ten batch-1 designs end to end: the registry entries
 * (ids, attribution, categories, support checks, text slots) and the adapter
 * components (do they actually render the frozen upstream with the customer's
 * brand data, do they stay transparent, do they carry the credit line).
 *
 * The frozen upstream files live in `../_upstream/<id>/`; none of them is
 * edited by this lane — only their props are supplied.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import {
  getRemotionDesignTemplate,
  isRemotionDesignTemplateSupported,
  listRemotionDesignTemplates,
  listRemotionDesignTemplatesByCategory,
} from '../registry'
import {
  REMOTION_DESIGN_ATTRIBUTION,
  REMOTION_DESIGN_BATCH1_TEMPLATES,
  REMOTION_DESIGN_LICENSE_NOTICE,
} from '../catalog'
import type {
  RemotionDesignComponentProps,
  RemotionDesignTemplate,
  RemotionDesignTextField,
} from '../types'

/**
 * The upstream templates call `useCurrentFrame()` and `useVideoConfig()`,
 * which need a registered composition. The real implementations of everything
 * else (`AbsoluteFill`, `interpolate`, `spring`, `Easing`, `random`, `Img`)
 * are kept so the adapters are exercised against the real upstream code.
 */
const clock = vi.hoisted(() => ({ frame: 0 }))

vi.mock('remotion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('remotion')>()
  const ReactMod = await import('react')
  return {
    ...actual,
    useCurrentFrame: () => clock.frame,
    useVideoConfig: () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 150 }),
    // The real <Img> renders through <Sequence> and the internal
    // useVideoConfig, so it needs a registered composition. These tests only
    // cover the adapter's mapping, so a plain <img> stands in for it.
    Img: ({ src, ...rest }: { src: string }) =>
      ReactMod.createElement('img', { src, alt: '', ...rest }),
  }
})

/** The ten batch-1 ids, in registration order. */
const BATCH1_IDS = [
  'starfield-warp',
  'logo-bounce-drop',
  'logo-mask-wipe',
  'logo-split-reveal',
  'brush-stroke-reveal',
  'text-mask-reveal',
  'glitch-text',
  'logo-blur-reveal',
  'chapter-title',
  'bar-chart-anim',
]

const VALID_TEXT_FIELDS: RemotionDesignTextField[] = [
  'businessName',
  'headline',
  'offer',
  'cta',
  'phone',
  'website',
]

const LOGO_URL = 'https://cdn.example.com/brand/logo.png'

/** The brand value behind each field, as the composition would resolve it. */
const BRAND_VALUES: Record<RemotionDesignTextField, string> = {
  businessName: 'Acme Roofing',
  headline: 'Roofing done right',
  offer: '20% off this week',
  cta: 'Book now',
  phone: '555-0100',
  website: 'acme.example.com',
}

/**
 * The props the composition hands to a design component.
 *
 * `textSlots` is built from the design's OWN declared slots — the
 * composition only resolves the slots a design declares, and the primary slot
 * receives the layer's own text.
 */
function makeProps(
  template: RemotionDesignTemplate,
  overrides: Partial<RemotionDesignComponentProps> = {},
): RemotionDesignComponentProps {
  const slots: Record<string, string> = {}
  for (const slot of template.textSlots ?? []) {
    slots[slot.key] = BRAND_VALUES[slot.field]
  }
  const primary = (template.textSlots ?? []).find((slot) => slot.primary)
  const primaryValue = primary ? BRAND_VALUES[primary.field] : ''

  return {
    text: primaryValue,
    textSlots: slots,
    colors: {
      primary: '#29d3f2',
      accent: '#28c98b',
      text: '#ffffff',
      backgroundDim: 0.18,
    },
    media: { logo: LOGO_URL, product: null, service: null },
    box: { leftPx: 0, topPx: 0, widthPx: 1920, heightPx: 1080 },
    width: 1920,
    height: 1080,
    frame: 0,
    fps: 30,
    opacity: 1,
    color: '#fff',
    ...overrides,
  }
}

function renderTemplate(
  template: RemotionDesignTemplate,
  overrides: Partial<RemotionDesignComponentProps> = {},
) {
  const Component = template.component
  return render(<Component {...makeProps(template, overrides)} />)
}

beforeEach(() => {
  clock.frame = 0
})

describe('Phase 2 batch-1 catalog', () => {
  it('registers every batch-1 design under its planned id', () => {
    const ids = listRemotionDesignTemplates().map((template) => template.id)
    for (const id of BATCH1_IDS) {
      expect(ids).toContain(id)
      expect(getRemotionDesignTemplate(id)).toBeDefined()
    }
  })

  it('keeps the registry ids unique', () => {
    const ids = listRemotionDesignTemplates().map((template) => template.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('registers exactly the ten batch-1 templates in the catalog', () => {
    expect(REMOTION_DESIGN_BATCH1_TEMPLATES).toHaveLength(BATCH1_IDS.length)
    expect(REMOTION_DESIGN_BATCH1_TEMPLATES.map((template) => template.id)).toEqual(BATCH1_IDS)
  })

  it('gives every batch-1 design a component and a licensed, attributed source', () => {
    for (const template of REMOTION_DESIGN_BATCH1_TEMPLATES) {
      expect(template.component).toBeTruthy()
      expect(template.source.license).toBe('MIT')
      expect(template.source.attribution.trim().length).toBeGreaterThan(0)
      expect(template.source.attribution).toBe(REMOTION_DESIGN_ATTRIBUTION)
      expect(template.source.repository).toBe('free-remotion-templates')
      expect(template.source.sourcePath).toMatch(/^src\/components\/.+\.tsx$/)
      expect(template.source.repositoryUrl).toMatch(/^https:\/\/github\.com\//)
    }
  })

  it('declares a truthful browser export capability', () => {
    for (const template of REMOTION_DESIGN_BATCH1_TEMPLATES) {
      expect(template.capabilities.preview).toBe(true)
      expect(template.capabilities.browserExport).toBe(true)
      const notes = template.capabilities.notes ?? ''
      expect(notes.trim().length).toBeGreaterThan(20)
      // The note has to say something the customer can act on.
      expect(notes).toMatch(/browser export|Renders|export/i)
    }
  })

  it('carries the MIT permission notice for the product credits surface', () => {
    expect(REMOTION_DESIGN_LICENSE_NOTICE).toContain('Copyright (c) 2026 Trimora Inc.')
    expect(REMOTION_DESIGN_ATTRIBUTION).toContain('© 2026 Trimora Inc.')
    expect(REMOTION_DESIGN_ATTRIBUTION).toContain('MIT License')
  })

  it('lists every batch-1 design under its category', () => {
    for (const template of REMOTION_DESIGN_BATCH1_TEMPLATES) {
      const found = listRemotionDesignTemplatesByCategory(template.category)
      expect(found.map((entry) => entry.id)).toContain(template.id)
    }
  })

  it('supports 16:9 for every batch-1 design', () => {
    for (const id of BATCH1_IDS) {
      const check = isRemotionDesignTemplateSupported(id, '16:9')
      expect(check.supported).toBe(true)
      expect(check.reason).toBeUndefined()
    }
  })

  it('supports every Phase 2 aspect ratio for every batch-1 design', () => {
    for (const id of BATCH1_IDS) {
      for (const ratio of ['16:9', '9:16', '1:1', '4:5'] as const) {
        expect(isRemotionDesignTemplateSupported(id, ratio).supported).toBe(true)
      }
    }
  })

  it('declares exactly one primary text slot with a known brand field', () => {
    for (const template of REMOTION_DESIGN_BATCH1_TEMPLATES) {
      const slots = template.textSlots ?? []
      const primary = slots.filter((slot) => slot.primary)
      if (slots.length === 0) {
        // The starfield is textless by design; the upstream label stays
        // undefined so no demo copy can appear.
        expect(template.id).toBe('starfield-warp')
        continue
      }
      expect(primary).toHaveLength(1)
      expect(VALID_TEXT_FIELDS).toContain(primary[0].field)
      // The slot keys are unique and stable inside the design.
      expect(new Set(slots.map((slot) => slot.key)).size).toBe(slots.length)
      for (const slot of slots) {
        expect(VALID_TEXT_FIELDS).toContain(slot.field)
      }
    }
  })

  it('keeps the full-frame effect at scale 1 and bounds every other design', () => {
    for (const template of REMOTION_DESIGN_BATCH1_TEMPLATES) {
      const scale = template.placement?.scale ?? 1
      if (template.id === 'starfield-warp') {
        expect(scale).toBe(1)
        expect(template.placement?.animation).toBe('none')
        expect(template.placement?.opacity).toBe(1)
        continue
      }
      expect(scale).toBeGreaterThan(0)
      expect(scale).toBeLessThan(1)
    }
  })
})

describe('Phase 2 batch-1 adapters', () => {
  it('renders the starfield as a field of stars and no demo label', () => {
    const template = getRemotionDesignTemplate('starfield-warp') as RemotionDesignTemplate
    const { container } = renderTemplate(template)
    expect(container.textContent).not.toContain('BACKGROUND')
    // Every star is a div painted with a gradient and a glow.
    const stars = container.querySelectorAll('div[style*="linear-gradient"]')
    expect(stars.length).toBeGreaterThan(40)
  })

  it('renders the bouncing wordmark without the upstream demo name', () => {
    const template = getRemotionDesignTemplate('logo-bounce-drop') as RemotionDesignTemplate
    const { container } = renderTemplate(template)
    expect(container.textContent).toContain('Acme Roofing')
    expect(container.textContent).not.toContain('RENDERCOMP')
    // The upstream must stay in text mode: no inline <svg> is rendered.
    expect(container.querySelector('svg')).toBeNull()
  })

  it('renders the mask wipe badge and wordmark without the upstream demo copy', () => {
    const template = getRemotionDesignTemplate('logo-mask-wipe') as RemotionDesignTemplate
    const { container } = renderTemplate(template)
    expect(container.textContent).toContain('Acme Roofing')
    expect(container.textContent).not.toContain('ACME INC.')
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('renders the split wordmark twice (once per half)', () => {
    const template = getRemotionDesignTemplate('logo-split-reveal') as RemotionDesignTemplate
    const { container } = renderTemplate(template)
    expect(container.textContent).toContain('Acme Roofing')
    expect(container.textContent).not.toContain('RENDERCOMP')
    const halves = container.querySelectorAll('div[style*="clip-path"]')
    expect(halves.length).toBeGreaterThanOrEqual(2)
  })

  it('renders the brush-stroke headline and its subline', () => {
    const template = getRemotionDesignTemplate('brush-stroke-reveal') as RemotionDesignTemplate
    const { container } = renderTemplate(template)
    expect(container.textContent).toContain('Roofing done right')
    expect(container.textContent).toContain('20% off this week')
    expect(container.textContent).not.toContain('Brush Stroke')
    expect(container.textContent).not.toContain('painted on, stroke by stroke')
  })

  it('renders the masked lines and never the upstream fallback', () => {
    const template = getRemotionDesignTemplate('text-mask-reveal') as RemotionDesignTemplate
    const { container } = renderTemplate(template)
    // The upstream upper-cases every line.
    expect(container.textContent).toContain('ROOFING DONE RIGHT')
    expect(container.textContent).not.toContain('REVEAL')
    expect(container.textContent).not.toContain('DESIGN IN MOTION')
  })

  it('renders the glitch headline without the upstream demo word', () => {
    const template = getRemotionDesignTemplate('glitch-text') as RemotionDesignTemplate
    const { container } = renderTemplate(template)
    expect(container.textContent).toContain('Roofing done right')
    expect(container.textContent).not.toContain('OVERDRIVE')
  })

  it('renders the defocusing wordmark without the upstream demo word', () => {
    const template = getRemotionDesignTemplate('logo-blur-reveal') as RemotionDesignTemplate
    const { container } = renderTemplate(template)
    expect(container.textContent).toContain('Acme Roofing')
    expect(container.textContent).not.toContain('HELLO')
    // The upstream's single rasteriser-dependent feature is the blur.
    expect(container.querySelector('[style*="blur"]')).not.toBeNull()
  })

  it('renders the chapter label, title and subtitle', () => {
    const template = getRemotionDesignTemplate('chapter-title') as RemotionDesignTemplate
    const { container } = renderTemplate(template)
    expect(container.textContent).toContain('20% off this week')
    expect(container.textContent).toContain('Roofing done right')
    expect(container.textContent).toContain('Acme Roofing')
    expect(container.textContent).not.toContain('Chapter One: The Beginning')
  })

  it('renders the bar chart with the pinned placeholder bars', () => {
    const template = getRemotionDesignTemplate('bar-chart-anim') as RemotionDesignTemplate
    const { container } = renderTemplate(template)
    expect(container.textContent).toContain('Roofing done right')
    expect(container.textContent).toContain('20% off this week')
    expect(container.textContent).toContain('Placeholder 1')
    expect(container.textContent).not.toContain('Quarterly Revenue')
    expect(container.textContent).not.toContain('Q1')
  })

  it('draws the MIT credit line inside every batch-1 design', () => {
    for (const template of REMOTION_DESIGN_BATCH1_TEMPLATES) {
      const { container, unmount } = renderTemplate(template)
      const credit = container.querySelector('[data-remotion-design-credit]')
      expect(credit).not.toBeNull()
      expect(credit?.textContent).toContain('Trimora')
      unmount()
    }
  })

  it('degrades gracefully when the customer has no logo', () => {
    for (const template of REMOTION_DESIGN_BATCH1_TEMPLATES) {
      const { container, unmount } = renderTemplate(template, {
        media: { logo: null, product: null, service: null },
      })
      expect(container.innerHTML.length).toBeGreaterThan(0)
      // No broken image: none of these designs renders an image at all.
      for (const image of Array.from(container.querySelectorAll('img'))) {
        expect(image.getAttribute('src')?.trim().length ?? 0).toBeGreaterThan(0)
      }
      unmount()
    }
  })

  it('never paints an opaque full-canvas background over the video', () => {
    for (const template of REMOTION_DESIGN_BATCH1_TEMPLATES) {
      const { container, unmount } = renderTemplate(template)
      const stage = container.querySelector('[data-remotion-design]') as HTMLElement
      const canvas = container.querySelector('[data-remotion-design-canvas]') as HTMLElement
      const upstreamRoot = canvas?.firstElementChild as HTMLElement | null

      expect(stage.style.background).toBe('')
      expect(stage.style.backgroundColor).toBe('')
      expect(canvas.style.background).toBe('')
      expect(canvas.style.backgroundColor).toBe('')
      // The full-frame starfield composites transparently as well.
      expect(upstreamRoot?.style.backgroundColor).toBe('transparent')
      unmount()
    }
  })

  it('scales the composition-sized canvas into the design box', () => {
    const template = getRemotionDesignTemplate('glitch-text') as RemotionDesignTemplate
    const { container } = renderTemplate(template, {
      box: { leftPx: 0, topPx: 0, widthPx: 960, heightPx: 540 },
    })
    const canvas = container.querySelector('[data-remotion-design-canvas]') as HTMLElement
    expect(canvas.style.width).toBe('1920px')
    expect(canvas.style.height).toBe('1080px')
    expect(canvas.style.transform).toBe('scale(0.5, 0.5)')
    expect(canvas.style.transformOrigin).toBe('top left')
  })
})
