// @vitest-environment jsdom
/**
 * The batch-2 designs — the four `remotion-templates` (React Video Editor)
 * templates that ship in Phase 2.
 *
 * These four are the first designs whose upstream file is EDITED (contract
 * addition C8 of `docs/phase2/handoffs/A6.md`): every hard-coded string,
 * colour and dimension became a prop whose default reproduces the upstream
 * value exactly. The tests below pin the three properties that matter:
 *
 *  1. the adapters render the upstream with the customer's brand data;
 *  2. the parameterisation actually took effect (a brand colour and a brand
 *     string change the output);
 *  3. the upstream's own defaults are preserved (rendering the copy with no
 *     props reproduces the original design).
 *
 * Plus the safety properties every design has to hold: a transparent canvas,
 * a credit line, no broken image when the brand has no logo, and registry
 * entries that are complete and truthfully described.
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

import { AnimatedText } from '../_upstream/rve-animated-text/AnimatedText'
import { CircularProgress } from '../_upstream/rve-circular-progress/CircularProgress'
import { PoppingText } from '../_upstream/rve-popping-text/PoppingText'
import { SlideText } from '../_upstream/rve-slide-text/SlideText'
import { RveAnimatedTextDesign } from '../designs/rveAnimatedTextDesign'
import { RveCircularProgressDesign } from '../designs/rveCircularProgressDesign'
import { RvePoppingTextDesign } from '../designs/rvePoppingTextDesign'
import { RveSlideTextDesign } from '../designs/rveSlideTextDesign'
import {
  RVE_ATTRIBUTION,
  RVE_CATALOG_ENTRIES,
  rveAnimatedTextTemplate,
  rveCircularProgressTemplate,
  rvePoppingTextTemplate,
  rveSlideTextTemplate,
} from '../designs/rveCatalogEntries'
import { RVE_LICENSE_NOTICE, RVE_UPSTREAM_CREDIT } from '../designs/rveSharedDesign'
import { listRemotionDesignTemplates } from '../registry'
import type { RemotionDesignComponentProps } from '../types'

/**
 * The upstream templates call `useCurrentFrame()` and `useVideoConfig()`,
 * which need a registered composition. Everything else is kept real so the
 * adapters are exercised against the actual upstream code.
 */
const clock = vi.hoisted(() => ({ frame: 0 }))

vi.mock('remotion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('remotion')>()
  return {
    ...actual,
    useCurrentFrame: () => clock.frame,
    useVideoConfig: () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 150 }),
  }
})

const LOGO_URL = 'https://cdn.example.com/brand/logo.png'

/** The brand colour the parameterisation tests push through the adapters. */
const BRAND_COLOR = '#ff0055'
const BRAND_COLOR_RGB = 'rgb(255, 0, 85)'

/** The brand copy the parameterisation tests push through the adapters. */
const BRAND_HEADLINE = 'Brand New Headline'

/** The props the composition hands to a design component. */
function makeProps(
  overrides: Partial<RemotionDesignComponentProps> = {},
): RemotionDesignComponentProps {
  return {
    text: 'Roofing done right',
    textSlots: {
      headline: 'Roofing done right',
      businessName: 'Acme Roofing',
      offer: '20% off this week',
      cta: 'Book now',
    },
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
    color: '#ffffff',
    ...overrides,
  }
}

/**
 * Normalises a CSS colour so a hex literal and its `rgb()` rendering
 * compare equal. jsdom normalises hex to `rgb()` when it parses a style, so
 * the raw attribute and the literal never match by accident.
 */
function normalizeColor(value: string): string {
  const raw = (value || '').trim().toLowerCase()
  if (!raw.startsWith('#')) return raw
  const hex = raw.slice(1)
  const expand = (part: string) => parseInt(part + part, 16)
  if (hex.length === 3) {
    return `rgb(${expand(hex[0])}, ${expand(hex[1])}, ${expand(hex[2])})`
  }
  if (hex.length === 6) {
    return `rgb(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(
      hex.slice(4, 6),
      16,
    )})`
  }
  return raw
}

/**
 * The copy a render shows, without the credit block.
 *
 * The upstream replaces a space with a non-breaking space, so the text is
 * normalised back to ordinary spaces before it is compared.
 */
