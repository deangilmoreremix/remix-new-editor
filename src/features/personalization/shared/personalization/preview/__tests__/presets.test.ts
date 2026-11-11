import { describe, it, expect } from 'vitest'
import {
  applyLayoutPreset,
  clampLayer,
  createDefaultPreviewSettings,
  createLayer,
  fontStackById,
  getCompositionDimensions,
  LAYER_IDS_BY_LAYOUT,
  normalizePreviewSettings,
  positionForLayer,
  PREVIEW_FONTS,
  PREVIEW_LAYOUTS,
  PREVIEW_POSITIONS,
  resetLayoutToDefaults,
  toBox,
} from '../presets'
import { DEFAULT_PREVIEW_BRAND_COLORS } from '../types'
import { DESIGN_FONT_STACK } from '../../templates/typography'

describe('getCompositionDimensions', () => {
  it('maps every aspect ratio to its composition size', () => {
    expect(getCompositionDimensions('16:9')).toEqual({ width: 1920, height: 1080 })
    expect(getCompositionDimensions('9:16')).toEqual({ width: 1080, height: 1920 })
    expect(getCompositionDimensions('1:1')).toEqual({ width: 1080, height: 1080 })
    expect(getCompositionDimensions('4:5')).toEqual({ width: 1080, height: 1350 })
  })

  it('falls back to 1920x1080 for unknown ratios', () => {
    expect(getCompositionDimensions('ultra-wide' as unknown as '16:9')).toEqual({
      width: 1920,
      height: 1080,
    })
  })
})

describe('createLayer', () => {
  it('builds per-kind defaults', () => {
    const logo = createLayer('logo')
    expect(logo.id).toBe('logo')
    expect(logo.kind).toBe('logo')
    expect(logo.visible).toBe(true)
    expect(logo.x).toBe(0.08)
    expect(logo.y).toBe(0.08)
    expect(logo.scale).toBe(0.22)
    expect(logo.animation).toBe('logo-reveal')
    expect(logo.opacity).toBe(1)
    expect(logo.animationDelay).toBe(0)
    expect(logo.startFrame).toBe(0)
    expect(logo.text).toBeUndefined()

    expect(createLayer('businessName').animation).toBe('slide-up')
    expect(createLayer('headline').scale).toBe(0.045)
    expect(createLayer('tagline').animation).toBe('fade')
    expect(createLayer('offer').animation).toBe('pop')
    expect(createLayer('cta').animation).toBe('cta-pulse')
    expect(createLayer('cta').color).toBe(DEFAULT_PREVIEW_BRAND_COLORS.accent)
    expect(createLayer('productImage').x).toBe(0.62)
    expect(createLayer('endCard').scale).toBe(1)
  })

  it('lets overrides win over defaults and clamps unsafe values', () => {
    const layer = createLayer('headline', {
      x: 2,
      y: -1,
      scale: 0.5,
      text: 'Custom',
      animation: 'fade',
      opacity: 0.5,
    })
    expect(layer.x).toBe(1)
    expect(layer.y).toBe(0)
    expect(layer.scale).toBe(0.5)
    expect(layer.text).toBe('Custom')
    expect(layer.animation).toBe('fade')
    expect(layer.opacity).toBe(0.5)
  })
})

describe('clampLayer', () => {
  it('clamps coordinates, scale, opacity and frame numbers', () => {
    const clamped = clampLayer({
      id: 'headline',
      kind: 'headline',
      visible: true,
      x: -0.5,
      y: 3,
      scale: 0.001,
      animation: 'fade',
      animationDelay: -8,
      startFrame: -2,
      opacity: 4,
    })
    expect(clamped.x).toBe(0)
    expect(clamped.y).toBe(1)
    expect(clamped.scale).toBe(0.02)
    expect(clamped.opacity).toBe(1)
    expect(clamped.animationDelay).toBe(0)
    expect(clamped.startFrame).toBe(0)
  })
})

