// netlify/functions/cinegenProviders.js
// Real provider adapters for Timeline Studio AI tools.
// Calls MuAPI directly from the Netlify function runtime.

const MUAPI_BASE_URL = 'https://api.muapi.ai/api/v1';

function getApiKey() {
  const key = process.env.MUAPI_API_KEY;
  if (!key) {
    throw new Error('MUAPI_API_KEY is not configured');
  }
  return key;
}

async function muapiPost(path, payload, signal) {
  const key = getApiKey();
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
    throw new Error(`MuAPI ${path} failed: ${response.status} ${response.statusText} - ${text.slice(0, 200)}`);
  }

  return response.json();
}

async function pollForResult(requestId, maxAttempts = 60, baseInterval = 2000, signal) {
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
      const data = await muapiPost(`/predictions/${encodeURIComponent(requestId)}/result`, {}, signal);

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

async function submitAndWait({ endpoint, payload, signal, timeoutMs = 120000 } = {}) {
  if (!endpoint) throw new Error('MuAPI endpoint is required');

  const controller = signal ? null : new AbortController();
  const effectiveSignal = signal || controller.signal;
  const timeoutId = setTimeout(() => controller?.abort(), timeoutMs);

  try {
    const submitResponse = await muapiPost(endpoint, payload, effectiveSignal);
    const requestId = submitResponse.request_id || submitResponse.id;
    if (!requestId) {
      return {
        requestId: null,
        outputs: submitResponse.outputs,
        raw: submitResponse,
        url: submitResponse.outputs?.[0] || submitResponse.url || submitResponse.output?.url,
      };
    }

    const result = await pollForResult(requestId, 60, 2000, effectiveSignal);
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

function extractRealUrl(result) {
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

export async function providerFillGap(params = {}) {
  const {
    clipId,
    beforeEnd,
    afterStart,
    duration = 5,
    prompt,
    model = 'seedance-2.5-first-last-frame',
  } = params;

  if (!beforeEnd && !afterStart) {
    throw new Error('fill_gap requires beforeEnd or afterStart');
  }

  const firstFrameUrl = params.boundaryFrameUrl || params.firstFrameUrl;
  const lastFrameUrl = params.lastFrameUrl || firstFrameUrl;

  if (!firstFrameUrl) {
    return { success: false, code: 'PROVIDER_NOT_CONFIGURED', error: 'Boundary frame URL is required for fill_gap' };
  }

  const result = await submitAndWait({
    endpoint: '/image-to-video',
    payload: {
      model,
      first_frame_url: firstFrameUrl,
      last_frame_url: lastFrameUrl,
      prompt: prompt || 'Seamless bridge footage',
      duration: Math.min(Math.max(duration, 2), 15),
    },
  });

  const realUrl = extractRealUrl(result);
  if (!realUrl) {
    return { success: false, code: 'PROVIDER_NOT_CONFIGURED', error: 'No real output URL from provider' };
  }

  return {
    success: true,
    tool: 'fill_gap',
    url: realUrl,
    duration,
    requestId: result.requestId,
    raw: result.raw,
  };
}

export async function providerExtend(params = {}) {
  const {
    clipId,
    direction = 'after',
    addedDuration = 5,
    prompt,
    model = 'seedance-2.5-first-last-frame',
    sourceFrameUrl,
  } = params;

  if (!sourceFrameUrl) {
    return { success: false, code: 'PROVIDER_NOT_CONFIGURED', error: 'sourceFrameUrl is required for extend' };
  }

  const result = await submitAndWait({
    endpoint: '/image-to-video',
    payload: {
      model,
      first_frame_url: sourceFrameUrl,
      prompt: prompt || 'Seamless extension of the previous clip',
      duration: Math.min(Math.max(addedDuration, 1), 15),
      prompt_extend: true,
    },
  });

  const realUrl = extractRealUrl(result);
  if (!realUrl) {
    return { success: false, code: 'PROVIDER_NOT_CONFIGURED', error: 'No real output URL from provider' };
  }

  return {
    success: true,
    tool: 'extend',
    url: realUrl,
    addedDuration,
    direction,
    requestId: result.requestId,
    raw: result.raw,
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

  const musicPrompt = [
    prompt,
    genre ? `Genre: ${genre}` : null,
    mood ? `Mood: ${mood}` : null,
    style ? `Style: ${style}` : null,
    instrumental ? 'Instrumental only' : null,
  ].filter(Boolean).join('. ');

  const result = await submitAndWait({
    endpoint: '/suno-create-music',
    payload: {
      prompt: musicPrompt,
      genre: genre || 'ambient',
      mood: mood || 'calm',
      style: style || 'cinematic',
      duration: Math.min(Math.max(duration, 10), 180),
      instrumental,
    },
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

export async function providerElementCreate(params = {}) {
  const { prompt, model = 'flux-dev', aspect_ratio, resolution, style } = params;

  if (!prompt) {
    return { success: false, code: 'PROVIDER_NOT_CONFIGURED', error: 'Element prompt is required' };
  }

  const payload = {
    model,
    prompt,
  };
  if (aspect_ratio) payload.aspect_ratio = aspect_ratio;
  if (resolution) payload.resolution = resolution;
  if (style) payload.style = style;

  const result = await submitAndWait({
    endpoint: '/generate-image',
    payload,
  });

  const realUrl = extractRealUrl(result);
  if (!realUrl) {
    return { success: false, code: 'PROVIDER_NOT_CONFIGURED', error: 'No real image URL from provider' };
  }

  return {
    success: true,
    tool: 'element_create',
    url: realUrl,
    element: {
      name: params.name || 'Element',
      type: params.elementType || 'image',
      description: prompt,
      url: realUrl,
    },
    requestId: result.requestId,
    raw: result.raw,
  };
}

export async function providerShotBoard(params = {}) {
  const { prompt, style = 'cinematic', aspect_ratio = '16:9', count = 4 } = params;

  if (!prompt) {
    return { success: false, code: 'PROVIDER_NOT_CONFIGURED', error: 'Shot board prompt is required' };
  }

  const result = await submitAndWait({
    endpoint: '/generate-image',
    payload: {
      model: 'flux-dev',
      prompt: `Shot board: ${prompt}. Style: ${style}. Aspect ratio: ${aspect_ratio}.`,
      aspect_ratio,
      n: Math.min(Math.max(count, 1), 8),
    },
  });

  const urls = Array.isArray(result.outputs)
    ? result.outputs.filter(u => typeof u === 'string' && !isStaticPlaceholder(u))
    : [];

  if (urls.length === 0) {
    return { success: false, code: 'PROVIDER_NOT_CONFIGURED', error: 'No real image URLs from provider' };
  }

  return {
    success: true,
    tool: 'shot_board',
    urls,
    count: urls.length,
    requestId: result.requestId,
    raw: result.raw,
  };
}

export async function providerCompositionPlan(params = {}) {
  const { duration = 180, mood, genre, style, lyrics } = params;

  const sections = [
    { name: 'Intro', start: 0, end: Math.min(15, duration * 0.1), mood: mood || 'calm', instrumentation: 'ambient pad' },
    { name: 'Verse', start: Math.min(15, duration * 0.1), end: Math.min(60, duration * 0.35), mood: mood || 'neutral', instrumentation: 'piano, soft drums' },
    { name: 'Pre-Chorus', start: Math.min(60, duration * 0.35), end: Math.min(90, duration * 0.5), mood: 'building', instrumentation: 'strings, riser' },
    { name: 'Chorus', start: Math.min(90, duration * 0.5), end: Math.min(135, duration * 0.75), mood: mood || 'energetic', instrumentation: 'full band, lead' },
    { name: 'Bridge', start: Math.min(135, duration * 0.75), end: Math.min(160, duration * 0.9), mood: 'reflective', instrumentation: 'acoustic, minimal' },
    { name: 'Outro', start: Math.min(160, duration * 0.9), end: duration, mood: 'fading', instrumentation: 'ambient pad' },
  ].filter(s => s.end > s.start);

  return {
    success: true,
    tool: 'composition_plan',
    plan: {
      duration,
      genre: genre || 'cinematic',
      style: style || 'modern',
      sections,
      lyrics: lyrics || null,
    },
  };
}

export async function providerLLMChat(params = {}) {
  const { message, context } = params;

  if (!message) {
    return { success: false, code: 'PROVIDER_NOT_CONFIGURED', error: 'message is required for llm_chat' };
  }

  // Structured project context should be supplied by the caller.
  const systemPrompt = [
    'You are a timeline editing assistant.',
    'Respond with concise, actionable instructions.',
    'If you suggest timeline operations, return them as structured actions.',
  ].join(' ');

  const result = await submitAndWait({
    endpoint: '/chat/completions',
    payload: {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...(context?.messages || []),
        { role: 'user', content: message },
      ],
      temperature: 0.4,
      max_tokens: 800,
    },
  });

  const text = result.raw?.choices?.[0]?.message?.content;
  if (!text) {
    return { success: false, code: 'PROVIDER_NOT_CONFIGURED', error: 'No text response from LLM provider' };
  }

  return {
    success: true,
    tool: 'llm_chat',
    text,
    usage: result.raw?.usage || null,
    requestId: result.requestId,
    raw: result.raw,
  };
}

export async function providerMaskTool(params = {}) {
  return {
    success: false,
    code: 'PROVIDER_NOT_CONFIGURED',
    tool: 'mask_tool',
    error: 'SAM3/mask provider is not configured. Configure a segmentation provider to enable masking.',
  };
}

export async function providerSAM3Segment(params = {}) {
  return {
    success: false,
    code: 'PROVIDER_NOT_CONFIGURED',
    tool: 'sam3_segment',
    error: 'SAM3 segmentation provider is not configured.',
  };
}

export async function providerAudioSync(params = {}) {
  return {
    success: false,
    code: 'PROVIDER_NOT_CONFIGURED',
    tool: 'audio_sync',
    error: 'Audio sync provider is not configured. Use the local audioSync utility in the editor.',
  };
}

export async function providerProxyPlayback(params = {}) {
  return {
    success: false,
    code: 'PROVIDER_NOT_CONFIGURED',
    tool: 'proxy_playback',
    error: 'Proxy playback provider is not configured.',
  };
}

export async function providerLayerDecompose(params = {}) {
  return {
    success: false,
    code: 'PROVIDER_NOT_CONFIGURED',
    tool: 'layer_decompose',
    error: 'Layer decomposition provider is not configured.',
  };
}
