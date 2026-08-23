/**
 * OpenAI Configuration Service
 * Centralized configuration for OpenAI API integration
 */

import { apiKeyManager } from '../apiKeyManager.js';
import { t2iModels } from '../models.js';

/**
 * The one studio color scheme.
 *
 * Every studio surface (Image Studio is the reference implementation) renders
 * with the SmartVideo brand palette: neon `#d9ff00` primary on near-black,
 * zinc-400 secondary text. Modals used to theme themselves per studio, which
 * meant the GTM Boost / Thumbnail / Personalizer / Pexels dialogs looked
 * amber inside Image Studio, emerald inside Template Studio, purple inside
 * Video Studio, and so on — never matching the studio they were opened from.
 *
 * Keep this in sync with:
 *   - `src/styles/variables.css`  (`--color-primary`, `--color-on-primary`)
 *   - `src/styles/global.css`     (Tailwind `@theme` primary)
 *   - `tailwind.config.js`        (`colors.primary`)
 *
 * `onPrimary` is the text/icon color to use ON TOP of `primary`. The primary
 * is a high-luminance neon, so it must always be paired with black — never
 * white — or the label becomes unreadable.
 */
export const STUDIO_SCHEME = Object.freeze({
  primary: '#d9ff00',
  accent: '#c4e600',
  secondary: '#a1a1aa',
  onPrimary: '#000000',
});

/**
 * Theme keys that studios / pages pass to the shared modals. They all resolve
 * to {@link STUDIO_SCHEME}; the keys are kept so callers (and
 * `getAllStudioColorSchemes()`) keep working, and so a studio can be given a
 * bespoke palette later without touching every call site.
 */
export const STUDIO_THEME_KEYS = Object.freeze([
  'timeline-editor',
  'video-studio',
  'text-to-video',
  'image-to-video',
  'image-studio',
  'template-studio',
  'cinema-studio',
  'cinema-template-studio',
  'editor-page',
  'lip-sync-studio',
  'director',
  'video-agent',
  'character-studio',
  'avatar-studio',
  'storyboard-studio',
  'chat-studio',
  'audio-studio',
  'cinematic-template-wizard',
  'influencer-studio',
  'commercial-studio',
  'effects-studio',
  'training-studio',
  'edit-studio',
  'video-tools-studio',
  'upscale-studio',
  'ai-vfx',
]);

/**
 * Studio / app color schemes. Single source of truth shared by
  * GTMPromptModal, TemplateThumbnailModal, PersonalizeModal,
  * and the Pexels browser.
 */
export const STUDIO_COLOR_SCHEMES = Object.freeze(
  STUDIO_THEME_KEYS.reduce((acc, key) => {
    acc[key] = { ...STUDIO_SCHEME };
    return acc;
  }, {})
);

