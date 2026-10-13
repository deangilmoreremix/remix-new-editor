/**
 * The ONE shared MuAPI upload adapter.
 *
 * Every MuAPI file upload in the app — image, video, audio, "other", and
 * re-uploads of saved Asset Library assets — MUST go through this module.
 * There is deliberately no second MuAPI upload implementation anywhere; the
 * legacy upload code in `src/lib/muapi.js` and root `lib/muapi.js` now
 * delegates here.
 *
 * MuAPI File Upload API (official):
 *   POST https://api.muapi.ai/api/v1/upload_file
 *   header: x-api-key: <the user's own BYOK key>
 *   body:   multipart/form-data with field name `file`
 *   returns JSON with a presigned `url` (see `result.url` / `result.data.url`).
 *
 * Hard invariants (do not violate):
 *   - The HTTP client generates the multipart boundary. We NEVER hardcode a
 *     Content-Type boundary — we always hand a FormData with a `file` field
 *     and let `fetch`/XMLHttpRequest set the multipart Content-Type.
 *   - BYOK: the key is the user's own, held client-side (apiKeyManager /
 *     authContext.muapiKey). It is NEVER logged, persisted, or echoed in any
 *     error message / userMessage (see handleMuAPIUploadError).
 *   - A presigned MuAPI URL is TEMPORARY (1 hour). It is never stored as a
 *     permanent Asset Library identifier. The upload cache is session memory
 *     only (a module-level Map) — never localStorage.
 *
 * Transport selection (mirrors the historical behaviour):
 *   - files <= SUPABASE_PROXY_BODY_LIMIT_BYTES -> Supabase edge proxy
 *     (multipart, headers x-api-key + x-endpoint: upload_file).
 *   - files > SUPABASE_PROXY_BODY_LIMIT_BYTES  -> direct browser -> MuAPI
 *     (multipart, header x-api-key only). This is why large videos never
 *     transit a Netlify sync function (see docs/MUAPI_UPLOAD_ARCHITECTURE.md).
 *
 * Zero new dependencies.
 */

import { UPLOAD_LIMITS, SUPABASE_PROXY_BODY_LIMIT_BYTES } from './editor/uploadLimits.js';
import { validateFile } from './editor/validateFile.js';
import { apiKeyManager } from './apiKeyManager.js';

// Official MuAPI upload endpoint. Never mutated.
export const MUAPI_UPLOAD_URL = 'https://api.muapi.ai/api/v1/upload_file';

// MuAPI presigned URLs are valid for 1 hour.
const URL_LIFETIME_MS = 60 * 60 * 1000;
// Re-upload a cached asset this long BEFORE its URL actually expires, so a
// generation never races the 1-hour expiry. (5 minutes.)
const CACHE_SAFETY_MARGIN_MS = 5 * 60 * 1000;

// Bounded retry policy: max 3 attempts, exponential backoff 1s / 2s / 4s.
// Only network errors and 502/503/429 are retried. Everything else
// (400/401/402/403/413/415/422) fails immediately.
const MAX_UPLOAD_ATTEMPTS = 3;
const RETRY_BASE_MS = 1000;
const RETRYABLE_STATUSES = new Set([502, 503, 429]);

// Per-attempt timeouts: 30s small (proxy), 120s large (direct).
const SMALL_TIMEOUT_MS = 30 * 1000;
const LARGE_TIMEOUT_MS = 120 * 1000;
// Timeout for downloading a durable original back from permanent storage.
const DOWNLOAD_TIMEOUT_MS = 120 * 1000;

// ============================================================================
// ERROR MODEL
// ============================================================================

/**
 * A single normalized upload error. `code` is stable and machine-readable;
 * `userMessage` is UI-safe plain English that never contains the API key.
 */
export class MuapiUploadError extends Error {
    constructor(code, message, options = {}) {
        super(message);
        this.name = 'MuapiUploadError';
        this.code = code;
        this.retryable = options.retryable === true;
        this.userMessage = typeof options.userMessage === 'string' ? options.userMessage : message;
        this.status = typeof options.status === 'number' ? options.status : undefined;
    }
}

