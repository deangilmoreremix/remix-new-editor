// Image-editing models that Edit Studio offers inside its tool studios.
//
// Each tool lists the model ids it can run. What a model needs (how many
// images, which request field carries them, whether it takes a prompt) is read
// from its definition in src/lib/models.js, so this file only adds the
// plain-English label, group and one-line note shown in the Model picker.

import { i2iModels } from '../../lib/models.js';

const info = (group, note, label) => ({ group, note, ...(label ? { label } : {}) });

export const MODEL_INFO = {
  // ── AI Edit ──────────────────────────────────────────────────────────────
  'seedream-5.0-edit': info('ByteDance', 'ByteDance\'s latest Seedream editor. Sharp and follows instructions closely. A good default.'),
  'bytedance-seededit-v3': info('ByteDance', 'Precise single-instruction edits that leave the rest of the photo alone.'),
  'bytedance-seedream-edit-v4': info('ByteDance', 'High-resolution editor that can blend several reference images.'),
  'bytedance-seedream-v4.5-edit': info('ByteDance', 'Newer Seedream with better detail and a quality setting.'),
  'nano-banana-edit': info('Google', 'Google\'s fast everyday editor. Keeps faces and details consistent.'),
  'nano-banana-pro-edit': info('Google', 'Higher-quality Google editor. Up to 8 images, choose the output resolution.'),
  'nano-banana-2-edit': info('Google', 'Newest Google editor. Up to 14 reference images, and can use Google Search for real-world details.'),
  'gpt4o-edit': info('OpenAI', 'OpenAI editor that follows detailed instructions well.'),
  'gpt4o-image-to-image': info('OpenAI', 'Redo or restyle a photo from up to 5 images with GPT-4o.'),
  'gpt-image-1.5-edit': info('OpenAI', 'Newer OpenAI editor. Best at text and logos inside images.'),
  'flux-kontext-dev-i2i': info('Flux', 'Cheapest Flux Kontext. Good at keeping the rest of the photo untouched.'),
  'flux-kontext-pro-i2i': info('Flux', 'Balanced Flux Kontext. Strong edits with consistent subjects.'),
  'flux-kontext-max-i2i': info('Flux', 'Highest-quality Flux Kontext.'),
  'flux-2-dev-edit': info('Flux', 'Next-generation Flux editor with multi-image references.'),
  'flux-2-flex-edit': info('Flux', 'Flux 2 with adjustable aspect ratio and resolution.'),
  'flux-2-pro-edit': info('Flux', 'Sharpest Flux 2 editor.'),
  'flux-2-klein-4b-edit': info('Flux', 'Small and very fast. Good for quick tweaks.'),
  'flux-2-klein-9b-edit': info('Flux', 'Fast Flux with a bit more quality than the 4B.'),
  'flux-3-i2i': info('Flux', 'Latest Flux. Use Strength to control how much it changes the photo.'),
  'qwen-image-edit': info('Qwen', 'Alibaba\'s editor. Very good with text inside images.'),
  'qwen-image-edit-plus': info('Qwen', 'Qwen editor that can combine up to 3 images.'),
  'qwen-image-edit-2511': info('Qwen', 'Newest Qwen editor with better consistency.'),
  'wan2.5-image-edit': info('Wan', 'Alibaba Wan editor. Good at realistic photo edits.'),
  'wan2.6-image-edit': info('Wan', 'Newer Wan editor with up to 3 images.'),
  'wan-3.0-i2i': info('Wan', 'Latest Wan. Use Strength to control how much it changes the photo.'),
  'reve-image-edit': info('More', 'Strong aesthetics and accurate prompt following.'),
  'kling-o1-edit-image': info('More', 'Kuaishou\'s Kling editor. Multi-image, choose the resolution.'),
  'grok-imagine-image-to-image': info('More', 'xAI\'s Grok editor. Just upload and describe the change.'),
  'grok-imagine-image-2': info('More', 'Newer Grok editor with up to 5 reference images and a Strength setting.'),
  'midjourney-v7-image-to-image': info('More', 'Midjourney\'s artistic look, with stylization, variety and weirdness controls.'),

  // ── Upscale ──────────────────────────────────────────────────────────────
  'ai-image-upscaler': info('Upscalers', 'Quick, clean upscale. Good everyday default.'),
  'topaz-image-upscale': info('Upscalers', 'Pro-grade enlargement (choose 2x, 4x or 8x) that recovers fine detail.'),
  'seedvr2-image-upscale': info('Upscalers', 'Upscales to a resolution you choose, up to 4K.'),

  // ── Product Shot ─────────────────────────────────────────────────────────
  'ai-product-shot': info('Product', 'Places your product in a scene you describe.'),
  'ai-product-photography': info('Product', 'Turns a product photo into a polished studio or lifestyle shot.'),

  // ── Photo Effects ────────────────────────────────────────────────────────
  'image-effects': info('Effects', '18 one-click looks: acrylic ornaments, American comic, angel figurine, cyberpunk, felt 3D polaroid and more.'),
  'nano-banana-effects': info('Effects', '17 one-click looks: 3D figurine, 16-bit game character, action figure, decade looks (1920s to 1980s) and more.'),
  'flux-kontext-effects': info('Effects', '13 one-click edits: age progression, background change, cartoonify, hair change, expression change and more.'),

  // ── Change Angle ─────────────────────────────────────────────────────────
  'qwen-image-edit-plus-lora': info('Camera', 'Re-shoots the photo from a new angle: rotate, move closer, look up or down, wide-angle lens.', 'Qwen Camera Angle'),

  // ── Character & Reference ────────────────────────────────────────────────
  'ideogram-character': info('Character', 'Puts the same character into any new scene you describe.'),
  'minimax-image-01-subject-reference': info('Character', 'Keeps a person or product consistent across new images.'),
  'midjourney-v7-omni-reference': info('Character', 'Midjourney with an "use this exact subject" reference. Weight sets how strongly.'),
  'midjourney-v7-style-reference': info('Character', 'Copies the style of your image onto brand-new content.'),
  'vidu-q2-reference-to-image': info('Character', 'Combines up to 7 reference images into one new scene.'),
};

