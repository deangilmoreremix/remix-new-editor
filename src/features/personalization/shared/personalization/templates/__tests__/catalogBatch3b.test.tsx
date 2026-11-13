// @vitest-environment jsdom
/**
 * Phase 4 porting batch 3b: thirteen repo-1 templates (six pixel-art scenes
 * on the shared `pixel-kit` helper, seven transitions).
 *
 * The designs are rendered through REAL Remotion (`@remotion/player`'s
 * `<Thumbnail>`), wrapped in a `<Sequence>` exactly like
 * `PersonalizationComposition` wraps a design layer, so the hooks, `<Freeze>`,
 * nested `<Sequence>`s and the scoped `durationInFrames` the adapters rely on
 * are exercised for real.
 */
import React, { act } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { Thumbnail } from '@remotion/player'
import { Sequence, useCurrentFrame } from 'remotion'
import { BATCH_3B_FIXED_SVG_IDS, BATCH_3B_TEMPLATES } from '../designs/batch3b/entries'
import { REPO1_ATTRIBUTION, bitmapSafe, fitWords, hex6, mix } from '../designs/batch3b/shared'
import { fitQuote } from '../designs/batch3b/PixelTypewriterQuoteDesign'
import { circleWipeHoleRadius } from '../designs/batch3b/TransitionCircleWipeDesign'
import type {
  RemotionDesignComponentProps,
  RemotionDesignTemplate,
  RemotionDesignTextField,
} from '../types'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const BATCH_IDS = [
  'four-tone-mono-titler',
  'pixel-typewriter-quote',
  'pixel-mosaic-transition',
  'pourover-drip-fill-gauge',
  'pixel-candlestick-ohlc',
  'pixel-waterfall-cycle',
  'card-flip-transition',
  'transition-circle-wipe',
  'ink-spread-transition',
  'flip-page-transition',
  'slide-wipe',
  'whip-pan',
  'camera-shake',
]

const PIXEL_IDS = BATCH_IDS.slice(0, 6)

const UPSTREAM_DIR = join(process.cwd(), 'src/features/personalization/shared/personalization/templates/_upstream')
const UPSTREAM_FOLDERS = [...BATCH_IDS, 'pixel-kit']

const VALID_FIELDS: RemotionDesignTextField[] = ['businessName', 'headline', 'offer', 'cta', 'phone', 'website']
const OVERLAY_CATEGORIES = ['animated-headline', 'logo-reveal', 'lower-third', 'promo-cta', 'visual-effect', 'other']

const BRAND: Record<RemotionDesignTextField, string> = {
  businessName: 'Acme Roofing',
  headline: 'Roofing done right',
  offer: '20% off this week',
  cta: 'Book now',
  phone: '555-0100',
  website: 'acme.example.com',
}

const LONG =
  'Supercalifragilisticexpialidocious roofing and guttering specialists serving the entire metropolitan area since 1987 with pride'

function makeProps(
  template: RemotionDesignTemplate,
  width: number,
  height: number,
  overrides: Partial<RemotionDesignComponentProps> & { values?: Partial<Record<RemotionDesignTextField, string>> } = {},
): RemotionDesignComponentProps {
  const values = { ...BRAND, ...(overrides.values ?? {}) }
  const slots: Record<string, string> = {}
  for (const slot of template.textSlots ?? []) slots[slot.key] = values[slot.field]
  const primary = (template.textSlots ?? []).find((slot) => slot.primary)
  const { values: _values, ...rest } = overrides
  void _values
  return {
    text: primary ? values[primary.field] : '',
    textSlots: slots,
    colors: { primary: '#d9ff00', accent: '#28c98b', text: '#ffffff', backgroundDim: 0.18 },
    media: { logo: null, product: null, service: null },
    box: { leftPx: 0, topPx: 0, widthPx: width, heightPx: height },
    width,
    height,
    frame: 0,
    fps: 30,
    opacity: 1,
    color: '#ffffff',
    ...rest,
  }
}