class OpenAIConfig {
  constructor() {
    this.defaultConfig = {
      imageModel: 'gpt-image-2',
      baseURL: 'https://api.muapi.ai/api/v1/',
      timeout: 120000, // 2 minutes for image generation
      maxRetries: 3,
      supportedImageModels: [
        'gpt-image-2',
        'gpt-image-1.5',
        'gpt-image-1',
        'gpt-image-1-mini'
      ],
      // Mainline model used by the Responses API image generation tool. The
      // tool selects the underlying GPT Image model; this is the conversational
      // model that supports calling the image_generation tool.
      responsesModel: 'gpt-5.6',
      supportedResponsesModels: [
        'gpt-5.6',
        'gpt-5.5',
        'gpt-5.1',
        'gpt-5'
      ],
      // Thumbnail overrides used by ThumbnailService / ai-thumbnail-generator
      // Default to OpenAI's gpt-image-2 so the v2 image generation/editing path
      // is the out-of-the-box experience (muapi models remain selectable).
      thumbnailModel: 'gpt-image-2',
      thumbnailAllModels: [
        ...['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'].map(id => ({
          id, name: id, provider: 'openai', provider_name: 'OpenAI',
        })),
        ...t2iModels.map(m => ({
          id: m.id,
          name: m.name,
          provider: m.provider || 'muapi',
          provider_name: m.provider_name || m.provider || 'MuAPI',
        })),
      ],
      // Per-model allowlist — gpt-image-2 supports any resolution; the older
      // gpt-image-1.x models only support the three fixed sizes.
      thumbnailModelSizes: {
        'gpt-image-2': 'any',
        'gpt-image-1.5': ['1024x1024', '1536x1024', '1024x1536', 'auto'],
        'gpt-image-1': ['1024x1024', '1536x1024', '1024x1536', 'auto'],
        'gpt-image-1-mini': ['1024x1024', '1536x1024', '1024x1536', 'auto'],
      },
      // 1.5/1/1-mini do not support `vivid`/`natural`; only gpt-image-2 does.
      // muapi-routed models (blackforest, midjourney, google, etc.) do not
      // support OpenAI's style/background parameters and are omitted here so
      // the UI hides those controls for them.
      thumbnailModelStyles: {
        'gpt-image-2': ['vivid', 'natural'],
        'gpt-image-1.5': [],
        'gpt-image-1': [],
        'gpt-image-1-mini': [],
      },
      // gpt-image-2 does not currently support transparent backgrounds.
      thumbnailModelBackgrounds: {
        'gpt-image-2': ['auto', 'opaque'],
        'gpt-image-1.5': ['auto', 'opaque', 'transparent'],
        'gpt-image-1': ['auto', 'opaque', 'transparent'],
        'gpt-image-1-mini': ['auto', 'opaque', 'transparent'],
      },
      // `n` (number of candidates) — OpenAI allows up to 10, but most studios
      // use 3 for layout reasons. Surfaced to the UI as a slider.
      thumbnailNCandidates: 3,
      thumbnailNCandidatesOptions: [1, 2, 3, 4, 6, 8, 10],
      // gpt-image-2 always uses high input fidelity; older models have no
      // `input_fidelity` parameter. Exposed to the UI for transparency.
      thumbnailInputFidelity: 'high', // high (gpt-image-2 always), low, medium
      thumbnailInputFidelityOptions: ['low', 'medium', 'high'],
      thumbnailMaxReferenceImages: 4,
      thumbnailDefaultSize: '1792x1024',
      thumbnailAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '4:5', '3:2', '2:3', '2:1', '21:9', 'auto'],
      thumbnailCustomSizes: [
        '1024x1024', '1536x1024', '1024x1536',
        '1792x1024', '1024x1792', '2048x2048',
        '2048x1152', '3840x2160', '2160x3840',
        'auto',
      ],
      thumbnailQuality: 'high',
      thumbnailQualities: ['low', 'medium', 'high', 'auto'],
      thumbnailStyle: 'vivid',
      thumbnailStyles: ['vivid', 'natural'],
      thumbnailBackground: 'auto',
      thumbnailBackgrounds: ['auto', 'opaque'], // gpt-image-2: no transparent
      thumbnailFormat: 'webp',
      thumbnailFormats: ['webp', 'jpeg', 'png'],
      thumbnailCompression: 80,
      thumbnailPartialImages: 1, // 0=off, 1-3 for streaming
      thumbnailPartialImagesOptions: [0, 1, 2, 3],
      thumbnailStoreResponses: true,
      thumbnailInclude: ['reasoning.encrypted_content'],
      // Responses API refinement controls
      thumbnailImageAction: 'auto', // auto | generate | edit
      thumbnailImageActions: ['auto', 'generate', 'edit'],
      thumbnailImageDetail: 'auto', // low | high | auto
      thumbnailImageDetails: ['low', 'high', 'auto'],
      thumbnailModeration: 'auto', // auto | low
      thumbnailModerationOptions: ['auto', 'low'],
      thumbnailStreamingEnabled: true,
      thumbnailImageActionsInUI: {
        auto: 'Auto decide (let model choose)',
        generate: 'Always generate new',
        edit: 'Always edit existing',
      },
      // Mainline Responses API model override (gpt-5.6, gpt-5.5, etc.)
      thumbnailResponsesModel: 'gpt-5.6',
      thumbnailResponsesModelOptions: ['gpt-5.6', 'gpt-5.5', 'gpt-5.1', 'gpt-5'],
      // `include` for Responses API — configurable, default to reasoning.
      thumbnailIncludeOptions: [
        'reasoning.encrypted_content',
        'web_search_call.results',
      ],
      // Whether the panel should auto-display the model's revised prompt
      // after a generation. Always returned in the response; this just
      // controls the UI.
      thumbnailShowRevisedPrompt: true,
      // One-click refinement presets shown as chips above the refine input.
      thumbnailQuickEdits: [
        { key: 'brighter',     label: '☀️ Brighter',     promptFragment: 'brighter, more luminous, lifted shadows, higher exposure' },
        { key: 'darker',       label: '🌙 Darker',       promptFragment: 'darker, moodier, deeper shadows, lower exposure, cinematic contrast' },
        { key: 'warmer',       label: '🔥 Warmer',       promptFragment: 'warmer color temperature, golden hour tones, amber highlights, cozy atmosphere' },
        { key: 'cooler',       label: '❄️ Cooler',       promptFragment: 'cooler color temperature, blue tones, icy highlights, crisp atmosphere' },
        { key: 'cinematic',    label: '🎬 Cinematic',    promptFragment: 'anamorphic lens, shallow depth of field, 24fps, color graded, editorial framing' },
        { key: 'depth',        label: '📐 Depth',        promptFragment: 'stronger foreground/background separation, more depth of field, layered composition' },
        { key: 'rain',         label: '🌧️ Rain',         promptFragment: 'rain falling, wet surfaces, reflections on the ground, moody atmosphere' },
        { key: 'snow',         label: '❄️ Snow',         promptFragment: 'snow falling, winter atmosphere, soft white light, cold tones' },
        { key: 'fog',          label: '🌫️ Fog',          promptFragment: 'foggy atmosphere, soft diffused light, misty background, mysterious mood' },
        { key: 'vibrant',      label: '🌈 Vibrant',      promptFragment: 'more vibrant colors, higher saturation, punchy palette, high contrast' },
        { key: 'desaturated',  label: '🩶 Desaturated',  promptFragment: 'desaturated colors, muted palette, softer contrast, filmic look' },
        { key: 'textOverlay',  label: '🔤 Add text',     promptFragment: 'large bold headline text overlay in the empty space, readable at small size' },
      ],
    };

