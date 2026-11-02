// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, act, configure, waitFor } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import PersonalizationModal from '../PersonalizationModal';
import { DemoPersonalizeProvider, useDemoPersonalize } from '../DemoPersonalizeProvider';

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
  uploadFile: vi.fn(),
}))

URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test')
URL.revokeObjectURL = vi.fn()

// Testing Library's default text-query filter runs a nwsapi `matches()` call for
// every DOM node of every query, and the modal's DOM contains no <script> or
// <style> nodes to ignore anyway. A falsy `ignore` short-circuits that filter
// node-side, so every assertion stays identical while the ~65 text queries in
// this file stop paying nwsapi per node (~0.8s of this file's runtime).
configure({ defaultIgnore: '' })

// ── Isolation shims ──────────────────────────────────────────────────────────
// Two things made opening the real PersonalizationModal slow enough to blow
// the 5000ms default vitest timeout in this environment:
//
// 1. Network I/O on open. The provider fires a project-restore GET
//    (`loadProject` in supabaseProjectPersistence) and, one debounce interval
//    later, a project-persist POST whenever the modal opens. Against a
//    sandboxed/blackholed network those requests stall for seconds and the
//    open `act` — and with it the whole test — never completes.
// 2. jsdom CSS parsing. Mounting the modal applies hundreds of complex inline
//    styles (radial/linear gradients, multi-layer box-shadows,
//    backdrop-filter) across ~260 elements. jsdom's CSSStyleDeclaration parses
//    every one of those values on assignment (~7-16ms per element here), so a
//    single modal mount costs seconds on a loaded machine.
//
// No assertion in this file inspects network responses or computed styles, so
// both bottlenecks are removed without weakening any assertion: fetch is
// answered instantly, and style accessors become a raw passthrough.

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
  'removeProperty',
  'getPropertyPriority',
  'item',
])

const SKIP_STYLE_NAMES = new Set(['cssText', 'length', 'parentRule', 'constructor'])

function installFastStyleAccessors(): void {
  // Walk the prototype chain of a real style declaration rather than the
  // global CSSStyleDeclaration binding: jsdom keeps the property accessors on
  // an internal CSSStyleProperties prototype that the global does not expose.
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
          writable: desc.writable,
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

/**
 * Deterministic wait for an async UI state to settle.
 *
 * Replaces the previous fixed `setTimeout(r, 50–100)` sleeps before assertions
 * on an async-settled DOM. A fixed sleep is a race: under host load the
 * settled state can land AFTER the sleep expires, so an otherwise-correct
 * feature fails its assertion — which is exactly the flake recorded as
 * Phase 3 item 9 for this file's business-research retry test. The helper
 * polls inside `act` until the element appears or a bounded deadline passes,
 * so every assertion keeps its original form and the wait is only as long as
 * the state actually needs (typically a single 10 ms tick).
 *
 * The query receives the SAME text/role arguments the assertion uses, so the
 * wait and the assertion can never drift apart.
 */
async function waitForElement(
  query: () => HTMLElement | null,
  description: string,
  timeoutMs = 5000,
): Promise<HTMLElement> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const found = query()
    if (found) return found
    if (Date.now() > deadline) {
      throw new Error(`waitForElement: "${description}" never appeared within ${timeoutMs}ms`)
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
  }
}

function TestOpener({ source, onMounted }: { source: any; onMounted: (open: (opts: any) => void) => void }) {
  const { openPersonalize, isOpen } = useDemoPersonalize();
  onMounted(openPersonalize);
  // Simple Mode is the default customer presentation of the modal. These tests
  // exercise the full Advanced Editing surface, so opt into it whenever the
  // modal opens — the underlying provider state is shared by both views.
  useEffect(() => {
    if (!isOpen) return;
    const button = screen.queryByRole('button', { name: /advanced editing/i });
    if (button) button.click();
  }, [isOpen]);
  return null;
}

