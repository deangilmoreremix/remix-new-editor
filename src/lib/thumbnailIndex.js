/**
 * Thumbnail Index
 *
 * Central export point for all thumbnail-related modules.
 * Re-exports from:
 *   - thumbnailService
 *   - thumbnailPresets
 *   - thumbnailTemplateRegistry
 *   - thumbnailPlatformSpecs
 *   - thumbnailTemplateValidation
 *   - thumbnails (legacy thumbnail mapping utilities)
 *
 * Consumers should import from this file instead of reaching into
 * individual modules directly.
 */

// Service layer
export { ThumbnailService, default as thumbnailService } from './thumbnailService.js';

// Prompt builder (Phase 2)
export {
  buildThumbnailPrompt,
  buildBriefFromSocialCopy,
} from './thumbnailPromptBuilder.js';

// Recommendation service (Phase 2)
export { ThumbnailRecommendationService } from './thumbnailRecommendationService.js';

// Presets (legacy + current)
export {
  THUMBNAIL_PRESETS,
  PRESET_LIST,
  DEFAULT_PRESET_KEY,
  getPresetForTemplate,
  applyPresetToControls,
  applyPresetToBrief,
} from './thumbnailPresets.js';

// Template registry (Phase 2)
export {
  THUMBNAIL_TEMPLATES,
  getTemplateById,
  getAllTemplates,
  getTemplatesByCategory,
  getTemplatesByPlatform,
  getTemplatesByAspectRatio,
  searchTemplates,
  getTemplateCategories,
  TEMPLATE_CATEGORIES,
  validateRegistryTemplate,
  validateTemplateFieldValues,
} from './thumbnailTemplateRegistry.js';

// Platform specs (Phase 2)
export {
  PLATFORM_SPECS,
  getPlatformSpec,
  getSupportedPlatformKeys,
  resolvePlatformAspectRatio,
  resolvePlatformSize,
  platformRequiresTextOverlay,
  getPlatformInjectionText,
  REFERENCE_TYPE_RULES,
} from './thumbnailPlatformSpecs.js';

// Validation (Phase 2)
export {
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
} from './thumbnailTemplateValidation.js';

// Legacy thumbnail mapping utilities
export {
  resetThumbnailAssignments,
  saveCustomThumbnailToCache,
  clearCustomThumbnailCache,
  getCustomThumbnailFromCache,
  getStudioThumbnail,
  getHeroThumbnail,
  getToolThumbnail,
  getCategoryThumbnail,
  getPageThumbnail,
  getAppThumbnail,
  getTemplateThumbnail,
  getTemplateThumbnailCandidates,
  getTemplateThumbnailWithFallback,
  createThumbnailImg,
  createHeroSection,
} from './thumbnails.js';
