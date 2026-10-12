/**
 * renderStudioPersonalization.test.js
 *
 * Regression tests for the Render Studio personalization bridge
 * (`../studioBridge.js`): `mergeRenderPersonalization`,
 * `applyRenderStudioPersonalization` and `buildRenderStudioOverlays`.
 *
 * WHAT THE BRIDGE MAY PROMISE IS BOUNDED BY WHAT THE RENDER ACCEPTS.
 * `captureRealVideo()` (src/components/RenderPage.js:827) composites exactly
 * one image per frame — the source video, drawn once at `:1051` — has no
 * `fillText`/`strokeText` anywhere in the file, and its only inputs are
 * `videoUrl`, `action`, `timeRange`, `effects{brightness,contrast}`, `preset`
 * and `settings{format,frameRate,quality,aspectRatio,contain,duration,
 * validateDecode}`. None of those can carry a client brand.
 *
 * These tests therefore assert BOTH halves of the contract:
 *   - nothing is fabricated onto a parameter the render ignores,
 *   - every studio-supplied value survives the merge untouched.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/** Asset library state the mocked store exposes. */
let libraryState = {};
/** Current client profile the mocked store exposes. */
let currentClient = null;
/** When true, reading the asset library throws (a broken personalization store). */
let libraryReadThrows = false;

vi.mock('../assetLibraryStore.js', () => ({
  assetLibraryStore: {
    getState: () => {
      if (libraryReadThrows) throw new Error('asset library unavailable');
      return libraryState;
    },
  },
  useAssetLibraryStore: (sel) => (sel ? sel(libraryState) : libraryState),
}));

vi.mock('../clientProfileStore.js', () => ({
  clientProfileStore: { getCurrent: () => currentClient },
}));