function designText(container: HTMLElement): string {
  const canvas = container.querySelector('[data-remotion-design-canvas]')
  const root = (canvas as HTMLElement | null) ?? container
  return (root.textContent ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Every colour the design paints with, normalised. */
function designColors(container: HTMLElement): string[] {
  const canvas = container.querySelector('[data-remotion-design-canvas]')
  const root = (canvas as HTMLElement | null) ?? container
  return Array.from(root.querySelectorAll<HTMLElement>('*'))
    .map((el) => el.style?.color)
    .filter((value): value is string => Boolean(value))
    .map(normalizeColor)
}

/** The font size of the first element that declares one, normalised. */
function designFontSize(container: HTMLElement): string {
  const canvas = container.querySelector('[data-remotion-design-canvas]')
  const root = (canvas as HTMLElement | null) ?? container
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    const size = el.style?.fontSize
    if (size) return size
  }
  return ''
}

/** The text-shadow of the first element that declares one. */
function designTextShadow(container: HTMLElement): string {
  const canvas = container.querySelector('[data-remotion-design-canvas]')
  const root = (canvas as HTMLElement | null) ?? container
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    const shadow = el.style?.textShadow
    if (shadow) return shadow
  }
  return ''
}

beforeEach(() => {
  clock.frame = 0
})

/**
 * jsdom has no `FontFaceSet`, so the bundled typeface can never load here and
 * `useDesignFonts()` warns on every render. The warning is a test-environment
 * artifact (a real browser has `document.fonts`), so it is filtered out;
 * every OTHER warning still reaches the console.
 */
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

describe('batch 2 — the repo-2 designs render the upstream with brand data', () => {
  it('renders the animated headline with the customer text', () => {
    const { container } = render(<RveAnimatedTextDesign {...makeProps()} />)
    expect(container.innerHTML.length).toBeGreaterThan(0)
    expect(designText(container)).toContain('Roofing done right')
    // The upstream demo copy must never be reachable.
    expect(designText(container)).not.toContain('Hello Remotion')
  })

  it('renders the popping headline with the customer text', () => {
    const { container } = render(
      <RvePoppingTextDesign {...makeProps({
        text: 'Big Sale',
        textSlots: { headline: 'Big Sale', businessName: 'Acme Roofing' },
      })} />,
    )
    expect(container.innerHTML.length).toBeGreaterThan(0)
    expect(designText(container)).toContain('Big Sale')
    expect(designText(container)).not.toContain('BINGO')
  })

  it('renders the sliding headline with the customer text', () => {
    const { container } = render(<RveSlideTextDesign {...makeProps()} />)
    expect(container.innerHTML.length).toBeGreaterThan(0)
    expect(designText(container)).toContain('Roofing done right')
    expect(designText(container)).not.toContain('Sliding Text!')
  })

  it('renders the progress ring with its time-driven percentage', () => {
    clock.frame = 45
    const { container } = render(<RveCircularProgressDesign {...makeProps()} />)
    expect(container.innerHTML.length).toBeGreaterThan(0)
    // The percentage is a loop over the frame, not data.
    expect(designText(container)).toContain('50%')
  })
})