// Stable, key-free messages. `message` is a concise technical summary;
// `userMessage` is what surfaces in the UI. NEITHER ever embeds the API key
// (they are fixed templates, never raw provider text).
const ERROR_TEMPLATES = {
    MUAPI_KEY_MISSING: {
        message: 'MuAPI API key is not configured.',
        userMessage: 'Add your MuAPI API key in Settings to upload files.',
        retryable: false,
    },
    MUAPI_AUTH_FAILED: {
        message: 'MuAPI rejected the API key.',
        userMessage: 'MuAPI rejected your API key. Check it in Settings and try again.',
        retryable: false,
    },
    MUAPI_INSUFFICIENT_CREDITS: {
        message: 'MuAPI account has insufficient credits.',
        userMessage: 'Your MuAPI account is out of credits. Add credits at muapi.ai to continue uploading.',
        retryable: false,
    },
    MUAPI_UNSUPPORTED_FORMAT: {
        message: 'The file type is not supported by MuAPI.',
        userMessage: 'This file type is not supported. Use a supported image, video, or audio file.',
        retryable: false,
    },
    MUAPI_FILE_TOO_LARGE: {
        message: 'The file exceeds the MuAPI size limit.',
        userMessage: 'This file is too large for MuAPI (images 10 MB, videos 50 MB, other 10 MB).',
        retryable: false,
    },
    MUAPI_RATE_LIMITED: {
        message: 'MuAPI rate-limited the upload.',
        userMessage: 'Too many uploads right now. Please wait a moment and try again.',
        retryable: true,
    },
    MUAPI_TIMEOUT: {
        message: 'The upload timed out.',
        userMessage: 'The upload took too long. Please check your connection and try again.',
        retryable: true,
    },
    MUAPI_NETWORK: {
        message: 'A network error interrupted the upload.',
        userMessage: 'A network error interrupted the upload. Check your connection and try again.',
        retryable: true,
    },
    MUAPI_PROVIDER_ERROR: {
        message: 'MuAPI could not process the upload.',
        userMessage: 'MuAPI could not process the upload right now. Please try again.',
        retryable: false,
    },
    MUAPI_INVALID_RESPONSE: {
        message: 'MuAPI returned an unexpected response (no upload URL).',
        userMessage: 'MuAPI returned an unexpected response. Please try again.',
        retryable: false,
    },
    MUAPI_URL_EXPIRED: {
        message: 'The MuAPI upload URL has expired.',
        userMessage: 'The upload link expired. Re-upload to continue.',
        retryable: false,
    },
    MUAPI_REUPLOAD_FAILED: {
        message: 'Could not re-upload the saved asset to MuAPI.',
        userMessage: 'Could not prepare the saved asset for upload. Please re-upload it.',
        retryable: false,
    },
    MUAPI_CANCELLED: {
        message: 'The upload was cancelled.',
        userMessage: 'Upload cancelled.',
        retryable: false,
    },
    MUAPI_NO_FILE: {
        message: 'No file was provided for upload.',
        userMessage: 'Choose a file to upload.',
        retryable: false,
    },
};

/**
 * Build the normalized `{ code, message, retryable, userMessage }` descriptor
 * for a known code. `message`/`userMessage` are always the safe templates.
 */
function describeError(code, retryableOverride) {
    const template = ERROR_TEMPLATES[code] || ERROR_TEMPLATES.MUAPI_PROVIDER_ERROR;
    return {
        code,
        message: template.message,
        retryable: typeof retryableOverride === 'boolean' ? retryableOverride : template.retryable,
        userMessage: template.userMessage,
    };
}

/**
 * Map ANY upload failure (thrown by this adapter, by the transport, or by a
 * caller) to a normalized descriptor. The returned `message` and `userMessage`
 * are built exclusively from the fixed ERROR_TEMPLATES, so an API key that
 * leaked into the raw error text can NEVER appear in the normalized output.
 *
 * @param {*} error
 * @returns {{ code: string, message: string, retryable: boolean, userMessage: string }}
 */
