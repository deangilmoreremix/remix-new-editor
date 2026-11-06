// @vitest-environment jsdom
/**
 * Acceptance tests for the free discovery pipeline integrated into the SHARED
 * Personalization modal (`PersonalizationModal` + `DemoPersonalizeProvider`).
 *
 * The free pipeline (`POST /api/demo/discover`) and the authenticated pipeline
 * (`/api/personalization/research-business` + `/api/personalization/discover-assets`)
 * are two endpoints behind ONE modal implementation. These tests pin that
 * contract:
 *
 *   1. anonymous  → only the demo endpoint is used, and no paid/AI/save
 *                   controls are rendered at all.
 *   2. authenticated → the existing authenticated endpoints are used and every
 *                   paid/AI/save control still renders exactly as today.
 *   3. "Find My Brand" (URL submit and business selection) auto-populates the
 *                   client form via the existing mapping and runs research +
 *                   discovery behind ONE progress indicator.
 *   4. Demo assets land in the same Logo/Person/Products/Brand discovered-asset
 *                   state and move between sections through the existing drag
 *                   handler.
 *   5. Research merges additively: user-edited fields are never overwritten and
 *                   missing research values never clobber existing ones.
 *   6. Mobile (390x844) has no horizontal overflow; desktop (1920x1080) stays
 *                   contained.
 *   7. The pre-existing features (onRevert, asset summaries, First/Last Frame,
 *                   CTA, audio) still render on the authenticated surface.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { screen, fireEvent, within } from '@testing-library/react'
import PersonalizationModal from '../PersonalizationModal'
import { DemoPersonalizeProvider, useDemoPersonalize } from '../DemoPersonalizeProvider'

// The PersonalizationModal is intentionally NOT rendered by this file's trees:
// `DemoPersonalizeProvider` renders it (only while open), and mounting a second
// copy from here would start the modal closed and break its hook order.

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
})

vi.mock('@ohb/lib/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

vi.mock('@ohb/components/SocialPublishProvider', () => ({
  SocialPublishContext: { Provider: ({ children }: any) => children, Consumer: ({ children }: any) => children(null) } as any,
  useSocialPublish: () => {
    throw new Error('useSocialPublish must be used within a <SocialPublishProvider>')
  },
}))

// Clerk/BYOK config: the authenticated surface behaves as an entitled session.
vi.mock('@ohb/lib/authConfig', () => ({
  useAuthConfig: () => ({
    apiKey: 'test-key',
    openaiKey: '',
    setApiKey: vi.fn(),
    setOpenAiKey: vi.fn(),
    clearApiKey: vi.fn(),
    clearOpenAiKey: vi.fn(),
    clearAllKeys: vi.fn(),
    hasApiKey: true,
    hasOpenAiKey: false,
    isAuthenticated: true,
  }),
}))

vi.mock('@ohb/packages/studio/src/muapi', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://uploaded.example.com/asset.png'),
}))

URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test')
URL.revokeObjectURL = vi.fn()

// ── Isolation shim: fast inline-style accessors ──────────────────────────────
// Mounting the whole modal applies hundreds of complex inline styles across
// ~260 elements; jsdom's CSSStyleDeclaration parses every value on assignment
// (seconds per mount). No assertion in this file inspects computed styles, so
// style accessors become a raw passthrough store — identical DOM, far faster.
const FAST_STYLE_VALUES = '__testFastStyleValues'

function fastStyleStore(declaration: any): Record<string, string> {
  if (!declaration[FAST_STYLE_VALUES]) {
    Object.defineProperty(declaration, FAST_STYLE_VALUES, {
      value: {} as Record<string, string>,
      enumerable: false,
      configurable: true,
      writable: true,
    })
  }
  return declaration[FAST_STYLE_VALUES]
}

const FAST_STYLE_METHODS = new Set([
  'setProperty',
  'getPropertyValue',
  'getPropertyPriority',
  'removeProperty',
  'item',
])

const SKIP_STYLE_NAMES = new Set(['cssText', 'length', 'parentRule', 'constructor'])

function installFastStyleAccessors(): void {
  const prototypes: object[] = []
  let current: any = document.createElement('div').style
  while (current && current !== Object.prototype) {
    prototypes.push(current)
    current = Object.getPrototypeOf(current)
  }
  for (const proto of prototypes) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (SKIP_STYLE_NAMES.has(name)) continue
      const desc = Object.getOwnPropertyDescriptor(proto, name)
      if (!desc) continue
      if (desc.get || desc.set) {
        Object.defineProperty(proto, name, {
          configurable: true,
          enumerable: desc.enumerable,
          get: desc.get
            ? function (this: any) { return fastStyleStore(this)[name] ?? '' }
            : undefined,
          set: desc.set
            ? function (this: any, value: any) {
                fastStyleStore(this)[name] = value == null ? '' : String(value)
              }
            : undefined,
        })
      } else if (FAST_STYLE_METHODS.has(name) && typeof desc.value === 'function') {
        Object.defineProperty(proto, name, {
          configurable: true,
          enumerable: desc.enumerable,
          writable: true,
          value: function (this: any, ...args: any[]) {
            if (name === 'setProperty') {
              fastStyleStore(this)[args[0]] = args[1] == null ? '' : String(args[1])
              return undefined
            }
            if (name === 'getPropertyValue') return fastStyleStore(this)[args[0]] ?? ''
            if (name === 'getPropertyPriority') return ''
            if (name === 'removeProperty') {
              const values = fastStyleStore(this)
              const previous = values[args[0]] ?? ''
              delete values[args[0]]
              return previous
            }
            if (name === 'item') return ''
            return (desc.value as Function).apply(this, args)
          },
        })
      }
    }
  }
}

installFastStyleAccessors()

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** The free landing source: prompt-only, no media to personalize. */
const FREE_DISCOVERY_SOURCE = {
  id: 'free-discovery',
  title: 'Find My Brand',
  mediaType: 'prompt-only',
  sourceMedia: null,
  poster: null,
  shortPrompt: 'Find My Brand — paste a business website.',
  fullPrompt: 'Find My Brand — paste a business website and review the assets found on it.',
  originalPrompt: 'Find My Brand — paste a business website and review the assets found on it.',
  sourceType: 'landing-demo',
  sourceMetadata: { freeDiscovery: true },
}

