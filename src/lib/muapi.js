import { getModelById, getVideoModelById, getI2IModelById, getI2VModelById, getV2VModelById, getLipSyncModelById, getAudioModelById, getVideoToolById, getAvatarModelById, getTextModelById, getTrainingModelById, i2vModels } from './models.js';
import { apiKeyManager, isDevBypass } from './apiKeyManager.js';
import { uploadFileToStorage } from './supabase.js';
import { validateFile } from './editor/validateFile.js';
import { analytics } from './analytics.js';
import { rateLimiter } from './services/RateLimiter.js';
import {
  validateEffectParams,
  validateEffectName,
  validateResolution,
  validateQuality,
  EFFECT_PARAM_SCHEMA,
} from './effectParamValidator.js';

async function acquireRateLimitToken() {
    try {
        await rateLimiter.acquire(1, 10000);
    } catch (e) {
        const err = new Error('Rate limit exceeded. Please wait a moment and try again.');
        err.status = 429;
        err.code = 'rate_limited';
        throw err;
    }
}

// Authoritative allowlist for generate_wan_ai_effects `name` values.
// Built from the live API schema enums in i2vModels (ai-video-effects: 64, motion-controls: 47, vfx: 9).
// Kept in sync with models.js — no hand-curated drift.
const WAN_EFFECT_MODEL_IDS = ['ai-video-effects', 'motion-controls', 'vfx'];
const ALLOWED_WAN_EFFECT_NAMES = new Set(
  i2vModels
    .filter(m => WAN_EFFECT_MODEL_IDS.includes(m.id))
    .flatMap(m => m.inputs.name.enum)
);

function normalizeEffectName(name) {
  if (typeof name !== 'string') return name;
  return name.trim().replace(/\s+/g, ' ');
}

export class MuapiClient {
    constructor() {
        // Validate that Supabase URL is configured before building proxy URL
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (!supabaseUrl) {
            console.error('[MuapiClient] VITE_SUPABASE_URL is not configured');
            this.proxyUrl = '/functions/v1/muapi-proxy'; // Fallback to relative path
        } else {
            this.proxyUrl = `${supabaseUrl}/functions/v1/muapi-proxy`;
        }
        this.activeControllers = new Map(); // For request cancellation
        this.apiKeyManager = apiKeyManager;
    }

    getKey() {
        return this.apiKeyManager.getKey();
    }

    _requireMuapiKey() {
        if (!this.apiKeyManager.hasMuapiKey()) {
            throw new Error('Muapi API key not configured. Add your key in Settings.');
        }
    }

    _getMuapiHeaders() {
        const key = this.apiKeyManager.getMuapiKey();
        if (key && !isDevBypass) {
            return { 'Content-Type': 'application/json', 'x-api-key': key };
        }
        return { 'Content-Type': 'application/json' };
    }

    // Cancel a specific request
    cancelRequest(requestId) {
        const controller = this.activeControllers.get(requestId);
        if (controller) {
            controller.abort();
            this.activeControllers.delete(requestId);
            console.log(`[MuapiClient] Cancelled request: ${requestId}`);
        }
    }

    // Cancel all active requests
    cancelAllRequests() {
        for (const [requestId, controller] of this.activeControllers) {
            controller.abort();
        }
        this.activeControllers.clear();
        console.log('[MuapiClient] Cancelled all requests');
    }

