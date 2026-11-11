// @vitest-environment jsdom
/**
 * Multi-slot editing in the overlay inspector.
 *
 * A registered Remotion design declares one editable text slot per piece of
 * text it renders (`RemotionDesignTemplate.textSlots`). The inspector must
 * expose EVERY declared slot — not only the primary one — and the value it
 * shows must be the value the composition would render.
 *
 * The storage contract these tests pin down:
 *  - the PRIMARY slot keeps using the layer's own `text`;
 *  - every other slot uses the layer's per-slot override map
 *    (`textSlotOverrides`, keyed by `RemotionDesignTextSlot.key`);
 *  - an absent, unknown or blank override falls back to the brand value.
 *
 * See `docs/phase2/INTERFACE-slots.md`.
 */

import { useState } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useDemoPersonalize } from '../../DemoPersonalizeProvider'
import {
  DESIGN_SLOT_OVERRIDES_FIELD,
  OverlayEditor,
  designSlotOverrides,
  resolveDesignSlotValues,
} from '../OverlayEditor'
import { createDefaultPreviewSettings, createLayer } from '../../preview/presets'
import { getRemotionDesignTemplate } from '../../templates'
import type { PreviewInputProps, PreviewLayer } from '../../preview/types'

vi.mock('../../DemoPersonalizeProvider', () => ({
  useDemoPersonalize: vi.fn(),
}))

// ── Fixtures ─────────────────────────────────────────────────────────────────

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

const INPUT_PROPS: PreviewInputProps = {
  videoUrl: null,
  posterUrl: null,
  isImageSource: false,
  audioUrl: null,
  settings: createDefaultPreviewSettings(),
  brand: BRAND,
}

/** A layer that carries the per-slot overrides the core lane adds. */
type LayerWithOverrides = PreviewLayer & {
  textSlotOverrides?: Record<string, string>
}

/** The overrides stored on a layer, read straight off the field. */
function storedOverrides(layer: PreviewLayer): Record<string, string> {
  const raw = (layer as LayerWithOverrides)[DESIGN_SLOT_OVERRIDES_FIELD]
  return raw ?? {}
}

/** The layers the harness currently holds (updated on every render). */
let currentLayers: PreviewLayer[] = []

/**
 * A stateful editor: `updatePreviewLayer` really updates the layers, so the
 * inspector re-renders with the new value exactly like it does in the app.
 */
function EditorHarness({ initialLayers }: { initialLayers: PreviewLayer[] }): React.JSX.Element {
  const [layers, setLayers] = useState<PreviewLayer[]>(initialLayers)
  currentLayers = layers
  const settings = { ...createDefaultPreviewSettings(), layers }
  const ctx = {
    previewSettings: settings,
    updatePreviewLayer: (layerId: string, patch: Partial<PreviewLayer>) => {
      setLayers((prev) =>
        prev.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer)),
      )
    },
    updatePreviewComposition: vi.fn(),
    resetPreviewLayout: vi.fn(),
    assets: {},
  }
  vi.mocked(useDemoPersonalize).mockImplementation(
    () => ctx as unknown as ReturnType<typeof useDemoPersonalize>,
  )
  return <OverlayEditor inputProps={{ ...INPUT_PROPS, settings }} />
}

function renderEditor(layers: PreviewLayer[]): void {
  currentLayers = layers
  render(<EditorHarness initialLayers={layers} />)
}

function textbox(name: string): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name }) as HTMLTextAreaElement
}

function designLayer(designId: string, overrides: Partial<PreviewLayer> = {}): PreviewLayer {
  return createLayer('design', { designId, ...overrides })
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 960,
  })
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      width: 960,
      height: 540,
      top: 0,
      left: 0,
      right: 960,
      bottom: 540,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect
  }
})

