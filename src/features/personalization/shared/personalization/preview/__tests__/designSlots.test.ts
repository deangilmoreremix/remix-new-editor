// @vitest-environment jsdom
/**
 * The shared design-slot resolver.
 *
 * `preview/designSlots.ts` is the single source of truth for the rule in
 * `docs/phase2/INTERFACE-slots.md` §2. These tests pin the precedence down
 * and the "never render empty" guarantee, because BOTH the inspector and the
 * render path depend on it.
 */

import { describe, it, expect } from 'vitest'
import {
  brandSlotValue,
  designSlotLabel,
  designSlotOverrides,
  isPrimaryDesignSlot,
  resolveDesignSlotValues,
} from '../designSlots'
import type { PreviewInputProps, PreviewLayer } from '../types'
import type { RemotionDesignTemplate, RemotionDesignTextSlot } from '../../templates/types'

const BRAND: PreviewInputProps['brand'] = {
  businessName: 'Acme Roofing',
  headline: 'Roofs that last',
  offer: '10% off this week',
  cta: 'Book now',
  phone: '555-0100',
  website: 'acme.test',
  logoUrl: null,
  productUrl: null,
  serviceUrl: null,
}

const SLOTS: RemotionDesignTextSlot[] = [
  { key: 'headline', field: 'headline', label: 'Headline', primary: true },
  { key: 'business', field: 'businessName', label: 'Business name' },
  { key: 'offer', field: 'offer' },
]

const DESIGN: RemotionDesignTemplate = {
  id: 'demo-design',
  name: 'Demo design',
  description: 'A design used by the design-slot resolver tests.',
  category: 'animated-headline',
  source: {
    repository: 'example/repo',
    repositoryUrl: 'https://example.com/example/repo',
    sourcePath: 'src/Design.tsx',
    license: 'MIT',
    attribution: 'Example attribution',
  },
  component: () => null,
  defaultProps: {},
  textSlots: SLOTS,
  colors: [],
  media: [],
  animation: { durationInFrames: 30, delayInFrames: 0, easing: 'ease-out cubic' },
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'fade' },
  aspectRatios: ['16:9'],
  requiredMedia: [],
  capabilities: { preview: true, browserExport: true },
  previewCompatible: true,
}

function makeLayer(overrides: Partial<PreviewLayer> = {}): PreviewLayer {
  return {
    id: 'design',
    kind: 'design',
    designId: 'demo-design',
    visible: true,
    x: 0.5,
    y: 0.5,
    scale: 1,
    opacity: 1,
    animation: 'fade',
    animationDelay: 0,
    startFrame: 0,
    ...overrides,
  }
}

describe('brandSlotValue', () => {
  it('returns the brand value of the field', () => {
    expect(brandSlotValue('businessName', BRAND)).toBe('Acme Roofing')
    expect(brandSlotValue('headline', BRAND)).toBe('Roofs that last')
    expect(brandSlotValue('offer', BRAND)).toBe('10% off this week')
    expect(brandSlotValue('cta', BRAND)).toBe('Book now')
    expect(brandSlotValue('phone', BRAND)).toBe('555-0100')
    expect(brandSlotValue('website', BRAND)).toBe('acme.test')
  })

  it('returns an empty string for an unknown field, never undefined', () => {
    const value = brandSlotValue('nope' as never, BRAND)
    expect(value).toBe('')
  })
})

describe('designSlotOverrides', () => {
  it('reads the string entries of the map', () => {
    const layer = makeLayer({ textSlotOverrides: { business: 'Edited', offer: 'Also edited' } })
    expect(designSlotOverrides(layer)).toEqual({
      business: 'Edited',
      offer: 'Also edited',
    })
  })

  it('drops the non-string entries and survives a malformed field', () => {
    const layer = makeLayer({
      textSlotOverrides: { business: 'Edited', offer: 42 } as never,
    })
    expect(designSlotOverrides(layer)).toEqual({ business: 'Edited' })

    const broken = makeLayer({ textSlotOverrides: 'nope' as never })
    expect(designSlotOverrides(broken)).toEqual({})

    const array = makeLayer({ textSlotOverrides: ['a'] as never })
    expect(designSlotOverrides(array)).toEqual({})
  })
})

describe('isPrimaryDesignSlot / designSlotLabel', () => {
  it('treats only an explicit primary slot as the primary one', () => {
    expect(isPrimaryDesignSlot(SLOTS[0])).toBe(true)
    expect(isPrimaryDesignSlot(SLOTS[1])).toBe(false)
  })

  it('labels a slot with its own label, or a derived one', () => {
    expect(designSlotLabel(SLOTS[0])).toBe('Headline')
    expect(designSlotLabel(SLOTS[2])).toBe('Offer')
  })
})

describe('resolveDesignSlotValues', () => {
  it('gives the primary slot the layer text and the others their brand value', () => {
    const values = resolveDesignSlotValues(DESIGN, makeLayer({ text: 'Typed headline' }), BRAND)
    expect(values).toEqual({
      headline: 'Typed headline',
      business: 'Acme Roofing',
      offer: '10% off this week',
    })
  })

  it('prefers a stored override over the brand value for a secondary slot', () => {
    const values = resolveDesignSlotValues(
      DESIGN,
      makeLayer({ text: 'Typed headline', textSlotOverrides: { business: 'Edited name' } }),
      BRAND,
    )
    expect(values.business).toBe('Edited name')
    // The primary slot is never taken from the override map.
    expect(values.headline).toBe('Typed headline')
  })

  it('falls back to the brand value for an absent, blank or malformed override', () => {
    const absent = resolveDesignSlotValues(DESIGN, makeLayer(), BRAND)
    expect(absent.business).toBe('Acme Roofing')

    const blank = resolveDesignSlotValues(
      DESIGN,
      makeLayer({ textSlotOverrides: { business: '   ' } }),
      BRAND,
    )
    expect(blank.business).toBe('Acme Roofing')

    const malformed = resolveDesignSlotValues(
      DESIGN,
      makeLayer({ textSlotOverrides: { business: 42 } as never }),
      BRAND,
    )
    expect(malformed.business).toBe('Acme Roofing')
  })

  it('never resolves a slot to an empty value while the brand has one', () => {
    const values = resolveDesignSlotValues(
      DESIGN,
      makeLayer({ textSlotOverrides: { business: '', offer: '   ' } }),
      BRAND,
    )
    for (const key of Object.keys(values)) {
      expect(values[key].trim().length, key).toBeGreaterThan(0)
    }
  })

  it('blanks the primary slot when the customer typed an empty string', () => {
    const values = resolveDesignSlotValues(DESIGN, makeLayer({ text: '' }), BRAND)
    expect(values.headline).toBe('')
  })

  it('falls back to the brand value for the primary slot when the layer has no text', () => {
    const layer = makeLayer()
    delete (layer as { text?: string }).text
    const values = resolveDesignSlotValues(DESIGN, layer, BRAND)
    expect(values.headline).toBe('Roofs that last')
  })

  it('survives a design that declares no slots', () => {
    const values = resolveDesignSlotValues(
      { ...DESIGN, textSlots: [] },
      makeLayer(),
      BRAND,
    )
    expect(values).toEqual({})
  })
})