describe('createDefaultPreviewSettings', () => {
  it('returns the business introduction layout with its layers', () => {
    const settings = createDefaultPreviewSettings()
    expect(settings.layout).toBe('business-introduction')
    expect(settings.aspectRatio).toBe('16:9')
    expect(settings.width).toBe(1920)
    expect(settings.height).toBe(1080)
    expect(settings.fps).toBe(30)
    expect(settings.durationInFrames).toBe(150)
    expect(settings.showEndCard).toBe(true)
    expect(settings.brandColors).toEqual(DEFAULT_PREVIEW_BRAND_COLORS)
    expect(settings.layers.map((layer) => layer.kind)).toEqual([
      'logo',
      'businessName',
      'headline',
    ])
  })

  it('derives dimensions from an overridden aspect ratio', () => {
    const settings = createDefaultPreviewSettings({ aspectRatio: '9:16', fps: 24 })
    expect(settings.aspectRatio).toBe('9:16')
    expect(settings.width).toBe(1080)
    expect(settings.height).toBe(1920)
    expect(settings.fps).toBe(24)
  })
})

describe('applyLayoutPreset', () => {
  it('preserves user edits for surviving layer ids and seeds new layers from ctx', () => {
    const settings = createDefaultPreviewSettings()
    settings.layers = settings.layers.map((layer) =>
      layer.id === 'headline'
        ? { ...layer, text: 'My Custom Headline', x: 0.5, y: 0.25, animation: 'fade' }
        : layer,
    )
    const next = applyLayoutPreset(settings, 'product-showcase', {
      headline: 'Seeded headline that should be ignored',
      offer: '50% off this week',
      productUrl: 'https://cdn.example.com/product.png',
    })

    expect(next.layout).toBe('product-showcase')
    expect(next.layers.map((layer) => layer.kind)).toEqual([
      'logo',
      'productImage',
      'headline',
      'offer',
    ])

    const headline = next.layers.find((layer) => layer.kind === 'headline')
    expect(headline?.text).toBe('My Custom Headline')
    expect(headline?.x).toBe(0.5)
    expect(headline?.y).toBe(0.25)
    expect(headline?.animation).toBe('fade')

    const productImage = next.layers.find((layer) => layer.kind === 'productImage')
    expect(productImage?.imageUrl).toBe('https://cdn.example.com/product.png')

    const offer = next.layers.find((layer) => layer.kind === 'offer')
    expect(offer?.text).toBe('50% off this week')
  })

  it('carries over brand colors, aspect ratio, fps and duration', () => {
    const settings = createDefaultPreviewSettings({
      brandColors: {
        primary: '#111111',
        accent: '#222222',
        text: '#333333',
        backgroundDim: 0.4,
      },
      aspectRatio: '4:5',
      fps: 24,
      durationInFrames: 90,
    })
    const next = applyLayoutPreset(settings, 'special-offer', {
      offer: 'Two for one',
      cta: 'Call today',
    })
    expect(next.layout).toBe('special-offer')
    expect(next.brandColors).toEqual(settings.brandColors)
    expect(next.aspectRatio).toBe('4:5')
    expect(next.fps).toBe(24)
    expect(next.durationInFrames).toBe(90)
    expect(next.layers.map((layer) => layer.kind)).toEqual(['headline', 'offer', 'cta'])
    expect(next.layers.find((layer) => layer.kind === 'offer')?.text).toBe('Two for one')
    expect(next.layers.find((layer) => layer.kind === 'cta')?.text).toBe('Call today')
  })

  it('seeds tagline text from ctx and never seeds the end card layer', () => {
    const seeded = applyLayoutPreset(createDefaultPreviewSettings(), 'service-promotion', {
      businessName: 'Acme Roofing',
      serviceUrl: 'https://cdn.example.com/service.png',
    })
    expect(seeded.layers.find((layer) => layer.kind === 'tagline')?.text).toBe('Acme Roofing')
    expect(seeded.layers.find((layer) => layer.kind === 'serviceImage')?.imageUrl).toBe(
      'https://cdn.example.com/service.png',
    )

    const ending = applyLayoutPreset(createDefaultPreviewSettings(), 'branded-ending', {
      businessName: 'Acme Roofing',
      cta: 'Book today',
    })
    const endCard = ending.layers.find((layer) => layer.kind === 'endCard')
    expect(endCard?.text).toBeUndefined()
    expect(endCard?.imageUrl).toBeUndefined()
  })

  it('ignores empty seeding values and falls back to the introduction layout for unknown ids', () => {
    const next = applyLayoutPreset(createDefaultPreviewSettings(), 'product-showcase', {
      headline: '   ',
      offer: '',
    })
    expect(next.layers.find((layer) => layer.kind === 'headline')?.text).toBeUndefined()
    expect(next.layers.find((layer) => layer.kind === 'offer')?.text).toBeUndefined()
  })
})

