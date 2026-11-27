// @vitest-environment jsdom
/**
 * A business that only has a NAME and the headline derived from it (no offer, call to action, phone or website) must still get a design that shows something.
 * The sweep found designs that drew nothing for such a business because their adapter falls back to a brand field the design
 * does not declare as a slot (`rve-animated-list`, `rve-subscribe-reminder`).
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { listRemotionDesignTemplates } from '../registry'
import '../catalog'
import { brandSlotValue, isPrimaryDesignSlot, resolveDesignSlotValues } from '../../preview/designSlots'
import type { RemotionDesignComponentProps } from '../types'

const stage = vi.hoisted(() => ({ frame: 60 }))
vi.mock('remotion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('remotion')>()
  return {
    ...actual,
    useCurrentFrame: () => stage.frame,
    useVideoConfig: () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 300 }),
  }
})

const BRAND = { businessName: 'Acme Roofing', headline: 'Acme Roofing', offer: '', cta: '', phone: '', website: '' }

/** Designs whose job is to show text; effects, transitions and charts are judged elsewhere. */
const TEXT_DESIGNS = (id: string, category: string, hasSlots: boolean) =>
  // brito-* play inside <Series> sequences, which this unit harness (one mocked global frame) cannot drive; the sweep covers them.
  hasSlots && ['animated-headline', 'lower-third', 'promo-cta'].includes(category) && !id.startsWith('scene-') && !id.startsWith('brito-')

describe('sparse brand (only a business name)', () => {
  const designs = listRemotionDesignTemplates().filter((d) => TEXT_DESIGNS(d.id, d.category, (d.textSlots ?? []).length > 0))

  it('covers the text designs', () => {
    expect(designs.length).toBeGreaterThan(20)
  })

  for (const design of designs) {
    it(`${design.id} shows text`, () => {
      const primary = (design.textSlots ?? []).find(isPrimaryDesignSlot)
      const layer = { id: 'l', kind: 'design', designId: design.id, text: primary ? brandSlotValue(primary.field, BRAND as never) : '' } as never
      const slots = resolveDesignSlotValues(design, layer, BRAND as never)
      const props: RemotionDesignComponentProps = {
        text: (layer as { text: string }).text,
        textSlots: slots,
        colors: { primary: '#29d3f2', accent: '#28c98b', text: '#ffffff', backgroundDim: 0.18 },
        media: { logo: null, product: null, service: null },
        box: { leftPx: 0, topPx: 0, widthPx: 1920, heightPx: 1080 },
        width: 1920, height: 1080, frame: 60, fps: 30, opacity: 1, color: '#ffffff',
        ...(design.defaultProps ?? {}),
      } as RemotionDesignComponentProps
      const Component = design.component
      const { container } = render(<Component {...props} />)
      expect((container.textContent ?? '').trim().length, `${design.id} drew no text for a name-only business`).toBeGreaterThan(0)
    })
  }
})
