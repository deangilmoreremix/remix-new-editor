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
  async buildPromptVariants(brief) {
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

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to build prompt variants');
    return data?.variants || [];
  }

  // 2) Generate N candidates from a prompt
  async generateCandidates(prompt, n = 3) {
    const body = {
      action: 'generate',
      prompt,
      aspectRatio: this.aspectRatio,
      n: Math.min(n, 3),
    };

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to generate candidates');
    return data?.candidates || [];
  }

  // 3) Refine using Responses API multi-turn
  async refineLastImage(instruction, previousResponseId) {
    const body = {
      action: 'refine',
      prompt: instruction,
      previousResponseId,
    };

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to refine image');
    return data?.result;
  }

  // 3b) Inpaint with a brush mask
  async inpaint(prompt, imageB64, maskB64) {
    const body = {
      action: 'inpaint',
      prompt,
      imageB64,
      maskB64,
      aspectRatio: this.aspectRatio,
    };

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to inpaint image');
    return data?.result;
  }

  // 4) Save to storage + DB
  async saveToStorage(imageB64, promptUsed) {
    const userId = this.options.userId || await this.currentUserId();
    if (!userId) throw new Error('User not authenticated');

    const body = {
      action: 'save',
      templateId: this.templateId,
      imageB64,
      altText: this.options.altText || this.templateId,
      userId,
      promptUsed,
    };

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

