// @vitest-environment jsdom
/**
 * Phase 4 porting batch 3c — ten repo-1 templates.
 *
 * Covers the registry entries (metadata, attribution, categories, placement
 * rules) and the adapters (they render the verbatim upstream with brand data
 * at several frames and aspect ratios, overlays stay transparent, chart and
 * scene cards keep a designed background and end as intro cards), plus the
 * provenance of the upstream copies.
 */
import React from 'react'
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import {
  getRemotionDesignTemplate,
  isRemotionDesignTemplateSupported,
  listRemotionDesignTemplates,
} from '../registry'
import {
  REMOTION_DESIGN_ATTRIBUTION,
  REMOTION_DESIGN_FIXED_SVG_IDS,
  REMOTION_DESIGN_REPOSITORY,
  REMOTION_DESIGN_REPOSITORY_URL,
} from '../catalog'
import { BATCH_3C_FIXED_SVG_IDS, BATCH_3C_TEMPLATES } from '../designs/batch3c/entries'
import { mixColor, readableOnDark, toHex6 } from '../designs/batch3c/batch3cShared'
import type {
  RemotionDesignComponentProps,
  RemotionDesignTemplate,
  RemotionDesignTextField,
} from '../types'

const clock = vi.hoisted(() => ({ frame: 0, width: 1920, height: 1080, durationInFrames: 150 }))

vi.mock('remotion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('remotion')>()
  return {
    ...actual,
    useCurrentFrame: () => clock.frame,
    useVideoConfig: () => ({
      width: clock.width,
      height: clock.height,
      fps: 30,
      durationInFrames: clock.durationInFrames,
    }),
  }
})

/** id → upstream component file (relative to `_upstream/`). */
const UPSTREAM_FILES: Record<string, string> = {
  'line-chart-anim': 'line-chart-anim/LineChartAnim.tsx',
  'kpi-counter': 'kpi-counter/KpiCounter.tsx',
  'racing-chart': 'racing-chart/RacingChart.tsx',
  'character-jumping': 'character-jumping/CharacterJumping.tsx',
  'thinking-bubble': 'thinking-bubble/ThinkingBubble.tsx',
  'wave-hello': 'wave-hello/WaveHello.tsx',
  'fireworks-burst': 'fireworks-burst/FireworksBurst.tsx',
  'loop-grid-wave': 'loop-grid-wave/LoopGridWave.tsx',
  'parallax-pan': 'parallax-pan/ParallaxPan.tsx',
  'particle-snow': 'particle-snow/ParticleSnow.tsx',
}
const IDS = Object.keys(UPSTREAM_FILES)

const OVERLAY_IDS = ['fireworks-burst', 'loop-grid-wave', 'particle-snow']
const CARD_IDS = IDS.filter((id) => !OVERLAY_IDS.includes(id))

const VALID_TEXT_FIELDS: RemotionDesignTextField[] = [
  'businessName',
  'headline',
  'offer',
  'cta',
  'phone',
  'website',
]

const BRAND_VALUES: Record<RemotionDesignTextField, string> = {
  businessName: 'Acme Roofing',
  headline: 'Roofing done right',
  offer: '20% off this week',
  cta: 'Book now',
  phone: '555-0100',
  website: 'acme.example.com',
}

const UPSTREAM_DEMO_STRINGS = [
  'Monthly Active Users',
  'Q4 Results',
  'Revenue',
  'Market Share Race',
  'Aurora',
  "Let's Go!",
  'Hmm...',
  'Hello!',
  'Welcome aboard',
  'Boom!',
  'Celebration time',
  'Beyond the Horizon',
  'Winter Magic',
  "Season's Greetings",
]