    this.currentImageModel = this.defaultConfig.imageModel;
  }

  /**
   * Validate that OpenAI API key is configured
   * @returns {boolean} true if valid
   * @throws {Error} if API key is missing
   */
  validateApiKey() {
    const apiKey = this.getApiKey();
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }
    if (!apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format. Key should start with "sk-".');
    }
    return true;
  }

  /**
   * Get OpenAI API key from environment
   * @returns {string|null} API key or null if not set
   */
  getApiKey() {
    // Server-side: Deno/Node environment variable
    try {
      if (typeof Deno !== 'undefined' && Deno.env) {
        const key = Deno.env.get('OPENAI_API_KEY');
        if (key) return key;
      }
    } catch (e) {
      // Deno not available
    }

    try {
      if (typeof process !== 'undefined' && process.env) {
        const key = process.env.OPENAI_API_KEY;
        if (key) return key;
      }
    } catch (e) {
      // In browser environment, process might not be available
    }

    // Browser-side: use ONLY the user-configured OpenAI key (Settings menu).
    // The MuAPI key is a separate credential and is intentionally NOT used here.
    try {
      if (typeof apiKeyManager !== 'undefined') {
        const openaiKey = apiKeyManager.getOpenAIKey();
        if (openaiKey) return openaiKey;
      }
    } catch (e) {
      // apiKeyManager not loaded
    }

    return null;
  }

  /**
   * Mask API key for safe logging
   * @param {string} apiKey - Full API key
   * @returns {string} Masked key
   */
  maskApiKey(apiKey) {
    if (!apiKey) return '';
    if (apiKey.length <= 11) return '*'.repeat(apiKey.length);
    return apiKey.substring(0, 11) + '...';
  }

  /**
   * Get the mainline Responses API model (supports the image_generation tool).
   * @returns {string}
   */
  getResponsesModel() {
    return this.defaultConfig.responsesModel;
  }

  /**
   * Set the Responses API model (with validation).
   * @param {string} model
   * @throws {Error} if unsupported
   */
  setResponsesModel(model) {
    if (!this.defaultConfig.supportedResponsesModels.includes(model)) {
      throw new Error(`Unsupported Responses model: ${model}. Supported: ${this.defaultConfig.supportedResponsesModels.join(', ')}`);
    }
    this.defaultConfig.responsesModel = model;
  }

  /**
   * Get current image model
   * @returns {string} Image model name
   */
  getImageModel() {
    return this.currentImageModel;
  }

  /**
   * Set image model (with validation)
   * @param {string} model - Model name
   * @throws {Error} if model is not supported
   */
  setImageModel(model) {
    if (!this.isValidImageModel(model)) {
      throw new Error(`Unsupported image model: ${model}. Supported models: ${this.defaultConfig.supportedImageModels.join(', ')}`);
    }
    this.currentImageModel = model;
  }

  /**
   * Check if image model is supported
   * @param {string} model - Model name
   * @returns {boolean} true if supported
   */
  isValidImageModel(model) {
    return this.defaultConfig.supportedImageModels.includes(model);
  }

  /**
   * Check whether a model ID belongs to the OpenAI Images API family.
   * muapi-routed models (blackforest, google, midjourney, etc.) return false.
   * @param {string} modelId
   * @returns {boolean}
   */
  isOpenAIImageModel(modelId) {
    return ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'].includes(modelId);
  }

  /**
   * Get complete configuration object
   * @returns {object} Full configuration
   */
  getConfig() {
    return {
      apiKey: this.getApiKey(),
      imageModel: this.getImageModel(),
      baseURL: this.defaultConfig.baseURL,
      timeout: this.defaultConfig.timeout,
      maxRetries: this.defaultConfig.maxRetries,
      supportedImageModels: [...this.defaultConfig.supportedImageModels],
      thumbnailAllModels: [...this.defaultConfig.thumbnailAllModels],
    };
  }

  /**
   * Reset to default configuration
   */
  resetToDefaults() {
    this.currentImageModel = this.defaultConfig.imageModel;
  }

  /**
   * Get default output settings for image generation
   * @returns {object} Default output settings
   */
  getDefaultOutputSettings() {
    return {
      size: '1024x1024',
      quality: 'standard',
      style: 'vivid',
      format: 'png'
    };
  }

  /**
   * Validate output settings
   * @param {object} settings - Output settings
   * @returns {boolean} true if valid
   * @throws {Error} if invalid
   */
  validateOutputSettings(settings) {
    const validSizes = ['1024x1024', '1024x1792', '1792x1024'];
    const validQualities = ['standard', 'hd'];
    const validStyles = ['natural', 'vivid'];
    const validFormats = ['png', 'jpg', 'webp'];

    if (!validSizes.includes(settings.size)) {
      throw new Error(`Invalid size: ${settings.size}. Must be one of: ${validSizes.join(', ')}`);
    }

    if (!validQualities.includes(settings.quality)) {
      throw new Error(`Invalid quality: ${settings.quality}. Must be one of: ${validQualities.join(', ')}`);
    }

    if (!validStyles.includes(settings.style)) {
      throw new Error(`Invalid style: ${settings.style}. Must be one of: ${validStyles.join(', ')}`);
    }

    if (!validFormats.includes(settings.format)) {
      throw new Error(`Invalid format: ${settings.format}. Must be one of: ${validFormats.join(', ')}`);
    }

    return true;
  }

  /**
   * Thumbnail-specific output settings
   * @returns {object} Thumbnail default settings
   */
  getThumbnailOutputSettings() {
    return {
      model: this.defaultConfig.thumbnailModel,
      models: [...this.defaultConfig.thumbnailAllModels],
      modelSizes: { ...this.defaultConfig.thumbnailModelSizes },
      modelStyles: { ...this.defaultConfig.thumbnailModelStyles },
      modelBackgrounds: { ...this.defaultConfig.thumbnailModelBackgrounds },
      n: this.defaultConfig.thumbnailNCandidates,
      nOptions: [...this.defaultConfig.thumbnailNCandidatesOptions],
      inputFidelity: this.defaultConfig.thumbnailInputFidelity,
      inputFidelityOptions: [...this.defaultConfig.thumbnailInputFidelityOptions],
      responsesModel: this.defaultConfig.thumbnailResponsesModel,
      responsesModelOptions: [...this.defaultConfig.thumbnailResponsesModelOptions],
      size: this.defaultConfig.thumbnailDefaultSize,
      customSizes: [...this.defaultConfig.thumbnailCustomSizes],
      aspectRatios: [...this.defaultConfig.thumbnailAspectRatios],
      quality: this.defaultConfig.thumbnailQuality,
      qualities: [...this.defaultConfig.thumbnailQualities],
      style: this.defaultConfig.thumbnailStyle,
      styles: [...this.defaultConfig.thumbnailStyles],
      background: this.defaultConfig.thumbnailBackground,
      backgrounds: [...this.defaultConfig.thumbnailBackgrounds],
      format: this.defaultConfig.thumbnailFormat,
      formats: [...this.defaultConfig.thumbnailFormats],
      compression: this.defaultConfig.thumbnailCompression,
      partialImages: this.defaultConfig.thumbnailPartialImages,
      partialImagesOptions: [...this.defaultConfig.thumbnailPartialImagesOptions],
      store: this.defaultConfig.thumbnailStoreResponses,
      include: [...this.defaultConfig.thumbnailInclude],
      includeOptions: [...this.defaultConfig.thumbnailIncludeOptions],
      imageAction: this.defaultConfig.thumbnailImageAction,
      imageActions: [...this.defaultConfig.thumbnailImageActions],
      imageActionLabels: { ...this.defaultConfig.thumbnailImageActionsInUI },
      imageDetail: this.defaultConfig.thumbnailImageDetail,
      imageDetails: [...this.defaultConfig.thumbnailImageDetails],
      moderation: this.defaultConfig.thumbnailModeration,
      moderationOptions: [...this.defaultConfig.thumbnailModerationOptions],
      maxReferenceImages: this.defaultConfig.thumbnailMaxReferenceImages,
      streamingEnabled: this.defaultConfig.thumbnailStreamingEnabled,
      showRevisedPrompt: this.defaultConfig.thumbnailShowRevisedPrompt,
      quickEdits: [...(this.defaultConfig.thumbnailQuickEdits || [])],
    };
  }

  /**
   * Check if a WxH size string is "2K+" (experimental per OpenAI docs).
   * 2K+ means more than 3,686,400 total pixels.
   * @param {string} size
   * @returns {boolean}
   */
  isExperimentalSize(size) {
    if (!size || size === 'auto') return false;
    const [w, h] = size.split('x').map(Number);
    if (!w || !h) return false;
    return w * h > 3686400;
  }

  /**
   * Estimate cost in USD for a generation, based on the OpenAI pricing table
   * from the Image Generation guide (gpt-image-2 + legacy models).
   * Returns null if the model/size isn't in the table.
   * @param {string} model — e.g. 'gpt-image-2', 'gpt-image-1'
   * @param {string} quality — 'low' | 'medium' | 'high'
   * @param {string} size — e.g. '1024x1024', '1536x1024'
   * @param {number} n — number of candidates
   * @returns {number|null}
   */
  estimateCost(model = 'gpt-image-2', quality = 'high', size = '1024x1024', n = 1) {
    // Pricing per image, in USD. From the OpenAI Image Generation guide.
    // (gpt-image-2 has thousands of sizes; the table below lists the same
    // sizes used for previous models for comparison.)
    const TABLE = {
      'gpt-image-2': {
        '1024x1024': { low: 0.006, medium: 0.053, high: 0.211 },
        '1024x1536': { low: 0.005, medium: 0.041, high: 0.165 },
        '1536x1024': { low: 0.005, medium: 0.041, high: 0.165 },
      },
      'gpt-image-1.5': {
        '1024x1024': { low: 0.009, medium: 0.034, high: 0.133 },
        '1024x1536': { low: 0.013, medium: 0.05, high: 0.2 },
        '1536x1024': { low: 0.013, medium: 0.05, high: 0.2 },
      },
      'gpt-image-1': {
        '1024x1024': { low: 0.011, medium: 0.042, high: 0.167 },
        '1024x1536': { low: 0.016, medium: 0.063, high: 0.25 },
        '1536x1024': { low: 0.016, medium: 0.063, high: 0.25 },
      },
      'gpt-image-1-mini': {
        '1024x1024': { low: 0.005, medium: 0.011, high: 0.036 },
        '1024x1536': { low: 0.006, medium: 0.015, high: 0.052 },
        '1536x1024': { low: 0.006, medium: 0.015, high: 0.052 },
      },
    };
    const modelTable = TABLE[model];
    if (!modelTable) return null;
    const sizeTable = modelTable[size];
    if (!sizeTable) return null;
    const perImage = sizeTable[quality] ?? sizeTable.high;
    return Math.round(perImage * n * 1000) / 1000;
  }

  /**
   * Resolve a studio / app theme name to its color scheme.
   * Single source of truth — used by GTMPromptModal, TemplateThumbnailModal,
   * TemplateThumbnailModal, PersonalizeModal, and any future consumers.
   *
   * Always returns {@link STUDIO_SCHEME} so a modal opened from any studio
   * matches the studio chrome around it.
   * @param {string} theme
   * @returns {{ primary: string, accent: string, secondary: string, onPrimary: string }}
   */
  getStudioColorScheme(theme) {
    return STUDIO_COLOR_SCHEMES[theme] || { ...STUDIO_SCHEME };
  }

  /**
   * Get the full list of registered studio color schemes. Useful for
   * previews and the settings UI.
   * @returns {Record<string, { primary: string, accent: string, secondary: string }>}
   */
  getAllStudioColorSchemes() {
    return { ...STUDIO_COLOR_SCHEMES };
  }
}

// Export singleton instance
export const openaiConfig = new OpenAIConfig();
export default openaiConfig;