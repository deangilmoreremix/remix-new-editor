// Recipe Engine - registry and orchestration for multi-step AI workflows.
// Recipes are additive and run through the existing muapi proxy path.

export const RECIPES = [
  {
    id: 'product-commercial',
    name: 'Product Commercial',
    description: 'Generate a product image, then animate it into a short commercial.',
    category: 'commercial',
    steps: [
      { label: 'Generate product image', type: 'image', model: 'ai-product-shot', prompt: '{{prompt}}' },
      { label: 'Animate to video', type: 'i2v', model: 'wan-3.0-i2v', prompt: '{{previous}}' }
    ]
  },
  {
    id: 'character-promo',
    name: 'Character Promo',
    description: 'Create a consistent character and turn it into a promo clip.',
    category: 'character',
    steps: [
      { label: 'Generate character', type: 'image', model: 'flux-pulid', prompt: '{{prompt}}' },
      { label: 'Animate character', type: 'i2v', model: 'wan-3.0-i2v', prompt: '{{previous}}' }
    ]
  },
  {
    id: 'cinematic-short',
    name: 'Cinematic Short',
    description: 'Generate cinematic footage from text with audio.',
    category: 'cinema',
    steps: [
      { label: 'Generate video', type: 't2v', model: 'seedance-2.5-t2v', prompt: '{{prompt}}' },
      { label: 'Generate narration', type: 'audio', model: 'flux-3-audio', prompt: ' narration for: {{previous}}' }
    ]
  },
  {
    id: 'social-ad-bundle',
    name: 'Social Ad Bundle',
    description: 'Produce image + video variants for social ads.',
    category: 'social',
    steps: [
      { label: 'Generate hero image', type: 'image', model: 'flux-dev', prompt: '{{prompt}}' },
      { label: 'Generate video variant', type: 'i2v', model: 'wan-3.0-i2v', prompt: '{{previous}}' }
    ]
  },
  {
    id: 'voiceover-script',
    name: 'Voiceover + Script',
    description: 'Write narration and generate matching audio.',
    category: 'audio',
    steps: [
      { label: 'Generate audio', type: 'audio', model: 'flux-3-audio', prompt: '{{prompt}}' }
    ]
  },
  {
    id: 'upscale-workflow',
    name: 'Upscale Workflow',
    description: 'Generate then upscale for final delivery.',
    category: 'utility',
    steps: [
      { label: 'Generate image', type: 'image', model: 'flux-dev', prompt: '{{prompt}}' },
      { label: 'Upscale', type: 'video-tool', model: 'wan-3.0-upscale', prompt: '{{previous}}' }
    ]
  }
];

export function getRecipeById(id) {
  return RECIPES.find(r => r.id === id) || null;
}

export function searchRecipes({ query = '', category = '' } = {}) {
  const q = query.toLowerCase().trim();
  return RECIPES.filter(r => {
    if (category && r.category !== category) return false;
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
  });
}

const STEP_METHOD = {
  image: 'generateImage',
  i2i: 'generateI2I',
  t2v: 'generateVideo',
  i2v: 'generateI2V',
  audio: 'generateAudio',
  avatar: 'generateAvatar',
  'video-tool': 'processVideoTool',
  'video-tools': 'processVideoTool',
  audio2video: 'processLipSync',
  'lip-sync': 'processLipSync',
  lipsync: 'processLipSync',
};

const STEP_PARAM_KEYS = [
  'model', 'prompt', 'image_url', 'video_url', 'audio_url', 'duration',
  'aspect_ratio', 'resolution', 'quality', 'seed', 'name', 'strength',
  'images_list', 'style', 'system_prompt', 'temperature', 'max_tokens',
  'trigger_word', 'epochs', 'images', 'instrumental',
  'native_audio', 'character_consistency',
  'reference_images', 'reference_videos', 'reference_audios',
  'last_image_url', 'sheet_url',
];

async function dispatchStep(muapiClient, type, params, signal) {
  const method = STEP_METHOD[type];
  if (method) {
    if (method === 'processLipSync') {
      return muapiClient.processLipSync(params);
    }
    return muapiClient[method](params, signal);
  }
  console.warn(`[recipeEngine] Unrecognized step type "${type}", falling back to generateImage`);
  return muapiClient.generateImage(params, signal);
}

export async function runRecipe(muapiClient, recipe, options = {}) {
  const {
    basePrompt = ' cinematic quality',
    previousResult = '',
    native_audio,
    character_consistency,
    reference_images,
    signal,
    onLog = () => {},
  } = options;

  const client = muapiClient || (await import('./muapi.js')).muapi;
  let prev = previousResult || '';

  for (const step of recipe.steps) {
    onLog(`Step: ${step.label}`);
    try {
      const prompt = String(step.prompt || '')
        .replace('{{previous}}', prev)
        .replace('{{prompt}}', basePrompt || ' cinematic quality');

      const params = { prompt, model: step.model };
      for (const key of STEP_PARAM_KEYS) {
        if (key in step) params[key] = step[key];
      }

      if (native_audio !== undefined && params.native_audio === undefined) {
        params.native_audio = native_audio;
      }
      if (character_consistency !== undefined && params.character_consistency === undefined) {
        params.character_consistency = character_consistency;
      }
      if (reference_images?.length && !params.reference_images?.length) {
        params.reference_images = reference_images;
      }

      const result = await dispatchStep(client, step.type, params, signal);
      prev = result?.url || result?.outputs?.[0] || '';
      onLog(`Done: ${prev ? 'output ready' : 'no output'}`);
    } catch (err) {
      onLog(`Error: ${err?.message || err}`);
      break;
    }
  }

  return prev;
}
