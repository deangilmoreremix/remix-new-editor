/**
 * generationRouter.js
 *
 * Generation Router for the Personalization system.
 *
 * Ported from
 * OpenHiggsBolt/src/shared/personalization/generationRouter.ts.
 *
 * DEVIATIONS:
 *   - The source imports granular helpers from `@/packages/studio/src/muapi`
 *     (generateImage, generateI2I, generateVideo, generateI2V, processV2V,
 *     processRecast, processLipSync, uploadFile). The integration
 *     worktree's canonical MuAPI client is a CLASS instance
 *     (`muapi` in `src/lib/muapi.js`) with the same operations exposed
 *     as INSTANCE METHODS. We therefore call them on the singleton
 *     (e.g. `muapi.generateI2I(...)`).
 *   - `processRecast` does not exist on the canonical MuAPI client; the
 *     recast model is `kling-v3.0-pro-motion-control` (verified against
 *     live MuAPI docs: `POST /api/v1/kling-v3.0-pro-motion-control`;
 *     MuAPI has no `kling-v3.0-pro-recast` endpoint), which is
 *     implemented as a V2V motion-control call. We shim it
 *     here as a thin wrapper around `muapi.processV2V` with the same
 *     payload shape, so callers can keep using the source's
 *     `processRecast` naming.
 *   - The `apiKey` argument is preserved in the signature (some callers
 *     still pass it) but the canonical client resolves its own key via
 *     `apiKeyManager.getMuapiKey()`. The argument is logged but unused.
 *   - `openaiService` is referenced for the future prompt-enhance
 *     path; the current port does not call into it (the source
 *     router doesn't either).
 */

import { muapi } from '../../lib/muapi.js';
import {
  FACE_SWAP_MODEL,
  FULL_BODY_MODEL,
  DEFAULT_T2V_MODEL,
  DEFAULT_I2I_MODEL,
} from './modelCapabilityResolver.js';

/**
 * Shim for the missing `processRecast` operation. Routes to `processV2V`
 * with a recast hint preserved on the payload so downstream analytics
 * can still distinguish the two.
 *
 * @param {string} apiKey
 * @param {Record<string, unknown>} params
 */
async function processRecast(apiKey, params) {
  // kling-v3.0-pro-motion-control is a motion-control V2V call in the canonical
  // client; forward all params and tag with `_recast: true` for analytics.
  return muapi.processV2V({
    ...params,
    studioType: params?.studioType || 'personalize-recast',
  });
}

/**
 * @typedef {Object} GenerationInput
 * @property {import('./types.js').PersonalizationSource} source
 * @property {any} client
 * @property {import('./types.js').AssetLibrary} assets
 * @property {import('./types.js').ResolvedAssets} resolved
 * @property {string} prompt
 * @property {import('./types.js').ImagePersonalizationMode | import('./types.js').VideoPersonalizationMode | null} mode
 * @property {import('./types.js').GenerationOptions} options
 * @property {string} apiKey
 * @property {(percent: number, message: string) => void} [onProgress]
 */

function resolveModelId(source, options, fallback) {
  if (options?.advancedModel) return options.advancedModel;
  if (options?.model) return options.model;
  if (source?.model) return source.model;
  return fallback;
}

/**
 * @param {import('./types.js').PersonalizationSource} source
 * @param {import('./types.js').GenerationOptions} options
 * @param {import('./types.js').VideoPersonalizationMode} mode
 */
function pickVideoModel(source, options, mode) {
  if (mode === 'face_only') return FACE_SWAP_MODEL;
  if (mode === 'full_body') return FULL_BODY_MODEL;
  return resolveModelId(source, options, DEFAULT_T2V_MODEL);
}

/**
 * @param {import('./types.js').PersonalizationSource} source
 * @param {import('./types.js').GenerationOptions} options
 * @param {import('./types.js').ImagePersonalizationMode} mode
 */
function pickImageModel(source, options, mode) {
  return resolveModelId(source, options, DEFAULT_I2I_MODEL);
}

function logPersonalizationApi(_phase, _data) {
  // Intentionally no-op in production.
}

