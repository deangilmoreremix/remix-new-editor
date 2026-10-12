/**
 * studioBridge.test.js
 *
 * Verifies the isolated compatibility layer that projects the
 * personalization asset library into the shapes Render Studio and
 * CineGen already consume. No studio internals are imported.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

/** State we want the stores to expose. */
let libraryState = {};
let currentClient = null;

vi.mock('../assetLibraryStore.js', () => ({
  assetLibraryStore: { getState: () => libraryState },
  useAssetLibraryStore: (sel) => (sel ? sel(libraryState) : libraryState),
}));

vi.mock('../clientProfileStore.js', () => ({
  clientProfileStore: { getCurrent: () => currentClient },
}));

const {
  resolveForRenderStudio,
  resolveForCineGen,
  callCineGenWithPersonalization,
  hasPersonalizationData,
} = await import('../studioBridge.js');

function makeLibrary(overrides = {}) {
  return {
    identities: [], primaryIdentity: null,
    logos: [], primaryLogo: null,
    products: [], brandReferences: [],
    firstFrame: null, lastFrame: null,
    ctaGraphic: null, audio: [], savedReferences: [],
    ...overrides,
  };
}

beforeEach(() => {
  libraryState = makeLibrary();
  currentClient = null;
});

describe('neutral behaviour with no personalization data', () => {
  it('Render Studio gets a no-op payload', () => {
    const r = resolveForRenderStudio();
    expect(r.referenceImages).toEqual([]);
    expect(r.promptPrefix).toBe('');
    expect(r.clientProfile).toBeNull();
    expect(r.assetIds).toEqual([]);
  });

  it('CineGen gets a no-op payload', () => {
    const c = resolveForCineGen({});
    expect(c.image_url).toBeNull();
    expect(c.images_list).toEqual([]);
    expect(c.clientProfile).toBeNull();
  });

  it('hasPersonalizationData is false', () => {
    expect(hasPersonalizationData()).toBe(false);
  });
});

describe('Render Studio projection', () => {
  it('collects reference images primaries-first', () => {
    libraryState = makeLibrary({
      logos: [
        { id: 'l2', url: 'https://x.test/l2.png', isPrimary: false },
        { id: 'l1', url: 'https://x.test/l1.png', isPrimary: true },
      ],
    });
    const r = resolveForRenderStudio();
    expect(r.referenceImages[0]).toMatchObject({ url: 'https://x.test/l1.png', role: 'logo', assetId: 'l1' });
    expect(r.referenceImages).toHaveLength(2);
    expect(r.assetIds).toEqual(['l1', 'l2']);
  });

  it('caps reference images at maxImages', () => {
    libraryState = makeLibrary({
      products: Array.from({ length: 20 }, (_, i) => ({
        id: `p${i}`, url: `https://x.test/p${i}.png`, isPrimary: false,
      })),
    });
    expect(resolveForRenderStudio({ maxImages: 3 }).referenceImages).toHaveLength(3);
    expect(resolveForRenderStudio().referenceImages).toHaveLength(6); // default cap
  });

  it('exposes lastFrameUrl separately', () => {
    libraryState = makeLibrary({ lastFrame: { id: 'lf', url: 'https://x.test/lf.png' } });
    expect(resolveForRenderStudio().lastFrameUrl).toBe('https://x.test/lf.png');
  });

  it('builds a prompt prefix from the client profile', () => {
    currentClient = {
      businessName: 'Acme Roofing',
      industry: 'roofing',
      productService: 'premium shingles',
      offer: '20% off',
      brandDescription: 'trusted local contractor',
    };
    const prefix = resolveForRenderStudio().promptPrefix;
    expect(prefix).toContain('Acme Roofing');
    expect(prefix).toContain('roofing');
    expect(prefix).toContain('premium shingles');
    expect(prefix).toContain('20% off');
  });

  it('dedupes identical URLs across roles', () => {
    libraryState = makeLibrary({
      logos: [{ id: 'l', url: 'https://x.test/same.png', isPrimary: true }],
      products: [{ id: 'p', url: 'https://x.test/same.png', isPrimary: true }],
    });
    const urls = resolveForRenderStudio().referenceImages.map((r) => r.url);
    expect(urls).toEqual(['https://x.test/same.png']);
  });

  it('skips non-http asset URLs', () => {
    libraryState = makeLibrary({
      logos: [{ id: 'l', url: 'data:image/png;base64,AAA', isPrimary: true }],
    });
    expect(resolveForRenderStudio().referenceImages).toEqual([]);
  });

  it('prefers uploadedUrl over a transient provider url', () => {
    libraryState = makeLibrary({
      logos: [{ id: 'l', url: 'https://muapi.test/tmp.png', uploadedUrl: 'https://supa.test/l.png', isPrimary: true }],
    });
    expect(resolveForRenderStudio().referenceImages[0].url).toBe('https://supa.test/l.png');
  });
});

