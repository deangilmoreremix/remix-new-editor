// @vitest-environment jsdom
/**
 * Robustness guards for the Personalization modal.
 *
 * Two defects found in the Phase 1 audit are pinned here:
 *
 * 1. z-index collision with the Video Studio modal. The modal root and the
 *    studio modal both used `z-[100]`, so when the Personalization Modal was
 *    opened from inside Video Studio (the Phase 1 shared hand-off) the two
 *    fought for the top layer and the user could end up unable to interact
 *    with the Personalization Modal.
 *
 * 2. Body scroll-lock clobbering the previous value. The lock wrote
 *    `document.body.style.overflow = 'hidden'` and the cleanup wrote `''`,
 *    which silently destroyed any value the page (or an enclosing studio) had
 *    already set — e.g. `overflow: hidden` on a scrolled panel, or
 *    `overflow: auto`. The previous inline value is now captured and restored
 *    verbatim.
 *
 * This file follows the "guards" style of PersonalizationModalLayout.test.tsx:
 * it inspects the DOM instead of driving the UI, and it pins concrete values
 * rather than snapshots.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  DemoPersonalizeProvider,
  useDemoPersonalize,
  type DemoPersonalizeContextValue,
} from '../DemoPersonalizeProvider';
import type { PersonalizationSource } from '../types';

/**
 * Narrow structural stand-ins for the two things the test has to fake.
 *
 * They are deliberately *structural* rather than `any`: the mock only ever
 * needs to render children, and the debug hook is only ever read by other
 * suites — so the concrete shapes below are enough to keep the compiler and
 * the linter honest without widening anything to `any`.
 */
type SocialPublishContextStub = {
  Provider: (props: { children?: ReactNode }) => ReactNode;
  Consumer: (props: { children: (value: unknown) => ReactNode }) => ReactNode;
};

/** The shape of the `fetch` stub the provider's project-restore call sees. */
type FetchStub = () => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

/** The `window.__personalizationCtx` debug hook other personalization suites set. */
type PersonalizationDebugWindow = { __personalizationCtx?: unknown };

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
  SocialPublishContext: {
    Provider: ({ children }: { children?: ReactNode }) => children,
    Consumer: ({ children }: { children: (value: unknown) => ReactNode }) => children(null),
  } satisfies SocialPublishContextStub,
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

// ── z-index scale ────────────────────────────────────────────────────────────
//
// The app layers its overlays on one scale. The surveyed values are:
//
//   60   src/apps/go-ai-viral/StudioTargetPicker.tsx:30
//   80   packages/studio/src/components/UniversalMediaUploader.jsx:327
//   100  studio modals — e.g. packages/studio/src/components/VideoStudio.jsx:3131
//        (also MarketingStudio, CinemaStudio, RecastStudio, LipSyncStudio,
//        ImageStudio, DrawModal, WorkflowStudio)
//   120  src/components/DrawModal.js:10, image-editor/ImageEditorModal.tsx:967
//   200  components/ApiKeyModal.js:43
//   300  src/access/UpgradeModal.tsx:77 (the upgrade / plan gate)
//
// The Personalization Modal must sit ABOVE the studio modals and the API-key
// modal so it is actually usable when it is opened from inside a studio, and
// BELOW the upgrade gate so the gate can still interrupt the user.
// `z-[250]` is the only value in that band: it is greater than 100 and 200
// and strictly less than 300.
const MODAL_Z_INDEX = 250;
const STUDIO_MODAL_Z_INDEX = 100;
const API_KEY_MODAL_Z_INDEX = 200;
const UPGRADE_GATE_Z_INDEX = 300;

/**
 * Resolves the effective z-index of a Tailwind element inside jsdom.
 *
 * jsdom does not load the app's Tailwind stylesheet, so
 * `getComputedStyle(el).zIndex` is always `''` for a class-driven `z-[N]`
 * utility. The authored value therefore has to be read off the element: the
 * inline `z-index` when one exists, otherwise the arbitrary `z-[N]` utility in
 * the class list. Those are exactly the two ways this codebase sets a
 * z-index, so this mirrors what the browser computes for them.
 */
