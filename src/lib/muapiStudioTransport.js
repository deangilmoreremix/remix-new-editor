// src/lib/muapiStudioTransport.js
//
// Network adapter for the Muapi Studio page (vendor/muapi-studio).
//
// The studio component speaks plain MuAPI REST (GET /api/v1/models, POST /api/v1/<endpoint>, ...). This app never
// calls api.muapi.ai from the browser for JSON: every call goes through the Supabase `muapi-proxy` edge function
// with the signed-in user's OWN key (BYOK), using the proxy's { endpoint, params, generationType } protocol. This
// adapter is a `fetch` replacement that performs that translation, so the studio works unchanged.
//
// What the edge proxy does not forward is reported as 404, which the studio treats as "feature not available here"
// and hides: `/app/*` routes (the media library) are not proxied. History, polling, delete-media, balance, model
// schemas, cost estimates and submits all are.
//
// Uploads follow the shared rule in src/lib/muapiUpload.js: small files go through the edge proxy as multipart,
// large files go straight to MuAPI (so they never transit the proxy's body limit).

import { SUPABASE_PROXY_BODY_LIMIT_BYTES } from './editor/uploadLimits.js';

/** Virtual base URL the studio is mounted with; stripped before translating. */
export const STUDIO_BASE = '/__muapi-studio';

const DIRECT_UPLOAD_URL = 'https://api.muapi.ai/api/v1/upload_file';

// The proxy only uses generationType to pick GET (poll/list) or POST (everything else).
const KIND_TO_GENERATION_TYPE = {
  image: 'image',
  i2i: 'i2i',
  video: 'video',
  i2v: 'i2v',
  v2v: 'v2v',
  audio: 'audio',
  lipsync: 'lipsync',
  text: 'text',
  train: 'train',
  tool: 'video-tool',
};

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * @param {object} options
 * @param {string} options.proxyUrl   The Supabase muapi-proxy URL.
 * @param {() => (string|null|undefined)} options.getKey  Returns the user's own MuAPI key.
 * @param {typeof fetch} [options.fetchImpl]
 * @param {number} [options.uploadLimit]  Largest file sent through the proxy.
 * @returns {(input: string, init?: RequestInit) => Promise<Response>}
 */
export function createMuapiStudioFetch({
  proxyUrl,
  getKey,
  fetchImpl = (...args) => fetch(...args),
  uploadLimit = SUPABASE_PROXY_BODY_LIMIT_BYTES,
}) {
  return async function muapiStudioFetch(input, init = {}) {
    const url = String(input);
    const path = url.startsWith(STUDIO_BASE) ? url.slice(STUDIO_BASE.length) : url;

    const key = getKey();
    if (!key) return jsonResponse(401, { error: 'MuAPI key not configured. Add your key in Settings.' });

    // /app/* (media library, studio history, ...) is not forwarded by the edge proxy.
    if (path.startsWith('/app/')) return jsonResponse(404, { detail: 'Not available in this app' });

    const match = /^\/api\/v1\/(.+)$/.exec(path);
    if (!match) return jsonResponse(404, { detail: 'Unknown route' });
    const endpoint = match[1];
    const method = String(init.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers);

    if (endpoint === 'upload_file' && init.body instanceof FormData) {
      const file = init.body.get('file');
      const large = file && typeof file.size === 'number' && file.size > uploadLimit;
      return large
        ? fetchImpl(DIRECT_UPLOAD_URL, { method: 'POST', headers: { 'x-api-key': key }, body: init.body, signal: init.signal })
        : fetchImpl(proxyUrl, { method: 'POST', headers: { 'x-api-key': key, 'x-endpoint': 'upload_file' }, body: init.body, signal: init.signal });
    }

    let generationType;
    let params = {};
    let apiMethod;
    if (method === 'GET') {
      generationType = /^predictions\/[^/]+\/result$/.test(endpoint) ? 'poll' : 'list';
    } else if (method === 'DELETE') {
      generationType = 'list';
      apiMethod = 'DELETE';
    } else {
      generationType = KIND_TO_GENERATION_TYPE[headers.get('x-ms-kind')] || 'image';
      try { params = init.body ? JSON.parse(String(init.body)) : {}; } catch { return jsonResponse(400, { error: 'Invalid JSON body' }); }
    }

    return fetchImpl(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ endpoint, params, generationType, studioType: 'muapi-studio', ...(apiMethod ? { apiMethod } : {}) }),
      signal: init.signal,
    });
  };
}