describe('batch 2 — the parameterisation took effect', () => {
  it('changes the animated headline’s colour and copy', () => {
    const upstream = render(<AnimatedText />)
    const upstreamText = designText(upstream.container)
    const upstreamColors = designColors(upstream.container)
    upstream.unmount()

    const branded = render(
      <RveAnimatedTextDesign {...makeProps({
        color: BRAND_COLOR,
        text: BRAND_HEADLINE,
        textSlots: { headline: BRAND_HEADLINE, businessName: 'Acme Roofing' },
      })} />,
    )

    expect(designText(branded.container)).toContain(BRAND_HEADLINE)
    expect(designText(branded.container)).not.toBe(upstreamText)
    expect(designColors(branded.container)).toContain(BRAND_COLOR_RGB)
    expect(designColors(branded.container)).not.toEqual(upstreamColors)
  })

  it('changes the popping headline’s palette, outline and copy', () => {
    const upstream = render(<PoppingText />)
    const upstreamColors = designColors(upstream.container)
    const upstreamShadow = designTextShadow(upstream.container)
    upstream.unmount()

    const branded = render(
      <RvePoppingTextDesign {...makeProps({
        text: 'Big Sale',
        textSlots: { headline: 'Big Sale', businessName: 'Acme Roofing' },
        colors: { primary: BRAND_COLOR, accent: '#28c98b', text: '#00ff00', backgroundDim: 0.18 },
      })} />,
    )

    expect(designText(branded.container)).toContain('Big Sale')
    expect(designColors(branded.container)).toContain(BRAND_COLOR_RGB)
    expect(designColors(branded.container)).not.toEqual(upstreamColors)
    // The outline colour is a prop now, so the brand outline reaches the glyph.
    expect(designTextShadow(branded.container)).toContain('#00ff00')
    expect(designTextShadow(branded.container)).not.toBe(upstreamShadow)
  })

  it('changes the sliding headline’s colour and copy', () => {
    const upstream = render(<SlideText />)
    const upstreamText = designText(upstream.container)
    const upstreamColors = designColors(upstream.container)
    upstream.unmount()

    const branded = render(
      <RveSlideTextDesign {...makeProps({
        color: BRAND_COLOR,
        text: BRAND_HEADLINE,
        textSlots: { headline: BRAND_HEADLINE, businessName: 'Acme Roofing' },
      })} />,
    )

    expect(designText(branded.container)).toContain(BRAND_HEADLINE)
    expect(designText(branded.container)).not.toBe(upstreamText)
    expect(designColors(branded.container)).toContain(BRAND_COLOR_RGB)
    expect(designColors(branded.container)).not.toEqual(upstreamColors)
  })

  it('changes the progress ring’s colours', () => {
    const upstream = render(<CircularProgress />)
    const upstreamColors = designColors(upstream.container)
    upstream.unmount()

    const branded = render(
      <RveCircularProgressDesign {...makeProps({ color: BRAND_COLOR })} />,
    )

    expect(designColors(branded.container)).toContain(BRAND_COLOR_RGB)
    expect(designColors(branded.container)).not.toEqual(upstreamColors)
  })

  it('passes a canvas-relative px size, never the upstream rem value', () => {
    // Contract addition C9: the upstream's `rem` size is not canvas
    // relative, so the adapter must pass a px value.
    const animated = render(<RveAnimatedTextDesign {...makeProps()} />)
    expect(designFontSize(animated.container)).toBe('97px')
    animated.unmount()

    const sliding = render(<RveSlideTextDesign {...makeProps()} />)
    expect(designFontSize(sliding.container)).toBe('76px')
    sliding.unmount()

    const popping = render(
      <RvePoppingTextDesign {...makeProps({
        text: 'Big Sale',
        textSlots: { headline: 'Big Sale' },
      })} />,
    )
    expect(designFontSize(popping.container)).toBe('140px')
    popping.unmount()

    const ring = render(<RveCircularProgressDesign {...makeProps()} />)
    expect(designFontSize(ring.container)).toBe('65px')
  })
})

describe('batch 2 — the upstream defaults are preserved', () => {
  it('reproduces the animated text design when the props are omitted', () => {
    const { container } = render(<AnimatedText />)
    expect(designText(container)).toContain('Hello Remotion')
    expect(designColors(container)).toContain('white')
    expect(designFontSize(container)).toBe('5rem')
  })

  it('reproduces the popping text design when the props are omitted', () => {
    const { container } = render(<PoppingText />)
    expect(designText(container)).toContain('BINGO!')
    expect(designColors(container)).toContain(normalizeColor('#1e3a8a'))
    expect(designColors(container)).toContain(normalizeColor('#3b82f6'))
    expect(designColors(container)).toContain(normalizeColor('#A9D6E5'))
    expect(designFontSize(container)).toBe('8rem')
    expect(designTextShadow(container)).toContain('#fff')
  })

  it('reproduces the sliding text design when the props are omitted', () => {
    const { container } = render(<SlideText />)
    expect(designText(container)).toContain('Sliding Text!')
    expect(designColors(container)).toContain('white')
    expect(designFontSize(container)).toBe('4rem')
  })

  it('reproduces the circular progress design when the props are omitted', () => {
    clock.frame = 45
    const { container } = render(<CircularProgress />)
    expect(designText(container)).toContain('50%')
    expect(designColors(container)).toContain('white')
    expect(designFontSize(container)).toBe('3rem')
    // The upstream's fixed SVG id is untouched.
    expect(container.innerHTML).toContain('progressGradient')
  })
})

