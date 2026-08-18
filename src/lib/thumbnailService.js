/**
 * ThumbnailService
 *
 * Thin client wrapper around the `ai-thumbnail-generator` Supabase Edge Function.
 * Provides five actions: prompts, generate, refine, inpaint, save.
 *
 * API key resolution (highest priority wins):
 *   1. opts.apiKey passed by the caller (escape hatch for studios that
 *      already have a key in hand)
 *   2. apiKeyManager.getOpenAIKey() — the key the user entered in the
 *      Settings / API modal
 *   3. (Server-side) the OPENAI_API_KEY env var on the Supabase edge
 *      function — used as a fallback when the caller has no key.
 */

import { supabase, getSupabaseUrl, getSupabaseAnonKey } from './supabase.js';
import { apiKeyManager } from './apiKeyManager.js';
import { openaiConfig } from './config/openaiConfig.js';

const EDGE_FUNCTION = 'ai-thumbnail-generator';

function resolveUserOpenAIKey(optsApiKey) {
  if (optsApiKey) return optsApiKey;
  try {
    if (apiKeyManager && typeof apiKeyManager.getOpenAIKey === 'function') {
      return apiKeyManager.getOpenAIKey() || '';
    }
  } catch {
    // apiKeyManager not loaded in this context (e.g. SSR or tests).
  }
  return '';
}

function resolveUserMuapiKey() {
  try {
    if (apiKeyManager && typeof apiKeyManager.getMuapiKey === 'function') {
      return apiKeyManager.getMuapiKey() || '';
    }
  } catch {
    // apiKeyManager not loaded in this context.
  }
  return '';
}

