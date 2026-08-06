/**
 * MuAPI Service — server-side wrapper around MuAPI's REST API.
 *
 * This module is server-side only. It reads secrets from environment
 * variables and must never be imported from client bundles.
 *
 * Shape mirrors `src/lib/ai/sam3Service.js` so the editor's AI-tool UI
 * can treat all providers uniformly: submit → poll → result, with
 * consistent error handling and loading state.
 */

const MUAPI_BASE_URL = 'https://api.muapi.ai/api/v1';

function getApiKey() {
  const key = typeof process !== 'undefined' ? process.env.MUAPI_API_KEY : import.meta?.env?.MUAPI_API_KEY;
  if (!key) {
    throw new Error('MUAPI_API_KEY is not configured on the server');
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
      if (error.name === 'AbortError') {
        throw new Error('Request cancelled');
      }
      if (attempt === maxAttempts) throw error;
    }
  }

  throw new Error('MuAPI generation timed out');
}

/**
 * Submit a generation request, poll until completion, and return the
 * normalized result.
 *
 * @param {Object} options
 * @param {string} options.endpoint - MuAPI endpoint path, e.g. `/suno-create-music`
 * @param {Object} options.payload - Request body params
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Object>} Normalized result { requestId, outputs, url, raw }
 */
export async function submitAndWait({ endpoint, payload, signal } = {}) {
  if (!endpoint) throw new Error('MuAPI endpoint is required');

  const submitResponse = await muapiPost(endpoint, payload, signal);
  const requestId = submitResponse.request_id || submitResponse.id;
  if (!requestId) {
    // Some endpoints return the result immediately.
    return { requestId: null, outputs: submitResponse.outputs, raw: submitResponse, url: submitResponse.outputs?.[0] || submitResponse.url || submitResponse.output?.url };
  }

  const result = await pollForResult(requestId, 60, 2000, signal);
  return { requestId, outputs: result.outputs, raw: result, url: result.outputs?.[0] || result.url || result.output?.url };
}

/**
 * Suno music generation.
 *
 * @param {Object} params
 * @param {string} params.prompt
 * @param {string} [params.genre]
 * @param {string} [params.mood]
 * @param {string} [params.style]
 * @param {number} [params.duration]
 * @param {boolean} [params.instrumental]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<Object>}
 */
export async function generateMusic({ prompt, genre, mood, style, duration, instrumental, signal } = {}) {
  if (!prompt) throw new Error('Music prompt is required');

  const payload = { prompt };
  if (genre) payload.genre = genre;
  if (mood) payload.mood = mood;
  if (style) payload.style = style;
  if (typeof duration === 'number') payload.duration = duration;
  if (typeof instrumental === 'boolean') payload.instrumental = instrumental;

  return submitAndWait({ endpoint: '/suno-create-music', payload, signal });
}

/**
 * Extend an existing music track.
 *
 * @param {Object} params
 * @param {string} params.sourceAudioUrl
 * @param {number} [params.duration]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<Object>}
 */
export async function extendMusic({ sourceAudioUrl, duration, signal } = {}) {
  if (!sourceAudioUrl) throw new Error('sourceAudioUrl is required');

  const payload = { source_audio_url: sourceAudioUrl };
  if (typeof duration === 'number') payload.duration = duration;

  return submitAndWait({ endpoint: '/suno-extend-music', payload, signal });
}

/**
 * Generate video from first/last frame references.
 *
 * @param {Object} params
 * @param {string} params.firstFrameUrl
 * @param {string} [params.lastFrameUrl]
 * @param {string} [params.prompt]
 * @param {string} [params.model]
 * @param {number} [params.duration]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<Object>}
 */
export async function generateVideoFromFrames({ firstFrameUrl, lastFrameUrl, prompt, model = 'seedance-2.5-first-last-frame', duration, signal } = {}) {
  if (!firstFrameUrl) throw new Error('firstFrameUrl is required');

  const payload = {
    model,
    first_frame_url: firstFrameUrl,
  };

  if (lastFrameUrl) payload.last_frame_url = lastFrameUrl;
  if (prompt) payload.prompt = prompt;
  if (typeof duration === 'number') payload.duration = duration;

  return submitAndWait({ endpoint: '/image-to-video', payload, signal });
}

/**
 * Generate video from a single reference image.
 *
 * @param {Object} params
 * @param {string} params.imageUrl
 * @param {string} [params.prompt]
 * @param {string} [params.model]
 * @param {number} [params.duration]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<Object>}
 */
export async function generateVideoFromImage({ imageUrl, prompt, model = 'seedance-2.5-image-to-video', duration, signal } = {}) {
  if (!imageUrl) throw new Error('imageUrl is required');

  const payload = {
    model,
    image_url: imageUrl,
  };

  if (prompt) payload.prompt = prompt;
  if (typeof duration === 'number') payload.duration = duration;

  return submitAndWait({ endpoint: '/image-to-video', payload, signal });
}

/**
 * Audio-to-video sync / alignment.
 *
 * MuAPI does not expose a dedicated audio-sync endpoint in the public
 * docs discovered so far, so this helper falls back to a local
 * waveform cross-correlation implementation in
 * `src/lib/editor/audioSync.js`.
 *
 * If MuAPI later adds a real endpoint, this function should be
 * updated to try the API first and fall back to local computation.
 *
 * @param {Object} params
 * @param {string} params.videoUrl
 * @param {string} params.audioUrl
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<Object>} { offsetSeconds, confidence }
 */
export async function syncAudioToVideo({ videoUrl, audioUrl, signal } = {}) {
  if (!videoUrl || !audioUrl) {
    throw new Error('videoUrl and audioUrl are required for audio sync');
  }

  try {
    const { computeAudioOffset } = await import('../../lib/editor/audioSync.js');
    const result = await computeAudioOffset(videoUrl, audioUrl);
    return {
      offsetSeconds: result.offsetSeconds ?? 0,
      confidence: result.confidence ?? 0,
      raw: result,
    };
  } catch (error) {
    throw new Error(`Audio sync failed: ${error.message}`);
  }
}