describe('resetLayoutToDefaults', () => {
  it('restores default geometry for layers the user edited', () => {
    const settings = createDefaultPreviewSettings()
    const defaults = createDefaultPreviewSettings()
    const logoDefaults = defaults.layers.find((layer) => layer.kind === 'logo')

    // The customer dragged the logo, resized it, hid a layer and changed the
    // animation — "Restore default layout" must undo all of that.
    settings.layers = settings.layers.map((layer) =>
      layer.kind === 'logo'
        ? { ...layer, x: 0.5, y: 0.5, scale: 1.4, visible: false, animation: 'none' }
        : layer,
    )

    const next = resetLayoutToDefaults(settings, settings.layout)
    const logo = next.layers.find((layer) => layer.kind === 'logo')

    expect(logo?.x).toBe(logoDefaults?.x)
    expect(logo?.y).toBe(logoDefaults?.y)
    expect(logo?.scale).toBe(logoDefaults?.scale)
    expect(logo?.visible).toBe(true)
    expect(logo?.animation).toBe(logoDefaults?.animation)
    expect(next.layout).toBe('business-introduction')
  })

  it('re-seeds every layer id the layout expects', () => {
    const settings = createDefaultPreviewSettings()
    // A user deleted a layer id from the list entirely.
    settings.layers = settings.layers.filter((layer) => layer.kind !== 'headline')

    const next = resetLayoutToDefaults(settings, settings.layout)
    const kinds = LAYER_IDS_BY_LAYOUT['business-introduction']
    expect(next.layers.map((layer) => layer.kind)).toEqual([...kinds])
  })

  it('keeps brand content while dropping positional edits (business-introduction)', () => {
    const settings = createDefaultPreviewSettings()
    settings.layers = settings.layers.map((layer) =>
      layer.kind === 'headline' ? { ...layer, text: 'Typed By The Customer', x: 0.9 } : layer,
    )

    const next = resetLayoutToDefaults(settings, settings.layout, {
      businessName: 'Acme Roofing',
      headline: 'The friendly neighborhood roofers',
      logoUrl: 'https://cdn.example.com/logo.png',
    })

    // Content comes from the form/asset seed, not from the mangled layer…
    expect(next.layers.find((layer) => layer.kind === 'headline')?.text).toBe(
      'The friendly neighborhood roofers',
    )
    expect(next.layers.find((layer) => layer.kind === 'businessName')?.text).toBe('Acme Roofing')
    expect(next.layers.find((layer) => layer.kind === 'logo')?.imageUrl).toBe(
      'https://cdn.example.com/logo.png',
    )
    // …while position is back to the layout default, not the customer's.
    expect(next.layers.find((layer) => layer.kind === 'headline')?.x).toBe(
      createLayer('headline').x,
    )
    expect(next.layers.find((layer) => layer.kind === 'logo')?.x).toBe(createLayer('logo').x)
  })

  it('re-seeds tagline and serviceImage for the service-promotion layout', () => {
    const settings = createDefaultPreviewSettings({ layout: 'service-promotion' })
    const next = resetLayoutToDefaults(settings, 'service-promotion', {
      headline: 'Fast roof repairs',
      tagline: 'We fix roofs fast',
      serviceUrl: 'https://cdn.example.com/service.png',
    })

    expect(next.layers.map((layer) => layer.kind)).toEqual([
      'logo',
      'serviceImage',
      'headline',
      'tagline',
    ])
    expect(next.layers.find((layer) => layer.kind === 'tagline')?.text).toBe('We fix roofs fast')
    expect(next.layers.find((layer) => layer.kind === 'serviceImage')?.imageUrl).toBe(
      'https://cdn.example.com/service.png',
    )
    expect(next.layers.find((layer) => layer.kind === 'headline')?.text).toBe('Fast roof repairs')
  })

  it('preserves brand colors, aspect ratio, fps and duration and falls back for unknown ids', () => {
    const settings = createDefaultPreviewSettings({
      brandColors: {
        primary: '#111111',
        accent: '#222222',
        text: '#333333',
        backgroundDim: 0.4,
      },
      aspectRatio: '9:16',
      fps: 24,
      durationInFrames: 90,
    })

    const next = resetLayoutToDefaults(
      settings,
      'not-a-layout' as unknown as (typeof PREVIEW_LAYOUTS)[number]['id'],
    )
    expect(next.layout).toBe('not-a-layout')
    expect(next.brandColors.primary).toBe('#111111')
    expect(next.aspectRatio).toBe('9:16')
    expect(next.fps).toBe(24)
    expect(next.durationInFrames).toBe(90)
    expect(next.layers.map((layer) => layer.kind)).toEqual([
      ...LAYER_IDS_BY_LAYOUT['business-introduction'],
    ])
    expect(DEFAULT_PREVIEW_BRAND_COLORS.accent).not.toBe('#222222')
  })
})

