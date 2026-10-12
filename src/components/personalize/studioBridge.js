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
 * `getCurrent()` is still honoured first so existing callers/mocks keep
 * working, then the same value is resolved through the real store API.
 *
 * @returns {import('./clientProfileStore.js').ClientProfile|null}
 */
function readCurrentClient() {
  const store = clientProfileStore;
  if (!store) return null;

  if (typeof store.getCurrent === 'function') {
    try {
      return store.getCurrent() || null;
    } catch {
      return null;
    }
  }

  try {
    const id = typeof store.getCurrentClientId === 'function' ? store.getCurrentClientId() : null;
    if (!id) return null;
    if (typeof store.getClientById === 'function') return store.getClientById(id) || null;
    if (typeof store.getState === 'function') {
      const state = store.getState() || {};
      const clients = Array.isArray(state.clients) ? state.clients : [];
      return clients.find((c) => c && c.id === id) || null;
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
  const library = assetLibraryStore.getState ? assetLibraryStore.getState() : assetLibraryStore;
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
  const library = assetLibraryStore.getState ? assetLibraryStore.getState() : assetLibraryStore;
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
  const library = assetLibraryStore.getState ? assetLibraryStore.getState() : assetLibraryStore;
  const client = readCurrentClient();
  return Boolean(client) || collect(library, IMAGE_REFERENCE_ROLES).length > 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * RENDER STUDIO PROJECTION
 *
 * A *projection* of the personalization state onto the parameters
 * `captureRealVideo()` in `src/components/RenderPage.js:827` actually reads.
 * Nothing here re-generates, re-renders or re-decides anything, and nothing
 * edits the studio.
 *
 * VERIFIED PARAMETER SET (src/components/RenderPage.js:827–1182)
 * -------------------------------------------------------------
 *   videoUrl                :840   source video URL
 *   action                  :889   'export-video' | 'trailer-cut' | 'social-resize'
 *   settings.format         :907   container/codec to encode
 *   settings.frameRate      :916   capture fps
 *   settings.quality        :922   bitrate quality
 *   settings.aspectRatio    :889   canvas size (social-resize only)
 *   settings.contain        :1025  letterbox instead of cover (social-resize only)
 *   settings.duration       :942   render window, seconds
 *   settings.validateDecode :1121  run the decode probe
 *   timeRange               :940   { start, end } seconds (trailer-cut only)
 *   effects.brightness      :1045  colour multiplier
 *   effects.contrast        :1045  colour multiplier
 *   preset                  :1037  PRESET_CONFIG look (studio/user selection)
 *   onProgress              :953   (percent) => void
 *
 * NOTE: `settings.width` / `settings.height` are NOT read by the capture path
 * (canvas size comes from the source video or ASPECT_DIMS). Only the separate
 * web worker `src/lib/editor/renderExportWorker.js` reads them, and Render
 * Studio's `runExportWorker` does not use that worker.
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
 * The personalization concepts Render Studio could brand an export with, and
 * whether the capture pipeline has a real parameter for each.
 *
 * Every flag is `false` today: `captureRealVideo()` composites exactly one
 * image per frame — the source video, drawn once at `:1051` — with no
 * `fillText`/`strokeText` anywhere in the file and no image, logo, watermark,
 * text or prompt parameter in its signature. Writing a personalization value
 * onto a key the pipeline ignores would be fabrication (and would silently do
 * nothing), so the bridge refuses to. See `RENDER_STUDIO_OVERLAY_GAP`.
 *
 * @type {Readonly<Record<string, boolean>>}
 */
export const RENDER_STUDIO_OVERLAY_SUPPORT = Object.freeze({
  referenceImages: false,
  logoUrl: false,
  lastFrameUrl: false,
  textOverlay: false,
  prompt: false,
  branding: false,
});

/**
 * Machine-readable record of the gap, so it can be closed without being
 * re-derived. `unblock` is the exact change that lights the projection up.
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
    'captureRealVideo() (src/components/RenderPage.js:827) has exactly one draw call — '
    + 'ctx.drawImage(video, sourceRect…) at :1051 — no fillText/strokeText anywhere in the file, '
    + 'and its only inputs are videoUrl, action, timeRange, effects{brightness,contrast}, preset '
    + 'and settings{format,frameRate,quality,aspectRatio,contain,duration,validateDecode}. None of '
    + 'those can carry a client brand, and every one is either an output-encoding choice or an '
    + 'explicit studio/user selection.',
  unblock:
    'Give captureRealVideo() an `overlays` (or `branding`) parameter and composite it inside '
    + 'drawFrame() — a second ctx.drawImage for the logo/reference image plus fillText for the '
    + 'brand text — then flip the matching RENDER_STUDIO_OVERLAY_SUPPORT flag to true. The '
    + 'projection below already builds the values; only the pipeline is missing.',
});

/**
 * True when a projected overlay value actually carries something.
 * @param {unknown} value
 * @returns {boolean}
 */
function hasOverlayValue(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

/**
 * Find the first reference image with the given role.
 *
 * @param {{url: string, role: string}[]} references
 * @param {string} role
 * @returns {string|null}
 */
function firstReferenceByRole(references, role) {
  const match = (Array.isArray(references) ? references : []).find((r) => r && r.role === role);
  return match ? match.url : null;
}

/**
 * Brand text a real overlay step would render. Only emitted when the render
 * pipeline has a text parameter (it does not — see RENDER_STUDIO_OVERLAY_GAP).
 *
 * @param {import('./clientProfileStore.js').ClientProfile|null} client
 * @returns {string}
 */
function buildBrandOverlayText(client) {
  if (!client) return '';
  const lines = [];
  if (client.businessName) lines.push(client.businessName);
  if (client.ctaHeadline) lines.push(client.ctaHeadline);
  if (client.callToAction) lines.push(client.callToAction);
  if (client.website) lines.push(client.website);
  return lines.join('\n');
}

/**
 * Branding block an overlay step would consume. Only emitted when the render
 * pipeline has a branding parameter (it does not — see RENDER_STUDIO_OVERLAY_GAP).
 *
 * @param {import('./clientProfileStore.js').ClientProfile|null} client
 * @returns {object|null}
 */
function buildBrandingBlock(client) {
  if (!client) return null;
  const block = {};
  if (client.businessName) block.businessName = client.businessName;
  if (client.industry) block.industry = client.industry;
  if (client.productService) block.productService = client.productService;
  if (client.offer) block.offer = client.offer;
  if (client.website) block.website = client.website;
  if (client.phone) block.phone = client.phone;
  return hasOverlayValue(block) ? block : null;
}

/**
 * Project personalization into the branding/overlay payload Render Studio can
 * consume. Returns ONLY fields that map to a REAL `captureRealVideo`
 * parameter, and `{}` when personalization has nothing to contribute.
 *
 * The capture pipeline has no overlay/watermark/logo/text/branding/prompt
 * parameter at all (see `RENDER_STUDIO_OVERLAY_SUPPORT` and
 * `RENDER_STUDIO_OVERLAY_GAP`), so this returns a neutral `{}` today. That is
 * deliberate: the projection is written, the capability flags are explicit,
 * and the moment the render pipeline gains a parameter the mapping is a
 * one-flag change rather than a second integration pass.
 *
 * @param {{ settings?: object }} [options] - the studio's own output settings
 * @returns {object} the supported branding/overlay payload (possibly empty)
 */
export function buildRenderStudioOverlays({ settings } = {}) {
  const personalization = resolveForRenderStudio();
  const client = personalization.clientProfile;
  const references = personalization.referenceImages;

  // Everything personalization *could* contribute, keyed by the render
  // parameter it would land in.
  const candidates = {
    referenceImages: references.map((r) => r.url),
    logoUrl: firstReferenceByRole(references, 'logo'),
    lastFrameUrl: personalization.lastFrameUrl,
    textOverlay: buildBrandOverlayText(client),
    prompt: personalization.promptPrefix,
    branding: buildBrandingBlock(client),
  };

  // A value the studio already supplied always wins — personalization never
  // overrides an explicit studio selection.
  const studioSettings = settings && typeof settings === 'object' ? settings : {};

  const out = {};
  for (const [key, value] of Object.entries(candidates)) {
    if (!RENDER_STUDIO_OVERLAY_SUPPORT[key]) continue;
    if (!hasOverlayValue(value)) continue;
    if (studioSettings[key] != null) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Merge the Render Studio personalization projection into a
 * `captureRealVideo()` payload.
 *
 * - Returns a NEW object; the input is never mutated.
 * - STUDIO-SUPPLIED VALUES ALWAYS WIN. A contest is detected on both the
 *   payload root and `settings`, so a studio image/overlay/text value is kept
 *   verbatim.
 * - Never throws: any failure logs a warning and falls back to the original
 *   payload, so personalization can never break a render.
 *
 * @param {object} payload - the studio's existing payload
 * @param {{ settings?: object }} [options]
 * @returns {object} a new payload
 */
export function mergeRenderPersonalization(payload, options = {}) {
  const base = payload && typeof payload === 'object' ? payload : {};
  try {
    const overlays = buildRenderStudioOverlays(options);
    if (Object.keys(overlays).length === 0) return { ...base };

    const merged = { ...base };
    for (const [key, value] of Object.entries(overlays)) {
      // Some overlay parameters are read out of `settings` rather than the
      // payload root; contest is checked against whichever holds the key.
      const settingsScoped = RENDER_STUDIO_SETTINGS_KEYS.includes(key);
      const container = settingsScoped ? (base.settings || {}) : base;
      if (container[key] != null) continue; // studio wins
      if (settingsScoped) {
        merged.settings = { ...(base.settings || {}), [key]: value };
      } else {
        merged[key] = value;
      }
    }
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
 * @param {{ settings?: object }} [options]
 * @returns {object} the payload to capture with
 */
export function applyRenderStudioPersonalization(payload, options = {}) {
  try {
    if (!hasPersonalizationData()) return payload;
    return mergeRenderPersonalization(payload, options);
  } catch (err) {
    console.warn('[studioBridge] personalization skipped for this render:', err);
    return payload;
  }
}
