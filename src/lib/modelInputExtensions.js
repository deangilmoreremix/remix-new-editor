// src/lib/modelInputExtensions.js
// Augments the auto-generated model schemas with advanced parameters
// that are not yet present in src/lib/models.js but are supported by the
// MuAPI backend and exposed in the historical UI.

const EXTENSIONS = {
  // Text-to-Image
  'flux-dev': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    guidance_scale: { type: 'slider', title: 'Guidance Scale', default: 7.5, minValue: 1, maxValue: 20, step: 0.5, group: 'advanced' },
    steps: { type: 'slider', title: 'Steps', default: 25, minValue: 1, maxValue: 50, step: 1, group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
    lora: { type: 'text', title: 'LoRA Model ID', group: 'lora' },
    lora_weight: { type: 'slider', title: 'LoRA Weight', default: 1.0, minValue: 0.1, maxValue: 2.0, step: 0.1, group: 'lora' },
  },
  'flux-schnell': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    guidance_scale: { type: 'slider', title: 'Guidance Scale', default: 7.5, minValue: 1, maxValue: 20, step: 0.5, group: 'advanced' },
    steps: { type: 'slider', title: 'Steps', default: 25, minValue: 1, maxValue: 50, step: 1, group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
    num_images: { type: 'integer', title: 'Number of images', default: 1, minValue: 1, maxValue: 4, step: 1, group: 'basic' },
  },
  'nano-banana': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    guidance_scale: { type: 'slider', title: 'Guidance Scale', default: 7.5, minValue: 1, maxValue: 20, step: 0.5, group: 'advanced' },
    steps: { type: 'slider', title: 'Steps', default: 25, minValue: 1, maxValue: 50, step: 1, group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'nano-banana-2': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    guidance_scale: { type: 'slider', title: 'Guidance Scale', default: 7.5, minValue: 1, maxValue: 20, step: 0.5, group: 'advanced' },
    steps: { type: 'slider', title: 'Steps', default: 25, minValue: 1, maxValue: 50, step: 1, group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'nano-banana-pro': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    guidance_scale: { type: 'slider', title: 'Guidance Scale', default: 7.5, minValue: 1, maxValue: 20, step: 0.5, group: 'advanced' },
    steps: { type: 'slider', title: 'Steps', default: 25, minValue: 1, maxValue: 50, step: 1, group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'midjourney-v7-text-to-image': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'sdxl-image': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    guidance_scale: { type: 'slider', title: 'Guidance Scale', default: 7.5, minValue: 1, maxValue: 20, step: 0.5, group: 'advanced' },
    steps: { type: 'slider', title: 'Steps', default: 25, minValue: 1, maxValue: 50, step: 1, group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  // Image-to-Image
  'flux-dev-i2i': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    guidance_scale: { type: 'slider', title: 'Guidance Scale', default: 7.5, minValue: 1, maxValue: 20, step: 0.5, group: 'advanced' },
    steps: { type: 'slider', title: 'Steps', default: 25, minValue: 1, maxValue: 50, step: 1, group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
    reference_strength: { type: 'slider', title: 'Reference Strength', default: 50, minValue: 0, maxValue: 100, step: 5, group: 'advanced' },
    lora: { type: 'text', title: 'LoRA Model ID', group: 'lora' },
    lora_weight: { type: 'slider', title: 'LoRA Weight', default: 1.0, minValue: 0.1, maxValue: 2.0, step: 0.1, group: 'lora' },
  },
  'flux-kontext-dev-i2i': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    guidance_scale: { type: 'slider', title: 'Guidance Scale', default: 7.5, minValue: 1, maxValue: 20, step: 0.5, group: 'advanced' },
    steps: { type: 'slider', title: 'Steps', default: 25, minValue: 1, maxValue: 50, step: 1, group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
    reference_strength: { type: 'slider', title: 'Reference Strength', default: 50, minValue: 0, maxValue: 100, step: 5, group: 'advanced' },
  },
  'flux-kontext-pro-i2i': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    guidance_scale: { type: 'slider', title: 'Guidance Scale', default: 7.5, minValue: 1, maxValue: 20, step: 0.5, group: 'advanced' },
    steps: { type: 'slider', title: 'Steps', default: 25, minValue: 1, maxValue: 50, step: 1, group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
    reference_strength: { type: 'slider', title: 'Reference Strength', default: 50, minValue: 0, maxValue: 100, step: 5, group: 'advanced' },
  },
  'flux-kontext-max-i2i': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    guidance_scale: { type: 'slider', title: 'Guidance Scale', default: 7.5, minValue: 1, maxValue: 20, step: 0.5, group: 'advanced' },
    steps: { type: 'slider', title: 'Steps', default: 25, minValue: 1, maxValue: 50, step: 1, group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
    reference_strength: { type: 'slider', title: 'Reference Strength', default: 50, minValue: 0, maxValue: 100, step: 5, group: 'advanced' },
  },
  'gpt4o-image-to-image': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    guidance_scale: { type: 'slider', title: 'Guidance Scale', default: 7.5, minValue: 1, maxValue: 20, step: 0.5, group: 'advanced' },
    steps: { type: 'slider', title: 'Steps', default: 25, minValue: 1, maxValue: 50, step: 1, group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'gpt4o-edit': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    guidance_scale: { type: 'slider', title: 'Guidance Scale', default: 7.5, minValue: 1, maxValue: 20, step: 0.5, group: 'advanced' },
    steps: { type: 'slider', title: 'Steps', default: 25, minValue: 1, maxValue: 50, step: 1, group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'midjourney-v7-image-to-image': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'nano-banana-2-edit': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    guidance_scale: { type: 'slider', title: 'Guidance Scale', default: 7.5, minValue: 1, maxValue: 20, step: 0.5, group: 'advanced' },
    steps: { type: 'slider', title: 'Steps', default: 25, minValue: 1, maxValue: 50, step: 1, group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
    reference_strength: { type: 'slider', title: 'Reference Strength', default: 50, minValue: 0, maxValue: 100, step: 5, group: 'advanced' },
  },
  // Text-to-Video
  'seedance-v2.0-t2v': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'seedance-v1.5-pro-t2v': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'kling-v3.0-pro-text-to-video': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'kling-v2.6-pro-t2v': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'kling-v2.5-turbo-pro-t2v': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'runway-text-to-video': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'wan2.1-text-to-video': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'wan2.2-text-to-video': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'openai-sora': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'openai-sora-2-text-to-video': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  // Image-to-Video
  'kling-v3.0-pro-i2v': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'runway-gen-3-i2v': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'veo-3-i2v': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  // Video-to-Video / Lip Sync / Video Tools
  'ltx-2.3-lipsync': {
    seed: { type: 'seed', title: 'Seed', default: -1, group: 'advanced' },
  },
  'video-watermark-remover': {
    negative_prompt: { type: 'text', title: 'Negative Prompt', group: 'advanced' },
  },
};

export function getModelInputExtensions(modelId) {
  return EXTENSIONS[modelId] || {};
}

export function getExtendedModel(model) {
  if (!model) return model;
  const extra = getModelInputExtensions(model.id);
  if (Object.keys(extra).length === 0) return model;
  return {
    ...model,
    inputs: { ...model.inputs, ...extra },
  };
}
