import { getModelById, getVideoModelById, getI2IModelById, getI2VModelById, getV2VModelById, getLipSyncModelById } from './models.js';
import axios from 'axios';
import { getStableUserId } from '../shared/auth/stableUserId';
import { getApiKey } from './authConfig.ts';
import { cleanApiKey } from './keys.js';
import { UPLOAD_LIMITS, UPLOAD_MIME_TYPES, getUploadLimit, isAllowedUploadMimeType, normalizeImageMimeType } from './uploadConfig.ts';
import {
  handleMuAPIUploadError,
  uploadImageToMuAPI,
  uploadVideoToMuAPI,
} from './muapiUpload.ts';

// Marks an error as terminal so the polling loop rethrows instead of retrying.
function fatal(message) {
    const error = new Error(message);
    error.isFatal = true;
    return error;
}

/**
 * Normalize a MuAPI prediction response into a consistent shape.
 * MuAPI wraps payloads in `data` and sometimes nests `video`/`output`,
 * so we tolerate both the flat and the wrapped response shapes.
 */
function normalizeMuapiResult(raw) {
  const body = (raw && raw.data) ? raw.data : raw;
  const video = (raw && raw.video) ? raw.video : (body && body.video);
  const requestId = (raw && (raw.request_id || raw.id)) || (body && (body.request_id || body.id));
  const status = String((raw && raw.status) || (body && body.status) || '').toLowerCase();
  const outputs = (raw && raw.outputs) || (body && body.outputs) || (video ? [video.url] : null);
  const url =
    (Array.isArray(outputs) && outputs[0]) ||
    (raw && (raw.url || raw.video_url)) ||
    (body && (body.url || body.video_url)) ||
    (video && video.url) ||
    (raw && raw.output && raw.output.url) ||
    (body && body.output && body.output.url) || null;
  const error = (raw && raw.error) || (body && body.error) || null;
  return { requestId, status, outputs, url, error, body };
}


// Central MuAPI endpoint aliases. These map legacy/deprecated model IDs to the
// correct API endpoints for backward compatibility. Models NOT listed here use
// their endpoint from the local catalog (packages/studio/src/models.js).
//
// IMPORTANT: Do NOT add identity mappings (where key === value) here — they
// would override the correct endpoint from the local catalog. For example,
// flux-dev's endpoint is 'flux-dev-image' in the catalog; an identity mapping
// 'flux-dev': 'flux-dev' would break image generation with a 404.
//
// Values verified against the live `GET /api/v1/models` catalog.
const ENDPOINT_ALIASES = {
  // Legacy image model IDs -> current API endpoints
  'midjourney-v7-text-to-image': 'midjourney-v7',
  'midjourney-v7-image-to-image': 'midjourney-v7',
  'midjourney-v7-style-reference': 'midjourney-v7',
  'midjourney-v7-omni-reference': 'midjourney-v7',
  'midjourney-v7-image-to-video': 'midjourney-v7',
  // Legacy video model IDs -> current API endpoints
  'seedance-v2.0-t2v': 'seedance-2-t2v',
  'seedance-v2.0-extend': 'seedance-2-vip-extend',
  'seedance-v2.0-i2v': 'seedance-2-image-to-video',
  // Legacy model name differences
  'bytedance-seedream-edit-v4': 'bytedance-seedream-v4-edit',
  'minimax-image-01': 'minimax-image-01-subject-reference',
};


export class MuapiClient {
    constructor() {
        // Ideally user provides this in settings
        this.baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ? '' : 'https://api.muapi.ai';
    }

    getKey() {
        const key = getApiKey();
        if (!key) throw new Error('API Key missing. Please set it in Settings.');
        return key;
    }