describe('batch 2 — safety', () => {
  const adapters = [
    ['rve-animated-text', RveAnimatedTextDesign],
    ['rve-popping-text', RvePoppingTextDesign],
    ['rve-slide-text', RveSlideTextDesign],
    ['rve-circular-progress', RveCircularProgressDesign],
  ] as const

  it('degrades gracefully when the customer has no logo', () => {
    for (const [id, Adapter] of adapters) {
      const { container, unmount } = render(
        <Adapter
          {...makeProps({ media: { logo: null, product: null, service: null } })}
        />,
      )
      expect(container.innerHTML.length, id).toBeGreaterThan(0)
      // No broken image: none of these templates draws one.
      expect(container.querySelector('img'), id).toBeNull()
      unmount()
    }
  })

  it('never paints an opaque full-canvas background over the video', () => {
    for (const [id, Adapter] of adapters) {
      const { container, unmount } = render(<Adapter {...makeProps()} />)
      const stage = container.querySelector('[data-remotion-design]') as HTMLElement
      const canvas = container.querySelector('[data-remotion-design-canvas]') as HTMLElement

      expect(stage.style.backgroundColor, id).toBe('transparent')
      expect(stage.style.background, id).toBe('')
      expect(canvas.style.backgroundColor, id).toBe('')
      expect(canvas.style.background, id).toBe('')

      for (const el of Array.from(container.querySelectorAll<HTMLElement>('*'))) {
        const background = el.style?.backgroundColor
        const shorthand = el.style?.background
        if (background) expect(background, id).toBe('transparent')
        if (shorthand) expect(shorthand, id).toBe('transparent')
      }
      unmount()
    }
  })

  it('scales the composition-sized canvas into the design box', () => {
    const { container } = render(
      <RveAnimatedTextDesign
        {...makeProps({ box: { leftPx: 0, topPx: 0, widthPx: 960, heightPx: 540 } })}
      />,
    )
    const canvas = container.querySelector('[data-remotion-design-canvas]') as HTMLElement
    expect(canvas.style.width).toBe('1920px')
    expect(canvas.style.height).toBe('1080px')
    expect(canvas.style.transform).toBe('scale(0.5, 0.5)')
    expect(canvas.style.transformOrigin).toBe('top left')
  })

  it('omits the scale transform when the box already is the composition', () => {
    const { container } = render(<RveSlideTextDesign {...makeProps()} />)
    const canvas = container.querySelector('[data-remotion-design-canvas]') as HTMLElement
    expect(canvas.style.transform).toBe('')
  })

  it('draws no credit line inside any design', () => {
    for (const [id, Adapter] of adapters) {
      const { container, unmount } = render(<Adapter {...makeProps()} />)
      expect(container.querySelector('[data-remotion-design-credit]'), id).toBeNull()
      expect(container.textContent ?? '', id).not.toContain('Permission is hereby granted')
      unmount()
    }
  })
})

describe('batch 2 — the registry entries', () => {
  it('exports the four designs and nothing else', () => {
    expect(RVE_CATALOG_ENTRIES).toHaveLength(4)
    expect(RVE_CATALOG_ENTRIES.map((entry) => entry.id)).toEqual([
      'rve-circular-progress',
      'rve-animated-text',
      'rve-popping-text',
      'rve-slide-text',
    ])
    expect(rveCircularProgressTemplate.id).toBe('rve-circular-progress')
    expect(rveAnimatedTextTemplate.id).toBe('rve-animated-text')
    expect(rvePoppingTextTemplate.id).toBe('rve-popping-text')
    expect(rveSlideTextTemplate.id).toBe('rve-slide-text')
  })

  it('does not register anything by itself', () => {
    // The catalog lane owns the registry; importing the entries must have no
    // side effect.
    const registered = listRemotionDesignTemplates().map((entry) => entry.id)
    for (const entry of RVE_CATALOG_ENTRIES) {
      expect(registered).not.toContain(entry.id)
    }
  })

  it('gives every entry the required fields', () => {
    for (const entry of RVE_CATALOG_ENTRIES) {
      expect(typeof entry.id).toBe('string')
      expect(entry.id.length).toBeGreaterThan(0)
      expect(entry.name.length).toBeGreaterThan(0)
      expect(entry.description.length).toBeGreaterThan(0)
      expect(entry.category).toBeTruthy()
      expect(entry.component).toBeTruthy()
      expect(entry.source).toBeTruthy()
      expect(entry.capabilities).toBeTruthy()
    }
  })

  it('attributes every entry to the repo-2 upstream with its licence', () => {
    for (const entry of RVE_CATALOG_ENTRIES) {
      expect(entry.source.repository).toBe('remotion-templates')
      expect(entry.source.repositoryUrl).toBe(
        'https://github.com/deangilmoreremix/remotion-templates',
      )
      expect(entry.source.sourcePath).toMatch(/^templates\/.+\.tsx$/)
      expect(entry.source.license).toBe('MIT')
      expect(entry.source.attribution.trim().length).toBeGreaterThan(0)
      expect(entry.source.attribution).toBe(RVE_ATTRIBUTION)
      expect(entry.source.attribution).toContain('React Video Editor')
      expect(entry.source.attribution).toContain('MIT License')
    }
  })

  it('declares truthful capabilities and a bounded placement', () => {
    for (const entry of RVE_CATALOG_ENTRIES) {
      expect(entry.capabilities.preview).toBe(true)
      expect(entry.capabilities.browserExport).toBe(true)
      expect((entry.capabilities.notes ?? '').length).toBeGreaterThan(0)
      expect(entry.previewCompatible).toBe(true)
      expect(entry.aspectRatios).toEqual(['16:9', '9:16', '1:1', '4:5'])
      expect(entry.requiredMedia).toEqual([])
      // A design is a bounded overlay, never a full-frame wipe.
      const scale = entry.placement?.scale ?? 1
      expect(scale).toBeGreaterThan(0)
      expect(scale).toBeLessThan(1)
      expect(entry.media).toEqual([])
    }
  })

  it('declares exactly one primary text slot per design that has copy', () => {
    for (const entry of RVE_CATALOG_ENTRIES) {
      const slots = entry.textSlots ?? []
      if (entry.id === 'rve-circular-progress') {
        // The percentage is a time-driven loop, so the ring has no copy.
        expect(slots).toEqual([])
        continue
      }
      const primary = slots.filter((slot) => slot.primary)
      expect(primary).toHaveLength(1)
      expect(primary[0].key).toBe('headline')
      expect(primary[0].field).toBe('headline')
    }
  })

  it('notes the fixed SVG id on the progress ring', () => {
    // Contract addition C7: the upstream's `progressGradient` id is fixed.
    expect(rveCircularProgressTemplate.capabilities.notes).toContain(
      'progressGradient',
    )
  })
})

