// Recipe Engine - registry and orchestration for multi-step AI workflows.
// Recipes are additive and run through the existing muapi proxy path.
//
// A step's `prompt` is a template: `{{prompt}}` is the user's base prompt.
// To chain steps, give a step an `input` ('image_url' | 'video_url' |
// 'audio_url'): the previous step's output URL is sent in that field, which is
// what the muapi endpoints read. (`{{previous}}` still works inside a prompt
// template, but a URL is not a useful prompt, so no built-in recipe uses it.)
//
// Some models start from an image the user supplies (a product photo, a face).
// Such a recipe declares `reference: { label, hint, required }` and its first
// step sets `reference: true`; runRecipe then sends `options.referenceImage` as
// that step's image_url and refuses to start without it. A step can also set
// `promptKey` when its model reads the text under another name (ai-product-shot
// takes `scene_description`, not `prompt`).

export const RECIPES = [
  {
    id: 'product-commercial',
    name: 'Product Commercial',
    description: 'Place your product photo in a new scene, then animate it into a short commercial.',
    category: 'commercial',
    reference: {
      label: 'Product photo',
      hint: 'A clear photo of the product. The prompt below describes the scene to place it in.',
      required: true
    },
    steps: [
      { label: 'Place product in scene', type: 'i2i', model: 'ai-product-shot', prompt: '{{prompt}}', promptKey: 'scene_description', reference: true },
      { label: 'Animate to video', type: 'i2v', model: 'wan-3.0-i2v', prompt: '{{prompt}}', input: 'image_url' }
    ]
  },
  {
    id: 'character-promo',
    name: 'Character Promo',
    description: 'Recreate a character from a reference face, then turn it into a promo clip.',
    category: 'character',
    reference: {
      label: 'Face reference',
      hint: 'A clear photo of the face to keep consistent. The prompt below describes the scene or style.',
      required: true
    },
    steps: [
      { label: 'Generate character', type: 'image', model: 'flux-pulid', prompt: '{{prompt}}', reference: true },
      { label: 'Animate character', type: 'i2v', model: 'wan-3.0-i2v', prompt: '{{prompt}}', input: 'image_url' }
    ]
  },
  {
    id: 'cinematic-short',
    name: 'Cinematic Short',
    description: 'Generate cinematic footage from text, plus a matching soundtrack.',
    category: 'cinema',
    steps: [
      { label: 'Generate video', type: 't2v', model: 'seedance-2.5-t2v', prompt: '{{prompt}}' },
      { label: 'Generate soundtrack', type: 'audio', model: 'flux-3-audio', prompt: 'Cinematic soundtrack for: {{prompt}}' }
    ]
  },
  {
    id: 'social-ad-bundle',
    name: 'Social Ad Bundle',
    description: 'Produce a hero image, then a video variant of it for social ads.',
    category: 'social',
    steps: [
      { label: 'Generate hero image', type: 'image', model: 'flux-dev', prompt: '{{prompt}}' },
      { label: 'Generate video variant', type: 'i2v', model: 'wan-3.0-i2v', prompt: '{{prompt}}', input: 'image_url' }
    ]
  },
  {
    // flux-3-audio generates music (style + duration), not speech, so this
    // recipe is a music track rather than a voiceover.
    id: 'music-track',
    name: 'Music Track',
    description: 'Generate a music track that matches your prompt.',
    category: 'audio',
    steps: [
      { label: 'Generate music', type: 'audio', model: 'flux-3-audio', prompt: '{{prompt}}' }
    ]
  },
  {
    // wan-3.0-upscale takes a video (video_url), so this generates a clip first.
    id: 'upscale-workflow',
    name: 'Upscale Workflow',
    description: 'Generate a video clip, then upscale it for final delivery.',
    category: 'utility',
    steps: [
      { label: 'Generate video', type: 't2v', model: 'seedance-2.5-t2v', prompt: '{{prompt}}' },
      { label: 'Upscale', type: 'video-tool', model: 'wan-3.0-upscale', prompt: '{{prompt}}', input: 'video_url' }
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

const CHAIN_FIELDS = ['image_url', 'video_url', 'audio_url'];

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

// Runs the steps in order and returns the last step's output URL.
// - `onLog(text)`: progress lines.
// - `onStep({ index, total, label, status, url })`: status is 'running' | 'done'.
//   Every finished step's URL is reported here, so callers can show all outputs
//   (e.g. both the clip and the soundtrack), not just the last one.
// A failed step, or a chained step with nothing to chain from, throws after
// logging; outputs of earlier steps were already delivered through onStep.
export async function runRecipe(muapiClient, recipe, options = {}) {
  const {
    basePrompt = ' cinematic quality',
    previousResult = '',
    native_audio,
    character_consistency,
    reference_images,
    referenceImage = '',
    signal,
    onLog = () => {},
    onStep = () => {},
  } = options;

  // Fail before any paid step runs when the recipe needs a photo and none was given.
  if (recipe.reference?.required && !referenceImage) {
    const msg = `${recipe.reference.label} is required for "${recipe.name}".`;
    onLog(`Error: ${msg}`);
    throw new Error(msg);
  }

  const client = muapiClient || (await import('./muapi.js')).muapi;
  const base = basePrompt || ' cinematic quality';
  const total = recipe.steps.length;
  let prev = previousResult || '';

  for (let index = 0; index < total; index++) {
    const step = recipe.steps[index];
    onLog(`Step ${index + 1}/${total}: ${step.label}`);
    onStep({ index, total, label: step.label, status: 'running', url: '' });
    try {
      const prompt = String(step.prompt || '')
        .replace(/\{\{previous\}\}/g, prev)
        .replace(/\{\{prompt\}\}/g, base);

      const params = { prompt, model: step.model };
      for (const key of STEP_PARAM_KEYS) {
        // `prompt` is the already-substituted template above; copying the
        // step's own field here would send the raw "{{prompt}}" text.
        if (key === 'prompt') continue;
        if (key in step) params[key] = step[key];
      }
      // Models that read the text under another field name (e.g. scene_description).
      if (step.promptKey && step.promptKey !== 'prompt') {
        params[step.promptKey] = prompt;
        delete params.prompt;
      }
      if (step.reference) {
        if (!referenceImage) throw new Error(`Step "${step.label}" needs a reference image.`);
        params.image_url = referenceImage;
      }

      if (step.input) {
        if (!CHAIN_FIELDS.includes(step.input)) {
          throw new Error(`Step "${step.label}" has an unsupported input "${step.input}".`);
        }
        if (!prev) {
          throw new Error(`Step "${step.label}" needs the previous step's output, but none was returned.`);
        }
        params[step.input] = prev;
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
      const url = result?.url || result?.outputs?.[0] || '';
      onLog(`Done: ${url ? 'output ready' : 'no output'}`);
      onStep({ index, total, label: step.label, status: 'done', url });
      // A step that returns nothing must not silently feed the next one the
      // previous step's output, so chaining restarts from this step's result.
      prev = url;
    } catch (err) {
      onLog(`Error: ${err?.message || err}`);
      throw err;
    }
  }

  return prev;
}
