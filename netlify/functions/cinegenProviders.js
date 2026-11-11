// netlify/functions/cinegenProviders.js
// Real provider adapters for Timeline Studio AI tools.
// MuAPI only (no fal). Object masking / segmentation runs free in the
// browser (src/lib/editor/ml, SlimSAM via Transformers.js), not here.

import {
  buildFirstLastFramePayload,
  buildVideoExtendPayload,
  buildLayerPayload,
  resultUrls,
} from '../../src/lib/muapi/frameModels.js';

const MUAPI_BASE_URL = 'https://api.muapi.ai/api/v1';

// Mirror of isStaticPlaceholderUrl in supabase/functions/muapi-proxy (same
// KNOWN_STATIC_PATTERNS: exact path prefixes only, to avoid false positives
// on legitimate CDN URLs). MuAPI sometimes returns static demo assets
// (homepage/demo/sandbox) instead of real generated output; those must never
// surface as generated media. The Supabase function is Deno-only and cannot
// be imported here, so the predicate is duplicated deliberately.
const KNOWN_STATIC_PLACEHOLDER_PATTERNS = [
  '/muapi/homepage/',
  '/muapi/demo/',
  '/muapi/sandbox/',
  '/static/demo/',
];

function isStaticPlaceholderUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return KNOWN_STATIC_PLACEHOLDER_PATTERNS.some(pattern => lower.includes(pattern));
}

function getApiKey(userKey) {
  const key = userKey || process.env.MUAPI_API_KEY;
  if (!key) {
    throw new Error('MUAPI_API_KEY is not configured');
  }
  return key;
}

export async function muapiPost(path, payload, signal, userKey) {
  // userKey: the caller's own MuAPI key (BYOK). Older callers still use the env key.
  const key = getApiKey(userKey);
  const response = await fetch(`${MUAPI_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`MuAPI ${path} failed: ${response.status} ${response.statusText} - ${text.slice(0, 200)}`), { status: response.status });
  }

  return response.json();
}

async function pollForResult(requestId, maxAttempts = 60, baseInterval = 2000, signal, userKey) {
  const getInterval = (attempt) => {
    const exponentialDelay = Math.min(baseInterval * Math.pow(1.5, attempt - 1), 30000);
    const jitter = exponentialDelay * 0.2 * Math.random();
    return exponentialDelay + jitter;
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error('Request cancelled');
    }

    await new Promise(resolve => setTimeout(resolve, getInterval(attempt)));

    if (signal?.aborted) {
      throw new Error('Request cancelled');
    }

    try {
      const data = await muapiPost(`/predictions/${encodeURIComponent(requestId)}/result`, {}, signal, userKey);

      const status = (data.status || '').toLowerCase();
      if (status === 'completed' || status === 'succeeded' || status === 'success') {
        return data;
      }
      if (status === 'failed' || status === 'error') {
        throw new Error(`MuAPI generation failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      if (error.message === 'Request cancelled') throw error;
      if (attempt === maxAttempts) throw error;
    }
  }

  throw new Error('MuAPI generation timed out');
}