function ContextExposer() {
  const ctx = useDemoPersonalize()
  ;(window as any).__personalizationCtx = ctx
  // See TestOpener: Simple Mode is the default customer presentation, so these
  // Advanced Editing tests opt into it whenever the modal opens.
  const isOpen = ctx.isOpen
  useEffect(() => {
    if (!isOpen) return;
    const button = screen.queryByRole('button', { name: /advanced editing/i });
    if (button) button.click();
  }, [isOpen]);
  return null
}

// Every test mounts its own DemoPersonalizeProvider. The roots are tracked so
// afterEach can unmount them: unmounting cancels the provider's debounced
// Supabase project persistence, while a root that is merely detached from the
// document keeps its 1500ms persist timer alive — that timer then fires during
// a later test and its fetch lands in the current test's fetch mock.
const mountedRoots: ReturnType<typeof createRoot>[] = []

function mountPersonalizationRoot() {
  const container = document.createElement('div');
  container.setAttribute('data-testid', 'personalization-root')
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push(root)
  return { root, container };
}

describe('PersonalizationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Answer the provider's project restore/persist requests instantly so
    // opening the modal never waits on real network I/O (see the isolation
    // shim note at the top of this file).
    (globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, projects: [] }),
      text: async () => '',
    }));
  });

  afterEach(() => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop()!
      act(() => root.unmount())
    }
    document.querySelectorAll('[data-testid="personalization-root"]').forEach((el) => el.remove())
    delete (window as any).__personalizationCtx
  })

  // Mounting the whole modal is ~0.5-1s of jsdom work on an idle machine, and
  // this body then runs ~65 text queries over the modal's ~260 DOM nodes. The
  // 5s default holds when the file runs alone but not when sibling test files
  // run in parallel on a loaded machine, so give it headroom.
  it('renders six visible client asset cards without tab navigation', async () => {
    const { root, container } = mountPersonalizationRoot();

    let openPersonalize: ((opts: any) => void) | null = null;

    await act(async () => {
      root.render(
        <DemoPersonalizeProvider>
          <TestOpener
            source={{ id: 'demo-1', title: 'Test Demo', mediaType: 'video', originalPrompt: 'test', sourceMedia: null, poster: null, fullPrompt: 'test', shortPrompt: 'test', sourceType: 'landing-demo', sourceMetadata: {} }}
            onMounted={(open) => {
              openPersonalize = open;
            }}
          />
        </DemoPersonalizeProvider>,
      );
    });

    await act(async () => {
      openPersonalize?.({ source: { id: 'demo-1', title: 'Test Demo', mediaType: 'video', originalPrompt: 'test prompt', sourceMedia: null, poster: null, fullPrompt: 'test', shortPrompt: 'test', sourceType: 'landing-demo', sourceMetadata: {} } });
    });

    const cardTitles = [
      '1. Person / Presenter',
      '2. Logo',
      '3. Products / Services',
      '4. Brand References',
      '5. First Frame',
      '6. Last Frame / CTA',
    ];

    cardTitles.forEach((title) => {
      expect(screen.getByText(title)).toBeTruthy();
    });

    // Verify the full-width design sections are present.
    // Scoped to headings: the sticky section nav also renders short link
    // labels (e.g. "Client Assets"), so unscoped text queries would be
    // ambiguous.
    expect(screen.getByRole('heading', { name: 'Source Demo' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /CLIENT ASSETS/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /CTA & Business Content/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Personalize The Prompt/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /SmartVideo Engine/i })).toBeTruthy();

    // Verify SmartVideo Recommended is prominently visible (check container text)
    expect(container.textContent).toMatch(/SmartVideo/)
    expect(container.textContent).toMatch(/Recommended/)

    // Verify prompt section has Original and Personalized headings
    expect(screen.getByText('Original Prompt')).toBeTruthy();
    expect(screen.getByText('Personalized Prompt')).toBeTruthy();

    // Verify large visual upload zones are present
    expect(screen.getByText('Add Photos')).toBeTruthy();
    expect(screen.getByText('Upload Logo')).toBeTruthy();

    // Verify preview/placeholder content shows for all six cards
    // Person card shows FACE/BODY/SIDE placeholders
    expect(container.textContent).toMatch(/FACE/)
    expect(container.textContent).toMatch(/BODY/)
    expect(container.textContent).toMatch(/SIDE/)
    // Products card shows 1/2/3 placeholders
    expect(container.textContent).toMatch(/1/)
    expect(container.textContent).toMatch(/2/)
    expect(container.textContent).toMatch(/3/)
    // Brand References shows STORE/TEAM/VEHICLE
    expect(container.textContent).toMatch(/STORE/)
    expect(container.textContent).toMatch(/TEAM/)
    expect(container.textContent).toMatch(/VEHICLE/)
    // Frames show "First Frame" and CTA preview
    expect(container.textContent).toMatch(/First Frame/)
    expect(container.textContent).toMatch(/Last Frame\/CTA/)

    // Verify no primary tab navigation exists
    const tabButtons = container.querySelectorAll('button');
    const tabLabels = [...tabButtons].map((b) => b.textContent?.trim()).filter(Boolean);
    expect(tabLabels).not.toContain('Person');
    expect(tabLabels).not.toContain('Logo');
    expect(tabLabels).not.toContain('Products');
    expect(tabLabels).not.toContain('Brand');
    expect(tabLabels).not.toContain('Frames');
    expect(tabLabels).not.toContain('CTA');

    // Verify Website field exists exactly once and Find Business Assets button is present
    const websiteLabels = screen.getAllByText('Website')
    expect(websiteLabels.length).toBe(1)
    const findButtons = screen.getAllByText('Find Business Assets')
    expect(findButtons.length).toBeGreaterThanOrEqual(1)
    expect(container.textContent).toMatch(/Optional — use your website to find business assets automatically/)

    // Verify Website appears before Business Name in DOM order
    const websiteLabel = websiteLabels[0]
    const businessNameLabel = screen.getByText('Business Name')
    const allLabels = Array.from(container.querySelectorAll('label'))
    expect(allLabels.indexOf(websiteLabel as any)).toBeLessThan(allLabels.indexOf(businessNameLabel as any))
  }, 30_000);

  it('renders the niche-specific CTA heading when source.sourceMetadata.nicheId is set', async () => {
    const { root, container } = mountPersonalizationRoot();

    let openPersonalize: ((opts: any) => void) | null = null;

    await act(async () => {
      root.render(
        <DemoPersonalizeProvider>
          <TestOpener
            source={{ id: 'demo-niche', title: 'Niche Demo', mediaType: 'video', originalPrompt: 'p', sourceMedia: null, poster: null, fullPrompt: 'p', shortPrompt: 'p', sourceType: 'landing-demo', sourceMetadata: { nicheId: 'ecommerce' } }}
            onMounted={(open) => { openPersonalize = open; }}
          />
        </DemoPersonalizeProvider>,
      );
    });

    await act(async () => {
      openPersonalize?.({
        source: {
          id: 'demo-niche',
          title: 'Niche Demo',
          mediaType: 'video',
          originalPrompt: 'p',
          sourceMedia: null,
          poster: null,
          fullPrompt: 'p',
          shortPrompt: 'p',
          sourceType: 'landing-demo',
          sourceMetadata: { nicheId: 'ecommerce' },
        },
      });
    });

    // Niche-aware heading + body come from NICHE_CTA_BY_ID.ecommerce.
    expect(
      screen.getByText('Personalize This AI Product Video Demo'),
    ).toBeTruthy();
    expect(container.textContent || '').toMatch(/AI ecommerce product video demo/);
  });

  it('falls back to the generic header when no nicheId is present', async () => {
    const { root, container } = mountPersonalizationRoot();

    let openPersonalize: ((opts: any) => void) | null = null;

    await act(async () => {
      root.render(
        <DemoPersonalizeProvider>
          <TestOpener
            source={{ id: 'demo-generic', title: 'Generic Demo', mediaType: 'video', originalPrompt: 'p', sourceMedia: null, poster: null, fullPrompt: 'p', shortPrompt: 'p', sourceType: 'landing-demo', sourceMetadata: {} }}
            onMounted={(open) => { openPersonalize = open; }}
          />
        </DemoPersonalizeProvider>,
      );
    });

    await act(async () => {
      openPersonalize?.({
        source: {
          id: 'demo-generic',
          title: 'Generic Demo',
          mediaType: 'video',
          originalPrompt: 'p',
          sourceMedia: null,
          poster: null,
          fullPrompt: 'p',
          shortPrompt: 'p',
          sourceType: 'landing-demo',
          sourceMetadata: {},
        },
      });
    });

    // No niche → generic title from the modal default.
    const genericMatches = screen.getAllByText(/Personalize this demo/i);
    expect(genericMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('shows manual website input when selected business has no website', async () => {
    const { root, container } = mountPersonalizationRoot();

    await act(async () => {
      root.render(
        <DemoPersonalizeProvider>
          <ContextExposer />
        </DemoPersonalizeProvider>,
      );
    });

    await act(async () => {
      ;(window as any).__personalizationCtx.openPersonalize({
        source: { id: 'demo-1', title: 'Test Demo', mediaType: 'video', originalPrompt: 'test', sourceMedia: null, poster: null, fullPrompt: 'test', shortPrompt: 'test', sourceType: 'landing-demo', sourceMetadata: { audience: 'customer' } },
      });
    });

    await act(async () => {
      ;(window as any).__personalizationCtx.updateClientForm({ audience: 'customer' })
      ;(window as any).__personalizationCtx.selectBusiness({
        id: 'osm-no-web',
        source: 'OPENSTREETMAP',
        name: 'No Website Biz',
        category: 'Restaurant',
        city: 'Tampa',
        region: 'FL',
        phone: '555-0000',
        website: undefined,
        websiteStatus: 'unknown',
        verificationStatus: 'unverified',
        leadScore: 50,
      })
    });

    expect(screen.getByPlaceholderText('https://corrected-website.com')).toBeTruthy()
    expect(screen.getAllByText('Website').length).toBeGreaterThanOrEqual(1)
  });

  it('keeps retry button visible when business research fails', async () => {
    const { root, container } = mountPersonalizationRoot();

    await act(async () => {
      root.render(
        <DemoPersonalizeProvider>
          <ContextExposer />
        </DemoPersonalizeProvider>,
      );
    });

    await act(async () => {
      ;(window as any).__personalizationCtx.openPersonalize({
        source: { id: 'demo-1', title: 'Test Demo', mediaType: 'video', originalPrompt: 'test', sourceMedia: null, poster: null, fullPrompt: 'test', shortPrompt: 'test', sourceType: 'landing-demo', sourceMetadata: { audience: 'customer' } },
      });
    });

    await act(async () => {
      ;(window as any).__personalizationCtx.updateClientForm({ audience: 'customer' })
      ;(window as any).__personalizationCtx.selectBusiness({
        id: 'osm-fail',
        source: 'OPENSTREETMAP',
        name: 'Fail Biz',
        category: 'Plumbing',
        city: 'Miami',
        region: 'FL',
        phone: '555-1111',
        website: undefined,
        websiteStatus: 'unknown',
        verificationStatus: 'unverified',
        leadScore: 50,
      })
      ;(window as any).__personalizationCtx.updateClientForm({ website: 'https://fail-biz.example.com' })
    })

    await act(async () => {
      ;(globalThis as any).fetch = vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      } as Response))
      ;(window as any).__personalizationCtx.researchBusiness()
    })

    await waitForElement(
      () => screen.queryByText('Research failed: Server error'),
      'Research failed: Server error',
    )

    expect(screen.getByText('Research failed: Server error')).toBeTruthy()
    expect(screen.getByText('Retry')).toBeTruthy()
    expect(screen.getByPlaceholderText('https://corrected-website.com')).toBeTruthy()
  })

  it('renders retry button on ThumbUploaded assets with uploadStatus error', async () => {
    const { root, container } = mountPersonalizationRoot();

    const { uploadFile } = await import('@ohb/packages/studio/src/muapi')
    ;(uploadFile as any).mockRejectedValueOnce(new Error('Network error'))

    await act(async () => {
      root.render(
        <DemoPersonalizeProvider>
          <ContextExposer />
        </DemoPersonalizeProvider>,
      );
    });

    await act(async () => {
      ;(window as any).__personalizationCtx.openPersonalize({
        source: { id: 'demo-1', title: 'Test Demo', mediaType: 'video', originalPrompt: 'test', sourceMedia: null, poster: null, fullPrompt: 'test', shortPrompt: 'test', sourceType: 'landing-demo', sourceMetadata: { audience: 'customer' } },
      });
    });

    await act(async () => {
      ;(window as any).__personalizationCtx.updateClientForm({ audience: 'customer' })
    })

    function createFile(name: string, type = 'image/png'): File {
      return new File([name], name, { type })
    }

    function createFileList(files: File[]): FileList {
      const list: Record<number, File> = {}
      files.forEach((file, i) => {
        list[i] = file
      })
      return {
        length: files.length,
        item: (i: number) => list[i] ?? null,
        ...list,
      } as unknown as FileList
    }

    await act(async () => {
      const files = createFileList([createFile('logo.png')])
      ;(window as any).__personalizationCtx.addLogoFiles(files)
    })

    // Wait for the retry affordance to render rather than racing a fixed
    // wall-clock delay. The modal's runtime path is slow when local env
    // files are present, and a 50ms sleep made this assertion flaky.
    await waitFor(() => {
      expect(screen.getAllByText('Retry').length).toBeGreaterThanOrEqual(1)
    })
  })
  // ── Find Local Business (lead finder) entry flow ──────────────────────────

  /** Sets a React-controlled input/select the way a real user event would. */
  function setNativeValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
    const prototype = element instanceof HTMLSelectElement
      ? window.HTMLSelectElement.prototype
      : window.HTMLInputElement.prototype
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')!
    descriptor.set!.call(element, value)
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  }

  async function renderModalWithCustomerAudience() {
    const { root } = mountPersonalizationRoot();

    await act(async () => {
      root.render(
        <DemoPersonalizeProvider>
          <ContextExposer />
        </DemoPersonalizeProvider>,
      );
    });

    await act(async () => {
      ;(window as any).__personalizationCtx.openPersonalize({
        source: { id: 'demo-1', title: 'Test Demo', mediaType: 'video', originalPrompt: 'test', sourceMedia: null, poster: null, fullPrompt: 'test', shortPrompt: 'test', sourceType: 'landing-demo', sourceMetadata: { audience: 'customer' } },
      });
    });

    // Separate act on purpose: the provider's reset-on-source-change effect runs
    // when openPersonalize replaces `source` and clears `clientForm`, so patching
    // the audience in the same act would be wiped before it ever rendered.
    await act(async () => {
      ;(window as any).__personalizationCtx.updateClientForm({ audience: 'customer' })
    })
  }

  it('hides the client-entry chooser until the Client audience is selected', async () => {
    await renderModalWithCustomerAudience()

    // Client audience selected → chooser with both paths is visible.
    expect(screen.getByText('How would you like to add this client?')).toBeTruthy()
    expect(screen.getByText('Find Local Business')).toBeTruthy()
    expect(screen.getByText('Enter Business Manually')).toBeTruthy()
    // Search form is not shown until "Find Local Business" is clicked.
    expect(screen.queryByText('Business Type / Niche')).toBeNull()
  })

  it('opens the search form when Find Local Business is clicked', async () => {
    await renderModalWithCustomerAudience()

    await act(async () => {
      screen.getByText('Find Local Business').closest('button')!.click()
    })

    expect(screen.getByText('Business Type / Niche')).toBeTruthy()
    expect(screen.queryByText('How would you like to add this client?')).toBeNull()
  })

  it('renders human-readable niche labels, not raw keys', async () => {
    await renderModalWithCustomerAudience()

    await act(async () => {
      screen.getByText('Find Local Business').closest('button')!.click()
    })

    const select = document.getElementById('business-niche') as HTMLSelectElement
    expect(select).toBeTruthy()

    const options = Array.from(select.options).map((o) => ({ value: o.value, label: o.textContent }))
    // Values are the server niche keys…
    expect(options.map((o) => o.value)).toContain('real-estate')
    // …but the visible labels are human-readable, never raw keys.
    expect(options.map((o) => o.label)).toContain('Real Estate')
    expect(options.map((o) => o.label)).not.toContain('real-estate')
    for (const option of options.slice(1)) {
      expect(option.label).not.toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('Enter Business Manually dismisses the chooser and keeps the manual profile form usable', async () => {
    await renderModalWithCustomerAudience()

    await act(async () => {
      screen.getByText('Enter Business Manually').closest('button')!.click()
    })

    // Chooser is gone…
    expect(screen.queryByText('How would you like to add this client?')).toBeNull()
    // …the search form did NOT open…
    expect(screen.queryByText('Business Type / Niche')).toBeNull()
    // …and the manual Client Profile fields are still available.
    expect(screen.getByPlaceholderText('ABC Roofing')).toBeTruthy()
    expect(screen.getByText('Find Business Assets')).toBeTruthy()
  })

  it('re-shows the chooser when the business search is cancelled', async () => {
    await renderModalWithCustomerAudience()

    await act(async () => {
      screen.getByText('Find Local Business').closest('button')!.click()
    })
    expect(screen.getByText('Business Type / Niche')).toBeTruthy()

    // "Cancel" is ambiguous in the full modal (the footer and the asset
    // discovery panel each render one), so target the button next to
    // "Find Businesses" inside the search form.
    const searchFormCancel = () => {
      const findButton = screen.getByText('Find Businesses').closest('button')!
      const cancel = Array.from(findButton.parentElement!.querySelectorAll('button'))
        .find((b) => b.textContent?.trim() === 'Cancel')
      expect(cancel).toBeTruthy()
      return cancel!
    }

    await act(async () => {
      searchFormCancel().click()
    })

    expect(screen.getByText('How would you like to add this client?')).toBeTruthy()
    expect(screen.queryByText('Business Type / Niche')).toBeNull()
  })

  it('blocks the search until niche and location are entered and then calls the API', async () => {
    await renderModalWithCustomerAudience()

    await act(async () => {
      screen.getByText('Find Local Business').closest('button')!.click()
    })

    // Find Businesses is disabled with an empty form.
    const findBtn = () => screen.getByText('Find Businesses').closest('button') as HTMLButtonElement
    expect(findBtn().disabled).toBe(true)

    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        query: { niche: 'Real Estate', location: 'Tampa, FL', radiusMiles: 15 },
        count: 1,
        businesses: [{
          id: 'osm-1',
          source: 'OPENSTREETMAP',
          name: 'Sunset Realty',
          category: 'Real Estate',
          city: 'Tampa',
          region: 'FL',
          phone: '555-1234',
          websiteStatus: 'unknown',
          verificationStatus: 'unverified',
          leadScore: 80,
        }],
      }),
    } as Response))
    ;(globalThis as any).fetch = fetchMock

    await act(async () => {
      const select = document.getElementById('business-niche') as HTMLSelectElement
      const location = document.getElementById('business-location') as HTMLInputElement
      setNativeValue(select, 'real-estate')
      setNativeValue(location, 'Tampa, FL')
    })

    expect(findBtn().disabled).toBe(false)

    await act(async () => {
      findBtn().click()
    })

    // Scope the call count to the business-search endpoint: the provider also
    // fires its own debounced project persistence POST, which is unrelated to
    // what this test asserts.
    const searchCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/personalization/find-businesses'))
    expect(searchCalls).toHaveLength(1)
    const [url, init] = searchCalls[0]
    expect(url).toBe('/api/personalization/find-businesses')
    expect(JSON.parse(String(init?.body))).toMatchObject({
      niche: 'real-estate',
      location: 'Tampa, FL',
      radiusMiles: 15,
    })

    // Results render the lead list with the match score.
    // Await the settled results instead of a fixed sleep (Phase 3 item 9).
    await waitForElement(
      () => screen.queryByText('Sunset Realty'),
      'Sunset Realty lead row',
    )
    expect(screen.getByText('Sunset Realty')).toBeTruthy()
    expect(screen.getByText('80% match')).toBeTruthy()
    expect(screen.getByText('1 businesses found for Real Estate near Tampa, FL')).toBeTruthy()
  })
});