export const AI_EDIT_MODEL_IDS = [
  'seedream-5.0-edit',
  'nano-banana-edit', 'nano-banana-pro-edit', 'nano-banana-2-edit',
  'gpt4o-edit', 'gpt4o-image-to-image', 'gpt-image-1.5-edit',
  'flux-kontext-dev-i2i', 'flux-kontext-pro-i2i', 'flux-kontext-max-i2i',
  'flux-2-dev-edit', 'flux-2-flex-edit', 'flux-2-pro-edit',
  'flux-2-klein-4b-edit', 'flux-2-klein-9b-edit', 'flux-3-i2i',
  'qwen-image-edit', 'qwen-image-edit-plus', 'qwen-image-edit-2511',
  'bytedance-seededit-v3', 'bytedance-seedream-edit-v4', 'bytedance-seedream-v4.5-edit',
  'wan2.5-image-edit', 'wan2.6-image-edit', 'wan-3.0-i2i',
  'reve-image-edit', 'kling-o1-edit-image',
  'grok-imagine-image-to-image', 'grok-imagine-image-2',
  'midjourney-v7-image-to-image',
];
export const UPSCALE_MODEL_IDS = ['ai-image-upscaler', 'topaz-image-upscale', 'seedvr2-image-upscale'];
export const PRODUCT_MODEL_IDS = ['ai-product-shot', 'ai-product-photography'];
export const EFFECT_MODEL_IDS = ['image-effects', 'nano-banana-effects', 'flux-kontext-effects'];
export const ANGLE_MODEL_IDS = ['qwen-image-edit-plus-lora'];
export const CHARACTER_MODEL_IDS = [
  'ideogram-character',
  'minimax-image-01-subject-reference',
  'midjourney-v7-omni-reference',
  'midjourney-v7-style-reference',
  'vidu-q2-reference-to-image',
];

const DEFAULT_REFERENCE_MAX = 4;

/**
 * What a model needs, read from its definition in src/lib/models.js:
 *   sourceKey  request field that carries the image(s)
 *   maxImages  how many images it accepts (the first is the source)
 *   promptKey  'prompt' | 'scene_description' | null when it takes no prompt
 *   inputs     the model's input schema (settings)
 */
export function getModelSpec(id) {
  const model = i2iModels.find((entry) => entry.id === id);
  if (!model) return null;
  const inputs = model.inputs || {};
  let sourceKey = model.imageField || 'image_url';
  let maxImages = 1;
  if (!model.imageField && inputs.reference_images) {
    sourceKey = 'reference_images';
    maxImages = inputs.reference_images.maxItems || inputs.reference_images.max_items || DEFAULT_REFERENCE_MAX;
  } else if (model.imageField === 'images_list') {
    maxImages = model.maxImages || 1;
  }
  let promptKey = null;
  if (inputs.scene_description) promptKey = 'scene_description';
  else if (inputs.prompt) promptKey = 'prompt';
  return {
    id,
    name: model.name || id,
    sourceKey,
    maxImages,
    promptKey,
    inputs,
  };
}

export function getModelInfo(id) {
  const spec = getModelSpec(id);
  const meta = MODEL_INFO[id] || {};
  return {
    id,
    label: meta.label || spec?.name || id,
    group: meta.group || 'Models',
    note: meta.note || '',
  };
}