export function handleMuAPIUploadError(error) {
    if (!error) {
        return describeError('MUAPI_NETWORK');
    }

    // Already a known MuAPI code (MuapiUploadError or any object carrying one).
    const code = error && typeof error.code === 'string' ? error.code : undefined;
    if (code && ERROR_TEMPLATES[code]) {
        // 5xx provider errors are the only provider code we call retryable.
        const retryableOverride = code === 'MUAPI_PROVIDER_ERROR' && error.status >= 500
            ? true
            : undefined;
        return describeError(code, retryableOverride);
    }

    const status =
        typeof error.status === 'number' ? error.status
            : (typeof error.statusCode === 'number' ? error.statusCode : undefined);
    const name = typeof error.name === 'string' ? error.name : '';
    const raw = typeof error.message === 'string' ? error.message.toLowerCase() : '';

    // Cancellation / timeout are detected by name/message, never by content.
    if (name === 'AbortError' || name === 'CanceledError' || raw.includes('cancel') || raw.includes('abort')) {
        return describeError(raw.includes('timeout') || raw.includes('timed out') ? 'MUAPI_TIMEOUT' : 'MUAPI_CANCELLED');
    }
    if (raw.includes('timeout') || raw.includes('timed out') || raw.includes('etimedout')) {
        return describeError('MUAPI_TIMEOUT');
    }

    if (typeof status === 'number') {
        switch (status) {
            case 401:
            case 403:
                return describeError('MUAPI_AUTH_FAILED');
            case 402:
                return describeError('MUAPI_INSUFFICIENT_CREDITS');
            case 400:
            case 415:
                return describeError('MUAPI_UNSUPPORTED_FORMAT');
            case 413:
                return describeError('MUAPI_FILE_TOO_LARGE');
            case 429:
                return describeError('MUAPI_RATE_LIMITED');
            case 502:
            case 503:
                return describeError('MUAPI_PROVIDER_ERROR', true);
            default:
                if (status >= 500) return describeError('MUAPI_PROVIDER_ERROR', true);
                if (status >= 400) return describeError('MUAPI_PROVIDER_ERROR');
                break;
        }
    }

    // No status at all -> a transport/network failure.
    return describeError('MUAPI_NETWORK');
}

// Internal constructors used by the transport. Each carries a safe message.
function missingKeyError() {
    return new MuapiUploadError('MUAPI_KEY_MISSING', ERROR_TEMPLATES.MUAPI_KEY_MISSING.message, {
        retryable: false,
        userMessage: ERROR_TEMPLATES.MUAPI_KEY_MISSING.userMessage,
    });
}

function cancelledError() {
    return new MuapiUploadError('MUAPI_CANCELLED', ERROR_TEMPLATES.MUAPI_CANCELLED.message, {
        retryable: false,
        userMessage: ERROR_TEMPLATES.MUAPI_CANCELLED.userMessage,
    });
}

function timeoutError() {
    return new MuapiUploadError('MUAPI_TIMEOUT', ERROR_TEMPLATES.MUAPI_TIMEOUT.message, {
        retryable: true,
        userMessage: ERROR_TEMPLATES.MUAPI_TIMEOUT.userMessage,
    });
}

function networkError() {
    return new MuapiUploadError('MUAPI_NETWORK', ERROR_TEMPLATES.MUAPI_NETWORK.message, {
        retryable: true,
        userMessage: ERROR_TEMPLATES.MUAPI_NETWORK.userMessage,
    });
}

function invalidResponseError() {
    return new MuapiUploadError('MUAPI_INVALID_RESPONSE', ERROR_TEMPLATES.MUAPI_INVALID_RESPONSE.message, {
        retryable: false,
        userMessage: ERROR_TEMPLATES.MUAPI_INVALID_RESPONSE.userMessage,
    });
}

