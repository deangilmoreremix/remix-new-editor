// Tool tables copied verbatim from upstream Open-Generative-AI
// (packages/studio/src/seedanceModels.js and veoModels.js). These operations
// consume a previous result, so the picker lists them in their own sections.

const seedanceTools = new Map([
  ["seedance-2-extend", { group: "continueGenerated", variant: "standard", order: 0 }],
  ["seedance-v2.0-extend", { group: "continueGenerated", variant: "standard", order: 0 }],
  ["seedance-2-vip-extend", { group: "continueGenerated", variant: "vip", order: 1 }],
  ["seedance-2-vip-extend-1080p", { group: "continueGenerated", variant: "vip", resolution: "1080p", order: 2 }],
  ["seedance-2-watermark-remover", { group: "removeWatermark", variant: "standard", order: 0 }],
  ["seedance-2-video-watermark-remover-pro", { group: "removeWatermark", variant: "pro", order: 1 }],
]);

export function getSeedanceToolConfiguration(modelId) {
  return seedanceTools.get(modelId);
}

const tools = new Map([
  ["veo3.1-extend-video", { key: "continueGenerated", order: 0 }],
  ["veo3.1-4k-video", { key: "upscale", order: 1 }],
]);

export function getVeoToolConfiguration(modelId) {
  return tools.get(modelId);
}
