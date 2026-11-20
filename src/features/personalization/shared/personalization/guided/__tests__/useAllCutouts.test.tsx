// @vitest-environment jsdom
/**
 * "Add all cutouts": places every found asset that holds a finished on-device
 * cutout, and nothing else.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { DiscoveredAsset } from '../../types';
import { cutoutAssetIds } from '../../backgroundRemoval/useAutoCutout';

const ctx: Record<string, unknown> = {};
vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: () => ctx }));

import { StepFindBusiness } from '../StepFindBusiness';

function asset(overrides: Partial<DiscoveredAsset>): DiscoveredAsset {
  return {
    id: 'a',
    previewUrl: 'https://shop.example/a.png',
    sourceUrl: 'https://shop.example/a.png',
    sourceType: 'WEBSITE',
    category: 'product',
    selected: false,
    recommended: false,
    rejected: false,
    ...overrides,
  } as DiscoveredAsset;
}
const cut = { editedDataUrl: 'data:image/png;base64,AAAA', hasTransparency: true, edited: true, editMetadata: { operation: 'remove_background', engine: 'bg0' } };
const ASSETS = [
  asset({ id: 'cut1', ...cut } as Partial<DiscoveredAsset>),
  asset({ id: 'cut2', category: 'logo', ...cut } as Partial<DiscoveredAsset>),
  asset({ id: 'plain' }),
  asset({ id: 'removed', rejected: true, ...cut } as Partial<DiscoveredAsset>),
  asset({ id: 'junk', category: 'irrelevant', ...cut } as Partial<DiscoveredAsset>),
  asset({ id: 'aiEdit', editedDataUrl: 'data:image/png;base64,BBBB', edited: true, editMetadata: { operation: 'edit', engine: 'ai' } } as Partial<DiscoveredAsset>),
];

describe('cutoutAssetIds', () => {
  it('returns only finished bg0 cutouts that are still wanted', () => {
    expect(cutoutAssetIds(ASSETS)).toEqual(['cut1', 'cut2']);
  });
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;
async function render(access: string, importFn = vi.fn(), setAssets = vi.fn()) {
  Object.assign(ctx, {
    clientForm: { businessName: 'Shop', website: 'https://shop.example' },
    access,
    discoveredAssets: ASSETS,
    discoveryStatus: 'idle',
    discoveryError: null,
    toggleDiscoveredAssetSelection: vi.fn(),
    importDiscoveredAssets: importFn,
    setDiscoveredAssets: setAssets,
    saveClient: vi.fn(),
    setViewMode: vi.fn(),
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
const find = (v: HTMLElement) => Array.from(v.querySelectorAll('button')).find((b) => /add all cutouts/i.test(b.textContent || ''));

describe('StepFindBusiness: Add all cutouts', () => {
  it('imports exactly the cutout ids and selects them', async () => {
    const importFn = vi.fn();
    const setAssets = vi.fn();
    const view = await render('authenticated', importFn, setAssets);
    const btn = find(view)!;
    expect(btn.textContent).toContain('(2)');
    await act(async () => { btn.click(); });
    expect(importFn).toHaveBeenCalledWith({ ids: ['cut1', 'cut2'] });
    const updater = setAssets.mock.calls[0][0] as (p: DiscoveredAsset[]) => DiscoveredAsset[];
    expect(updater(ASSETS).filter((a) => a.selected).map((a) => a.id)).toEqual(['cut1', 'cut2']);
  });

  it('is not offered to signed-out visitors', async () => {
    const view = await render('anonymous');
    expect(find(view)).toBeUndefined();
  });
});
