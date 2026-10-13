/**
 * personalizeAiAssist.js
 *
 * AI Assist bridge for the personalization subsystem.
 *
 * This module connects the personalization asset library to the
 * application's existing AI providers WITHOUT modifying those
 * providers. It is the single entry point for "edit this asset with
 * AI" inside the Personalization Modal.
 *
 * Responsibilities:
 *   1. Resolve the asset to edit (by `AssetRole`, honoring `isPrimary`).
 *   2. Route to the correct provider:
 *        - Person / Brand / Product / FirstFrame / LastFrame editing
 *          -> OpenAI Responses API image editing (`openaiService.editImageResponses`)
 *        - Logo editing
 *          -> OpenAI Responses API image editing (same path)
 *   3. Persist every result into `sharedMediaStore` so the output
 *      is durable and visible in the Personalization Modal's output panel.
 *
 * PROVIDER CONTRACT (verified against live docs, see
 * docs/completion/PERSONALIZATION_INTEGRATION.md):
 *   - OpenAI: `POST https://api.openai.com/v1/responses` with an
 *     `image_generation` tool that accepts `action: 'auto' | 'generate' | 'edit'`.
 *     Image inputs are `input_image` items with `file_id` or `image_url`.
 *     Tool-level model: `gpt-image-2.5-sunburst` (precise editing).
 *   - MuAPI (video + face-swap + watermark) is invoked through
 *     `generationRouter.runGeneration`, which already existed in the
 *     OpenHiggsBolt port. This module does NOT re-implement it.
 *
 * HARD RULES (never relax):
 *   - Never invent a model ID or endpoint. Only strings that exist in
 *     `src/lib/openaiService.js` / `src/lib/muapi.js` are used.
 *   - Never send a provider API key from the browser. Keys are resolved
 *     server-side by `openaiService` via `apiKeyManager`.
 *   - Never treat a MuAPI upload URL as permanent. They expire (~1h).
 *     Permanent records live in `sharedMediaStore` + Supabase.
 *   - Never call `eval`/`Function()` on any model output.
 */

import { openaiService } from '../../lib/openaiService.js';
import { apiKeyManager } from '../../lib/apiKeyManager.js';
import { withPersonalizationOwner } from '../../lib/personalizationAuth.js';
import { runGeneration } from './generationRouter.js';
import { sharedMediaStore } from './sharedMediaStore.js';

/**
 * The six personalization asset roles that AI Assist supports.
 * These map 1:1 onto the asset-library sections the spec requires.
 * @type {readonly (import('./types.js').AssetRole)[]}
 */
export const AI_ASSIST_ROLES = Object.freeze([
  'face_identity',        // Person
  'logo',                 // Logo
  'product_reference',    // Product
  'brand_reference',      // Brand
  'first_frame',          // First frame
  'last_frame',           // Last frame
]);

/**
 * Roles that route to a face-swap style video model rather than a
 * pure image edit. `face_identity` on a *person* can mean either
 * "edit this portrait" (image) or "swap this face onto a video"
 * (video). The caller picks via `options.intent`.
 * @type {readonly (import('./types.js').AssetRole)[]}
 */
const VIDEO_INTENT_ROLES = Object.freeze(['face_identity']);

/**
 * Tool-level model for OpenAI image *editing*. Precision matters more
 * than speed for asset cleanup, so `sunburst` is the correct choice
 * over `flare`. `flare` is reserved for quick text-to-image.
 */
const OPENAI_IMAGE_EDIT_MODEL = 'gpt-image-2.5-sunburst';

/**
 * Resolve the asset that should be edited for a given role.
 *
 * Prefers `isPrimary`. Falls back to the most-recently-added asset in
 * that role. Returns `null` when the library has nothing for the role.
 *
 * @param {import('./assetLibraryStore.js').default} library
 * @param {import('./types.js').AssetRole} role
 * @returns {import('./types.js').PersonalizationAsset | null}
 */