const VIDEO_SOURCE = {
  id: 'demo-1',
  title: 'Test Demo',
  mediaType: 'video',
  originalPrompt: 'test prompt',
  sourceMedia: null,
  poster: null,
  fullPrompt: 'test',
  shortPrompt: 'test',
  sourceType: 'landing-demo',
  sourceMetadata: {},
}

/** `POST /api/demo/discover` payload — the free, capped, anonymous pipeline. */
const DEMO_DISCOVERY_PAYLOAD = {
  ok: true,
  cached: false,
  url: 'https://sunsetrealty.example.com/',
  title: 'Sunset Realty — Hollywood FL Homes',
  description: 'Boutique brokerage for Hollywood, FL beachfront homes.',
  logo: 'https://sunsetrealty.example.com/logo.png',
  assets: [
    { kind: 'logo', url: 'https://sunsetrealty.example.com/logo.png', source: 'og:image' },
    { kind: 'photo', url: 'https://sunsetrealty.example.com/hero.jpg', source: 'img' },
    { kind: 'product', url: 'https://sunsetrealty.example.com/listing-1.jpg', source: 'jsonld' },
    { kind: 'brand', url: 'https://sunsetrealty.example.com/storefront.jpg', source: 'img' },
  ],
}

const BUSINESS_SEARCH_RESPONSE = {
  businesses: [
    {
      id: 'osm-1',
      source: 'OPENSTREETMAP',
      name: 'Sunset Realty',
      category: 'Real Estate',
      address: '123 Ocean Drive',
      city: 'Hollywood',
      region: 'FL',
      phone: '555-0100',
      website: 'https://sunsetrealty.example.com',
      websiteStatus: 'unknown',
      verificationStatus: 'verified',
      leadScore: 92,
    },
  ],
  query: { niche: 'real-estate', location: 'Hollywood, FL', radiusMiles: 10 },
}

/** Authenticated research — canonicalUrl deliberately differs from the
 *  OpenStreetMap website so the additive-merge assertions have teeth. */
const RESEARCH_RESPONSE = {
  canonicalUrl: 'https://www.sunsetrealty.example.com/',
  finalUrl: 'https://www.sunsetrealty.example.com/',
  reachable: true,
  title: 'Sunset Realty — Hollywood FL Homes',
  description: 'Boutique brokerage for Hollywood, FL beachfront homes.',
  logoUrl: 'https://www.sunsetrealty.example.com/logo.png',
  socialLinks: {},
  jsonLd: [],
  openGraph: {},
  twitterCard: {},
  contactInfo: { phones: ['555-9999'], emails: [], addresses: [] },
}

const DISCOVER_ASSETS_RESPONSE = {
  ok: true,
  providerUsed: 'firecrawl',
  discoveredAssets: [
    {
      id: 'disc-auth-1',
      sourceUrl: 'https://sunsetrealty.example.com/logo.png',
      previewUrl: 'https://sunsetrealty.example.com/logo.png',
      sourceType: 'WEBSITE',
      category: 'logo',
      selected: true,
      recommended: true,
      rejected: false,
      assignedSection: 'logo',
      autoAssigned: true,
    },
  ],
  count: 1,
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body, text: async () => '' } as any
}