beforeEach(() => {
  vi.mocked(useDemoPersonalize).mockReset()
  currentLayers = []
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ── One field per declared slot ──────────────────────────────────────────────

describe('OverlayEditor design slots', () => {
  it('shows one editable field per declared slot', () => {
    const design = getRemotionDesignTemplate('lower-third')
    expect(design).toBeDefined()
    // The lower third declares a name (primary) and a title.
    expect(design?.textSlots?.map((slot) => slot.key)).toEqual(['businessName', 'offer'])

    renderEditor([designLayer('lower-third')])

    // Exactly two text fields: one per declared slot — and NOT the old
    // single "layer text" field.
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
    expect(screen.queryByRole('textbox', { name: 'Layer text' })).toBeNull()
    // Each field is labelled with the slot's own label.
    expect(textbox('Name')).toBeTruthy()
    expect(textbox('Title')).toBeTruthy()
    // The layer list says which design is applied.
    const layerRow = screen.getByRole('button', { name: 'Select Design' })
    expect(layerRow.textContent).toContain('Lower Third')
  })

  it('labels a slot with the label the design declares', () => {
    const design = getRemotionDesignTemplate('animated-headline')
    expect(design?.textSlots?.[0]?.label).toBe('Headline')
    renderEditor([designLayer('animated-headline')])
    expect(textbox('Headline')).toBeTruthy()
  })

  // ── Brand-derived defaults ────────────────────────────────────────────────

  it('shows the brand-derived values when the layer stores no overrides', () => {
    const design = getRemotionDesignTemplate('lower-third')
    renderEditor([designLayer('lower-third')])

    expect(textbox('Name').value).toBe('Acme Roofing')
    expect(textbox('Title').value).toBe('10% off this week')
    // Nothing was written to the layer.
    expect(currentLayers[0].text).toBeUndefined()
    expect(storedOverrides(currentLayers[0])).toEqual({})
    expect(designSlotOverrides(currentLayers[0])).toEqual({})
    // …and those are exactly the values the composition would render.
    expect(resolveDesignSlotValues(design!, currentLayers[0], BRAND)).toEqual({
      businessName: 'Acme Roofing',
      offer: '10% off this week',
    })
  })

  it('falls back to the brand value for an unknown or blank override', () => {
    const design = getRemotionDesignTemplate('lower-third')
    const layer: LayerWithOverrides = {
      ...designLayer('lower-third'),
      // A slot the design does not declare, a blank override and a value
      // that is not a string at all.
      textSlotOverrides: { ghost: 'Not a slot', offer: '   ', cta: 42 as unknown as string },
    }

    renderEditor([layer])

    // The unknown slot never gets a field, and the blank / malformed
    // overrides fall back to the brand value instead of rendering empty.
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
    expect(textbox('Title').value).toBe('10% off this week')
    expect(resolveDesignSlotValues(design!, currentLayers[0], BRAND)).toEqual({
      businessName: 'Acme Roofing',
      offer: '10% off this week',
    })
  })

  // ── Editing ───────────────────────────────────────────────────────────────

  it('editing a secondary slot updates the value the composition would use', () => {
    const design = getRemotionDesignTemplate('lower-third')
    renderEditor([designLayer('lower-third')])

    act(() => {
      fireEvent.change(textbox('Title'), { target: { value: 'Summer sale' } })
    })

    // The override is stored on the layer, keyed by the slot key.
    expect(storedOverrides(currentLayers[0])).toEqual({ offer: 'Summer sale' })
    // The primary slot is untouched.
    expect(currentLayers[0].text).toBeUndefined()
    // The composition would render the edited value.
    expect(resolveDesignSlotValues(design!, currentLayers[0], BRAND)).toEqual({
      businessName: 'Acme Roofing',
      offer: 'Summer sale',
    })
    // And the field keeps showing it.
    expect(textbox('Title').value).toBe('Summer sale')
  })

  it('editing the primary slot still writes the layer text', () => {
    const design = getRemotionDesignTemplate('lower-third')
    renderEditor([designLayer('lower-third')])

    act(() => {
      fireEvent.change(textbox('Name'), { target: { value: 'Acme Roofing Ltd' } })
    })

    // The primary slot keeps the legacy storage: the layer's own text.
    expect(currentLayers[0].text).toBe('Acme Roofing Ltd')
    expect(storedOverrides(currentLayers[0])).toEqual({})
    expect(resolveDesignSlotValues(design!, currentLayers[0], BRAND)).toEqual({
      businessName: 'Acme Roofing Ltd',
      offer: '10% off this week',
    })
  })

  it('clearing a secondary slot restores the brand value', () => {
    const design = getRemotionDesignTemplate('lower-third')
    renderEditor([designLayer('lower-third')])

    act(() => {
      fireEvent.change(textbox('Title'), { target: { value: 'Summer sale' } })
    })
    expect(storedOverrides(currentLayers[0])).toEqual({ offer: 'Summer sale' })

    act(() => {
      fireEvent.change(textbox('Title'), { target: { value: '' } })
    })

    // The override is dropped, so the slot falls back to the brand value
    // again instead of rendering an empty string.
    expect(storedOverrides(currentLayers[0])).toEqual({})
    expect(textbox('Title').value).toBe('10% off this week')
    expect(resolveDesignSlotValues(design!, currentLayers[0], BRAND).offer).toBe(
      '10% off this week',
    )
  })

  it('reads a stored override back from the layer, not from component state', () => {
    const design = getRemotionDesignTemplate('lower-third')
    const layer: LayerWithOverrides = {
      ...designLayer('lower-third'),
      textSlotOverrides: { offer: 'Summer sale' },
    }
    renderEditor([layer])

    expect(textbox('Title').value).toBe('Summer sale')
    expect(resolveDesignSlotValues(design!, currentLayers[0], BRAND).offer).toBe('Summer sale')
  })

  // ── The plain layers are unchanged ────────────────────────────────────────

  it('still shows a single text field for a plain text layer', () => {
    renderEditor([createLayer('headline', { text: 'Roofs that last' })])

    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(textbox('Layer text').value).toBe('Roofs that last')

    act(() => {
      fireEvent.change(textbox('Layer text'), { target: { value: 'Roofs that last longer' } })
    })
    expect(currentLayers[0].text).toBe('Roofs that last longer')
  })

  it('still shows a single text field for a design that is not registered', () => {
    renderEditor([designLayer('not-registered')])

    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(textbox('Layer text')).toBeTruthy()
    expect(
      screen.getByText('This design is not registered, so it will not render.'),
    ).toBeTruthy()
  })
})