function makeProps(
  template: RemotionDesignTemplate,
  overrides: Partial<RemotionDesignComponentProps> = {},
  values: Record<RemotionDesignTextField, string> = BRAND_VALUES,
): RemotionDesignComponentProps {
  const slots: Record<string, string> = {}
  for (const slot of template.textSlots ?? []) slots[slot.key] = values[slot.field]
  const primary = (template.textSlots ?? []).find((slot) => slot.primary)
  return {
    ...(template.defaultProps ?? {}),
    text: primary ? values[primary.field] : '',
    textSlots: slots,
    colors: { primary: '#d9ff00', accent: '#28c98b', text: '#ffffff', backgroundDim: 0.18 },
    media: { logo: null, product: null, service: null },
    box: { leftPx: 0, topPx: 0, widthPx: clock.width, heightPx: clock.height },
    width: clock.width,
    height: clock.height,
    frame: clock.frame,
    fps: 30,
    opacity: 1,
    color: '#ffffff',
    ...overrides,
  }
}

function renderTemplate(
  template: RemotionDesignTemplate,
  overrides: Partial<RemotionDesignComponentProps> = {},
  values?: Record<RemotionDesignTextField, string>,
) {
  const Component = template.component
  return render(<Component {...makeProps(template, overrides, values)} />)
}

function get(id: string): RemotionDesignTemplate {
  return getRemotionDesignTemplate(id) as RemotionDesignTemplate
}

beforeEach(() => {
  clock.frame = 0
  clock.width = 1920
  clock.height = 1080
  clock.durationInFrames = 150
})