    /**
     * Generates an image (Text-to-Image or Image-to-Image)
     * @param {Object} params
     * @param {string} params.model
     * @param {string} params.prompt
     * @param {string} params.negative_prompt
     * @param {string} params.aspect_ratio
     * @param {number} params.steps
     * @param {number} params.guidance_scale
     * @param {number} params.seed
     * @param {string} [params.image_url] - If present, treats as Image-to-Image
     */
    async generateImage(params) {
        const key = this.getKey();

        // Resolve endpoint from model definition
        const modelInfo = getModelById(params.model);
        const endpoint = ENDPOINT_ALIASES[params.model] || modelInfo?.endpoint || params.model;
        const url = `${this.baseUrl}/api/v1/${endpoint}`;

        // Build payload matching the API's expected format
        const finalPayload = {
            prompt: params.prompt,
        };

        // Aspect ratio (send as string, the API handles it)
        if (params.aspect_ratio) {
            finalPayload.aspect_ratio = params.aspect_ratio;
        }

        // Resolution
        if (params.resolution) {
            finalPayload.resolution = params.resolution;
        }

        // Quality (used by seedream and similar models)
        if (params.quality) {
            finalPayload.quality = params.quality;
        }

        // Image-to-Image
        if (params.image_url) {
            finalPayload.image_url = params.image_url;
            finalPayload.strength = params.strength || 0.6;
        } else {
            finalPayload.image_url = null;
        }

        // Optional params if supported by model
        if (params.seed && params.seed !== -1) {
            finalPayload.seed = params.seed;
        }

        console.log('[Muapi] Requesting:', url);
        console.log('[Muapi] Payload:', finalPayload);

        try {
            // Step 1: Submit the task
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': key
                },
                body: JSON.stringify(finalPayload)
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error('[Muapi] API Error Body:', errText);
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            console.log('[Muapi] Submit Response:', submitData);

            // Extract request_id for polling
            const requestId = submitData.request_id || submitData.id;
            if (!requestId) {
                // Some endpoints return the result directly
                return submitData;
            }

            // Notify caller of requestId so they can persist it before polling begins
            if (params.onRequestId) params.onRequestId(requestId);

            // Step 2: Poll for results
            console.log('[Muapi] Polling for results, request_id:', requestId);
            const result = await this.pollForResult(requestId, key);

            // Normalize: extract image URL from outputs array
            const imageUrl = normalizeMuapiResult(result).url;
            console.log('[Muapi] Image URL:', imageUrl);
            return { ...result, url: imageUrl };

        } catch (error) {
            console.error("Muapi Client Error:", error);
            throw error;
        }
    }

    /**
     * Polls the predictions endpoint until the result is ready.
     * @param {string} requestId - The request ID from the submit response
     * @param {string} key - The API key
     * @param {number} maxAttempts - Maximum polling attempts (default 60 = ~2 min)
     * @param {number} interval - Polling interval in ms (default 2000)
     */
    async pollForResult(requestId, key, maxAttempts = 60, interval = 2000) {
        const pollUrl = `${this.baseUrl}/api/v1/predictions/${requestId}/result`;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, interval));

            console.log(`[Muapi] Polling attempt ${attempt}/${maxAttempts}...`);

            try {
                const response = await fetch(pollUrl, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': key
                    }
                });

                if (!response.ok) {
                    const errText = await response.text();
                    console.warn(`[Muapi] Poll error (${response.status}):`, errText);
                    // 5xx is transient — keep polling. Anything else (401, 402,
                    // 404, 429) will not fix itself, so stop immediately.
                    if (response.status >= 500) continue;
                    throw fatal(`Poll Failed: ${response.status} - ${errText.slice(0, 100)}`);
                }

                const data = await response.json();
                console.log('[Muapi] Poll Response:', data);

                const norm = normalizeMuapiResult(data);
                const status = norm.status;

                if (status === 'completed' || status === 'succeeded' || status === 'success') {
                    return norm.body;
                }

                if (status === 'failed' || status === 'error') {
                    throw fatal(`Generation failed: ${norm.error || 'Unknown error'}`);
                }

                // Otherwise (processing, pending, etc.) keep polling
            } catch (error) {
                if (error.isFatal || attempt === maxAttempts) throw error;
                console.warn('[Muapi] Poll attempt failed, retrying...', error.message);
            }
        }

        throw new Error('Generation timed out after polling.');
    }

    async generateVideo(params) {
        const key = this.getKey();

        const modelInfo = getVideoModelById(params.model);
        const endpoint = ENDPOINT_ALIASES[params.model] || modelInfo?.endpoint || params.model;
        const url = `${this.baseUrl}/api/v1/${endpoint}`;

        const finalPayload = {};

        if (params.prompt) finalPayload.prompt = params.prompt;
        if (params.request_id) finalPayload.request_id = params.request_id;
        if (params.aspect_ratio) finalPayload.aspect_ratio = params.aspect_ratio;
        if (params.duration) finalPayload.duration = params.duration;
        if (params.resolution) finalPayload.resolution = params.resolution;
        if (params.quality) finalPayload.quality = params.quality;
        if (params.mode) finalPayload.mode = params.mode;
        if (params.image_url) finalPayload.image_url = params.image_url;

        console.log('[Muapi] Video Request:', url);
        console.log('[Muapi] Video Payload:', finalPayload);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': key
                },
                body: JSON.stringify(finalPayload)
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error('[Muapi] API Error Body:', errText);
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            console.log('[Muapi] Video Submit Response:', submitData);

            const requestId = submitData.request_id || submitData.id;
            if (!requestId) return submitData;

            if (params.onRequestId) params.onRequestId(requestId);

            console.log('[Muapi] Polling for video results, request_id:', requestId);
            const result = await this.pollForResult(requestId, key, 900, 2000);

            const videoUrl = normalizeMuapiResult(result).url;
            console.log('[Muapi] Video URL:', videoUrl);
            return { ...result, url: videoUrl };

        } catch (error) {
            console.error("Muapi Video Client Error:", error);
            throw error;
        }
    }

    /**
     * Generates an image using an Image-to-Image model.
     * The model's imageField determines which payload key receives the uploaded image URL.
     * @param {Object} params
     * @param {string} params.model - i2iModel id
     * @param {string} params.image_url - The uploaded reference image URL
     * @param {string} [params.prompt] - Optional text prompt
     * @param {string} [params.aspect_ratio]
     * @param {string} [params.resolution]
     */
    async generateI2I(params) {
        const key = this.getKey();
        const modelInfo = getI2IModelById(params.model);
        const endpoint = ENDPOINT_ALIASES[params.model] || modelInfo?.endpoint || params.model;
        const url = `${this.baseUrl}/api/v1/${endpoint}`;

        const finalPayload = {};

        // Only include prompt if the model supports it and one was provided
        finalPayload.prompt = params.prompt || '';

        // Place the uploaded image(s) in the correct field for this model
        const imageField = modelInfo?.imageField || 'image_url';
        const imagesList = params.images_list?.length > 0 ? params.images_list : (params.image_url ? [params.image_url] : null);
        if (imagesList) {
            if (imageField === 'images_list') {
                finalPayload.images_list = imagesList;
            } else {
                finalPayload[imageField] = imagesList[0];
            }
        }

        if (params.aspect_ratio) finalPayload.aspect_ratio = params.aspect_ratio;
        if (params.resolution) finalPayload.resolution = params.resolution;
        if (params.quality) finalPayload.quality = params.quality;
        // Effect name (e.g. for Kontext/effects models) and face-swap source image.
        if (params.name) finalPayload.name = params.name;
        if (params.swap_url) finalPayload.swap_url = params.swap_url;

        console.log('[Muapi] I2I Request:', url);
        console.log('[Muapi] I2I Payload:', finalPayload);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': key },
                body: JSON.stringify(finalPayload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            console.log('[Muapi] I2I Submit Response:', submitData);

            const requestId = submitData.request_id || submitData.id;
            if (!requestId) return submitData;

            if (params.onRequestId) params.onRequestId(requestId);

            const result = await this.pollForResult(requestId, key);
            const imageUrl = normalizeMuapiResult(result).url;
            console.log('[Muapi] I2I Result URL:', imageUrl);
            return { ...result, url: imageUrl };
        } catch (error) {
            console.error('Muapi I2I Error:', error);
            throw error;
        }
    }

    /**
     * Generates a video using an Image-to-Video model.
     * @param {Object} params
     * @param {string} params.model - i2vModel id
     * @param {string} params.image_url - The uploaded start frame image URL
     * @param {string} [params.prompt]
     * @param {string} [params.aspect_ratio]
     * @param {string} [params.resolution]
     * @param {number} [params.duration]
     * @param {string} [params.quality]
     */
    async generateI2V(params) {
        const key = this.getKey();
        const modelInfo = getI2VModelById(params.model);
        const endpoint = ENDPOINT_ALIASES[params.model] || modelInfo?.endpoint || params.model;
        const url = `${this.baseUrl}/api/v1/${endpoint}`;

        const finalPayload = {};

        if (params.prompt) finalPayload.prompt = params.prompt;

        // Place image in the correct field for this model
        const imageField = modelInfo?.imageField || 'image_url';
        if (params.images_list && params.images_list.length > 0) {
            if (imageField === 'images_list') {
                finalPayload.images_list = params.images_list;
            } else {
                finalPayload[imageField] = params.images_list[0];
            }
        } else if (params.image_url) {
            if (imageField === 'images_list') {
                finalPayload.images_list = [params.image_url];
            } else {
                finalPayload[imageField] = params.image_url;
            }
        }

        // Optional end-frame image — only for models declaring lastImageField.
        // Server-side param name varies (last_image vs end_image_url).
        const lastImageField = modelInfo?.lastImageField;
        if (lastImageField && params.last_image) {
            if (lastImageField === 'images_list') {
                if (!finalPayload.images_list) finalPayload.images_list = [];
                if (finalPayload.images_list.indexOf(params.last_image) === -1) {
                    finalPayload.images_list.push(params.last_image);
                }
            } else {
                finalPayload[lastImageField] = params.last_image;
            }
        }

        if (params.aspect_ratio) finalPayload.aspect_ratio = params.aspect_ratio;
        if (params.duration) finalPayload.duration = params.duration;
        if (params.resolution) finalPayload.resolution = params.resolution;
        if (params.quality) finalPayload.quality = params.quality;
        if (params.mode) finalPayload.mode = params.mode;
        if (params.name) finalPayload.name = params.name;

        console.log('[Muapi] I2V Request:', url);
        console.log('[Muapi] I2V Payload:', finalPayload);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': key },
                body: JSON.stringify(finalPayload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            console.log('[Muapi] I2V Submit Response:', submitData);

            const requestId = submitData.request_id || submitData.id;
            if (!requestId) return submitData;

            if (params.onRequestId) params.onRequestId(requestId);

            const result = await this.pollForResult(requestId, key, 900, 2000);
            const videoUrl = normalizeMuapiResult(result).url;
            console.log('[Muapi] I2V Result URL:', videoUrl);
            return { ...result, url: videoUrl };
        } catch (error) {
            console.error('Muapi I2V Error:', error);
            throw error;
        }
    }

    /**
     * Uploads a file to muapi and returns the hosted URL.
     *
     * Delegates to the shared adapter in ./muapiUpload, which owns the
     * size/MIME contract, the server-side key hop and the one-hour URL
     * lifetime. This wrapper deliberately keeps the original shape: one
     * attempt per call (no retry loop here), the same return value (the URL
     * string), and the same thrown-Error contract its callers already handle.
     *
     * @param {File} file - The image or video file to upload
     * @param {Object} [options]
     * @param {(percent: number) => void} [options.onProgress] - Optional
     *   progress hook. Upload progress is reported by the transport, so this
     *   is only invoked at the terminal 0/100 boundaries today; it exists to
     *   keep existing call sites that pass a callback compiling.
     * @returns {Promise<string>} The hosted URL of the uploaded file
     */
    async uploadFile(file, options = {}) {
        if (!file) throw new Error('No file provided');

        const key = this.getKey();
        const onProgress = typeof options === 'function' ? options : options?.onProgress;

        console.log('[Muapi] Uploading file:', file.name);

        const isVideo = String(file.type || '').startsWith('video/');
        const upload = isVideo ? uploadVideoToMuAPI : uploadImageToMuAPI;

        let result;
        try {
            result = await upload(file, {
                // The workspace is the caller's own authorized identity; the
                // adapter never derives or stores a key beyond the one handed
                // to it here.
                workspaceId: getStableUserId(),
                apiKey: key,
                // Only override the endpoint when this client was built
                // without a same-origin proxy (Electron file:// renderer).
                ...(this.baseUrl && this.baseUrl !== ''
                    ? { uploadEndpoint: `${this.baseUrl}/api/v1/upload_file` }
                    : {}),
            });
        } catch (error) {
            // Normalise onto the adapter's user-facing message so callers see
            // one consistent string set regardless of entry point.
            const info = handleMuAPIUploadError(error);
            const failure = new Error(info.message);
            failure.uploadErrorClass = info.class;
            failure.retryable = info.retryable;
            if (onProgress) onProgress(0);
            throw failure;
        }

        if (onProgress) onProgress(100);
        return result.url;
    }

    /**
     * Processes a video through a Video-to-Video model.
     * Single-input tools (e.g. watermark remover) only need `video_url`.
     * Motion-control models additionally need `image_url` and (often) `prompt`.
     * @param {Object} params
     * @param {string} params.model - v2vModel id
     * @param {string} params.video_url - The uploaded video URL
     * @param {string} [params.image_url] - Reference image URL (motion-control models)
     * @param {string} [params.prompt] - Motion description (motion-control models)
     */
    async processV2V(params) {
        const key = this.getKey();
        const modelInfo = getV2VModelById(params.model);
        const endpoint = ENDPOINT_ALIASES[params.model] || modelInfo?.endpoint || params.model;
        const url = `${this.baseUrl}/api/v1/${endpoint}`;

        const videoField = modelInfo?.videoField || 'video_url';
        const finalPayload = { [videoField]: params.video_url };

        if (modelInfo?.imageField && params.image_url) {
            finalPayload[modelInfo.imageField] = params.image_url;
        }
        if (modelInfo?.hasPrompt && params.prompt) {
            finalPayload.prompt = params.prompt;
        }

        console.log('[Muapi] V2V Request:', url);
        console.log('[Muapi] V2V Payload:', finalPayload);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': key },
                body: JSON.stringify(finalPayload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            console.log('[Muapi] V2V Submit Response:', submitData);

            const requestId = submitData.request_id || submitData.id;
            if (!requestId) return submitData;

            if (params.onRequestId) params.onRequestId(requestId);

            const result = await this.pollForResult(requestId, key, 900, 2000);
            const videoUrl = normalizeMuapiResult(result).url;
            console.log('[Muapi] V2V Result URL:', videoUrl);
            return { ...result, url: videoUrl };
        } catch (error) {
            console.error('Muapi V2V Error:', error);
            throw error;
        }
    }

    /**
     * Processes lipsync / speech-to-video generation.
     * Supports image+audio → video and video+audio → video models.
     * @param {Object} params
     * @param {string} params.model - lipsyncModel id
     * @param {string} [params.image_url] - Portrait image URL (image-based models)
     * @param {string} [params.video_url] - Source video URL (video-based models)
     * @param {string} params.audio_url - Audio file URL
     * @param {string} [params.prompt] - Optional prompt (for models that support it)
     * @param {string} [params.resolution] - Output resolution
     * @param {number} [params.seed] - Optional seed (-1 for random)
     * @param {Function} [params.onRequestId] - Called when request_id is received
     */
    async processLipSync(params) {
        const key = this.getKey();
        const modelInfo = getLipSyncModelById(params.model);
        const endpoint = ENDPOINT_ALIASES[params.model] || modelInfo?.endpoint || params.model;
        const url = `${this.baseUrl}/api/v1/${endpoint}`;

        const finalPayload = {};

        if (params.audio_url) finalPayload.audio_url = params.audio_url;
        if (params.image_url) finalPayload.image_url = params.image_url;
        if (params.video_url) finalPayload.video_url = params.video_url;
        if (modelInfo?.hasPrompt) finalPayload.prompt = params.prompt || '';
        if (params.resolution) finalPayload.resolution = params.resolution;
        if (params.seed !== undefined && params.seed !== -1) finalPayload.seed = params.seed;

        console.log('[Muapi] LipSync Request:', url);
        console.log('[Muapi] LipSync Payload:', finalPayload);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': key },
                body: JSON.stringify(finalPayload)
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error('[Muapi] LipSync API Error:', errText);
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            console.log('[Muapi] LipSync Submit Response:', submitData);

            const requestId = submitData.request_id || submitData.id;
            if (!requestId) return submitData;

            if (params.onRequestId) params.onRequestId(requestId);

            const result = await this.pollForResult(requestId, key, 900, 2000);
            const videoUrl = normalizeMuapiResult(result).url;
            console.log('[Muapi] LipSync Result URL:', videoUrl);
            return { ...result, url: videoUrl };
        } catch (error) {
            console.error('Muapi LipSync Error:', error);
            throw error;
        }
    }

    getDimensionsFromAR(ar) {
        // Base unit 1024 (Flux standard)
        switch (ar) {
            case '1:1': return [1024, 1024];
            case '16:9': return [1280, 720]; // 1024*1024 area approx
            case '9:16': return [720, 1280];
            case '4:3': return [1152, 864];
            case '3:2': return [1216, 832];
            case '21:9': return [1536, 640];
            default: return [1024, 1024];
    }
  }

  /**
   * GET a JSON resource from the MuAPI backend.
   * @param {string} path - API path, e.g. '/predictions/abc/result'
   */
  async get(path) {
    const key = this.getKey();
    const url = `${this.baseUrl}/api/v1${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
      },
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`MuAPI GET ${path} failed with status ${response.status}: ${errText.slice(0, 200)}`);
    }
    return response.json();
  }

  /**
   * POST a JSON body to the MuAPI backend.
   * @param {string} path - API path, e.g. '/seedance-lite-i2v'
   * @param {Object} body - JSON-serializable request body
   */
  async post(path, body) {
    const key = this.getKey();
    const url = `${this.baseUrl}/api/v1${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`MuAPI POST ${path} failed with status ${response.status}: ${errText.slice(0, 200)}`);
    }
    return response.json();
  }
}

