/**
 * SmartVideo Studio — Output Renderer
 *
 * Helpers for displaying generation results appropriately
 * based on output type (image, video, audio, 3D, etc.)
 */

export type OutputType = 'image' | 'video' | 'audio' | '3d' | 'text' | 'unknown';

export function detectOutputType(output: unknown, modelId: string): OutputType {
  if (!output) return 'unknown';

  const modelName = modelId.toLowerCase();

  if (modelName.includes('image') || modelName.includes('flux') || modelName.includes('dall') || modelName.includes('midjourney')) {
    return 'image';
  }
  if (modelName.includes('video') || modelName.includes('kling') || modelName.includes('seedance') || modelName.includes('veo') || modelName.includes('wan') || modelName.includes('pixverse')) {
    return 'video';
  }
  if (modelName.includes('audio') || modelName.includes('suno') || modelName.includes('music') || modelName.includes('tts') || modelName.includes('speech')) {
    return 'audio';
  }
  if (modelName.includes('avatar') || modelName.includes('lip') || modelName.includes('lipsync')) {
    return 'video';
  }
  if (modelName.includes('3d') || modelName.includes('tripo') || modelName.includes('meshy')) {
    return '3d';
  }

  return 'unknown';
}
