// @vitest-environment jsdom
/**
 * Layout regression guards for the Personalization modal.
 *
 * The modal was changed from a narrow, tall, single-scroll layout
 * (maxWidth 1100px) to a wide, two-column layout (maxWidth 1480px +
 * `xl:columns-2`) so users see far more without scrolling.
 *
 * These tests pin that geometry so a future layout refactor cannot silently
 * revert it. The audit that preceded this change found NO existing test
 * asserting the modal's width/height bounds, layout classes, or anchors.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
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

function TestOpener({ onMounted }: { onMounted: (open: (opts: any) => void) => void }) {
  const { openPersonalize } = useDemoPersonalize();
  onMounted(openPersonalize);
  return null;
}

/** Renders the provider + modal and opens it on the standard demo source. */
async function openModal() {
  const container = document.createElement('div');
  container.setAttribute('data-testid', 'personalization-root')
  document.body.appendChild(container);
  const root = createRoot(container);

  let openPersonalize: ((opts: any) => void) | null = null;

  await act(async () => {
    root.render(
      <DemoPersonalizeProvider>
        <TestOpener
          onMounted={(open) => {
            openPersonalize = open;
          }}
        />
      </DemoPersonalizeProvider>,
    );
  });

  await act(async () => {
    openPersonalize?.({
      source: {
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
      },
    });
  });

  // Simple Mode is the default customer presentation; these layout guards
  // assert the full Advanced Editing layout, so opt into it after opening.
  await act(async () => {
    const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
      /advanced editing/i.test(candidate.textContent || ''),
    );
    button?.click();
  });

  return container;
}

describe('PersonalizationModal wide-layout guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.querySelectorAll('[data-testid="personalization-root"]').forEach((el) => el.remove())
    delete (window as any).__personalizationCtx
  })

  it('dialog uses a wide max-width (>=1280px) so the layout is wider than tall', async () => {
    await openModal();

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement | null;
    expect(dialog).toBeTruthy();

    // maxWidth is authored as the number 1480, so the DOM reports "1480px".
    const maxWidth = parseFloat(dialog!.style.maxWidth);
    expect(Number.isFinite(maxWidth)).toBe(true);
    expect(maxWidth).toBeGreaterThanOrEqual(1280);

    // Height stays viewport-bounded so the card never exceeds the screen.
    expect(dialog!.style.maxHeight).toBe('90vh');
  });

  it('body renders a two-column wrapper that collapses below the xl breakpoint', async () => {
    const container = await openModal();

    const wrapper = container.querySelector('[class*="columns-2"]') as HTMLElement | null;
    expect(wrapper).toBeTruthy();
    expect(wrapper!.className).toContain('xl:columns-2');

    // Below xl it must fall back to a single column (no unconditional multi-col).
    expect(wrapper!.className).not.toMatch(/(^|\s)columns-2(\s|$)/);
  });

  it('sections are marked break-inside-avoid so none split across a column', async () => {
    const container = await openModal();

    const sections = Array.from(
      container.querySelectorAll('section.break-inside-avoid'),
    ) as HTMLElement[];

    expect(sections.length).toBeGreaterThanOrEqual(5);

    sections.forEach((section) => {
      expect(section.className).toContain('break-inside-avoid');
    });
  });

  it('every section exposes an anchor id and scroll-margin for the sticky nav', async () => {
    const container = await openModal();

    const anchorIds = ['pz-overview', 'pz-client-assets', 'pz-content', 'pz-prompt', 'pz-output', 'pz-engine'];

    anchorIds.forEach((id) => {
      const section = container.querySelector(`#${id}`) as HTMLElement | null;
      expect(section, `expected section #${id} to render`).toBeTruthy();
      // Keeps anchored sections clear of the sticky nav instead of hiding under it.
      expect(section!.style.scrollMarginTop).toBe('64px');
    });
  });

  it('sticky section nav renders as an accessible landmark with valid anchor links', async () => {
    const container = await openModal();

    const nav = container.querySelector('nav[aria-label="Personalization sections"]') as HTMLElement | null;
    expect(nav).toBeTruthy();

    // Sticky so it stays reachable while the two columns scroll.
    expect(nav!.className).toContain('sticky');

    const links = Array.from(nav!.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.length).toBeGreaterThanOrEqual(5);

    links.forEach((link) => {
      const href = link.getAttribute('href') || '';
      expect(href.startsWith('#')).toBe(true);
      // Every nav target must actually exist in the DOM.
      expect(container.querySelector(href), `nav target ${href} should exist`).toBeTruthy();
    });
  });

  it('asset cards keep a compact min-height to limit vertical scroll', async () => {
    const container = await openModal();

    const cards = Array.from(container.querySelectorAll('article.asset-card')) as HTMLElement[];
    expect(cards.length).toBe(6);

    cards.forEach((card) => {
      expect(card.style.minHeight).toBe('250px');
    });
  });
});