export const muapi = new MuapiClient();

function withKey(config, apiKey) {
  return {
    ...config,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cleanApiKey(apiKey),
      ...(config.headers || {}),
    },
  };
}

export async function listSocialAccounts(apiKey) {
  const res = await axios.get('/api/social/accounts', withKey({ method: 'GET' }, apiKey));
  return res.data;
}

const SOCIAL_CONNECT_PATHS = {
  youtube: '/api/v1/social/youtube/connect-url',
  tiktok: '/api/v1/social/tiktok/connect-url',
  instagram: '/api/v1/social/instagram/connect-url',
  facebook: '/api/v1/social/facebook/connect-url',
};

export async function connectSocialAccount(apiKey, externalUserId, redirectTo, platform = 'youtube') {
  const path = SOCIAL_CONNECT_PATHS[platform] || SOCIAL_CONNECT_PATHS.youtube;
  const userId = externalUserId || getStableUserId();
  const res = await axios.post(
    path,
    { external_user_id: userId, redirect_to: redirectTo },
    withKey({ method: 'POST' }, apiKey)
  );
  return res.data;
}

export async function listExternalSocialAccounts(apiKey, externalUserId) {
  const res = await axios.get(
    `/api/v1/social/ext/accounts?external_user_id=${encodeURIComponent(externalUserId || getStableUserId())}`,
    withKey({ method: 'GET' }, apiKey)
  );
  return res.data;
}

