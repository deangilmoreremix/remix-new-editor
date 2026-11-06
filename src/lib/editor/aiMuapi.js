import { aiService } from '../services/aiService.js';

export class AiMuAPI {
  static async generateVideo(prompt, model = 'wan2.1-text-to-video', options = {}) {
    return aiService.generateVideo({ prompt, model }, options);
  }

  static async generateImage(prompt, model = 'flux-dev', options = {}) {
    return aiService.generateImage({ prompt, model }, options);
  }

  /**
   * Object segmentation, free in the browser (SlimSAM / OWLv2 via
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