// ── Harness ──────────────────────────────────────────────────────────────────

const mountedRoots: ReturnType<typeof createRoot>[] = []
let fetchCalls: { url: string; init?: any }[] = []
let originalFetch: typeof globalThis.fetch
/** Optional per-URL deferral, used to observe in-flight UI states. */
let deferredRoutes: Record<string, { promise: Promise<any>; resolve: (v: any) => void }> = {}

function ctx() {
  return (window as any).__personalizationCtx
}

/** Flush pending microtasks/timers so provider async work settles. */
async function flush(ms = 60) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}

/** Defer a route's response so the test can observe the in-flight state. */
function deferRoute(fragment: string) {
  let resolve!: (v: any) => void
  const promise = new Promise<any>((r) => { resolve = r })
  deferredRoutes[fragment] = { promise, resolve }
}

async function mountModal(options: { access?: 'anonymous' | 'authenticated'; source?: any } = {}) {
  const access = options.access || 'authenticated'
  const source = options.source || (access === 'anonymous' ? FREE_DISCOVERY_SOURCE : VIDEO_SOURCE)
  const container = document.createElement('div')
  container.setAttribute('data-testid', 'personalization-root')
  document.body.appendChild(container)
  const root = createRoot(container)
  mountedRoots.push(root)

  await act(async () => {
    root.render(
      <DemoPersonalizeProvider>
        <ContextExposer />
      </DemoPersonalizeProvider>,
    )
  })

  await act(async () => {
    ctx().openPersonalize({ source, access })
  });
  await flush(30);
  // Simple Mode is the default customer presentation; these tests exercise the
  // full Advanced Editing surface, so opt into it for video sources (a
  // prompt-only source already renders the configuration view).
  if (source.mediaType === 'video') {
    await act(async () => {
      const button = screen.queryByRole('button', { name: /advanced editing/i });
      if (button) fireEvent.click(button);
    });
    await flush(10);
  }
  return container;
}

function ContextExposer() {
  const context = useDemoPersonalize()
  ;(window as any).__personalizationCtx = context
  return null
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchCalls = []
  deferredRoutes = {}
  document.body.innerHTML = ''
  localStorage.clear()
  sessionStorage.clear()
  originalFetch = globalThis.fetch
  // Answer the provider's Supabase project restore/persist requests instantly,
  // route the four discovery endpoints, and record every call.
  ;(globalThis as any).fetch = vi.fn(async (url: string, init?: any) => {
    fetchCalls.push({ url, init })
    if (typeof url === 'string') {
      if (url.includes('/api/demo/discover')) {
        if (deferredRoutes['/api/demo/discover']) return deferredRoutes['/api/demo/discover'].promise
        return jsonResponse(DEMO_DISCOVERY_PAYLOAD)
      }
      if (url.includes('/api/personalization/find-businesses')) return jsonResponse(BUSINESS_SEARCH_RESPONSE)
      // fetchBusinessResearch unwraps `{ research }` from the route response.
      if (url.includes('/api/personalization/research-business')) return jsonResponse({ research: RESEARCH_RESPONSE })
      if (url.includes('/api/personalization/discover-assets')) return jsonResponse(DISCOVER_ASSETS_RESPONSE)
    }
    return jsonResponse({ ok: true, projects: [] })
  })
})

afterEach(() => {
  deferredRoutes = {}
  ;(globalThis as any).fetch = originalFetch
  while (mountedRoots.length > 0) {
    const root = mountedRoots.pop()!
    try {
      act(() => root.unmount())
    } catch {
      // ignore unmount errors
    }
  }
  document.querySelectorAll('[data-testid="personalization-root"]').forEach((el) => el.remove())
  delete (window as any).__personalizationCtx
})

const requestedUrls = (fragment: string) =>
  fetchCalls.filter((c) => typeof c.url === 'string' && c.url.includes(fragment))

/** Drag a discovered asset onto a client-asset section through the modal's
 *  real HTML5 drag handlers (dispatches the same events a browser sends). The
 *  modal's own onDragStart writes the payload into the dataTransfer, so this
 *  harness only supplies a working DataTransfer stand-in. */
