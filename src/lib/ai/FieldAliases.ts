/**
 * Field Aliases Dictionary
 *
 * Maps provider-specific field names to SmartVideo canonical field concepts.
 * Extend this as new providers/models are added.
 */

export const FIELD_ALIASES: Record<string, string[]> = {
  prompt: [
    'prompt',
    'text_prompt',
    'description',
    'input_prompt',
    'positive_prompt',
  ],

  negative_prompt: [
    'negative_prompt',
    'negative',
    'negative_prompts',
    'exclude',
  ],

  reference_image: [
    'image',
    'image_url',
    'input_image',
    'reference_image',
    'reference_image_url',
    'init_image',
    'source_image',
    'img',
  ],

  reference_images: [
    'images',
    'image_urls',
    'reference_images',
    'input_images',
    'source_images',
  ],

  reference_video: [
    'video',
    'video_url',
    'input_video',
    'reference_video',
    'source_video',
  ],

  reference_audio: [
    'audio',
    'audio_url',
    'input_audio',
    'reference_audio',
    'source_audio',
  ],

  first_frame: [
    'first_frame',
    'first_frame_url',
    'start_frame',
    'start_image',
    'first_image',
    'init_frame',
  ],

  last_frame: [
    'last_frame',
    'last_frame_url',
    'end_frame',
    'end_image',
    'final_frame',
  ],

  duration: [
    'duration',
    'duration_seconds',
    'length',
    'seconds',
    'video_length',
    'clip_duration',
  ],

  aspect_ratio: [
    'aspect_ratio',
    'ratio',
    'aspectRatio',
    'aspect',
    'ar',
  ],

  resolution: [
    'resolution',
    'size',
    'width_height',
    'dimensions',
    'output_size',
  ],

  number_of_images: [
    'num_images',
    'num_outputs',
    'n',
    'count',
    'batch_size',
    'outputs',
    'number_of_images',
  ],

  quality: [
    'quality',
    'quality_level',
    'fidelity',
    'preset',
  ],

  mode: [
    'mode',
    'style',
    'generation_mode',
  ],

  seed: [
    'seed',
    'random_seed',
    'noise_seed',
  ],

  camera_motion: [
    'camera_motion',
    'camera',
    'motion',
    'camera_move',
    'shot_type',
  ],

  lora: [
    'lora',
    'lora_model',
    'lora_name',
    'lora_url',
    'style_model',
  ],

  audio_enabled: [
    'audio_enabled',
    'enable_audio',
    'with_audio',
    'generate_audio',
  ],

  strength: [
    'strength',
    'denoising_strength',
    'cfg_scale',
    'cfg',
    'guidance_scale',
    'prompt_strength',
    'image_strength',
  ],

  output_format: [
    'output_format',
    'format',
    'file_format',
    'media_type',
  ],
};

/**
 * Reverse lookup: provider field name → canonical field name.
 */
const providerToCanonical = new Map<string, string>();

function buildReverseMap() {
  for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const key = alias.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (!providerToCanonical.has(key)) {
        providerToCanonical.set(key, canonical);
      }
    }
  }
}

buildReverseMap();

export function resolveCanonicalField(providerField: string): string | undefined {
  const key = providerField.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return providerToCanonical.get(key);
}
