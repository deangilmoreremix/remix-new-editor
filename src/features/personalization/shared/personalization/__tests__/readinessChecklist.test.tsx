// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any -- test harness shared with PersonalizationModalLayout.test.tsx */
/**
 * The Advanced Editing "what's left" checklist, the step-bar warning and the
 * footer reason all come from validateProjectRequirements, so a customer sees
 * what is missing (and where to fix it) before pressing the main button.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoPersonalizeProvider, useDemoPersonalize } from '../DemoPersonalizeProvider';
import { validateProjectRequirements } from '../ai/toolExecutor';
import { blockingByTab, requirementLocation } from '../advanced/ReadinessChecklist';

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

const $ = (container: HTMLElement, testId: string) => container.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null

describe('validateProjectRequirements', () => {
  const base = {
    source: { id: 's' } as any,
    clientForm: { businessName: 'Joe Roofing' } as any,
    assets: { identities: [], logos: [], products: [], brandReferences: [] } as any,
    mode: 'full_body' as any,
    outputType: 'video' as any,
    promptState: { personalized: true } as any,
    genOptions: { consentGiven: false } as any,
  }
  const errors = (ctx: any) => validateProjectRequirements(ctx).filter((r) => r.severity === 'error').map((r) => r.field)

  it('blocks on a missing business name and on missing likeness consent', () => {
    expect(errors({ ...base, clientForm: {} })).toEqual(['client.businessName', 'consent'])
    expect(errors({ ...base, genOptions: { consentGiven: true } })).toEqual([])
  })

  it('blocks on uploads that are still running or failed', () => {
    const assets = { ...base.assets, logos: [{ id: 'l', uploadStatus: 'error' }], products: [{ id: 'p', uploadStatus: 'uploading' }] }
    const messages = validateProjectRequirements({ ...base, assets, genOptions: { consentGiven: true } } as any)
      .filter((r) => r.field === 'uploads').map((r) => r.message)
    expect(messages).toEqual(['1 image is still uploading.', '1 image failed to upload — retry or remove it.'])
  })

  it('a prompt-only output needs only the business name', () => {
    expect(errors({ ...base, outputType: 'prompt', assets: { ...base.assets, logos: [{ id: 'l', uploadStatus: 'error' }] } })).toEqual([])
  })

  it('every requirement shown to the user has a place to fix it', () => {
    for (const field of ['client.businessName', 'mode', 'consent', 'prompt', 'uploads', 'assets.logos']) {
      expect(requirementLocation(field), field).toBeTruthy()
    }
    expect(blockingByTab([
      { field: 'client.businessName', label: 'Business Name', severity: 'error', message: '' },
      { field: 'assets.logos', label: 'Logo', severity: 'warning', message: '' },
    ])).toEqual({ client: 'Business Name' })
  })
})

describe('Advanced Editing readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.querySelectorAll('[data-testid="personalization-root"]').forEach((el) => el.remove())
    latestCtx = null
  })

  it('shows what is missing, flags the tab, and explains the disabled button', async () => {
    const container = await openModal();

    const checklist = $(container, 'pz-readiness')!
    expect(checklist).toBeTruthy()
    expect(checklist.textContent).toMatch(/to finish before you create/)
    expect($(container, 'pz-readiness-item-client.businessName')).toBeTruthy()

    expect($(container, 'pz-tab-client')!.getAttribute('data-issue')).toBe('true')
    expect($(container, 'pz-tab-client')!.textContent).toContain('Business Name needed')

    const reason = $(container, 'pz-footer-reason')!
    expect(reason.textContent).toContain('Add the business name.')
    const cta = Array.from(container.querySelectorAll('footer button')).find((b) => /✦/.test(b.textContent || '')) as HTMLButtonElement
    expect(cta.disabled).toBe(true)

    expect(container.querySelectorAll('[data-testid="pz-required-tag"]').length).toBeGreaterThan(0)
  });

  it('Fix opens the tab and section where the item is fixed', async () => {
    const container = await openModal();
    await act(async () => { $(container, 'pz-tab-create')!.click(); });
    expect($(container, 'pz-tabpanel-create')!.hidden).toBe(false)

    const fix = $(container, 'pz-readiness-item-client.businessName')!.querySelector('button') as HTMLElement
    await act(async () => { fix.click(); });

    expect($(container, 'pz-tabpanel-client')!.hidden).toBe(false)
    expect($(container, 'pz-section-client-profile')!.hidden).toBe(false)
  });

  it('the business-name item clears once the name is entered', async () => {
    const container = await openModal();
    await act(async () => { latestCtx.updateClientForm({ ...latestCtx.clientForm, businessName: 'Joe Roofing' }); });

    expect($(container, 'pz-readiness-item-client.businessName')).toBeNull()
    expect($(container, 'pz-tab-client')!.getAttribute('data-issue')).toBeNull()
    expect($(container, 'pz-footer-reason')?.textContent || '').not.toContain('business name')
  });

  it('the phone is edited in one place (Profile); Business content links to it', async () => {
    const container = await openModal();
    expect(container.querySelectorAll('input[placeholder="555-555-5555"]').length).toBe(1)
    expect($(container, 'pz-section-client-profile')!.querySelector('input[placeholder="555-555-5555"]')).toBeTruthy()

    await act(async () => { $(container, 'pz-tab-assets')!.click(); });
    await act(async () => { $(container, 'pz-pill-assets-content')!.click(); });
    const note = $(container, 'pz-content-phone')!
    expect(note.textContent).toContain('Add in Profile')
    await act(async () => { (note.querySelector('button') as HTMLElement).click(); });
    expect($(container, 'pz-section-client-profile')!.hidden).toBe(false)
  });

  it('a greyed-out mode says what is missing and links to where to add it', async () => {
    const container = await openModal();
    await act(async () => { latestCtx.setOutputType('video'); });
    await act(async () => { $(container, 'pz-tab-create')!.click(); });
    await act(async () => { $(container, 'pz-pill-create-output')!.click(); });
    // The AI modes are offered once "Generate with AI" is chosen ("Create without AI" needs none).
    await act(async () => { $(container, 'pz-method-ai')!.click(); });

    const reason = container.querySelector('[data-testid^="pz-mode-reason-"]') as HTMLElement
    expect(reason, 'a person mode is unavailable without a presenter photo').toBeTruthy()
    expect(reason.textContent).toMatch(/Assets › Your assets › Person \/ Presenter/)

    const fix = container.querySelector('[data-testid^="pz-mode-fix-"]') as HTMLButtonElement
    expect(fix.disabled).toBe(false)
    await act(async () => { fix.click(); });
    expect($(container, 'pz-tabpanel-assets')!.hidden).toBe(false)
    expect($(container, 'pz-section-assets-yours')!.hidden).toBe(false)
  });
});