function statusToError(status) {
    switch (status) {
        case 401:
        case 403:
            return new MuapiUploadError('MUAPI_AUTH_FAILED', ERROR_TEMPLATES.MUAPI_AUTH_FAILED.message, { retryable: false, userMessage: ERROR_TEMPLATES.MUAPI_AUTH_FAILED.userMessage, status });
        case 402:
            return new MuapiUploadError('MUAPI_INSUFFICIENT_CREDITS', ERROR_TEMPLATES.MUAPI_INSUFFICIENT_CREDITS.message, { retryable: false, userMessage: ERROR_TEMPLATES.MUAPI_INSUFFICIENT_CREDITS.userMessage, status });
        case 400:
        case 415:
            return new MuapiUploadError('MUAPI_UNSUPPORTED_FORMAT', ERROR_TEMPLATES.MUAPI_UNSUPPORTED_FORMAT.message, { retryable: false, userMessage: ERROR_TEMPLATES.MUAPI_UNSUPPORTED_FORMAT.userMessage, status });
        case 413:
            return new MuapiUploadError('MUAPI_FILE_TOO_LARGE', ERROR_TEMPLATES.MUAPI_FILE_TOO_LARGE.message, { retryable: false, userMessage: ERROR_TEMPLATES.MUAPI_FILE_TOO_LARGE.userMessage, status });
        case 429:
            return new MuapiUploadError('MUAPI_RATE_LIMITED', ERROR_TEMPLATES.MUAPI_RATE_LIMITED.message, { retryable: true, userMessage: ERROR_TEMPLATES.MUAPI_RATE_LIMITED.userMessage, status });
        default:
            return new MuapiUploadError('MUAPI_PROVIDER_ERROR', ERROR_TEMPLATES.MUAPI_PROVIDER_ERROR.message, { retryable: status >= 500, userMessage: ERROR_TEMPLATES.MUAPI_PROVIDER_ERROR.userMessage, status });
    }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate a file against MuAPI limits (image 10 MB / video 50 MB / other
 * 10 MB), the allowed MIME + extension lists from uploadLimits.js, and magic
 * bytes via validateFile.js.
 *
 * @param {File|Blob} file
 * @returns {Promise<{ category: 'image'|'video'|'other', mime: string, sizeBytes: number, name: string }>}
 * @throws {MuapiUploadError} MUAPI_NO_FILE / MUAPI_FILE_TOO_LARGE / MUAPI_UNSUPPORTED_FORMAT
 */
export async function validateMuAPIUpload(file) {
    if (!file) {
        throw new MuapiUploadError('MUAPI_NO_FILE', ERROR_TEMPLATES.MUAPI_NO_FILE.message, {
            retryable: false,
            userMessage: ERROR_TEMPLATES.MUAPI_NO_FILE.userMessage,
        });
    }

    let validation;
    try {
        validation = await validateFile(file);
    } catch (e) {
        // validateFile throws only on exotic inputs; treat as unsupported.
        validation = { valid: false, type: 'unknown', error: 'Could not read file' };
    }

    const detectedType = validation && validation.type ? validation.type : 'unknown';
    // MuAPI only cares about image / video / everything-else. Audio, documents
    // and any other allowed type collapse to "other" (10 MB cap).
    const category = detectedType === 'image' ? 'image' : (detectedType === 'video' ? 'video' : 'other');
    const sizeLimit = category === 'image'
        ? UPLOAD_LIMITS.image
        : (category === 'video' ? UPLOAD_LIMITS.video : UPLOAD_LIMITS.other);
    const sizeBytes = typeof file.size === 'number' ? file.size : 0;
    const errText = String((validation && validation.error) || '').toLowerCase();

    if (!validation || validation.valid !== true || detectedType === 'unknown') {
        if (errText.includes('too large') || (sizeBytes > sizeLimit)) {
            throw new MuapiUploadError('MUAPI_FILE_TOO_LARGE', ERROR_TEMPLATES.MUAPI_FILE_TOO_LARGE.message, {
                retryable: false,
                userMessage: ERROR_TEMPLATES.MUAPI_FILE_TOO_LARGE.userMessage,
            });
        }
        throw new MuapiUploadError('MUAPI_UNSUPPORTED_FORMAT', ERROR_TEMPLATES.MUAPI_UNSUPPORTED_FORMAT.message, {
            retryable: false,
            userMessage: ERROR_TEMPLATES.MUAPI_UNSUPPORTED_FORMAT.userMessage,
        });
    }

    // Valid type — re-check size against the MuAPI cap for the mapped category.
    if (sizeBytes > sizeLimit) {
        throw new MuapiUploadError('MUAPI_FILE_TOO_LARGE', ERROR_TEMPLATES.MUAPI_FILE_TOO_LARGE.message, {
            retryable: false,
            userMessage: ERROR_TEMPLATES.MUAPI_FILE_TOO_LARGE.userMessage,
        });
    }

    return {
        category,
        mime: (file.type || (validation && validation.mime) || ''),
        sizeBytes,
        name: (file.name || ''),
    };
}

// ============================================================================
// KEY + URL RESOLUTION (BYOK)
// ============================================================================

/**
 * Resolve the user's own MuAPI key. Prefers an explicit authContext.muapiKey,
 * then falls back to the client-side apiKeyManager. Returns '' when none.
 */
function resolveMuapiKey(authContext) {
    const ctxKey = authContext && typeof authContext.muapiKey === 'string' ? authContext.muapiKey.trim() : '';
    if (ctxKey) return ctxKey;
    const managed = apiKeyManager.getMuapiKey();
    const trimmed = typeof managed === 'string' ? managed.trim() : '';
    return trimmed || '';
}

/**
 * Supabase project base, mirroring getSupabaseUrl() semantics: the configured
 * VITE_SUPABASE_URL. Read defensively so this module loads in any runtime:
 *   - Browser: Vite inlines import.meta.env.VITE_SUPABASE_URL at build time.
 *   - Non-browser (node integration tests): read process.env instead.
 */
function supabaseBaseUrl() {
    const viteBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '';
    const nodeBase = (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_URL) || '';
    return String(viteBase || nodeBase).trim();
}

function isBrowserRuntime() {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Decide the transport endpoint for a file of the given size.
 *   - Small files normally go through the Supabase edge proxy (multipart with
 *     x-api-key + x-endpoint). In a browser the proxy is same-origin (relative
 *     dev path) unless VITE_SUPABASE_URL is configured.
 *   - In a non-browser runtime with no proxy configured there is no same-origin
 *     proxy, so small files go directly to MuAPI (only the BYOK key is needed).
 *   - Large files always go direct to MuAPI.
 */
function resolveUploadEndpoint(sizeBytes) {
    const base = supabaseBaseUrl();
    const isBrowser = isBrowserRuntime();
    const small = (sizeBytes || 0) <= SUPABASE_PROXY_BODY_LIMIT_BYTES;
    if (small && (isBrowser || base)) {
        const url = base ? `${base.replace(/\/$/, '')}/functions/v1/muapi-proxy` : '/functions/v1/muapi-proxy';
        return { useProxy: true, url, timeoutMs: SMALL_TIMEOUT_MS };
    }
    return { useProxy: false, url: MUAPI_UPLOAD_URL, timeoutMs: LARGE_TIMEOUT_MS };
}

// Extract the presigned upload URL from a parsed provider response.
function extractUploadUrl(result) {
    if (!result || typeof result !== 'object') return null;
    if (typeof result.url === 'string' && result.url) return result.url;
    if (result.data && typeof result.data === 'object' && typeof result.data.url === 'string' && result.data.url) {
        return result.data.url;
    }
    return null;
}

function backoff(attempt) {
    const ms = RETRY_BASE_MS * (2 ** attempt);
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// TRANSPORT — single attempt senders (never set a manual multipart boundary)
// ============================================================================

// Parse a fetch Response as JSON, tolerating environments whose Response
// objects only implement json() (the standard path) or only text(). Returns
// null when the body is empty or not JSON.
async function readResponseJson(response) {
    if (!response) return null;
    if (typeof response.json === 'function') {
        try {
            return await response.json();
        } catch {
            // fall through to the text() path below
        }
    }
    if (typeof response.text === 'function') {
        try {
            const text = await response.text();
            if (text) {
                try {
                    return JSON.parse(text);
                } catch {
                    return null;
                }
            }
        } catch {
            return null;
        }
    }
    return null;
}

// Resolve to { status, ok, json } or reject with a suberror descriptor
// ({ userCancelled: true } | { timedOut: true } | { network: true }).
function sendWithFetch(url, headers, formData, timeoutMs, signal) {
    return new Promise((resolve, reject) => {
        const controller = new AbortController();
        let timedOut = false;
        const timeoutId = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeoutMs);

        const onCallerAbort = () => controller.abort();
        if (signal) {
            if (signal.aborted) {
                clearTimeout(timeoutId);
                reject({ userCancelled: true });
                return;
            }
            signal.addEventListener('abort', onCallerAbort, { once: true });
        }

        fetch(url, {
            method: 'POST',
            headers,
            body: formData,
            signal: controller.signal,
        })
            .then(async (response) => {
                clearTimeout(timeoutId);
                if (signal) signal.removeEventListener('abort', onCallerAbort);
                const json = await readResponseJson(response);
                resolve({ status: response.status, ok: response.ok, json });
            })
            .catch((err) => {
                clearTimeout(timeoutId);
                if (signal) signal.removeEventListener('abort', onCallerAbort);
                if (err && err.name === 'AbortError') {
                    reject(timedOut ? { timedOut: true } : { userCancelled: true });
                } else {
                    reject({ network: true });
                }
            });
    });
}

// XMLHttpRequest variant that reports upload progress via the 3rd arg. Uses the
// same endpoint/headers/timeout contract as the fetch path.
function sendWithXhr(url, headers, formData, timeoutMs, signal, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.timeout = timeoutMs;

        Object.keys(headers).forEach((name) => {
            try {
                xhr.setRequestHeader(name, headers[name]);
            } catch { /* ignore header set failures */ }
        });

        if (typeof onProgress === 'function' && xhr.upload) {
            xhr.upload.addEventListener('progress', (e) => {
                if (e && e.lengthComputable && e.total > 0) {
                    try {
                        onProgress(Math.round((e.loaded / e.total) * 100));
                    } catch { /* ignore progress callback errors */ }
                }
            });
        }

        xhr.addEventListener('load', () => {
            let json = null;
            try {
                json = xhr.responseText ? JSON.parse(xhr.responseText) : null;
            } catch {
                json = null;
            }
            resolve({ status: xhr.status, ok: xhr.status >= 200 && xhr.status < 300, json, text: xhr.responseText });
        });
        xhr.addEventListener('timeout', () => reject({ timedOut: true }));
        xhr.addEventListener('error', () => reject({ network: true }));
        xhr.addEventListener('abort', () => {
            if (signal && signal.aborted) reject({ userCancelled: true });
            else reject({ network: true });
        });

        if (signal) {
            if (signal.aborted) {
                reject({ userCancelled: true });
                return;
            }
            signal.addEventListener('abort', () => xhr.abort(), { once: true });
        }

        xhr.send(formData);
    });
}