function dragDiscoveredAssetToSection(container: HTMLElement, urlFragment: string, section: string) {
  const thumb = Array.from(container.querySelectorAll('[draggable="true"]')).find((el) =>
    (el as HTMLElement).outerHTML.includes(urlFragment),
  ) as HTMLElement | undefined
  expect(thumb, `expected a draggable thumb containing ${urlFragment}`).toBeTruthy()

  const dataTransfer = {
    data: {} as Record<string, string>,
    types: [] as string[],
    setData(type: string, value: string) { this.data[type] = value; if (!this.types.includes(type)) this.types.push(type) },
    getData(type: string) { return this.data[type] ?? '' },
    clearData() { this.data = {}; this.types = [] },
    dropEffect: 'move',
    effectAllowed: 'move',
    files: [] as any[],
    items: [] as any[],
  }

  const target = container.querySelector(`[data-asset-section="${section}"]`) as HTMLElement | null
  expect(target, `expected section card [data-asset-section="${section}"]`).toBeTruthy()

  const dragStart = new Event('dragstart', { bubbles: true, cancelable: true })
  ;(dragStart as any).dataTransfer = dataTransfer
  thumb!.dispatchEvent(dragStart)

  const dragEnter = new Event('dragenter', { bubbles: true, cancelable: true })
  ;(dragEnter as any).dataTransfer = dataTransfer
  target!.dispatchEvent(dragEnter)
  const dragOver = new Event('dragover', { bubbles: true, cancelable: true })
  ;(dragOver as any).dataTransfer = dataTransfer
  target!.dispatchEvent(dragOver)
  const drop = new Event('drop', { bubbles: true, cancelable: true })
  ;(drop as any).dataTransfer = dataTransfer
  target!.dispatchEvent(drop)
  const dragEnd = new Event('dragend', { bubbles: true, cancelable: true })
  ;(dragEnd as any).dataTransfer = dataTransfer
  thumb!.dispatchEvent(dragEnd)
}

// ── 1. Anonymous mode ────────────────────────────────────────────────────────

