/**
 * AI Image service for Template Generator
 *
 * Uses OpenAI's GPT-Image-2 model via the Responses API for context-aware
 * image generation. The actual API key is held server-side in Netlify.
 *
 * The frontend posts to /api/timeline-image-generate which:
 *   1. Uses Responses API with the image_generation tool to create a prompt
 *      informed by the Template Generator context (niche, script, scene, etc.)
 *   2. Returns the generated image as a normalized SmartVideo asset
 *
 * Also supports direct image generation (without context) for simpler
 * standalone use via /v1/images/generations with gpt-image-2.
 */

const NETLIFY_ENDPOINT = '/api/timeline-image-generate';

/**
 * Generate an image using GPT-Image-2 with Template Generator context.
 *
 * @param {Object} params
 * @param {string} params.prompt - User-provided prompt (can be edited)
 * @param {string} [params.niche] - For context
 * @param {string} [params.scene] - Scene description
 * @param {string} [params.aspectRatio] - '16:9' | '9:16' | '1:1'
 * @param {string} [params.size] - GPT-Image-2 size: '1024x1024' | '1024x1536' | '1536x1024' | 'auto'
 * @param {string} [params.quality] - 'low' | 'medium' | 'high' | 'auto'
 * @param {string} [params.referenceImageUrl] - For editing/reference
 * @param {string} [params.editInstruction] - For editing
 * @param {number} [params.n=1] - Number of images (1-4)
 * @returns {Promise<{ ok: boolean, assets: Array, error?: string }>}
 */
export async function generateImage({
  prompt,
  niche,
  scene,
  aspectRatio = '16:9',
  size,
  quality = 'auto',
  referenceImageUrl,
  editInstruction,
  n = 1,
} = {}) {
  if (!prompt || !prompt.trim()) {
    return { ok: false, assets: [], error: 'Prompt is required' };
  }

  try {
    const res = await fetch(NETLIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt.trim(),
        niche,
        scene,
        aspectRatio,
        size,
        quality,
        referenceImageUrl,
        editInstruction,
        n,
      }),
    });

    if (!res.ok) {
      let detail = '';
      try {
        const err = await res.json();
        detail = err?.error || '';
      } catch {}
      return { ok: false, assets: [], error: `Image generation failed (${res.status})${detail ? `: ${detail}` : ''}` };
    }

    const data = await res.json();
    if (!data.ok) {
      return { ok: false, assets: [], error: data.error || 'Image generation failed' };
    }
    return { ok: true, assets: data.assets || [] };
  } catch (e) {
    return { ok: false, assets: [], error: `Network error: ${e.message}` };
  }
}

/**
 * Build a GPT-Image-2-compatible size from an aspect ratio.
 * Returns one of the sizes actually supported by gpt-image-2.
 */
export function aspectRatioToSize(aspectRatio) {
  switch (aspectRatio) {
    case '9:16': return '1024x1536';
    case '1:1': return '1024x1024';
    case '16:9':
    default: return '1536x1024';
  }
}

/**
 * Build a context-aware image prompt suggestion from Template Generator state.
 * This is a heuristic client-side helper; for AI-generated prompts,
 * use the Netlify function's `suggestPrompt` action.
 */
export function buildScenePromptContext({ niche, script, scene, aspectRatio, visualStyle }) {
  const parts = [];
  if (visualStyle) parts.push(`Style: ${visualStyle}.`);
  if (niche) parts.push(`Industry: ${niche}.`);
  if (scene) parts.push(`Scene: ${scene}.`);
  if (script) parts.push(`Script context: ${script.slice(0, 200)}.`);
  if (aspectRatio) parts.push(`Aspect: ${aspectRatio}.`);
  return parts.join(' ');
}

/**
 * Normalize a generated image result to a standard SmartVideo asset.
 */
export function normalizeGeneratedImage(result) {
  if (!result) return null;
  return {
    id: result.id || `openai-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'image',
    source: 'openai',
    provider: 'openai',
    model: result.model || 'gpt-image-2',
    name: result.prompt?.slice(0, 60) || 'AI generated image',
    url: result.url,
    thumbnail: result.url,
    prompt: result.prompt,
    width: result.width,
    height: result.height,
    mimeType: result.mimeType || 'image/png',
    generationMetadata: {
      revisedPrompt: result.revisedPrompt,
      responseId: result.responseId,
      createdAt: new Date().toISOString(),
    },
    metadata: {
      ...result.metadata,
      generated: true,
    },
  };
}

export default {
  generateImage,
  aspectRatioToSize,
  buildScenePromptContext,
  normalizeGeneratedImage,
};