async function submitAndWait({ endpoint, payload, signal, timeoutMs = 120000, userKey } = {}) {
  if (!endpoint) throw new Error('MuAPI endpoint is required');

  const controller = signal ? null : new AbortController();
  const effectiveSignal = signal || controller.signal;
  const timeoutId = setTimeout(() => controller?.abort(), timeoutMs);

  try {
    const submitResponse = await muapiPost(endpoint, payload, effectiveSignal, userKey);
    const requestId = submitResponse.request_id || submitResponse.id;
    if (!requestId) {
      return {
        requestId: null,
        outputs: submitResponse.outputs,
        raw: submitResponse,
        url: submitResponse.outputs?.[0] || submitResponse.url || submitResponse.output?.url,
      };
    }

    const result = await pollForResult(requestId, 60, 2000, effectiveSignal, userKey);
    return {
      requestId,
      outputs: result.outputs,
      raw: result,
      url: result.outputs?.[0] || result.url || result.output?.url,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function extractRealUrl(result) {
  if (!result || typeof result !== 'object') return null;
  const candidates = [
    result.outputs?.[0],
    result.url,
    result.output?.url,
    result.video?.url,
    result.audio?.url,
    result.image?.url,
    result.images?.[0],
  ];
  const url = candidates.find(Boolean);
  if (!url || typeof url !== 'string') return null;
  const lower = url.toLowerCase();
  const staticPatterns = [
    '/muapi/homepage/',
    '/muapi/demo/',
    '/muapi/sandbox/',
    '/webassets/videomodels/',
    '/webassets/',
    '/placeholder/',
    '/static/demo/',
  ];
  if (staticPatterns.some(p => lower.includes(p))) return null;
  return url;
}

// ============================================================================
// PROVIDER ADAPTERS
// ============================================================================

/**
 * Fill Gap on MuAPI. Needs the real boundary frames (public https URLs) —
 * the Timeline Editor grabs and uploads them in the browser. Each MuAPI
 * model has its own endpoint and field names (src/lib/muapi/frameModels.js).
 */
export async function providerFillGap(params = {}) {
  const firstFrameUrl = params.firstFrameUrl || params.boundaryFrameUrl;
  const lastFrameUrl = params.lastFrameUrl;
  if (!firstFrameUrl && !lastFrameUrl) {
    return { success: false, code: 'BAD_INPUT', tool: 'fill_gap', error: 'Boundary frame URLs are required for fill_gap (the editor grabs them from the clips next to the gap).' };
  }
  let req;
  try {
    req = buildFirstLastFramePayload({ model: params.model, firstFrameUrl, lastFrameUrl, prompt: params.prompt, duration: params.duration ?? 5 });
  } catch (err) {
    return { success: false, code: 'BAD_INPUT', tool: 'fill_gap', error: err.message };
  }
  const result = await submitAndWait({ endpoint: req.endpoint, payload: req.payload, userKey: params.userKey, timeoutMs: 180000 });
  const realUrl = extractRealUrl(result);
  if (!realUrl) return { success: false, code: 'PROVIDER_ERROR', tool: 'fill_gap', error: 'No real output URL from provider' };
  return { success: true, tool: 'fill_gap', url: realUrl, model: req.model, duration: req.payload.duration, requestId: result.requestId, raw: result.raw };
}

/** Extend a clip forward from its own video (MuAPI video-extend models). */
export async function providerExtend(params = {}) {
  const videoUrl = params.videoUrl || params.video_url;
  if (!videoUrl) {
    return { success: false, code: 'BAD_INPUT', tool: 'extend', error: 'videoUrl (the clip\'s public video URL) is required for extend' };
  }
  let req;
  try {
    req = buildVideoExtendPayload({ model: params.model, videoUrl, prompt: params.prompt, duration: params.addedDuration ?? params.duration ?? 5 });
  } catch (err) {
    return { success: false, code: 'BAD_INPUT', tool: 'extend', error: err.message };
  }
  const result = await submitAndWait({ endpoint: req.endpoint, payload: req.payload, userKey: params.userKey, timeoutMs: 180000 });
  const realUrl = extractRealUrl(result);
  if (!realUrl) return { success: false, code: 'PROVIDER_ERROR', tool: 'extend', error: 'No real output URL from provider' };
  return { success: true, tool: 'extend', url: realUrl, model: req.model, addedDuration: req.payload.duration, direction: 'after', requestId: result.requestId, raw: result.raw };
}

/** Suno request body shared by music generation paths. */
export function musicPayload({ prompt, genre, mood, style, duration = 30, instrumental = true } = {}) {
  const musicPrompt = [
    prompt,
    genre ? `Genre: ${genre}` : null,
    mood ? `Mood: ${mood}` : null,
    style ? `Style: ${style}` : null,
    instrumental ? 'Instrumental only' : null,
  ].filter(Boolean).join('. ');
  return {
    prompt: musicPrompt,
    genre: genre || 'ambient',
    mood: mood || 'calm',
    style: style || 'cinematic',
    duration: Math.min(Math.max(Number(duration) || 30, 10), 180),
    instrumental,
  };
}

export async function providerMusicGeneration(params = {}) {
  const {
    prompt,
    genre,
    mood,
    style,
    duration = 30,
    instrumental = true,
  } = params;

  if (!prompt && !genre && !mood) {
    return { success: false, code: 'PROVIDER_NOT_CONFIGURED', error: 'Music prompt or genre/mood is required' };
  }

  const result = await submitAndWait({
    endpoint: '/suno-create-music',
    payload: musicPayload({ prompt, genre, mood, style, duration, instrumental }),
    timeoutMs: 180000,
  });

  const realUrl = extractRealUrl(result);
  if (!realUrl) {
    return { success: false, code: 'PROVIDER_NOT_CONFIGURED', error: 'No real audio URL from provider' };
  }

  return {
    success: true,
    tool: 'music_generation',
    url: realUrl,
    genre,
    mood,
    tempo: params.tempo || 120,
    instrumental,
    duration,
    requestId: result.requestId,
    raw: result.raw,
  };
}

// Composition Plan moved to the Timeline Editor (OpenAI plan + MuAPI sections): src/lib/editor/ai/music.js
// LLM chat moved to /api/timeline-llm (OpenAI Responses API, user's own key).

const RUNS_IN_BROWSER = 'Object masking runs free in your browser now (Timeline Editor → select a clip → Free AI → Mask an object). No server or fal account is used.';

export async function providerMaskTool() {
  return { success: false, code: 'RUNS_IN_BROWSER', tool: 'mask_tool', error: RUNS_IN_BROWSER };
}

export async function providerSAM3Segment() {
  return { success: false, code: 'RUNS_IN_BROWSER', tool: 'sam3_segment', error: RUNS_IN_BROWSER };
}

export async function providerAudioSync(params = {}) {
  return {
    success: false,
    code: 'PROVIDER_NOT_CONFIGURED',
    tool: 'audio_sync',
    error: 'Server-side audio sync is not configured. Use the local audioSync utility in the editor for waveform-based sync.'
  };
}

export async function providerProxyPlayback(params = {}) {
  return {
    success: false,
    code: 'PROVIDER_NOT_CONFIGURED',
    tool: 'proxy_playback',
    error: 'Proxy playback is not configured. Browser-native low-res preview is not currently available for this project.'
  };
}

/** Split an image into layers on MuAPI (Seedream layer models). */
export async function providerLayerDecompose(params = {}) {
  if (!params.imageUrl) {
    return { success: false, code: 'BAD_INPUT', tool: 'layer_decompose', error: 'An image URL is required for layer decomposition.' };
  }
  let req;
  try {
    req = buildLayerPayload({ model: params.model, imageUrl: params.imageUrl, prompt: params.prompt });
  } catch (err) {
    return { success: false, code: 'BAD_INPUT', tool: 'layer_decompose', error: err.message };
  }
  try {
    const result = await submitAndWait({ endpoint: req.endpoint, payload: req.payload, userKey: params.userKey, timeoutMs: 180000 });
    const urls = resultUrls(result.raw || result).filter((u) => !isStaticPlaceholderUrl(u));
    if (!urls.length) throw new Error('MuAPI returned no layers');
    const layers = urls.map((url, index) => ({ name: `Layer ${index + 1}`, url, index }));
    return { success: true, tool: 'layer_decompose', url: layers[0].url, layers, model: req.model, requestId: result.requestId, raw: result.raw };
  } catch (error) {
    console.error('[providerLayerDecompose] MuAPI error:', error?.message);
    return { success: false, code: 'PROVIDER_ERROR', tool: 'layer_decompose', error: error.message || 'Layer decomposition failed' };
  }
}