describe('batch 3c catalog entries', () => {
  it('registers all ten designs in order under unique ids', () => {
    expect(BATCH_3C_TEMPLATES.map((t) => t.id)).toEqual(IDS)
    const ids = listRemotionDesignTemplates().map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of IDS) expect(getRemotionDesignTemplate(id)).toBe(BATCH_3C_TEMPLATES[IDS.indexOf(id)])
  })

  it('carries the repo-1 source and attribution', () => {
    for (const t of BATCH_3C_TEMPLATES) {
      expect(t.source.repository).toBe(REMOTION_DESIGN_REPOSITORY)
      expect(t.source.repositoryUrl).toBe(REMOTION_DESIGN_REPOSITORY_URL)
      expect(t.source.license).toBe('MIT')
      expect(t.source.attribution).toBe(REMOTION_DESIGN_ATTRIBUTION)
      expect(t.source.sourcePath).toBe(`src/components/${UPSTREAM_FILES[t.id]}`)
    }
  })

  it('has customer-facing names, descriptions and truthful capabilities', () => {
    for (const t of BATCH_3C_TEMPLATES) {
      expect(t.name.trim().length).toBeGreaterThan(3)
      expect(t.description.trim().length).toBeGreaterThan(10)
      expect(t.component).toBeTruthy()
      expect(t.capabilities.preview).toBe(true)
      expect(t.capabilities.browserExport).toBe(true)
      expect((t.capabilities.notes ?? '').length).toBeGreaterThan(40)
      expect(t.previewCompatible).toBe(true)
      expect(t.requiredMedia ?? []).toEqual([])
      expect(t.animation?.durationInFrames).toBeGreaterThan(0)
    }
  })

  it('declares exactly one primary slot on known fields (loop-grid-wave is textless)', () => {
    for (const t of BATCH_3C_TEMPLATES) {
      const slots = t.textSlots ?? []
      if (t.id === 'loop-grid-wave') {
        expect(slots).toHaveLength(0)
        continue
      }
      expect(slots.filter((s) => s.primary)).toHaveLength(1)
      expect(new Set(slots.map((s) => s.key)).size).toBe(slots.length)
      for (const s of slots) expect(VALID_TEXT_FIELDS).toContain(s.field)
    }
  })

  it('classifies the designs honestly', () => {
    const expected: Record<string, string> = {
      'line-chart-anim': 'data-visualization',
      'kpi-counter': 'data-visualization',
      'racing-chart': 'data-visualization',
      'character-jumping': 'full-scene',
      'thinking-bubble': 'full-scene',
      'wave-hello': 'full-scene',
      'parallax-pan': 'full-scene',
      'fireworks-burst': 'visual-effect',
      'loop-grid-wave': 'visual-effect',
      'particle-snow': 'visual-effect',
    }
    for (const t of BATCH_3C_TEMPLATES) expect(t.category).toBe(expected[t.id])
  })

  it('plays chart and scene cards as full-frame intros with an endFrame', () => {
    for (const id of CARD_IDS) {
      const p = get(id).placement
      expect(p).toMatchObject({ x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none' })
      expect(p?.endFrame).toBeGreaterThanOrEqual(90)
      expect(p?.endFrame).toBeLessThanOrEqual(150)
    }
  })

  it('keeps overlays transparent, full-frame and without an endFrame', () => {
    for (const id of OVERLAY_IDS) {
      const t = get(id)
      expect(t.placement?.endFrame).toBeUndefined()
      expect(t.placement).toMatchObject({ scale: 1, opacity: 1, animation: 'none' })
      expect(t.defaultProps?.backgroundColor).toBe('transparent')
    }
  })

  it('supports every aspect ratio', () => {
    for (const id of IDS) {
      for (const ratio of ['16:9', '9:16', '1:1', '4:5'] as const) {
        expect(isRemotionDesignTemplateSupported(id, ratio).supported).toBe(true)
      }
    }
  })

  it('declares the fixed SVG id of particle-snow', () => {
    expect(BATCH_3C_FIXED_SVG_IDS).toEqual({ 'particle-snow': ['snow-sky'] })
    expect(REMOTION_DESIGN_FIXED_SVG_IDS['particle-snow']).toEqual(['snow-sky'])
  })
})

describe('batch 3c adapters', () => {
  it('renders every design at several frames and aspect ratios without throwing', () => {
    const sizes: Array<[number, number]> = [
      [1920, 1080],
      [1080, 1920],
      [1080, 1080],
      [1080, 1350],
    ]
    for (const t of BATCH_3C_TEMPLATES) {
      for (const [w, h] of sizes) {
        for (const frame of [0, 15, 45, 89, 149]) {
          clock.width = w
          clock.height = h
          clock.frame = frame
          const { container, unmount } = renderTemplate(t)
          expect(container.querySelector(`[data-remotion-design="${t.id}"]`)).not.toBeNull()
          expect(container.querySelector('[data-remotion-design-credit]')).toBeNull()
          unmount()
        }
      }
    }
  })

  it('shows the brand text and never the upstream demo copy', () => {
    clock.frame = 100
    for (const t of BATCH_3C_TEMPLATES) {
      const { container, unmount } = renderTemplate(t)
      const text = container.textContent ?? ''
      for (const slot of t.textSlots ?? []) expect(text, `${t.id}:${slot.key}`).toContain(BRAND_VALUES[slot.field])
      for (const demo of UPSTREAM_DEMO_STRINGS) expect(text, `${t.id}:${demo}`).not.toContain(demo)
      expect(container.querySelector('img')).toBeNull()
      unmount()
    }
  })

  it('truncates very long brand text', () => {
    const long = 'Supercalifragilistic roofing and guttering specialists of the greater metro area '.repeat(3)
    const values = Object.fromEntries(VALID_TEXT_FIELDS.map((f) => [f, long])) as Record<
      RemotionDesignTextField,
      string
    >
    clock.frame = 100
    for (const t of BATCH_3C_TEMPLATES) {
      if (!(t.textSlots ?? []).length) continue
      const { container, unmount } = renderTemplate(t, {}, values)
      expect(container.textContent ?? '').not.toContain(long.trim())
      expect(container.textContent ?? '').toContain('…')
      unmount()
    }
  })

  it('renders the pinned placeholder data on the chart cards', () => {
    clock.frame = 149
    const line = renderTemplate(get('line-chart-anim'))
    expect(line.container.textContent).toContain('Wk 1')
    expect(line.container.textContent).not.toContain('Jan')
    line.unmount()
    const kpi = renderTemplate(get('kpi-counter'))
    expect(kpi.container.textContent).toContain('Placeholder 1')
    kpi.unmount()
    const race = renderTemplate(get('racing-chart'))
    expect(race.container.textContent).toContain('Placeholder A')
    race.unmount()
  })

  it('keeps overlays transparent over the video', () => {
    for (const id of OVERLAY_IDS) {
      const { container, unmount } = renderTemplate(get(id))
      const stage = container.querySelector('[data-remotion-design]') as HTMLElement
      const canvas = container.querySelector('[data-remotion-design-canvas]') as HTMLElement
      const root = canvas.firstElementChild as HTMLElement
      expect(stage.style.background).toBe('')
      expect(stage.style.backgroundColor).toBe('')
      expect(canvas.style.backgroundColor).toBe('')
      expect(root.style.backgroundColor).toBe('transparent')
      unmount()
    }
  })

  it('paints a designed, brand-driven background on chart and scene cards', () => {
    for (const id of CARD_IDS) {
      const { container, unmount } = renderTemplate(get(id))
      const canvas = container.querySelector('[data-remotion-design-canvas]') as HTMLElement
      const root = canvas.firstElementChild as HTMLElement
      const painted =
        root.style.backgroundColor ||
        (root.firstElementChild as HTMLElement | null)?.style.background ||
        ''
      expect(painted, id).not.toBe('')
      expect(painted, id).not.toBe('transparent')
      unmount()
    }
  })

  it('follows the brand colours', () => {
    const { container } = renderTemplate(get('character-jumping'), {
      colors: { primary: '#ff0000', accent: '#00ff00', text: '#ffffff', backgroundDim: 0 },
    })
    expect(container.innerHTML).toContain('#ff0000')
  })

  it('scales the composition-sized canvas into the design box', () => {
    const { container } = renderTemplate(get('loop-grid-wave'), {
      box: { leftPx: 0, topPx: 0, widthPx: 960, heightPx: 540 },
    })
    const canvas = container.querySelector('[data-remotion-design-canvas]') as HTMLElement
    expect(canvas.style.transform).toBe('scale(0.5, 0.5)')
  })
})

describe('batch 3c helpers', () => {
  it('normalises colours for the upstreams that concatenate alpha suffixes', () => {
    expect(toHex6('#abc', '#000000')).toBe('#aabbcc')
    expect(toHex6('rgb(255, 0, 16)', '#000000')).toBe('#ff0010')
    expect(toHex6('not-a-colour', '#123456')).toBe('#123456')
    expect(mixColor('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(readableOnDark('#111111')).toBe('#ffffff')
    expect(readableOnDark('#ffffff')).toBe('#ffffff')
  })
})

describe('batch 3c upstream copies', () => {
  const root = join(process.cwd(), 'src/features/personalization/shared/personalization/templates/_upstream')
  const upstreamRoot = '/home/user/deangilmoreremix/free-remotion-templates/src/components'

  it('carry the provenance header and no URLs outside comments', () => {
    for (const [id, file] of Object.entries(UPSTREAM_FILES)) {
      const source = readFileSync(join(root, file), 'utf-8')
      expect(source).toContain(`// template id : ${id}`)
      expect(source).toContain('f648980e528defb7594e24c6447055f0540f340b')
      expect(source).toContain('Copyright (c) 2026 Trimora Inc.')
      expect(source).toContain('Upstream code is reproduced verbatim apart from this header comment.')
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n')
      expect(code, id).not.toMatch(/https?:\/\//)
    }
  })

  it('are byte-identical to upstream below the header (when the clone is present)', () => {
    for (const file of Object.values(UPSTREAM_FILES)) {
      let upstream: string
      try {
        upstream = readFileSync(join(upstreamRoot, file), 'utf-8')
      } catch {
        continue
      }
      const copy = readFileSync(join(root, file), 'utf-8')
      expect(copy.split('\n').slice(8).join('\n')).toBe(upstream)
    }
  })
})
