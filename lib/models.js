// AI Models Configuration - SmartVideo Integration
// Compatibility layer: re-exports from the canonical src/lib/models.js
// and preserves the legacy MODELS object + helper functions.

import {
  t2iModels,
  i2iModels,
  t2vModels,
  i2vModels,
  v2vModels,
  lipsyncModels,
  audioModels,
  avatarModels,
  trainingModels,
  videoToolsModels,
  textModels,
} from '../src/lib/models.js';

// Build legacy MODELS map from all arrays
const allModels = [
  ...t2iModels,
  ...i2iModels,
  ...t2vModels,
  ...i2vModels,
  ...v2vModels,
  ...lipsyncModels,
  ...audioModels,
  ...avatarModels,
  ...trainingModels,
  ...videoToolsModels,
  ...textModels,
];

export const MODELS = Object.fromEntries(allModels.map(m => [m.id, { ...m, type: m.type || guessType(m) }]));

function guessType(model) {
  if (t2iModels.find(m => m.id === model.id)) return 'text-to-image';
  if (i2iModels.find(m => m.id === model.id)) return 'image-to-image';
  if (t2vModels.find(m => m.id === model.id)) return 'text-to-video';
  if (i2vModels.find(m => m.id === model.id)) return 'image-to-video';
  if (v2vModels.find(m => m.id === model.id)) return 'video-to-video';
  if (lipsyncModels.find(m => m.id === model.id)) return 'lip-sync';
  if (audioModels.find(m => m.id === model.id)) return 'audio';
  if (avatarModels.find(m => m.id === model.id)) return 'avatar';
  if (trainingModels.find(m => m.id === model.id)) return 'training';
  if (videoToolsModels.find(m => m.id === model.id)) return 'video-tools';
  if (textModels.find(m => m.id === model.id)) return 'text';
  return 'unknown';
}

// Re-export canonical arrays for new code
export { t2iModels, i2iModels, t2vModels, i2vModels, v2vModels, lipsyncModels, audioModels, avatarModels, trainingModels, videoToolsModels, textModels };

// Legacy helper functions
export function getModelsByType(type) {
  return Object.entries(MODELS)
    .filter(([_, model]) => model.type === type)
    .map(([id, model]) => ({ id, ...model }));
}

export function getModelById(id) {
  return MODELS[id] || null;
}

export function getTextToImageModels() {
  return getModelsByType('text-to-image');
}

export function getImageToImageModels() {
  return getModelsByType('image-to-image');
}

export function getTextToVideoModels() {
  return getModelsByType('text-to-video');
}

export function getImageToVideoModels() {
  return getModelsByType('image-to-video');
}

export function getVideoToVideoModels() {
  return getModelsByType('video-to-video');
}

export function getVoiceCloningModels() {
  return getModelsByType('voice-cloning');
}

export function getTextToSpeechModels() {
  return getModelsByType('text-to-speech');
}

export function getLipSyncModels() {
  return getModelsByType('lip-sync');
}

export function getAvatarModels() {
  return getModelsByType('avatar');
}

export function getTrainingModels() {
  return getModelsByType('training');
}

export function getVideoToolsModels() {
  return getModelsByType('video-tools');
}

export function getTextModels() {
  return getModelsByType('text');
}

export function supportsAspectRatio(modelId, aspectRatio) {
  const model = getModelById(modelId);
  return model ? (model.aspectRatios || []).includes(aspectRatio) : false;
}

export function getModelMaxResolution(modelId) {
  const model = getModelById(modelId);
  return model ? model.maxResolution : null;
}

export function supportsMultipleImages(modelId) {
  const model = getModelById(modelId);
  return model ? (model.maxImages || 1) > 1 : false;
}

export function getModelMaxImages(modelId) {
  const model = getModelById(modelId);
  return model ? model.maxImages || 1 : 1;
}

// Default model selections for different use cases
export const DEFAULT_MODELS = {
  avatar: 'flux-dev',
  video: 'kling-v3.0-pro',
  imageToVideo: 'kling-v3.0-pro-i2v',
  lipSync: 'ltx-2.3-lipsync',
  upscale: 'upscale-2x',
  enhance: 'face-enhancer'
};

// Model categories for UI organization
export const MODEL_CATEGORIES = {
  textToImage: {
    name: 'Text to Image',
    description: 'Generate images from text descriptions',
    models: getTextToImageModels()
  },
  imageToImage: {
    name: 'Image to Image',
    description: 'Transform and edit existing images',
    models: getImageToImageModels()
  },
  textToVideo: {
    name: 'Text to Video',
    description: 'Create videos from text descriptions',
    models: getTextToVideoModels()
  },
  imageToVideo: {
    name: 'Image to Video',
    description: 'Animate images into videos',
    models: getImageToVideoModels()
  },
  videoProcessing: {
    name: 'Video Processing',
    description: 'Edit and enhance videos',
    models: getVideoToVideoModels()
  }
};