function effectiveZIndex(el: HTMLElement): number | null {
  const inline = (el.style.zIndex || '').trim();
  if (inline) {
    const parsed = Number.parseInt(inline, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  const match = /(?:^|\s)z-\[(\d+)\]/.exec(el.className || '');
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

const DEMO_SOURCE: PersonalizationSource = {
  id: 'demo-robustness',
  title: 'Test Demo',
  mediaType: 'video',
  originalPrompt: 'test prompt',
  sourceMedia: null,
  poster: null,
  fullPrompt: 'test',
  shortPrompt: 'test',
  sourceType: 'landing-demo',
  sourceMetadata: {},
};

function TestOpener({ onMounted }: { onMounted: (ctx: DemoPersonalizeContextValue) => void }) {
  const ctx = useDemoPersonalize();
  onMounted(ctx);
  return null;
}

const mountedRoots: ReturnType<typeof createRoot>[] = [];

/**
 * Mounts the provider, opens the modal on the standard demo source and
 * returns handles for the opened modal. The modal only renders while the
 * provider reports `isOpen && source`, so the returned `close`/`root` are the
 * two ways the modal can go away: a real close (unmount via the provider) and
 * a raw tree unmount.
 */
async function mountModal() {
  const container = document.createElement('div');
  container.setAttribute('data-testid', 'personalization-root');
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push(root);

  let ctx: DemoPersonalizeContextValue | null = null;

  await act(async () => {
    root.render(
      <DemoPersonalizeProvider>
        <TestOpener onMounted={(value) => { ctx = value; }} />
      </DemoPersonalizeProvider>,
    );
  });

  await act(async () => {
    ctx?.openPersonalize({ source: DEMO_SOURCE });
  });

  return {
    container,
    root,
    close: () => ctx?.closePersonalize(),
  };
}

describe('PersonalizationModal robustness guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The provider fires a project-restore GET when the modal opens. Answer it
    // instantly so the open never waits on real network I/O.
    (globalThis as unknown as { fetch: FetchStub }).fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, projects: [] }),
      text: async () => '',
    }));
  });

  afterEach(() => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop()!;
      act(() => root.unmount())
    }
    document.querySelectorAll('[data-testid="personalization-root"]').forEach((el) => el.remove())
    delete (window as unknown as PersonalizationDebugWindow).__personalizationCtx
    // Never leak one test's body overflow into the next.
    document.body.style.overflow = ''
  })

  it('modal root layers above the studio modals and the API-key modal but below the upgrade gate', async () => {
    const { container } = await mountModal();

    const dialog = container.querySelector('[role="dialog"]') as HTMLElement | null;
    expect(dialog, 'expected the modal dialog to render').toBeTruthy();

    // The dialog is the only child of the fixed overlay that owns the layer.
    const root = dialog!.parentElement as HTMLElement;
    expect(root.className).toContain('fixed');
    expect(root.className).toContain('inset-0');

    const zIndex = effectiveZIndex(root);
    expect(zIndex, 'expected the modal root to declare a z-index').not.toBeNull();
    expect(zIndex).toBe(MODAL_Z_INDEX);
    expect(zIndex!).toBeGreaterThan(STUDIO_MODAL_Z_INDEX);
    expect(zIndex!).toBeGreaterThan(API_KEY_MODAL_Z_INDEX);
    expect(zIndex!).toBeLessThan(UPGRADE_GATE_Z_INDEX);
  });

  it('restores the exact previous body overflow when the modal is closed', async () => {
    // A page (or studio) that had already set an inline overflow value.
    document.body.style.overflow = 'auto';

    const { close } = await mountModal();

    // While open, the modal owns the scroll lock.
    expect(document.body.style.overflow).toBe('hidden');

    await act(async () => { close(); });

    // The previous value must come back exactly — not '', which would destroy it.
    expect(document.body.style.overflow).toBe('auto');
  });

  it('restores an empty previous body overflow when the modal is closed', async () => {
    document.body.style.overflow = '';

    const { close } = await mountModal();

    expect(document.body.style.overflow).toBe('hidden');

    await act(async () => { close(); });

    expect(document.body.style.overflow).toBe('');
  });

  it('restores the previous body overflow when the modal is unmounted without closing', async () => {
    document.body.style.overflow = 'auto';

    const { root } = await mountModal();

    expect(document.body.style.overflow).toBe('hidden');

    // Unmount the whole tree instead of closing: the cleanup path is the same
    // one a route change or a provider teardown would take.
    await act(async () => { root.unmount(); });

    expect(document.body.style.overflow).toBe('auto');
  });
});
