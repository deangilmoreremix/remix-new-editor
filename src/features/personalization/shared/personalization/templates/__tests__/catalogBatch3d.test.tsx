// @vitest-environment jsdom
/**
 * Phase 4 porting batch 3d — the seven repo-3 templates
 * (`remotion-video-templates`, Alejandro Brito) and five repo-2 logo reveals
 * (`remotion-templates`, React Video Editor).
 *
 * The designs are rendered for real inside a Remotion composition context
 * (`<Thumbnail>` from `@remotion/player`), not with mocked hooks: several of
 * the upstreams lay themselves out with `<Sequence>` / `<Series>` (and the
 * promo with `@remotion/transitions`), which need a
 * real timeline.
 */
import React, { act } from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { Thumbnail } from '@remotion/player'

import {
  BATCH_3D_FIXED_SVG_IDS,
  BATCH_3D_TEMPLATES,
  britoPromoTemplate,
} from '../designs/batch3d/entries'
import {
  BRITO_ATTRIBUTION,
  BRITO_LICENSE_NOTICE,
  britoRootSelector,
} from '../designs/batch3d/britoShared'
import { britoBrandCaptions } from '../designs/batch3d/CaptionedShortDesign'
import { britoKineticLines } from '../designs/batch3d/KineticTextDesign'
import { promoTemplateCalculateMetadata, promoTemplateDefaultProps } from '../_upstream/brito-promo/PromoTemplate'
import { RVE_ATTRIBUTION } from '../designs/rveSharedDesign'
import { listRemotionDesignTemplates } from '../registry'
import type {
  RemotionDesignComponentProps,
  RemotionDesignTemplate,
  RemotionDesignTextField,
} from '../types'

const HAS_BRITO_CLONE = fs.existsSync('/home/user/deangilmoreremix/remotion-video-templates/LICENSE')

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const EXPECTED_IDS = [
  'brito-logo-intro',
  'brito-lower-thirds',
  'brito-kinetic-text',
  'brito-bar-chart-race',
  'brito-line-chart',
  'brito-captioned-short',
  'brito-promo',
  'rve-logo-fade-reveal',
  'rve-logo-glitch-reveal',
  'rve-logo-scale-rotate',
  'rve-logo-spin-reveal',
  'rve-logo-typewriter',
]

const OVERLAY_CATEGORIES = ['animated-headline', 'logo-reveal', 'lower-third', 'visual-effect', 'other']
const CARD_CATEGORIES = ['full-scene', 'data-visualization', 'transition']

const VALID_TEXT_FIELDS: RemotionDesignTextField[] = [
  'businessName',
  'headline',
  'offer',
  'cta',
  'phone',
  'website',
]

const SIZES = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
} as const

const LOGO_URL = 'https://cdn.example.com/brand/logo.png'
const PRODUCT_URL = 'https://cdn.example.com/brand/product.png'

function makeProps(
  template: RemotionDesignTemplate,
  overrides: Partial<RemotionDesignComponentProps> = {},
): RemotionDesignComponentProps {
  const width = overrides.width ?? 1920
  const height = overrides.height ?? 1080
  const brand: Record<RemotionDesignTextField, string> = {
    businessName: 'Acme Roofing',
    headline: 'Roofing done right',
    offer: '20% off this week',
    cta: 'Book now',
    phone: '555 0100',
    website: 'acmeroofing.example',
  }
  const textSlots: Record<string, string> = {}
  for (const slot of template.textSlots ?? []) textSlots[slot.key] = brand[slot.field]
  const primary = (template.textSlots ?? []).find((slot) => slot.primary)
  return {
    ...(template.defaultProps ?? {}),
    text: primary ? brand[primary.field] : '',
    textSlots,
    colors: { primary: '#d9ff00', accent: '#28c98b', text: '#ffffff', backgroundDim: 0.18 },
    media: { logo: LOGO_URL, product: PRODUCT_URL, service: null },
    box: { leftPx: 0, topPx: 0, widthPx: width, heightPx: height },
    width,
    height,
    frame: 0,
    fps: 30,
    opacity: 1,
    color: '#ffffff',
    ...overrides,
  } as RemotionDesignComponentProps
}

const mounted: Array<{ root: Root; host: HTMLElement }> = []

