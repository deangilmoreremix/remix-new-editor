// @vitest-environment jsdom
/**
 * Batch 3e — fifteen React Video Editor (`remotion-templates`) text / title
 * templates ported into the design registry.
 *
 * Pins, for every entry:
 *  1. complete, truthful registry metadata (repo-2 source + attribution, one
 *     primary slot, honest category / placement / endFrame);
 *  2. the adapter renders the upstream with brand data at several frames and
 *     in every supported format, without throwing and without upstream demo
 *     copy;
 *  3. overlays never paint a full-canvas background; full-scene cards paint a
 *     brand background instead of the upstream's `#111827`;
 *  4. the edited upstream copies reproduce the upstream defaults with no
 *     props, are deterministic and ship no remote URL outside comments.
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

import { AnimatedList } from '../_upstream/rve-animated-list/AnimatedList'
import { BounceText } from '../_upstream/rve-bounce-text/BounceText'
import { BubblePopText } from '../_upstream/rve-bubble-pop-text/BubblePopText'
import { CinematicTitleIntro } from '../_upstream/rve-cinematic-title-intro/CinematicTitleIntro'
import { CountdownIntro } from '../_upstream/rve-countdown-intro/CountdownIntro'
import { CreditsRoll } from '../_upstream/rve-credits-roll/CreditsRoll'
import { FloatingBubbleText } from '../_upstream/rve-floating-bubble-text/FloatingBubbleText'
import { LowerThird } from '../_upstream/rve-lower-third/LowerThird'
import { NotificationPop } from '../_upstream/rve-notification-pop/NotificationPop'
import { PulsingText } from '../_upstream/rve-pulsing-text/PulsingText'
import { QuoteCard } from '../_upstream/rve-quote-card/QuoteCard'
import { SubscribeReminder } from '../_upstream/rve-subscribe-reminder/SubscribeReminder'
import { TextHighlight } from '../_upstream/rve-text-highlight/TextHighlight'
import { TitleSplit } from '../_upstream/rve-title-split/TitleSplit'
import { TypewriterSubtitle } from '../_upstream/rve-typewriter-subtitle/TypewriterSubtitle'
import { BATCH_3E_FIXED_SVG_IDS, BATCH_3E_TEMPLATES } from '../designs/batch3e/entries'
import { bubblePopCopy } from '../designs/batch3e/RveBubblePopTextDesign'
import { RVE_ATTRIBUTION } from '../designs/rveSharedDesign'
import type { RemotionDesignComponentProps, RemotionDesignTemplate } from '../types'

const stage = vi.hoisted(() => ({ frame: 0, width: 1920, height: 1080, fps: 30 }))

vi.mock('remotion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('remotion')>()
  return {
    ...actual,
    useCurrentFrame: () => stage.frame,
    useVideoConfig: () => ({
      width: stage.width,
      height: stage.height,
      fps: stage.fps,
      durationInFrames: 300,
    }),
  }
})

const EXPECTED_IDS = [
  'rve-bounce-text',
  'rve-bubble-pop-text',
  'rve-cinematic-title-intro',
  'rve-floating-bubble-text',
  'rve-pulsing-text',
  'rve-title-split',
  'rve-typewriter-subtitle',
  'rve-text-highlight',
  'rve-quote-card',
  'rve-credits-roll',
  'rve-notification-pop',
  'rve-subscribe-reminder',
  'rve-lower-third',
  'rve-animated-list',
  'rve-countdown-intro',
]

const FULL_SCENE_IDS = new Set([
  'rve-cinematic-title-intro',
  'rve-quote-card',
  'rve-credits-roll',
  'rve-countdown-intro',
])

/** Upstream demo copy that must never reach a branded render. */
const DEMO_COPY: Record<string, string[]> = {
  'rve-bounce-text': ['Start Building', 'Theres never been'],
  'rve-bubble-pop-text': ['HELLO'],
  'rve-cinematic-title-intro': ['Your Story Begins', 'A Cinematic Experience'],
  'rve-floating-bubble-text': ['Floating'],
  'rve-pulsing-text': ['Pulse'],
  'rve-title-split': ['CREATIVE', 'STUDIO'],
  'rve-typewriter-subtitle': ['I like typing'],
  'rve-text-highlight': ['Build amazing videos'],
  'rve-quote-card': ['Steve Jobs', 'Design is not just'],
  'rve-credits-roll': ['Jane Smith', 'Director', 'Colorist'],
  'rve-notification-pop': ['Notifications', 'New Message', 'Task Complete'],
  'rve-subscribe-reminder': ['@CreativeStudio', 'Your Video Content'],
  'rve-lower-third': ['John Smith', 'Senior Producer'],
  'rve-animated-list': ['Item One', 'Item Two'],
  'rve-countdown-intro': ['GO!'],
}

