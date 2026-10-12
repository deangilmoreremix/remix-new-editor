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
 *   At the point where the studio already uploads a reference image,
 *   call `resolveForRenderStudio()` and merge the returned
 *   `referenceImages` / `promptPrefix` into the existing payload.
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
 * Build the personalization slice for a still-render request.
 *
 * @param {Object} [opts]
 * @param {number} [opts.maxImages=6] - cap reference images
 * @returns {{ referenceImages: {url: string, role: string}[], promptPrefix: string, clientProfile: object|null, assetIds: string[], lastFrameUrl: string|null }}
 */
export function resolveForRenderStudio(opts = {}) {
  const library = assetLibraryStore.getState ? assetLibraryStore.getState() : assetLibraryStore;
  const client = clientProfileStore.getCurrent ? clientProfileStore.getCurrent() : null;
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
  const client = clientProfileStore.getCurrent ? clientProfileStore.getCurrent() : null;

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
  const client = clientProfileStore.getCurrent ? clientProfileStore.getCurrent() : null;
  return Boolean(client) || collect(library, IMAGE_REFERENCE_ROLES).length > 0;
}
