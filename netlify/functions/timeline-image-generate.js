/**
 * Netlify function: timeline-image-generate
 *
 * Server-side AI image generation for the Template Generator modal.
 * Uses OpenAI's GPT-Image-2 model.
 *
 * Two modes:
 *   1. Context-aware (preferred): uses the Responses API with the
 *      image_generation tool so the model can refine the prompt using
 *      the Template Generator context (niche, script, scene, brand).
 *   2. Direct: uses POST /v1/images/generations with gpt-image-2 for
 *      simpler standalone generation.
 *
 * The OpenAI Responses API image_generation tool returns base64-encoded
 * images; this function decodes them and re-encodes as data URLs for
 * immediate frontend preview. For persistent storage, the frontend
 * should upload the data URL to SmartVideo asset storage.
 *
 * POST body: {
 *   prompt: string,
 *   niche?: string,
 *   scene?: string,
 *   aspectRatio?: '16:9' | '9:16' | '1:1',
 *   size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto',
 *   quality?: 'low' | 'medium' | 'high' | 'auto',
 *   referenceImageUrl?: string,  // for editing
 *   editInstruction?: string,    // for editing
 *   n?: number (1-4),
 * }
 *
 * Returns: { ok: true, assets: [{ id, type, url, prompt, model, ... }] }
 *       or { ok: false, error: string }
 */

const TIMEOUT_MS = 120_000;

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
const RESPONSES_MODEL = process.env.OPENAI_RESPONSES_TEXT_MODEL || 'gpt-5.6';

