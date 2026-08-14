/**
 * Thumbnail Template Validation
 *
 * Pure validation functions for thumbnail template objects, field values,
 * and prompt recipe constraints. No side effects; all functions return
 * boolean or throw ValidationError.
 */

/**
 * @typedef {Object} TemplateField
 * @property {string} key - Unique field identifier
 * @property {string} label - Human-readable label
 * @property {'text'|'textarea'|'select'|'multiselect'|'color'|'number'|'range'|'toggle'|'url'|'file'} type
 * @property {boolean} required - Whether the field must be provided
 * @property {string[]} [options] - Allowed values for select/multiselect
 * @property {string} [placeholder] - Placeholder text
 */

/**
 * @typedef {Object} PromptRecipe
 * @property {string} baseStyle - Core style tokens (e.g. "cinematic, 4K, high contrast")
 * @property {string} composition - Composition instructions
 * @property {string} subjectRules - Rules for the main subject
 * @property {string} referenceRules - How to incorporate reference images
 * @property {string} textRules - Guidance for text-in-image rendering
 * @property {string} finishingRules - Final polish / quality tokens
 */

/**
 * @typedef {Object} GenerationDefaults
 * @property {string} model - Default image model id
 * @property {'low'|'medium'|'high'|'auto'} quality - Default quality
 * @property {'png'|'webp'|'jpeg'} outputFormat - Default output format
 * @property {'transparent'|'opaque'|'auto'} background - Default background
 */

/**
 * @typedef {Object} ThumbnailTemplate
 * @property {string} id - Unique template id (slug)
 * @property {string} name - Display name
 * @property {string} category - Category key
 * @property {string[]} tags - Search/filter tags
 * @property {string} description - Short description
 * @property {string} [previewUrl] - URL to preview image
 * @property {string} [previewPrompt] - Example prompt shown in UI
 * @property {boolean} requiresReference - Whether any reference is required
 * @property {boolean} referenceRequired - Alias; kept for backward compat
 * @property {'face'|'product'|'scene'|'style'|'none'} referenceType - Kind of reference accepted
 * @property {number} minReferences - Minimum reference images required
 * @property {number} maxReferences - Maximum reference images allowed
 * @property {string[]} supportedAspectRatios - Allowed aspect ratios
 * @property {string[]} supportedPlatforms - Target platform keys
 * @property {'render-in-image'|'leave-space-for-overlay'} textMode - Text handling mode
 * @property {TemplateField[]} fields - User input fields
 * @property {PromptRecipe} promptRecipe - Prompt assembly recipe
 * @property {GenerationDefaults} generationDefaults - Default generation settings
 * @property {number} version - Schema version (must be 1)
 */

const VALID_TEXT_MODES = new Set(['render-in-image', 'leave-space-for-overlay']);
const VALID_FIELD_TYPES = new Set([
  'text', 'textarea', 'select', 'multiselect', 'color', 'number', 'range', 'toggle', 'url', 'file'
]);

/**
 * Custom error class for validation failures.
 */
export class ValidationError extends Error {
  /**
   * @param {string} message
   * @param {string} [field]
   */
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field || null;
  }
}

/**
 * Validate that a value is a non-empty string.
 * @param {*} value
 * @param {string} [field]
 * @returns {void}
 * @throws {ValidationError}
 */