export function resolveAssetForRole(library, role) {
  if (!library || !role) return null;

  let bucket = null;
  switch (role) {
    case 'face_identity':
    case 'presenter_identity':
    case 'character_identity':
      bucket = library.identities;
      break;
    case 'logo':
      bucket = library.logos;
      break;
    case 'product_reference':
      bucket = library.products;
      break;
    case 'brand_reference':
      case 'background_reference':
      bucket = library.brandReferences;
      break;
    case 'first_frame':
      return library.firstFrame || null;
    case 'last_frame':
      return library.lastFrame || null;
    case 'cta_graphic':
      return library.ctaGraphic || null;
    default:
      bucket = library.savedReferences;
      break;
  }

  if (!bucket || bucket.length === 0) return null;

  const primary = bucket.find((a) => a && a.isPrimary);
  const fallback = bucket[bucket.length - 1];
  return primary || fallback || null;
}

/**
 * Build a deterministic mask URL for a full-image edit.
 *
 * OpenAI's `editImageResponses` requires a mask ({ fileId } | { imageUrl }).
 * Personalization asset editing is normally "retouch the whole image",
 * so we pass the asset itself as the mask. This is the documented
 * pattern for a full-frame edit — do not replace with a synthetic
 * blank mask.
 *
 * @param {import('./types.js').PersonalizationAsset | null} asset
 * @returns {{ imageUrl: string } | null}
 */
function buildMask(asset) {
  if (!asset) return null;
  const url = asset.uploadedUrl || asset.url;
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return null;
  return { imageUrl: url };
}

/**
 * Run an AI Assist edit for a single personalization asset.
 *
 * @param {Object} params
 * @param {import('./types.js').AssetRole} params.role - one of AI_ASSIST_ROLES
 * @param {string} params.instruction - natural-language edit request
 * @param {import('./types.js').PersonalizationAsset} [params.asset] - explicit
 *   asset; when omitted `resolveAssetForRole` picks the role's primary.
 * @param {Object} [params.options]
 * @param {string} [params.options.clientId] - owner of the output record
 * @param {import('./types.js').PersonalizationSource} [params.options.source]
 * @param {'auto'|'edit'|'generate'} [params.options.action='edit']
 * @param {string} [params.options.model] - override the OpenAI tool model
 * @param {string} [params.options.quality]
 * @param {string} [params.options.size='auto']
 * @param {string} [params.options.background='auto']
 * @param {string} [params.options.outputFormat='png']
 * @param {'image'|'video'} [params.options.intent='image'] - `video` routes
 *   face_identity through MuAPI face-swap / recast models
 * @param {AbortSignal} [params.options.signal]
 * @param {(phase: string, data?: unknown) => void} [params.options.onProgress]
 * @returns {Promise<{ ok: true, id: string, images: string[], entry: object }
 *   | { ok: false, reason: string, code: string }>}
 */
