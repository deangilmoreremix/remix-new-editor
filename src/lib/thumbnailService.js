/**
 * ThumbnailService
 *
 * Thin client wrapper around the `ai-thumbnail-generator` Supabase Edge Function.
 * Provides five actions: prompts, generate, refine, inpaint, save.
 */

import { supabase } from './supabase.js';

const EDGE_FUNCTION = 'ai-thumbnail-generator';

export class ThumbnailService {
  /**
   * @param {Object} options
   * @param {string} options.templateId
   * @param {string} options.templateName
   * @param {string} [options.aspectRatio='16:9']
   * @param {string} [options.outputType]
   * @param {string} [options.visualStyle]
   * @param {string} [options.cinematography]
   * @param {string} [options.niche]
   * @param {string} [options.altText]
   * @param {string} [options.userId]
   */
  constructor(options) {
    this.options = options;
  }

  get templateId() {
    return this.options.templateId;
  }

  get aspectRatio() {
    return this.options.aspectRatio || '16:9';
  }

  // 1) Build prompt variants
  async buildPromptVariants(brief, presetKey) {
    const body = {
      action: 'prompts',
      templateId: this.templateId,
      brief,
      template: {
        name: this.options.templateName,
        aspectRatio: this.options.aspectRatio,
        outputType: this.options.outputType,
        visualStyle: this.options.visualStyle,
        cinematography: this.options.cinematography,
        niche: this.options.niche,
      },
    };
    if (presetKey) body.presetKey = presetKey;

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to build prompt variants');
    return { variants: data?.variants || [], responseId: data?.response_id || null };
  }

  async generateCandidates(prompt, opts = {}) {
    const body = {
      action: 'generate',
      prompt,
      aspectRatio: opts.aspectRatio || this.aspectRatio,
      n: Math.min(opts.n ?? 3, 3),
    };
    if (opts.quality) body.quality = opts.quality;
    if (opts.style) body.style = opts.style;
    if (opts.background) body.background = opts.background;
    if (opts.outputFormat) body.outputFormat = opts.outputFormat;
    if (typeof opts.outputCompression === 'number') body.outputCompression = opts.outputCompression;

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to generate candidates');
    return { candidates: data?.candidates || [], params: data?.params || null };
  }

  async refineLastImage(opts = {}) {
    const body = {
      action: 'refine',
      prompt: opts.prompt,
      previousResponseId: opts.previousResponseId || '',
    };
    if (opts.size) body.size = opts.size;
    if (opts.quality) body.quality = opts.quality;
    if (opts.background) body.background = opts.background;
    if (opts.outputFormat) body.outputFormat = opts.outputFormat;
    if (typeof opts.outputCompression === 'number') body.outputCompression = opts.outputCompression;
    if (typeof opts.partialImages === 'number') body.partialImages = opts.partialImages;
    if (typeof opts.store === 'boolean') body.store = opts.store;
    if (Array.isArray(opts.include) && opts.include.length) body.include = opts.include;
    if (opts.referenceImageB64) body.referenceImageB64 = opts.referenceImageB64;
    if (opts.referenceImageUrl) body.referenceImageUrl = opts.referenceImageUrl;
    if (opts.referenceImageFileId) body.referenceImageFileId = opts.referenceImageFileId;
    if (opts.imageDetail) body.imageDetail = opts.imageDetail;

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to refine image');
    return data?.result;
  }

  async inpaint(opts = {}) {
    const body = {
      action: 'inpaint',
      prompt: opts.prompt,
      imageB64: opts.imageB64,
      maskB64: opts.maskB64,
      aspectRatio: opts.aspectRatio || this.aspectRatio,
    };
    if (opts.quality) body.quality = opts.quality;
    if (opts.style) body.style = opts.style;
    if (opts.background) body.background = opts.background;
    if (opts.outputFormat) body.outputFormat = opts.outputFormat;

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to inpaint image');
    return data?.result;
  }

  async saveToStorage(opts = {}) {
    const userId = this.options.userId || await this.currentUserId();
    if (!userId) throw new Error('User not authenticated');

    const body = {
      action: 'save',
      templateId: this.templateId,
      imageB64: opts.imageB64,
      altText: this.options.altText || this.templateId,
      userId,
      promptUsed: opts.promptUsed || '',
    };
    if (opts.presetKey) body.presetKey = opts.presetKey;
    if (opts.controls) body.controls = opts.controls;

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to save thumbnail');
    return data;
  }

  async currentUserId() {
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session?.user?.id || null;
    } catch {
      return null;
    }
  }

  // Utility: convert b64 to data URL
  static b64ToDataUrl(b64, mime = 'image/webp') {
    const cleaned = String(b64).replace(/^data:image\/\w+;base64,/, '');
    return `data:${mime};base64,${cleaned}`;
  }

  // Utility: convert b64 to Blob (client-side)
  static b64ToBlob(b64, mime = 'image/png') {
    const cleaned = String(b64).replace(/^data:image\/\w+;base64,/, '');
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }
}

export default ThumbnailService;