export async function disconnectExternalSocialAccount(apiKey, id) {
  const res = await axios.delete(
    `/api/v1/social/ext/accounts/${id}`,
    withKey({ method: 'DELETE' }, apiKey)
  );
  return res.data;
}

export async function publishToYouTube(apiKey, payload) {
  const res = await axios.post('/api/v1/youtube-publish', payload, withKey({ method: 'POST' }, apiKey));
  return res.data;
}

export async function publishToInstagram(apiKey, payload) {
  const res = await axios.post('/api/v1/instagram-publish', payload, withKey({ method: 'POST' }, apiKey));
  return res.data;
}

export async function publishToTikTok(apiKey, payload) {
  const res = await axios.post('/api/v1/tiktok-publish', payload, withKey({ method: 'POST' }, apiKey));
  return res.data;
}

export async function publishToFacebook(apiKey, payload) {
  const res = await axios.post('/api/v1/facebook-publish', payload, withKey({ method: 'POST' }, apiKey));
  return res.data;
}

export async function publishToLinkedIn(apiKey, payload) {
  const res = await axios.post('/api/v1/linkedin-publish', payload, withKey({ method: 'POST' }, apiKey));
  return res.data;
}

export async function publishToPinterest(apiKey, payload) {
  const res = await axios.post('/api/v1/pinterest-publish', payload, withKey({ method: 'POST' }, apiKey));
  return res.data;
}

