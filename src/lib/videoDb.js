/**
 * VideoDB Client
 *
 * Thin wrapper around the VideoDB Server API (https://api.videodb.io). VideoDB
 * is a *user-scoped* service: every request is authenticated with the user's
 * own access token (the "VideoDB API Key" they paste into the setup popup),
 * sent as the `x-access-token` header.
 *
 * Where the request runs:
 *   - Preferred: through the app's Render backend proxy (`/api/videodb/proxy`).
 *     The browser sends the user's key in the request body; the backend calls
 *     api.videodb.io server-side. This keeps VideoDB "running on the backend"
 *     (Render.com) and avoids any client/CORS edge cases.
 *   - Fallback: a direct browser to api.videodb.io call (CORS-verified) if the
 *     backend proxy is unreachable. The user's key is still sent only as the
 *     `x-access-token` header and is never persisted server-side.
 *
 * The key is read through `apiKeyManager.getVideoDBKey()`, which handles
 * obfuscated sessionStorage/localStorage persistence, so the token survives
 * reloads and is available to every feature that uses VideoDB:
 *   - Timeline Editor  (index / retrieve media on the timeline)
 *   - Video Agent      (search & pull source videos)
 *   - Render           (resolve a VideoDB media id to a streamable URL)
 *   - Director         (semantic video search & retrieval backend)
 */

import { apiKeyManager } from './apiKeyManager.js';

const VIDEODB_BASE_URL = 'https://api.videodb.io';
const DEFAULT_COLLECTION = 'default';

// Locate the Render backend proxy. Mirrors how muapi/openai routes are built.
function getProxyBaseUrl() {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) {
        return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '');
    }
    if (typeof window !== 'undefined' && window.__BACKEND_URL__) {
        return window.__BACKEND_URL__.replace(/\/$/, '');
    }
    // Same-origin default (the backend is served alongside the app in prod).
    return '';
}

class VideoDBClient {
    constructor() {
        this.baseUrl = VIDEODB_BASE_URL;
        // Bind the manager so feature code can call `videoDb.getKey()` etc.
        this.apiKeyManager = apiKeyManager;
    }

    /**
     * The user's VideoDB access token. Returns null when not configured so
     * callers can gracefully degrade instead of throwing.
     */
    getKey() {
        return this.apiKeyManager.getVideoDBKey();
    }

    hasKey() {
        return this.apiKeyManager.hasVideoDBKey();
    }

    /**
     * Issue a VideoDB request.
     *
     * Tries the backend proxy first (user key sent in body, backend calls
     * api.videodb.io). Falls back to a direct browser call if the proxy is
     * unreachable. Returns the parsed JSON (`data` unwrapped when present).
     */
    async _request(endpoint, { method = 'POST', body } = {}) {
        const token = this.getKey();
        if (!token) {
            throw new Error('VideoDB API key not configured. Add your VideoDB API key in Settings.');
        }

        const proxyBase = getProxyBaseUrl();
        if (proxyBase) {
            try {
                const res = await fetch(`${proxyBase}/api/videodb/proxy`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        endpoint,
                        method,
                        body,
                        videoDbKey: token,
                    }),
                });
                if (res.ok || res.status === 400) {
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        throw new Error(json?.error || json?.message || `VideoDB request failed (${res.status})`);
                    }
                    return json?.data ?? json;
                }
                // Non-JSON / unexpected status from proxy — fall through to direct.
            } catch (err) {
                if (err.message && /VideoDB/.test(err.message)) throw err;
                // Network error talking to the proxy — fall back to direct call.
                console.warn('[videoDb] proxy unreachable, using direct call:', err.message);
            }
        }

        // Direct browser to api.videodb.io (CORS-verified).
        const res = await fetch(`${this.baseUrl}/${endpoint}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token,
            },
            body: method === 'POST' ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            throw new Error(`VideoDB request failed (${res.status}): ${detail.slice(0, 200)}`);
        }
        const json = await res.json();
        return json?.data ?? json;
    }

    /**
     * Index/ingest a video (or audio/image) from a URL into a collection.
     * Returns the created media object ({ id, stream_url, player_url, ... }).
     */
    async indexVideo(url, { name, mediaType = 'video', collectionId = DEFAULT_COLLECTION } = {}) {
        return this._request(`collection/${encodeURIComponent(collectionId)}/upload`, {
            method: 'POST',
            body: { url, name, media_type: mediaType },
        });
    }

    /**
     * Semantic search across a collection. Returns the `data` payload
     * ({ query, results: [{ video_id, start, end, text, score }] }).
     */
    async searchCollection(query, { collectionId = DEFAULT_COLLECTION, indexType = 'scene', searchType = 'semantic', resultThreshold = 10 } = {}) {
        return this._request(`collection/${encodeURIComponent(collectionId)}/search/`, {
            method: 'POST',
            body: { query, index_type: indexType, search_type: searchType, result_threshold: resultThreshold },
        });
    }

    /**
     * Semantic search within a single indexed video (id looks like `m-xxx`).
     */
    async searchVideo(videoId, query, { indexType = 'scene', searchType = 'semantic', resultThreshold = 10 } = {}) {
        return this._request(`video/${encodeURIComponent(videoId)}/search/`, {
            method: 'POST',
            body: { query, index_type: indexType, search_type: searchType, result_threshold: resultThreshold },
        });
    }

    /**
     * Resolve a VideoDB media id (e.g. `m-12345`) to its streamable URL.
     * Used by Render / Video Agent / Timeline to turn a `?videoId=m-xxx` deep
     * link into a playable src. The documented endpoint is
     * `POST /video/{video_id}/stream/`, which returns `data.stream_url`.
     *
     * We request `format: 'mp4'` by default: mp4 plays natively in every
     * browser (including Chrome, which does NOT support HLS without hls.js),
     * so no extra player dependency is required. `player_url` is kept as a
     * fallback.
     */
    async getStreamUrl(videoId, { format = 'mp4' } = {}) {
        const json = await this._request(`video/${encodeURIComponent(videoId)}/stream/`, {
            method: 'POST',
            body: { format },
        });
        const data = json?.data ?? json;
        return data?.stream_url || data?.player_url || null;
    }
}

export const videoDb = new VideoDBClient();
export default videoDb;