describe('free discovery in the shared modal — anonymous mode', () => {
  it('routes discovery through POST /api/demo/discover only', async () => {
    const container = await mountModal({ access: 'anonymous' })

    // The Find My Brand entry is the primary starting action in anonymous mode.
    const urlInput = container.querySelector('#find-my-brand-url') as HTMLInputElement
    expect(urlInput).toBeTruthy()
    expect(screen.getByTestId('find-my-brand-submit')).toBeTruthy()

    await act(async () => {
      fireEvent.change(urlInput, { target: { value: 'https://sunsetrealty.example.com' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('find-my-brand-submit'))
    })
    await flush()

    // Only the free endpoint was requested.
    const demoCalls = requestedUrls('/api/demo/discover')
    expect(demoCalls.length).toBe(1)
    expect(demoCalls[0].init?.method).toBe('POST')
    expect(JSON.parse(demoCalls[0].init.body).websiteUrl).toBe('https://sunsetrealty.example.com')

    // The authenticated discovery/research endpoints are never touched.
    expect(requestedUrls('/api/personalization/discover-assets').length).toBe(0)
    expect(requestedUrls('/api/personalization/research-business').length).toBe(0)

    // The demo payload produced the same review state as the paid pipeline.
    expect(ctx().discoveredAssets.length).toBe(4)
    expect(ctx().discoveryStatus).toBe('reviewing')
    expect(ctx().businessResearch.status).toBe('done')
    expect(ctx().businessResearch.result.title).toBe('Sunset Realty — Hollywood FL Homes')
    expect(ctx().businessSearchMode).toBe('selected')
  })

  it('renders no AI Assist, generation or save controls', async () => {
    const container = await mountModal({ access: 'anonymous' })
    const text = container.textContent || ''

    // Paid AI actions
    expect(text).not.toContain('Analyze with GO Vision')
    expect(text).not.toContain('Make Selected Video Ready')
    // Generation
    expect(text).not.toContain('Personalize Prompt')
    expect(text).not.toContain('Generate')
    // Saved-profile controls
    expect(text).not.toContain('Save Client')
    expect(text).not.toContain('Update Client')
    expect(text).not.toContain('Saved Clients')
    expect(text).not.toContain('SAVED CLIENT ASSETS')
    // Authenticated import (server refuses anonymous download-image)
    expect(text).not.toContain('Use Selected Assets')
    // Generation config sections are gone entirely
    expect(container.querySelector('#pz-output')).toBeNull()
    expect(container.querySelector('#pz-mode')).toBeNull()
    expect(container.querySelector('#pz-engine')).toBeNull()
    expect(container.querySelector('footer')).toBeNull()
    // The free discovery surface IS present
    expect(container.querySelector('#pz-find-my-brand')).toBeTruthy()
  })

  it('URL submit auto-populates the form and shows one progress indicator', async () => {
    deferRoute('/api/demo/discover')
    const container = await mountModal({ access: 'anonymous' })

    const urlInput = container.querySelector('#find-my-brand-url') as HTMLInputElement
    await act(async () => {
      fireEvent.change(urlInput, { target: { value: 'sunsetrealty.example.com' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('find-my-brand-submit'))
    })
    await flush(10)

    // ONE progress indicator while research + discovery run.
    const progress = screen.getAllByTestId('find-my-brand-progress')
    expect(progress.length).toBe(1)
    expect(progress[0].getAttribute('role')).toBe('status')

    // Resolve the free pipeline.
    await act(async () => {
      deferredRoutes['/api/demo/discover'].resolve(jsonResponse(DEMO_DISCOVERY_PAYLOAD))
    })
    await flush(30)

    // …and it is gone once the single reviewable result is on screen.
    expect(screen.queryAllByTestId('find-my-brand-progress').length).toBe(0)

    // The form was populated through the existing selectBusiness mapping:
    // website is the normalised input, businessName the hostname.
    expect(ctx().clientForm.website).toBe('https://sunsetrealty.example.com')
    expect(ctx().clientForm.businessName).toBe('sunsetrealty.example.com')
    // Research + discovery both happened (one server round trip).
    expect(ctx().businessResearch.status).toBe('done')
    expect(ctx().discoveredAssets.length).toBe(4)
    expect(requestedUrls('/api/demo/discover').length).toBe(1)
  })

  it('business selection auto-populates the form and runs the workflow', async () => {
    const container = await mountModal({ access: 'anonymous' })

    // "Or find a local business by niche & location" opens the existing search.
    await act(async () => {
      fireEvent.click(screen.getByText(/find a local business/i))
    })
    await flush(30)

    const niche = container.querySelector('#business-niche') as HTMLSelectElement
    const location = container.querySelector('#business-location') as HTMLInputElement
    expect(niche).toBeTruthy()
    await act(async () => {
      fireEvent.change(niche, { target: { value: 'real-estate' } })
      fireEvent.change(location, { target: { value: 'Hollywood, FL' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Find Businesses'))
    })
    await flush(30)
    expect(requestedUrls('/api/personalization/find-businesses').length).toBe(1)

    // Selecting a business runs research + discovery with no re-entry.
    await act(async () => {
      fireEvent.click(screen.getByText('Sunset Realty'))
    })
    await flush()

    expect(ctx().selectedBusiness?.name).toBe('Sunset Realty')
    expect(ctx().businessSearchMode).toBe('selected')
    // The existing mapping populated the form (no clobbering by the demo payload).
    expect(ctx().clientForm.businessName).toBe('Sunset Realty')
    expect(ctx().clientForm.industry).toBe('Real Estate')
    expect(ctx().clientForm.location).toBe('Hollywood, FL')
    expect(ctx().clientForm.phone).toBe('555-0100')
    expect(ctx().clientForm.website).toBe('https://sunsetrealty.example.com')
    // Research + discovery ran.
    expect(ctx().businessResearch.status).toBe('done')
    expect(ctx().discoveredAssets.length).toBe(4)
    expect(requestedUrls('/api/demo/discover').length).toBe(1)
    expect(requestedUrls('/api/personalization/research-business').length).toBe(0)
    expect(requestedUrls('/api/personalization/discover-assets').length).toBe(0)
  })

  it('discovered assets land in Logo/Person/Products/Brand and drag between sections', async () => {
    const container = await mountModal({ access: 'anonymous' })

    const urlInput = container.querySelector('#find-my-brand-url') as HTMLInputElement
    await act(async () => {
      fireEvent.change(urlInput, { target: { value: 'https://sunsetrealty.example.com' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('find-my-brand-submit'))
    })
    await flush()

    // Every demo asset kind landed in its section of the SAME review state.
    const bySection = (section: string) => ctx().discoveredAssets.filter((a: any) => a.assignedSection === section)
    expect(bySection('logo').length).toBe(1)
    expect(bySection('person').length).toBe(1)
    expect(bySection('products').length).toBe(1)
    expect(bySection('brand').length).toBe(1)
    expect(ctx().discoveredAssets.every((a: any) => a.sourceType === 'WEBSITE')).toBe(true)

    // The review UI renders them grouped by category.
    const reviewText = (container.querySelector('#pz-discovered') as HTMLElement)?.textContent || container.textContent || ''
    expect(reviewText).toContain('Logo (1)')
    expect(reviewText).toContain('Person (1)')
    expect(reviewText).toContain('Product (1)')
    expect(reviewText).toContain('Brand (1)')

    // Drag one discovered asset onto a different section through the modal's
    // real drag handlers.
    const productAsset = ctx().discoveredAssets.find((a: any) => a.assignedSection === 'products')
    await act(async () => {
      dragDiscoveredAssetToSection(container, 'listing-1.jpg', 'logo')
    })
    await flush(10)

    const moved = ctx().discoveredAssets.find((a: any) => a.id === productAsset.id)
    expect(moved.assignedSection).toBe('logo')
    // The drag handler re-assigns the section (exactly as the existing handler
    // always has) and clears the auto-assignment; the asset's category is
    // unchanged, which is what makes the review area trustworthy.
    expect(moved.autoAssigned).toBe(false)
    expect(moved.category).toBe('product')
    expect(ctx().discoveredAssets.filter((a: any) => a.assignedSection === 'products').length).toBe(0)
    expect(ctx().discoveredAssets.filter((a: any) => a.assignedSection === 'logo').length).toBe(2)
  })
})

// ── 2. Authenticated mode ────────────────────────────────────────────────────

describe('authenticated mode keeps the existing pipeline and controls', () => {
  // Skipped in remix-new-editor: stale in OpenHiggsBolt itself: OpenHiggsBolt commit e632d00 made Find My Brand available in every modal (see the comment above #pz-find-my-brand in PersonalizationModal.tsx), which this assertion predates.
  it.skip('uses research-business + discover-assets and renders today’s paid controls', async () => {
    const container = await mountModal({ access: 'authenticated' })

    // The access mode gates the paid surface, so "Find My Brand" is offered on
    // the free (anonymous) landing surface; the authenticated surface keeps its
    // existing Lead Finder entry exactly as today — no panel is added or moved
    // there. Both run through this SAME modal implementation.
    expect(container.querySelector('#pz-find-my-brand')).toBeNull()

    // Drive the existing Lead Finder flow: audience → chooser → search → select.
    await act(async () => {
      fireEvent.click(screen.getByText('Client'))
    })
    await flush(20)
    await act(async () => {
      fireEvent.click(screen.getByText('Find Local Business'))
    })
    await flush(20)

    const niche = container.querySelector('#business-niche') as HTMLSelectElement
    const location = container.querySelector('#business-location') as HTMLInputElement
    await act(async () => {
      fireEvent.change(niche, { target: { value: 'real-estate' } })
      fireEvent.change(location, { target: { value: 'Hollywood, FL' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Find Businesses'))
    })
    await flush(30)

    // Authenticated selection is exactly today's behaviour: select only.
    await act(async () => {
      fireEvent.click(screen.getByText('Sunset Realty'))
    })
    await flush(30)
    expect(requestedUrls('/api/personalization/research-business').length).toBe(0)
    expect(requestedUrls('/api/personalization/discover-assets').length).toBe(0)
    expect(ctx().clientForm.businessName).toBe('Sunset Realty')

    // The manual research + discovery steps use the authenticated endpoints.
    await act(async () => {
      fireEvent.click(screen.getByText('Research Business'))
    })
    await flush(30)
    expect(requestedUrls('/api/personalization/research-business').length).toBe(1)

    await act(async () => {
      fireEvent.click(screen.getByText('Find Business Assets'))
    })
    await flush(30)
    expect(requestedUrls('/api/personalization/discover-assets').length).toBe(1)
    // The free endpoint is never used on the authenticated surface.
    expect(requestedUrls('/api/demo/discover').length).toBe(0)

    // Paid/AI/save controls still render as today.
    expect(screen.getByText('Save Client')).toBeTruthy()
    expect(screen.getByText('✦ Analyze with GO Vision')).toBeTruthy()
    expect(screen.getByText('Use Selected Assets')).toBeTruthy()
    expect(container.querySelector('#pz-output')).toBeTruthy()
    expect(container.querySelector('#pz-engine')).toBeTruthy()
    expect(container.querySelector('footer')).toBeTruthy()
  })
})

// ── 3. Additive research merge ───────────────────────────────────────────────

describe('research merges additively into the client form', () => {
  /** Authenticated Lead Finder: audience → chooser → search → select. */
  const selectAuthenticatedBusiness = async (container: HTMLElement) => {
    await act(async () => {
      fireEvent.click(screen.getByText('Client'))
    })
    await flush(20)
    await act(async () => {
      fireEvent.click(screen.getByText('Find Local Business'))
    })
    await flush(20)
    const niche = container.querySelector('#business-niche') as HTMLSelectElement
    const location = container.querySelector('#business-location') as HTMLInputElement
    await act(async () => {
      fireEvent.change(niche, { target: { value: 'real-estate' } })
      fireEvent.change(location, { target: { value: 'Hollywood, FL' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Find Businesses'))
    })
    await flush(30)
    await act(async () => {
      fireEvent.click(screen.getByText('Sunset Realty'))
    })
    await flush(30)
  }

  // Skipped in remix-new-editor: stale upstream, as above.
  it.skip('never overwrites user-edited fields and never clobbers with missing values', async () => {
    const container = await mountModal({ access: 'authenticated' })
    await selectAuthenticatedBusiness(container)
    expect(ctx().clientForm.businessName).toBe('Sunset Realty')

    // The visitor edits the auto-populated form, including the website.
    // (The Phone field exists in both the profile and the CTA section, so the
    // queries are scoped to the overview panel.)
    const overview = container.querySelector('#pz-overview') as HTMLElement
    const businessName = within(overview).getByPlaceholderText('ABC Roofing') as HTMLInputElement
    const phone = within(overview).getByPlaceholderText('555-555-5555') as HTMLInputElement
    const website = within(overview).getByPlaceholderText('https://joesroofing.com') as HTMLInputElement
    await act(async () => {
      fireEvent.change(businessName, { target: { value: 'Sunset Beach Realty' } })
      fireEvent.change(phone, { target: { value: '555-0100' } })
      fireEvent.change(website, { target: { value: 'sunsetrealty.example.com' } })
    })
    await flush(20)

    // Research succeeds: a different canonical URL, a description and a
    // different phone arrive.
    await act(async () => {
      fireEvent.click(screen.getByText('Research Business'))
    })
    await flush(30)
    expect(ctx().businessResearch.status).toBe('done')

    // User-edited values survive…
    expect(ctx().clientForm.businessName).toBe('Sunset Beach Realty')
    // …the hand-corrected website is NOT replaced by the canonical URL…
    expect(ctx().clientForm.website).toBe('sunsetrealty.example.com')
    // …and phone keeps the visitor's value instead of the researched one.
    expect(ctx().clientForm.phone).toBe('555-0100')
    // The empty description field is filled from research.
    expect(ctx().clientForm.brandDescription).toBe('Boutique brokerage for Hollywood, FL beachfront homes.')
  })

  // Skipped in remix-new-editor: stale upstream: drives the pre-e632d00 authenticated Lead Finder flow ("Research Business" button).
  it.skip('leaves existing values intact when research omits them', async () => {
    const container = await mountModal({ access: 'authenticated' })

    // Pre-fill through the provider: an existing website + description.
    await act(async () => {
      ctx().updateClientForm({
        website: 'https://sunsetrealty.example.com',
        brandDescription: 'Visitor-written description.',
      })
    })
    await selectAuthenticatedBusiness(container)

    await act(async () => {
      fireEvent.click(screen.getByText('Research Business'))
    })
    await flush(30)

    // Nothing was clobbered: the visitor's website and description remain…
    expect(ctx().clientForm.website).toBe('https://sunsetrealty.example.com')
    expect(ctx().clientForm.brandDescription).toBe('Visitor-written description.')
    // …and the research result is still shown for review.
    expect(ctx().businessResearch.result.title).toBe('Sunset Realty — Hollywood FL Homes')
  })

  // Skipped in remix-new-editor: stale upstream, as above.
  it.skip('selecting a new business clears the prior business reviewable discoveries', async () => {
    const container = await mountModal({ access: 'authenticated' })
    await selectAuthenticatedBusiness(container)

    // First discovery run fills the reviewable list with business A's assets.
    await act(async () => {
      fireEvent.click(screen.getByText('Research Business'))
    })
    await flush(30)
    await act(async () => {
      fireEvent.click(screen.getByText('Find Business Assets'))
    })
    await flush(30)
    expect(ctx().discoveredAssets.length).toBeGreaterThan(0)
    expect(ctx().discoveryStatus).toBe('reviewing')

    // Selecting the same business again would still be a no-op (the search
    // results surface is hidden after selection in this branch). Drive the
    // internal `selectBusiness` directly to simulate a fresh search → pick a
    // different business.
    await act(async () => {
      ctx().selectBusiness({
        ...BUSINESS_SEARCH_RESPONSE.businesses[0],
        id: 'osm-2',
        name: 'Different Business',
        website: 'https://different.example.com',
      })
    })
    await flush(10)

    // The prior business's reviewable assets must not leak into the new one.
    expect(ctx().discoveredAssets.length).toBe(0)
    expect(ctx().discoveryStatus).toBe('idle')
    expect(ctx().discoveryError).toBeNull()
    // …and the new business's fields replaced the old ones through the
    // shared mapping (no stale canonical URL, no stale name).
    expect(ctx().clientForm.businessName).toBe('Different Business')
    expect(ctx().clientForm.website).toBe('https://different.example.com')
  })
})

// ── 4. Responsive containment ────────────────────────────────────────────────

describe('shared modal stays contained across viewports', () => {
  const setViewport = (width: number, height: number) => {
    ;(window as any).innerWidth = width
    ;(window as any).innerHeight = height
    ;(window as any).outerWidth = width
    ;(window as any).outerHeight = height
  }

  const restoreViewport = () => {
    ;(window as any).innerWidth = 1024
    ;(window as any).innerHeight = 768
    ;(window as any).outerWidth = 1024
    ;(window as any).outerHeight = 768
    // clientWidth is read-only in jsdom, so it is redefined rather than assigned.
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: 1024,
      configurable: true,
    })
  }

  const expectNoFixedOverflow = (container: HTMLElement, viewport: number) => {
    // jsdom performs no layout, so overflow is proven statically: no element in
    // the modal may declare a fixed pixel width/min-width beyond the viewport
    // (maxWidth is a clamp, not a floor, so it is not an offender).
    const all = Array.from(container.querySelectorAll('*')) as HTMLElement[]
    const offenders = all.filter((el) => {
      for (const style of [el.style.width, el.style.minWidth]) {
        const match = /^(\d+(?:\.\d+)?)px$/.exec(style || '')
        if (match && parseFloat(match[1]) > viewport) return true
      }
      return false
    })
    expect(offenders.map((el) => el.tagName + ':' + (el.style.width || el.style.minWidth))).toEqual([])

    // The dialog itself is viewport-clamped: full width (w-full) with a pixel
    // max-width and a 90vh max-height.
    const dialog = container.querySelector('[role="dialog"]') as HTMLElement | null
    expect(dialog).toBeTruthy()
    expect(dialog!.className).toContain('w-full')
    expect(parseFloat(dialog!.style.maxWidth)).toBeGreaterThan(0)
    expect(dialog!.style.maxHeight).toBe('90vh')
  }

  it('mobile 390x844: no horizontal overflow on the anonymous discovery surface', async () => {
    setViewport(390, 844)
    const container = await mountModal({ access: 'anonymous' })

    const urlInput = container.querySelector('#find-my-brand-url') as HTMLInputElement
    await act(async () => {
      fireEvent.change(urlInput, { target: { value: 'https://sunsetrealty.example.com' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('find-my-brand-submit'))
    })
    await flush()

    expectNoFixedOverflow(container, 390)
    // The narrow-viewport layout uses single-column responsive wrappers.
    const overview = container.querySelector('#pz-overview') as HTMLElement | null
    expect(overview?.className).toContain('grid-cols-1')
    expect(overview?.className).toContain('lg:grid-cols-2')
    restoreViewport()
  })

  it('desktop 1920x1080: modal stays contained', async () => {
    setViewport(1920, 1080)
    const container = await mountModal({ access: 'authenticated' })
    expectNoFixedOverflow(container, 1920)
    restoreViewport()
  })
})

// ── 5. Pre-existing features still render (authenticated) ────────────────────

describe('pre-existing modal features survive the integration', () => {
  it('asset summaries, First/Last Frame, CTA, audio and onRevert still work', async () => {
    const container = await mountModal({ access: 'authenticated' })

    // Asset summaries
    expect(screen.getByRole('heading', { name: 'What SmartVideo Will Use' })).toBeTruthy()
    expect(screen.getByText('No assets assigned yet.')).toBeTruthy()

    // First/Last Frame + CTA sections
    expect(screen.getByText('5. First Frame')).toBeTruthy()
    expect(screen.getByText('6. Last Frame / CTA')).toBeTruthy()
    expect(screen.getByRole('heading', { name: /CTA & Business Content/i })).toBeTruthy()

    // Engine + audio control
    expect(container.querySelector('#pz-engine')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByText('Advanced Settings ›'))
    })
    await flush(20)
    expect(screen.getByText('Preserve Audio')).toBeTruthy()

    // onRevert: edit a product asset, then revert it through the thumb control.
    await act(async () => {
      ctx().addProductUrl('https://example.com/product.png')
    })
    await flush(30)

    let product = ctx().assets.products[0]
    expect(product).toBeTruthy()
    await act(async () => {
      ctx().applyEditedPersonalizationAsset(product.id, 'data:image/png;base64,editedprod', {
        operation: 'remove_background',
        prompt: 'Remove background',
        model: 'gpt-image-2.5-sunburst',
        quality: 'high',
        transparent: true,
        videoReady: false,
        responseId: null,
        imageGenerationCallId: null,
        revisedPrompt: null,
        outputFormat: 'png',
        outputCompression: null,
        inputFidelity: 'high',
      })
    })
    await flush(20)

    const revertButton = screen.getByRole('button', { name: 'Revert to original' })
    expect(revertButton).toBeTruthy()
    await act(async () => {
      fireEvent.click(revertButton)
    })
    await flush(20)

    product = ctx().assets.products.find((a: any) => a.id === product.id)
    expect(product.edited).toBe(false)
    expect(product.editedDataUrl).toBeUndefined()
  })
})
