/**
 * VideoDB Client
 *
 * Thin, browser-side wrapper around the VideoDB Server API
 * (https://api.videodb.io). VideoDB is a *user-scoped* service: every request
 * is authenticated with the user's own access token (the "VideoDB API Key"
 * they paste into the setup popup), sent as the `x-access-token` header.
 *
 * Unlike MuAPI (which is proxied server-side with a shared key) or OpenAI
 * (which is forwarded through the muapi proxy), VideoDB calls go straight from
 * the browser to api.videodb.io using the user's token. This is by design: a
 * VideoDB account and its stored media belong to the user, not the app.
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
     * Build the headers for a VideoDB request. Throws if no token is set so
     * the failure is explicit rather than a silent 401.
     */
    _headers(extra = {}) {
        const token = this.getKey();
        if (!token) {
            throw new Error(
                'VideoDB API key not configured. Add your VideoDB API key in Settings.'
            );
        }
        return {
            'Content-Type': 'application/json',
            'x-access-token': token,
            ...extra,
        };
    }

    _url(path) {
        return `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    }

    /**
     * Index/ingest a video (or audio/image) from a URL into a collection.
     * Returns the created media object ({ id, stream_url, player_url, ... }).
     */
    async indexVideo(url, { name, mediaType = 'video', collectionId = DEFAULT_COLLECTION } = {}) {
        const res = await fetch(this._url(`/collection/${encodeURIComponent(collectionId)}/upload`), {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify({ url, name, media_type: mediaType }),
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            throw new Error(`VideoDB index failed (${res.status}): ${detail.slice(0, 200)}`);
        }
        const json = await res.json();
        return json?.data ?? json;
    }

    /**
     * Semantic search across a collection. Returns the `data` payload
     * ({ query, results: [{ video_id, start, end, text, score }] }).
     */
    async searchCollection(query, { collectionId = DEFAULT_COLLECTION, indexType = 'scene', searchType = 'semantic', resultThreshold = 10 } = {}) {
        const res = await fetch(this._url(`/collection/${encodeURIComponent(collectionId)}/search/`), {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify({ query, index_type: indexType, search_type: searchType, result_threshold: resultThreshold }),
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            throw new Error(`VideoDB search failed (${res.status}): ${detail.slice(0, 200)}`);
        }
        const json = await res.json();
        return json?.data ?? json;
    }

    /**
     * Semantic search within a single indexed video (id looks like `m-xxx`).
     */
    async searchVideo(videoId, query, { indexType = 'scene', searchType = 'semantic', resultThreshold = 10 } = {}) {
        const res = await fetch(this._url(`/video/${encodeURIComponent(videoId)}/search/`), {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify({ query, index_type: indexType, search_type: searchType, result_threshold: resultThreshold }),
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            throw new Error(`VideoDB video search failed (${res.status}): ${detail.slice(0, 200)}`);
        }
        const json = await res.json();
        return json?.data ?? json;
    }

    /**
     * Resolve a VideoDB media id (e.g. `m-12345`) to its streamable URL.
     * Used by Render to turn a `?videoId=m-xxx` deep link into a playable src.
     */
    async getStreamUrl(videoId) {
        // Re-index lookup isn't provided by a direct GET in the public API; the
        // upload response already carries stream_url. For retrieval we hit the
        // per-video search with an empty-ish query is wrong, so instead we rely
        // on the standard `/video/{id}` GET used by the JS SDK under the hood.
        const res = await fetch(this._url(`/video/${encodeURIComponent(videoId)}`), {
            method: 'GET',
            headers: this._headers(),
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            throw new Error(`VideoDB get video failed (${res.status}): ${detail.slice(0, 200)}`);
        }
        const json = await res.json();
        const video = json?.data ?? json;
        return video?.stream_url || video?.player_url || null;
    }
}

export const videoDb = new VideoDBClient();
export default videoDb;
