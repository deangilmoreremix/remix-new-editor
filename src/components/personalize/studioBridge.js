/**
 * studioBridge.js
 *
 * Isolated compatibility layer between the personalization subsystem
 * and the existing studios (Render Studio, CineGen).
 *
 * WHY THIS FILE EXISTS
 * -------------------
 * The consolidation mission explicitly forbids:
 *   - modifying or redesigning the Timeline Editor,
 *   - replacing the studios' existing rendering/generation architecture,
 *   - creating a second personalization engine.
 *
 * So instead of editing `RenderPage.js` / `src/lib/cinegen.js` internals,
 * the personalization assets are projected into the *exact shape* those
 * studios already consume, and each studio calls one function at its
 * existing generation entry point. One line per studio. No rewrites.
 *
 * INTEGRATION POINTS (documented, minimal, additive)
 * ------------------------------------------------
 * Render Studio (`src/components/RenderPage.js`):
 *   Applied at the two `captureRealVideo()` call sites inside
 *   `runExportWorker()` (`:1194`) and the queued-job executor (`:1224`):
 *
 *     const result = await captureRealVideo(
 *       applyRenderStudioPersonalization({ ...existing payload })
 *     );
 *
 *   One imported call per site. When personalization is empty the payload is
 *   returned by reference and the render is byte-identical to before.
 *
 * CineGen (`src/lib/cinegen.js`):
 *   Inside `generateElement(params)` / `generateVideo(params)`, call
 *   `resolveForCineGen(params)` and merge the returned fields into the
 *   existing `muapi.*` call. The `cinegen` object itself is NOT edited;
 *   a wrapper (`withPersonalization`) is exported below for call sites
 *   that want the merge done for them.
 *
 * Both are optional: if personalization has no data, every function
 * returns a neutral value and the studio behaves exactly as before.
 */

import { assetLibraryStore, useAssetLibraryStore } from './assetLibraryStore.js';
import { clientProfileStore } from './clientProfileStore.js';

/**
 * Neutral value used when personalization has nothing to contribute.
 * Studios spread this; it is a no-op by design. CineGen gets its own
 * key names added on top (see CINE_GEN_EMPTY) so callers can read
 * `image_url` / `images_list` without existence checks.
 * @type {{ referenceImages: never[], promptPrefix: '', clientProfile: null, assetIds: never[], lastFrameUrl: null }}
 */
const EMPTY = Object.freeze({
  referenceImages: Object.freeze([]),
  promptPrefix: '',
  clientProfile: null,
  assetIds: Object.freeze([]),
  lastFrameUrl: null,
});

/**
 * Neutral CineGen payload. Uses the MuAPI key names the cinegen
 * adapter forwards so an empty personalization state is an explicit
 * no-op (null / []) rather than a missing key.
 * @type {{ image_url: null, images_list: never[], promptSuffix: '', clientProfile: null, assetIds: never[], aspectRatio: null }}
 */
const CINE_GEN_EMPTY = Object.freeze({
  image_url: null,
  images_list: Object.freeze([]),
  promptSuffix: '',
  clientProfile: null,
  assetIds: Object.freeze([]),
  aspectRatio: null,
});

/**
 * Roles whose assets are meaningful as a *still reference* for a
 * render (first/last frame, brand, product, logo). Face identity is
 * intentionally included — it is the reference for presenter work.
 * @type {readonly (import('./types.js').AssetRole)[]}
 */
const IMAGE_REFERENCE_ROLES = Object.freeze([
  'face_identity',
  'presenter_identity',
  'character_identity',
  'logo',
  'product_reference',
  'brand_reference',
  'background_reference',
  'first_frame',
]);

/**
 * Roles used as a *terminal* reference (what the shot ends on).
 * @type {readonly (import('./types.js').AssetRole)[]}
 */
const LAST_FRAME_ROLES = Object.freeze(['last_frame']);

/**
 * Collect every asset URL for the given roles, de-duplicated, in a
 * stable order (primaries first, then insertion order).
 *
 * @param {import('./assetLibraryStore.js').default} library
 * @param {readonly (import('./types.js').AssetRole)[]} roles
 * @returns {{ url: string, role: import('./types.js').AssetRole, assetId: string }[]}
 */