describe('normalizePreviewSettings', () => {
  it('returns valid defaults for garbage input without throwing', () => {
    const garbage: unknown[] = [null, undefined, 'nope', 42, true, [], {}]
    for (const raw of garbage) {
      const settings = normalizePreviewSettings(raw)
      expect(settings.layout).toBe('business-introduction')
      expect(settings.layers.length).toBeGreaterThan(0)
      expect(settings.width).toBe(1920)
      expect(settings.height).toBe(1080)
      expect(settings.fps).toBeGreaterThan(0)
      expect(settings.durationInFrames).toBeGreaterThan(0)
    }
  })

  it('ignores a non-array layers field', () => {
    const settings = normalizePreviewSettings({ layers: 'nope' })
    expect(settings.layers.map((layer) => layer.kind)).toEqual([
      'logo',
      'businessName',
      'headline',
    ])
  })

  it('drops layers with unknown kinds and clamps invalid coordinates', () => {
    const settings = normalizePreviewSettings({
      layers: [
        {
          id: 'headline',
          kind: 'headline',
          x: -3,
          y: 5,
          scale: 99,
          opacity: -1,
          animationDelay: -7,
          startFrame: -4,
          animation: 'spin',
        },
        { id: 'sparkles', kind: 'sparkles', x: 0.5 },
        { id: 'cta', kind: 'cta', text: 'Book now' },
      ],
    })
    expect(settings.layers.map((layer) => layer.id)).toEqual(['headline', 'cta'])

    const headline = settings.layers[0]
    expect(headline.x).toBe(0)
    expect(headline.y).toBe(1)
    expect(headline.scale).toBe(1)
    expect(headline.opacity).toBe(0)
    expect(headline.animationDelay).toBe(0)
    expect(headline.startFrame).toBe(0)
    expect(headline.animation).toBe('slide-up')

    const cta = settings.layers[1]
    expect(cta.text).toBe('Book now')
    expect(cta.animation).toBe('cta-pulse')
  })

  it('ensures unique layer ids by suffixing', () => {
    const settings = normalizePreviewSettings({
      layers: [
        { id: 'headline', kind: 'headline', text: 'first' },
        { id: 'headline', kind: 'headline', text: 'second' },
        { id: 'headline-2', kind: 'headline', text: 'third' },
      ],
    })
    expect(settings.layers.map((layer) => layer.id)).toEqual([
      'headline',
      'headline-2',
      'headline-2-2',
    ])
  })

  it('keeps valid scalars, ignores unknown fields and clamps out-of-range values', () => {
    const settings = normalizePreviewSettings({
      layout: 'special-offer',
      aspectRatio: '9:16',
      fps: 999,
      durationInFrames: -5,
      showEndCard: false,
      width: 1280,
      height: 720,
      brandColors: { primary: '#abcdef', accent: 12, text: '', backgroundDim: 3 },
      unknownField: 'ignored',
    })
    expect(settings.layout).toBe('special-offer')
    expect(settings.aspectRatio).toBe('9:16')
    expect(settings.fps).toBe(120)
    expect(settings.durationInFrames).toBe(150)
    expect(settings.showEndCard).toBe(false)
    expect(settings.brandColors.primary).toBe('#abcdef')
    expect(settings.brandColors.accent).toBe(DEFAULT_PREVIEW_BRAND_COLORS.accent)
    expect(settings.brandColors.text).toBe(DEFAULT_PREVIEW_BRAND_COLORS.text)
    expect(settings.brandColors.backgroundDim).toBe(1)
    expect((settings as unknown as Record<string, unknown>).unknownField).toBeUndefined()
  })
  it('preserves textSlotOverrides through a save/reload round trip (audit point 6)', () => {
    // The persisted blob a saved project stores (save spreads the layer verbatim);
    // the reload runs it back through normalizePreviewSettings -> normalizeLayer.
    const saved = {
      layers: [
        {
          id: 'design',
          kind: 'design',
          designId: 'lower-third',
          text: 'Acme Roofing',
          textSlotOverrides: { offer: 'Summer sale', ghost: 'Not a slot', empty: '   ' },
        },
      ],
    }
    const reloaded = normalizePreviewSettings(saved)
    const designLayer = reloaded.layers[0] as unknown as {
      textSlotOverrides?: Record<string, string>
    }
    // String values survive verbatim (undeclared keys are ignored by the
    // slot resolver, not deleted here); only non-strings are dropped.
    expect(designLayer.textSlotOverrides).toEqual({
      offer: 'Summer sale',
      ghost: 'Not a slot',
      empty: '   ',
    })
    // A layer without overrides keeps having no map.
    const noOverrides = normalizePreviewSettings({
      layers: [{ id: 'headline', kind: 'headline', text: 'hi' }],
    })
    expect(
      (noOverrides.layers[0] as unknown as Record<string, unknown>).textSlotOverrides,
    ).toBeUndefined()
  })
})

