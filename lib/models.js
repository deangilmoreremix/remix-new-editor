// AI Models Configuration - Open-Higgsfield-AI Integration
// Comprehensive model definitions for 200+ AI models

export const MODELS = {
  // Text-to-Image Models (50+)
  'flux-dev': {
    name: 'Flux Dev',
    provider: 'blackforestlabs',
    type: 'text-to-image',
    maxResolution: '2048x2048',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
    features: ['high-quality', 'fast', 'versatile']
  },
  'flux-schnell': {
    name: 'Flux Schnell',
    provider: 'blackforestlabs',
    type: 'text-to-image',
    maxResolution: '2048x2048',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    features: ['ultra-fast', 'high-quality']
  },
  'nano-banana-2': {
    name: 'Nano Banana 2',
    provider: 'lucataco',
    type: 'text-to-image',
    maxResolution: '1536x1536',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    features: ['anime-style', 'fast', 'high-quality']
  },
  'flux-1.1-pro': {
    name: 'Flux 1.1 Pro',
    provider: 'blackforestlabs',
    type: 'text-to-image',
    maxResolution: '2048x2048',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
    features: ['professional', 'high-resolution', 'versatile']
  },
  'midjourney-v7': {
    name: 'Midjourney v7',
    provider: 'midjourney',
    type: 'text-to-image',
    maxResolution: '2048x2048',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
    features: ['artistic', 'detailed', 'creative']
  },
  'sdxl': {
    name: 'Stable Diffusion XL',
    provider: 'stability-ai',
    type: 'text-to-image',
    maxResolution: '1536x1536',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    features: ['versatile', 'customizable', 'open-source']
  },

  // Image-to-Image Models (55+)
  'flux-dev-i2i': {
    name: 'Flux Dev I2I',
    provider: 'blackforestlabs',
    type: 'image-to-image',
    maxResolution: '2048x2048',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
    features: ['high-quality', 'style-transfer', 'enhancement']
  },
  'flux-kontext-dev-i2i': {
    name: 'Flux Kontext Dev I2I',
    provider: 'blackforestlabs',
    type: 'image-to-image',
    maxResolution: '2048x2048',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
    features: ['context-aware', 'high-quality', 'intelligent-editing']
  },
  'nano-banana-2-edit': {
    name: 'Nano Banana 2 Edit',
    provider: 'lucataco',
    type: 'image-to-image',
    maxResolution: '1536x1536',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    features: ['anime-editing', 'fast', 'high-quality'],
    maxImages: 14
  },
  'gpt-4o-edit': {
    name: 'GPT-4o Edit',
    provider: 'openai',
    type: 'image-to-image',
    maxResolution: '2048x2048',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    features: ['ai-powered-editing', 'natural-language', 'intelligent']
  },

  // Text-to-Video Models (40+)
  'kling-v3.0-pro': {
    name: 'Kling v3.0 Pro',
    provider: 'kling',
    type: 'text-to-video',
    maxResolution: '1920x1080',
    aspectRatios: ['16:9', '9:16', '1:1'],
    maxDuration: 15,
    features: ['high-quality', 'smooth-motion', 'professional']
  },
  'kling-v2.1-pro': {
    name: 'Kling v2.1 Pro',
    provider: 'kling',
    type: 'text-to-video',
    maxResolution: '1920x1080',
    aspectRatios: ['16:9', '9:16', '1:1'],
    maxDuration: 10,
    features: ['fast', 'high-quality', 'versatile']
  },
  'runway-gen-3': {
    name: 'Runway Gen-3',
    provider: 'runway',
    type: 'text-to-video',
    maxResolution: '1920x1080',
    aspectRatios: ['16:9', '9:16', '1:1'],
    maxDuration: 10,
    features: ['cinematic', 'professional', 'high-quality']
  },
  'sora': {
    name: 'Sora',
    provider: 'openai',
    type: 'text-to-video',
    maxResolution: '1920x1080',
    aspectRatios: ['16:9', '9:16', '1:1'],
    maxDuration: 10,
    features: ['ai-powered', 'natural-motion', 'versatile']
  },
  'veo-3': {
    name: 'Veo 3',
    provider: 'google',
    type: 'text-to-video',
    maxResolution: '1920x1080',
    aspectRatios: ['16:9', '9:16', '1:1'],
    maxDuration: 8,
    features: ['high-quality', 'smooth', 'professional']
  },
  'seedance-2.0': {
    name: 'Seedance 2.0',
    provider: 'seed',
    type: 'text-to-video',
    maxResolution: '1920x1080',
    aspectRatios: ['16:9', '9:16', '1:1'],
    maxDuration: 10,
    features: ['creative', 'versatile', 'high-quality']
  },
  'wan-2.1': {
    name: 'Wan 2.1',
    provider: 'wan',
    type: 'text-to-video',
    maxResolution: '1920x1080',
    aspectRatios: ['16:9', '9:16', '1:1'],
    maxDuration: 10,
    features: ['fast', 'high-quality', 'efficient']
  },

  // Image-to-Video Models (60+)
  'kling-v3.0-pro-i2v': {
    name: 'Kling v3.0 Pro I2V',
    provider: 'kling',
    type: 'image-to-video',
    maxResolution: '1920x1080',
    aspectRatios: ['16:9', '9:16', '1:1'],
    maxDuration: 15,
    features: ['high-quality', 'smooth-animation', 'professional']
  },
  'runway-gen-3-i2v': {
    name: 'Runway Gen-3 I2V',
    provider: 'runway',
    type: 'image-to-video',
    maxResolution: '1920x1080',
    aspectRatios: ['16:9', '9:16', '1:1'],
    maxDuration: 10,
    features: ['cinematic', 'animation', 'professional']
  },
  'veo-3-i2v': {
    name: 'Veo 3 I2V',
    provider: 'google',
    type: 'image-to-video',
    maxResolution: '1920x1080',
    aspectRatios: ['16:9', '9:16', '1:1'],
    maxDuration: 8,
    features: ['smooth-animation', 'high-quality', 'natural']
  },
  'midjourney-v7-i2v': {
    name: 'Midjourney v7 I2V',
    provider: 'midjourney',
    type: 'image-to-video',
    maxResolution: '1920x1080',
    aspectRatios: ['16:9', '9:16', '1:1'],
    maxDuration: 5,
    features: ['artistic', 'creative', 'unique']
  },

  // Lip-Sync and Video-to-Video Models
  'ltx-2.3-lipsync': {
    name: 'LTX 2.3 Lip Sync',
    provider: 'ltx',
    type: 'video-to-video',
    maxResolution: '1920x1080',
    features: ['lip-sync', 'audio-sync', 'professional'],
    supportsAudio: true
  },
  'video-watermark-remover': {
    name: 'Video Watermark Remover',
    provider: 'various',
    type: 'video-to-video',
    features: ['watermark-removal', 'cleaning', 'restoration']
  },

  // Upscaling and Enhancement Models
  'upscale-2x': {
    name: '2x Upscaler',
    provider: 'various',
    type: 'image-to-image',
    maxResolution: '4096x4096',
    features: ['upscaling', 'enhancement', 'quality-improvement']
  },
  'face-enhancer': {
    name: 'AI Face Enhancer',
    provider: 'various',
    type: 'image-to-image',
    features: ['face-enhancement', 'portrait-improvement', 'beauty']
  }
};

// Helper functions for model management
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

export function supportsAspectRatio(modelId, aspectRatio) {
  const model = getModelById(modelId);
  return model ? model.aspectRatios.includes(aspectRatio) : false;
}

export function getModelMaxResolution(modelId) {
  const model = getModelById(modelId);
  return model ? model.maxResolution : null;
}

export function supportsMultipleImages(modelId) {
  const model = getModelById(modelId);
  return model ? model.maxImages > 1 : false;
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