function collect(library, roles) {
  if (!library) return [];
  const seen = new Set();
  const out = [];

  /** @type {[import('./types.js').AssetRole, import('./types.js').PersonalizationAsset[]][]} */
  const buckets = [
    ...(roles.includes('face_identity') || roles.includes('presenter_identity') || roles.includes('character_identity')
      ? [['face_identity', library.identities || []]]
      : []),
    ...(roles.includes('logo') ? [['logo', library.logos || []]] : []),
    ...(roles.includes('product_reference') ? [['product_reference', library.products || []]] : []),
    ...(roles.includes('brand_reference') || roles.includes('background_reference')
      ? [['brand_reference', library.brandReferences || []]]
      : []),
    ...(roles.includes('first_frame') ? [['first_frame', library.firstFrame ? [library.firstFrame] : []]] : []),
    ...(roles.includes('last_frame') ? [['last_frame', library.lastFrame ? [library.lastFrame] : []]] : []),
  ];

  for (const [role, assets] of buckets) {
    const sorted = [...assets].sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)));
    for (const a of sorted) {
      const url = a && (a.uploadedUrl || a.url);
      if (typeof url !== 'string' || !/^https?:\/\//.test(url)) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({ url, role, assetId: a.id });
    }
  }
  return out;
}

/**
 * Read the *current* client profile without editing `clientProfileStore.js`.
 *
 * `clientProfileStore` exposes `getCurrentClientId()` / `getClientById()` and
 * `getState()` — there is no `getCurrent()` — so the naive
 * `store.getCurrent ? store.getCurrent() : null` guard silently returned
 * `null` and personalization never saw a client profile in production.
 *
 * Resolution order (each step is optional so existing callers/mocks keep
 * working):
 *   1. `getCurrent()`            — honoured first for back-compat and mocks
 *   2. `getCurrentClientId()` → `getClientById(id)`  — the real store API
 *   3. `getState()` fallback: the current id when step 2 cannot resolve it,
 *      otherwise the most recently updated client.
 *
 * Step 3 exists because of a real production gap: `clientProfileStore`
 * persists `currentClientId` and exposes `setCurrentClientId()`, but neither
 * `addClient()` nor `updateClient()` sets it, and the hub panel's
 * "Create profile" path calls `addClient()` — so after a first profile is
 * created `currentClientId` is still `null` and personalization would resolve
 * no client at all. The fallback keeps the profile resolvable without editing
 * the store (this bridge may not touch it).
 *
 * @returns {import('./clientProfileStore.js').ClientProfile|null}
 */
