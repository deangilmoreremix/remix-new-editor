/**
 * renderStudioOverlayProductionStore.test.js
 *
 * The same overlay projection as `renderStudioOverlay.test.js`, but exercised
 * against the REAL store singletons — no mocks at all. This is the proof that
 * the store-shape adapter and the client-profile resolution work in
 * production, not only against a friendly mock:
 *
 *   - `assetLibraryStore.getState()` really returns
 *     `{ assets, removed, hydrated }` (flat, `role` per record) and has no
 *     bucketed `logos` / `products` / … fields.
 *   - `clientProfileStore` really has `getCurrentClientId()` / `getClientById()`
 *     and no `getCurrent()`.
 *
 * Store state is written through the public `setState()` API and reset in
 * `beforeEach`, so nothing persists and no other suite can observe it.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { assetLibraryStore } from '../assetLibraryStore.js';
import { clientProfileStore } from '../clientProfileStore.js';
import {
  buildPersonalizationOverlays,
  resolveForRenderStudio,
  toBucketedAssetLibrary,
  RENDER_STUDIO_OVERLAY_IDS,
} from '../studioBridge.js';

const PROFILE = {
  id: 'client-1',
  audience: 'me',
  name: 'Acme Roofing',
  businessName: 'Acme Roofing',
  industry: 'roofing',
  callToAction: 'Call now for a free quote',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function logo(id, isPrimary) {
  return {
    id, role: 'logo', name: id, url: `https://cdn.test/${id}.png`, isPrimary,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  assetLibraryStore.setState({ assets: [], removed: [], hydrated: true });
  clientProfileStore.setState({ clients: [], currentClientId: null, hydrated: true });
});

describe('the real production store shapes', () => {
  it('exposes a flat `assets` array and no bucketed fields', () => {
    const state = assetLibraryStore.getState();
    expect(Array.isArray(state.assets)).toBe(true);
    expect(state).toHaveProperty('removed');
    expect(state).toHaveProperty('hydrated');
    // The bucketed shape `collect()` expects does not exist on the real store:
    // this is the mismatch the adapter closes.
    expect(state.logos).toBeUndefined();
    expect(state.products).toBeUndefined();
    expect(state.brandReferences).toBeUndefined();
    expect(state.firstFrame).toBeUndefined();
    expect(state.lastFrame).toBeUndefined();
  });

  it('has no getCurrent() on the client store', () => {
    expect(typeof clientProfileStore.getCurrent).toBe('undefined');
    expect(typeof clientProfileStore.getCurrentClientId).toBe('function');
    expect(typeof clientProfileStore.getClientById).toBe('function');
  });
});

describe('overlay projection against the real stores', () => {
  it('projects the logo overlay from the real (flat) asset library', () => {
    assetLibraryStore.setState({
      assets: [logo('logo-1', true), logo('logo-2', false)],
      removed: [],
      hydrated: true,
    });

    const overlays = buildPersonalizationOverlays();
    const logoOverlay = overlays.find((o) => o.id === RENDER_STUDIO_OVERLAY_IDS.logo);
    expect(logoOverlay).toMatchObject({
      type: 'image',
      url: 'https://cdn.test/logo-1.png',
      x: 0.84,
      width: 0.12,
      opacity: 0.9,
    });
    // …and the same adapter feeds the reference-image projection.
    expect(resolveForRenderStudio().referenceImages.map((r) => r.url))
      .toEqual(['https://cdn.test/logo-1.png', 'https://cdn.test/logo-2.png']);
  });

  it('resolves the client profile with `currentClientId === null`', () => {
    // Production reality: `addClient()` never sets `currentClientId`.
    clientProfileStore.setState({ clients: [PROFILE], currentClientId: null });

    const overlays = buildPersonalizationOverlays();
    expect(overlays.find((o) => o.id === RENDER_STUDIO_OVERLAY_IDS.businessName))
      .toMatchObject({ type: 'text', text: 'Acme Roofing' });
    expect(overlays.find((o) => o.id === RENDER_STUDIO_OVERLAY_IDS.callToAction))
      .toMatchObject({ type: 'text', text: 'Call now for a free quote' });
    expect(resolveForRenderStudio().clientProfile).toMatchObject({ id: 'client-1' });
  });

  it('honours an explicit currentClientId through the real getClientById()', () => {
    clientProfileStore.setState({
      clients: [
        PROFILE,
        {
          ...PROFILE,
          id: 'client-2',
          businessName: 'Globex',
          callToAction: 'Book a demo',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      currentClientId: 'client-1',
    });

    // The explicit selection wins over the "most recently updated" fallback.
    const overlays = buildPersonalizationOverlays();
    expect(overlays.find((o) => o.id === RENDER_STUDIO_OVERLAY_IDS.businessName).text)
      .toBe('Acme Roofing');
  });

  it('projects nothing at all from empty real stores', () => {
    expect(buildPersonalizationOverlays()).toEqual([]);
    expect(resolveForRenderStudio().referenceImages).toEqual([]);
    expect(resolveForRenderStudio().clientProfile).toBeNull();
  });
});

describe('toBucketedAssetLibrary against the real store state', () => {
  it('buckets by role', () => {
    assetLibraryStore.setState({
      assets: [
        logo('l1', true),
        { id: 'p1', role: 'product_reference', url: 'https://cdn.test/p.png', isPrimary: true },
        { id: 'ff', role: 'first_frame', url: 'https://cdn.test/ff.png', isPrimary: true },
        { id: 'lf', role: 'last_frame', url: 'https://cdn.test/lf.png', isPrimary: true },
      ],
      removed: [],
      hydrated: true,
    });

    const bucketed = toBucketedAssetLibrary(assetLibraryStore.getState());
    expect(bucketed.logos.map((a) => a.id)).toEqual(['l1']);
    expect(bucketed.products.map((a) => a.id)).toEqual(['p1']);
    expect(bucketed.firstFrame.id).toBe('ff');
    expect(bucketed.lastFrame.id).toBe('lf');
  });

  it('is neutral for a missing or empty store state', () => {
    expect(toBucketedAssetLibrary(null)).toBeNull();
    expect(toBucketedAssetLibrary({}).brandReferences).toEqual([]);
  });
});