/** Renders a design inside a real Remotion composition at `frame`. */
async function renderAt(
  template: RemotionDesignTemplate,
  frame: number,
  overrides: Partial<RemotionDesignComponentProps> = {},
): Promise<HTMLElement> {
  const props = makeProps(template, overrides)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push({ root, host })
  const Component = template.component as unknown as React.ComponentType<Record<string, unknown>>
  await act(async () => {
    root.render(
      <Thumbnail
        component={Component}
        compositionWidth={props.width}
        compositionHeight={props.height}
        frameToDisplay={frame}
        durationInFrames={600}
        fps={30}
        inputProps={props as unknown as Record<string, unknown>}
      />,
    )
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return host
}

function cleanup(): void {
  while (mounted.length > 0) {
    const entry = mounted.pop()!
    act(() => entry.root.unmount())
    entry.host.remove()
  }
}

/** The design's text without the credit block. */
function designText(host: HTMLElement): string {
  const canvas = host.querySelector('[data-remotion-design-canvas]')
  return (canvas?.textContent ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
}

const originalWarn = console.warn
const originalError = console.error

beforeAll(() => {
  // jsdom has no FontFaceSet / ResizeObserver; the warnings they cause are
  // test-environment artifacts.
  console.warn = (...args: unknown[]) => {
    const first = typeof args[0] === 'string' ? args[0] : ''
    if (first.includes('bundled design font')) return
    originalWarn(...args)
  }
  if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
})

afterAll(() => {
  cleanup()
  console.warn = originalWarn
  console.error = originalError
})

/* -------------------------------------------------------------------------- */
/* Metadata                                                                    */
/* -------------------------------------------------------------------------- */

describe('batch 3d — registry entries', () => {
  it('exports every ported template, in order, with unique ids', () => {
    expect(BATCH_3D_TEMPLATES.map((entry) => entry.id)).toEqual(EXPECTED_IDS)
    expect(new Set(EXPECTED_IDS).size).toBe(EXPECTED_IDS.length)
  })

  it('is registered by the catalog', async () => {
    await import('../catalog')
    const ids = listRemotionDesignTemplates().map((entry) => entry.id)
    for (const id of EXPECTED_IDS) expect(ids, id).toContain(id)
  })

  it('gives every entry complete, truthful metadata', () => {
    for (const entry of BATCH_3D_TEMPLATES) {
      expect(entry.name.trim().length, entry.id).toBeGreaterThan(0)
      expect(entry.description.trim().length, entry.id).toBeGreaterThan(0)
      expect(entry.component, entry.id).toBeTruthy()
      expect(entry.capabilities.preview, entry.id).toBe(true)
      expect(entry.capabilities.browserExport, entry.id).toBe(true)
      expect((entry.capabilities.notes ?? '').length, entry.id).toBeGreaterThan(0)
      expect(entry.previewCompatible, entry.id).toBe(true)
      expect(entry.aspectRatios, entry.id).toContain('16:9')
      expect(entry.animation?.durationInFrames ?? 0, entry.id).toBeGreaterThan(0)
      expect(entry.requiredMedia ?? [], entry.id).toEqual([])
    }
  })

  it('attributes each entry to the right upstream', () => {
    for (const entry of BATCH_3D_TEMPLATES) {
      expect(entry.source.license, entry.id).toBe('MIT')
      if (entry.id.startsWith('brito-')) {
        expect(entry.source.repository).toBe('remotion-video-templates')
        expect(entry.source.repositoryUrl).toBe(
          'https://github.com/deangilmoreremix/remotion-video-templates',
        )
        expect(entry.source.sourcePath).toMatch(/^src\/templates\/.+\.tsx$/)
        expect(entry.source.attribution).toBe(BRITO_ATTRIBUTION)
      } else {
        expect(entry.source.repository).toBe('remotion-templates')
        expect(entry.source.repositoryUrl).toBe(
          'https://github.com/deangilmoreremix/remotion-templates',
        )
        expect(entry.source.sourcePath).toMatch(/^templates\/logo-.+\.tsx$/)
        expect(entry.source.attribution).toBe(RVE_ATTRIBUTION)
      }
    }
  })

  it('declares exactly one primary text slot with a known field', () => {
    for (const entry of BATCH_3D_TEMPLATES) {
      const slots = entry.textSlots ?? []
      expect(slots.length, entry.id).toBeGreaterThan(0)
      expect(slots.filter((slot) => slot.primary), entry.id).toHaveLength(1)
      for (const slot of slots) expect(VALID_TEXT_FIELDS, entry.id).toContain(slot.field)
      expect(new Set(slots.map((slot) => slot.key)).size, entry.id).toBe(slots.length)
    }
  })

  it('classifies overlays and intro cards with the right placement', () => {
    for (const entry of BATCH_3D_TEMPLATES) {
      const placement = entry.placement!
      if (CARD_CATEGORIES.includes(entry.category)) {
        expect(placement, entry.id).toMatchObject({ x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none' })
        expect(placement.endFrame, entry.id).toBe(entry.animation?.durationInFrames)
        expect(placement.endFrame!, entry.id).toBeGreaterThanOrEqual(90)
        expect(placement.endFrame!, entry.id).toBeLessThanOrEqual(240)
      } else {
        expect(OVERLAY_CATEGORIES, entry.id).toContain(entry.category)
        expect(placement.endFrame, entry.id).toBeUndefined()
        expect(placement.scale, entry.id).toBeGreaterThan(0)
        expect(placement.scale, entry.id).toBeLessThan(1)
      }
    }
    const categories = Object.fromEntries(BATCH_3D_TEMPLATES.map((e) => [e.id, e.category]))
    expect(categories['brito-bar-chart-race']).toBe('data-visualization')
    expect(categories['brito-line-chart']).toBe('data-visualization')
    expect(categories['brito-promo']).toBe('full-scene')
    expect(categories['brito-lower-thirds']).toBe('lower-third')
  })

  it('declares no fixed SVG ids', () => {
    expect(BATCH_3D_FIXED_SVG_IDS).toEqual({})
  })

  // The upstream clone lives outside this repo; these comparisons run only
  // where it has been checked out (like batch 3a's clone check).
  it.skipIf(!HAS_BRITO_CLONE)('carries the verbatim repo-3 MIT licence with its copyright line', () => {
    const upstream = fs.readFileSync(
      '/home/user/deangilmoreremix/remotion-video-templates/LICENSE',
      'utf-8',
    )
    expect(BRITO_LICENSE_NOTICE.trim()).toBe(upstream.trim())
    expect(BRITO_LICENSE_NOTICE).toContain('Copyright (c) 2026 Alejandro Brito')
    expect(BRITO_ATTRIBUTION).toBe(
      '© 2026 Alejandro Brito — Remotion templates, MIT License. https://github.com/deangilmoreremix/remotion-video-templates',
    )
  })
})

/* -------------------------------------------------------------------------- */
/* Rendering                                                                   */
/* -------------------------------------------------------------------------- */

describe('batch 3d — the designs render with brand data', () => {
  it('renders every design at several frames in every supported format', async () => {
    for (const entry of BATCH_3D_TEMPLATES) {
      for (const ratio of entry.aspectRatios ?? []) {
        const size = SIZES[ratio]
        for (const frame of [0, 15, 60, 150]) {
          const host = await renderAt(entry, frame, size)
          const stage = host.querySelector(`[data-remotion-design="${entry.id}"]`)
          expect(stage, `${entry.id} ${ratio} @${frame}`).not.toBeNull()
          const canvas = host.querySelector('[data-remotion-design-canvas]') as HTMLElement
          expect(canvas.style.width, entry.id).toBe(`${size.width}px`)
          expect(canvas.style.height, entry.id).toBe(`${size.height}px`)
          cleanup()
        }
      }
    }
  }, 120000)

  it('shows the customer copy and never the upstream demo copy', async () => {
    const demo = [
      'Alejandro Brito',
      'Full-stack',
      "You don't need",
      'Monthly Active Users',
      'Morph',
      'Programmatic captions',
      'Company Name',
      'Your tagline here',
      'ACME STUDIO',
      'LOGO',
      'Introducing Morph',
    ]
    const frames: Record<string, number> = {
      'brito-logo-intro': 60,
      'brito-lower-thirds': 40,
      'brito-kinetic-text': 40,
      'brito-bar-chart-race': 100,
      'brito-line-chart': 100,
      'brito-captioned-short': 20,
      'brito-promo': 40,
      'rve-logo-typewriter': 170,
    }
    const expected: Record<string, string> = {
      'brito-lower-thirds': 'Acme Roofing',
      'brito-kinetic-text': 'Roofing done right',
      'brito-bar-chart-race': 'Roofing done right',
      'brito-line-chart': 'Roofing done right',
      'brito-captioned-short': 'ACME ROOFING',
      'brito-promo': 'Acme Roofing',
      'rve-logo-fade-reveal': 'Acme Roofing',
      'rve-logo-glitch-reveal': 'Acme Roofing',
      'rve-logo-scale-rotate': 'Acme Roofing',
      'rve-logo-spin-reveal': 'Acme Roofing',
      'rve-logo-typewriter': 'ACME ROOFING',
    }
    for (const entry of BATCH_3D_TEMPLATES) {
      const host = await renderAt(entry, frames[entry.id] ?? 60, {
        media: { logo: null, product: null, service: null },
      })
      const text = designText(host)
      if (expected[entry.id]) {
        // Word-by-word designs render each word in its own span (no spaces).
        const squash = (value: string) => value.toUpperCase().replace(/\s+/g, '')
        expect(squash(text), entry.id).toContain(squash(expected[entry.id]))
      }
      for (const literal of demo) expect(text, `${entry.id}: ${literal}`).not.toContain(literal)
      cleanup()
    }
  }, 60000)

  it('draws no credit block inside any design', async () => {
    for (const entry of BATCH_3D_TEMPLATES) {
      const host = await renderAt(entry, 30)
      expect(host.querySelector('[data-remotion-design-credit]'), entry.id).toBeNull()
      expect(host.textContent ?? '', entry.id).not.toContain('Permission is hereby granted')
      cleanup()
    }
  }, 60000)

  it('keeps every overlay transparent so the video shows through', async () => {
    for (const entry of BATCH_3D_TEMPLATES) {
      if (CARD_CATEGORIES.includes(entry.category)) continue
      const host = await renderAt(entry, 30)
      const stage = host.querySelector(`[data-remotion-design="${entry.id}"]`) as HTMLElement
      const canvas = host.querySelector('[data-remotion-design-canvas]') as HTMLElement
      const root = canvas.firstElementChild as HTMLElement
      expect(stage.style.backgroundColor, entry.id).toBe('transparent')
      expect(canvas.style.background, entry.id).toBe('')
      expect(canvas.style.backgroundColor, entry.id).toBe('')
      const rule = host.querySelector(`style[data-brito-design-style="${entry.id}"]`)
      if (rule) {
        // The upstream hard-codes its fill; a scoped !important rule clears it.
        expect(rule.textContent, entry.id).toContain('background: transparent !important')
        expect(root.matches(britoRootSelector(entry.id)), entry.id).toBe(true)
      } else {
        expect(root.style.backgroundColor, entry.id).toBe('transparent')
      }
      // No other element paints an opaque full-canvas fill.
      for (const el of Array.from(canvas.querySelectorAll<HTMLElement>('*'))) {
        if (el === root) continue
        const isFull = el.style.width === '100%' && el.style.height === '100%'
        const bg = el.style.backgroundColor
        if (isFull && bg) expect(bg, entry.id).toMatch(/transparent|rgba\(.+, 0\)/)
      }
      cleanup()
    }
  }, 60000)

  it('paints a brand-tinted canvas behind the charts', async () => {
    for (const id of ['brito-bar-chart-race', 'brito-line-chart']) {
      const entry = BATCH_3D_TEMPLATES.find((e) => e.id === id)!
      const host = await renderAt(entry, 30)
      const rule = host.querySelector(`style[data-brito-design-style="${id}"]`)
      expect(rule?.textContent, id).toContain('linear-gradient(')
      expect(rule?.textContent, id).toContain('!important')
      const canvas = host.querySelector('[data-remotion-design-canvas]') as HTMLElement
      expect((canvas.firstElementChild as HTMLElement).matches(britoRootSelector(id))).toBe(true)
      // Placeholder data, never the upstream demo series.
      expect(designText(host)).toContain('Sample A')
      cleanup()
    }
  })

  it('never draws a broken image without brand media, and uses the media when present', async () => {
    for (const entry of BATCH_3D_TEMPLATES) {
      const host = await renderAt(entry, 100, {
        media: { logo: null, product: null, service: null },
      })
      expect(host.querySelector('img'), entry.id).toBeNull()
      cleanup()
    }
    const withMedia: Record<string, [number, string]> = {
      'brito-logo-intro': [30, LOGO_URL],
      'brito-promo': [90, PRODUCT_URL],
      'rve-logo-fade-reveal': [30, LOGO_URL],
      'rve-logo-glitch-reveal': [30, LOGO_URL],
      'rve-logo-scale-rotate': [30, LOGO_URL],
      'rve-logo-spin-reveal': [30, LOGO_URL],
      'rve-logo-typewriter': [30, LOGO_URL],
    }
    for (const [id, [frame, url]] of Object.entries(withMedia)) {
      const entry = BATCH_3D_TEMPLATES.find((e) => e.id === id)!
      const host = await renderAt(entry, frame)
      const srcs = Array.from(host.querySelectorAll('img')).map((img) => img.getAttribute('src'))
      expect(srcs, id).toContain(url)
      cleanup()
    }
    // Without a logo the logo intro draws the branded monogram instead.
    const intro = BATCH_3D_TEMPLATES.find((e) => e.id === 'brito-logo-intro')!
    const host = await renderAt(intro, 60, { media: { logo: null, product: null, service: null } })
    expect(host.querySelector('[data-brito-placeholder="logo"]')?.textContent).toBe('AR')
    cleanup()
  }, 60000)

  it('truncates long copy so it fits the canvas', async () => {
    const long = 'Supercalifragilisticexpialidocious roofing and gutter specialists of the greater metropolitan area'
    const kinetic = BATCH_3D_TEMPLATES.find((e) => e.id === 'brito-kinetic-text')!
    const props = makeProps(kinetic, { width: 1080, height: 1920 })
    const lines = britoKineticLines({ ...props, text: long, textSlots: { headline: long, offer: '', cta: '' } })
    expect(lines).toHaveLength(1)
    expect(lines[0].text.split(' ').length).toBeLessThanOrEqual(5)
    for (const word of lines[0].text.split(' ')) expect(word.length).toBeLessThanOrEqual(14)

    const lower = BATCH_3D_TEMPLATES.find((e) => e.id === 'brito-lower-thirds')!
    const host = await renderAt(lower, 40, {
      width: 1080,
      height: 1920,
      textSlots: { name: long, role: long, website: '', phone: '' },
      text: long,
    })
    const name = host.querySelector('[data-remotion-design-canvas] p')?.textContent ?? ''
    expect(name.endsWith('…')).toBe(true)
    expect(name.length).toBeLessThan(long.length)
    cleanup()
  })
})

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

describe('batch 3d — captions and transitions', () => {
  it('times brand copy as word captions', () => {
    const captions = britoBrandCaptions(['Roofing done right', '20% off', 'Book now'], 16)
    expect(captions.map((c) => c.word)).toEqual(['Roofing', 'done', 'right', '20%', 'off', 'Book', 'now'])
    expect(captions[0].startMs).toBe(200)
    for (let i = 1; i < captions.length; i++) {
      expect(captions[i].startMs).toBeGreaterThan(captions[i - 1].endMs)
    }
    const many = britoBrandCaptions([Array.from({ length: 40 }, () => 'word').join(' ')], 16)
    expect(many).toHaveLength(16)
    // 16 words always end inside the design's fixed 300-frame length.
    expect((many[many.length - 1].endMs / 1000) * 30 + 20).toBeLessThan(300)
  })

  it('gives the promo the same length as the upstream calculateMetadata', () => {
    // Same total as the upstream's own calculateMetadata, for the 1-feature promo.
    const meta = promoTemplateCalculateMetadata({
      props: { ...promoTemplateDefaultProps, features: promoTemplateDefaultProps.features.slice(0, 1) },
    } as Parameters<typeof promoTemplateCalculateMetadata>[0]) as { durationInFrames: number }
    expect(meta.durationInFrames).toBe(200)
    expect(britoPromoTemplate.placement?.endFrame).toBe(200)
  })

  it('slides the feature scene in from the right during the transition', async () => {
    const host = await renderAt(britoPromoTemplate, 60)
    const transforms = Array.from(
      host.querySelectorAll<HTMLElement>('[data-remotion-design-canvas] *'),
    )
      .map((el) => el.style.transform)
      .filter((t) => t.startsWith('translateX(') && t.endsWith('%)'))
    // 10 frames into the 20-frame slide: entering at +50 %, exiting at −50 %
    // (@remotion/transitions adds a tiny epsilon to the entering scene).
    const offsets = transforms.map((t) => Number.parseFloat(t.slice('translateX('.length)))
    expect(offsets.some((v) => Math.abs(v - 50) < 0.01), transforms.join(', ')).toBe(true)
    expect(offsets.some((v) => Math.abs(v + 50) < 0.01), transforms.join(', ')).toBe(true)
    cleanup()
  })
})

/* -------------------------------------------------------------------------- */
/* Upstream copies                                                             */
/* -------------------------------------------------------------------------- */

describe('batch 3d — the upstream copies', () => {
  const upstreamDir = path.join(
    process.cwd(),
    'src',
    'features',
    'personalization',
    'shared',
    'personalization',
    'templates',
    '_upstream',
  )
  const dirs = fs
    .readdirSync(upstreamDir)
    .filter((name) => name.startsWith('brito-') || name.startsWith('rve-logo-'))
  const files = dirs.flatMap((dir) =>
    fs
      .readdirSync(path.join(upstreamDir, dir))
      .filter((name) => /\.(ts|tsx)$/.test(name))
      .map((name) => path.join(dir, name)),
  )

  /** The source with comments removed (headers are prose, URLs allowed there). */
  function code(file: string): string {
    const source = fs.readFileSync(path.join(upstreamDir, file), 'utf-8')
    return source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .map((line) => line.replace(/\s\/\/.*$/, ''))
      .join('\n')
  }

  it('covers every expected copy', () => {
    expect(dirs.sort()).toEqual(
      [
        'brito-bar-chart-race',
        'brito-captioned-short',
        'brito-kinetic-text',
        'brito-lib',
        'brito-line-chart',
        'brito-logo-intro',
        'brito-lower-thirds',
        'brito-promo',
        'rve-logo-fade-reveal',
        'rve-logo-glitch-reveal',
        'rve-logo-scale-rotate',
        'rve-logo-spin-reveal',
        'rve-logo-typewriter',
      ].sort(),
    )
  })

  it('contain no URLs, staticFile() or google-fonts imports outside comments', () => {
    for (const file of files) {
      const body = code(file)
      expect(body, file).not.toMatch(/https?:\/\//)
      expect(body, file).not.toContain('staticFile(')
      expect(body, file).not.toContain('@remotion/google-fonts')
      expect(body, file).not.toContain('.json"')
      expect(body, file).not.toMatch(/Math\.random|Date\.now/)
    }
  })

  it('carry a provenance header and record every deviation', () => {
    for (const file of files) {
      const source = fs.readFileSync(path.join(upstreamDir, file), 'utf-8')
      if (file.startsWith('brito-')) {
        expect(source, file).toContain(
          'https://github.com/deangilmoreremix/remotion-video-templates (main @ 90149464d51a43fcb90e15491bf0d681c1b0fa49)',
        )
        expect(source, file).toContain('Copyright (c) 2026 Alejandro Brito')
        expect(source, file).toContain(
          'Upstream code is reproduced verbatim apart from this header comment.',
        )
      } else {
        expect(source, file).toContain(
          'https://github.com/deangilmoreremix/remotion-templates (main @ 6209b724798e48ff395f8df1a6fa2d26082372b5)',
        )
        expect(source, file).toContain('DEVIATION RECORD')
      }
      if (/brito-lib\/(colors|springs|layout)|sample-data/.test(file)) {
        expect(source, file).not.toContain('DEVIATION RECORD')
      } else if (file.startsWith('brito-')) {
        expect(source, file).toContain('DEVIATION RECORD')
      }
    }
  })

  it.skipIf(!HAS_BRITO_CLONE)('keeps the brito copies byte-identical to upstream apart from the recorded edits', () => {
    const upstreamRoot = '/home/user/deangilmoreremix/remotion-video-templates/'
    const verbatim: Record<string, string> = {
      'brito-lib/colors.ts': 'src/lib/colors.ts',
      'brito-lib/springs.ts': 'src/lib/springs.ts',
      'brito-lib/layout.tsx': 'src/lib/layout.tsx',
      'brito-bar-chart-race/sample-data.ts': 'src/templates/ChartVideo/sample-data.ts',
    }
    for (const [copy, original] of Object.entries(verbatim)) {
      const source = fs.readFileSync(path.join(upstreamDir, copy), 'utf-8')
      const body = source.slice(source.indexOf('// SPDX-License-Identifier: MIT\n') + 32)
      expect(body, copy).toBe(fs.readFileSync(upstreamRoot + original, 'utf-8'))
    }
    // An edited copy differs from upstream only in the recorded places: with
    // the import specifiers normalised back, KineticText is identical.
    const kinetic = fs.readFileSync(path.join(upstreamDir, 'brito-kinetic-text/KineticText.tsx'), 'utf-8')
    const kineticBody = kinetic
      .slice(kinetic.indexOf('// SPDX-License-Identifier: MIT\n') + 32)
      .replace(/"\.\.\/brito-lib\//g, '"../../lib/')
    expect(kineticBody).toBe(
      fs.readFileSync(upstreamRoot + 'src/templates/KineticText/KineticText.tsx', 'utf-8'),
    )
  })
})