function readCurrentClient() {
  const store = clientProfileStore;
  if (!store) return null;

  try {
    if (typeof store.getCurrent === 'function') {
      const viaCurrent = store.getCurrent();
      if (viaCurrent) return viaCurrent;
    }
  } catch {
    /* fall through to the real store API */
  }

  try {
    if (typeof store.getCurrentClientId === 'function') {
      const id = store.getCurrentClientId();
      if (id) {
        if (typeof store.getClientById === 'function') {
          const byId = store.getClientById(id);
          if (byId) return byId;
        }
        if (typeof store.getState === 'function') {
          const state = store.getState() || {};
          const clients = Array.isArray(state.clients) ? state.clients : [];
          const found = clients.find((c) => c && c.id === id);
          if (found) return found;
        }
      }
    }
    if (typeof store.getState === 'function') {
      // No resolvable current id: fall back to the most recently updated
      // profile. `clientProfileStore` keeps `clients` sorted by updatedAt desc,
      // but this does not rely on that ordering — it re-sorts defensively so
      // the fallback is correct for any caller-supplied shape.
      const state = store.getState() || {};
      const clients = Array.isArray(state.clients) ? state.clients.filter((c) => c && typeof c === 'object') : [];
      if (clients.length === 0) return null;
      return [...clients].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0];
    }
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Build the personalization slice for a still-render request.
 *
 * @param {Object} [opts]
 * @param {number} [opts.maxImages=6] - cap reference images
 * @returns {{ referenceImages: {url: string, role: string}[], promptPrefix: string, clientProfile: object|null, assetIds: string[], lastFrameUrl: string|null }}
 */
export function resolveForRenderStudio(opts = {}) {
  const library = readBucketedAssetLibrary();
  const client = readCurrentClient();
  const maxImages = opts.maxImages || 6;

  const refs = collect(library, IMAGE_REFERENCE_ROLES).slice(0, maxImages);
  const lastFrame = collect(library, LAST_FRAME_ROLES);
  const lastFrameUrl = lastFrame.length > 0 ? lastFrame[lastFrame.length - 1].url : null;

  // lastFrameUrl must survive the empty path — a terminal-frame-only
  // library is still a valid personalization contribution.
  if (refs.length === 0 && !client) return { ...EMPTY, lastFrameUrl };

  const promptPrefix = buildPromptPrefix(client);
  return {
    referenceImages: refs,
    promptPrefix,
    clientProfile: client,
    assetIds: refs.map((r) => r.assetId),
    lastFrameUrl,
  };
}

/**
 * Build the personalization slice for a CineGen element/video request.
 *
 * CineGen's `cinegen` adapter forwards `params` straight into
 * `muapi.generateImage` / `muapi.generateVideo`, so the returned
 * object uses the *same* key names those calls already accept:
 *   - `image_url`        (single primary reference the MuAPI I2I endpoint reads)
 *   - `images_list`      (extra references, for multi-image models)
 *   - `prompt`           (client-profile-aware prompt)
 *   - `aspect_ratio`
 *
 * @param {Object} [params] - the studio's existing params (to preserve aspect ratio etc.)
 * @returns {{ image_url: string|null, images_list: string[], promptSuffix: string, clientProfile: object|null, assetIds: string[] }}
 */
export function resolveForCineGen(params = {}) {
  const library = readBucketedAssetLibrary();
  const client = readCurrentClient();

  const refs = collect(library, IMAGE_REFERENCE_ROLES);
  if (refs.length === 0 && !client) {
    return {
      ...CINE_GEN_EMPTY,
      aspectRatio: params.aspect_ratio || params.aspectRatio || null,
    };
  }

  const images = refs.map((r) => r.url);
  return {
    image_url: images[0] || null,
    images_list: images.slice(1),
    promptSuffix: buildPromptSuffix(client),
    clientProfile: client,
    assetIds: refs.map((r) => r.assetId),
    aspectRatio: params.aspect_ratio || params.aspectRatio || (client && client.aspectRatio) || null,
  };
}

/**
 * Human-readable prompt fragment describing the active client profile.
 * Uses token substitution against the existing token schema so the
 * personalizer vocabulary stays the single source of truth.
 *
 * @param {import('./clientProfileStore.js').ClientProfile|null} client
 * @returns {string}
 */
function buildPromptPrefix(client) {
  if (!client) return '';
  const bits = [];
  if (client.businessName) bits.push(`for ${client.businessName}`);
  if (client.industry) bits.push(`in the ${client.industry} industry`);
  if (client.productService) bits.push(`showing ${client.productService}`);
  if (client.offer) bits.push(`promoting ${client.offer}`);
  if (client.brandDescription) bits.push(client.brandDescription.trim());
  if (bits.length === 0) return '';
  return `Create imagery ${bits.join(', ')}.`;
}

/**
 * @param {import('./clientProfileStore.js').ClientProfile|null} client
 * @returns {string}
 */
function buildPromptSuffix(client) {
  if (!client) return '';
  const bits = [];
  if (client.callToAction) bits.push(`Include the call to action: "${client.callToAction}".`);
  if (client.ctaHeadline) bits.push(`Headline: "${client.ctaHeadline}".`);
  if (client.phone) bits.push(`Phone: ${client.phone}.`);
  if (client.website) bits.push(`Website: ${client.website}.`);
  if (bits.length === 0) return '';
  return ` ${bits.join(' ')}`;
}

/**
 * Wrap a CineGen call so personalization is merged transparently.
 *
 * The studio's own function is called unmodified; we only pre-compute
 * the personalization fields and merge them in. If the studio already
 * built its own `image_url`, it wins (studio-first precedence).
 *
 * @param {Object} cinegenAdapter - e.g. `import { cinegen } from '../../lib/cinegen.js'`
 * @param {string} method - 'generateElement' | 'generateVideo'
 * @param {Object} params - the studio's params
 * @returns {Promise<any>} whatever the studio returns
 */
export async function callCineGenWithPersonalization(cinegenAdapter, method, params = {}) {
  if (!cinegenAdapter || typeof cinegenAdapter[method] !== 'function') {
    throw new Error(`callCineGenWithPersonalization: "${method}" is not a function on the CineGen adapter`);
  }
  const p = resolveForCineGen(params);
  const merged = { ...params };
  if (p.image_url && !merged.image_url) merged.image_url = p.image_url;
  if (p.images_list && p.images_list.length && !merged.images_list) merged.images_list = p.images_list;
  if (p.promptSuffix && typeof merged.prompt === 'string' && !merged.prompt.includes(p.promptSuffix)) {
    merged.prompt = `${merged.prompt}${p.promptSuffix}`;
  }
  return cinegenAdapter[method](merged);
}

/**
 * React hook for UI that wants to react to library changes.
 * Studios should NOT be edited; UI overlays can use this.
 * @param {(s: unknown) => unknown} [selector]
 */
export function useStudioBridge(selector) {
  return useAssetLibraryStore(selector);
}

/**
 * True when personalization has anything a studio could use.
 * Useful for showing a "personalized" badge without computing refs.
 * @returns {boolean}
 */
export function hasPersonalizationData() {
  const library = readBucketedAssetLibrary();
  const client = readCurrentClient();
  return Boolean(client) || collect(library, IMAGE_REFERENCE_ROLES).length > 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * RENDER STUDIO PROJECTION
 *
 * A *projection* of the personalization state onto the parameters
 * `captureRealVideo()` in `src/components/RenderPage.js` actually reads.
 * Nothing here re-generates, re-renders or re-decides anything, and nothing
 * edits the studio beyond its own two call sites.
 *
 * VERIFIED PARAMETER SET (src/components/RenderPage.js `captureRealVideo`)
 * ---------------------------------------------------------------------
 *   videoUrl                source video URL
 *   action                  'export-video' | 'trailer-cut' | 'social-resize'
 *   overlays                overlay descriptors composited on top of the base
 *                           frame (default []). Schema below.
 *   overlaysEnabled         global overlay switch (default true)
 *   settings.format         container/codec to encode
 *   settings.frameRate      capture fps
 *   settings.quality        bitrate quality
 *   settings.aspectRatio    canvas size (social-resize only)
 *   settings.contain        letterbox instead of cover (social-resize only)
 *   settings.duration       render window, seconds
 *   settings.validateDecode run the decode probe
 *   timeRange               { start, end } seconds (trailer-cut only)
 *   effects.brightness      colour multiplier
 *   effects.contrast        colour multiplier
 *   preset                  PRESET_CONFIG look (studio/user selection)
 *   onProgress              (percent) => void
 *
 * NOTE: `settings.width` / `settings.height` are NOT read by the capture path
 * (canvas size comes from the source video or ASPECT_DIMS). Only the separate
 * web worker `src/lib/editor/renderExportWorker.js` reads them, and Render
 * Studio's `runExportWorker` does not use that worker.
 *
 * OVERLAY DESCRIPTOR SCHEMA (what `overlays[]` carries)
 * ----------------------------------------------------
 * Every overlay is normalized to fractions of the VISIBLE video area, so it
 * is resolution-independent and never lands on a `contain` letterbox bar.
 *
 *   image (logo / brand reference)
 *     { id, type: 'image', url, x, y, width, height, opacity, source }
 *   text (business name / call to action)
 *     { id, type: 'text', text, x, y, fontSize, color, fontFamily, align,
 *       opacity, maxWidth, lineHeight, fontWeight, shadow, source }
 *
 * `id` is the merge key: a studio-supplied overlay with the same id replaces
 * the personalization one. Full semantics live in
 * `src/lib/editor/renderHelpers.js` (normalizeOverlayDescriptor /
 * resolveOverlayRect / prepareRenderOverlays / drawOverlays).
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The `settings` keys `captureRealVideo()` reads. Anything else in `settings`
 * is ignored by the capture path.
 * @type {readonly string[]}
 */
export const RENDER_STUDIO_SETTINGS_KEYS = Object.freeze([
  'format',
  'frameRate',
  'quality',
  'aspectRatio',
  'contain',
  'duration',
  'validateDecode',
]);

/**
 * The capture-path parameter that carries personalization branding.
 * @type {'overlays'}
 */
export const RENDER_STUDIO_OVERLAY_PARAM = 'overlays';

/**
 * The personalization concepts Render Studio can brand an export with, and
 * whether the capture pipeline has a REAL parameter for each.
 *
 * These flags are about the *concept*, and every `true` below is served by the
 * one `overlays[]` parameter the capture path now composites:
 *   - `logoUrl`         → primary logo, image overlay
 *   - `referenceImages` → brand reference, image overlay (opt-in)
 *   - `textOverlay`     → business name + call to action, text overlays
 *   - `branding`        → the same client-profile text overlays
 * `lastFrameUrl` and `prompt` stay `false` on purpose — see
 * `RENDER_STUDIO_FRAME_SUPPORT` and `RENDER_STUDIO_OVERLAY_SUPPORT_NOTES`.
 *
 * @type {Readonly<Record<string, boolean>>}
 */
export const RENDER_STUDIO_OVERLAY_SUPPORT = Object.freeze({
  referenceImages: true,
  logoUrl: true,
  lastFrameUrl: false,
  textOverlay: true,
  prompt: false,
  branding: true,
});

/**
 * Honest per-flag notes: where the value is composited, or exactly why the
 * flag is still false. Read this before trusting a flag.
 * @type {Readonly<Record<string, string>>}
 */
export const RENDER_STUDIO_OVERLAY_SUPPORT_NOTES = Object.freeze({
  referenceImages: 'Composited as an `overlays[]` entry of type "image" (brand reference, opt-in via settings.brandReferenceOverlay).',
  logoUrl: 'Composited as an `overlays[]` entry of type "image" from the primary logo asset (top-right, ~12% width, 0.9 opacity).',
  lastFrameUrl: 'FALSE: no parameter in captureRealVideo(), the render queue payload or renderExportWorker.js reads a still frame. See RENDER_STUDIO_FRAME_SUPPORT for the precise gap.',
  textOverlay: 'Composited as `overlays[]` entries of type "text" (business name bottom-center, call to action below it).',
  prompt: 'FALSE: captureRealVideo() captures an already-existing video — it takes no prompt. Prompt projection belongs to generation studios (see resolveForCineGen / resolveForRenderStudio promptPrefix).',
  branding: 'Composited as the same business-name / call-to-action `overlays[]` text entries.',
});

/**
 * Machine-readable record of what is still missing, so it can be closed
 * without being re-derived.
 *
 * @type {Readonly<{supported: readonly string[], missing: readonly string[],
 *   evidence: string, unblock: string}>}
 */
export const RENDER_STUDIO_OVERLAY_GAP = Object.freeze({
  supported: Object.freeze(
    Object.keys(RENDER_STUDIO_OVERLAY_SUPPORT).filter((k) => RENDER_STUDIO_OVERLAY_SUPPORT[k]),
  ),
  missing: Object.freeze(
    Object.keys(RENDER_STUDIO_OVERLAY_SUPPORT).filter((k) => !RENDER_STUDIO_OVERLAY_SUPPORT[k]),
  ),
  evidence:
    'captureRealVideo() composites the base frame with ctx.drawImage(video, sourceRect…) inside drawFrame(), '
    + 'and overlays are drawn right after it by drawOverlays(): image entries via ctx.drawImage and text '
    + 'entries via fillText, all positioned inside the visible video area. Every overlay image is decoded '
    + 'once by prepareRenderOverlays() before the capture starts, so the per-frame loop stays synchronous '
    + 'and a failed image is skipped instead of failing the render. Still unsupported: lastFrameUrl and '
    + 'prompt — nothing in the capture path, the render queue payload or renderExportWorker.js reads '
    + 'either of them (see RENDER_STUDIO_FRAME_SUPPORT).',
  unblock:
    'To close the last two flags: add an explicit still-frame parameter to captureRealVideo() (seek and '
    + 'composite the still at the start/end of the capture window) plus a queue/outputSettings carrier, '
    + 'and a prompt passthrough for capture. drawFrame() itself needs no further change — the overlay step '
    + 'is composite, deduplicated and studio-precedence safe.',
});

/**
 * First-frame / last-frame support, stated precisely.
 *
 * VERIFIED FALSE — and this is why:
 *   - `settings` keys read by captureRealVideo() are exactly
 *     RENDER_STUDIO_SETTINGS_KEYS; none carries a still frame.
 *   - `timeRange` is `{ start, end }` in SECONDS for trailer-cut, not frames.
 *   - `preset` resolves a PRESET_CONFIG colour finish.
 *   - the render queue (`renderQueueStore.js`) persists only the job fields
 *     the executor already reads back (`videoUrl`, `outputSettings`, …).
 *   - `renderExportWorker.js` reads `settings{width,height,aspectRatio,duration}`
 *     + `timeRange` + `effects`, and Render Studio's `runExportWorker` does
 *     not use that worker at all.
 * So a firstFrameUrl/lastFrameUrl value would be silently ignored today.
 *
 * @type {Readonly<{firstFrameUrl: boolean, lastFrameUrl: boolean,
 *   evidence: string, where: string}>}
 */
export const RENDER_STUDIO_FRAME_SUPPORT = Object.freeze({
  firstFrameUrl: false,
  lastFrameUrl: false,
  evidence:
    'No first/last-frame parameter exists in captureRealVideo(), RENDER_STUDIO_SETTINGS_KEYS, timeRange, '
    + 'preset, the render queue payload or renderExportWorker.js. Projecting one would be fabrication.',
  where:
    'A real implementation needs (a) a firstFrameUrl/lastFrameUrl parameter on captureRealVideo() that '
    + 'seeks and composites the still at the boundaries of the capture window, and (b) a carrier for it '
    + 'in the queued job payload / outputSettings. Until both exist the flags stay false.',
});

/** Stable ids so a studio overlay can replace a personalization overlay. */
export const RENDER_STUDIO_OVERLAY_IDS = Object.freeze({
  logo: 'personalization-logo',
  brandReference: 'personalization-brand-reference',
  businessName: 'personalization-business-name',
  callToAction: 'personalization-call-to-action',
});

/**
 * Default geometry for the projected overlays. Every value is a fraction of
 * the visible video area (0..1), so the studio can override any of them.
 * `height: null` means "preserve the logo's decoded aspect ratio".
 */
const LOGO_OVERLAY_GEOMETRY = Object.freeze({
  x: 0.84, y: 0.04, width: 0.12, height: null, opacity: 0.9,
});
const BRAND_REFERENCE_OVERLAY_GEOMETRY = Object.freeze({
  x: 0.04, y: 0.76, width: 0.2, height: null, opacity: 0.8,
});
const BUSINESS_NAME_OVERLAY_GEOMETRY = Object.freeze({
  x: 0.5, y: 0.8, fontSize: 0.05, color: '#ffffff', align: 'center', opacity: 1, maxWidth: 0.9, fontWeight: 700,
});
const CALL_TO_ACTION_OVERLAY_GEOMETRY = Object.freeze({
  x: 0.5, y: 0.88, fontSize: 0.038, color: '#ffffff', align: 'center', opacity: 0.95, maxWidth: 0.9, fontWeight: 600,
});

/** Only URL schemes an <img> can actually load for a composited overlay. */
const OVERLAY_URL_PATTERN = /^(https?|blob|data):/i;

/**
 * STORE-SHAPE ADAPTER
 * -------------------
 * `assetLibraryStore.getState()` returns the FLAT production shape
 * `{ assets: AssetRecord[], removed: AssetRecord[], hydrated: boolean }` where
 * every record carries its own `role` (see assetLibraryStore.js). `collect()`
 * above, and the `AssetLibrary` typedef in types.js, expect the BUCKETED shape
 * (`logos`, `products`, `brandReferences`, `firstFrame`, `lastFrame`, …).
 * On the real store those bucket fields are all `undefined`, so before this
 * adapter every projection collected NOTHING in production.
 *
 * This buckets the flat `assets` array by `role` and merges it with any
 * bucketed fields already present (callers/tests that supply the bucketed
 * shape directly keep working, de-duplicated by id then url).
 *
 * @param {object|null} library - the raw store state (either shape)
 * @returns {{identities: object[], logos: object[], products: object[],
 *   brandReferences: object[], savedReferences: object[], audio: object[],
 *   firstFrame: object|null, lastFrame: object|null, ctaGraphic: object|null}|null}
 */
export function toBucketedAssetLibrary(library) {
  if (!library || typeof library !== 'object') return null;

  const flat = Array.isArray(library.assets) ? library.assets : [];
  const derived = {
    identities: [], logos: [], products: [], brandReferences: [],
    savedReferences: [], audio: [], firstFrame: null, lastFrame: null, ctaGraphic: null,
  };
  for (const asset of flat) {
    if (!asset || typeof asset !== 'object') continue;
    switch (asset.role) {
      case 'face_identity':
      case 'presenter_identity':
      case 'character_identity':
        derived.identities.push(asset);
        break;
      case 'logo':
        derived.logos.push(asset);
        break;
      case 'product_reference':
        derived.products.push(asset);
        break;
      case 'brand_reference':
      case 'background_reference':
        derived.brandReferences.push(asset);
        break;
      case 'saved_reference':
        derived.savedReferences.push(asset);
        break;
      case 'audio_reference':
        derived.audio.push(asset);
        break;
      case 'first_frame':
        if (!derived.firstFrame) derived.firstFrame = asset;
        break;
      case 'last_frame':
        if (!derived.lastFrame) derived.lastFrame = asset;
        break;
      case 'cta_graphic':
        if (!derived.ctaGraphic) derived.ctaGraphic = asset;
        break;
      default:
        break;
    }
  }

  const mergeList = (derivedList, explicitList) => {
    const out = [...derivedList];
    const seen = new Set(out.map((a) => (a && (a.id || a.url)) || null).filter(Boolean));
    for (const asset of (Array.isArray(explicitList) ? explicitList : [])) {
      const key = asset && (asset.id || asset.url);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      out.push(asset);
    }
    return out;
  };

  return {
    identities: mergeList(derived.identities, library.identities),
    logos: mergeList(derived.logos, library.logos),
    products: mergeList(derived.products, library.products),
    brandReferences: mergeList(derived.brandReferences, library.brandReferences),
    savedReferences: mergeList(derived.savedReferences, library.savedReferences),
    audio: mergeList(derived.audio, library.audio),
    firstFrame: derived.firstFrame || library.firstFrame || null,
    lastFrame: derived.lastFrame || library.lastFrame || null,
    ctaGraphic: derived.ctaGraphic || library.ctaGraphic || null,
  };
}

/** The bucketed view of the CURRENT asset library (either store shape). */
function readBucketedAssetLibrary() {
  const raw = assetLibraryStore && typeof assetLibraryStore.getState === 'function'
    ? assetLibraryStore.getState()
    : assetLibraryStore;
  return toBucketedAssetLibrary(raw);
}

/** Primary asset of a bucket (primaries first, then insertion order). */
function pickPrimaryAsset(list) {
  const assets = (Array.isArray(list) ? list : []).filter((a) => a && typeof a === 'object');
  if (assets.length === 0) return null;
  const sorted = [...assets].sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)));
  return sorted[0] || null;
}

