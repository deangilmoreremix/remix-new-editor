// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-function-type -- test harness shared with sharedDiscovery.test.tsx */
/**
 * Advanced Editing → Full Body Recast tab, inside the real modal + provider.
 * Harness (mocks, style shim, fetch routing) mirrors sharedDiscovery.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { screen, fireEvent, within } from '@testing-library/react'
import { DemoPersonalizeProvider, useDemoPersonalize } from '../../DemoPersonalizeProvider'

// The PersonalizationModal is intentionally NOT rendered by this file's trees:
// `DemoPersonalizeProvider` renders it (only while open), and mounting a second
// copy from here would start the modal closed and break its hook order.

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
})

vi.mock('next/navigation', () => ({
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

const muapi = vi.hoisted(() => ({
  uploadFile: vi.fn(),
  processMotionControl: vi.fn(),
  resumeGeneration: vi.fn(),
}))
vi.mock('@ohb/packages/studio/src/muapi', () => muapi)
vi.mock('@ohb/packages/studio/src/muapi', () => muapi)
// The browser reads clip length from <video> metadata; jsdom cannot.
vi.mock('../../recast/recastJob', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../recast/recastJob')>()),
  readVideoDuration: vi.fn(async () => 6.2),
}))
vi.mock('../../assetUploadService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../assetUploadService')>()),
  uploadPersonalizationAsset: vi.fn(async () => ({ url: 'https://storage.example.com/take.mp4' })),
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

const PERSON = 'https://cdn.example.com/ana.png'
const RESULT = 'https://cdn.example.com/recast.mp4'

async function openRecastTab() {
  const container = await mountModal({ access: 'authenticated', source: { ...VIDEO_SOURCE, sourceMedia: null } })
  await act(async () => { ctx().addIdentityUrl(PERSON) })
  await act(async () => { fireEvent.click(screen.getByTestId('pz-tab-recast')) })
  return container
}

async function uploadClip(container: HTMLElement) {
  const input = container.querySelector('[data-testid="pz-recast-file"]') as HTMLInputElement
  const file = new File(['x'], 'take.mp4', { type: 'video/mp4' })
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }) })
  await flush(30)
}

describe('Full Body Recast tab', () => {
  it('shows the three panels and waits for a clip, a person and consent', async () => {
    muapi.processMotionControl.mockReset()
    const container = await openRecastTab()
    const panel = container.querySelector('#pz-tabpanel-recast') as HTMLElement
    // Each caption appears twice: the example result and the real panels.
    expect(within(panel).getAllByText('Source performance')).toHaveLength(2)
    expect(within(panel).getAllByText('Character image')).toHaveLength(2)
    expect(within(panel).getAllByText('Recast result')).toHaveLength(2)
    const run = screen.getByTestId('pz-recast-run') as HTMLButtonElement
    expect(run.disabled).toBe(true)
    expect(within(panel).getByText(/Choose a 4–30 s source clip/)).toBeTruthy()

    await uploadClip(container)
    expect(within(panel).getByText(/Confirm you have permission/)).toBeTruthy()
    expect(run.disabled).toBe(true)

    await act(async () => { fireEvent.click(within(panel).getByRole('checkbox')) })
    expect((screen.getByTestId('pz-recast-run') as HTMLButtonElement).disabled).toBe(false)
  })

  it('runs the recast, makes it the video, saves it, and can undo', async () => {
    muapi.processMotionControl.mockReset()
    muapi.processMotionControl.mockImplementation(async (_key: string, params: any) => {
      params.onRequestId('req-1')
      return { url: RESULT }
    })
    const container = await openRecastTab()
    await uploadClip(container)
    const panel = container.querySelector('#pz-tabpanel-recast') as HTMLElement
    await act(async () => { fireEvent.click(within(panel).getByRole('checkbox')) })
    await act(async () => { fireEvent.click(screen.getByTestId('pz-recast-run')) })
    await flush(40)

    expect(muapi.processMotionControl).toHaveBeenCalledWith('test-key', expect.objectContaining({
      model: 'seedance-2.5-motion-control',
      video_url: 'https://storage.example.com/take.mp4',
      images_list: [PERSON],
      aspect_ratio: 'adaptive',
      duration: 6,
      generate_audio: false,
    }))
    expect(ctx().previewVideo).toMatchObject({ url: RESULT, kind: 'recast' })
    expect(ctx().assets.presenterVideos?.map((a: any) => a.url)).toEqual([RESULT])
    expect(screen.getByTestId('pz-recast-result')).toBeTruthy()
    expect(screen.getByTestId('pz-recast-applied')).toBeTruthy()
    // The step bar marks the tab done once you move to another tab.
    await act(async () => { fireEvent.click(screen.getByTestId('pz-tab-client')) })
    expect(screen.getByTestId('pz-tab-recast').textContent).toContain('✓')
    await act(async () => { fireEvent.click(screen.getByTestId('pz-tab-recast')) })

    await act(async () => { fireEvent.click(screen.getByText('Use original video')) })
    expect(ctx().previewVideo).toBeNull()
    await act(async () => { fireEvent.click(screen.getByText('Use')) })
    expect(ctx().previewVideo).toMatchObject({ url: RESULT, kind: 'recast' })
  })

  it('shows the bundled example result, open until the client has a recast', async () => {
    const container = await openRecastTab()
    const example = container.querySelector('[data-testid="pz-recast-example"]') as HTMLDetailsElement
    expect(example.open).toBe(true)
    const result = container.querySelector('[data-testid="pz-recast-example-result"]') as HTMLVideoElement
    expect(result.getAttribute('src')).toBe('/media/recast-example/recast-result.mp4')
    expect(within(example).getByAltText('Example character').getAttribute('src')).toBe('/media/recast-example/character.jpg')
  })

  it('rejects a clip that is not MP4/MOV without uploading', async () => {
    const container = await openRecastTab()
    const input = container.querySelector('[data-testid="pz-recast-file"]') as HTMLInputElement
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(['x'], 'a.webm', { type: 'video/webm' })] } })
    })
    expect(screen.getByText('Use an MP4 or MOV clip.')).toBeTruthy()
  })
})