function isMuapiModel(modelId) {
  if (!modelId) return false;
  return !openaiConfig.isOpenAIImageModel(modelId);
}

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
    // Forward the user's OpenAI key (if any) so the edge function can charge
    // the user rather than the server's shared env key.
    const userKey = resolveUserOpenAIKey();
    if (userKey) body.apiKey = userKey;

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(error.message || 'Failed to build prompt variants');
    return { variants: data?.variants || [], responseId: data?.response_id || null };
  }

  async generateCandidates(prompt, opts = {}) {
    const body = {
      action: 'generate',
      prompt,
      aspectRatio: opts.aspectRatio || this.aspectRatio,
      n: Math.min(Math.max(opts.n ?? openaiConfig.defaultConfig.thumbnailNCandidates, 1), 10),
      brandKit: opts.brandKit || this._brandKit || null,
      platform: opts.platform || this._platform || null,
    };
    if (opts.model) body.model = opts.model;
    if (opts.size) body.size = opts.size;
    if (opts.quality) body.quality = opts.quality;
    if (opts.style) body.style = opts.style;
    if (opts.background) body.background = opts.background;
    if (opts.inputFidelity) body.inputFidelity = opts.inputFidelity;
    if (opts.outputFormat) body.outputFormat = opts.outputFormat;
    if (typeof opts.outputCompression === 'number') body.outputCompression = opts.outputCompression;
    if (opts.moderation) body.moderation = opts.moderation;
    if (opts.user) body.user = opts.user;

    const modelId = opts.model || openaiConfig.defaultConfig.thumbnailModel;
    if (isMuapiModel(modelId)) {
      const muapiKey = resolveUserMuapiKey();
      if (muapiKey) body.muapi_api_key = muapiKey;
    } else {
      const userKey = resolveUserOpenAIKey(opts.apiKey);
      if (userKey) body.apiKey = userKey;
    }

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) {
      const hint = this.moderationHintFromError(error);
      throw new Error(hint ?? (error.message || 'Failed to generate candidates'));
    }
    if (data?.error) {
      const err = new Error(data.error);
      if (data.moderation_blocked) err.code = 'moderation_blocked';
      throw err;
    }
    return {
      candidates: data?.candidates || [],
      params: data?.params || null,
      keySource: data?.key_source || null,
      modelUsed: data?.model_used || null,
    };
  }

  /**
   * Streaming variant of `generateCandidates`.
   * Same params as generateCandidates plus callbacks:
   *   { onPartial(b64), onDone({ candidates, params }), onError(err) }
   */
  async generateCandidatesStream(prompt, opts = {}, callbacks = {}) {
    const { onPartial, onDone, onError } = callbacks;
    const url = `${getSupabaseUrl()}/functions/v1/${EDGE_FUNCTION}`;

    const body = {
      action: 'generate',
      prompt,
      aspectRatio: opts.aspectRatio || this.aspectRatio,
      n: Math.min(Math.max(opts.n ?? openaiConfig.defaultConfig.thumbnailNCandidates, 1), 10),
      stream: true,
      brandKit: opts.brandKit || this._brandKit || null,
      platform: opts.platform || this._platform || null,
    };
    if (opts.model) body.model = opts.model;
    if (opts.size) body.size = opts.size;
    if (opts.quality) body.quality = opts.quality;
    if (opts.style) body.style = opts.style;
    if (opts.background) body.background = opts.background;
    if (opts.inputFidelity) body.inputFidelity = opts.inputFidelity;
    if (opts.outputFormat) body.outputFormat = opts.outputFormat;
    if (typeof opts.outputCompression === 'number') body.outputCompression = opts.outputCompression;
    if (typeof opts.partialImages === 'number') body.partialImages = opts.partialImages;
    if (opts.moderation) body.moderation = opts.moderation;
    if (opts.user) body.user = opts.user;

    const modelId = opts.model || openaiConfig.defaultConfig.thumbnailModel;
    if (isMuapiModel(modelId)) {
      const muapiKey = resolveUserMuapiKey();
      if (muapiKey) body.muapi_api_key = muapiKey;
    } else {
      const userKey = resolveUserOpenAIKey(opts.apiKey);
      if (userKey) body.apiKey = userKey;
    }

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
      onError?.(new Error(detail || `Generate stream failed (${res.status})`));
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
          else if (evt.type === 'error') {
            const err = new Error(evt.message);
            if (evt.moderation_blocked) err.code = 'moderation_blocked';
            onError?.(err);
          }
        }
      }
    } catch (err) {
      onError?.(err);
    }
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
    const userKey = resolveUserOpenAIKey();
    if (userKey) body.apiKey = userKey;

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
      responsesModel: opts.responsesModel || undefined,
      imageAction: opts.imageAction || 'auto',
      imageDetail: opts.imageDetail || 'auto',
      moderation: opts.moderation || undefined,
      inputImageMaskB64: opts.inputImageMaskB64 || null,
      inputImageMaskFileId: opts.inputImageMaskFileId || null,
    };
    if (opts.model) body.model = opts.model;
    if (opts.size) body.size = opts.size;
    if (opts.quality) body.quality = opts.quality;
    if (opts.style) body.style = opts.style;
    if (opts.background) body.background = opts.background;
    if (opts.inputFidelity) body.inputFidelity = opts.inputFidelity;
    if (opts.outputFormat) body.outputFormat = opts.outputFormat;
    if (typeof opts.outputCompression === 'number') body.outputCompression = opts.outputCompression;
    if (typeof opts.partialImages === 'number') body.partialImages = opts.partialImages;
    if (typeof opts.store === 'boolean') body.store = opts.store;
    if (Array.isArray(opts.include) && opts.include.length) body.include = opts.include;
    // Multiple reference images supported — pass a single value or an array.
    if (opts.referenceImageB64) body.referenceImageB64 = opts.referenceImageB64;
    if (opts.referenceImageUrl) body.referenceImageUrl = opts.referenceImageUrl;
    if (opts.referenceImageFileId) body.referenceImageFileId = opts.referenceImageFileId;
    // Style references — applied as visual style only (reference_type: 'style').
    if (opts.referenceStyleB64) body.referenceStyleB64 = opts.referenceStyleB64;
    if (opts.referenceStyleUrl) body.referenceStyleUrl = opts.referenceStyleUrl;
    if (opts.referenceStyleFileId) body.referenceStyleFileId = opts.referenceStyleFileId;
    if (opts.user) body.user = opts.user;
    const userKey = resolveUserOpenAIKey(opts.apiKey);
    if (userKey) body.apiKey = userKey;

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    if (error) {
      const hint = this.moderationHintFromError(error);
      throw new Error(hint ?? (error.message || 'Failed to refine image'));
    }
    if (data?.error) {
      const err = new Error(data.error);
      if (data.moderation_blocked) err.code = 'moderation_blocked';
      throw err;
    }
    return { ...data?.result, keySource: data?.key_source || null };
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
    if (opts.model) body.model = opts.model;
    if (opts.size) body.size = opts.size;
    if (opts.quality) body.quality = opts.quality;
    if (opts.style) body.style = opts.style;
    if (opts.background) body.background = opts.background;
    if (opts.inputFidelity) body.inputFidelity = opts.inputFidelity;
    if (opts.outputFormat) body.outputFormat = opts.outputFormat;
    if (typeof opts.outputCompression === 'number') body.outputCompression = opts.outputCompression;
    if (typeof opts.partialImages === 'number') body.partialImages = opts.partialImages;
    if (typeof opts.store === 'boolean') body.store = opts.store;
    if (Array.isArray(opts.include) && opts.include.length) body.include = opts.include;
    if (opts.referenceImageB64) body.referenceImageB64 = opts.referenceImageB64;
    if (opts.referenceImageUrl) body.referenceImageUrl = opts.referenceImageUrl;
    if (opts.referenceImageFileId) body.referenceImageFileId = opts.referenceImageFileId;
    if (opts.referenceStyleB64) body.referenceStyleB64 = opts.referenceStyleB64;
    if (opts.referenceStyleUrl) body.referenceStyleUrl = opts.referenceStyleUrl;
    if (opts.referenceStyleFileId) body.referenceStyleFileId = opts.referenceStyleFileId;
    if (opts.imageDetail) body.imageDetail = opts.imageDetail;
    const userKey = resolveUserOpenAIKey(opts.apiKey);
    if (userKey) body.apiKey = userKey;

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
    if (opts.model) body.model = opts.model;
    if (opts.size) body.size = opts.size;
    if (opts.quality) body.quality = opts.quality;
    if (opts.style) body.style = opts.style;
    if (opts.background) body.background = opts.background;
    if (opts.inputFidelity) body.inputFidelity = opts.inputFidelity;
    if (opts.outputFormat) body.outputFormat = opts.outputFormat;
    if (typeof opts.outputCompression === 'number') body.outputCompression = opts.outputCompression;
    if (opts.user) body.user = opts.user;
    // Reference images for the Image API edit endpoint (multiple supported).
    if (opts.referenceImageB64) body.referenceImageB64 = opts.referenceImageB64;
    const userKey = resolveUserOpenAIKey(opts.apiKey);
    if (userKey) body.apiKey = userKey;

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

  /**
   * Normalize a mask image to a PNG with an alpha channel.
   *
   * The OpenAI Image Edits API requires the mask to be a PNG with an
   * alpha channel (https://platform.openai.com/docs/guides/image-generation
   * — see "Edit an image using a mask"). Some image editors save
   * B&W masks without an alpha channel; this helper:
   *  1. Loads the file into a canvas.
   *  2. Draws it onto an RGBA canvas so the alpha channel is populated.
   *  3. Re-encodes as PNG.
   *  4. Returns the base64-encoded PNG.
   *
   * @param {Blob|File} file
   * @returns {Promise<string>} base64-encoded PNG (no `data:image/...` prefix)
   */
  static async normalizeMaskToAlphaPng(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      // Use a fresh canvas in RGBA so the alpha channel is always present.
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get 2D context');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // If the source had no alpha, drawImage into an RGBA canvas will
      // fill the alpha channel with 255 — which means the mask is fully
      // opaque. That's not what we want: a B&W mask should treat black
      // as transparent (or vice versa) so OpenAI's mask-based edit can
      // find the editable area.
      //
      // Heuristic: if the source image has no alpha (canvas reports 0 in
      // every alpha byte), we re-interpret luminance as the mask:
      //   white = editable (alpha = 255), black = keep (alpha = 0).
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let hasAlphaVariation = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0 && data[i] !== 255) { hasAlphaVariation = true; break; }
      }
      if (!hasAlphaVariation) {
        // No useful alpha — re-derive from luminance.
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const luma = (r + g + b) / 3; // 0..255
          data[i + 3] = luma > 128 ? 255 : 0;
          // Force RGB to white for areas that will be edited, black where
          // the original is black — makes the mask visually obvious.
          data[i] = data[i + 1] = data[i + 2] = luma > 128 ? 255 : 0;
        }
        ctx.putImageData(imageData, 0, 0);
      }
      const dataUrl = canvas.toDataURL('image/png');
      const commaIdx = dataUrl.indexOf(',');
      return commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // Utility: convert b64 to data URL
  static b64ToDataUrl(b64, mime = 'image/webp') {
    const cleaned = String(b64).replace(/^data:image\/\w+;base64,/, '');
    return `data:${mime};base64,${cleaned}`;
  }

  /**
   * Generate a small (≤320px wide) JPEG data URL from a b64 image for use
   * as a low-resolution placeholder while the full-res image loads.
   * Returns the input as a data URL if Canvas is unavailable.
   * @param {string} b64
   * @param {number} maxWidth
   * @returns {Promise<string>}
   */
  static async b64ToPlaceholder(b64, maxWidth = 320) {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => {
          const ratio = img.naturalHeight / img.naturalWidth;
          const w = Math.min(maxWidth, img.naturalWidth);
          const h = Math.round(w * ratio);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(ThumbnailService.b64ToDataUrl(b64)); return; }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = () => resolve(ThumbnailService.b64ToDataUrl(b64));
        img.src = ThumbnailService.b64ToDataUrl(b64);
      } catch {
        resolve(ThumbnailService.b64ToDataUrl(b64));
      }
    });
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

  /**
   * Build a user-facing hint from a moderation-blocked error, following
   * OpenAI's recommended pattern. Mirrors the server-side moderationHint()
   * but works against client error objects.
   * @param {Object} err
   * @returns {string|null}
   */
  static moderationHint(err) {
    const code = err?.code;
    if (code !== 'moderation_blocked') return null;
    const details = err?.moderation_details || err?.body?.moderation_details || null;
    const categories = details?.categories ?? [];
    const stage = details?.moderation_stage;

    let hint =
      'This request could not be completed because it did not meet safety requirements.';
    if (categories.includes('harassment')) {
      hint = 'Try removing abusive or targeting language and focus on neutral visual details instead.';
    } else if (stage === 'input') {
      hint = 'Try revising the prompt or input images and submit the request again.';
    } else if (stage === 'output') {
      hint = 'The generated result was blocked by a safety check. Try changing the prompt and generating again.';
    }
    return hint;
  }

  // Instance-method alias for symmetry with other services.
  moderationHintFromError(err) {
    return ThumbnailService.moderationHint(err);
  }

  /**
   * Does the user have a personal OpenAI key configured in the
   * API key manager? Useful for the UI to show a "uses your OpenAI
   * key" badge vs "uses server key" warning.
   * @returns {boolean}
   */
  static hasUserOpenAIKey() {
    try {
      return Boolean(apiKeyManager && apiKeyManager.hasOpenAIKey && apiKeyManager.hasOpenAIKey());
    } catch {
      return false;
    }
  }

  static isOpenAIImageModel(modelId) {
    return openaiConfig.isOpenAIImageModel(modelId);
  }

  static hasUserMuapiKey() {
    try {
      return Boolean(apiKeyManager && apiKeyManager.hasMuapiKey && apiKeyManager.hasMuapiKey());
    } catch {
      return false;
    }
  }

  /**
   * Upload a local file to OpenAI's Files API and return the file_id.
   * Lets callers pass files (instead of base64) as reference images in the
   * Responses API image_generation tool.
   *
   * The browser cannot call the Files API directly (it requires a server-side
   * key), so this proxies through a new "upload-reference" action on the
   * ai-thumbnail-generator edge function.
   *
   * @param {File|Blob} file
   * @param {string} [purpose='vision']
   * @returns {Promise<{ id: string }>}
   */
  async uploadReferenceFile(file, purpose = 'vision', opts = {}) {
    const form = new FormData();
    form.append('action', 'upload-reference');
    form.append('purpose', purpose);
    form.append('file', file);
    // Forward the user's OpenAI key so the Files API call is charged
    // to the user rather than the server's shared env key.
    const userKey = resolveUserOpenAIKey(opts.apiKey);
    if (userKey) form.append('apiKey', userKey);

    const url = `${getSupabaseUrl()}/functions/v1/${EDGE_FUNCTION}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getSupabaseAnonKey()}`,
        apikey: getSupabaseAnonKey(),
      },
      body: form,
    });
    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch { /* ignore */ }
      throw new Error(detail || `File upload failed (${res.status})`);
    }
    const data = await res.json();
    if (data?.error) throw new Error(data.error);
    return { id: data.id };
  }
}

export default ThumbnailService;