/** A loadable URL for an overlay image (uploaded copy preferred). */
function overlayUrlFor(asset) {
  if (!asset) return null;
  const uploaded = typeof asset.uploadedUrl === 'string' ? asset.uploadedUrl.trim() : '';
  const raw = typeof asset.url === 'string' ? asset.url.trim() : '';
  const url = uploaded !== '' ? uploaded : raw;
  return OVERLAY_URL_PATTERN.test(url) ? url : null;
}

/**
 * Build the personalization overlay descriptors for a render.
 *
 * Logo (primary logo asset), optional brand reference (only when explicitly
 * enabled), and the client profile's business name + call to action. Every
 * overlay carries an explicit normalized position/scale, so the studio can
 * override any of them — and a studio overlay with the same `id` always wins
 * (see `mergeRenderPersonalization`).
 *
 * @param {{ settings?: object, overlaysEnabled?: boolean,
 *   brandReferenceOverlay?: boolean }} [options]
 * @returns {object[]} overlay descriptors ([] when there is nothing to add)
 */
export function buildPersonalizationOverlays(options = {}) {
  try {
    const settings = options && typeof options.settings === 'object' && options.settings ? options.settings : {};
    if (settings.overlaysEnabled === false || options.overlaysEnabled === false) return [];

    const library = readBucketedAssetLibrary();
    const client = readCurrentClient();
    const overlays = [];

    const logoUrl = overlayUrlFor(pickPrimaryAsset(library && library.logos));
    if (logoUrl) {
      overlays.push({
        id: RENDER_STUDIO_OVERLAY_IDS.logo,
        type: 'image',
        url: logoUrl,
        source: 'personalization',
        ...LOGO_OVERLAY_GEOMETRY,
      });
    }

    // The brand reference is a photo, not a logo — only composite it when the
    // studio/user explicitly asks for it.
    if (settings.brandReferenceOverlay === true || options.brandReferenceOverlay === true) {
      const brandUrl = overlayUrlFor(pickPrimaryAsset(library && library.brandReferences));
      if (brandUrl) {
        overlays.push({
          id: RENDER_STUDIO_OVERLAY_IDS.brandReference,
          type: 'image',
          url: brandUrl,
          source: 'personalization',
          ...BRAND_REFERENCE_OVERLAY_GEOMETRY,
        });
      }
    }

    const businessName = client && typeof client.businessName === 'string' ? client.businessName.trim() : '';
    if (businessName !== '') {
      overlays.push({
        id: RENDER_STUDIO_OVERLAY_IDS.businessName,
        type: 'text',
        text: businessName,
        source: 'personalization',
        ...BUSINESS_NAME_OVERLAY_GEOMETRY,
      });
    }

    const callToAction = client && typeof client.callToAction === 'string' ? client.callToAction.trim() : '';
    if (callToAction !== '') {
      overlays.push({
        id: RENDER_STUDIO_OVERLAY_IDS.callToAction,
        type: 'text',
        text: callToAction,
        source: 'personalization',
        ...CALL_TO_ACTION_OVERLAY_GEOMETRY,
      });
    }

    return overlays;
  } catch (err) {
    console.warn('[studioBridge] overlay projection failed, no overlays for this render:', err);
    return [];
  }
}

