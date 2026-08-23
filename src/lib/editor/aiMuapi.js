import { aiService } from '../services/aiService.js';
import { supabase } from '../supabase.js';

export class AiMuAPI {
  static async generateVideo(prompt, model = 'wan2.1-text-to-video', options = {}) {
    return aiService.generateVideo({ prompt, model }, options);
  }

  static async generateImage(prompt, model = 'flux-dev', options = {}) {
    return aiService.generateImage({ prompt, model }, options);
  }

  static async applySAM3Segmentation(imageData, prompts) {
    const { type = 'text', prompt = '', points, box } = prompts || {};

    const { data, error } = await supabase.functions.invoke('sam3-segment', {
      body: {
        imageUrl: imageData,
        promptType: type,
        prompt,
        ...(points ? { points } : {}),
        ...(box ? { box } : {}),
      },
    });

    if (error) {
      throw new Error(error.message || 'SAM3 segmentation failed');
    }

    return { mask: data?.maskUrl };
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