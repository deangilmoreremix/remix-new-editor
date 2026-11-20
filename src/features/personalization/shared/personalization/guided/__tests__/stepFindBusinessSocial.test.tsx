// @vitest-environment jsdom
/**
 * The simple "Find your business" step shows the social profiles found for the business (until now only the
 * Advanced Editing view did).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const ctx: Record<string, unknown> = {};
vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: () => ctx }));

import { StepFindBusiness } from '../StepFindBusiness';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(overrides: Record<string, unknown> = {}) {
  for (const k of Object.keys(ctx)) delete ctx[k];
  Object.assign(ctx, {
    clientForm: { businessName: "Joe's Pizza", website: 'https://joes-pizza.example' },
    access: 'authenticated',
    discoveredAssets: [],
    discoveryStatus: 'idle',
    discoveryError: null,
    toggleDiscoveredAssetSelection: vi.fn(),
    importDiscoveredAssets: vi.fn(),
    saveClient: vi.fn(),
    setViewMode: vi.fn(),
    contactSources: {},
    ...overrides,
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root!.render(<StepFindBusiness />); });
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

const research = (socialLinks: Record<string, string>) => ({
  status: 'done',
  result: { canonicalUrl: 'https://joes-pizza.example', finalUrl: 'https://joes-pizza.example/', reachable: true, title: "Joe's Pizza", socialLinks, jsonLd: [], openGraph: {}, twitterCard: {} },
});

describe('StepFindBusiness: social media found', () => {
  it('shows icons linking to the profiles the website research found', async () => {
    const view = await render({ businessResearch: research({ facebook: 'https://www.facebook.com/joespizza', instagram: 'https://www.instagram.com/joespizza' }) });
    const panel = view.querySelector('[data-testid="pz-found-social"]');
    expect(panel).not.toBeNull();
    const hrefs = Array.from(panel!.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['https://www.facebook.com/joespizza', 'https://www.instagram.com/joespizza']);
  });

  it('also shows a profile found by the contact lookup that the profile still holds', async () => {
    const view = await render({
      clientForm: { businessName: "Joe's", website: 'https://joes-pizza.example', tiktok: '@joespizza' },
      contactSources: { tiktok: { value: '@joespizza', sourceUrl: 'https://joes-pizza.example/contact', method: 'link', confidence: 0.9 } },
    });
    expect(view.querySelector('[data-testid="pz-found-social"] a')?.getAttribute('href')).toBe('https://www.tiktok.com/@joespizza');
  });

  it('shows nothing when no social profile was found', async () => {
    const view = await render({ businessResearch: research({}) });
    expect(view.querySelector('[data-testid="pz-found-social"]')).toBeNull();
  });

  it('shows no empty panel when every found link is unusable', async () => {
    const view = await render({ businessResearch: research({ facebook: 'https://www.facebook.com/', instagram: 'https://www.facebook.com/sharer/sharer.php?u=x' }) });
    expect(view.querySelector('[data-testid="pz-found-social"]')).toBeNull();
  });
});