type HostInput = {
  template: RemotionDesignTemplate
  props: RemotionDesignComponentProps
  layerDuration: number
}

/** Mirrors `PersonalizationComposition`: the design lives in a layer Sequence. */
const Host: React.FC<HostInput> = ({ template, props, layerDuration }) => {
  const frame = useCurrentFrame()
  const Component = template.component
  return (
    <Sequence from={0} durationInFrames={layerDuration}>
      <Component {...(template.defaultProps ?? {})} {...props} frame={frame} />
    </Sequence>
  )
}

const roots: Array<{ root: Root; host: HTMLElement }> = []

afterEach(() => {
  for (const { root, host } of roots.splice(0)) {
    act(() => root.unmount())
    host.remove()
  }
})

async function show(
  template: RemotionDesignTemplate,
  frame: number,
  options: {
    width?: number
    height?: number
    overrides?: Parameters<typeof makeProps>[3]
    compositionDuration?: number
  } = {},
): Promise<HTMLElement> {
  const width = options.width ?? 1920
  const height = options.height ?? 1080
  const compositionDuration = options.compositionDuration ?? 600
  const layerDuration = template.placement?.endFrame ?? compositionDuration
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  roots.push({ root, host })
  const inputProps: HostInput = { template, props: makeProps(template, width, height, options.overrides), layerDuration }
  await act(async () => {
    root.render(
      <Thumbnail
        component={Host as React.ComponentType<Record<string, unknown>>}
        compositionWidth={width}
        compositionHeight={height}
        frameToDisplay={frame}
        durationInFrames={compositionDuration}
        fps={30}
        inputProps={inputProps as unknown as Record<string, unknown>}
        errorFallback={({ error }) => <div data-render-error>{String(error?.message ?? error)}</div>}
      />,
    )
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return host
}

function expectRendered(host: HTMLElement, id: string) {
  const error = host.querySelector('[data-render-error]')
  expect(error?.textContent ?? null, `${id} render error`).toBeNull()
  expect(host.querySelector(`[data-remotion-design="${id}"]`), `${id} stage`).not.toBeNull()
  expect(host.querySelector('[data-remotion-design-credit]'), `${id} credit`).toBeNull()
  expect(host.innerHTML, `${id} NaN`).not.toMatch(/NaN/)
}

function byId(id: string): RemotionDesignTemplate {
  const template = BATCH_3B_TEMPLATES.find((entry) => entry.id === id)
  if (!template) throw new Error(`missing ${id}`)
  return template
}

/** Removes block comments and whole-line `//` comments. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
}

describe('batch 3b — metadata', () => {
  it('exports exactly the thirteen batch-3b designs in order', () => {
    expect(BATCH_3B_TEMPLATES.map((t) => t.id)).toEqual(BATCH_IDS)
    expect(new Set(BATCH_IDS).size).toBe(BATCH_IDS.length)
  })

  it.each(BATCH_IDS)('%s has complete, honest metadata', (id) => {
    const t = byId(id)
    expect(t.name.trim().length).toBeGreaterThan(3)
    expect(t.description.trim().length).toBeGreaterThan(10)
    expect(t.component).toBeTruthy()
    expect(t.source.repository).toBe('free-remotion-templates')
    expect(t.source.repositoryUrl).toBe('https://github.com/deangilmoreremix/free-remotion-templates')
    expect(t.source.sourcePath).toBe(
      `src/components/${id}/${readdirSync(join(UPSTREAM_DIR, id)).find((f) => f.endsWith('.tsx'))}`,
    )
    expect(t.source.license).toBe('MIT')
    expect(t.source.attribution).toBe(REPO1_ATTRIBUTION)

    const slots = t.textSlots ?? []
    if (slots.length > 0) expect(slots.filter((s) => s.primary)).toHaveLength(1)
    for (const slot of slots) expect(VALID_FIELDS).toContain(slot.field)
    expect(new Set(slots.map((s) => s.key)).size).toBe(slots.length)

    expect(t.aspectRatios).toContain('16:9')
    expect(t.capabilities.preview).toBe(true)
    expect(t.capabilities.browserExport).toBe(true)
    expect((t.capabilities.notes ?? '').length).toBeGreaterThan(40)
    expect(t.previewCompatible).toBe(true)
    expect(t.requiredMedia ?? []).toEqual([])
    expect(t.animation?.durationInFrames).toBeGreaterThan(0)

    expect(OVERLAY_CATEGORIES).not.toContain(t.category)
    expect(['full-scene', 'data-visualization', 'transition']).toContain(t.category)
    expect(t.placement).toMatchObject({ x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none' })
    const end = t.placement?.endFrame ?? 0
    if (t.category === 'transition') {
      expect(end).toBeGreaterThanOrEqual(45)
      expect(end).toBeLessThanOrEqual(120)
    } else {
      expect(end).toBeGreaterThanOrEqual(90)
      expect(end).toBeLessThanOrEqual(150)
    }
  })

  it('classifies the pixel scenes and the transitions', () => {
    const categories = Object.fromEntries(BATCH_3B_TEMPLATES.map((t) => [t.id, t.category]))
    expect(categories).toMatchObject({
      'four-tone-mono-titler': 'full-scene',
      'pixel-typewriter-quote': 'full-scene',
      'pixel-waterfall-cycle': 'full-scene',
      'pourover-drip-fill-gauge': 'data-visualization',
      'pixel-candlestick-ohlc': 'data-visualization',
      'pixel-mosaic-transition': 'transition',
      'whip-pan': 'transition',
      'camera-shake': 'transition',
    })
    for (const id of ['whip-pan', 'camera-shake']) {
      expect(byId(id).capabilities.notes).toMatch(/not a true two-clip transition/i)
    }
  })

  it('records the hard-coded SVG ids', () => {
    expect(BATCH_3B_FIXED_SVG_IDS['ink-spread-transition']).toEqual(['ink-bleed', 'ink-core'])
    for (const id of ['pixel-typewriter-quote', 'pixel-mosaic-transition', 'pourover-drip-fill-gauge', 'pixel-candlestick-ohlc', 'pixel-waterfall-cycle']) {
      expect(BATCH_3B_FIXED_SVG_IDS[id]).toEqual(['bayer4', 'px-noise'])
    }
    for (const id of Object.keys(BATCH_3B_FIXED_SVG_IDS)) expect(BATCH_IDS).toContain(id)
  })

  it('is registered by the catalog with the catalog attribution', async () => {
    const catalog = await import('../catalog')
    const registry = await import('../registry')
    expect(REPO1_ATTRIBUTION).toBe(catalog.REMOTION_DESIGN_ATTRIBUTION)
    for (const id of BATCH_IDS) {
      expect(registry.getRemotionDesignTemplate(id)?.id).toBe(id)
      expect(catalog.REMOTION_DESIGN_PHASE4_TEMPLATES.map((t) => t.id)).toContain(id)
    }
    for (const [id, ids] of Object.entries(BATCH_3B_FIXED_SVG_IDS)) {
      expect(catalog.REMOTION_DESIGN_FIXED_SVG_IDS[id]).toEqual(ids)
    }
  })
})

describe('batch 3b — upstream copies', () => {
  it.each(UPSTREAM_FOLDERS)('%s carries a provenance header and no network URLs in code', (folder) => {
    const files = readdirSync(join(UPSTREAM_DIR, folder))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const source = readFileSync(join(UPSTREAM_DIR, folder, file), 'utf-8')
      expect(source, file).toContain('free-remotion-templates (main @ f648980e528defb7594e24c6447055f0540f340b)')
      expect(source, file).toContain('Copyright (c) 2026 Trimora Inc.')
      expect(source, file).toMatch(/Upstream code is reproduced verbatim apart from this header comment/)
      expect(stripComments(source), file).not.toMatch(/https?:\/\//)
      expect(source, file).not.toMatch(/staticFile|<Img|<Video|<Audio|fetch\(/)
    }
  })

  it('points the six pixel templates at the local pixel-kit copy (recorded deviation)', () => {
    for (const id of PIXEL_IDS) {
      const file = readdirSync(join(UPSTREAM_DIR, id)).find((f) => f.endsWith('.tsx'))!
      const source = readFileSync(join(UPSTREAM_DIR, id, file), 'utf-8')
      expect(source).toContain('} from "../pixel-kit";')
      expect(stripComments(source)).not.toContain('../../pixel-kit')
      expect(source).toContain('DEVIATION RECORD')
    }
  })
})

describe('batch 3b — helpers', () => {
  it('normalises brand colours for the 6-digit-only upstream parsers', () => {
    expect(hex6('#abc', '#000000')).toBe('#aabbcc')
    expect(hex6('rgb(255, 0, 10)', '#000000')).toBe('#ff000a')
    expect(hex6('not-a-colour', '#123456')).toBe('#123456')
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('fits text for the bitmap font and the wrapping labels', () => {
    expect(bitmapSafe('Café — “Best” 🍕 in town', 40)).toBe('Caf Best in town')
    expect(bitmapSafe(LONG, 17).length).toBeLessThanOrEqual(17)
    const fitted = fitWords(LONG, 10, 2)
    const lines: string[] = []
    for (const word of fitted.split(' ')) {
      const last = lines[lines.length - 1]
      if (last !== undefined && `${last} ${word}`.length <= 10) lines[lines.length - 1] = `${last} ${word}`
      else lines.push(word)
    }
    expect(lines.length).toBeLessThanOrEqual(2)
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(10)
    expect(fitWords('', 10, 2)).toBe('')
  })

  it('keeps the typewriter quote to four 21-character lines', () => {
    const quote = fitQuote(LONG)
    expect(quote.length).toBeLessThanOrEqual(4 * 21 + 3)
    expect(quote.endsWith('..')).toBe(true)
    expect(fitQuote('Short quote')).toBe('Short quote')
  })

  it('opens the circle-wipe hole from nothing to past the frame corners', () => {
    expect(circleWipeHoleRadius(0, 1920, 1080, 60)).toBe(0)
    expect(circleWipeHoleRadius(59, 1920, 1080, 60)).toBeGreaterThan(Math.hypot(960, 540))
  })
})

describe('batch 3b — rendering through real Remotion', () => {
  it.each(BATCH_IDS)('%s renders at the start, middle and end without errors', async (id) => {
    const t = byId(id)
    const end = t.placement?.endFrame ?? 120
    for (const frame of [0, Math.round(end / 2), end - 1]) {
      const host = await show(t, frame)
      expectRendered(host, id)
    }
  })

  it.each(BATCH_IDS)('%s renders long text and odd colour formats in every offered aspect ratio', async (id) => {
    const t = byId(id)
    const sizes: Record<string, [number, number]> = {
      '16:9': [1920, 1080],
      '9:16': [1080, 1920],
      '1:1': [1080, 1080],
      '4:5': [1080, 1350],
    }
    for (const ratio of t.aspectRatios ?? []) {
      const [width, height] = sizes[ratio]
      const host = await show(t, Math.round((t.placement?.endFrame ?? 120) * 0.7), {
        width,
        height,
        overrides: {
          values: { businessName: LONG, headline: LONG, offer: LONG, cta: LONG },
          colors: { primary: '#123', accent: 'rgb(250, 200, 20)', text: '#fff', backgroundDim: 0.2 },
          color: '#fff',
        },
      })
      expectRendered(host, id)
    }
  })

  it('maps the brand name into the transition cards', async () => {
    for (const id of ['card-flip-transition', 'flip-page-transition', 'slide-wipe', 'transition-circle-wipe', 'ink-spread-transition', 'whip-pan']) {
      const host = await show(byId(id), 5)
      expect(host.textContent, id).toContain('Acme Roofing')
    }
    const shake = await show(byId('camera-shake'), 40)
    expect(shake.textContent).toContain('Roofing done right')
    expect(shake.textContent).toContain('Acme Roofing')
  })

  it('reveals the video on the after side of the true transitions', async () => {
    // Card flip / page turn / slide wipe: the after page and the backdrop are transparent.
    for (const id of ['card-flip-transition', 'slide-wipe']) {
      const host = await show(byId(id), 74)
      const canvas = host.querySelector('[data-remotion-design-canvas]') as HTMLElement
      const root = canvas.firstElementChild as HTMLElement
      expect(root.style.backgroundColor, id).toBe('transparent')
      const painted = Array.from(canvas.querySelectorAll<HTMLElement>('div')).filter(
        (el) => el.style.backgroundColor && el.style.backgroundColor !== 'transparent',
      )
      // Only the outgoing brand page is painted.
      expect(painted.length, id).toBe(1)
    }
    const flip = await show(byId('flip-page-transition'), 74)
    const flipRoot = flip.querySelector('[data-remotion-design-canvas]')!.firstElementChild as HTMLElement
    expect(flipRoot.style.backgroundColor).toBe('transparent')

    // Slide wipe: the brand page has left the frame.
    const slide = await show(byId('slide-wipe'), 74)
    expect(slide.innerHTML).toMatch(/translateX\(-9\d\.\d+%\)|translateX\(-100%\)/)

    // Circle wipe: the hole covers the whole frame once the iris is open.
    const wipe = await show(byId('transition-circle-wipe'), 50)
    const hole = Number(wipe.querySelector('[data-batch3b-iris-hole]')?.getAttribute('data-batch3b-iris-hole'))
    expect(hole).toBeGreaterThan(Math.hypot(960, 540))
    const closed = await show(byId('transition-circle-wipe'), 2)
    expect(Number(closed.querySelector('[data-batch3b-iris-hole]')?.getAttribute('data-batch3b-iris-hole'))).toBe(0)
  })

  it('pins the circle-wipe timing even when the layer runs for the whole video', async () => {
    const t = { ...byId('transition-circle-wipe'), placement: { ...byId('transition-circle-wipe').placement!, endFrame: undefined } }
    const host = await show(t, 50, { compositionDuration: 900 })
    const hole = Number(host.querySelector('[data-batch3b-iris-hole]')?.getAttribute('data-batch3b-iris-hole'))
    expect(hole).toBeGreaterThan(Math.hypot(960, 540))
  })

  it('dissolves the opaque intros into the video by their end frame', async () => {
    for (const id of ['pixel-mosaic-transition', 'ink-spread-transition', 'whip-pan', 'camera-shake']) {
      const t = byId(id)
      const early = await show(t, 10)
      expect(Number((early.querySelector('[data-batch3b-fade]') as HTMLElement).style.opacity), id).toBe(1)
      const late = await show(t, (t.placement!.endFrame as number) - 1)
      expect(Number((late.querySelector('[data-batch3b-fade]') as HTMLElement).style.opacity), id).toBeLessThan(0.15)
    }
  })

  it('freezes the mosaic on brand screen A after the swap (screen B never shows)', async () => {
    const t = byId('pixel-mosaic-transition')
    const swap = (t.placement!.endFrame as number) - 12
    const svgOf = (host: HTMLElement) => host.querySelector('[data-remotion-design-canvas] svg')!.outerHTML
    const atFreeze = svgOf(await show(t, swap - 1))
    expect(svgOf(await show(t, swap + 4))).toBe(atFreeze)
    expect(svgOf(await show(t, swap - 10))).not.toBe(atFreeze)
  })

  it('draws the fixed SVG ids it declares', async () => {
    for (const [id, ids] of Object.entries(BATCH_3B_FIXED_SVG_IDS)) {
      const t = byId(id)
      const host = await show(t, Math.round((t.placement!.endFrame as number) / 2))
      for (const svgId of ids) expect(host.querySelector(`[id="${svgId}"]`), `${id} #${svgId}`).not.toBeNull()
    }
  })
})