export function requireString(value, field = 'value') {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${field} must be a non-empty string`, field);
  }
}

/**
 * Validate that a value is a valid aspect ratio string.
 * @param {string} value
 * @param {string} [field]
 * @returns {void}
 * @throws {ValidationError}
 */
export function requireAspectRatio(value, field = 'aspectRatio') {
  if (typeof value !== 'string' || !/^\d+:\d+$/.test(value.trim())) {
    throw new ValidationError(`${field} must be a valid aspect ratio (e.g. "16:9")`, field);
  }
}

/**
 * Validate a single template field object.
 * @param {TemplateField} field
 * @returns {void}
 * @throws {ValidationError}
 */
export function validateTemplateField(field) {
  if (!field || typeof field !== 'object') {
    throw new ValidationError('Field must be an object', 'field');
  }
  requireString(field.key, 'field.key');
  requireString(field.label, 'field.label');
  if (!VALID_FIELD_TYPES.has(field.type)) {
    throw new ValidationError(`field.type must be one of: ${[...VALID_FIELD_TYPES].join(', ')}`, 'field.type');
  }
  if (typeof field.required !== 'boolean') {
    throw new ValidationError('field.required must be a boolean', 'field.required');
  }
  if (field.options !== undefined && !Array.isArray(field.options)) {
    throw new ValidationError('field.options must be an array when provided', 'field.options');
  }
}

/**
 * Validate a prompt recipe object.
 * @param {PromptRecipe} recipe
 * @returns {void}
 * @throws {ValidationError}
 */
export function validatePromptRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object') {
    throw new ValidationError('promptRecipe must be an object', 'promptRecipe');
  }
  const requiredKeys = ['baseStyle', 'composition', 'subjectRules', 'referenceRules', 'textRules', 'finishingRules'];
  for (const key of requiredKeys) {
    if (typeof recipe[key] !== 'string' || recipe[key].trim().length === 0) {
      throw new ValidationError(`promptRecipe.${key} must be a non-empty string`, `promptRecipe.${key}`);
    }
  }
}

/**
 * Validate generation defaults.
 * @param {GenerationDefaults} defaults
 * @returns {void}
 * @throws {ValidationError}
 */
export function validateGenerationDefaults(defaults) {
  if (!defaults || typeof defaults !== 'object') {
    throw new ValidationError('generationDefaults must be an object', 'generationDefaults');
  }
  requireString(defaults.model, 'generationDefaults.model');
  const validQualities = ['low', 'medium', 'high', 'auto'];
  if (!validQualities.includes(defaults.quality)) {
    throw new ValidationError(`generationDefaults.quality must be one of: ${validQualities.join(', ')}`, 'generationDefaults.quality');
  }
  const validFormats = ['png', 'webp', 'jpeg'];
  if (!validFormats.includes(defaults.outputFormat)) {
    throw new ValidationError(`generationDefaults.outputFormat must be one of: ${validFormats.join(', ')}`, 'generationDefaults.outputFormat');
  }
  const validBackgrounds = ['transparent', 'opaque', 'auto'];
  if (!validBackgrounds.includes(defaults.background)) {
    throw new ValidationError(`generationDefaults.background must be one of: ${validBackgrounds.join(', ')}`, 'generationDefaults.background');
  }
}

/**
 * Validate a complete thumbnail template object.
 * @param {ThumbnailTemplate} template
 * @returns {void}
 * @throws {ValidationError}
 */
export function validateTemplate(template) {
  if (!template || typeof template !== 'object') {
    throw new ValidationError('Template must be an object', 'template');
  }

  requireString(template.id, 'template.id');
  requireString(template.name, 'template.name');
  requireString(template.category, 'template.category');
  if (!Array.isArray(template.tags) || template.tags.length === 0) {
    throw new ValidationError('template.tags must be a non-empty array', 'template.tags');
  }
  requireString(template.description, 'template.description');

  if (typeof template.version !== 'number' || template.version !== 1) {
    throw new ValidationError('template.version must be 1', 'template.version');
  }

  if (typeof template.requiresReference !== 'boolean') {
    throw new ValidationError('template.requiresReference must be a boolean', 'template.requiresReference');
  }
  if (typeof template.referenceRequired !== 'boolean') {
    throw new ValidationError('template.referenceRequired must be a boolean', 'template.referenceRequired');
  }
  const validRefTypes = new Set(['face', 'product', 'scene', 'style', 'none']);
  if (!validRefTypes.has(template.referenceType)) {
    throw new ValidationError(
      `template.referenceType must be one of: ${[...validRefTypes].join(', ')}`,
      'template.referenceType'
    );
  }
  if (!Number.isInteger(template.minReferences) || template.minReferences < 0) {
    throw new ValidationError('template.minReferences must be a non-negative integer', 'template.minReferences');
  }
  if (!Number.isInteger(template.maxReferences) || template.maxReferences < template.minReferences) {
    throw new ValidationError('template.maxReferences must be >= minReferences', 'template.maxReferences');
  }

  if (!Array.isArray(template.supportedAspectRatios) || template.supportedAspectRatios.length === 0) {
    throw new ValidationError('template.supportedAspectRatios must be a non-empty array', 'template.supportedAspectRatios');
  }
  for (const ratio of template.supportedAspectRatios) {
    requireAspectRatio(ratio, 'template.supportedAspectRatios');
  }

  if (!Array.isArray(template.supportedPlatforms) || template.supportedPlatforms.length === 0) {
    throw new ValidationError('template.supportedPlatforms must be a non-empty array', 'template.supportedPlatforms');
  }

  if (!VALID_TEXT_MODES.has(template.textMode)) {
    throw new ValidationError(
      `template.textMode must be one of: ${[...VALID_TEXT_MODES].join(', ')}`,
      'template.textMode'
    );
  }

  if (!Array.isArray(template.fields)) {
    throw new ValidationError('template.fields must be an array', 'template.fields');
  }
  for (const field of template.fields) {
    validateTemplateField(field);
  }

  validatePromptRecipe(template.promptRecipe);
  validateGenerationDefaults(template.generationDefaults);
}

/**
 * Validate field values against a template's field definitions.
 * @param {ThumbnailTemplate} template
 * @param {Record<string, unknown>} values
 * @returns {string[]} Array of error messages (empty if valid)
 */
export function validateFieldValues(template, values) {
  const errors = [];
  for (const field of template.fields) {
    const value = values[field.key];
    if (field.required && (value === undefined || value === null || String(value).trim() === '')) {
      errors.push(`${field.label} is required`);
      continue;
    }
    if (value === undefined || value === null || String(value).trim() === '') {
      continue;
    }
    if (field.type === 'select' || field.type === 'multiselect') {
      const allowed = field.options || [];
      const vals = Array.isArray(value) ? value : [value];
      for (const v of vals) {
        if (!allowed.includes(v)) {
          errors.push(`${field.label} has an invalid selection`);
        }
      }
    }
    if (field.type === 'number' || field.type === 'range') {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        errors.push(`${field.label} must be a number`);
      }
    }
    if (field.type === 'url') {
      try {
        new URL(String(value));
      } catch {
        errors.push(`${field.label} must be a valid URL`);
      }
    }
  }
  return errors;
}

/**
 * Check whether a template supports a given aspect ratio.
 * @param {ThumbnailTemplate} template
 * @param {string} aspectRatio
 * @returns {boolean}
 */
export function templateSupportsAspectRatio(template, aspectRatio) {
  return template.supportedAspectRatios.includes(aspectRatio);
}

/**
 * Check whether a template supports a given platform.
 * @param {ThumbnailTemplate} template
 * @param {string} platformKey
 * @returns {boolean}
 */
export function templateSupportsPlatform(template, platformKey) {
  return template.supportedPlatforms.includes(platformKey);
}

/**
 * Get the effective text mode for a template, with a safe fallback.
 * @param {ThumbnailTemplate} template
 * @returns {'render-in-image'|'leave-space-for-overlay'}
 */
export function getTemplateTextMode(template) {
  return VALID_TEXT_MODES.has(template.textMode) ? template.textMode : 'leave-space-for-overlay';
}

/**
 * Get the maximum allowed reference images for a template.
 * @param {ThumbnailTemplate} template
 * @returns {number}
 */
export function getTemplateMaxReferences(template) {
  return Math.max(0, template.maxReferences || 0);
}

export default {
  ValidationError,
  requireString,
  requireAspectRatio,
  validateTemplateField,
  validatePromptRecipe,
  validateGenerationDefaults,
  validateTemplate,
  validateFieldValues,
  templateSupportsAspectRatio,
  templateSupportsPlatform,
  getTemplateTextMode,
  getTemplateMaxReferences,
};