describe('batch 2 — the upstream copies are deterministic', () => {
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

  const copies = [
    'rve-circular-progress/CircularProgress.tsx',
    'rve-animated-text/AnimatedText.tsx',
    'rve-popping-text/PoppingText.tsx',
    'rve-slide-text/SlideText.tsx',
  ]

  it('contain no wall-clock or random source (contract addition C12)', () => {
    for (const copy of copies) {
      const file = path.join(upstreamDir, copy)
      const source = fs.readFileSync(file, 'utf-8')
      // Only the code is checked; the provenance header is prose.
      const code = source.slice(source.indexOf('"use client";'))
      expect(code, copy).not.toMatch(/Math\.random/)
      expect(code, copy).not.toMatch(/Date\.now/)
      expect(code, copy).not.toMatch(/animation:/)
      expect(code, copy).not.toMatch(/transition:/)
      expect(code, copy).not.toMatch(/@keyframes/)
    }
  })

  it('keep the upstream credit header and the provenance record', () => {
    for (const copy of copies) {
      const file = path.join(upstreamDir, copy)
      const source = fs.readFileSync(file, 'utf-8')
      expect(source, copy).toContain('Free Remotion Template Component')
      expect(source, copy).toContain('Credit appreciated but not required')
      expect(source, copy).toContain('https://www.reactvideoeditor.com')
      expect(source, copy).toContain(
        'https://github.com/deangilmoreremix/remotion-templates',
      )
      expect(source, copy).toContain('DEVIATION RECORD')
    }
  })
})

describe('batch 2 — the repo-2 credit', () => {
  it('carries the attribution, the upstream credit and the MIT notice', () => {
    expect(RVE_ATTRIBUTION).toBe(
      'Remotion templates by React Video Editor (reactvideoeditor.com) — MIT License.',
    )
    expect(RVE_UPSTREAM_CREDIT).toContain('Credit appreciated but not required')
    expect(RVE_UPSTREAM_CREDIT).toContain('https://www.reactvideoeditor.com')
    expect(RVE_LICENSE_NOTICE).toContain(
      'Permission is hereby granted, free of charge, to any person obtaining a copy',
    )
    expect(RVE_LICENSE_NOTICE).toContain(
      'The above copyright notice and this permission notice shall be included in all',
    )
    expect(RVE_LICENSE_NOTICE).toContain('THE SOFTWARE IS PROVIDED "AS IS"')
    // No copyright line: the upstream names no holder.
    expect(RVE_LICENSE_NOTICE).not.toMatch(/Copyright \(c\)/)
  })
})