/**
 * Route a validated file to MuAPI through the correct transport (proxy for
 * small files, direct for large ones), applying bounded retries. Returns the
 * presigned URL string. Only throws normalized MuapiUploadError values.
 */
async function transportUpload(file, meta, authContext, options, key) {
    const signal = options.signal || null;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const { useProxy, url, timeoutMs } = resolveUploadEndpoint(meta.sizeBytes || file.size || 0);
    const headers = useProxy
        ? { 'x-api-key': key, 'x-endpoint': 'upload_file' }
        : { 'x-api-key': key };

    let lastError = null;

    for (let attempt = 0; attempt < MAX_UPLOAD_ATTEMPTS; attempt++) {
        const canRetry = attempt < MAX_UPLOAD_ATTEMPTS - 1;
        if (signal && signal.aborted) {
            throw cancelledError();
        }

        const formData = new FormData();
        // The HTTP client derives the multipart boundary from the FormData.
        formData.append('file', file, meta.name || (file.name || 'file'));

        let outcome = null;
        let sendFailure = null;
        try {
            outcome = await (onProgress
                ? sendWithXhr(url, headers, formData, timeoutMs, signal, onProgress)
                : sendWithFetch(url, headers, formData, timeoutMs, signal));
        } catch (sendErr) {
            sendFailure = sendErr || { network: true };
        }

        if (sendFailure) {
            if (sendFailure.userCancelled) {
                throw cancelledError();
            }
            const attemptError = sendFailure.timedOut ? timeoutError() : networkError();
            lastError = attemptError;
            if (canRetry) {
                await backoff(attempt);
            } else {
                throw attemptError;
            }
        } else if (outcome.ok) {
            const uploadUrl = extractUploadUrl(outcome.json);
            if (uploadUrl) {
                return uploadUrl;
            }
            // 200 but no parsable url: never treat as success, never retry.
            throw invalidResponseError();
        } else if (RETRYABLE_STATUSES.has(outcome.status)) {
            lastError = statusToError(outcome.status);
            if (canRetry) {
                await backoff(attempt);
            } else {
                throw lastError;
            }
        } else {
            throw statusToError(outcome.status);
        }
    }

    // Safety net: canRetry() returned false inside the loop is handled by the
    // in-loop `throw`; this only triggers if the loop is ever edited wrong.
    throw lastError || networkError();
}