const VALID_FIELDS = ['businessName', 'headline', 'offer', 'cta', 'phone', 'website']
const VALID_CATEGORIES = [
  'animated-headline',
  'logo-reveal',
  'lower-third',
  'promo-cta',
  'visual-effect',
  'transition',
  'data-visualization',
  'full-scene',
  'other',
]

const SIZES: Array<[number, number]> = [
  [1920, 1080],
  [1080, 1920],
  [1080, 1080],
]

const FRAMES = [0, 12, 45, 95, 140]

function makeProps(
  overrides: Partial<RemotionDesignComponentProps> = {},
): RemotionDesignComponentProps {
  const width = overrides.width ?? 1920
  const height = overrides.height ?? 1080
  return {
    text: 'Roofing done right',
    textSlots: {
      headline: 'Roofing done right',
      businessName: 'Acme Roofing',
      offer: '20% off this week',
      cta: 'Book now',
      phone: '555-0100',
      website: 'acmeroofing.com',
    },
    colors: { primary: '#29d3f2', accent: '#28c98b', text: '#ffffff', backgroundDim: 0.18 },
    media: { logo: null, product: null, service: null },
    box: { leftPx: 0, topPx: 0, widthPx: width, heightPx: height },
    width,
    height,
    frame: 0,
    fps: 30,
    opacity: 1,
    color: '#ffffff',
    ...overrides,
  }
}