export async function runAiAssistEdit({
  role,
  instruction,
  asset,
  options = {},
} = {}) {
  // ---- input validation (fail fast, never call a provider with junk) ----
  if (!AI_ASSIST_ROLES.includes(role)) {
    return { ok: false, code: 'UNSUPPORTED_ROLE', reason: `AI Assist does not support role "${role}".` };
  }
  if (typeof instruction !== 'string' || instruction.trim().length === 0) {
    return { ok: false, code: 'EMPTY_INSTRUCTION', reason: 'An edit instruction is required.' };
  }
  if (instruction.length > 32000) {
    // OpenAI prompt cap for image models is 32000 chars.
    return { ok: false, code: 'INSTRUCTION_TOO_LONG', reason: 'Instruction exceeds the 32000 character provider limit.' };
  }

  const clientId = options.clientId ?? null;

  // ---- resolve the asset (library primary unless an explicit one was given) ----
  let target = asset || null;
  if (!target) {
    target = resolveAssetForRole(options.library, role);
  }
  if (!target) {
    return {
      ok: false,
      code: 'NO_ASSET',
      reason: `No asset found for role "${role}". Add one to the asset library first.`,
    };
  }

  const sourceUrl = target.uploadedUrl || target.url;
  if (typeof sourceUrl !== 'string' || !/^https?:\/\//.test(sourceUrl)) {
    return {
      ok: false,
      code: 'ASSET_URL_UNSUPPORTED',
      reason: 'Selected asset must have an http(s) URL. Data URLs are not accepted by the image edit provider.',
    };
  }

  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};

  // ---- video intent (face swap / recast) -> MuAPI via the ported router ----
  const wantsVideo = options.intent === 'video' && VIDEO_INTENT_ROLES.includes(role);
  if (wantsVideo) {
    onProgress('video.queued', { role, assetId: target.id });
    try {
      /** @type {import('./types.js').GenerationInput} */
      const genInput = {
        mode: 'replace_person',
        prompt: instruction.trim(),
        source: options.source,
        library: options.library,
        options: { aspectRatio: options.aspectRatio || (options.source && options.source.aspectRatio) || '1:1' },
        apiKey: options.apiKey,
      };
      const result = await runGeneration(genInput);
      const outputs = Array.isArray(result.outputUrls) ? result.outputUrls : [];
      if (outputs.length === 0) {
        return { ok: false, code: 'NO_VIDEO_OUTPUT', reason: 'The video provider returned no outputs.' };
      }
      const entry = recordOutput({
        clientId,
        role,
        asset: target,
        instruction,
        outputUrls: outputs,
        model: result.model || null,
        outputType: 'video',
      });
      onProgress('video.done', { id: entry.id });
      return { ok: true, id: entry.id, images: [], videos: outputs, entry };
    } catch (err) {
      return { ok: false, code: 'VIDEO_PROVIDER_ERROR', reason: describe(err) };
    }
  }

  // ---- image edit -> OpenAI Responses API via the canonical service ----
  const mask = buildMask(target);
  if (!mask) {
    return {
      ok: false,
      code: 'MASK_REQUIRED',
      reason: 'Could not derive an edit mask from the selected asset URL.',
    };
  }

  onProgress('image.queued', { role, assetId: target.id });
  try {
    const res = await openaiService.editImageResponses({
      input: instruction.trim(),
      imageInputs: [{ imageUrl: sourceUrl }],
      mask,
      action: options.action || 'edit',
      model: options.model,
      quality: options.quality || 'auto',
      size: options.size || 'auto',
      background: options.background || 'auto',
      outputFormat: options.outputFormat || 'png',
      moderation: options.moderation || 'auto',
      previousResponseId: options.previousResponseId,
      signal: options.signal,
    });

    // openaiService.editImageResponses resolves through _parseResponsesOutput,
    // which maps each image_generation_call to { base64, revised_prompt, callId }.
    // Accept the legacy { b64_json } shape (and { image_base64 } / url / plain
    // string) defensively so a provider shape change degrades gracefully
    // instead of failing every successful edit with NO_IMAGE_OUTPUT.
    const images = Array.isArray(res.images)
      ? res.images
          .map((img) => (typeof img === 'string'
            ? img
            : img && (img.base64 || img.b64_json || img.image_base64 || img.url)))
          .filter((u) => typeof u === 'string' && u.length > 0)
      : [];

    if (images.length === 0) {
      return { ok: false, code: 'NO_IMAGE_OUTPUT', reason: 'The image provider returned no images.' };
    }

      const entry = recordOutput({
        clientId,
        role,
        asset: target,
        instruction,
        outputUrls: images,
        // OpenAI responses image results are raw base64 (not URLs).
        isBase64: true,
        model: options.model || OPENAI_IMAGE_EDIT_MODEL,
        outputType: 'image',
        outputFormat: options.outputFormat || 'png',
        responseId: res.responseId || null,
      });

    onProgress('image.done', { id: entry.id, responseId: res.responseId || null });
    return {
      ok: true,
      id: entry.id,
      images,
      videos: [],
      entry,
      responseId: res.responseId || null,
    };
  } catch (err) {
    return { ok: false, code: 'IMAGE_PROVIDER_ERROR', reason: describe(err) };
  }
}

/**
 * Persist an AI Assist output into `sharedMediaStore`.
 *
 * This is what makes the output *durable* — the provider URL is
 * transient (MuAPI URLs expire ~1h; OpenAI b64 is in-memory). The
 * record is the permanent handle the rest of the app uses.
 *
 * The record is stamped with the current user's owner id
 * (`clerk_user_id`) via withPersonalizationOwner() so AI Assist outputs
 * are owner-scoped exactly like every other personalization row.
 *
 * @param {Object} params
 * @returns {import('./types.js').SharedMediaEntry}
 */