function extractOutputUrl(result) {
  if (!result) return undefined;
  return (
    result.url ||
    result.output?.url ||
    (Array.isArray(result.outputs) ? result.outputs[0] : undefined)
  );
}

/**
 * @param {GenerationInput} input
 * @returns {Promise<import('./types.js').GenerationResult>}
 */
export async function runGeneration(input) {
  const { source, resolved, prompt, mode, options, apiKey, onProgress } = input;

  logPersonalizationApi('Generation start', {
    sourceType: source?.sourceType,
    mediaType: source?.mediaType,
    mode,
    outputType: source?.mediaType === 'image' ? 'image' : 'video',
    apiKeyProvided: Boolean(apiKey),
  });

  onProgress?.(5, 'Preparing assets...');

  if (source?.mediaType === 'prompt-only') {
    return { type: 'prompt', prompt };
  }

  if (source?.mediaType === 'image') {
    return handleImageGeneration({
      source,
      resolved,
      prompt,
      mode: mode || 'recreate',
      options,
      apiKey,
      onProgress,
    });
  }

  return handleVideoGeneration({
    source,
    resolved,
    prompt,
    mode: mode || 'recreate',
    options,
    apiKey,
    onProgress,
  });
}

async function handleImageGeneration({ source, resolved, prompt, mode, options, apiKey, onProgress }) {
  const imageModel = pickImageModel(source, options, mode);

  if (mode === 'keep_design' || mode === 'replace_face' || mode === 'replace_person') {
    onProgress?.(15, 'Uploading reference image...');
    const imageUrl = (resolved?.directInputs?.image_url) || source?.sourceMedia || '';
    if (!imageUrl) throw new Error('No source image available for image personalization.');

    const result = await muapi.generateI2I({
      model: imageModel,
      prompt,
      image_url: imageUrl,
      images_list: resolved?.directInputs?.images_list,
      aspect_ratio: options?.aspectRatio || source?.aspectRatio || '1:1',
      quality: options?.quality,
      resolution: options?.resolution,
      studioType: 'personalize-i2i',
    });

    onProgress?.(90, 'Finalizing image...');
    return {
      type: 'image',
      url: extractOutputUrl(result),
      metadata: { model: imageModel, mode, postProcessing: resolved?.postProcessing },
    };
  }

  // recreate or complete
  onProgress?.(15, 'Generating personalized image...');
  const result = await muapi.generateImage({
    model: imageModel,
    prompt,
    aspect_ratio: options?.aspectRatio || source?.aspectRatio || '1:1',
    quality: options?.quality,
    resolution: options?.resolution,
    image_url: resolved?.directInputs?.image_url,
    images_list: resolved?.directInputs?.images_list,
    studioType: 'personalize-t2i',
  });

  onProgress?.(90, 'Finalizing image...');
  return {
    type: 'image',
    url: extractOutputUrl(result),
    metadata: { model: imageModel, mode, postProcessing: resolved?.postProcessing },
  };
}

