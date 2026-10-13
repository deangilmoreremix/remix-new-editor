/**
 * Shared generation orchestration helpers for template studios.
 *
 * Keeps model resolution, param assembly, validation, and error
 * formatting in one place so TemplateStudio and CinemaTemplateStudio
 * can stay focused on UI concerns.
 */

import { composeNegativePrompt } from './templateEngine.js';
import { getV2VModelById } from './models.js';

/**
 * Resolve a valid model ID for the given template.
 *
 * Order of precedence:
 *   1. preferred / template.model if it is type-compatible
 *   2. first model in the type-compatible fallback list
 *   3. type-specific hardcoded default
 *   4. 'flux-dev'
 */
export function resolveModel(template, preferred, modelListsByType) {
  const getFallbackList = (modelType) => modelListsByType[modelType] || [];
  const isValidModelForType = (modelId, modelType) => {
    if (!modelId || !modelType) return false;
    return !!getFallbackList(modelType).find(m => m && m.id === modelId);
  };
  // V2V models are routed through the t2v generation branch, so a t2v
  // template may legitimately use a v2v model.
  const isV2VModel = (modelId) => {
    if (!modelId) return false;
    return !!(modelListsByType.v2v || []).find(m => m && m.id === modelId);
  };

  const candidate = preferred || template.model;
  if (candidate && isValidModelForType(candidate, template.modelType)) {
    return candidate;
  }
  if (candidate && template.modelType === 't2v' && isV2VModel(candidate)) {
    return candidate;
  }

  const list = getFallbackList(template.modelType);
  if (list.length > 0 && list[0]?.id) {
    return list[0].id;
  }

  if (template.modelType === 't2v') return 'kling-v2.6-pro-t2v';
  if (template.modelType === 'i2v') return 'kling-v2.6-pro-i2v';
  return 'flux-dev';
}

/**
 * Default fallback model IDs keyed by modelType.
 * Used by CinemaTemplateStudio's local fallback path.
 */
export const DEFAULT_FALLBACK_MODELS = {
  t2i: 'flux-dev',
  i2i: 'flux-dev',
  t2v: 'kling-v2.6-pro-t2v',
  i2v: 'kling-v2.6-pro-i2v',
  v2v: 'kling-v2.6-pro-v2v',
};

/**
 * Normalize aspect ratio from template metadata.
 */
export function normalizeAspectRatio(template) {
  return template.aspectRatio || (template.aspectRatios ? template.aspectRatios[0] : null);
}

/**
 * Normalize duration from template metadata to a number of seconds.
 * Accepts numbers, numeric strings (e.g. "8") and objects with a
 * `default`/`min` field. Returns null when no usable value exists so
 * callers can omit the param entirely.
 */
export function normalizeDuration(template) {
  const raw = template.duration
    ? (typeof template.duration === 'object' ? template.duration.default : template.duration)
    : template.defaultParams?.duration;

  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') {
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Copy form state values into params for every input name present in formState.
 */
export function applyFormStateToParams(params, formState, allInputs) {
  allInputs.forEach(input => {
    if (formState[input.name]) {
      params[input.name] = formState[input.name];
    }
  });
}

/**
 * Attach a custom thumbnail URL to params when present.
 */
export function attachThumbnail(params, customThumbnailUrl) {
  if (customThumbnailUrl) {
    params.thumbnail_url = customThumbnailUrl;
  }
}

/**
 * Build a negative prompt from template metadata, form state, and enhanced specs.
 */
export function buildNegativePrompt(template, formState, specs) {
  const negNiche = (formState.niche && formState.niche !== 'auto-detect')
    ? formState.niche
    : (template.niche || '');
  return composeNegativePrompt(
    template.filmFamily || '',
    negNiche,
    formState.visualStyle || 'commercial'
  ) || specs.negativePrompt || '';
}

/**
 * Validate generation prerequisites.
 *
 * Returns an error message string if validation fails, or null when
 * the params are ready to generate.
 */
export function validateBeforeGenerate(template, params, allInputs, selectedModel) {
  const EFFECT_MODELS = ['ai-video-effects', 'motion-controls', 'video-effects', 'vfx'];
  const needsImageUrl = template.modelType === 'i2v' || template.modelType === 'i2i';
  const imageInput = allInputs.find(i => i.type === 'image' || i.type === 'frame');

  if (needsImageUrl && !params[imageInput?.name]) {
    return 'Please upload an image before generating.';
  }

  const isV2V = !!getV2VModelById(selectedModel);
  if (isV2V && !params.video_url) {
    return 'Please upload a video before generating.';
  }

  if (EFFECT_MODELS.includes(params.model) && !params.name) {
    return 'Please enter a name before generating.';
  }

  return null;
}

/**
 * Format a generation error for inline display, with optional retry affordance.
 *
 * @returns {{ userMessage: string, retryHtml: string }}
 */
export function formatGenerationError(err, retryCount, maxRetries) {
  const message = err.message || 'Generation failed';
  const userMessage = message.length > 80 ? `${message.slice(0, 80)}…` : message;
  const retryHtml = retryCount < maxRetries
    ? ' <button id="retry-btn" class="ml-2 underline text-emerald-200 hover:text-white">Retry</button>'
    : '';
  return { userMessage, retryHtml };
}