const {
  applyRenderStudioPersonalization,
  buildRenderStudioOverlays,
  mergeRenderPersonalization,
  resolveForRenderStudio,
  hasPersonalizationData,
  RENDER_STUDIO_OVERLAY_SUPPORT,
  RENDER_STUDIO_OVERLAY_GAP,
  RENDER_STUDIO_SETTINGS_KEYS,
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

/** Client profile + logo + product + brand reference, all populated. */
function populatePersonalization() {
  libraryState = makeLibrary({
    logos: [{ id: 'logo-1', url: 'https://cdn.test/logo.png', role: 'logo', isPrimary: true }],
    products: [
      { id: 'prod-1', url: 'https://cdn.test/product.png', role: 'product_reference', isPrimary: true },
      { id: 'prod-2', url: 'https://cdn.test/product-2.png', role: 'product_reference', isPrimary: false },
    ],
    brandReferences: [
      { id: 'brand-1', url: 'https://cdn.test/brand.png', role: 'brand_reference', isPrimary: true },
    ],
  });
  currentClient = {
    id: 'client-1',
    businessName: 'Acme Roofing',
    industry: 'roofing',
    productService: 'premium shingles',
    offer: '20% off',
    ctaHeadline: 'Save 20%',
    callToAction: 'Call now',
    website: 'acme.test',
    phone: '555-1234',
    brandDescription: 'trusted local contractor',
  };
}

/** A realistic `captureRealVideo` payload, exactly as Render Studio builds it. */
function studioPayload(overrides = {}) {
  return {
    videoUrl: 'https://cdn.test/source.mp4',
    action: 'export-video',
    settings: { format: 'mp4', frameRate: '24', quality: 82 },
    preset: 'Film Trailer Punch',
    onProgress: () => {},
    ...overrides,
  };
}

beforeEach(() => {
  libraryState = makeLibrary();
  currentClient = null;
  libraryReadThrows = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('no personalization data', () => {
  it('reports that personalization is empty', () => {
    expect(hasPersonalizationData()).toBe(false);
  });

  it('returns the payload UNCHANGED — same reference, byte-identical parameters', () => {
    const payload = studioPayload();
    expect(applyRenderStudioPersonalization(payload)).toBe(payload);
  });

  it('merges to a deep-equal payload', () => {
    const payload = studioPayload();
    expect(mergeRenderPersonalization(payload)).toEqual(payload);
  });

  it('projects no overlays', () => {
    expect(buildRenderStudioOverlays()).toEqual({});
    expect(buildRenderStudioOverlays({ settings: { format: 'webm' } })).toEqual({});
  });
});

describe('a client profile + logo + product + brand references', () => {
  beforeEach(populatePersonalization);

  it('resolves the personalization the render would need', () => {
    const p = resolveForRenderStudio();
    expect(hasPersonalizationData()).toBe(true);
    // collect() orders identities → logos → products → brand references,
    // primaries first, so the logo is the FIRST reference image.
    expect(p.referenceImages.map((r) => r.role)).toEqual([
      'logo', 'product_reference', 'product_reference', 'brand_reference',
    ]);
    expect(p.referenceImages[0]).toMatchObject({
      url: 'https://cdn.test/logo.png', role: 'logo', assetId: 'logo-1',
    });
    expect(p.assetIds).toEqual(['logo-1', 'prod-1', 'prod-2', 'brand-1']);
    expect(p.promptPrefix).toContain('Acme Roofing');
  });

  it('projects NO overlay field, because the render has no parameter for any of them', () => {
    expect(buildRenderStudioOverlays({ settings: { format: 'mp4' } })).toEqual({});
  });

  it('does not fabricate a reference-image parameter: the first reference image maps to none', () => {
    const payload = studioPayload();
    const merged = mergeRenderPersonalization(payload, { settings: payload.settings });

    // No key was added, removed or rewritten.
    expect(Object.keys(merged)).toEqual(Object.keys(payload));
    expect(merged).toEqual(payload);
    // None of the personalization image URLs leaked into the payload under
    // any key — there is no render parameter for them to land in.
    const urls = resolveForRenderStudio().referenceImages.map((r) => r.url);
    const serialized = JSON.stringify(merged);
    urls.forEach((url) => expect(serialized).not.toContain(url));
  });

  it('omits promptPrefix / client-profile text — the capture path accepts no text parameter', () => {
    const payload = studioPayload();
    const merged = mergeRenderPersonalization(payload);

    // The text IS produced by the projection layer…
    expect(resolveForRenderStudio().promptPrefix).toContain('Acme Roofing');
    // …but the render pipeline declares no text/prompt support, so it is not
    // forced into the payload at the root or inside settings.
    expect(RENDER_STUDIO_OVERLAY_SUPPORT.prompt).toBe(false);
    expect(merged.prompt).toBeUndefined();
    expect(merged.textOverlay).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(merged.settings, 'prompt')).toBe(false);
  });

  it('omits branding and the logo — no logo/watermark/overlay parameter exists', () => {
    const merged = mergeRenderPersonalization(studioPayload());
    ['logoUrl', 'branding', 'lastFrameUrl', 'referenceImages', 'overlays', 'watermark'].forEach((key) => {
      expect(merged[key]).toBeUndefined();
    });
  });

  it('never mutates the input payload, even fully populated', () => {
    const onProgress = () => {};
    const payload = studioPayload({ onProgress });
    Object.freeze(payload);
    Object.freeze(payload.settings);

    expect(() => mergeRenderPersonalization(payload)).not.toThrow();
    expect(payload).toEqual(studioPayload({ onProgress }));
    expect(payload.settings).toEqual({ format: 'mp4', frameRate: '24', quality: 82 });
  });

  it('records the gap precisely', () => {
    const keys = Object.keys(RENDER_STUDIO_OVERLAY_SUPPORT);
    expect(keys).toEqual([
      'referenceImages', 'logoUrl', 'lastFrameUrl', 'textOverlay', 'prompt', 'branding',
    ]);
    // Nothing is supported today, so the gap lists all of them.
    expect(RENDER_STUDIO_OVERLAY_GAP.supported).toEqual([]);
    expect(RENDER_STUDIO_OVERLAY_GAP.missing).toEqual(keys);
    expect(RENDER_STUDIO_OVERLAY_GAP.evidence).toMatch(/drawImage/);
    expect(RENDER_STUDIO_OVERLAY_GAP.unblock).toMatch(/drawFrame/);
  });
});

describe('studio-supplied values always win', () => {
  beforeEach(populatePersonalization);

  it('keeps every parameter the render pipeline actually accepts', () => {
    const onProgress = () => {};
    const payload = {
      videoUrl: 'https://studio.test/own.mp4',
      action: 'trailer-cut',
      settings: { format: 'h265', frameRate: '60', quality: 95, duration: 12, validateDecode: true },
      timeRange: { start: 2, end: 9 },
      effects: { brightness: 1.25, contrast: 0.8 },
      preset: 'Luxury Brand Grade',
      onProgress,
    };
    const merged = mergeRenderPersonalization(payload, { settings: payload.settings });
    expect(merged).toEqual(payload);
    expect(merged.settings).toEqual(payload.settings);
    expect(merged.onProgress).toBe(onProgress);
  });

  it('keeps a studio value for every contested overlay key, at the payload root', () => {
    const payload = studioPayload();
    Object.keys(RENDER_STUDIO_OVERLAY_SUPPORT).forEach((key) => {
      payload[key] = `studio-${key}`;
    });
    const merged = mergeRenderPersonalization(payload, { settings: payload.settings });

    Object.keys(RENDER_STUDIO_OVERLAY_SUPPORT).forEach((key) => {
      expect(merged[key]).toBe(`studio-${key}`);
    });
  });

  it('keeps a studio value that lives inside settings', () => {
    const payload = studioPayload({
      settings: { format: 'mp4', logoUrl: 'https://studio.test/own-logo.png' },
    });
    const merged = mergeRenderPersonalization(payload, { settings: payload.settings });
    expect(merged.settings.logoUrl).toBe('https://studio.test/own-logo.png');
    expect(merged.settings).toEqual(payload.settings);
  });
});

describe('the verified render parameter set', () => {
  it('matches the settings keys captureRealVideo actually reads', () => {
    // If the render pipeline gains or loses a settings key, this fails and
    // forces the projection to be re-audited against the real pipeline.
    expect(RENDER_STUDIO_SETTINGS_KEYS).toEqual([
      'format', 'frameRate', 'quality', 'aspectRatio', 'contain', 'duration', 'validateDecode',
    ]);
  });
});

describe('a personalization failure can never break a render', () => {
  beforeEach(populatePersonalization);

  it('falls back to the original payload when the personalization resolve throws', () => {
    libraryReadThrows = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const payload = studioPayload();

    const merged = mergeRenderPersonalization(payload, { settings: payload.settings });

    expect(merged).toEqual(payload);
    expect(merged).not.toBe(payload);
    expect(warn).toHaveBeenCalled();
  });

  it('returns the original payload BY REFERENCE when the bridge itself throws', () => {
    libraryReadThrows = true;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const payload = studioPayload();

    expect(applyRenderStudioPersonalization(payload)).toBe(payload);
  });

  it('tolerates a missing payload', () => {
    expect(mergeRenderPersonalization(null)).toEqual({});
    expect(mergeRenderPersonalization(undefined)).toEqual({});
    expect(applyRenderStudioPersonalization(undefined)).toEqual({});
  });
});