    // Validate API response structure
    validateResponse(data, expectedType) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid response: expected object');
        }
        if (data.error) {
            throw new Error(`API Error: ${data.error}`);
        }
        return true;
    }

    async generateImage(params, signal) {
        this._requireMuapiKey();
        await acquireRateLimitToken();
        const modelInfo = getModelById(params.model);
        const endpoint = modelInfo?.endpoint || params.model;
        analytics.trackGeneration(params.model, 'image', { endpoint, studioType: params.studioType });

        const finalPayload = {};

        if (params.prompt) finalPayload.prompt = params.prompt;

        if (params.aspect_ratio) finalPayload.aspect_ratio = params.aspect_ratio;
        if (params.resolution) finalPayload.resolution = params.resolution;
        if (params.quality) finalPayload.quality = params.quality;

        if (params.image_url) {
            finalPayload.image_url = params.image_url;
            finalPayload.strength = params.strength || 0.6;
        }

        if (params.seed && params.seed !== -1) finalPayload.seed = params.seed;
        if (params.negative_prompt) finalPayload.negative_prompt = params.negative_prompt;
        if (params.guidance_scale !== undefined && params.guidance_scale !== 7.5) finalPayload.guidance_scale = params.guidance_scale;
        if (params.steps !== undefined && params.steps !== 20) finalPayload.steps = params.steps;
        if (params.denoise_strength !== undefined && params.denoise_strength !== 0.7) finalPayload.denoise_strength = params.denoise_strength;
        if (params.effect_strength !== undefined && params.effect_strength !== 1.0) finalPayload.strength = params.effect_strength;
        if (params.cfg_scale !== undefined && params.cfg_scale !== 0.5) finalPayload.cfg_scale = params.cfg_scale;
        if (params.prompt_extend) finalPayload.prompt_extend = true;

        if (params.thumbnail_url) finalPayload.thumbnail_url = params.thumbnail_url;

        try {
            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: this._getMuapiHeaders(),
                body: JSON.stringify({
                    endpoint,
                    params: finalPayload,
                    generationType: 'image',
                    studioType: params.studioType || 'image'
                }),
                signal
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            this.validateResponse(submitData, 'submit');

            const requestId = submitData.request_id || submitData.id;
            if (!requestId) {
                return submitData;
            }

            const result = await this.pollForResult(requestId, 60, 2000, signal);

            // Validate output URL exists
            const imageUrl = result.outputs?.[0] || result.url || result.output?.url;
            if (!imageUrl) {
                console.warn('[MuapiClient] No image URL in response, returning full result');
            }
            analytics.trackGenerationComplete(params.model, 'image', true);
            return { ...result, url: imageUrl };

        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request cancelled by user');
            }
            analytics.trackGenerationError(params.model, 'image', error);
            throw error;
        }
    }

    async pollForResult(requestId, maxAttempts = 60, baseInterval = 2000, signal) {
        // Use exponential backoff with jitter for polling
        const getInterval = (attempt) => {
            const exponentialDelay = Math.min(baseInterval * Math.pow(1.5, attempt - 1), 30000); // Cap at 30s
            const jitter = exponentialDelay * 0.2 * Math.random(); // 20% jitter
            return exponentialDelay + jitter;
        };

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // Check if request was cancelled before sleeping
            if (signal?.aborted) {
                throw new Error('Request cancelled');
            }

            await new Promise(resolve => setTimeout(resolve, getInterval(attempt)));

            // Check cancellation before making request
            if (signal?.aborted) {
                throw new Error('Request cancelled');
            }

            try {
                const response = await fetch(this.proxyUrl, {
                    method: 'POST',
                    headers: this._getMuapiHeaders(),
                    body: JSON.stringify({
                        endpoint: `predictions/${requestId}/result`,
                        params: {},
                        generationType: 'poll'
                    }),
                    signal
                });

                if (!response.ok) {
                    if (response.status >= 500) continue;
                    if (response.status === 404) {
                        throw new Error('Request not found - may have expired');
                    }
                    const errText = await response.text();
                    throw new Error(`Poll Failed: ${response.status} - ${errText.slice(0, 100)}`);
                }

                const data = await response.json();
                this.validateResponse(data, 'poll');

                const status = data.status?.toLowerCase();

                if (status === 'completed' || status === 'succeeded' || status === 'success') {
                    return data;
                }

                if (status === 'failed' || status === 'error') {
                    throw new Error(`Generation failed: ${data.error || 'Unknown error'}`);
                }

                // Log progress for long-running tasks
                if (attempt % 10 === 0) {
                    console.log(`[MuapiClient] Still processing... attempt ${attempt}/${maxAttempts}`);
                }

            } catch (error) {
                if (error.name === 'AbortError') {
                    throw new Error('Request cancelled');
                }
                if (attempt === maxAttempts) throw error;
            }
        }

        throw new Error('Generation timed out after polling.');
    }

    async generateVideo(params, signal) {
        this._requireMuapiKey();
        await acquireRateLimitToken();
        const modelInfo = getVideoModelById(params.model);
        const endpoint = modelInfo?.endpoint || params.model;
        analytics.trackGeneration(params.model, 'video', { endpoint, studioType: params.studioType });

        const finalPayload = {};

        if (params.prompt) finalPayload.prompt = params.prompt;
        if (params.request_id) finalPayload.request_id = params.request_id;
        if (params.image_url) finalPayload.image_url = params.image_url;
        if (params.aspect_ratio) finalPayload.aspect_ratio = params.aspect_ratio;
        if (params.duration) finalPayload.duration = params.duration;
        if (params.resolution) finalPayload.resolution = params.resolution;
        if (params.quality) finalPayload.quality = params.quality;
        // Effect endpoints (generate_wan_ai_effects) REQUIRE `name`.
        if (params.name) finalPayload.name = params.name;

        if (params.negative_prompt) finalPayload.negative_prompt = params.negative_prompt;
        if (params.seed && params.seed !== -1) finalPayload.seed = params.seed;
        if (params.guidance_scale !== undefined && params.guidance_scale !== 7.5) finalPayload.guidance_scale = params.guidance_scale;
        if (params.steps !== undefined && params.steps !== 20) finalPayload.steps = params.steps;
        if (params.denoise_strength !== undefined && params.denoise_strength !== 0.7) finalPayload.denoise_strength = params.denoise_strength;
        if (params.effect_strength !== undefined && params.effect_strength !== 1.0) finalPayload.strength = params.effect_strength;
        if (params.cfg_scale !== undefined && params.cfg_scale !== 0.5) finalPayload.cfg_scale = params.cfg_scale;
        if (params.prompt_extend) finalPayload.prompt_extend = true;

        if (params.thumbnail_url) finalPayload.thumbnail_url = params.thumbnail_url;

        try {
            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: this._getMuapiHeaders(),
                body: JSON.stringify({
                    endpoint,
                    params: finalPayload,
                    generationType: 'video',
                    studioType: params.studioType || 'video'
                }),
                signal
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            this.validateResponse(submitData, 'submit');

            const requestId = submitData.request_id || submitData.id;
            if (!requestId) return submitData;

            const result = await this.pollForResult(requestId, 120, 2000, signal);

            const videoUrl = result.outputs?.[0] || result.url || result.output?.url;
            analytics.trackGenerationComplete(params.model, 'video', true);
            return { ...result, url: videoUrl };

        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request cancelled by user');
            }
            analytics.trackGenerationError(params.model, 'video', error);
            throw error;
        }
    }

    async generateI2I(params, signal) {
        this._requireMuapiKey();
        await acquireRateLimitToken();
        const modelInfo = getI2IModelById(params.model);
        const endpoint = modelInfo?.endpoint || params.model;
        analytics.trackGeneration(params.model, 'i2i', { endpoint, studioType: params.studioType });

        // ─── Validate & sanitize ─────────────────────────────────────────
        const validation = validateEffectParams(params, EFFECT_PARAM_SCHEMA);
        if (!validation.valid) {
            const firstError = validation.errors[0];
            throw new EffectParamError(firstError.message, firstError.field, firstError.code);
        }
        const p = validation.sanitized;

        const finalPayload = {};

        if (p.prompt) finalPayload.prompt = p.prompt;

        const imageField = modelInfo?.imageField || 'image_url';
        const imagesList = p.images_list?.length > 0 ? p.images_list : (p.image_url ? [p.image_url] : null);
        if (imagesList) {
            if (imageField === 'images_list') {
                finalPayload.images_list = imagesList;
            } else {
                finalPayload[imageField] = imagesList[0];
            }
        }

        if (p.aspect_ratio) finalPayload.aspect_ratio = p.aspect_ratio;
        if (p.resolution) finalPayload.resolution = p.resolution;
        if (p.quality) finalPayload.quality = p.quality;
        // Effect endpoints (generate_wan_ai_effects / video-effects) REQUIRE `name`.
        if (p.name) finalPayload.name = p.name;

        if (p.negative_prompt) finalPayload.negative_prompt = p.negative_prompt;

        // Advanced controls (forward when non-default)
        if (p.seed !== null && p.seed !== undefined && p.seed !== -1) finalPayload.seed = p.seed;
        if (p.guidance_scale !== undefined && p.guidance_scale !== 7.5) finalPayload.guidance_scale = p.guidance_scale;
        if (p.steps !== undefined && p.steps !== 20) finalPayload.steps = p.steps;
        if (p.denoise_strength !== undefined && p.denoise_strength !== 0.7) finalPayload.denoise_strength = p.denoise_strength;
        if (p.effect_strength !== undefined && p.effect_strength !== 1.0) finalPayload.strength = p.effect_strength;
        if (p.cfg_scale !== undefined && p.cfg_scale !== 0.5) finalPayload.cfg_scale = p.cfg_scale;
        if (p.prompt_extend) finalPayload.prompt_extend = true;

        if (p.thumbnail_url) finalPayload.thumbnail_url = p.thumbnail_url;

        try {
            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: this._getMuapiHeaders(),
                body: JSON.stringify({
                    endpoint,
                    params: finalPayload,
                    generationType: 'i2v',
                    studioType: params.studioType || 'video'
                }),
                signal
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            this.validateResponse(submitData, 'submit');

            const requestId = submitData.request_id || submitData.id;
            if (!requestId) return submitData;

            const result = await this.pollForResult(requestId, 60, 2000, signal);
            const imageUrl = result.outputs?.[0] || result.url || result.output?.url;
            analytics.trackGenerationComplete(params.model, 'i2i', true);
            return { ...result, url: imageUrl };
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request cancelled by user');
            }
            analytics.trackGenerationError(params.model, 'i2i', error);
            throw error;
        }
    }

    async generateI2V(params, signal) {
        this._requireMuapiKey();
        await acquireRateLimitToken();
        const modelInfo = getI2VModelById(params.model);
        const endpoint = modelInfo?.endpoint || params.model;
        analytics.trackGeneration(params.model, 'i2v', { endpoint, studioType: params.studioType });

        // ─── Validate & sanitize ─────────────────────────────────────────
        const validation = validateEffectParams(params, EFFECT_PARAM_SCHEMA);
        if (!validation.valid) {
            const firstError = validation.errors[0];
            throw new EffectParamError(firstError.message, firstError.field, firstError.code);
        }
        const p = validation.sanitized;

        const finalPayload = {};

        if (p.prompt) finalPayload.prompt = p.prompt;

        const imageField = modelInfo?.imageField || 'image_url';
        if (p.image_url) {
            if (imageField === 'images_list') {
                finalPayload.images_list = [p.image_url];
            } else {
                finalPayload[imageField] = p.image_url;
            }
        }

        if (p.aspect_ratio) finalPayload.aspect_ratio = p.aspect_ratio;
        if (p.duration) finalPayload.duration = p.duration;
        if (p.resolution) finalPayload.resolution = p.resolution;
        if (p.quality) finalPayload.quality = p.quality;
        // First/last-frame control (start + end image). Forwarded from the raw
        // params (not the sanitized object, which strips unknown keys) so
        // first-last-frame models (e.g. seedance-2.5-first-last-frame) can pin
        // both ends of the generated clip. Forward both camelCase and snake_case
        // conventions since different model endpoints expect different keys.
        if (params.firstFrameUrl || params.first_frame_url) finalPayload.firstFrameUrl = params.firstFrameUrl || params.first_frame_url;
        if (params.lastFrameUrl || params.last_frame_url) finalPayload.lastFrameUrl = params.lastFrameUrl || params.last_frame_url;
        if (params.startImageUrl) finalPayload.startImageUrl = params.startImageUrl;
        if (params.endImageUrl) finalPayload.endImageUrl = params.endImageUrl;
        // Effect endpoints (generate_wan_ai_effects) REQUIRE `name`.
        // Forward it from the template's effect selection input or defaultParams.
        if (p.name) finalPayload.name = p.name;

        if (p.negative_prompt) finalPayload.negative_prompt = p.negative_prompt;

        // Advanced controls (forward when non-default)
        if (p.seed !== null && p.seed !== undefined && p.seed !== -1) finalPayload.seed = p.seed;
        if (p.guidance_scale !== undefined && p.guidance_scale !== 7.5) finalPayload.guidance_scale = p.guidance_scale;
        if (p.steps !== undefined && p.steps !== 20) finalPayload.steps = p.steps;
        if (p.denoise_strength !== undefined && p.denoise_strength !== 0.7) finalPayload.denoise_strength = p.denoise_strength;
        if (p.effect_strength !== undefined && p.effect_strength !== 1.0) finalPayload.strength = p.effect_strength;
        if (p.cfg_scale !== undefined && p.cfg_scale !== 0.5) finalPayload.cfg_scale = p.cfg_scale;
        if (p.prompt_extend) finalPayload.prompt_extend = true;

        if (p.thumbnail_url) finalPayload.thumbnail_url = p.thumbnail_url;

        try {
            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: this._getMuapiHeaders(),
                body: JSON.stringify({
                    endpoint,
                    params: finalPayload,
                    generationType: 'i2v',
                    studioType: params.studioType || 'video'
                }),
                signal
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            this.validateResponse(submitData, 'submit');

            const requestId = submitData.request_id || submitData.id;
            if (!requestId) return submitData;

            const result = await this.pollForResult(requestId, 120, 2000, signal);
            const videoUrl = result.outputs?.[0] || result.url || result.output?.url;
            analytics.trackGenerationComplete(params.model, 'i2v', true);
            return { ...result, url: videoUrl };
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request cancelled by user');
            }
            analytics.trackGenerationError(params.model, 'i2v', error);
            throw error;
        }
    }

    async uploadFile(file, { signal } = {}) {
        this._requireMuapiKey();
        await acquireRateLimitToken();

        const key = this.getKey();
        const muapiKey = this.apiKeyManager.getMuapiKey();
        if (key !== muapiKey) {
            console.warn('[MuapiClient] getKey() and getMuapiKey() returned different values:', { getKey: key, getMuapiKey: muapiKey });
        }

        let validation;
        try {
            validation = await validateFile(file);
        } catch (e) {
            throw new Error(`Validation failed: ${e.message}`);
        }

        const isImage = validation.type === 'image';
        const isVideo = validation.type === 'video';
        const maxSize = isImage ? 10 * 1024 * 1024 : isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
            const typeLabel = isImage ? 'Images' : isVideo ? 'Videos' : 'Files';
            throw new Error(`${typeLabel} must be under ${maxSize / 1024 / 1024}MB for muapi.ai upload`);
        }

        const formData = new FormData();
        formData.append('file', file);

        const maxRetries = 2;
        const retryableStatuses = new Set([502, 503, 429]);
        let lastErr;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const controller = new AbortController();
            let abortedByTimeout = false;

            if (signal?.aborted) {
                throw new Error('Request cancelled by user');
            }

            const timeoutId = setTimeout(() => {
                abortedByTimeout = true;
                controller.abort();
            }, 60000);

            const onCallerAbort = () => {
                clearTimeout(timeoutId);
                controller.abort();
            };
            signal?.addEventListener('abort', onCallerAbort, { once: true });

            try {
                const response = await fetch(this.proxyUrl, {
                    method: 'POST',
                    headers: {
                        'x-api-key': key,
                        'x-endpoint': 'upload_file',
                    },
                    body: formData,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                signal?.removeEventListener('abort', onCallerAbort);

                if (!response.ok) {
                    let errText;
                    try {
                        const errData = await response.json();
                        errText = JSON.stringify(errData);
                    } catch {
                        errText = await response.text();
                    }

                    const status = response.status;
                    const err = new Error(`Upload failed: ${errText.slice(0, 200)}`);
                    err.status = status;

                    if (status === 402 || status === 403 || status === 413 || status === 422) {
                        err.retryable = false;
                        throw err;
                    }

                    if (retryableStatuses.has(status) && attempt < maxRetries) {
                        const backoff = Math.pow(2, attempt) * 1000;
                        console.warn(`[MuapiClient] Upload failed with ${status}, retrying in ${backoff}ms...`);
                        await new Promise(resolve => setTimeout(resolve, backoff));
                        lastErr = err;
                        continue;
                    }

                    err.retryable = true;
                    throw err;
                }

                let result;
                try {
                    result = await response.json();
                } catch (e) {
                    const err = new Error('Upload Failed: Non-JSON response from server');
                    err.status = response.status;
                    err.retryable = true;
                    throw err;
                }

                if (result.error) {
                    const err = new Error(`Upload Failed: ${result.error}`);
                    err.retryable = true;
                    throw err;
                }

                const publicUrl = result.url || result.data?.url;
                if (!publicUrl) {
                    const err = new Error('Upload Failed: No URL returned by the server');
                    err.retryable = false;
                    throw err;
                }
                return publicUrl;

            } catch (err) {
                clearTimeout(timeoutId);
                signal?.removeEventListener('abort', onCallerAbort);

                if (err.name === 'AbortError') {
                    if (abortedByTimeout && attempt < maxRetries) {
                        const backoff = Math.pow(2, attempt) * 1000;
                        console.warn(`[MuapiClient] Upload attempt ${attempt + 1} timed out, retrying in ${backoff}ms...`);
                        await new Promise(resolve => setTimeout(resolve, backoff));
                        continue;
                    }
                    throw new Error('Request cancelled by user');
                }

                lastErr = err;
                const status = err.status || (err.response?.status);

                if (retryableStatuses.has(status) && attempt < maxRetries) {
                    const backoff = Math.pow(2, attempt) * 1000;
                    console.warn(`[MuapiClient] Upload attempt ${attempt + 1} failed with ${status}, retrying in ${backoff}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoff));
                    continue;
                }

                if (!status && attempt < maxRetries) {
                    const backoff = Math.pow(2, attempt) * 1000;
                    console.warn(`[MuapiClient] Upload attempt ${attempt + 1} failed with network error, retrying in ${backoff}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoff));
                    continue;
                }

                break;
            }
        }

        if (!lastErr) {
            throw new Error('Upload failed: unknown error');
        }

        if (lastErr.retryable === false) {
            throw lastErr;
        }
        const status = lastErr.status || (lastErr.response?.status);
        if (status === 402 || status === 403 || status === 413 || status === 422) {
            throw lastErr;
        }

        console.warn('[MuapiClient] Proxy upload failed, falling back to Supabase Storage:', lastErr);
        try {
            return await uploadFileToStorage(file);
        } catch (fallbackErr) {
            console.error('[MuapiClient] Fallback upload also failed:', fallbackErr);
            throw new Error(`Upload failed: ${lastErr.message || fallbackErr.message}`);
        }
    }

    async processV2V(params, signal) {
        this._requireMuapiKey();
        await acquireRateLimitToken();
        const modelInfo = getV2VModelById(params.model);
        const endpoint = modelInfo?.endpoint || params.model;
        analytics.trackGeneration(params.model, 'v2v', { endpoint, studioType: params.studioType });

        const videoField = modelInfo?.videoField || 'video_url';
        const finalPayload = { [videoField]: params.video_url };

        if (params.thumbnail_url) {
            finalPayload.thumbnail_url = params.thumbnail_url;
        }

        try {
            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: this._getMuapiHeaders(),
                body: JSON.stringify({
                    endpoint,
                    params: finalPayload,
                    generationType: 'v2v',
                    studioType: params.studioType || 'upscale'
                }),
                signal
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            this.validateResponse(submitData, 'submit');

            const requestId = submitData.request_id || submitData.id;
            if (!requestId) return submitData;

            const result = await this.pollForResult(requestId, 120, 2000, signal);
            const videoUrl = result.outputs?.[0] || result.url || result.output?.url;
            analytics.trackGenerationComplete(params.model, 'v2v', true);
            return { ...result, url: videoUrl };
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request cancelled by user');
            }
            analytics.trackGenerationError(params.model, 'v2v', error);
            throw error;
        }
    }

    async generateAvatar(params, signal) {
        this._requireMuapiKey();
        await acquireRateLimitToken();
        const modelInfo = getAvatarModelById(params.model);
        const endpoint = modelInfo?.endpoint || params.model || 'avatar';
        analytics.trackGeneration(params.model, 'avatar', { endpoint, studioType: params.studioType });

        const finalPayload = {};

        if (params.model) finalPayload.model = params.model;
        if (params.video_url) finalPayload.video_url = params.video_url;
        if (params.audio_url) finalPayload.audio_url = params.audio_url;
        if (params.prompt) finalPayload.prompt = params.prompt;

        try {
            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: this._getMuapiHeaders(),
                body: JSON.stringify({
                    endpoint,
                    params: finalPayload,
                    generationType: 'avatar',
                    studioType: 'avatar'
                }),
                signal
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            this.validateResponse(submitData, 'submit');

            const requestId = submitData.request_id || submitData.id;
            if (!requestId) return submitData;

            const result = await this.pollForResult(requestId, 120, 2000, signal);
            const videoUrl = result.outputs?.[0] || result.url || result.output?.url;
            analytics.trackGenerationComplete(params.model, 'avatar', true);
            return { ...result, url: videoUrl };
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request cancelled by user');
            }
            analytics.trackGenerationError(params.model, 'avatar', error);
            throw error;
        }
    }

    async generateAudio(params, signal) {
        this._requireMuapiKey();
        await acquireRateLimitToken();
        const modelInfo = getAudioModelById(params.model);
        const endpoint = modelInfo?.endpoint || params.model || 'audio';
        analytics.trackGeneration(params.model, 'audio', { endpoint });

        const finalPayload = {};

        if (params.model) finalPayload.model = params.model;
        if (params.prompt) finalPayload.prompt = params.prompt;
        if (params.duration) finalPayload.duration = params.duration;
        if (params.style) finalPayload.style = params.style;
        if (params.audio_url) finalPayload.audio_url = params.audio_url;

        try {
            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: this._getMuapiHeaders(),
                body: JSON.stringify({
                    endpoint,
                    params: finalPayload,
                    generationType: 'audio',
                    studioType: 'audio'
                }),
                signal
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            this.validateResponse(submitData, 'submit');

            const requestId = submitData.request_id || submitData.id;
            if (!requestId) return submitData;

            const result = await this.pollForResult(requestId, 120, 2000, signal);
            const audioUrl = result.outputs?.[0] || result.url || result.output?.url;
            analytics.trackGenerationComplete(params.model, 'audio', true);
            return { ...result, url: audioUrl };
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('Request cancelled by user');
            analytics.trackGenerationError(params.model, 'audio', error);
            throw error;
        }
    }

    async generateMusic(params, signal) {
        this._requireMuapiKey();
        await acquireRateLimitToken();
        const modelInfo = getAudioModelById(params.model);
        const endpoint = modelInfo?.endpoint || params.model || 'suno-create-music';
        analytics.trackGeneration(params.model, 'music', { endpoint });

        const finalPayload = {};

        if (params.prompt) finalPayload.prompt = params.prompt;
        if (params.duration) finalPayload.duration = params.duration;
        if (params.style) finalPayload.style = params.style;
        if (params.audio_url) finalPayload.audio_url = params.audio_url;
        if (params.instrumental !== undefined) finalPayload.instrumental = params.instrumental;

        try {
            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: this._getMuapiHeaders(),
                body: JSON.stringify({
                    endpoint,
                    params: finalPayload,
                    generationType: 'music',
                    studioType: 'audio'
                }),
                signal
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            this.validateResponse(submitData, 'submit');

            const requestId = submitData.request_id || submitData.id;
            if (!requestId) return submitData;

            const result = await this.pollForResult(requestId, 180, 3000, signal);
            const audioUrl = result.outputs?.[0] || result.url || result.output?.url || result.audio?.url;
            analytics.trackGenerationComplete(params.model, 'music', true);
            return { ...result, url: audioUrl };
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('Request cancelled by user');
            analytics.trackGenerationError(params.model, 'music', error);
            throw error;
        }
    }

    async generateVideoEffect(params, signal) {
        this._requireMuapiKey();
        await acquireRateLimitToken();
        const endpoint = 'generate_wan_ai_effects';
        analytics.trackGeneration(params.model, 'video-effect', { endpoint, effectName: params.name, studioType: params.studioType });

        // ─── Validate effect name against allowlist ───────────────────────
        if (!params.name || typeof params.name !== 'string' || !params.name.trim()) {
            throw new Error('generateVideoEffect requires a non-empty `name` (effect preset).');
        }
        const trimmedName = normalizeEffectName(params.name);
        if (!ALLOWED_WAN_EFFECT_NAMES.has(trimmedName)) {
            throw new Error(`Effect "${trimmedName}" is not supported by the API. Use a preset from the studio's effect list.`);
        }

        // ─── Validate & sanitize all parameters ──────────────────────────
        const validation = validateEffectParams(params, EFFECT_PARAM_SCHEMA);
        if (!validation.valid) {
            const firstError = validation.errors[0];
            throw new EffectParamError(firstError.message, firstError.field, firstError.code);
        }
        const p = validation.sanitized;

        // ─── Apply endpoint-specific constraints ─────────────────────────
        // generate_wan_ai_effects only supports 480p/720p
        const resolution = validateResolution(p.resolution, ['480p', '720p']);
        const quality = validateQuality(p.quality, ['medium', 'high']);

        // ─── Build payload ───────────────────────────────────────────────
        const finalPayload = {};

        // Required / core fields
        finalPayload.name = trimmedName;
        if (p.image_url) finalPayload.image_url = p.image_url;
        if (p.video_url) finalPayload.video_url = p.video_url;
        if (p.prompt) finalPayload.prompt = p.prompt;
        if (p.negative_prompt) finalPayload.negative_prompt = p.negative_prompt;
        if (p.aspect_ratio) finalPayload.aspect_ratio = p.aspect_ratio;
        finalPayload.resolution = resolution;
        finalPayload.quality = quality;
        if (p.duration) finalPayload.duration = p.duration;

        // Advanced generation controls (forwarded when provided)
        // These are passed through to the backend if the endpoint supports them.
        // The proxy / backend should ignore unknown params gracefully.
        if (p.seed !== null && p.seed !== undefined && p.seed !== -1) {
            finalPayload.seed = p.seed;
        }
        if (p.guidance_scale !== undefined && p.guidance_scale !== 7.5) {
            finalPayload.guidance_scale = p.guidance_scale;
        }
        if (p.steps !== undefined && p.steps !== 20) {
            finalPayload.steps = p.steps;
        }
        if (p.denoise_strength !== undefined && p.denoise_strength !== 0.7) {
            finalPayload.denoise_strength = p.denoise_strength;
        }
        if (p.effect_strength !== undefined && p.effect_strength !== 1.0) {
            finalPayload.strength = p.effect_strength;
        }
        if (p.cfg_scale !== undefined && p.cfg_scale !== 0.5) {
            finalPayload.cfg_scale = p.cfg_scale;
        }
        if (p.prompt_extend) {
            finalPayload.prompt_extend = true;
        }

        try {
            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: this._getMuapiHeaders(),
                body: JSON.stringify({
                    endpoint,
                    params: finalPayload,
                    generationType: 'video',
                    studioType: params.studioType || 'video'
                }),
                signal
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            this.validateResponse(submitData, 'submit');

            const requestId = submitData.request_id || submitData.id;
            if (!requestId) return submitData;

            const result = await this.pollForResult(requestId, 120, 2000, signal);
            const videoUrl = result.outputs?.[0] || result.url || result.output?.url || result.video?.url;
            analytics.trackGenerationComplete(params.model, 'video-effect', true);
            return { ...result, url: videoUrl };
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('Request cancelled by user');
            analytics.trackGenerationError(params.model, 'video-effect', error);
            throw error;
        }
    }

    async listAssets(params, signal) {
        // NOTE: asset listing is a FIRST-PARTY SmartVideo service, NOT a
        // muapi endpoint (muapi exposes no asset-list route). Route to the
        // app's own backend, never the muapi proxy.
        const base = this.proxyUrl.replace(/\/functions\/v1\/muapi-proxy$/, '') || import.meta.env.VITE_SUPABASE_URL;
        if (!base) {
            throw new Error('App backend URL not configured');
        }
        const finalPayload = {};

        if (params.project) finalPayload.project = params.project;
        if (params.category) finalPayload.category = params.category;
        if (params.type) finalPayload.type = params.type;

        try {
            const response = await fetch(`${base}/functions/v1/assets`, {
                method: 'POST',
                headers: this._getMuapiHeaders(),
                body: JSON.stringify(finalPayload),
                signal
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Asset Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const data = await response.json();
            this.validateResponse(data, 'list');
            return data;
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('Request cancelled by user');
            throw error;
        }
    }

    async makeRequest(endpoint, params, signal) {
        if (!endpoint || typeof endpoint !== 'string') {
            throw new Error('Endpoint is required for makeRequest');
        }

        try {
            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: this._getMuapiHeaders(),
                body: JSON.stringify({
                    endpoint,
                    params: params || {},
                    generationType: 'custom',
                    studioType: 'custom'
                }),
                signal
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const data = await response.json();
            this.validateResponse(data, 'custom');
            return data;
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('Request cancelled by user');
            throw error;
        }
    }

    // Generic JSON passthrough to the muapi proxy for non-generation
    // endpoints (social publishing, result polling, account management).
    // `generationType` maps to the proxy's GET/POST decision: 'list' and
    // 'poll' become GET; anything else (e.g. 'social') becomes POST.
    async proxyJson(endpoint, { method = 'POST', params = {}, generationType } = {}, signal) {
        if (!endpoint || typeof endpoint !== 'string') {
            throw new Error('Endpoint is required for proxyJson');
        }
        const resolvedGenerationType = generationType || (method === 'GET' ? 'list' : 'social');

        try {
            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpoint,
                    params: params || {},
                    generationType: resolvedGenerationType,
                    studioType: 'social',
                }),
                signal,
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Social API failed: ${response.status} ${response.statusText} - ${errText.slice(0, 200)}`);
            }

            const data = await response.json();
            if (data && data.error) {
                throw new Error(`Social API error: ${data.error}${data.details ? ` — ${data.details}` : ''}`);
            }
            return data;
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('Request cancelled by user');
            throw error;
        }
    }

    async generateText(params, signal) {
        this._requireMuapiKey();
        await acquireRateLimitToken();
        const modelInfo = getTextModelById(params.model);
        const endpoint = modelInfo?.endpoint || params.model || 'text';
        analytics.trackGeneration(params.model, 'text', { endpoint });
        const finalPayload = {};

        if (params.model) finalPayload.model = params.model;
        if (params.prompt) finalPayload.prompt = params.prompt;
        if (params.system_prompt) finalPayload.system_prompt = params.system_prompt;
        if (params.temperature) finalPayload.temperature = params.temperature;
        if (params.max_tokens) finalPayload.max_tokens = params.max_tokens;

        try {
            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: this._getMuapiHeaders(),
                body: JSON.stringify({
                    endpoint,
                    params: finalPayload,
                    generationType: 'text',
                    studioType: 'chat'
                }),
                signal
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const data = await response.json();
            this.validateResponse(data, 'text');
            analytics.trackGenerationComplete(params.model, 'text', true);
            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request cancelled by user');
            }
            analytics.trackGenerationError(params.model, 'text', error);
            throw error;
        }
    }

    async trainLora(params, signal) {
        this._requireMuapiKey();
        await acquireRateLimitToken();
        const modelInfo = getTrainingModelById(params.model);
        const endpoint = modelInfo?.endpoint || params.model || 'flux-lora-trainer';
        analytics.trackGeneration(params.model, 'train', { endpoint });
        const finalPayload = {};

        if (params.images) finalPayload.images = params.images;
        if (params.trigger_word) finalPayload.trigger_word = params.trigger_word;
        if (params.epochs) finalPayload.epochs = params.epochs;

        try {
            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: this._getMuapiHeaders(),
                body: JSON.stringify({
                    endpoint,
                    params: finalPayload,
                    generationType: 'train',
                    studioType: 'training'
                }),
                signal
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            this.validateResponse(submitData, 'submit');

            const requestId = submitData.request_id || submitData.id;
            if (!requestId) return submitData;

            const result = await this.pollForResult(requestId, 300, 5000, signal);
            analytics.trackGenerationComplete(params.model, 'train', true);
            return result;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request cancelled by user');
            }
            analytics.trackGenerationError(params.model, 'train', error);
            throw error;
        }
    }

    async processVideoTool(params, signal) {
        this._requireMuapiKey();
        await acquireRateLimitToken();
        const modelInfo = getVideoToolById(params.model);
        const endpoint = modelInfo?.endpoint || params.model || 'video-tool';
        analytics.trackGeneration(params.model, 'video-tool', { endpoint });
        const finalPayload = {};

        if (params.model) finalPayload.model = params.model;
        if (params.video_url) finalPayload.video_url = params.video_url;
        if (params.prompt) finalPayload.prompt = params.prompt;

        try {
            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: this._getMuapiHeaders(),
                body: JSON.stringify({
                    endpoint,
                    params: finalPayload,
                    generationType: 'video-tool',
                    studioType: 'video-tools'
                }),
                signal
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errText.slice(0, 100)}`);
            }

            const submitData = await response.json();
            this.validateResponse(submitData, 'submit');

            const requestId = submitData.request_id || submitData.id;
            if (!requestId) return submitData;

            const result = await this.pollForResult(requestId, 120, 2000, signal);
            const videoUrl = result.outputs?.[0] || result.url || result.output?.url;
            analytics.trackGenerationComplete(params.model, 'video-tool', true);
            return { ...result, url: videoUrl };
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request cancelled by user');
            }
            analytics.trackGenerationError(params.model, 'video-tool', error);
            throw error;
        }
    }

    async processLipSync(params) {
        this._requireMuapiKey();
        await acquireRateLimitToken();
        const modelInfo = getLipSyncModelById(params.model);
        const endpoint = modelInfo?.endpoint || params.model;
        analytics.trackGeneration(params.model, 'lipsync', { endpoint });

        const finalPayload = {};

        if (params.audio_url) finalPayload.audio_url = params.audio_url;
        if (params.image_url) finalPayload.image_url = params.image_url;
        if (params.video_url) finalPayload.video_url = params.video_url;
        if (params.prompt) finalPayload.prompt = params.prompt;
        if (params.resolution) finalPayload.resolution = params.resolution;
        if (params.seed !== undefined && params.seed !== -1) finalPayload.seed = params.seed;

        console.log('[Muapi] LipSync Request:', endpoint, finalPayload);

        try {
            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: this._getMuapiHeaders(),
                body: JSON.stringify({
                    endpoint,
                    params: finalPayload,
                    generationType: 'lipsync',
                    studioType: 'lipsync'
                })
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

            const result = await this.pollForResult(requestId, 900, 2000);
            const videoUrl = result.outputs?.[0] || result.url || result.output?.url;
            console.log('[Muapi] LipSync Result URL:', videoUrl);
            analytics.trackGenerationComplete(params.model, 'lipsync', true);
            return { ...result, url: videoUrl };
        } catch (error) {
            console.error('Muapi LipSync Error:', error);
            analytics.trackGenerationError(params.model, 'lipsync', error);
            throw error;
        }
    }

    getDimensionsFromAR(ar) {
        switch (ar) {
            case '1:1': return [1024, 1024];
            case '16:9': return [1280, 720];
            case '9:16': return [720, 1280];
            case '4:3': return [1152, 864];
            case '3:2': return [1216, 832];
            case '21:9': return [1536, 640];
            default: return [1024, 1024];
        }
    }
}

export default MuapiClient;

export const muapi = new MuapiClient();