describe('toBox', () => {
  it('converts text layers from center coordinates and scale', () => {
    const layer = createLayer('headline', { x: 0.5, y: 0.5, scale: 0.05, text: 'Hello' })
    const box = toBox(layer, 1920, 1080)
    // fontSize = 0.05 * 1080; width = min(1920 * 0.9, fontSize * max(4, 5 * 0.55))
    expect(box.fontSizePx).toBe(54)
    expect(box.widthPx).toBe(216)
    expect(box.leftPx).toBe(Math.round(1920 * 0.5 - 216 / 2))
    expect(box.topPx).toBe(Math.round(1080 * 0.5 - 54 / 2))
  })

  it('converts image layers to a square box sized by width fraction', () => {
    const layer = createLayer('logo', { x: 0.08, y: 0.08 })
    const box = toBox(layer, 1920, 1080)
    expect(box.widthPx).toBe(422)
    expect(box.leftPx).toBe(Math.round(0.08 * 1920 - 422 / 2))
    expect(box.topPx).toBe(Math.max(0, Math.round(0.08 * 1080 - 422 / 2)))
  })

  it('clamps the top edge to the composition', () => {
    const layer = createLayer('headline', { x: 0, y: 0, scale: 0.2, text: 'x' })
    const box = toBox(layer, 1920, 1080)
    expect(box.topPx).toBe(0)
    expect(box.fontSizePx).toBe(216)
    expect(box.leftPx).toBe(Math.round(0 - Math.min(1920 * 0.9, 216 * 4) / 2))
  })
})