function canvasText(container: HTMLElement): string {
  const canvas = container.querySelector('[data-remotion-design-canvas]') as HTMLElement | null
  return ((canvas ?? container).textContent ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function plainText(container: HTMLElement): string {
  return (container.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function isPainted(value: string | undefined): boolean {
  if (!value) return false
  const v = value.trim().toLowerCase()
  return v !== '' && v !== 'transparent' && v !== 'none' && v !== 'rgba(0, 0, 0, 0)'
}

/** Elements inside the canvas that cover the whole canvas. */
function fullCanvasElements(container: HTMLElement): HTMLElement[] {
  const canvas = container.querySelector('[data-remotion-design-canvas]') as HTMLElement
  return Array.from(canvas.querySelectorAll<HTMLElement>('*')).filter(
    (el) => el.style.width === '100%' && el.style.height === '100%',
  )
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`
}

function hasColor(container: HTMLElement, hex: string): boolean {
  const html = container.innerHTML.toLowerCase()
  return html.includes(hex.toLowerCase()) || html.includes(hexToRgb(hex))
}

beforeEach(() => {
  stage.frame = 0
  stage.width = 1920
  stage.height = 1080
  stage.fps = 30
})

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

/* -------------------------------------------------------------------------- */
/* Metadata                                                                    */
/* -------------------------------------------------------------------------- */

describe('batch 3e — registry entries', () => {
  it('exports exactly the fifteen designs, with unique, new ids', () => {
    expect(BATCH_3E_TEMPLATES.map((t) => t.id)).toEqual(EXPECTED_IDS)
    expect(new Set(EXPECTED_IDS).size).toBe(EXPECTED_IDS.length)
    for (const taken of ['rve-animated-text', 'rve-slide-text', 'rve-popping-text', 'rve-circular-progress']) {
      expect(EXPECTED_IDS).not.toContain(taken)
    }
  })

  it.each(BATCH_3E_TEMPLATES.map((t) => [t.id, t] as const))('%s has complete metadata', (id, entry) => {
    const t = entry as RemotionDesignTemplate
    expect(t.name.trim().length).toBeGreaterThan(0)
    expect(t.description.trim().length).toBeGreaterThan(10)
    expect(VALID_CATEGORIES).toContain(t.category)
    expect(t.component).toBeTruthy()

    const slug = id.replace(/^rve-/, '')
    expect(t.source).toEqual({
      repository: 'remotion-templates',
      repositoryUrl: 'https://github.com/deangilmoreremix/remotion-templates',
      sourcePath: `templates/${slug}.tsx`,
      license: 'MIT',
      attribution: RVE_ATTRIBUTION,
    })

    const slots = t.textSlots ?? []
    const primary = slots.filter((s) => s.primary)
    expect(primary).toHaveLength(1)
    for (const slot of slots) expect(VALID_FIELDS).toContain(slot.field)
    expect(new Set(slots.map((s) => s.key)).size).toBe(slots.length)

    for (const binding of t.colors ?? []) expect(['primary', 'accent', 'text']).toContain(binding.role)
    expect(t.media).toEqual([])
    expect(t.requiredMedia).toEqual([])
    expect(t.aspectRatios).toContain('16:9')
    expect(t.capabilities.preview).toBe(true)
    expect(t.capabilities.browserExport).toBe(true)
    expect((t.capabilities.notes ?? '').length).toBeGreaterThan(20)
    expect(t.previewCompatible).toBe(true)
    expect(t.animation?.durationInFrames).toBeGreaterThan(0)

    const p = t.placement!
    expect(p).toBeTruthy()
    expect(p.opacity).toBe(1)
    if (p.scale >= 1) {
      expect(p.animation).toBe('none')
    } else {
      expect(p.scale).toBeGreaterThan(0)
    }
  })

  it('classifies full-scene cards honestly and leaves overlays open-ended', () => {
    for (const t of BATCH_3E_TEMPLATES) {
      if (FULL_SCENE_IDS.has(t.id)) {
        expect(t.category, t.id).toBe('full-scene')
        expect(t.placement, t.id).toMatchObject({ x: 0.5, y: 0.5, scale: 1 })
        expect(t.placement?.endFrame, t.id).toBeGreaterThanOrEqual(90)
        expect(t.placement?.endFrame, t.id).toBeLessThanOrEqual(180)
      } else {
        expect(t.category, t.id).not.toBe('full-scene')
        expect(t.placement?.endFrame, t.id).toBeUndefined()
      }
    }
  })

  it('declares no fixed SVG ids (none of the templates hardcodes one)', () => {
    expect(BATCH_3E_FIXED_SVG_IDS).toEqual({})
  })
})

/* -------------------------------------------------------------------------- */
/* Rendering                                                                   */
/* -------------------------------------------------------------------------- */

describe('batch 3e — adapters render with brand data', () => {
  it.each(BATCH_3E_TEMPLATES.map((t) => [t.id, t] as const))(
    '%s renders at several frames in every format',
    (id, entry) => {
      const Component = (entry as RemotionDesignTemplate).component
      for (const [width, height] of SIZES) {
        stage.width = width
        stage.height = height
        for (const frame of FRAMES) {
          stage.frame = frame
          const { container, unmount } = render(
            <Component {...makeProps({ width, height, frame })} />,
          )
          expect(container.querySelector(`[data-remotion-design="${id}"]`), id).not.toBeNull()
          expect(container.querySelector('[data-remotion-design-credit]'), id).toBeNull()
          const text = plainText(container)
          for (const demo of DEMO_COPY[id] ?? []) expect(text, `${id} @${frame}`).not.toContain(demo)
          // No broken image: none of these designs draws one.
          expect(container.querySelector('img'), id).toBeNull()
          // No hardcoded SVG ids inside the design.
          expect(container.querySelector('[data-remotion-design-canvas] [id]'), id).toBeNull()
          unmount()
        }
      }
    },
  )

  it('shows the brand copy once each design has settled', () => {
    const expectations: Record<string, string[]> = {
      'rve-bounce-text': ['Roofing done right', '20% off this week'],
      'rve-bubble-pop-text': ['ACME'],
      'rve-cinematic-title-intro': ['Roofing done right', 'Acme Roofing'],
      'rve-floating-bubble-text': ['Roofing done right'],
      'rve-pulsing-text': ['Roofing done'],
      'rve-title-split': ['ROOFING DONE RIGHT', 'ACME ROOFING'],
      'rve-typewriter-subtitle': ['Roofing done right'],
      'rve-text-highlight': ['Roofing', 'done', 'right'],
      'rve-quote-card': ['Roofing done right', '— Acme Roofing'],
      'rve-notification-pop': ['Acme Roofing', '20% off this week', 'Book now', '555-0100', 'acmeroofing.com'],
      'rve-subscribe-reminder': ['Book now', 'acmeroofing.com'],
      'rve-lower-third': ['Acme Roofing', '20% off this week'],
      'rve-animated-list': ['20% off this week', '555-0100', 'acmeroofing.com'],
    }
    stage.frame = 90
    for (const t of BATCH_3E_TEMPLATES) {
      const wanted = expectations[t.id]
      if (!wanted) continue
      const { container, unmount } = render(<t.component {...makeProps({ frame: 90 })} />)
      const text = canvasText(container)
      for (const w of wanted) expect(text, t.id).toContain(w)
      unmount()
    }
  })

  it('builds the credits roll from the brand fields', () => {
    const t = BATCH_3E_TEMPLATES.find((e) => e.id === 'rve-credits-roll')!
    const { container } = render(<t.component {...makeProps()} />)
    const text = canvasText(container)
    for (const w of ['Presented by', 'Acme Roofing', 'Special offer', '555-0100', 'acmeroofing.com', 'Book now']) {
      expect(text).toContain(w)
    }
  })

  it('lands the countdown on the call to action', () => {
    const t = BATCH_3E_TEMPLATES.find((e) => e.id === 'rve-countdown-intro')!
    stage.frame = 10
    const early = render(<t.component {...makeProps()} />)
    expect(canvasText(early.container)).toContain('3')
    early.unmount()
    stage.frame = 100
    const late = render(<t.component {...makeProps()} />)
    expect(canvasText(late.container)).toContain('Book now')
  })

  it('keeps long copy short enough for the canvas', () => {
    const long =
      'An extraordinarily long headline that would never fit on a single line of any video frame at all, '.repeat(3)
    for (const t of BATCH_3E_TEMPLATES) {
      for (const [width, height] of SIZES) {
        stage.width = width
        stage.height = height
        stage.frame = 140
        const props = makeProps({
          width,
          height,
          text: long,
          textSlots: {
            headline: long,
            businessName: long,
            offer: long,
            cta: long,
            phone: long,
            website: long,
          },
        })
        const { container, unmount } = render(<t.component {...props} />)
        // No single rendered text node carries the whole string.
        const canvas = container.querySelector('[data-remotion-design-canvas]') as HTMLElement
        const walker = document.createTreeWalker(canvas, NodeFilter.SHOW_TEXT)
        let node = walker.nextNode()
        while (node) {
          expect((node.textContent ?? '').length, `${t.id} ${width}x${height}`).toBeLessThan(long.length)
          node = walker.nextNode()
        }
        unmount()
      }
    }
  })

  it('picks bubble copy that fits the bubble budget', () => {
    expect(bubblePopCopy('Acme Roofing')).toBe('ACME')
    expect(bubblePopCopy('Joe Pro')).toBe('JOE PRO')
    expect(bubblePopCopy('Supercalifragilistic')).toBe('SUPERCALIF')
  })

  it('scales the canvas into the design box', () => {
    const t = BATCH_3E_TEMPLATES[0]
    const { container } = render(
      <t.component {...makeProps({ box: { leftPx: 0, topPx: 0, widthPx: 960, heightPx: 540 } })} />,
    )
    const canvas = container.querySelector('[data-remotion-design-canvas]') as HTMLElement
    expect(canvas.style.width).toBe('1920px')
    expect(canvas.style.transform).toBe('scale(0.5, 0.5)')
  })
})

describe('batch 3e — backgrounds', () => {
  it('keeps every overlay transparent so the video shows through', () => {
    for (const t of BATCH_3E_TEMPLATES) {
      if (FULL_SCENE_IDS.has(t.id)) continue
      const { container, unmount } = render(<t.component {...makeProps({ frame: 60 })} />)
      const stageEl = container.querySelector('[data-remotion-design]') as HTMLElement
      const canvas = container.querySelector('[data-remotion-design-canvas]') as HTMLElement
      expect(stageEl.style.backgroundColor, t.id).toBe('transparent')
      expect(isPainted(canvas.style.background), t.id).toBe(false)
      expect(isPainted(canvas.style.backgroundColor), t.id).toBe(false)
      for (const el of fullCanvasElements(container)) {
        expect(isPainted(el.style.background), t.id).toBe(false)
        expect(isPainted(el.style.backgroundColor), t.id).toBe(false)
      }
      unmount()
    }
  })

  it('paints a brand background (not the upstream #111827) on full-scene cards', () => {
    for (const t of BATCH_3E_TEMPLATES) {
      if (!FULL_SCENE_IDS.has(t.id)) continue
      const { container, unmount } = render(<t.component {...makeProps({ frame: 30 })} />)
      const painted = fullCanvasElements(container).filter(
        (el) => isPainted(el.style.background) || isPainted(el.style.backgroundColor),
      )
      expect(painted.length, t.id).toBeGreaterThan(0)
      expect(hasColor(container, '#111827'), t.id).toBe(false)
      unmount()
    }
  })
})

/* -------------------------------------------------------------------------- */
/* Upstream copies                                                             */
/* -------------------------------------------------------------------------- */

describe('batch 3e — upstream copies reproduce the upstream with no props', () => {
  it('bounce text', () => {
    const { container } = render(<BounceText />)
    const text = plainText(container)
    expect(text).toContain('Start Building')
    expect(text).toContain('Theres never been a better time')
    expect(hasColor(container, '#1e3a8a')).toBe(true)
    expect(container.innerHTML).toContain('3.5rem')
  })

  it('bubble pop text', () => {
    const { container } = render(<BubblePopText />)
    expect(plainText(container).replace(/ /g, '')).toBe('HELLO')
    expect(container.querySelectorAll('span')).toHaveLength(5)
    expect(container.innerHTML).toContain('100px')
    expect(container.innerHTML).toContain('4rem')
  })

  it('cinematic title intro', () => {
    const { container } = render(<CinematicTitleIntro />)
    expect(plainText(container)).toContain('Your Story Begins')
    expect(plainText(container)).toContain('A Cinematic Experience')
    expect(hasColor(container, '#111827')).toBe(true)
  })

  it('floating bubble text', () => {
    const { container } = render(<FloatingBubbleText />)
    expect(plainText(container)).toBe('Floating')
    expect(container.innerHTML).toContain('cyan')
    expect(container.innerHTML).toContain('4.5rem')
  })

  it('pulsing text', () => {
    const { container } = render(<PulsingText />)
    expect(plainText(container).replace(/ /g, '')).toBe('Pulse')
    expect(container.innerHTML).toContain('5rem')
    expect(container.innerHTML).toContain('blur(20px)')
    expect(container.innerHTML).not.toContain('box-shadow')
  })

  it('title split', () => {
    const { container } = render(<TitleSplit />)
    expect(plainText(container)).toContain('CREATIVE')
    expect(plainText(container)).toContain('STUDIO')
    expect(hasColor(container, '#111827')).toBe(true)
  })

  it('typewriter subtitle', () => {
    stage.frame = 60
    const { container } = render(<TypewriterSubtitle />)
    expect(plainText(container)).toContain('I like typing...')
    expect(hasColor(container, '#60a5fa')).toBe(true)
    expect(container.innerHTML).toContain('3rem')
  })

  it('text highlight', () => {
    const { container } = render(<TextHighlight />)
    // Each word is its own span (no whitespace between them upstream).
    expect(plainText(container)).toBe('Buildamazingvideoswithcode')
    for (const word of ['Build', 'amazing', 'videos', 'with', 'code']) {
      expect(
        Array.from(container.querySelectorAll('span')).some((el) => el.textContent === word),
      ).toBe(true)
    }
    expect(container.innerHTML).toContain('700px')
  })

  it('quote card', () => {
    stage.frame = 60
    const { container } = render(<QuoteCard />)
    expect(plainText(container)).toContain('Design is not just what it looks like. Design is how it works.')
    expect(plainText(container)).toContain('— Steve Jobs')
    expect(hasColor(container, '#3b82f6')).toBe(true)
  })

  it('credits roll', () => {
    const { container } = render(<CreditsRoll />)
    expect(plainText(container)).toContain('Director')
    expect(plainText(container)).toContain('Jane Smith')
    expect(plainText(container)).toContain('James Brown')
    expect(hasColor(container, '#111827')).toBe(true)
  })

  it('notification pop', () => {
    stage.frame = 60
    const { container } = render(<NotificationPop />)
    const text = plainText(container)
    expect(text).toContain('Notifications')
    expect(text).toContain('New Message')
    expect(text).toContain('Someone started following you.')
    expect(text).toContain('3')
    expect(container.innerHTML).toContain('320px')
  })

  it('subscribe reminder', () => {
    const { container } = render(<SubscribeReminder />)
    const text = plainText(container)
    expect(text).toContain('Subscribe')
    expect(text).toContain('@CreativeStudio')
    expect(text).toContain('Your Video Content')
    expect(text).toContain('\u{1F514}')
  })

  it('lower third', () => {
    stage.frame = 40
    const { container } = render(<LowerThird />)
    expect(plainText(container)).toContain('John Smith')
    expect(plainText(container)).toContain('Senior Producer')
    expect(container.innerHTML).toContain('1.6rem')
  })

  it('animated list', () => {
    const { container } = render(<AnimatedList />)
    expect(plainText(container)).toContain('Item One')
    expect(plainText(container)).toContain('Item Three')
    expect(hasColor(container, '#93c5fd')).toBe(true)
  })

  it('countdown intro', () => {
    stage.frame = 0
    const start = render(<CountdownIntro />)
    expect(plainText(start.container)).toBe('3')
    expect(start.container.querySelector('svg')?.getAttribute('width')).toBe('180')
    start.unmount()
    stage.frame = 100
    const end = render(<CountdownIntro />)
    expect(plainText(end.container)).toBe('GO!')
  })
})

describe('batch 3e — upstream copy files', () => {
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
  const COPIES: Record<string, string> = {
    'bounce-text': 'BounceText.tsx',
    'bubble-pop-text': 'BubblePopText.tsx',
    'cinematic-title-intro': 'CinematicTitleIntro.tsx',
    'floating-bubble-text': 'FloatingBubbleText.tsx',
    'pulsing-text': 'PulsingText.tsx',
    'title-split': 'TitleSplit.tsx',
    'typewriter-subtitle': 'TypewriterSubtitle.tsx',
    'text-highlight': 'TextHighlight.tsx',
    'quote-card': 'QuoteCard.tsx',
    'credits-roll': 'CreditsRoll.tsx',
    'notification-pop': 'NotificationPop.tsx',
    'subscribe-reminder': 'SubscribeReminder.tsx',
    'lower-third': 'LowerThird.tsx',
    'animated-list': 'AnimatedList.tsx',
    'countdown-intro': 'CountdownIntro.tsx',
  }
  /** Upstream files that ship without the in-file credit header. */
  const HEADERLESS = new Set(['title-split', 'quote-card', 'credits-roll', 'subscribe-reminder', 'countdown-intro'])

  const read = (slug: string) =>
    fs.readFileSync(path.join(upstreamDir, `rve-${slug}`, COPIES[slug]), 'utf-8')

  const stripComments = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  it('has a copy for every batch entry', () => {
    expect(Object.keys(COPIES).map((slug) => `rve-${slug}`)).toEqual(EXPECTED_IDS)
  })

  it.each(Object.keys(COPIES))('%s carries provenance and the deviation record', (slug) => {
    const source = read(slug)
    expect(source).toContain('DEVIATION RECORD')
    expect(source).toContain('https://github.com/deangilmoreremix/remotion-templates')
    expect(source).toContain(`templates/${slug}.tsx`)
    expect(source).toContain('6209b724798e48ff395f8df1a6fa2d26082372b5')
    expect(source).toContain('https://www.reactvideoeditor.com')
    if (!HEADERLESS.has(slug)) {
      expect(source).toContain('Free Remotion Template Component')
      expect(source).toContain('Credit appreciated but not required.')
    } else {
      expect(source).toContain('NO in-file credit header')
    }
  })

  it.each(Object.keys(COPIES))('%s ships no remote URL outside comments', (slug) => {
    expect(stripComments(read(slug))).not.toMatch(/https?:\/\//)
  })

  it.each(Object.keys(COPIES))('%s is deterministic (C12)', (slug) => {
    const source = read(slug)
    const code = stripComments(source.slice(source.indexOf('"use client";')))
    expect(code).not.toMatch(/Math\.random/)
    expect(code).not.toMatch(/Date\.now/)
    expect(code).not.toMatch(/animation:/)
    expect(code).not.toMatch(/transition:/)
    expect(code).not.toMatch(/@keyframes/)
  })

  it('adapters ship no remote URL either', () => {
    const dir = path.join(process.cwd(), 'src', 'features', 'personalization', 'shared', 'personalization', 'templates', 'designs', 'batch3e')
    for (const file of fs.readdirSync(dir)) {
      if (!/\.tsx?$/.test(file)) continue
      const code = stripComments(fs.readFileSync(path.join(dir, file), 'utf-8'))
        // The repository URL is metadata, never rendered or fetched.
        .replace(/'https:\/\/github\.com\/deangilmoreremix\/remotion-templates'/g, '')
      expect(code, file).not.toMatch(/https?:\/\//)
    }
  })
})