/**
 * Project personalization into the overlay payload Render Studio consumes.
 *
 * Returns `{ overlays: [...] }` when there is something to composite, and a
 * neutral `{}` when personalization is empty (or overlays are disabled), so an
 * un-personalized render is byte-identical to before.
 *
 * @param {{ settings?: object, overlaysEnabled?: boolean,
 *   brandReferenceOverlay?: boolean }} [options]
 * @returns {object} the supported overlay payload (possibly empty)
 */
export function buildRenderStudioOverlays(options = {}) {
  const overlays = buildPersonalizationOverlays(options);
  if (!Array.isArray(overlays) || overlays.length === 0) return {};
  return { [RENDER_STUDIO_OVERLAY_PARAM]: overlays };
}

/**
 * Merge the Render Studio personalization projection into a
 * `captureRealVideo()` payload.
 *
 * - Returns a NEW object; the input is never mutated.
 * - STUDIO-SUPPLIED OVERLAYS ALWAYS WIN: a studio/user overlay list is kept
 *   verbatim and personalization only fills the ids the studio did not set,
 *   so an explicit overlay is never clobbered. Contest is read from the
 *   payload root AND `settings` — either one is an explicit studio selection.
 * - Never throws: any failure logs a warning and falls back to the original
 *   payload, so personalization can never break a render.
 *
 * @param {object} payload - the studio's existing payload
 * @param {{ settings?: object, overlaysEnabled?: boolean,
 *   brandReferenceOverlay?: boolean }} [options]
 * @returns {object} a new payload
 */
