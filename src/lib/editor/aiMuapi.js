import { aiService } from '../services/aiService.js';
import { generateImages, DEFAULT_IMAGE_MODEL } from './ai/openaiImages.js';

// Image models that run on the user's OpenAI key (Images 2.6) instead of MuAPI.
const isOpenAIImageChoice = (m) => !m || m === 'flux-dev' || /^gpt-image-/.test(m);

export class AiMuAPI {
  static async generateVideo(prompt, model = 'wan2.1-text-to-video', options = {}) {
    return aiService.generateVideo({ prompt, model }, options);
  }

  static async generateImage(prompt, model = DEFAULT_IMAGE_MODEL, options = {}) {
    // Default / legacy 'flux-dev' / gpt-image-* → OpenAI Images 2.6 (user's own key).
    // Any other explicit model id chosen by the user stays on MuAPI.
    if (isOpenAIImageChoice(model)) {
      const openaiModel = /^gpt-image-/.test(model || '') ? model : DEFAULT_IMAGE_MODEL;
      const { assets } = await generateImages(prompt, { model: openaiModel, aspectRatio: options.aspectRatio || '1:1', refs: options.refs || [] });
      if (!assets.length) throw new Error('OpenAI returned no image');
      return { url: assets[0].url, model: openaiModel, provider: 'openai' };
    }
    return aiService.generateImage({ prompt, model }, options);
  }

  /**
   * Object segmentation, free in the browser (SlimSAM + Florence-2 via
   * Transformers.js — no fal, no server). `imageData` is an image URL.
   * prompts: { type: 'text'|'point'|'box', prompt, points: [[x,y]], box: [x1,y1,x2,y2] }
   * Returns { mask } — an object URL of a white-on-black mask PNG.
   */
  static async applySAM3Segmentation(imageData, prompts) {
    const { type = 'text', prompt = '', points, box } = prompts || {};
    const [{ grabFrame }, ai] = await Promise.all([import('./ml/frameGrab.js'), import('./ml/localAI.js')]);
    const canvas = await grabFrame(imageData, 0, { image: true, maxSize: 1280 });
    const res = type === 'text' || (!points && !box)
      ? await ai.maskFromText(canvas, prompt)
      : await ai.maskFromPrompt(canvas, { points, box });
    if (!res?.alpha) throw new Error('No object found for that prompt');
    const png = await ai.alphaToMaskPng(res.alpha, res.width, res.height);
    return { mask: URL.createObjectURL(png) };
  }

  static async generateMusic(context, options = {}) {
    return aiService.muapi.generateMusic({ ...context, ...options });
  }

  // WAN AI Effects implementation
  static async applyWanAIEffect(videoUrl, effectType, options = {}) {
    return aiService.applyWanAIEffect(videoUrl, effectType, options);
  }

  // Batch processing
  static async batchProcess(requests, options = {}) {
    return aiService.batchProcess(requests, options);
  }

  // Service health and monitoring
  static getHealthStatus() {
    return aiService.getHealthStatus();
  }

  static getMonitoringStats() {
    return aiService.monitoring.getStats();
  }

  // Event handling for real-time updates
  static on(event, callback) {
    aiService.on(event, callback);
  }

  static off(event, callback) {
    aiService.off(event, callback);
  }
}