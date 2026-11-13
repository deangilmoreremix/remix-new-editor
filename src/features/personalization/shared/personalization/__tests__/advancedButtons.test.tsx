// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any -- test harness shared with PersonalizationModalLayout.test.tsx */
/**
 * Advanced Editing buttons that used to do nothing (or the wrong thing) when
 * clicked: each now does its job.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoPersonalizeProvider, useDemoPersonalize } from '../DemoPersonalizeProvider';

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

let latestCtx: any = null

function TestOpener({ onMounted }: { onMounted: (open: (opts: any) => void) => void }) {
  const ctx = useDemoPersonalize();
  latestCtx = ctx;
  onMounted(ctx.openPersonalize);
  return null;
}

const mountedRoots: Array<ReturnType<typeof createRoot>> = [];

/** Renders the provider + modal and opens it on the standard demo source. */
async function openModal() {
  const container = document.createElement('div');
  container.setAttribute('data-testid', 'personalization-root')
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push(root);

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


const $ = (container: HTMLElement, testId: string) => container.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null
const buttonByText = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === text) as HTMLButtonElement | undefined

describe('Advanced Editing buttons', () => {
  afterEach(() => {
    // Unmount first so provider effects and timers are cleaned up between tests.
    act(() => { mountedRoots.splice(0).forEach((root) => root.unmount()) })
    document.querySelectorAll('[data-testid="personalization-root"]').forEach((el) => el.remove())
    latestCtx = null
    vi.restoreAllMocks()
  })

  it('"New" clears every client field, not just the name', async () => {
    const container = await openModal();
    await act(async () => {
      latestCtx.updateClientForm({ businessName: 'Joe Roofing', industry: 'Roofing', website: 'https://joe.example', phone: '555', audience: 'self' })
    });
    await act(async () => { await latestCtx.saveClient(); });
    await act(async () => { $(container, 'pz-pill-client-profile')!.click(); });

    await act(async () => { buttonByText(container, 'New')!.click(); });
    expect(latestCtx.clientForm.businessName || '').toBe('')
    expect(latestCtx.clientForm.industry || '').toBe('')
    expect(latestCtx.clientForm.website || '').toBe('')
    expect(latestCtx.clientForm.phone || '').toBe('')
    expect(latestCtx.clientForm.audience).toBe('self')
  });

  it('the FACE / BODY / SIDE slots open the photo picker', async () => {
    const container = await openModal();
    await act(async () => { $(container, 'pz-tab-assets')!.click(); });
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    for (const name of ['Add face photo', 'Add body photo', 'Add side photo', 'Add a product photo', 'Add store photo']) {
      const slot = container.querySelector(`button[aria-label="${name}"]`) as HTMLButtonElement
      expect(slot, name).toBeTruthy()
      await act(async () => { slot.click(); });
    }
    expect(click).toHaveBeenCalledTimes(5)
  });

  it('removing a saved asset keeps every other asset in its own list', async () => {
    await openModal();
    await act(async () => { latestCtx.updateClientForm({ businessName: 'Joe Roofing', audience: 'self' }) });
    await act(async () => { await latestCtx.saveClient(); });
    await act(async () => {
      latestCtx.addLogoUrl('https://cdn.example/logo.png')
      latestCtx.addProductUrl('https://cdn.example/roof.png')
      latestCtx.addProductUrl('https://cdn.example/gutter.png')
    });
    const [roof] = latestCtx.assets.products
    await act(async () => { latestCtx.removeSavedAsset(roof.id) });

    expect(latestCtx.assets.products.map((a: any) => a.url)).toEqual(['https://cdn.example/gutter.png'])
    expect(latestCtx.assets.logos).toHaveLength(1)
    expect(latestCtx.assets.primaryLogo?.url).toBe('https://cdn.example/logo.png')
    expect(latestCtx.assets.identities).toHaveLength(0)
  });

  it('an unknown id leaves the primary photo and logo alone', async () => {
    await openModal();
    await act(async () => {
      latestCtx.addLogoUrl('https://cdn.example/logo.png')
      latestCtx.addIdentityUrl('https://cdn.example/face.png')
    });
    const before = { logo: latestCtx.assets.primaryLogo?.id, person: latestCtx.assets.primaryIdentity?.id }
    await act(async () => {
      latestCtx.setPrimaryLogo('nope')
      latestCtx.setPrimaryIdentity('nope')
      latestCtx.removeLogo('nope')
      latestCtx.removeIdentity('nope')
    });
    expect(latestCtx.assets.primaryLogo?.id).toBe(before.logo)
    expect(latestCtx.assets.primaryIdentity?.id).toBe(before.person)
    expect(latestCtx.assets.logos.every((a: any) => a.isPrimary !== false || a.id !== before.logo)).toBe(true)
  });

  it('Save Client says it saved', async () => {
    const container = await openModal();
    await act(async () => { latestCtx.updateClientForm({ businessName: 'Joe Roofing', audience: 'self' }) });
    await act(async () => { $(container, 'pz-pill-client-profile')!.click(); });
    await act(async () => { buttonByText(container, 'Save Client')!.click(); });
    expect($(container, 'pz-client-save-status')!.textContent).toContain('Saved')
  });

  it('Full presenter warns when the preview is longer than 30 s and trims it', async () => {
    const container = await openModal();
    await act(async () => {
      latestCtx.setMode('full_body')
      latestCtx.updatePreviewComposition({ durationInFrames: 45 * latestCtx.previewSettings.fps })
      latestCtx.setAdvancedTab?.('create')
      latestCtx.setAdvancedSection?.('create', 'output')
    });
    const warning = $(container, 'pz-full-body-too-long')
    expect(warning?.textContent).toContain('up to 30 s')
    expect(warning?.textContent).toContain('45 s')
    await act(async () => { buttonByText(container, 'Trim preview to 30 s')!.click() });
    expect(latestCtx.previewSettings.durationInFrames).toBe(30 * latestCtx.previewSettings.fps)
    expect($(container, 'pz-full-body-too-long')).toBeNull()
  });
});
