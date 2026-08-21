// Model comparison data: price/speed/quality for ~40 models.
// Prices are relative units; speed is estimated generation time; quality is 1-5.

export const MODEL_COMPARISON = {
  // Text-to-Image
  'nano-banana': { name: 'Nano Banana', price: 1, speed: 3, quality: 4, category: 't2i', family: 'Nano Banana' },
  'flux-dev': { name: 'Flux Dev', price: 3, speed: 4, quality: 5, category: 't2i', family: 'Flux' },
  'flux-schnell': { name: 'Flux Schnell', price: 2, speed: 2, quality: 4, category: 't2i', family: 'Flux' },
  'flux-kontext-dev-t2i': { name: 'Flux Kontext Dev T2I', price: 3, speed: 4, quality: 5, category: 't2i', family: 'Flux' },
  'seedream-5.0': { name: 'Seedream 5.0', price: 4, speed: 5, quality: 5, category: 't2i', family: 'Seedream' },
  'midjourney-v7': { name: 'Midjourney V7', price: 5, speed: 6, quality: 5, category: 't2i', family: 'Midjourney' },
  'gpt-image-1': { name: 'GPT Image 1', price: 4, speed: 5, quality: 5, category: 't2i', family: 'OpenAI' },
  'ideogram-v3': { name: 'Ideogram V3', price: 3, speed: 4, quality: 5, category: 't2i', family: 'Ideogram' },
  'google-imagen4': { name: 'Google Imagen 4', price: 4, speed: 5, quality: 5, category: 't2i', family: 'Google' },
  'sdxl': { name: 'SDXL', price: 1, speed: 3, quality: 3, category: 't2i', family: 'Stable Diffusion' },
  'wan2.1-text-to-image': { name: 'Wan 2.1 T2I', price: 2, speed: 3, quality: 4, category: 't2i', family: 'Wan' },
  'hunyuan-image-2.1': { name: 'Hunyuan Image 2.1', price: 3, speed: 4, quality: 4, category: 't2i', family: 'Hunyuan' },
  'kling-o1': { name: 'Kling O1', price: 4, speed: 5, quality: 5, category: 't2i', family: 'Kling' },
  'qwen-image': { name: 'Qwen Image', price: 2, speed: 3, quality: 4, category: 't2i', family: 'Qwen' },

  // Image-to-Image
  'flux-kontext-dev-i2i': { name: 'Flux Kontext Dev I2I', price: 3, speed: 4, quality: 5, category: 'i2i', family: 'Flux' },
  'flux-2-flex-edit': { name: 'Flux 2 Flex Edit', price: 3, speed: 4, quality: 5, category: 'i2i', family: 'Flux' },
  'gpt-4o-edit': { name: 'GPT 4O Edit', price: 4, speed: 5, quality: 5, category: 'i2i', family: 'OpenAI' },
  'seededit-v3': { name: 'SeedEdit V3', price: 3, speed: 4, quality: 4, category: 'i2i', family: 'Seedance' },
  'bytedance-seedream-edit': { name: 'ByteDance Seedream Edit', price: 3, speed: 4, quality: 5, category: 'i2i', family: 'Seedream' },
  'nano-banana-2-edit': { name: 'Nano Banana 2 Edit', price: 1, speed: 2, quality: 4, category: 'i2i', family: 'Nano Banana' },
  'grok-imagine-image-2': { name: 'Grok Imagine Image 2', price: 3, speed: 4, quality: 4, category: 'i2i', family: 'Grok' },
  'wan-3.0-i2i': { name: 'Wan 3.0 I2I', price: 2, speed: 3, quality: 4, category: 'i2i', family: 'Wan' },
  'flux-3-i2i': { name: 'Flux 3 I2I', price: 3, speed: 4, quality: 5, category: 'i2i', family: 'Flux' },

  // Text-to-Video
  'kling-v2.6': { name: 'Kling V2.6', price: 4, speed: 5, quality: 5, category: 't2v', family: 'Kling' },
  'kling-v3.0-pro': { name: 'Kling V3.0 Pro', price: 5, speed: 6, quality: 5, category: 't2v', family: 'Kling' },
  'sora-2': { name: 'Sora 2', price: 5, speed: 6, quality: 5, category: 't2v', family: 'OpenAI' },
  'veo-3': { name: 'Veo 3', price: 5, speed: 6, quality: 5, category: 't2v', family: 'Google' },
  'seedance-2.0': { name: 'Seedance 2.0', price: 3, speed: 4, quality: 5, category: 't2v', family: 'Seedance' },
  'seedance-2.5-t2v': { name: 'Seedance 2.5 T2V', price: 4, speed: 5, quality: 5, category: 't2v', family: 'Seedance' },
  'wan-2.5': { name: 'Wan 2.5', price: 2, speed: 3, quality: 4, category: 't2v', family: 'Wan' },
  'wan-3.0-t2v': { name: 'Wan 3.0 T2V', price: 3, speed: 4, quality: 4, category: 't2v', family: 'Wan' },
  'hunyuan-video': { name: 'Hunyuan Video', price: 3, speed: 4, quality: 4, category: 't2v', family: 'Hunyuan' },
  'hailuo-02': { name: 'Hailuo 02', price: 3, speed: 4, quality: 4, category: 't2v', family: 'Hailuo' },
  'runway-gen-3': { name: 'Runway Gen 3', price: 4, speed: 5, quality: 5, category: 't2v', family: 'Runway' },
  'pixverse-v5.5': { name: 'Pixverse V5.5', price: 2, speed: 3, quality: 4, category: 't2v', family: 'Pixverse' },
  'vidu-v2.0': { name: 'Vidu V2.0', price: 3, speed: 4, quality: 4, category: 't2v', family: 'Vidu' },
  'ltx-2-pro': { name: 'LTX 2 Pro', price: 3, speed: 4, quality: 4, category: 't2v', family: 'LTX' },
  'flux-3-t2v': { name: 'Flux 3 T2V', price: 3, speed: 4, quality: 5, category: 't2v', family: 'Flux' },
  'minimax-h3-t2v': { name: 'MiniMax H3 T2V', price: 2, speed: 3, quality: 4, category: 't2v', family: 'MiniMax' },

  // Image-to-Video
  'kling-i2v': { name: 'Kling I2V', price: 4, speed: 5, quality: 5, category: 'i2v', family: 'Kling' },
  'seedance-i2v': { name: 'Seedance I2V', price: 3, speed: 4, quality: 5, category: 'i2v', family: 'Seedance' },
  'seedance-2.5-i2v': { name: 'Seedance 2.5 I2V', price: 4, speed: 5, quality: 5, category: 'i2v', family: 'Seedance' },
  'wan-i2v': { name: 'Wan I2V', price: 2, speed: 3, quality: 4, category: 'i2v', family: 'Wan' },
  'wan-3.0-i2v': { name: 'Wan 3.0 I2V', price: 3, speed: 4, quality: 4, category: 'i2v', family: 'Wan' },
  'runway-i2v': { name: 'Runway I2V', price: 4, speed: 5, quality: 5, category: 'i2v', family: 'Runway' },
  'midjourney-v7-i2v': { name: 'Midjourney V7 I2V', price: 5, speed: 6, quality: 5, category: 'i2v', family: 'Midjourney' },
  'hunyuan-i2v': { name: 'Hunyuan I2V', price: 3, speed: 4, quality: 4, category: 'i2v', family: 'Hunyuan' },
  'pixverse-i2v': { name: 'Pixverse I2V', price: 2, speed: 3, quality: 4, category: 'i2v', family: 'Pixverse' },
  'vidu-q2-reference': { name: 'Vidu Q2 Reference', price: 3, speed: 4, quality: 4, category: 'i2v', family: 'Vidu' },
  'hailuo-i2v': { name: 'Hailuo I2V', price: 3, speed: 4, quality: 4, category: 'i2v', family: 'Hailuo' },
  'sora-2-i2v': { name: 'Sora 2 I2V', price: 5, speed: 6, quality: 5, category: 'i2v', family: 'OpenAI' },
  'ovi-i2v': { name: 'OVI I2V', price: 3, speed: 4, quality: 4, category: 'i2v', family: 'OVI' },
  'ltx-2-i2v': { name: 'LTX 2 I2V', price: 3, speed: 4, quality: 4, category: 'i2v', family: 'LTX' },
  'flux-3-i2v': { name: 'Flux 3 I2V', price: 3, speed: 4, quality: 5, category: 'i2v', family: 'Flux' },
  'minimax-h3-i2v': { name: 'MiniMax H3 I2V', price: 2, speed: 3, quality: 4, category: 'i2v', family: 'MiniMax' },

  // Audio
  'minimax-speech-2.6-turbo': { name: 'MiniMax Speech 2.6 Turbo', price: 1, speed: 2, quality: 4, category: 'audio', family: 'MiniMax' },
  'flux-3-audio': { name: 'Flux 3 Audio', price: 2, speed: 3, quality: 4, category: 'audio', family: 'Flux' },
  'cosyvoice': { name: 'CosyVoice', price: 1, speed: 2, quality: 4, category: 'audio', family: 'CosyVoice' },
  'fish-speech': { name: 'Fish Speech', price: 1, speed: 2, quality: 3, category: 'audio', family: 'Fish Speech' },
  'suno-create-music': { name: 'Suno Create Music', price: 2, speed: 3, quality: 4, category: 'audio', family: 'Suno' },
  'suno-remix-music': { name: 'Suno Remix Music', price: 2, speed: 3, quality: 4, category: 'audio', family: 'Suno' }
};

export const CATEGORY_LABELS = {
  t2i: 'Text-to-Image',
  i2i: 'Image-to-Image',
  t2v: 'Text-to-Video',
  i2v: 'Image-to-Video',
  audio: 'Audio'
};

export function getModelComparison(modelId) {
  return MODEL_COMPARISON[modelId] || null;
}

export function searchModels({ query, category, sortBy = 'quality' } = {}) {
  const q = (query || '').toLowerCase().trim();
  let results = Object.entries(MODEL_COMPARISON).map(([id, data]) => ({ id, ...data }));
  
  if (category && category !== 'all') {
    results = results.filter(m => m.category === category);
  }
  
  if (q) {
    results = results.filter(m => 
      m.id.includes(q) || 
      m.family.toLowerCase().includes(q) || 
      (CATEGORY_LABELS[m.category] || '').toLowerCase().includes(q)
    );
  }
  
  results.sort((a, b) => {
    if (sortBy === 'price') return a.price - b.price;
    if (sortBy === 'speed') return a.speed - b.speed;
    return b.quality - a.quality;
  });
  
  return results;
}