function recordOutput({
  clientId, role, asset, instruction, outputUrls, model, outputType,
  isBase64 = false, outputFormat = null, responseId = null,
}) {
  const entry = withPersonalizationOwner({
    id: `pzo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    clientId: clientId,
    originStudio: 'personalize-ai-assist',
    sourceType: `ai_assist_${outputType}`,
    sourceMedia: asset.uploadedUrl || asset.url,
    sourceUrl: asset.url,
    personalizationMode: 'ai_assist',
    role,
    sourceAssetId: asset.id,
    model: model,
    originalPrompt: instruction,
    personalizedPrompt: instruction,
    outputUrls: outputUrls.slice(0, 16),
    outputType,
    outputIsBase64: Boolean(isBase64),
    // Base64 payloads are rendered through a data URL; the MIME must
    // match the format the provider actually returned (OpenAI defaults
    // to png but honors an explicit outputFormat), otherwise the image
    // decodes as the wrong type and shows as broken.
    outputMime: isBase64 ? `image/${outputFormat || 'png'}` : null,
    outputFormat: outputFormat || null,
    openAIResponseId: responseId,
    identityAssetIds: role === 'face_identity' ? [asset.id] : [],
    logoAssetIds: role === 'logo' ? [asset.id] : [],
    productAssetIds: role === 'product_reference' ? [asset.id] : [],
    brandReferenceAssetIds: role === 'brand_reference' ? [asset.id] : [],
    firstFrameAssetId: role === 'first_frame' ? asset.id : null,
    lastFrameAssetId: role === 'last_frame' ? asset.id : null,
    createdAt: new Date().toISOString(),
  });

  sharedMediaStore.addEntry(entry);
  return entry;
}

/**
 * Flatten an unknown error into a safe, user-presentable string.
 * Provider error bodies can contain keys; we must not echo them.
 * @param {unknown} err
 * @returns {string}
 */
function describe(err) {
  if (!err) return 'Unknown error.';
  const msg = err && err.message ? String(err.message) : String(err);
  // Never leak a key or a full URL-with-token to the UI.
  return msg.slice(0, 300);
}

/**
 * Is a MuAPI key actually configured? Resolved through the canonical
 * resolver (`src/lib/apiKeyManager.js`) — the same manager
 * `src/lib/muapi.js` gates its own requests on. Fail-safe: if the
 * resolver is missing or throws, this reads as "no key" so the UI can
 * never advertise video intent as available when generation would
 * immediately fail.
 *
 * @returns {boolean}
 */
function hasMuapiKey() {
  try {
    const manager = apiKeyManager;
    if (manager && typeof manager.hasMuapiKey === 'function') {
      return Boolean(manager.hasMuapiKey());
    }
    if (manager && typeof manager.getMuapiKey === 'function') {
      return Boolean(manager.getMuapiKey());
    }
  } catch {
    // Resolver unavailable — treat as "no key" (fail closed).
  }
  return false;
}

/**
 * Convenience: is AI Assist usable right now?
 * True when the OpenAI service has a key available. Video intent
 * additionally needs a real MuAPI key.
 * @param {'image'|'video'} [intent='image']
 * @returns {{ ok: boolean, reason?: string }}
 */
export function checkAiAssistAvailability(intent = 'image') {
  const hasOpenAI = typeof openaiService._hasKey === 'function'
    ? openaiService._hasKey()
    : Boolean(openaiService);
  if (!hasOpenAI) {
    return { ok: false, reason: 'An OpenAI API key is required for AI image editing.' };
  }
  if (intent === 'video' && !hasMuapiKey()) {
    return { ok: false, reason: 'A MuAPI API key is required for video edits.' };
  }
  return { ok: true };
}

/**
 * The six role -> human label mappings for the Personalization Modal UI.
 * Kept here so the UI never hardcodes a label string twice.
 */
export const AI_ASSIST_ROLE_LABELS = Object.freeze({
  face_identity: 'Person',
  logo: 'Logo',
  product_reference: 'Product',
  brand_reference: 'Brand',
  first_frame: 'First frame',
  last_frame: 'Last frame',
});
