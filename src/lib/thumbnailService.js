/**
 * ThumbnailService
 *
 * Thin client wrapper around the `ai-thumbnail-generator` Supabase Edge Function.
 * Provides five actions: prompts, generate, refine, inpaint, save.
 */

import { supabase, getSupabaseUrl, getSupabaseAnonKey } from './supabase.js';

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
    this._brandKit = null;
    this._platform = null;
  }

  get templateId() {
    return this.options.templateId;
  }

  get aspectRatio() {
    return this.options.aspectRatio || '16:9';
  }

  setBrandKit(brandKit) {
    this._brandKit = brandKit;
  }

  getBrandKit() {
    return this._brandKit;
  }

  setPlatform(platform) {
    this._platform = platform;
  }

  getPlatform() {
    return this._platform;
  }

  // 1) Build prompt variants
  async buildPromptVariants(brief, presetKey, brandKit, platform) {
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
      brandKit: brandKit || this._brandKit || null,
      platform: platform || this._platform || null,
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
      brandKit: opts.brandKit || this._brandKit || null,
      platform: opts.platform || this._platform || null,
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

  async generateVideoThumbnail(prompt, opts = {}) {
    const body = {
      action: 'video-thumbnail',
      prompt,
      aspectRatio: opts.aspectRatio || this.aspectRatio,
      brandKit: opts.brandKit || this._brandKit || null,
      platform: opts.platform || this._platform || null,
    };
    if (opts.duration) body.duration = opts.duration;
    if (opts.frames) body.frames = opts.frames;
    if (opts.style) body.style = opts.style;

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to generate video thumbnail');
    return {
      frames: data?.frames || [],
      duration: data?.duration || null,
      aspectRatio: data?.aspectRatio || this.aspectRatio,
    };
  }

  async refineLastImage(opts = {}) {
    const body = {
      action: 'refine',
      prompt: opts.prompt,
      previousResponseId: opts.previousResponseId || '',
      brandKit: opts.brandKit || this._brandKit || null,
      // Responses API image_generation tool controls
      imageAction: opts.imageAction || 'auto',
      inputImageMaskB64: opts.inputImageMaskB64 || null,
      inputImageMaskFileId: opts.inputImageMaskFileId || null,
    };
    if (opts.size) body.size = opts.size;
    if (opts.quality) body.quality = opts.quality;
    if (opts.background) body.background = opts.background;
    if (opts.outputFormat) body.outputFormat = opts.outputFormat;
    if (typeof opts.outputCompression === 'number') body.outputCompression = opts.outputCompression;
    if (typeof opts.partialImages === 'number') body.partialImages = opts.partialImages;
    if (typeof opts.store === 'boolean') body.store = opts.store;
    if (Array.isArray(opts.include) && opts.include.length) body.include = opts.include;
    // Multiple reference images supported — pass a single value or an array.
    if (opts.referenceImageB64) body.referenceImageB64 = opts.referenceImageB64;
    if (opts.referenceImageUrl) body.referenceImageUrl = opts.referenceImageUrl;
    if (opts.referenceImageFileId) body.referenceImageFileId = opts.referenceImageFileId;
    if (opts.imageDetail) body.imageDetail = opts.imageDetail;

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to refine image');
    return data?.result;
  }

  /**
   * Streaming variant of `refineLastImage`.
   *
   * Since `@supabase/functions-js` (v2.110.1) has no streaming callback support,
   * we call the Edge Function directly with `fetch` and read the SSE body
   * stream ourselves. The Edge Function emits newline-delimited SSE events:
   *   { type: 'partial', b64 }       — incremental partial-image preview
   *   { type: 'done',    result }    — final image_generation result
   *   { type: 'error',   message }   — terminal error
   *
   * @param {Object} opts              same control object as refineLastImage
   * @param {Object} callbacks         { onPartial(b64), onDone(result), onError(err) }
   * @returns {Promise<void>}
   */
  async refineLastImageStream(opts, callbacks = {}) {
    const { onPartial, onDone, onError } = callbacks;
    const url = `${getSupabaseUrl()}/functions/v1/${EDGE_FUNCTION}`;

    const body = {
      action: 'refine',
      prompt: opts.prompt,
      previousResponseId: opts.previousResponseId || '',
      stream: true,
      brandKit: opts.brandKit || this._brandKit || null,
      imageAction: opts.imageAction || 'auto',
      inputImageMaskB64: opts.inputImageMaskB64 || null,
      inputImageMaskFileId: opts.inputImageMaskFileId || null,
    };
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

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getSupabaseAnonKey()}`,
          apikey: getSupabaseAnonKey(),
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      onError?.(err);
      return;
    }

    if (!res.ok || !res.body) {
      let detail = '';
      try { detail = await res.text(); } catch { /* ignore */ }
      onError?.(new Error(detail || `Refine stream failed (${res.status})`));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const dataLine = raw.split('\n').find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const payload = dataLine.slice(5).trim();
          if (!payload) continue;
          let evt;
          try { evt = JSON.parse(payload); } catch { continue; }
          if (evt.type === 'partial') onPartial?.(evt.b64);
          else if (evt.type === 'done') onDone?.(evt.result);
          else if (evt.type === 'error') onError?.(new Error(evt.message));
        }
      }
    } catch (err) {
      onError?.(err);
    }
  }

  async inpaint(opts = {}) {
    const body = {
      action: 'inpaint',
      prompt: opts.prompt,
      imageB64: opts.imageB64,
      maskB64: opts.maskB64,
      aspectRatio: opts.aspectRatio || this.aspectRatio,
      brandKit: opts.brandKit || this._brandKit || null,
      platform: opts.platform || this._platform || null,
    };
    if (opts.quality) body.quality = opts.quality;
    if (opts.style) body.style = opts.style;
    if (opts.background) body.background = opts.background;
    if (opts.outputFormat) body.outputFormat = opts.outputFormat;

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to inpaint image');
    return data?.result;
  }

  async trackThumbnailGeneration(params) {
    const body = {
      action: 'analytics',
      templateId: this.templateId,
      ...params,
    };

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to track thumbnail analytics');
    return data;
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
      brandKit: opts.brandKit || this._brandKit || null,
      platform: opts.platform || this._platform || null,
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