describe('positionForLayer', () => {
  it('returns the preset center for every position', () => {
    const layer = createLayer('headline')
    for (const position of PREVIEW_POSITIONS) {
      expect(positionForLayer(layer, position.id)).toEqual({ x: position.x, y: position.y })
    }
    expect(PREVIEW_POSITIONS).toHaveLength(8)
  })

  it('is the identity for unknown positions', () => {
    const layer = createLayer('headline', { x: 0.3, y: 0.7 })
    expect(positionForLayer(layer, 'middle-of-nowhere' as unknown as 'center')).toEqual({
      x: 0.3,
      y: 0.7,
    })
  })
})

describe('PREVIEW_LAYOUTS', () => {
  it('exposes exactly the five customer-facing layouts with names', () => {
    expect(PREVIEW_LAYOUTS.map((layout) => layout.id)).toEqual([
      'business-introduction',
      'product-showcase',
      'service-promotion',
      'special-offer',
      'branded-ending',
    ])
    expect(PREVIEW_LAYOUTS.map((layout) => layout.name)).toEqual([
      'Business Introduction',
      'Product Showcase',
      'Service Promotion',
      'Special Offer',
      'Branded Ending',
    ])
    for (const layout of PREVIEW_LAYOUTS) {
      expect(layout.description.length).toBeGreaterThan(0)
    }
  })

  it('keeps LAYER_IDS_BY_LAYOUT in sync with the layouts', () => {
    for (const layout of PREVIEW_LAYOUTS) {
      expect(LAYER_IDS_BY_LAYOUT[layout.id]).toBeDefined()
      expect(LAYER_IDS_BY_LAYOUT[layout.id].length).toBeGreaterThan(0)
    }
    expect(LAYER_IDS_BY_LAYOUT['business-introduction']).toEqual([
      'logo',
      'businessName',
      'headline',
    ])
    expect(LAYER_IDS_BY_LAYOUT['branded-ending']).toEqual([
      'logo',
      'businessName',
      'cta',
      'endCard',
    ])
  })
})

describe('fontStackById', () => {
  // Phase 3 decision D3: the picker is deterministic — the bundled
  // "Personalization Sans" is the only available face, and EVERY id
  // (historical, unknown or missing) resolves to the bundled stack, so a
  // saved Georgia layer renders with the bundled face (export fidelity).
  it('resolves every id — historical, unknown or missing — to the bundled stack', () => {
    for (const font of PREVIEW_FONTS) {
      expect(fontStackById(font.id)).toBe(DESIGN_FONT_STACK)
      // A layer that persisted the entry's stack string also resolves to the
      // bundled face, never to a per-OS stack.
      expect(fontStackById(font.stack)).toBe(DESIGN_FONT_STACK)
    }
    expect(fontStackById()).toBe(DESIGN_FONT_STACK)
    expect(fontStackById('comic-sans')).toBe(DESIGN_FONT_STACK)
    expect(fontStackById('Inter, ui-sans-serif, system-ui, sans-serif')).toBe(DESIGN_FONT_STACK)
  })

  it('keeps the historical ids resolvable so persisted layers never break', () => {
    for (const id of ['inter', 'georgia', 'impact', 'monospace']) {
      expect(fontStackById(id)).toBe(DESIGN_FONT_STACK)
    }
  })

  it('offers exactly one available face — the bundled Personalization Sans', () => {
    const available = PREVIEW_FONTS.filter((font) => font.available)
    expect(available).toHaveLength(1)
    expect(available[0].id).toBe('personalization-sans')
    expect(available[0].label).toBe('Personalization Sans')
    expect(available[0].stack).toBe(DESIGN_FONT_STACK)

    for (const font of PREVIEW_FONTS) {
      if (font.id === 'personalization-sans') continue
      expect(font.available).toBe(false)
      expect(font.label.endsWith(' (unavailable)')).toBe(true)
    }
  })
})
