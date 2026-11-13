// @vitest-environment jsdom
/**
 * Layout regression guards for the Personalization modal.
 *
 * Advanced Editing is a wide (maxWidth 1480px) four-tab workspace — Client,
 * Assets, Full Body Recast, Overlays & Create — with a sticky live-preview
 * column, so each task fits on one screen instead of one long scroll.
 *
 * These tests pin that geometry, and that every pre-existing section is still
 * present under a tab, so a future refactor cannot silently drop features.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import PersonalizationModal from '../PersonalizationModal';
import { DemoPersonalizeProvider, useDemoPersonalize } from '../DemoPersonalizeProvider';
import { SECTION_LOCATION, SECTION_TAB } from '../advanced/AdvancedWorkspace';

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

  it('on xl screens the body is a fixed frame with two panes that scroll on their own', async () => {
    const container = await openModal();

    // The dialog becomes a fixed-height frame and the body stops scrolling.
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.className).toContain('xl:h-[90vh]');
    const main = container.querySelector('[data-pz-scroll-root]') as HTMLElement;
    expect(main.className).toContain('xl:overflow-hidden');

    const layout = container.querySelector('.pz-adv-layout') as HTMLElement | null;
    expect(layout).toBeTruthy();
    expect(layout!.className).toContain('xl:grid-cols-[minmax(0,1fr)_400px]');
    expect(layout!.className).toContain('xl:flex-1');
    // Below xl it falls back to a single column and one normal scroll.
    expect(layout!.className).toContain('grid-cols-1');

    // Each pane scrolls itself, so nothing is hidden behind a sticky element.
    const pane = container.querySelector('[data-pz-pane-scroll]') as HTMLElement;
    expect(pane.className).toContain('xl:overflow-y-auto');
    const preview = container.querySelector('[data-testid="pz-preview-column"]') as HTMLElement | null;
    expect(preview!.className).toContain('xl:overflow-y-auto');
    expect(preview!.className).not.toContain('sticky');
    expect(preview!.querySelector('[data-testid="pz-will-use"]')).toBeTruthy();
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

  it('a sticky step bar switches between the four tabs, showing one panel at a time', async () => {
    const container = await openModal();

    const tablist = container.querySelector('[role="tablist"][aria-label="Advanced Editing steps"]') as HTMLElement | null;
    expect(tablist).toBeTruthy();
    // A fixed row of the frame, never sticky over content.
    expect(tablist!.className).not.toContain('sticky');

    const tabs = Array.from(tablist!.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
    expect(tabs.map((tab) => tab.id)).toEqual(['pz-tab-client', 'pz-tab-assets', 'pz-tab-recast', 'pz-tab-create']);

    const visiblePanels = () =>
      Array.from(container.querySelectorAll('[role="tabpanel"]'))
        .filter((panel) => !(panel as HTMLElement).hidden)
        .map((panel) => panel.id);

    expect(visiblePanels()).toEqual(['pz-tabpanel-client']);
    for (const tab of tabs) {
      await act(async () => { tab.click(); });
      expect(tab.getAttribute('aria-selected')).toBe('true');
      expect(visiblePanels()).toEqual([tab.getAttribute('aria-controls')]);
    }

    // "Next" walks the client sections, then moves on to the next tab.
    await act(async () => { tabs[0].click(); });
    const clickNext = async () => {
      const next = Array.from(container.querySelectorAll('button')).find((b) => /^Next: /.test(b.textContent || ''));
      await act(async () => { next!.click(); });
    };
    await clickNext();
    expect(visiblePanels()).toEqual(['pz-tabpanel-client']);
    expect((container.querySelector('[data-testid="pz-section-client-profile"]') as HTMLElement).hidden).toBe(false);
    await clickNext();
    expect(visiblePanels()).toEqual(['pz-tabpanel-assets']);
  });

  it('section pills show one section of a tab at a time', async () => {
    const container = await openModal();
    await act(async () => { (container.querySelector('[data-testid="pz-tab-assets"]') as HTMLElement).click(); });

    const shown = () => Array.from(container.querySelectorAll('[data-testid^="pz-section-assets-"]'))
      .filter((el) => !(el as HTMLElement).hidden)
      .map((el) => el.getAttribute('data-testid'));
    expect(shown()).toEqual(['pz-section-assets-yours']);
    for (const pill of ['found', 'content', 'yours']) {
      await act(async () => { (container.querySelector(`[data-testid="pz-pill-assets-${pill}"]`) as HTMLElement).click(); });
      expect(shown()).toEqual([`pz-section-assets-${pill}`]);
    }
    // With nothing discovered yet, "Found on website" explains where to start.
    await act(async () => { (container.querySelector('[data-testid="pz-pill-assets-found"]') as HTMLElement).click(); });
    expect(container.querySelector('[data-testid="pz-found-empty"]')).toBeTruthy();
  });

  it('keeps every Advanced Editing section, each under its tab', async () => {
    const container = await openModal();

    // Always-present sections for a signed-in video source.
    // (#pz-mode only appears once a non-prompt output is chosen, as before.)
    const required = ['pz-overview', 'pz-find-business', 'pz-client-profile', 'pz-client-assets', 'pz-content', 'pz-recast', 'pz-prompt', 'pz-output', 'pz-engine'];
    for (const id of required) {
      const section = container.querySelector(`#${id}`) as HTMLElement | null;
      expect(section, `expected section #${id} to render`).toBeTruthy();
      const panel = section!.closest('[role="tabpanel"]') as HTMLElement | null;
      expect(panel?.id, `#${id} should be inside its tab`).toBe(`pz-tabpanel-${SECTION_TAB[id]}`);
      const { tab, section: pill } = SECTION_LOCATION[id];
      if (id !== 'pz-overview' && tab !== 'recast') {
        expect(section!.closest(`[data-testid="pz-section-${tab}-${pill}"]`), `#${id} should be in the ${pill} section`).toBeTruthy();
      }
    }
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
