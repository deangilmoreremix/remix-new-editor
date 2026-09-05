/**
 * Mapping from CineGen node types to muapi model IDs.
 *
 * CineGen's fal/kie registry uses IDs like `fal-ai/flux/dev`, but muapi
 * uses short names like `flux-dev`. This module maps the node types so
 * execute.js can route image/video generation through the existing
 * MuapiClient (`src/lib/muapi.js`) with the correct model identifier.
 *
 * Models without a muapi equivalent (local, runpod, pod, SAM3, etc.)
 * are intentionally omitted and keep their existing provider behavior.
 */

/**
 * Resolve the muapi model ID for an image model node.
 *
 * @param {string} nodeType
 * @param {boolean} hasImageInputs - true when the node is operating in image-to-image mode
 * @returns {string|undefined} muapi model ID, or undefined if no muapi equivalent
 */
export function getMuapiImageModelId(nodeType, hasImageInputs = false) {
  const map = {
    'flux-dev': 'flux-dev',
    'flux-2-max': 'flux-2-pro',
    'fast-sdxl': 'sdxl-image',
    'flux-kontext': hasImageInputs ? 'flux-kontext-dev-i2i' : 'flux-kontext-dev-t2i',
    'nano-banana-pro': 'nano-banana-pro',
    'nano-banana-2': 'nano-banana-2',
    'fal-qwen-image-edit': 'qwen-image-edit',
    'qwen-image-layered': 'qwen-image',
  };

  return map[nodeType];
}

/**
 * Resolve the muapi model ID for a video model node.
 *
 * @param {string} nodeType
 * @returns {string|undefined} muapi model ID, or undefined if no muapi equivalent
 */
export function getMuapiVideoModelId(nodeType) {
  const map = {
    'veo-3-1': 'veo3-text-to-video',
    'kling-3-text': 'kling-v3.0-pro-text-to-video',
    'kling-3-image': 'kling-v3.0-pro-image-to-video',
    'kling-2-5-text': 'kling-v2.5-turbo-pro-t2v',
    'kling-2-5-image': 'kling-v2.5-turbo-pro-i2v',
    // Phase 5 Fill Gap/Extend already uses seedance-2.5-first-last-frame for
    // first/last-frame video generation. muapi does not expose a separate
    // Kling-branded first/last-frame model, so this intentionally reuses the
    // existing Seedance endpoint rather than adding a duplicate path.
    'kling-first-last': 'seedance-2.5-first-last-frame',
    'minimax-video': 'minimax-hailuo-02-pro-t2v',
    'wan-2-2': 'wan2.2-text-to-video',
    'seedance-2': 'seedance-2-text-to-video',
    'seedance-2-reference': 'seedance-2-omni-reference',
    'ltx-2-3-text': 'ltx-2.3-text-to-video',
    'ltx-2-3-image': 'ltx-2.3-image-to-video',
    'ltx-2-3-text-fast': 'ltx-2-fast-text-to-video',
    'ltx-2-3-image-fast': 'ltx-2-fast-image-to-video',
    'ltx-2-3-extend': 'ltx-2.3-video-extend',
    'sora-2': 'openai-sora-2-text-to-video',
  };

  return map[nodeType];
}

/**
 * Check whether a model node should be executed through muapi.
 *
 * @param {string} nodeType
 * @param {string} category
 * @returns {boolean}
 */
export function isMuapiModel(nodeType, category) {
  if (!category || (category !== 'image' && category !== 'video' && category !== 'image-edit')) {
    return false;
  }

  // Local / runpod / pod models stay on their existing runners
  if (nodeType.includes('-local') || nodeType.startsWith('runpod-') || nodeType.startsWith('pod-')) {
    return false;
  }

  // SAM3 and layer-decompose are interactive/specialized
  if (nodeType.startsWith('sam3-') || nodeType.startsWith('layer-decompose')) {
    return false;
  }

  return true;
}
