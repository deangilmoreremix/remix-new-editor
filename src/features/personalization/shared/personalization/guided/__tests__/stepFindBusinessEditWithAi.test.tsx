// @vitest-environment jsdom
/**
 * The guided "Find business" step lets a signed-in user open the AI image
 * editor on each discovered asset, right where the assets are reviewed.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { DiscoveredAsset } from '../../types'

const ctx: Record<string, unknown> = {}

vi.mock('../../DemoPersonalizeProvider', () => ({
  useDemoPersonalize: () => ctx,
}))

import { StepFindBusiness } from '../StepFindBusiness'

function asset(overrides: Partial<DiscoveredAsset>): DiscoveredAsset {
  return {
    id: 'asset',
    previewUrl: 'https://joes-pizza.example/logo.png',
    sourceUrl: 'https://joes-pizza.example/logo.png',
    sourceType: 'WEBSITE',
    category: 'logo',
    selected: true,
    recommended: true,
    rejected: false,
    ...overrides,
  } as DiscoveredAsset
}

const ASSETS = [
  asset({ id: 'logo', category: 'logo' }),
  asset({ id: 'storefront', category: 'storefront', previewUrl: 'https://joes-pizza.example/storefront.jpg' }),
  asset({ id: 'blob', category: 'product', previewUrl: 'blob:https://app/123' }),
]

let root: Root | null = null
let container: HTMLDivElement | null = null

async function render(onEditAsset?: (asset: DiscoveredAsset) => void, overrides: Record<string, unknown> = {}) {
  Object.assign(ctx, {
    clientForm: { businessName: "Joe's Pizza", website: 'https://joes-pizza.example' },
    access: onEditAsset ? 'authenticated' : 'anonymous',
    discoveredAssets: ASSETS,
    discoveryStatus: 'idle',
    discoveryError: null,
    toggleDiscoveredAssetSelection: vi.fn(),
    importDiscoveredAssets: vi.fn(),
    saveClient: vi.fn(),
    setViewMode: vi.fn(),
    ...overrides,
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(<StepFindBusiness onEditAsset={onEditAsset} />)
  })
  return container
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('StepFindBusiness: Edit with AI', () => {
  it('offers Edit with AI on every editable discovered asset and opens the editor on that asset', async () => {
    const onEditAsset = vi.fn()
    const view = await render(onEditAsset)

    const buttons = Array.from(view.querySelectorAll('button')).filter((b) => b.textContent === 'Edit with AI')
    // The blob: preview cannot be sent to the editor, so it gets no button.
    // One per editable asset, in the grid's category order (logo, storefront).
    expect(buttons).toHaveLength(2)

    await act(async () => buttons[1].click())

    expect(onEditAsset).toHaveBeenCalledTimes(1)
    expect(onEditAsset.mock.calls[0][0].id).toBe('storefront')
  })

  it('offers no Edit with AI when no editor handler is given (anonymous session)', async () => {
    const view = await render(undefined)

    const buttons = Array.from(view.querySelectorAll('button')).filter((b) => b.textContent === 'Edit with AI')
    expect(buttons).toHaveLength(0)
    // Review and import still work without it.
    expect(view.textContent).toContain('Discovered assets')
  })
})

// The guided step uses the same grid as Advanced Editing.
describe('StepFindBusiness: full discovered-asset grid', () => {
  const many = Array.from({ length: 12 }, (_, i) =>
    asset({ id: `p${i}`, category: 'person', previewUrl: `https://joes-pizza.example/p${i}.jpg`, sourceUrl: `https://joes-pizza.example/p${i}.jpg` }),
  )

  it('shows every asset, not just the first eight', async () => {
    const view = await render(undefined, { discoveredAssets: many })

    expect(view.querySelectorAll('[aria-label^="View "]')).toHaveLength(12)
    expect(view.textContent).not.toContain('more — review all of them')
  })

  it('renders browser-phase assets that carry no sourceType', async () => {
    const browserAsset = { ...many[0], id: 'b1', sourceType: undefined } as unknown as DiscoveredAsset
    const view = await render(undefined, { discoveredAssets: [browserAsset] })

    expect(view.querySelectorAll('[aria-label^="View "]')).toHaveLength(1)
  })

  it('keeps "Restore all removed" reachable after every asset is removed', async () => {
    const setDiscoveredAssets = vi.fn()
    const allRemoved = many.slice(0, 2).map((a) => ({ ...a, rejected: true }))
    const view = await render(undefined, { clientForm: { website: 'https://joes-pizza.example' }, discoveredAssets: allRemoved, setDiscoveredAssets })

    const restore = Array.from(view.querySelectorAll('button')).find((b) => b.textContent === 'Restore all removed')
    expect(restore).toBeDefined()
    await act(async () => restore!.click())
    expect(setDiscoveredAssets).toHaveBeenCalledWith(allRemoved.map((a) => ({ ...a, rejected: false })))
  })

  it('removes an asset from the card', async () => {
    const rejectDiscoveredAsset = vi.fn()
    const view = await render(undefined, { discoveredAssets: many, rejectDiscoveredAsset })

    await act(async () => (view.querySelector('[aria-label="Remove"]') as HTMLButtonElement).click())

    expect(rejectDiscoveredAsset).toHaveBeenCalledWith('p0')
  })

  it('opens an asset full screen and steps through them with the arrows', async () => {
    const view = await render(undefined, { discoveredAssets: many })

    await act(async () => (view.querySelectorAll('[aria-label^="View "]')[2] as HTMLElement).click())
    const dialog = () => document.querySelector('[aria-label="Discovered asset viewer"]')
    expect(dialog()?.textContent).toContain('3 / 12')

    await act(async () => (document.querySelector('[aria-label="Next asset"]') as HTMLButtonElement).click())
    expect(dialog()?.textContent).toContain('4 / 12')

    await act(async () => (document.querySelector('[aria-label="Previous asset"]') as HTMLButtonElement).click())
    await act(async () => (document.querySelector('[aria-label="Previous asset"]') as HTMLButtonElement).click())
    expect(dialog()?.textContent).toContain('2 / 12')

    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })) })
    expect(dialog()?.textContent).toContain('3 / 12')

    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(dialog()).toBeNull()
  })

  it('imports an asset into the section it is dropped on', async () => {
    const importDiscoveredAssets = vi.fn(async () => {})
    const moveDiscoveredAssetToSection = vi.fn()
    const view = await render(undefined, { discoveredAssets: many, importDiscoveredAssets, moveDiscoveredAssetToSection })

    const store: Record<string, string> = {}
    const dataTransfer = {
      setData: (k: string, v: string) => { store[k] = v },
      getData: (k: string) => store[k] || '',
      effectAllowed: '',
      dropEffect: '',
    }
    const card = view.querySelectorAll('[aria-label^="View "]')[4] as HTMLElement
    const zone = view.querySelector('[data-drop-section="logo"]') as HTMLElement
    const fire = (el: HTMLElement, type: string) => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
      el.dispatchEvent(event)
    }
    await act(async () => {
      fire(card, 'dragstart')
      fire(zone, 'dragover')
      fire(zone, 'drop')
    })

    expect(moveDiscoveredAssetToSection).toHaveBeenCalledWith('p4', 'logo')
    expect(importDiscoveredAssets).toHaveBeenCalledWith({ ids: ['p4'], section: 'logo' })
  })
})

// "Find business assets" runs discovery from a typed website alone, so the
// client form has a website but no business name. The results panel used to
// be gated on the name, so the visitor saw nothing even when assets came back.
describe('StepFindBusiness: results for a website with no business name', () => {
  const websiteOnly = { clientForm: { website: 'https://joes-pizza.example' } }

  it('shows the discovered assets', async () => {
    const view = await render(undefined, websiteOnly)

    expect(view.textContent).toContain('What we found')
    expect(view.textContent).toContain('Discovered assets')
    expect(view.textContent).toContain('3 ready to review')
  })

  it('shows the progress badge while discovery runs', async () => {
    const view = await render(undefined, { ...websiteOnly, discoveredAssets: [], discoveryStatus: 'discovering' })

    expect(view.textContent).toContain('Finding assets…')
  })

  it('shows the error when discovery found nothing', async () => {
    const view = await render(undefined, {
      ...websiteOnly,
      discoveredAssets: [],
      discoveryError: 'No useful assets were found on that website.',
    })

    expect(view.querySelector('[role="alert"]')?.textContent).toBe('No useful assets were found on that website.')
  })
})