describe('CineGen projection', () => {
  it('uses the MuAPI key names the cinegen adapter forwards', () => {
    libraryState = makeLibrary({
      logos: [{ id: 'l', url: 'https://x.test/l.png', isPrimary: true }],
      products: [
        { id: 'p1', url: 'https://x.test/p1.png', isPrimary: false },
        { id: 'p2', url: 'https://x.test/p2.png', isPrimary: true },
      ],
    });
    const c = resolveForCineGen({ aspect_ratio: '16:9' });
    expect(Object.keys(c)).toEqual(expect.arrayContaining(['image_url', 'images_list', 'promptSuffix', 'aspectRatio']));
    expect(c.image_url).toBeTruthy();
    expect(c.aspectRatio).toBe('16:9');
    expect(c.images_list.length).toBeGreaterThan(0);
  });

  it('appends CTA copy from the client profile', () => {
    currentClient = { callToAction: 'Call now', ctaHeadline: 'Save 20%', phone: '555-1234', website: 'acme.test' };
    const suffix = resolveForCineGen({}).promptSuffix;
    expect(suffix).toContain('Call now');
    expect(suffix).toContain('Save 20%');
    expect(suffix).toContain('555-1234');
    expect(suffix).toContain('acme.test');
  });
});

describe('callCineGenWithPersonalization', () => {
  it('merges personalization into the studio call without editing the adapter', async () => {
    const received = [];
    const fakeAdapter = {
      generateElement: vi.fn(async (params) => { received.push(params); return { success: true }; }),
    };
    libraryState = makeLibrary({ logos: [{ id: 'l', url: 'https://x.test/l.png', isPrimary: true }] });

    const out = await callCineGenWithPersonalization(fakeAdapter, 'generateElement', { prompt: 'a logo' });

    expect(out).toEqual({ success: true });
    expect(received[0].image_url).toBe('https://x.test/l.png');
    expect(received[0].prompt).toBe('a logo');
  });

  it('studio-supplied image_url wins (never clobbers studio intent)', async () => {
    const received = [];
    const fakeAdapter = { generateElement: vi.fn(async (p) => { received.push(p); return {}; }) };
    libraryState = makeLibrary({ logos: [{ id: 'l', url: 'https://x.test/l.png', isPrimary: true }] });

    await callCineGenWithPersonalization(fakeAdapter, 'generateElement', {
      prompt: 'x', image_url: 'https://studio.test/own.png',
    });

    expect(received[0].image_url).toBe('https://studio.test/own.png');
  });

  it('does not double-append the prompt suffix', async () => {
    const received = [];
    const fakeAdapter = { generateElement: vi.fn(async (p) => { received.push(p); return {}; }) };
    currentClient = { callToAction: 'Call now' };

    await callCineGenWithPersonalization(fakeAdapter, 'generateElement', { prompt: 'base' });
    // Matches buildPromptSuffix: `Include the call to action: "<cta>".`
    expect(received[0].prompt).toBe('base Include the call to action: "Call now".');

    await callCineGenWithPersonalization(fakeAdapter, 'generateElement', { prompt: received[0].prompt });
    expect(received[1].prompt).toBe(received[0].prompt);
  });

  it('throws clearly when the method does not exist', async () => {
    await expect(
      callCineGenWithPersonalization({}, 'nope', {}),
    ).rejects.toThrow(/not a function/);
  });
});

describe('hasPersonalizationData', () => {
  it('is true from assets alone', () => {
    libraryState = makeLibrary({ logos: [{ id: 'l', url: 'https://x.test/l.png', isPrimary: true }] });
    expect(hasPersonalizationData()).toBe(true);
  });

  it('is true from a client profile alone', () => {
    currentClient = { businessName: 'Acme' };
    expect(hasPersonalizationData()).toBe(true);
  });

  it('is false when both are empty', () => {
    expect(hasPersonalizationData()).toBe(false);
  });
});