export async function publishToThreads(apiKey, payload) {
  const res = await axios.post('/api/v1/threads-publish', payload, withKey({ method: 'POST' }, apiKey));
  return res.data;
}

export async function publishToX(apiKey, payload) {
  const res = await axios.post('/api/v1/x-publish', payload, withKey({ method: 'POST' }, apiKey));
  return res.data;
}

/**
 * Enhance/transform an image through a MuAPI image-tool endpoint and poll for
 * the result. Reuses the same proxy + key pattern as the social-publish flow.
 *
 * @param {string} apiKey   MuAPI key (BYOK)
 * @param {string} endpoint Endpoint slug appended to `/api/v1/` (e.g. `ai-image-upscale`)
 * @param {object} payload  Request body — typically `{ image_url, ...params }`
 * @returns {Promise<any>} Final result object from polling
 */
export async function pollSocialResult(apiKey, requestId, maxAttempts = 120, interval = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, interval));
    try {
      const res = await axios.get(
        `/api/v1/predictions/${requestId}/result`,
        withKey({ method: 'GET' }, apiKey)
      );
      const data = res.data || {};
      const status = String(data.status || '').toLowerCase();
      if (status === 'completed' || status === 'succeeded' || status === 'success') {
        return data;
      }
      if (status === 'failed' || status === 'error') {
        throw new Error(data.error || 'Publish failed');
      }
    } catch (err) {
      if (attempt === maxAttempts) throw err;
    }
  }
  throw new Error('Publish timed out after polling.');
}