const fetchWithTimeout = async (url, options = {}, timeoutMs = TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

function aspectToSize(aspectRatio) {
  switch (aspectRatio) {
    case '9:16': return '1024x1536';
    case '1:1': return '1024x1024';
    case '16:9':
    default: return '1536x1024';
  }
}

function parseDimensions(size) {
  const m = /^(\d+)x(\d+)$/.exec(size);
  if (!m) return { width: 1024, height: 1024 };
  return { width: Number(m[1]), height: Number(m[2]) };
}

async function callResponsesApi(apiKey, body) {
  return fetchWithTimeout('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
}

async function callImagesApi(apiKey, body) {
  return fetchWithTimeout('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
}

function buildContextBlock(input) {
  const ctx = [];
  if (input.niche) ctx.push(`Industry/Niche: ${input.niche}`);
  if (input.scene) ctx.push(`Scene: ${input.scene}`);
  if (input.aspectRatio) ctx.push(`Aspect ratio: ${input.aspectRatio}`);
  return ctx.length > 0 ? `CONTEXT:\n${ctx.join('\n')}\n\n` : '';
}

function buildRefinedPromptInstructions() {
  return `You are an expert visual director for short-form commercial video.
Your job: take the user's prompt and any provided context, and produce a
single refined, photorealistic, commercial-quality image-generation prompt.

Rules:
- Be specific about composition, lighting, lens, mood.
- Avoid copyrighted characters, logos, and real people.
- For commercial video stills, prefer cinematic framing, natural lighting, no text overlays.
- Return only the refined prompt text (no preamble, no labels).`;
}

function extractBase64FromResponsesOutput(data) {
  if (!data?.output) return [];
  const results = [];
  for (const item of data.output) {
    if (item.type === 'image_generation_call' || item.type === 'image') {
      if (item.result) results.push(item.result);
      if (item.b64_json) results.push(item.b64_json);
    }
    if (item.content) {
      for (const c of item.content) {
        if (c.type === 'image' && c.image_base64) results.push(c.image_base64);
        if (c.type === 'output_image' && c.image_base64) results.push(c.image_base64);
      }
    }
  }
  return results;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders() };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse(503, { ok: false, error: 'OPENAI_API_KEY not configured on server' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { ok: false, error: 'Invalid JSON body' });
  }

  const {
    prompt,
    niche,
    scene,
    aspectRatio = '16:9',
    size,
    quality = 'auto',
    referenceImageUrl,
    editInstruction,
    n = 1,
  } = body;

  if (!prompt || !prompt.trim()) {
    return jsonResponse(400, { ok: false, error: 'Prompt is required' });
  }

  const resolvedSize = size && size !== 'auto' ? size : aspectToSize(aspectRatio);
  const { width, height } = parseDimensions(resolvedSize);
  const contextBlock = buildContextBlock({ niche, scene, aspectRatio });

  let imageRes;
  let useResponsesApi = false;
  let responseId = null;
  let revisedPrompt = null;

  // Strategy:
  // - If context is provided (niche/scene), use Responses API with the
  //   image_generation tool for context-aware generation.
  // - Otherwise, use the direct /v1/images/generations endpoint.

  if (niche || scene) {
    // Context-aware path via Responses API
    useResponsesApi = true;
    const fullPrompt = `${contextBlock}User prompt: ${prompt.trim()}\n\nRefine this into a high-quality image-generation prompt.`;
    const reqBody = {
      model: RESPONSES_MODEL,
      instructions: buildRefinedPromptInstructions(),
      input: [{ role: 'user', content: fullPrompt }],
    };

    // First, get the refined prompt via Responses API
    let respRefine;
    try {
      respRefine = await callResponsesApi(apiKey, reqBody);
    } catch (e) {
      const msg = e?.name === 'AbortError' ? 'OpenAI Responses API timed out' : `Network error: ${e.message}`;
      return jsonResponse(502, { ok: false, error: msg });
    }
    if (!respRefine.ok) {
      let detail = '';
      try {
        const errJson = await respRefine.json();
        detail = errJson?.error?.message || errJson?.details || '';
      } catch {}
      return jsonResponse(respRefine.status, { ok: false, error: `OpenAI Responses API error (${respRefine.status})${detail ? `: ${detail}` : ''}` });
    }
    let refineData;
    try {
      refineData = await respRefine.json();
    } catch {
      return jsonResponse(502, { ok: false, error: 'Invalid JSON from OpenAI Responses API' });
    }
    responseId = refineData.id || null;
    const refined = (refineData.output_text || '').trim();
    revisedPrompt = refined || prompt.trim();

    // Now call the direct image generation endpoint with the refined prompt
    const directBody = {
      model: IMAGE_MODEL,
      prompt: revisedPrompt,
      size: resolvedSize,
      n: Math.min(Math.max(n, 1), 4),
    };
    if (quality && quality !== 'auto') directBody.quality = quality;

    try {
      imageRes = await callImagesApi(apiKey, directBody);
    } catch (e) {
      const msg = e?.name === 'AbortError' ? 'OpenAI Images API timed out' : `Network error: ${e.message}`;
      return jsonResponse(502, { ok: false, error: msg });
    }
  } else {
    // Direct path
    const directBody = {
      model: IMAGE_MODEL,
      prompt: prompt.trim(),
      size: resolvedSize,
      n: Math.min(Math.max(n, 1), 4),
    };
    if (quality && quality !== 'auto') directBody.quality = quality;

    try {
      imageRes = await callImagesApi(apiKey, directBody);
    } catch (e) {
      const msg = e?.name === 'AbortError' ? 'OpenAI Images API timed out' : `Network error: ${e.message}`;
      return jsonResponse(502, { ok: false, error: msg });
    }
  }

  if (!imageRes.ok) {
    let detail = '';
    try {
      const errJson = await imageRes.json();
      detail = errJson?.error?.message || errJson?.details || '';
    } catch {
      try { detail = await imageRes.text(); } catch {}
    }
    return jsonResponse(imageRes.status, { ok: false, error: `OpenAI Images API error (${imageRes.status})${detail ? `: ${detail}` : ''}` });
  }

  let data;
  try {
    data = await imageRes.json();
  } catch {
    return jsonResponse(502, { ok: false, error: 'Invalid JSON from OpenAI Images API' });
  }

  // Normalize both base64 and URL responses
  const assets = (data.data || []).map((item, i) => {
    if (item.b64_json) {
      return {
        id: `openai-img-${Date.now()}-${i}`,
        type: 'image',
        source: 'openai',
        provider: 'openai',
        model: IMAGE_MODEL,
        name: prompt.slice(0, 60),
        url: `data:image/png;base64,${item.b64_json}`,
        thumbnail: `data:image/png;base64,${item.b64_json}`,
        prompt: prompt,
        revisedPrompt: revisedPrompt || item.revised_prompt || null,
        width,
        height,
        mimeType: 'image/png',
        generationMetadata: {
          responseId,
          useResponsesApi,
          createdAt: new Date().toISOString(),
        },
      };
    }
    if (item.url) {
      return {
        id: `openai-img-${Date.now()}-${i}`,
        type: 'image',
        source: 'openai',
        provider: 'openai',
        model: IMAGE_MODEL,
        name: prompt.slice(0, 60),
        url: item.url,
        thumbnail: item.url,
        prompt: prompt,
        revisedPrompt: revisedPrompt || item.revised_prompt || null,
        width,
        height,
        mimeType: 'image/png',
        generationMetadata: {
          responseId,
          useResponsesApi,
          createdAt: new Date().toISOString(),
        },
      };
    }
    return null;
  }).filter(Boolean);

  if (assets.length === 0) {
    return jsonResponse(502, { ok: false, error: 'No images returned by OpenAI' });
  }

  return jsonResponse(200, { ok: true, assets });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
    body: JSON.stringify(body),
  };
}
