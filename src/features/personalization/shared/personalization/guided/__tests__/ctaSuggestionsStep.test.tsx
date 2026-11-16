// @vitest-environment jsdom
/** Step 3 offers call-to-action lines built only from real contact details. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { PREVIEW_LAYOUTS } from '../../preview/presets'

const ctx: Record<string, unknown> = {}
vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: () => ctx }))

vi.mock('../PersonalizationTemplateBrowser', () => ({ PersonalizationTemplateBrowser: () => null }))
vi.mock('../AssetUsagePanel', () => ({ AssetUsagePanel: () => null }))

import { StepPersonalize } from '../StepPersonalize'

let root: Root | null = null
let container: HTMLDivElement | null = null

async function render(overrides: Record<string, unknown>) {
  const layout = PREVIEW_LAYOUTS[0]
  Object.keys(ctx).forEach((k) => delete ctx[k])
  Object.assign(ctx, {
    clientForm: {},
    selectedBusiness: null,
    updateClientForm: vi.fn(),
    assets: { logos: [], products: [], primaryLogo: null },
    previewSettings: { layout: layout.id, layers: [], brandColors: { primary: '#000', accent: '#111', text: '#fff', backgroundDim: 0 } },
    setPreviewLayout: vi.fn(),
    setRemotionDesign: vi.fn(),
    updatePreviewLayer: vi.fn(),
    updatePreviewBrandColors: vi.fn(),
    updatePreviewComposition: vi.fn(),
    ...overrides,
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root!.render(<StepPersonalize />))
  return container
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('Step 3 call-to-action suggestions', () => {
  it('shows nothing when the business has no contact details', async () => {
    const view = await render({})
    expect(view.querySelector('[data-testid="pz-cta-suggestions"]')).toBeNull()
  })

  it('builds chips from the selected business and fills the CTA on click', async () => {
    const view = await render({
      clientForm: { phone: '(813) 555-0100' },
      selectedBusiness: { website: 'https://joes.com', email: 'hi@joes.com', instagram: 'https://instagram.com/joes_pizza', openingHours: 'Mo-Sa 09:00-17:00' },
    })
    const chips = view.querySelectorAll('[data-testid^="pz-cta-suggestion-"]')
    expect(Array.from(chips).map((c) => c.textContent)).toEqual([
      'Call (813) 555-0100', 'Visit joes.com', 'Email hi@joes.com', 'Follow @joes_pizza', 'Open Mon–Sat 9 am–5 pm',
    ])
    await act(async () => (view.querySelector('[data-testid="pz-cta-suggestion-visit"]') as HTMLButtonElement).click())
    expect(ctx.updateClientForm).toHaveBeenCalledWith(expect.objectContaining({ callToAction: 'Visit joes.com' }))
  })

  it('prefers the email and Instagram found on the business website (profile) over the listing', async () => {
    const view = await render({
      clientForm: { email: 'found@joes.com', instagram: 'https://instagram.com/found_joes' },
      selectedBusiness: { email: 'listing@joes.com', instagram: 'https://instagram.com/listing_joes' },
    })
    const texts = Array.from(view.querySelectorAll('[data-testid^="pz-cta-suggestion-"]')).map((c) => c.textContent)
    expect(texts).toEqual(['Email found@joes.com', 'Follow @found_joes'])
  })

  it('offers the site-published rating as the tagline, and nothing without one', async () => {
    const without = await render({})
    expect(without.querySelector('[data-testid="pz-rating-chip"]')).toBeNull()
    act(() => root?.unmount()); container?.remove()
    const view = await render({ foundSignals: { rating: { value: 4.76, count: 120, best: 5, sourceUrl: 'https://joes.com/' } } })
    const chip = view.querySelector('[data-testid="pz-rating-chip"]') as HTMLButtonElement
    expect(chip.textContent).toContain('4.8 ★ · 120 reviews')
    await act(async () => chip.click())
    expect(ctx.updateClientForm).toHaveBeenCalledWith(expect.objectContaining({ brandDescription: '4.8 ★ · 120 reviews' }))
  })
})
