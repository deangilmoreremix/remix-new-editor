// Recast and Motion Control models, ported from upstream Open-Generative-AI's
// models.js. Recast drives a character image with the motion in a video;
// Motion Control rebuilds a performance video with new characters/assets.

export const recastModels = [
  {
    id: 'kling-v3.0-pro-recast',
    name: 'Kling 3.0 Pro Motion Control',
    endpoint: 'kling-v3.0-pro-motion-control',
    family: 'kling',
    videoField: 'video_url',
    imageField: 'image_url',
    hasPrompt: true,
    description: 'Transfer the motion from your video onto a character image with maximum fidelity.',
  },
  {
    id: 'runway-act-two-recast',
    name: 'Runway Act Two',
    endpoint: 'runway-act-two-i2v',
    family: 'runway',
    videoField: 'video_url',
    imageField: 'image_url',
    hasPrompt: false,
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
    description: 'Recast any character — drive a character image with the motion and performance from your video.',
  },
  {
    id: 'wan2.2-animate-recast',
    name: 'Wan2.2 Animate',
    endpoint: 'wan2.2-animate',
    family: 'wan2.2',
    videoField: 'video_url',
    imageField: 'image_url',
    hasPrompt: true,
    description: 'Animate a character or replace a character in existing video clips.',
  },
];

const SEEDANCE_25_RATIOS = ['adaptive', '16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'];

export const motionControlModels = [
  {
    id: 'seedance-2.5-motion-control',
    name: 'Seedance 2.5 Motion Control',
    endpoint: 'seedance-2.5-motion-control',
    description: 'Up to 30s, up to 30 reference assets, adaptive aspect ratio and audio.',
    minDuration: 4, maxDuration: 30, defaultDuration: 5, maxImages: 30,
    supportsAudio: true, supportsBitrate: true, supportsSeed: true,
    aspectRatios: SEEDANCE_25_RATIOS, defaultAspectRatio: '16:9',
  },
  {
    id: 'seedance-2-motion-control',
    name: 'Seedance 2.0 Motion Control',
    endpoint: 'seedance-2-motion-control',
    description: 'Extract motion from a reference video and rebuild the scene with new characters (up to 15s, 9 assets).',
    minDuration: 4, maxDuration: 15, defaultDuration: 5, maxImages: 9,
    supportsAudio: true, supportsQuality: true, supportsSeed: true,
    aspectRatios: ['16:9', '9:16', '4:3', '1:1', '3:4', '21:9'], defaultAspectRatio: '16:9',
  },
  {
    id: 'seedance-2.5-intl-motion-control',
    name: 'Seedance 2.5 Intl Motion Control',
    endpoint: 'seedance-2.5-intl-motion-control',
    description: 'International-region Seedance 2.5 Motion Control.',
    minDuration: 4, maxDuration: 30, defaultDuration: 5, maxImages: 30,
    supportsAudio: true, supportsBitrate: true, supportsSeed: true,
    aspectRatios: SEEDANCE_25_RATIOS, defaultAspectRatio: '16:9',
  },
  {
    id: 'seedance-2.5-spicy-motion-control',
    name: 'Seedance 2.5 Spicy Motion Control',
    endpoint: 'seedance-2.5-spicy-motion-control',
    description: 'Seedance 2.5 Motion Control with a bolder creative treatment.',
    minDuration: 4, maxDuration: 30, defaultDuration: 5, maxImages: 30,
    supportsAudio: true, supportsBitrate: true, supportsSeed: true,
    aspectRatios: SEEDANCE_25_RATIOS, defaultAspectRatio: '16:9',
  },
];

export const getRecastModelById = (id) => recastModels.find((m) => m.id === id);
export const getMotionControlModelById = (id) => motionControlModels.find((m) => m.id === id) || motionControlModels[0];