// ============================================================================
// UPLOAD CACHE — session memory only (never localStorage)
// ============================================================================

const uploadCache = new Map();

function cacheKeyFor(authContext, assetId) {
    const workspace = authContext && authContext.workspaceId ? authContext.workspaceId : '';
    return `${workspace}:${assetId}`;
}

/** Exposed for tests: read a cache entry (raw), or undefined. */
export function getCachedMuapiUpload(assetId, authContext) {
    return uploadCache.get(cacheKeyFor(authContext, assetId));
}

/** Exposed for tests: drop all cache entries (simulates a fresh session). */
export function clearMuapiUploadCache() {
    uploadCache.clear();
}

// ============================================================================
// CORE UPLOAD
// ============================================================================

/**
 * Validate the file, resolve the key, route to MuAPI, and build the standard
 * descriptor. `expectedCategory` (image/video) is enforced when provided.
 */
async function coreUpload(file, authContext, options, expectedCategory) {
    const meta = await validateMuAPIUpload(file);

    if (expectedCategory && meta.category !== expectedCategory) {
        throw new MuapiUploadError('MUAPI_UNSUPPORTED_FORMAT', ERROR_TEMPLATES.MUAPI_UNSUPPORTED_FORMAT.message, {
            retryable: false,
            userMessage: ERROR_TEMPLATES.MUAPI_UNSUPPORTED_FORMAT.userMessage,
        });
    }

    const key = resolveMuapiKey(authContext);
    if (!key) {
        throw missingKeyError();
    }

    const url = await transportUpload(file, meta, authContext, options || {}, key);
    const uploadedAt = Date.now();
    return {
        url,
        category: meta.category,
        source: 'file',
        uploadedAt,
        expiresAt: uploadedAt + URL_LIFETIME_MS,
    };
}

