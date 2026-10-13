/**
 * renderStudioOverlay.test.js
 *
 * Focused regression suite for the personalized overlay compositing in the
 * Render Studio export path:
 *
 *   - `src/lib/editor/renderHelpers.js` — the two-phase overlay contract
 *     (decode once at setup, draw synchronously per frame) and the
 *     resolution-independent geometry that keeps overlays inside the VISIBLE
 *     video area when `settings.contain` letterboxes.
 *   - `src/components/personalize/studioBridge.js` — the projection of the
 *     personalization library (logo / brand reference / business name / call
 *     to action) into real `overlays[]` descriptors, with studio-supplied
 *     overlays always winning.
 *
 * The stores below are mocked in their PRODUCTION shapes on purpose:
 *   - `assetLibraryStore.getState()` returns `{ assets, removed, hydrated }`
 *     with a FLAT `assets` array whose records each carry a `role`.
 *   - `clientProfileStore` exposes `getState()` / `getCurrentClientId()` /
 *     `getClientById()` and has NO `getCurrent()`.
 * Nothing here is allowed to pass only because a mock is friendlier than the
 * real store.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  normalizeOverlayDescriptor,
  resolveOverlayRect,
  shouldCompositeOverlays,
  prepareRenderOverlays,
  drawOverlays,
  computeContainRect,
  computeCoverRect,
} from '../../../lib/editor/renderHelpers.js';

/** Production asset-library state: flat `assets` array keyed by `role`. */
let libraryState = { assets: [], removed: [], hydrated: true };
/** Production client state: sorted `clients`, `currentClientId` (often null). */
let clientState = { clients: [], currentClientId: null, hydrated: true };

vi.mock('../assetLibraryStore.js', () => ({
  assetLibraryStore: { getState: () => libraryState },
  useAssetLibraryStore: (sel) => (sel ? sel(libraryState) : libraryState),
}));

vi.mock('../clientProfileStore.js', () => ({
  clientProfileStore: {
    // Deliberately NO getCurrent(): the real store does not have one.
    getState: () => clientState,
    getCurrentClientId: () => clientState.currentClientId,
    getClientById: (id) => clientState.clients.find((c) => c && c.id === id) || null,
  },
}));

const {
  buildPersonalizationOverlays,
  buildRenderStudioOverlays,
  mergeRenderPersonalization,
  applyRenderStudioPersonalization,
  resolveForRenderStudio,
  toBucketedAssetLibrary,
  RENDER_STUDIO_OVERLAY_SUPPORT,
  RENDER_STUDIO_OVERLAY_SUPPORT_NOTES,
  RENDER_STUDIO_OVERLAY_IDS,
  RENDER_STUDIO_OVERLAY_PARAM,
  RENDER_STUDIO_FRAME_SUPPORT,
  RENDER_STUDIO_SETTINGS_KEYS,
} = await import('../studioBridge.js');

/** Flat production asset record (the shape assetLibraryStore persists). */
function asset(id, role, url, isPrimary = false) {
  return { id, role, url, name: id, isPrimary, createdAt: '2026-01-01T00:00:00.000Z' };
}