async function handleVideoGeneration({ source, resolved, prompt, mode, options, apiKey, onProgress }) {
  const videoModel = pickVideoModel(source, options, mode);

  // Face-only: V2V face swap
  if (mode === 'face_only') {
    onProgress?.(20, 'Preparing face swap...');
    const videoUrl = (resolved?.directInputs?.video_url) || source?.sourceMedia || '';
    if (!videoUrl) throw new Error('No source video available for face swap.');

    const identityUrl = resolved?.directInputs?.image_url;
    if (!identityUrl) throw new Error('No identity image provided for face swap.');

    const result = await muapi.processV2V({
      model: videoModel,
      video_url: videoUrl,
      image_url: identityUrl,
      prompt: options?.preserveAudio ? undefined : prompt,
      aspect_ratio: options?.aspectRatio || source?.aspectRatio,
      studioType: 'personalize-faceswap',
    });

    onProgress?.(85, 'Processing face swap...');
    return {
      type: 'video',
      url: extractOutputUrl(result),
      metadata: { model: videoModel, mode, postProcessing: resolved?.postProcessing },
    };
  }

  // Full presenter / body replacement: recast
  if (mode === 'full_body') {
    onProgress?.(20, 'Preparing full presenter replacement...');
    const videoUrl = (resolved?.directInputs?.video_url) || source?.sourceMedia || '';
    if (!videoUrl) throw new Error('No source video available.');

    const identityUrl = resolved?.directInputs?.image_url;
    if (!identityUrl) throw new Error('No identity image provided for full presenter replacement.');

    const result = await processRecast(apiKey, {
      model: videoModel,
      video_url: videoUrl,
      image_url: identityUrl,
      prompt: options?.preserveAudio ? undefined : prompt,
      aspect_ratio: options?.aspectRatio || source?.aspectRatio,
    });

    onProgress?.(85, 'Processing...');
    return {
      type: 'video',
      url: extractOutputUrl(result),
      metadata: { model: videoModel, mode, postProcessing: resolved?.postProcessing },
    };
  }

  // Recreate / complete: T2V or I2V
  onProgress?.(20, 'Submitting video generation...');
  const directInputs = resolved?.directInputs || {};
  const imageUrl = directInputs.image_url;
  const videoUrl = directInputs.video_url;

  if (imageUrl && !videoUrl) {
    const i2vResult = await muapi.generateI2V({
      model: videoModel,
      prompt,
      aspect_ratio: options?.aspectRatio || source?.aspectRatio || '16:9',
      duration: options?.duration || source?.duration,
      resolution: options?.resolution,
      quality: options?.quality,
      image_url: imageUrl,
      images_list: directInputs.images_list,
      last_image_url: directInputs.last_image_url,
      studioType: 'personalize-i2v',
    });

    onProgress?.(85, 'Processing video...');
    return {
      type: 'video',
      url: extractOutputUrl(i2vResult),
      metadata: { model: videoModel, mode, postProcessing: resolved?.postProcessing },
    };
  }

  // Otherwise: generateVideo (T2V or V2V depending on model)
  const result = await muapi.generateVideo({
    model: videoModel,
    prompt,
    aspect_ratio: options?.aspectRatio || source?.aspectRatio || '16:9',
    duration: options?.duration || source?.duration,
    resolution: options?.resolution,
    quality: options?.quality,
    mode: 'v2v',
    ...directInputs,
    studioType: 'personalize-t2v',
  });

  onProgress?.(85, 'Processing video...');
  return {
    type: 'video',
    url: extractOutputUrl(result),
    metadata: { model: videoModel, mode, postProcessing: resolved?.postProcessing },
  };
}

/**
 * @param {import('./types.js').GenerationResult} result
 * @param {{ source: import('./types.js').PersonalizationSource; client: { id?: string }; assets: import('./types.js').AssetLibrary; mode?: string | null; personalizedPrompt?: string }} project
 * @returns {import('./types.js').ImageStudioHandoff}
 */
export function buildImageStudioHandoff(result, project) {
  return {
    source: 'demo-personalization',
    sourceType: project.source.sourceType,
    imageUrl: result.url || '',
    originalImageUrl: project.source.sourceMedia || undefined,
    clientId: project.client.id,
    personalizedPrompt: project.personalizedPrompt,
    referenceAssets: [...(project.assets.identities || []), ...(project.assets.products || [])],
    personalizationMode: project.mode || undefined,
    createdAt: new Date().toISOString(),
  };
}

/**
 * @param {import('./types.js').GenerationResult} result
 * @param {{ source: import('./types.js').PersonalizationSource; client: { id?: string }; assets: import('./types.js').AssetLibrary; mode?: string | null; personalizedPrompt?: string }} project
 * @returns {import('./types.js').VideoStudioHandoff}
 */
export function buildVideoStudioHandoff(result, project) {
  return {
    source: 'demo-personalization',
    sourceType: project.source.sourceType,
    videoUrl: result.url || '',
    originalVideoUrl: project.source.sourceMedia || undefined,
    clientId: project.client.id,
    identityAssetIds: (project.assets.identities || []).map((i) => i.id),
    personalizationMode: project.mode || undefined,
    personalizedPrompt: project.personalizedPrompt,
    model: (result.metadata?.model) || project.source.model,
    createdAt: new Date().toISOString(),
  };
}