/**
 * Upload an image file to MuAPI.
 * @returns {Promise<{ url, category:'image', source:'file', uploadedAt, expiresAt }>}
 */
export function uploadImageToMuAPI(file, authContext, options = {}) {
    return coreUpload(file, authContext, options, 'image');
}

/**
 * Upload a video file to MuAPI.
 * @returns {Promise<{ url, category:'video', source:'file', uploadedAt, expiresAt }>}
 */
export function uploadVideoToMuAPI(file, authContext, options = {}) {
    return coreUpload(file, authContext, options, 'video');
}

/**
 * Upload a file of any allowed category (audio / document / other). Provided so
 * existing callers that handled non-image/video types can delegate to the one
 * shared adapter instead of re-implementing a transport.
 * @returns {Promise<{ url, category, source:'file', uploadedAt, expiresAt }>}
 */
export function uploadFileToMuapi(file, authContext, options = {}) {
    return coreUpload(file, authContext, options, null);
}

// ============================================================================
// PERMANENT ASSET -> FRESH MUTEMPORARY URL
// ============================================================================

/**
 * Download the durable original bytes from a resolved permanent reference so
 * the bytes can be re-uploaded through the same transport. The permanent
 * reference URL is NEVER a MuAPI temp URL — it points at Supabase Storage.
 */