export function mergeRenderPersonalization(payload, options = {}) {
  const hasPayload = Boolean(payload) && typeof payload === 'object';
  const base = hasPayload ? payload : {};
  try {
    const overlays = buildPersonalizationOverlays(options);
    // A non-object payload carries no capture parameters to brand, so it
    // keeps its neutral answer — there is nothing to merge into.
    if (!hasPayload || overlays.length === 0) return { ...base };

    const merged = { ...base };
    const settingsOverlays = base.settings && typeof base.settings === 'object' ? base.settings.overlays : null;
    const studioOverlays = Array.isArray(base.overlays)
      ? base.overlays
      : (Array.isArray(settingsOverlays) ? settingsOverlays : null);

    if (studioOverlays) {
      const studioIds = new Set(
        studioOverlays
          .filter((o) => o && typeof o.id === 'string' && o.id !== '')
          .map((o) => o.id),
      );
      const additions = overlays.filter((o) => !studioIds.has(o.id));
      if (additions.length === 0) return { ...base };
      merged[RENDER_STUDIO_OVERLAY_PARAM] = [...studioOverlays, ...additions];
      return merged;
    }

    if (base[RENDER_STUDIO_OVERLAY_PARAM] != null || settingsOverlays != null) {
      // A non-array studio value (or a settings-scoped one) is respected as-is.
      return { ...base };
    }

    merged[RENDER_STUDIO_OVERLAY_PARAM] = overlays;
    return merged;
  } catch (err) {
    console.warn('[studioBridge] mergeRenderPersonalization failed, using the original payload:', err);
    return { ...base };
  }
}