/** A full personalization state: primary logo + product + brand + client. */
function populatePersonalization(overrides = {}) {
  libraryState = {
    assets: [
      asset('logo-2', 'logo', 'https://cdn.test/logo-secondary.png', false),
      asset('logo-1', 'logo', 'https://cdn.test/logo.png', true),
      asset('prod-1', 'product_reference', 'https://cdn.test/product.png', true),
      asset('brand-1', 'brand_reference', 'https://cdn.test/brand.png', true),
    ],
    removed: [],
    hydrated: true,
    ...overrides,
  };
  clientState = {
    clients: [{
      id: 'client-1',
      audience: 'me',
      name: 'Acme Roofing',
      businessName: 'Acme Roofing',
      industry: 'roofing',
      productService: 'premium shingles',
      offer: '20% off',
      ctaHeadline: 'Save 20%',
      callToAction: 'Call now for a free quote',
      phone: '555-1234',
      website: 'acme.test',
      brandDescription: 'trusted local contractor',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    }],
    // Production reality: addClient() never sets currentClientId.
    currentClientId: null,
    hydrated: true,
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

/** A canvas 2D context recorder: call order is the assertion surface. */
function makeFakeCtx() {
  const calls = [];
  return {
    calls,
    globalAlpha: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillStyle: '',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
    save() { calls.push({ op: 'save' }); },
    restore() { calls.push({ op: 'restore' }); },
    drawImage(...args) { calls.push({ op: 'drawImage', args }); },
    fillText(...args) { calls.push({ op: 'fillText', args }); },
    measureText: (text) => ({ width: String(text).length * 8 }),
  };
}

/** Image stand-in that resolves onload asynchronously (like a real decode). */
class FakeImage {
  constructor() {
    this.naturalWidth = 400;
    this.naturalHeight = 200;
    this.width = 400;
    this.height = 200;
    this.srcValue = '';
    this.onload = null;
    this.onerror = null;
    FakeImage.constructed.push(this);
  }

  set src(value) {
    this.srcValue = value;
    setTimeout(() => {
      if (String(value).includes('broken')) {
        if (this.onerror) this.onerror();
      } else if (this.onload) {
        this.onload();
      }
    }, 0);
  }

  get src() { return this.srcValue; }
}
FakeImage.constructed = [];

beforeEach(() => {
  libraryState = { assets: [], removed: [], hydrated: true };
  clientState = { clients: [], currentClientId: null, hydrated: true };
  FakeImage.constructed = [];
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. LOGO OVERLAY
 * ═══════════════════════════════════════════════════════════════════════════ */
describe('logo overlay', () => {
  beforeEach(populatePersonalization);

  it('derives from the PRIMARY logo asset with correct normalized geometry', () => {
    const overlays = buildPersonalizationOverlays();
    const logo = overlays.find((o) => o.id === RENDER_STUDIO_OVERLAY_IDS.logo);

    expect(logo).toBeTruthy();
    expect(logo).toMatchObject({
      type: 'image',
      url: 'https://cdn.test/logo.png',
      source: 'personalization',
      x: 0.84,
      y: 0.04,
      width: 0.12,
      opacity: 0.9,
    });
    // Geometry is a fraction of the canvas, never a pixel value.
    Object.values(logo).forEach((value) => {
      if (typeof value === 'number' && value !== 0) {
        expect(value).toBeLessThanOrEqual(1);
      }
    });
  });

  it('prefers the primary logo when several logos exist', () => {
    const overlays = buildPersonalizationOverlays();
    const logos = overlays.filter((o) => o.type === 'image');
    expect(logos).toHaveLength(1);
    expect(logos[0].url).toBe('https://cdn.test/logo.png');
  });

  it('keeps the logo aspect ratio (height is explicit but null = preserve)', () => {
    const logo = buildPersonalizationOverlays().find((o) => o.type === 'image');
    expect(logo).toHaveProperty('height', null);

    const rect = resolveOverlayRect(logo, 1920, 1080, undefined, 0.5);
    // 12% of 1920 = 230.4px wide; a 2:1 image is 115.2px tall.
    expect(rect.width).toBeCloseTo(230.4, 5);
    expect(rect.height).toBeCloseTo(115.2, 5);
  });

  it('is the first overlay, so branding sits above the business name', () => {
    expect(buildPersonalizationOverlays().map((o) => o.id)).toEqual([
      RENDER_STUDIO_OVERLAY_IDS.logo,
      RENDER_STUDIO_OVERLAY_IDS.businessName,
      RENDER_STUDIO_OVERLAY_IDS.callToAction,
    ]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. TEXT OVERLAYS
 * ═══════════════════════════════════════════════════════════════════════════ */
describe('text overlays', () => {
  beforeEach(populatePersonalization);

  it('derives from businessName + callToAction', () => {
    const overlays = buildPersonalizationOverlays();
    const texts = overlays.filter((o) => o.type === 'text');

    expect(texts.map((o) => o.text)).toEqual(['Acme Roofing', 'Call now for a free quote']);
    texts.forEach((overlay) => {
      expect(overlay).toMatchObject({
        source: 'personalization',
        x: 0.5,
        align: 'center',
        color: '#ffffff',
      });
      // "readable size": a real fraction of the canvas height, not a pixel value.
      expect(overlay.fontSize).toBeGreaterThan(0.02);
      expect(overlay.fontSize).toBeLessThanOrEqual(0.1);
      expect(overlay.maxWidth).toBeLessThanOrEqual(1);
      // Contrasting, but never fully transparent.
      expect(overlay.opacity).toBeGreaterThanOrEqual(0.9);
      expect(overlay.opacity).toBeLessThanOrEqual(1);
    });
  });

  it('stacks business name above the call to action', () => {
    const texts = buildPersonalizationOverlays().filter((o) => o.type === 'text');
    expect(texts[0].y).toBeLessThan(texts[1].y);
    expect(texts[1].fontSize).toBeLessThan(texts[0].fontSize);
  });

  it('keeps the anchors inside the visible area for a 9:16 canvas', () => {
    const contain = computeContainRect(1920, 1080, 1080, 1920);
    const visible = { x: contain.dx, y: contain.dy, width: contain.dw, height: contain.dh };
    const texts = buildPersonalizationOverlays().filter((o) => o.type === 'text');

    texts.forEach((overlay) => {
      const rect = resolveOverlayRect(overlay, 1080, 1920, visible);
      expect(rect.x).toBeGreaterThanOrEqual(visible.x);
      expect(rect.x).toBeLessThanOrEqual(visible.x + visible.width);
      expect(rect.y).toBeGreaterThanOrEqual(visible.y);
      // The first text line must not run past the bottom of the visible band.
      expect(rect.y + rect.fontSize * rect.lineHeight)
        .toBeLessThanOrEqual(visible.y + visible.height);
    });
  });

  it('omits text overlays when the client profile has no name or CTA', () => {
    clientState = {
      clients: [{ id: 'c2', businessName: '', callToAction: '' }],
      currentClientId: null,
      hydrated: true,
    };
    expect(buildPersonalizationOverlays().filter((o) => o.type === 'text')).toEqual([]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. STUDIO-SUPPLIED OVERLAYS WIN
 * ═══════════════════════════════════════════════════════════════════════════ */
describe('studio-supplied overlays always win', () => {
  beforeEach(populatePersonalization);

  it('never clobbers an explicit studio overlay, and fills only the rest', () => {
    const payload = studioPayload({
      overlays: [{
        id: RENDER_STUDIO_OVERLAY_IDS.logo,
        type: 'image',
        url: 'https://studio.test/own-logo.png',
        x: 0.5, y: 0.5, width: 0.3, opacity: 1,
      }],
    });
    const merged = mergeRenderPersonalization(payload);
    const overlays = merged.overlays;

    // The studio overlay survives verbatim…
    expect(overlays[0]).toEqual(payload.overlays[0]);
    expect(overlays.find((o) => o.id === RENDER_STUDIO_OVERLAY_IDS.logo).url)
      .toBe('https://studio.test/own-logo.png');
    // …and personalization only adds the ids the studio did not set.
    expect(overlays.map((o) => o.id)).toEqual([
      RENDER_STUDIO_OVERLAY_IDS.logo,
      RENDER_STUDIO_OVERLAY_IDS.businessName,
      RENDER_STUDIO_OVERLAY_IDS.callToAction,
    ]);
  });

  it('leaves the payload untouched when every personalization id is taken', () => {
    const studioOverlays = buildPersonalizationOverlays();
    const payload = studioPayload({ overlays: studioOverlays });
    expect(mergeRenderPersonalization(payload)).toEqual(payload);
  });

  it('respects a studio overlays value that is not an array', () => {
    const payload = studioPayload({ overlays: 'studio-sentinel' });
    const merged = mergeRenderPersonalization(payload);
    expect(merged.overlays).toBe('studio-sentinel');
    expect(merged).toEqual(payload);
  });

  it('respects a studio overlays value that lives inside settings', () => {
    const payload = studioPayload({ settings: { format: 'mp4', overlays: 'studio-settings' } });
    const merged = mergeRenderPersonalization(payload);
    expect(merged.overlays).toBeUndefined();
    expect(merged.settings).toEqual(payload.settings);
  });

  it('never mutates the studio payload', () => {
    const onProgress = () => {};
    const payload = studioPayload({ onProgress });
    const snapshot = studioPayload({ onProgress });
    Object.freeze(payload);
    Object.freeze(payload.settings);
    expect(() => mergeRenderPersonalization(payload)).not.toThrow();
    expect(payload).toEqual(snapshot);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. EMPTY PERSONALIZATION IS A NO-OP
 * ═══════════════════════════════════════════════════════════════════════════ */
describe('empty personalization', () => {
  it('projects no overlays at all', () => {
    expect(buildPersonalizationOverlays()).toEqual([]);
    expect(buildRenderStudioOverlays()).toEqual({});
    expect(buildRenderStudioOverlays({ settings: { format: 'mp4' } })).toEqual({});
  });

  it('returns the capture payload byte-identical (same reference)', () => {
    const payload = studioPayload();
    expect(applyRenderStudioPersonalization(payload)).toBe(payload);
    expect(mergeRenderPersonalization(payload)).toEqual(payload);
  });

  it('still carries a resolve-for-render empty slice', () => {
    expect(resolveForRenderStudio().referenceImages).toEqual([]);
    expect(resolveForRenderStudio().clientProfile).toBeNull();
    expect(resolveForRenderStudio().lastFrameUrl).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. THE FRAME LOOP: base frame first, failed image skipped, never throws
 * ═══════════════════════════════════════════════════════════════════════════ */
describe('drawOverlays frame loop', () => {
  beforeEach(populatePersonalization);

  it('draws overlays AFTER the base frame', async () => {
    const ctx = makeFakeCtx();
    // The base frame: the one existing drawImage(video, sourceRect…) call.
    ctx.drawImage({ __sourceVideo: true }, 0, 0, 1920, 1080, 0, 0, 1920, 1080);

    const prepared = await prepareRenderOverlays(
      buildPersonalizationOverlays(),
      { ImageCtor: FakeImage },
    );
    const drawn = drawOverlays(ctx, prepared, { width: 1920, height: 1080 });

    expect(drawn).toBe(3);
    const ops = ctx.calls.map((c) => c.op);
    expect(ops[0]).toBe('drawImage'); // base frame
    // …then the logo image, then the two text overlays, all after it.
    expect(ops.slice(1)).toEqual([
      'save', 'drawImage', 'restore',
      'save', 'fillText', 'restore',
      'save', 'fillText', 'restore',
    ]);

    const baseCall = ctx.calls[0];
    const logoCall = ctx.calls.find((c) => c.op === 'drawImage' && c !== baseCall);
    expect(logoCall.args[0]).toBeInstanceOf(FakeImage);
    // Logo geometry: 12% of 1920 wide, top-right area of the canvas.
    expect(logoCall.args[1]).toBeCloseTo(0.84 * 1920, 5);
    expect(logoCall.args[3]).toBeCloseTo(0.12 * 1920, 5);
  });

  it('is synchronous — no await, no Image and no network inside the frame loop', async () => {
    const prepared = await prepareRenderOverlays(
      buildPersonalizationOverlays(),
      { ImageCtor: FakeImage },
    );
    const ctx = makeFakeCtx();

    const before = FakeImage.constructed.length;
    const result = drawOverlays(ctx, prepared, { width: 1920, height: 1080 });

    expect(typeof result).toBe('number');
    expect(FakeImage.constructed.length).toBe(before);
  });

  it('skips a failed image load without throwing', async () => {
    const ctx = makeFakeCtx();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const prepared = await prepareRenderOverlays([
      { id: 'ok', type: 'image', url: 'https://cdn.test/logo.png', x: 0.84, y: 0.04, width: 0.12 },
      { id: 'broken', type: 'image', url: 'https://cdn.test/broken.png', x: 0.04, y: 0.04, width: 0.12 },
      { id: 'text', type: 'text', text: 'Acme Roofing', x: 0.5, y: 0.8 },
    ], { ImageCtor: FakeImage });

    expect(prepared.find((o) => o.id === 'broken')).toMatchObject({ ready: false, image: null });
    expect(prepared.find((o) => o.id === 'ok')).toMatchObject({ ready: true });
    expect(prepared.find((o) => o.id === 'ok').image).toBeInstanceOf(FakeImage);

    let drawn;
    expect(() => { drawn = drawOverlays(ctx, prepared, { width: 1920, height: 1080 }); }).not.toThrow();
    expect(drawn).toBe(2); // the loadable image + the text overlay
    expect(ctx.calls.filter((c) => c.op === 'drawImage')).toHaveLength(1);
    expect(warn).toHaveBeenCalled();

    // Even an un-prepared image descriptor must be skipped, not thrown on.
    expect(drawOverlays(ctx, [{ id: 'raw', type: 'image', url: 'https://cdn.test/x.png' }], { width: 1920, height: 1080 })).toBe(0);
    warn.mockRestore();
  });

  it('never lets a throwing context break the render', () => {
    const hostile = {
      save() { throw new Error('context lost'); },
      restore() { throw new Error('context lost'); },
      drawImage() { throw new Error('context lost'); },
      fillText() { throw new Error('context lost'); },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => drawOverlays(hostile, [
      { id: 'i', type: 'image', url: 'https://x/i.png', image: {}, x: 0.5, y: 0.5, width: 0.1 },
      { id: 't', type: 'text', text: 'Hi', x: 0.5, y: 0.5 },
    ], { width: 1920, height: 1080 })).not.toThrow();
    expect(drawOverlays(null, [{ id: 't', type: 'text', text: 'Hi' }])).toBe(0);
    expect(drawOverlays(hostile, 'not-an-array')).toBe(0);
    warn.mockRestore();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. CONTAIN LETTERBOXING
 * ═══════════════════════════════════════════════════════════════════════════ */
describe('overlays respect the visible video area', () => {
  beforeEach(populatePersonalization);

  it('positions every overlay inside the letterboxed video, not the bars', () => {
    // 16:9 source into a 9:16 canvas with contain: true → pillarbox top/bottom.
    const contain = computeContainRect(1920, 1080, 1080, 1920);
    expect(contain.dy).toBeGreaterThan(0);
    const visible = { x: contain.dx, y: contain.dy, width: contain.dw, height: contain.dh };

    const overlays = buildPersonalizationOverlays();
    overlays.forEach((overlay) => {
      const rect = resolveOverlayRect(
        overlay,
        1080,
        1920,
        visible,
        overlayImageAspectFor(overlay),
      );
      expect(rect).toBeTruthy();
      // Text boxes are anchored per `align`; image boxes are left/top anchored.
      const left = rect.type === 'text'
        ? (rect.align === 'left'
          ? rect.x
          : (rect.align === 'right' ? rect.x - rect.width : rect.x - rect.width / 2))
        : rect.x;
      expect(left).toBeGreaterThanOrEqual(visible.x - 0.001);
      expect(left + rect.width).toBeLessThanOrEqual(visible.x + visible.width + 0.001);
      expect(rect.y).toBeGreaterThanOrEqual(visible.y - 0.001);
      expect(rect.y + rect.height).toBeLessThanOrEqual(visible.y + visible.height + 0.001);
    });
  });

  it('clamps an overlay that would otherwise hang off the visible area', () => {
    const contain = computeContainRect(1920, 1080, 1080, 1920);
    const visible = { x: contain.dx, y: contain.dy, width: contain.dw, height: contain.dh };
    const rect = resolveOverlayRect(
      { type: 'image', url: 'https://cdn.test/l.png', x: 0.99, y: 0.99, width: 0.3, height: 0.3 },
      1080, 1920, visible, 1,
    );
    expect(rect.x + rect.width).toBeLessThanOrEqual(visible.x + visible.width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(visible.y + visible.height);
  });

  it('falls back to the whole canvas when there is no letterbox (cover)', () => {
    const cover = computeCoverRect(1920, 1080, 1080, 1920);
    expect(cover.dx).toBe(0);
    expect(cover.dy).toBe(0);
    expect(cover.dw).toBe(1080);

    const rect = resolveOverlayRect(
      { type: 'image', url: 'https://cdn.test/l.png', x: 0.84, y: 0.04, width: 0.12 },
      1080, 1920, { x: cover.dx, y: cover.dy, width: cover.dw, height: cover.dh }, 1,
    );
    expect(rect.x).toBeCloseTo(0.84 * 1080, 5);
    expect(rect.y).toBeCloseTo(0.04 * 1920, 5);
  });

  it('uses the full canvas when no visible rect is supplied', () => {
    const rect = resolveOverlayRect(
      { type: 'image', url: 'https://cdn.test/l.png', x: 0.5, y: 0.5, width: 0.25, height: 0.25 },
      1920, 1080, undefined, null,
    );
    expect(rect).toMatchObject({ x: 960, y: 540, width: 480, height: 270 });
  });
});

/** The decoded aspect a real render would have for an image overlay. */
function overlayImageAspectFor(overlay) {
  return overlay && overlay.type === 'image' ? 0.5 : null;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. PRODUCTION STORE SHAPES
 * ═══════════════════════════════════════════════════════════════════════════ */
describe('production store shapes', () => {
  it('buckets the flat `assets` array by role', () => {
    libraryState = {
      assets: [
        asset('a1', 'logo', 'https://cdn.test/logo.png', true),
        asset('a2', 'product_reference', 'https://cdn.test/product.png', false),
        asset('a3', 'brand_reference', 'https://cdn.test/brand.png', true),
        asset('a4', 'first_frame', 'https://cdn.test/first.png', true),
        asset('a5', 'last_frame', 'https://cdn.test/last.png', true),
        asset('a6', 'face_identity', 'https://cdn.test/face.png', true),
      ],
      removed: [],
      hydrated: true,
    };
    const bucketed = toBucketedAssetLibrary(libraryState);

    expect(bucketed.logos.map((a) => a.id)).toEqual(['a1']);
    expect(bucketed.products.map((a) => a.id)).toEqual(['a2']);
    expect(bucketed.brandReferences.map((a) => a.id)).toEqual(['a3']);
    expect(bucketed.identities.map((a) => a.id)).toEqual(['a6']);
    expect(bucketed.firstFrame.id).toBe('a4');
    expect(bucketed.lastFrame.id).toBe('a5');
    expect(bucketed.ctaGraphic).toBeNull();
  });

  it('still accepts an already-bucketed library (no double counting)', () => {
    libraryState = { logos: [{ id: 'l1', url: 'https://cdn.test/l.png', isPrimary: true }], identities: [], products: [], brandReferences: [] };
    const bucketed = toBucketedAssetLibrary(libraryState);
    expect(bucketed.logos.map((a) => a.id)).toEqual(['l1']);
  });

  it('collects reference images from the flat production asset array', () => {
    populatePersonalization();
    const resolved = resolveForRenderStudio();
    expect(resolved.referenceImages.map((r) => r.role))
      .toEqual(['logo', 'logo', 'product_reference', 'brand_reference']);
    // Primaries first: the primary logo leads.
    expect(resolved.referenceImages[0].url).toBe('https://cdn.test/logo.png');
    expect(resolved.lastFrameUrl).toBeNull();
  });

  it('exposes the last frame from a flat asset too', () => {
    populatePersonalization({
      assets: [asset('lf', 'last_frame', 'https://cdn.test/last.png', true)],
    });
    expect(resolveForRenderStudio().lastFrameUrl).toBe('https://cdn.test/last.png');
  });

  it('resolves the client profile with the real store API and no getCurrent()', () => {
    populatePersonalization();
    // currentClientId is null in production: addClient() never sets it, and
    // the hub panel's "Create profile" path calls addClient().
    expect(clientState.currentClientId).toBeNull();

    const resolved = resolveForRenderStudio();
    expect(resolved.clientProfile).toMatchObject({ id: 'client-1', businessName: 'Acme Roofing' });
    // …and the overlay projection sees the same profile.
    expect(buildPersonalizationOverlays().some((o) => o.text === 'Acme Roofing')).toBe(true);
  });

  it('honours an explicit currentClientId over the fallback', () => {
    populatePersonalization();
    clientState = {
      ...clientState,
      currentClientId: 'client-1',
    };
    expect(resolveForRenderStudio().clientProfile).toMatchObject({ id: 'client-1' });
  });

  it('falls back to the most recently updated client when the id is stale', () => {
    clientState = {
      clients: [
        { id: 'old', businessName: 'Old Co', callToAction: 'Old CTA', updatedAt: '2026-01-01T00:00:00.000Z' },
        { id: 'new', businessName: 'New Co', callToAction: 'New CTA', updatedAt: '2026-02-01T00:00:00.000Z' },
      ],
      currentClientId: 'missing-id',
      hydrated: true,
    };
    expect(resolveForRenderStudio().clientProfile).toMatchObject({ id: 'new' });
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. THE GLOBAL SWITCH + HONEST FLAGS
 * ═══════════════════════════════════════════════════════════════════════════ */
describe('the global overlays switch', () => {
  beforeEach(populatePersonalization);

  it('projects nothing when the studio disables overlays', () => {
    expect(buildPersonalizationOverlays({ settings: { overlaysEnabled: false } })).toEqual([]);
    expect(buildPersonalizationOverlays({ overlaysEnabled: false })).toEqual([]);
    expect(buildRenderStudioOverlays({ settings: { overlaysEnabled: false } })).toEqual({});
  });

  it('returns the capture payload byte-identical when overlays are disabled', () => {
    const payload = studioPayload();
    const merged = applyRenderStudioPersonalization(payload, { settings: { overlaysEnabled: false } });
    expect(merged).toBe(payload);
  });

  it('skips compositing at the pipeline level too', () => {
    expect(shouldCompositeOverlays(buildPersonalizationOverlays(), true)).toBe(true);
    expect(shouldCompositeOverlays(buildPersonalizationOverlays(), false)).toBe(false);
    expect(shouldCompositeOverlays([], undefined)).toBe(false);
    expect(shouldCompositeOverlays('not-an-array', true)).toBe(false);
  });

  it('only composites the brand reference when it is explicitly enabled', () => {
    const off = buildPersonalizationOverlays();
    expect(off.some((o) => o.id === RENDER_STUDIO_OVERLAY_IDS.brandReference)).toBe(false);

    const on = buildPersonalizationOverlays({ settings: { brandReferenceOverlay: true } });
    const brand = on.find((o) => o.id === RENDER_STUDIO_OVERLAY_IDS.brandReference);
    expect(brand).toMatchObject({
      type: 'image',
      url: 'https://cdn.test/brand.png',
      x: 0.04,
      y: 0.76,
      width: 0.2,
      opacity: 0.8,
    });
  });
});

describe('capability flags stay honest', () => {
  it('claims exactly what the capture path composites', () => {
    expect(RENDER_STUDIO_OVERLAY_SUPPORT).toEqual({
      referenceImages: true,
      logoUrl: true,
      lastFrameUrl: false,
      textOverlay: true,
      prompt: false,
      branding: true,
    });
    expect(RENDER_STUDIO_OVERLAY_SUPPORT_NOTES.lastFrameUrl).toMatch(/FALSE/);
    expect(RENDER_STUDIO_OVERLAY_SUPPORT_NOTES.prompt).toMatch(/FALSE/);
    expect(RENDER_STUDIO_OVERLAY_SUPPORT_NOTES.logoUrl).toMatch(/overlays\[\]/);
  });

  it('leaves first/last frame unsupported instead of fabricating a parameter', () => {
    expect(RENDER_STUDIO_FRAME_SUPPORT.firstFrameUrl).toBe(false);
    expect(RENDER_STUDIO_FRAME_REASON(RENDER_STUDIO_FRAME_SUPPORT)).toBeTruthy();
    expect(RENDER_STUDIO_FRAME_SUPPORT.evidence).toMatch(/No first\/last-frame parameter/);
    expect(RENDER_STUDIO_FRAME_SUPPORT.where).toMatch(/captureRealVideo\(\)/);
  });

  it('keeps the verified settings key set the capture path reads', () => {
    expect(RENDER_STUDIO_SETTINGS_KEYS).toEqual([
      'format', 'frameRate', 'quality', 'aspectRatio', 'contain', 'duration', 'validateDecode',
    ]);
    // Overlays ride on the payload root, not inside `settings`.
    expect(RENDER_STUDIO_SETTINGS_KEYS).not.toContain(RENDER_STUDIO_OVERLAY_PARAM);
    expect(RENDER_STUDIO_OVERLAY_PARAM).toBe('overlays');
  });
});

/** Reads the precise reason first/last frames are still unsupported. */
function RENDER_STUDIO_FRAME_REASON(frameSupport) {
  return `${frameSupport.evidence} ${frameSupport.where}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. DESCRIPTOR NORMALIZATION (never throws, never draws garbage)
 * ═══════════════════════════════════════════════════════════════════════════ */
describe('descriptor normalization', () => {
  it('drops entries that cannot be drawn', () => {
    expect(normalizeOverlayDescriptor(null)).toBeNull();
    expect(normalizeOverlayDescriptor('nope')).toBeNull();
    expect(normalizeOverlayDescriptor({ type: 'image' })).toBeNull();
    expect(normalizeOverlayDescriptor({ type: 'image', url: '   ' })).toBeNull();
    expect(normalizeOverlayDescriptor({ type: 'text', text: '   ' })).toBeNull();
    expect(normalizeOverlayDescriptor({ type: 'text' })).toBeNull();
  });

  it('clamps out-of-range geometry instead of drawing off-canvas', () => {
    const d = normalizeOverlayDescriptor({
      type: 'image', url: 'https://cdn.test/l.png', x: 5, y: -3, width: 9, opacity: 42,
    });
    expect(d).toMatchObject({ x: 1, y: 0, width: 1, opacity: 1 });
  });

  it('fills defaults for every omitted field', () => {
    expect(normalizeOverlayDescriptor({ type: 'image', url: 'https://cdn.test/l.png' }))
      .toMatchObject({ x: 0.84, y: 0.04, width: 0.12, height: null, opacity: 0.9 });
    expect(normalizeOverlayDescriptor({ type: 'text', text: 'Hi' }))
      .toMatchObject({
        x: 0.5, y: 0.86, fontSize: 0.05, color: '#ffffff', align: 'center', opacity: 1, maxWidth: 0.9,
      });
  });

  it('infers the type when the caller omits it', () => {
    expect(normalizeOverlayDescriptor({ url: 'https://cdn.test/l.png' }).type).toBe('image');
    expect(normalizeOverlayDescriptor({ text: 'Hi' }).type).toBe('text');
  });
});