async function fetchPermanentRefAsFile(ref, signal) {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, DOWNLOAD_TIMEOUT_MS);
    const onCallerAbort = () => controller.abort();
    if (signal) {
        if (signal.aborted) {
            clearTimeout(timeoutId);
            throw new Error('cancelled');
        }
        signal.addEventListener('abort', onCallerAbort, { once: true });
    }

    try {
        const response = await fetch(ref.url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`Failed to download permanent asset: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        const name = ref.name || `muapi-asset-${Date.now()}`;
        const mime = ref.mime || '';
        return new File([buffer], name, { type: mime });
    } catch (err) {
        if (err && err.name === 'AbortError') {
            throw new Error(timedOut ? 'timeout' : 'cancelled');
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener('abort', onCallerAbort);
    }
}

function reuploadFailedError() {
    return new MuapiUploadError('MUAPI_REUPLOAD_FAILED', ERROR_TEMPLATES.MUAPI_REUPLOAD_FAILED.message, {
        retryable: false,
        userMessage: ERROR_TEMPLATES.MUAPI_REUPLOAD_FAILED.userMessage,
    });
}

/**
 * Resolve a permanent Asset Library asset to a FRESH MuAPI upload URL.
 *
 * - Loads the durable reference via resolvePermanentMediaReference (dynamic
 *   import of './assetLibrary.js' — owned by another module).
 * - Reuses a still-valid cached URL (within CACHE_SAFETY_MARGIN_MS of expiry).
 * - Otherwise downloads the original bytes and re-uploads through the same
 *   transport, then caches the result.
 *
 * @param {string} assetId
 * @param {{ userId?: string, workspaceId?: string, muapiKey?: string }} authContext
 * @param {{ signal?: AbortSignal, onProgress?: Function }} [options]
 * @returns {Promise<{ url, source:'cache'|'asset', assetId, uploadedAt, expiresAt, category }>}
 * @throws {MuapiUploadError} MUAPI_KEY_MISSING / MUAPI_REUPLOAD_FAILED
 */
export async function resolveMuAPIMediaInput(assetId, authContext, options = {}) {
    if (!assetId) {
        throw reuploadFailedError();
    }

    const key = resolveMuapiKey(authContext);
    if (!key) {
        throw missingKeyError();
    }

    const cacheKey = cacheKeyFor(authContext, assetId);
    const cached = uploadCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt - CACHE_SAFETY_MARGIN_MS) {
        return {
            url: cached.url,
            source: 'cache',
            assetId,
            uploadedAt: cached.uploadedAt,
            expiresAt: cached.expiresAt,
            category: cached.category,
        };
    }

    // Cache miss or about to expire -> resolve the permanent reference and
    // re-upload fresh bytes. Any failure here is a re-upload failure.
    // The Asset Library module (owned by Sub-agent C) is reached via a lazy
    // dynamic import so this optional integration point is not eagerly loaded
    // and stays mockable in tests.
    let reference;
    try {
        const assetLibrary = await import('./assetLibrary.js');
        if (!assetLibrary || typeof assetLibrary.resolvePermanentMediaReference !== 'function') {
            throw new Error('resolvePermanentMediaReference is unavailable');
        }
        reference = await assetLibrary.resolvePermanentMediaReference(assetId, authContext);
    } catch {
        throw reuploadFailedError();
    }
    if (!reference || typeof reference.url !== 'string' || !reference.url) {
        throw reuploadFailedError();
    }

    let file;
    try {
        file = await fetchPermanentRefAsFile(reference, options.signal);
    } catch {
        throw reuploadFailedError();
    }

    let descriptor;
    try {
        descriptor = await coreUpload(file, authContext, options, null);
    } catch {
        throw reuploadFailedError();
    }

    const entry = {
        url: descriptor.url,
        uploadedAt: descriptor.uploadedAt,
        expiresAt: descriptor.expiresAt,
        category: descriptor.category,
    };
    uploadCache.set(cacheKey, entry);

    return {
        url: descriptor.url,
        source: 'asset',
        assetId,
        uploadedAt: descriptor.uploadedAt,
        expiresAt: descriptor.expiresAt,
        category: descriptor.category,
    };
}