/**
 * One-call bridge for Render Studio capture sites.
 *
 * Returns the payload UNCHANGED (same reference) when personalization has
 * nothing to contribute, so existing parameters and defaults stay
 * byte-identical. Otherwise returns a new payload with the supported
 * projection merged in. Never throws.
 *
 * @param {object} payload - the studio's existing `captureRealVideo` payload
 * @param {{ settings?: object, overlaysEnabled?: boolean,
 *   brandReferenceOverlay?: boolean }} [options]
 * @returns {object} the payload to capture with
 */
export function applyRenderStudioPersonalization(payload, options = {}) {
  // A missing/non-object payload has no capture parameters to preserve; the
  // bridge has always answered a neutral {} for it.
  const hasPayload = Boolean(payload) && typeof payload === 'object';
  try {
    if (!hasPersonalizationData()) return hasPayload ? payload : {};
    const merged = mergeRenderPersonalization(payload, options);
    // Nothing composited (overlays disabled, or nothing drawable): keep the
    // studio's own payload reference so the render is byte-identical.
    if (!Array.isArray(merged[RENDER_STUDIO_OVERLAY_PARAM])) return hasPayload ? payload : {};
    return merged;
  } catch (err) {
    console.warn('[studioBridge] personalization skipped for this render:', err);
    return hasPayload ? payload : {};
  }
}
