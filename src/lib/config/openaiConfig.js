/**
 * OpenAI Configuration Service
 * Centralized configuration for OpenAI API integration
 */

import { apiKeyManager } from '../apiKeyManager.js';

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
      thumbnailModel: 'gpt-image-2',
      thumbnailDefaultSize: '1792x1024',
      thumbnailAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
      thumbnailQuality: 'high',
      thumbnailQualities: ['low', 'medium', 'high', 'auto'],
      thumbnailStyle: 'vivid',
      thumbnailStyles: ['vivid', 'natural'],
      thumbnailBackground: 'auto',
      thumbnailBackgrounds: ['auto', 'opaque'], // gpt-image-2: no transparent
      thumbnailFormat: 'webp',
      thumbnailFormats: ['webp', 'jpeg', 'png'],
      thumbnailCompression: 80,
      thumbnailPartialImages: 1,
      thumbnailStoreResponses: true,
      thumbnailInclude: ['reasoning.encrypted_content'],
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
      supportedImageModels: [...this.defaultConfig.supportedImageModels]
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
      size: this.defaultConfig.thumbnailDefaultSize,
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
      store: this.defaultConfig.thumbnailStoreResponses,
      include: [...this.defaultConfig.thumbnailInclude],
    };
  }
}

// Export singleton instance
export const openaiConfig = new OpenAIConfig();
export default openaiConfig;